// 放置路徑：src/hooks/useRealtimeVoice.ts
//
// 功能：封裝 OpenAI Realtime API + WebRTC 語音連線邏輯
//       - 向 /api/realtime/session 取得 ephemeral token
//       - 建立 WebRTC peer connection + data channel
//       - 自動偵測語音（server_vad）
//       - 收集逐字稿，斷線時存入 Supabase（via /api/realtime/save）
//       - 透過 onTranscript callback 把訊息回傳給 chat page

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// ────────────────────────────────────────────────
// 型別
// ────────────────────────────────────────────────

export interface VoiceMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  source: 'voice';
}

export interface UseRealtimeVoiceOptions {
  /** 每當有新逐字稿（user 或 assistant），callback 讓 chat page 加入訊息列表 */
  onTranscript: (msg: VoiceMessage) => void;
}

export interface UseRealtimeVoiceReturn {
  isConnected: boolean;
  isConnecting: boolean;
  isUserSpeaking: boolean;
  isAssistantSpeaking: boolean;
  /** 麥克風音量 0~1，可用來驅動 UI 動畫 */
  userLevel: number;
  statusText: string;
  /** mode: 'practice'（21天練習）| 'consultant'（我卡住了，幫我拆 / v1.3.2a 前稱「跟諮詢師對話」） */
  connect: (mode?: 'practice' | 'consultant') => Promise<void>;
  disconnect: () => void;
}

// ────────────────────────────────────────────────
// 音量偵測（內部 helper）
// ────────────────────────────────────────────────

function useAudioLevel(stream: MediaStream | null): number {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (!stream || !stream.getAudioTracks().length) {
      setLevel(0);
      return;
    }

    let mounted = true;
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    let source: MediaStreamAudioSourceNode | null = null;
    let raf = 0;

    try {
      source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
    } catch {
      ctx.close();
      return;
    }

    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      if (!mounted) return;
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((s, v) => s + v, 0) / (data.length || 1);
      setLevel(Math.min(1, avg / 90));
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      mounted = false;
      cancelAnimationFrame(raf);
      try { source?.disconnect(); } catch { /* ignore */ }
      try { analyser.disconnect(); } catch { /* ignore */ }
      ctx.close().catch(() => undefined);
    };
  }, [stream]);

  return level;
}

// ────────────────────────────────────────────────
// 主 Hook
// ────────────────────────────────────────────────

export function useRealtimeVoice({ onTranscript }: UseRealtimeVoiceOptions): UseRealtimeVoiceReturn {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 逐字稿 buffer（delta 累積用）
  const transcriptBufferRef = useRef<Record<string, string>>({});
  // 已完成的對話訊息（斷線時存入 Supabase）
  const collectedMessagesRef = useRef<VoiceMessage[]>([]);
  // v1.3.7c: 當前 session mode（'practice' | 'consultant'）—— 給 saveVoiceConversation 用、決定 context_type + autoTitle
  const currentModeRef = useRef<'practice' | 'consultant'>('practice');

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
  const [statusText, setStatusText] = useState('尚未連線');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const userLevel = useAudioLevel(localStream);

  // ─── 工具函式 ────────────────────────────────

  const sendClientEvent = useCallback((event: Record<string, unknown>) => {
    const dc = dcRef.current;
    if (!dc || dc.readyState !== 'open') return false;
    dc.send(JSON.stringify(event));
    return true;
  }, []);

  /** 儲存本次語音對話到 Supabase（v1.3.7c：mode 決定 context_type + 是否走 autoTitle）*/
  const saveVoiceConversation = useCallback(async () => {
    const msgs = collectedMessagesRef.current;
    if (!msgs.length) return;
    try {
      await fetch('/api/realtime/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: msgs, mode: currentModeRef.current }),
      });
    } catch (err) {
      console.error('[useRealtimeVoice] save failed:', err);
    }
  }, []);

  // ─── 斷線 ────────────────────────────────────

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    // 先存對話再清理
    saveVoiceConversation();

    dcRef.current?.close();
    dcRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;

    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);

    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
    }

    transcriptBufferRef.current = {};
    collectedMessagesRef.current = [];

    setIsConnected(false);
    setIsConnecting(false);
    setIsUserSpeaking(false);
    setIsAssistantSpeaking(false);
    setStatusText('已斷線');
  }, [saveVoiceConversation]);

  // ─── 處理 OpenAI Realtime 事件 ───────────────

  const handleServerEvent = useCallback((event: Record<string, unknown>) => {
    switch (event.type) {
      // 用戶開始說話
      case 'input_audio_buffer.speech_started':
        setIsUserSpeaking(true);
        setStatusText('你正在說話⋯');
        break;

      // 用戶停止說話
      case 'input_audio_buffer.speech_stopped':
        setIsUserSpeaking(false);
        setStatusText('語音已送出，等待小羽回應⋯');
        break;

      // 用戶語音逐字稿（完成）
      case 'conversation.item.input_audio_transcription.completed': {
        const transcript = event.transcript as string | undefined;
        const itemId = event.item_id as string | undefined;
        if (transcript && itemId) {
          const msg: VoiceMessage = {
            role: 'user',
            content: transcript,
            timestamp: new Date().toISOString(),
            source: 'voice',
          };
          collectedMessagesRef.current.push(msg);
          onTranscript(msg);
        }
        break;
      }

      // 小羽語音逐字稿（delta 累積）
      case 'response.output_audio_transcript.delta': {
        const itemId = event.item_id as string;
        const delta = event.delta as string;
        if (itemId && delta) {
          transcriptBufferRef.current[itemId] = (transcriptBufferRef.current[itemId] ?? '') + delta;
        }
        break;
      }

      // 小羽語音逐字稿（完成）
      case 'response.output_audio_transcript.done': {
        const itemId = event.item_id as string;
        const transcript = (event.transcript as string | undefined)
          ?? transcriptBufferRef.current[itemId]
          ?? '';
        if (transcript) {
          const msg: VoiceMessage = {
            role: 'assistant',
            content: transcript,
            timestamp: new Date().toISOString(),
            source: 'voice',
          };
          collectedMessagesRef.current.push(msg);
          onTranscript(msg);
        }
        delete transcriptBufferRef.current[itemId];
        break;
      }

      // 小羽開始播放音訊
      case 'output_audio_buffer.started':
        setIsAssistantSpeaking(true);
        setStatusText('小羽正在說話⋯');
        break;

      // 小羽停止播放音訊
      case 'output_audio_buffer.stopped':
      case 'output_audio_buffer.cleared':
        setIsAssistantSpeaking(false);
        setStatusText('已連線，可以直接說話');
        break;

      case 'error': {
        const errMsg = (event.error as { message?: string } | undefined)?.message ?? '未知錯誤';
        console.error('[useRealtimeVoice] Realtime error:', errMsg);
        setStatusText(`錯誤：${errMsg}`);
        break;
      }

      default:
        break;
    }
  }, [onTranscript]);

  // ─── 連線 ────────────────────────────────────

  const connect = useCallback(async (modeOrReconnect?: 'practice' | 'consultant' | boolean, _isReconnect = false) => {
    const mode = typeof modeOrReconnect === 'string' ? modeOrReconnect : 'practice';
    const isReconnect = typeof modeOrReconnect === 'boolean' ? modeOrReconnect : _isReconnect;
    // v1.3.7c: 記下本次 session mode，給 saveVoiceConversation 用
    if (!isReconnect) currentModeRef.current = mode;
    try {
      setIsConnecting(true);
      setStatusText(isReconnect ? '重新連線中⋯' : '連線中⋯');

      // 初始化遠端音訊元素
      if (!remoteAudioRef.current) {
        remoteAudioRef.current = document.createElement('audio');
        remoteAudioRef.current.autoplay = true;
      }

      // 建立 WebRTC peer connection
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      const remoteStream = new MediaStream();
      remoteAudioRef.current.srcObject = remoteStream;

      pc.ontrack = (e) => {
        if (e.track.kind === 'audio') remoteStream.addTrack(e.track);
      };

      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        if (state === 'failed' || state === 'disconnected') {
          setIsConnected(false);
          setStatusText('連線中斷，嘗試重連⋯');
          if (!reconnectTimerRef.current) {
            reconnectTimerRef.current = setTimeout(() => {
              reconnectTimerRef.current = null;
              // v1.3.7c: 重連保留原 mode（不要 hardcode 'practice'、否則 consultant session 重連會降級）
              connect(currentModeRef.current, true).catch(console.error);
            }, 2000);
          }
        }
      };

      // 取得麥克風
      const localStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      localStreamRef.current = localStream;
      setLocalStream(localStream);
      localStream.getTracks().forEach(t => pc.addTrack(t, localStream));

      // 建立 Data Channel（事件通訊）
      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;

      dc.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        setStatusText('已連線，可以直接說話');
      };
      dc.onclose = () => {
        setIsConnected(false);
        setStatusText('資料通道已關閉');
      };
      dc.onerror = () => console.error('[useRealtimeVoice] DataChannel error');
      dc.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data as string);
          handleServerEvent(data);
        } catch { /* ignore */ }
      };

      // 建立 SDP offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 向後端取 ephemeral token（帶入 mode 參數）
      const tokenRes = await fetch(`/api/realtime/session?mode=${mode}`);
      if (!tokenRes.ok) {
        const err = await tokenRes.json();
        throw new Error(err.error ?? '無法取得語音 token');
      }
      const tokenData = await tokenRes.json();
      // OpenAI 回傳 { client_secret: { value: '...' } }
      const ephemeralKey: string = tokenData?.client_secret?.value ?? tokenData?.value;
      if (!ephemeralKey) throw new Error('ephemeral key 格式異常');

      // WebRTC 連到 OpenAI Realtime
      const callRes = await fetch('https://api.openai.com/v1/realtime/calls', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ephemeralKey}`,
          'Content-Type': 'application/sdp',
        },
        body: offer.sdp ?? '',
      });

      if (!callRes.ok) {
        const errText = await callRes.text();
        throw new Error(`WebRTC 連線失敗：${errText}`);
      }

      const answerSdp = await callRes.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
    } catch (err) {
      console.error('[useRealtimeVoice] connect error:', err);
      setIsConnecting(false);
      setIsConnected(false);
      setStatusText(
        `連線失敗：${err instanceof Error ? err.message : '未知錯誤'}`
      );
    }
  }, [handleServerEvent]);

  // 元件卸載時自動斷線
  useEffect(() => {
    return () => { disconnect(); };
  }, [disconnect]);

  return {
    isConnected,
    isConnecting,
    isUserSpeaking,
    isAssistantSpeaking,
    userLevel,
    statusText,
    connect: (mode?: 'practice' | 'consultant') => connect(mode ?? 'practice', false),
    disconnect,
  };
}
