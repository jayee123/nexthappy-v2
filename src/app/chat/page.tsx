// 放置路徑：src/app/chat/page.tsx
//
// v3.1 更新重點：
//   1. 雙 Tab：「21天練習」（小羽陪練）+ 「我卡住了，幫我拆」（Lead & Probe 諮詢、v1.3.2a 重命名）
//   2. 兩個 Tab 各有獨立訊息列表 + 文字/語音切換
//   3. 記憶共享：兩個模式使用同一份 journey memories
//   4. 語音模式：voice.connect(mode) 帶入對應 mode

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import MarkdownMessage, { stripMarkdown } from '@/components/MarkdownMessage';
import Image from 'next/image';
import { ExternalLink } from 'lucide-react';
import { MARKET_BASE_URL } from '@/lib/market';
import type { TodayInfo, Journey, ChatMessage } from '@/types';
import { useRealtimeVoice, type VoiceMessage } from '@/hooks/useRealtimeVoice';
import Sidebar from '@/components/Sidebar';

// ────────────────────────────────────────────────
// 型別
// ────────────────────────────────────────────────

type ActiveTab = 'practice' | 'consultant';

interface TodayData {
  today: TodayInfo | null;        // v1.3.2b: trier user 沒 journey 時為 null
  journey: Journey | null;        // v1.3.2b: trier user 沒 journey 時為 null
}

interface ExtendedChatMessage extends ChatMessage {
  source?: 'text' | 'voice';
}

// v1.3.2b.3: 偵測「AI trigger prompt」（system 用、不該顯示給 user）
// trigger 特徵：role=user + content 以「今天是」開頭 + 含「請」（給 AI 的指令句）
// Bug fix: Day 0 trigger 開頭到「請」約 50 字、原 {0,30} regex 太緊抓不到、放寬至 200
function isAITriggerPrompt(msg: ChatMessage): boolean {
  if (msg.role !== 'user') return false;
  const content = msg.content || '';
  return /^今天是.{0,200}請/.test(content);
}

// ────────────────────────────────────────────────
// 共用子元件
// ────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex gap-1 px-4 py-3 bg-[#fffdfb] border border-[#38261e]/10 rounded-2xl rounded-bl-sm w-16">
      <div className="w-2 h-2 bg-gray-400 rounded-full typing-dot" />
      <div className="w-2 h-2 bg-gray-400 rounded-full typing-dot" />
      <div className="w-2 h-2 bg-gray-400 rounded-full typing-dot" />
    </div>
  );
}

function MessageBubble({ message, tab }: { message: ExtendedChatMessage; tab: ActiveTab }) {
  const isUser = message.role === 'user';
  const isVoice = message.source === 'voice';
  // v1.5.x: AI 對話（練習 + 諮詢）都用 Pearl Logo icon（小羽品牌一致）、語音用 🎙️
  const useLogo = !isUser && !isVoice;
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-slide-up`}>
      {!isUser && (
        <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center mr-2 flex-shrink-0 mt-1 overflow-hidden border border-[#f6bf8e]/30">
          {useLogo ? (
            <Image
              src="/images/logo/avatar-xiaoyu.png"
              alt="小羽老師"
              width={32}
              height={32}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-sm">🎙️</span>
          )}
        </div>
      )}
      <div className={isUser ? 'bubble-user' : 'bubble-ai'}>
        {isVoice && !isUser && (
          <p className="text-[10px] text-primary-400 mb-0.5 font-medium">語音對話</p>
        )}
        {/* v1.5.x 7/26：AI 訊息渲染 markdown（封測發現用戶看不懂裸露的 ** 和 >）
            User 自己打的字維持純文字、不渲染（用戶不會寫 markdown、渲染反而吃掉他打的符號） */}
        {isUser ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        ) : (
          <MarkdownMessage content={message.content} />
        )}
      </div>
    </div>
  );
}

// ── 語音面板 ─────────────────────────────────────

interface VoicePanelProps {
  tab: ActiveTab;
  isConnected: boolean;
  isConnecting: boolean;
  isUserSpeaking: boolean;
  isAssistantSpeaking: boolean;
  userLevel: number;
  statusText: string;
  completedToday?: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onOpenComplete?: () => void;
}

function VoicePanel({
  tab,
  isConnected,
  isConnecting,
  isUserSpeaking,
  isAssistantSpeaking,
  userLevel,
  statusText,
  completedToday,
  onConnect,
  onDisconnect,
  onOpenComplete,
}: VoicePanelProps) {
  const ringColor = isAssistantSpeaking
    ? 'ring-primary-400'
    : isUserSpeaking
    ? 'ring-gray-300'
    : 'ring-gray-100';
  const ringScale = 1 + userLevel * 0.15;

  return (
    <div className="border-t border-gray-100 bg-white px-4 py-5">
      <div className="flex flex-col items-center gap-3">
        {/* Avatar */}
        <div className="relative flex items-center justify-center">
          {isAssistantSpeaking && (
            <span className="absolute inline-flex h-28 w-28 rounded-full bg-primary-300 opacity-40 animate-ping" />
          )}
          <div
            className={`relative w-24 h-24 rounded-full ring-4 transition-all duration-200 overflow-hidden shadow-md ${ringColor}`}
            style={{ transform: `scale(${ringScale})` }}
          >
            <Image
              src="/xiaoyu-avatar.jpg"
              alt="小羽"
              fill
              className="object-cover"
              priority
            />
          </div>
        </div>

        <p className="text-sm text-gray-500 text-center">{statusText}</p>

        {isUserSpeaking && (
          <div className="flex items-center gap-1.5 text-primary-600">
            <span className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
            <span className="text-xs font-medium">你正在說話</span>
          </div>
        )}

        <div className="flex gap-2 mt-1">
          {!isConnected && !isConnecting && (
            <button onClick={onConnect} className="btn-primary px-6 py-2.5 text-sm">
              🎙️ 開始語音
            </button>
          )}
          {isConnecting && (
            <button disabled className="btn-primary px-6 py-2.5 text-sm opacity-60 cursor-not-allowed">
              <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5 align-middle" />
              連線中⋯
            </button>
          )}
          {isConnected && (
            <button
              onClick={onDisconnect}
              className="btn-secondary px-5 py-2.5 text-sm border-red-200 text-red-500 hover:bg-red-50"
            >
              結束語音
            </button>
          )}
          {tab === 'practice' && !completedToday && onOpenComplete && (
            <button
              onClick={onOpenComplete}
              className="btn-secondary px-3 py-2.5 text-xs shrink-0 border-gray-200"
            >
              完成今日
            </button>
          )}
        </div>

        {!isConnected && !isConnecting && (
          <p className="text-xs text-gray-400 text-center mt-1">
            {tab === 'consultant'
              ? '點擊開始語音，直接跟小羽老師說話'
              : '點擊開始語音，直接和小羽說話'}
          </p>
        )}
      </div>
    </div>
  );
}

// ── 完成今日 Modal ───────────────────────────────

function CompleteDayModal({
  onClose,
  onComplete,
  partnerName,
}: {
  onClose: () => void;
  onComplete: (data: { completion_type: string; emotion_score: number; journal_text: string }) => void;
  partnerName: string;
}) {
  const [completionType, setCompletionType] = useState('');
  const [emotionScore, setEmotionScore] = useState(5);
  const [journalText, setJournalText] = useState('');

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
      <div className="bg-white rounded-t-3xl w-full max-w-md mx-auto p-6 space-y-4">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-2" />
        <h3 className="text-lg font-bold text-gray-800">今日複盤</h3>

        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">今天的任務完成了嗎？</p>
          <div className="flex gap-2">
            {[
              { value: 'success', label: '✅ 順利完成', color: 'bg-green-50 border-green-300 text-green-700' },
              { value: 'partial', label: '🤔 有點卡', color: 'bg-yellow-50 border-yellow-300 text-yellow-700' },
              { value: 'failed', label: '😅 沒完成', color: 'bg-gray-50 border-gray-300 text-gray-600' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setCompletionType(opt.value)}
                className={`flex-1 py-2 px-3 rounded-xl border text-xs font-medium transition-all ${
                  completionType === opt.value ? opt.color + ' border-2' : 'bg-gray-50 border-gray-200 text-gray-500'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">
            今天的心情分數：<span className="text-primary-600 font-bold">{emotionScore}</span>/10
          </p>
          <input
            type="range" min="1" max="10" value={emotionScore}
            onChange={e => setEmotionScore(Number(e.target.value))}
            className="w-full accent-primary-600"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>很低落</span><span>很開心</span>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">
            簡單說說今天發生了什麼？（和{partnerName}互動的）
          </label>
          <textarea
            value={journalText}
            onChange={e => setJournalText(e.target.value)}
            placeholder="可長可短，就像跟好友說話..."
            className="input-field mt-2 resize-none h-20 text-sm"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1">取消</button>
          <button
            onClick={() => {
              if (!completionType) return;
              onComplete({ completion_type: completionType, emotion_score: emotionScore, journal_text: journalText });
            }}
            className="btn-primary flex-1"
            disabled={!completionType}
          >
            送出複盤
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────
// 主頁面
// ────────────────────────────────────────────────

export default function ChatPage() {
  const router = useRouter();

  // v1.5.x: 讀 ?journey_id URL param（sidebar 歷史 rounds 點過來會帶）
  // 若有值 → 目前在看已完成 journey 的唯讀模式、fetch today API 帶 journey_id
  const [viewingJourneyId, setViewingJourneyId] = useState<string | null>(null);
  // v1.5.x 7/30（2026-08-22 backport）：過去輪次數量（判斷空狀態要顯示「還沒開始」還是「上一輪已完成」）
  const [pastRoundCount, setPastRoundCount] = useState(0);
  // v1.5.x 7/30（2026-08-22 backport）：正在看的歷史輪次進行到第幾天（決定 Day 標題列箭頭的上限）
  const [viewingJourneyMaxDay, setViewingJourneyMaxDay] = useState<number | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const jid = params.get('journey_id');
    if (jid) setViewingJourneyId(jid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 共用狀態 ──────────────────────────────────
  const [todayData, setTodayData] = useState<TodayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('practice');

  // v1.5.x: 支援 ?tab=consultant query param 設初始 tab（給 /welcome 完成後導入諮詢模式用）
  // 用 useEffect + window.location.search 避免 useSearchParams 引入 Suspense 強制 wrap 整個 page
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') === 'consultant') {
      setActiveTab('consultant');
    }
    // 只在 mount 跑一次、之後 tab 切換由用戶手動操作
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [voiceMode, setVoiceMode] = useState(false);
  // v1.4.x：tab ℹ️ tooltip 開關（防 cross-tab 誤解、in-context 教學）
  const [tabTooltip, setTabTooltip] = useState<null | 'practice' | 'consultant'>(null);

  // ── 21天練習 狀態 ───────────────────────────
  const [practiceMessages, setPracticeMessages] = useState<ExtendedChatMessage[]>([]);
  const [practiceInput, setPracticeInput] = useState('');
  const [practiceStreaming, setPracticeStreaming] = useState(false);
  const [practiceTyping, setPracticeTyping] = useState(false);
  const [completedToday, setCompletedToday] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [newBadge, setNewBadge] = useState<string | null>(null);
  const [knowledgeExpanded, setKnowledgeExpanded] = useState(false);

  // ── 諮詢師 狀態 ─────────────────────────────
  const [consultantMessages, setConsultantMessages] = useState<ExtendedChatMessage[]>([]);
  const [consultantInput, setConsultantInput] = useState('');
  const [consultantStreaming, setConsultantStreaming] = useState(false);
  const [consultantTyping, setConsultantTyping] = useState(false);
  const [consultantLoaded, setConsultantLoaded] = useState(false);

  // ── v1.3.3c sidebar 狀態 ─────────────────────
  const [currentTopicId, setCurrentTopicId] = useState<string | null>(null);
  const [pendingNewTopic, setPendingNewTopic] = useState(false);
  // v1.3.3c.2：default collapsed（只 icon column 48px、user 點 📂 expand overlay）
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0);

  // ── v1.3.3d：Day 1-21 navigation ─────────────
  // null = 看當前 Day（互動模式）；number = 看歷史 Day（read-only）
  const [viewingDay, setViewingDay] = useState<number | null>(null);
  const [viewingDayInfo, setViewingDayInfo] = useState<TodayInfo | null>(null);
  const [viewingDayMessages, setViewingDayMessages] = useState<ExtendedChatMessage[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const practiceInputRef = useRef<HTMLTextAreaElement>(null);
  const consultantInputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [practiceMessages, consultantMessages, scrollToBottom]);

  // v1.4.x：點頁面其他地方關掉 tab tooltip
  useEffect(() => {
    if (!tabTooltip) return;
    function onDocClick() { setTabTooltip(null); }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [tabTooltip]);

  // ── 語音 Hook（共用，切換 tab 時斷線） ─────────

  const handleVoiceTranscript = useCallback((msg: VoiceMessage) => {
    const extended: ExtendedChatMessage = {
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
      source: 'voice',
    };
    // 根據當前 tab 推入對應訊息列表（用 ref 取得最新值）
    setActiveTab(current => {
      if (current === 'consultant') {
        setConsultantMessages(prev => [...prev, extended]);
      } else {
        setPracticeMessages(prev => [...prev, extended]);
      }
      return current;
    });
  }, []);

  const voice = useRealtimeVoice({ onTranscript: handleVoiceTranscript });

  // 切換 Tab
  const switchTab = useCallback((tab: ActiveTab) => {
    if (tab === activeTab) return;
    // 切換時斷語音
    if (voice.isConnected || voice.isConnecting) {
      voice.disconnect();
    }
    setVoiceMode(false);
    setActiveTab(tab);
  }, [activeTab, voice]);

  // 文字/語音切換（v1.4.x Phase 1：UI 切換 toggle 暫拿掉、Phase 2 加回時 uncomment chat header 那段即可）
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const switchToText = useCallback(() => {
    if (voice.isConnected || voice.isConnecting) {
      voice.disconnect();
      // v1.3.7c: 諮詢 voice session 結束後、後端會 generateTopicTitle + 寫 conversation row
      // 等 ~1.5s autoTitle 完成後 bump sidebar 讓「諮詢主題」list 自動 reload 顯示新主題
      if (activeTab === 'consultant') {
        setTimeout(() => setSidebarRefreshKey(k => k + 1), 1500);
      }
    }
    setVoiceMode(false);
  }, [voice, activeTab]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const switchToVoice = useCallback(() => {
    setVoiceMode(true);
  }, []);

  // ── 載入21天練習資料 ────────────────────────────

  useEffect(() => {
    async function loadData() {
      try {
        // v1.5.x: 若在看歷史 journey、帶 journey_id 給 API
        const url = viewingJourneyId
          ? `/api/day/today?journey_id=${viewingJourneyId}`
          : '/api/day/today';
        const res = await fetch(url);
        if (res.status === 401) { router.push('/auth/login'); return; }

        const json = await res.json();
        if (!json.data) return;

        const data: TodayData = json.data;
        setTodayData(data);

        // v1.3.2b: trier user 沒 journey 時、預設切到「我卡住了，幫我拆」tab、不跑 practice opening
        if (!data.today || !data.journey) {
          setActiveTab('consultant');
          // v1.5.x 7/30（2026-08-22 backport）：查有沒有過去完成的輪次、決定空狀態文案
          //   （Angel / Pearl 這種做完 21 天的人、不該看到「還沒開始第 1 輪」）
          try {
            const listRes = await fetch('/api/journey/list');
            const listJson = await listRes.json();
            setPastRoundCount((listJson.data?.journeys || []).length);
          } catch {
            // 查不到就當 0、退回「還沒開始」文案、不影響主流程
          }
          return;
        }

        setCompletedToday(data.today.record?.task_completed || false);

        if (data.today.conversation?.messages) {
          // v1.3.2b.3: filter 掉 AI trigger prompts（system 用、不顯示給 user）
          setPracticeMessages(
            (data.today.conversation.messages as ExtendedChatMessage[])
              .filter(m => !isAITriggerPrompt(m))
              .map(m => ({
                ...m,
                source: m.source ?? 'text',
              }))
          );
        } else {
          await triggerPracticeOpening(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, viewingJourneyId]);

  async function triggerPracticeOpening(data: TodayData) {
    if (!data.today) return; // v1.3.2b: trier user 沒 journey、不觸發 opening
    const dayN = data.today.day_number;
    // v1.3.2b.2: Day 0 / Day 1 / Day 2+ 三條不同 opening prompt
    const openingPrompt =
      dayN === 0
        ? `今天是 Day 0、user 剛完成 onboarding。請依【⚠️ Day 0 特別紀律 v1.4】開場：Welcome + 引用 onboarding 資料 + 21 天結構一行帶過 + soft probe 1 個。守 probe 上限 2 輪、第 3 輪強制收尾預告明天 Day 1。**禁止**教 MBTI 4 字母拆解、4 步覺察 detail、管理者/陪伴者框架。第一輪 ≤300 字。`
        : dayN === 1
          ? `今天是第 ${dayN} 天。請給我今天的開場白和任務說明。`
          : `今天是第 ${dayN} 天，主題是「${data.today.course.theme}」。請先追蹤昨天我說的事，再說今天的任務。`;
    // v1.3.2b.3: hideUserMessage=true、trigger prompt 不以 user bubble 顯示給 user 看
    await sendPracticeMessage(openingPrompt, 'morning', true);
  }

  // ── 載入諮詢師對話（Tab 切換時懶載入） ─────────

  useEffect(() => {
    if (activeTab === 'consultant' && !consultantLoaded) {
      setConsultantLoaded(true);
      fetch('/api/ai/consultant')
        .then(r => r.json())
        .then(data => {
          // v1.3.3c：拉 topic_id 給 sidebar highlight active topic 用
          if (data.topic_id) setCurrentTopicId(data.topic_id);
          if (data.messages?.length) {
            setConsultantMessages(
              (data.messages as ExtendedChatMessage[]).map((m: ExtendedChatMessage) => ({
                ...m,
                source: m.source ?? 'text',
              }))
            );
          }
        })
        .catch(console.error);
    }
  }, [activeTab, consultantLoaded]);

  // ── v1.3.3c：切換主題（sidebar 點 topic 觸發）─────────

  async function switchConsultantTopic(topicId: string) {
    if (consultantStreaming) return;
    setCurrentTopicId(topicId);
    setPendingNewTopic(false);
    try {
      const res = await fetch(`/api/ai/consultant?topic_id=${encodeURIComponent(topicId)}`);
      const data = await res.json();
      if (data.messages) {
        setConsultantMessages(
          (data.messages as ExtendedChatMessage[]).map((m: ExtendedChatMessage) => ({
            ...m,
            source: m.source ?? 'text',
          }))
        );
      }
    } catch (err) {
      console.error('[switchConsultantTopic]', err);
    }
  }

  // ── v1.5.x：新的 21 天練習輪次（跳去 /onboarding/practice 建 journey）─────────
  //
  // Pearl 事件（7/16）發現：Day 21 完成後 journey.is_active=false、
  // 用戶前台看不到入口開新一輪、也看不到歷史 → 需要 top nav「+」按鈕直接引導

  function startNewPracticeRound() {
    router.push('/onboarding/practice');
  }

  // ── v1.3.3c：新主題（sidebar + 按鈕觸發）─────────

  function startNewConsultantTopic() {
    if (consultantStreaming) return;
    setCurrentTopicId(null);
    setConsultantMessages([]);
    setPendingNewTopic(true);
    // v1.3.3c.2：點＋後收合 overlay panel（若展開中）+ auto-focus input
    setTimeout(() => {
      setSidebarCollapsed(true);
      consultantInputRef.current?.focus();
    }, 50);
  }

  // ── v1.3.3d：切換 Day（sidebar Day grid + chat header arrows）─────────

  /**
   * 切換到某一天的歷史對話。
   * @param targetDay  Day 0-21
   * @param journeyId  v1.5.x 7/26：有值 = 看歷史輪次的那天（sidebar 歷史任務展開後點的）
   *                   undefined = 當前 active journey
   */
  async function switchToDay(targetDay: number, journeyId?: string) {
    // v1.5.x 7/30 fix（2026-08-22 backport）：舊守衛是 `if (!todayData?.journey) return`，
    //   但完成 21 天的用戶 is_active=false → todayData.journey 是 null → 點歷史任務的 Day 完全沒反應。
    //   Angel 7/30 踩到。改成：看歷史輪次（有 journeyId）時不需要 active journey。
    if (practiceStreaming) return;
    if (!journeyId && !todayData?.journey) return;
    const currentDayN = todayData?.today?.day_number ?? 0;

    // 點「當前輪次的當前 Day」= 回到互動模式（只有還有 active journey 時才成立）
    if (!journeyId && todayData?.journey && targetDay === currentDayN) {
      setViewingDay(null);
      setViewingDayInfo(null);
      setViewingDayMessages([]);
      setViewingJourneyId(null);
      setViewingJourneyMaxDay(null);
      setSidebarCollapsed(true);
      return;
    }

    try {
      const url = journeyId
        ? `/api/day/${targetDay}?journey_id=${journeyId}`
        : `/api/day/${targetDay}`;
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json();
        console.error('[switchToDay]', err);
        return;
      }
      const json = await res.json();
      const data = json.data;
      if (!data?.today) return;

      setViewingDay(targetDay);
      setViewingDayInfo(data.today);
      setViewingJourneyId(journeyId ?? null);
      // v1.5.x 7/30（2026-08-22 backport）：記住這輪進行到第幾天、Day 標題列的「下一天」箭頭才知道上限
      setViewingJourneyMaxDay(journeyId ? (data.journey?.current_day ?? null) : null);
      const msgs = (data.today.conversation?.messages as ExtendedChatMessage[] | undefined) || [];
      setViewingDayMessages(
        msgs.filter(m => !isAITriggerPrompt(m)).map(m => ({
          ...m,
          source: m.source ?? 'text',
        }))
      );
      setSidebarCollapsed(true);
    } catch (err) {
      console.error('[switchToDay]', err);
    }
  }

  // ── 21天練習：傳送訊息 ──────────────────────────

  async function sendPracticeMessage(text: string, contextType: string = 'realtime', hideUserMessage: boolean = false) {
    if (!text.trim() || practiceStreaming) return;

    // v1.4.x fix (Issue 1)：capture「對話剛剛是不是 null」給 finally 用
    //   原本 todayData 只在 page mount 時 fetch 一次、若 user 開始對話前 conversation 為 null、
    //   stream 完成後 today.conversation.id 仍是舊的 null、PDF button 永遠 disabled。
    //   解法：第一則訊息送完後再 fetch 一次 /api/day/today 把 conversation.id 帶回來。
    const wasConversationNull = !todayData?.today?.conversation;

    const userMsg: ExtendedChatMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
      source: 'text',
    };
    // v1.3.2b.3: hideUserMessage=true 時不顯示 user bubble（用於 AI trigger prompt）
    if (!hideUserMessage) {
      setPracticeMessages(prev => [...prev, userMsg]);
    }
    setPracticeInput('');
    // v1.3.6：reset auto-grow textarea 高度
    if (practiceInputRef.current) practiceInputRef.current.style.height = 'auto';
    setPracticeStreaming(true);
    setPracticeTyping(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, context_type: contextType }),
      });

      if (!res.ok) {
        const err = await res.json();
        setPracticeMessages(prev => [...prev, {
          role: 'assistant', content: err.error || '發生錯誤',
          timestamp: new Date().toISOString(), source: 'text',
        }]);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) return;

      setPracticeTyping(false);
      let aiContent = '';
      const aiMsg: ExtendedChatMessage = {
        role: 'assistant', content: '', timestamp: new Date().toISOString(), source: 'text',
      };
      setPracticeMessages(prev => [...prev, aiMsg]);

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split('\n').filter(l => l.startsWith('data: '))) {
          const data = line.slice(6);
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              aiContent += parsed.text;
              setPracticeMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { ...aiMsg, content: aiContent };
                return updated;
              });
            }
          } catch { /* ignore */ }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPracticeStreaming(false);
      setPracticeTyping(false);

      // v1.4.x fix (Issue 1)：第一則對話建立後 refresh todayData、讓 PDF button 拿到 conversation.id
      if (wasConversationNull) {
        try {
          const refreshRes = await fetch('/api/day/today');
          if (refreshRes.ok) {
            const refreshJson = await refreshRes.json();
            if (refreshJson.data) setTodayData(refreshJson.data);
          }
        } catch (e) {
          console.error('[chat] todayData refresh failed:', e);
        }
      }
    }
  }

  // ── 諮詢師：傳送訊息 ─────────────────────────────

  async function sendConsultantMessage(text: string) {
    if (!text.trim() || consultantStreaming) return;

    const userMsg: ExtendedChatMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
      source: 'text',
    };
    setConsultantMessages(prev => [...prev, userMsg]);
    setConsultantInput('');
    // v1.3.6：reset auto-grow textarea 高度
    if (consultantInputRef.current) consultantInputRef.current.style.height = 'auto';
    setConsultantStreaming(true);
    setConsultantTyping(true);

    try {
      // v1.3.3c: POST 帶 topic_id（繼續主題）或 new_topic: true（開新主題）
      const requestBody: { message: string; topic_id?: string; new_topic?: boolean } = { message: text };
      if (pendingNewTopic) {
        requestBody.new_topic = true;
      } else if (currentTopicId) {
        requestBody.topic_id = currentTopicId;
      }

      const res = await fetch('/api/ai/consultant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const err = await res.json();
        setConsultantMessages(prev => [...prev, {
          role: 'assistant', content: err.error || '發生錯誤',
          timestamp: new Date().toISOString(), source: 'text',
        }]);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) return;

      setConsultantTyping(false);
      let aiContent = '';
      const aiMsg: ExtendedChatMessage = {
        role: 'assistant', content: '', timestamp: new Date().toISOString(), source: 'text',
      };
      setConsultantMessages(prev => [...prev, aiMsg]);

      const decoder = new TextDecoder();
      let receivedTopicMeta = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split('\n').filter(l => l.startsWith('data: '))) {
          const data = line.slice(6);
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              aiContent += parsed.text;
              setConsultantMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { ...aiMsg, content: aiContent };
                return updated;
              });
            }
            // v1.3.3c: 接收 backend 推來的 topic_meta、更新 currentTopicId + 觸發 sidebar 重載
            if (parsed.topic_id) {
              receivedTopicMeta = true;
              setCurrentTopicId(parsed.topic_id);
              setPendingNewTopic(false);
            }
          } catch { /* ignore */ }
        }
      }
      // 收到 topic_meta（含新主題創建）→ refresh sidebar 看到新主題
      if (receivedTopicMeta) {
        setSidebarRefreshKey(k => k + 1);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setConsultantStreaming(false);
      setConsultantTyping(false);
    }
  }

  // ── 完成今日 ─────────────────────────────────────

  async function handleComplete(data: { completion_type: string; emotion_score: number; journal_text: string }) {
    setShowCompleteModal(false);
    try {
      const res = await fetch('/api/day/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (res.ok && json.data) {
        setCompletedToday(true);
        if (json.data.new_badges?.length > 0) setNewBadge(json.data.new_badges[0]);

        const completionMsg = `我完成今日了！執行情況：${
          data.completion_type === 'success' ? '順利完成' :
          data.completion_type === 'partial' ? '有點卡' : '沒完成'
        }。心情 ${data.emotion_score}/10。${data.journal_text || ''}`;
        await sendPracticeMessage(completionMsg, 'evening');
      }
    } catch (err) {
      console.error(err);
    }
  }

  // ── 載入畫面 ───────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">小羽正在準備中...</p>
        </div>
      </div>
    );
  }

  if (!todayData) return null;
  const { today, journey } = todayData;
  // v1.3.2b: trier user 沒 journey 時、UI 顯示「開始第 1 輪」CTA 而非 Day N 練習
  const hasJourney = today !== null && journey !== null;
  // v1.5.x 7/30（2026-08-22 backport）：正在看某一天的歷史紀錄（不論當前有沒有 active journey）
  //   完成 21 天的用戶 hasJourney=false、但仍要能看歷史輪次的每一天
  const isViewingHistory = viewingDay !== null && viewingDayInfo !== null;
  // 練習 tab 主區域要顯示「對話內容」而非「空狀態 CTA」的條件
  const showPracticeContent = hasJourney || isViewingHistory;
  // v1.5.x 7/30（2026-08-22 backport）：區分「從沒開始過」vs「上一輪已完成」、
  //   空狀態文案才不會對完成者說「還沒開始第 1 輪」
  const hasCompletedRound = !hasJourney && pastRoundCount > 0;

  // ── 渲染 ───────────────────────────────────────

  return (
    <div className="flex h-screen">

      {/* ── v1.3.3c Sidebar（icon col always、expand overlay）── */}
      <Sidebar
        activeTab={activeTab}
        hasJourney={hasJourney}
        journey={journey}
        currentDay={today?.day_number ?? null}
        viewingDay={viewingDay}
        viewingJourneyId={viewingJourneyId}
        currentTopicId={currentTopicId}
        onSwitchTopic={switchConsultantTopic}
        onNewTopic={startNewConsultantTopic}
        onSwitchDay={switchToDay}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(v => !v)}
        refreshKey={sidebarRefreshKey}
      />

      {/* ── 主對話區（右側、原本的 layout）── */}
      <div className="flex flex-col flex-1 min-w-0 h-screen">

      {/* ── v1.3.7 功能列 — sidebar toggle + tabs + actions（純 overlay sidebar、無 inline col）
          v1.3.7b: 縮 gap + padding 把 horizontal 空間擠回給 tab labels（mobile 防截字） ── */}
      <div className="page-header py-2">
        <div className="flex items-center gap-0.5">
          {/* v1.3.7: sidebar 開關（左 1）+ 諮詢模式新主題（左 2、只在 consultant tab）
              v1.3.7a: button size 從 w-8 h-8 縮成 w-6 h-6、icon 對應縮、給 tabs 更多空間 */}
          <button
            onClick={() => setSidebarCollapsed(v => !v)}
            title="展開側邊欄"
            className="w-6 h-6 shrink-0 rounded-md hover:bg-gray-100 flex items-center justify-center text-gray-500"
            aria-label="展開側邊欄"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          {activeTab === 'consultant' && (
            <button
              onClick={startNewConsultantTopic}
              title="開新主題"
              className="w-6 h-6 shrink-0 rounded-md bg-primary-600 text-white hover:bg-primary-700 flex items-center justify-center"
              aria-label="開新主題"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          )}
          {/* v1.5.x: 練習 tab 也加「+」按鈕 — 開新 21 天輪次（跳 /onboarding/practice） */}
          {activeTab === 'practice' && (
            <button
              onClick={startNewPracticeRound}
              title="開始新一輪 21 天練習"
              className="w-6 h-6 shrink-0 rounded-md bg-primary-600 text-white hover:bg-primary-700 flex items-center justify-center"
              aria-label="開始新一輪 21 天練習"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          )}

          {/* Tab 切換列 — 占主寬度（v1.4.x：每 tab 帶 ℹ️ tooltip 防 cross-tab 誤解） */}
          <div className="flex flex-1 min-w-0">
            {/* 21 天練習 tab + info */}
            <div className="flex-1 relative">
              <button
                onClick={() => switchTab('practice')}
                className={`w-full py-1.5 text-xs font-medium transition-all border-b-2 whitespace-nowrap inline-flex items-center justify-center gap-1 ${
                  activeTab === 'practice'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                21天練習
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="說明：21 天練習是什麼"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTabTooltip(t => (t === 'practice' ? null : 'practice'));
                  }}
                  onMouseEnter={() => setTabTooltip('practice')}
                  onMouseLeave={() => setTabTooltip(t => (t === 'practice' ? null : t))}
                  className="inline-flex items-center text-gray-400 hover:text-gray-600 cursor-help"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </span>
              </button>
              {tabTooltip === 'practice' && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 w-60 bg-gray-900 text-white text-[11px] rounded-lg shadow-xl p-3 leading-relaxed text-left pointer-events-auto"
                >
                  <div className="font-semibold text-sm mb-1">🌱 21 天刻意練習</div>
                  <div className="text-gray-200">
                    跟固定對象（onboarding 設定的）用 21 天循序漸進練好溝通。
                  </div>
                  <div className="text-gray-300 mt-1.5">
                    <span className="text-gray-400">適合：</span>長期想改善一段關係
                  </div>
                  <div className="mt-2 pt-2 border-t border-gray-700 text-amber-300 text-[10.5px]">
                    ⚠️ 跟「我卡住」對話獨立、AI 不互通
                  </div>
                </div>
              )}
            </div>

            {/* 我卡住 tab + info */}
            <div className="flex-1 relative">
              <button
                onClick={() => switchTab('consultant')}
                className={`w-full py-1.5 text-xs font-medium transition-all border-b-2 whitespace-nowrap inline-flex items-center justify-center gap-1 ${
                  activeTab === 'consultant'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                我卡住，幫我拆
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="說明：我卡住是什麼"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTabTooltip(t => (t === 'consultant' ? null : 'consultant'));
                  }}
                  onMouseEnter={() => setTabTooltip('consultant')}
                  onMouseLeave={() => setTabTooltip(t => (t === 'consultant' ? null : t))}
                  className="inline-flex items-center text-gray-400 hover:text-gray-600 cursor-help"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </span>
              </button>
              {tabTooltip === 'consultant' && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 w-60 bg-gray-900 text-white text-[11px] rounded-lg shadow-xl p-3 leading-relaxed text-left pointer-events-auto"
                >
                  <div className="font-semibold text-sm mb-1">🤝 我卡住、幫我拆</div>
                  <div className="text-gray-200">
                    處理當下急需解決的單一情境、可以是任何對象、任何問題。
                  </div>
                  <div className="text-gray-300 mt-1.5">
                    <span className="text-gray-400">適合：</span>「現在這件事該怎麼辦？」
                  </div>
                  <div className="mt-2 pt-2 border-t border-gray-700 text-amber-300 text-[10.5px]">
                    ⚠️ 跟「21 天練習」對話獨立、AI 不互通
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons
              上方只留「回到 NUWA」。下載 PDF（側邊欄主題選單已有）、個人設定、
              訂閱、進度、登出都移到側邊欄 footer，避免右上角擠 5 顆 icon。*/}
          <div className="flex items-center gap-0 shrink-0 pl-0.5">
            {/* v1.4.x（Phase 1）：文字 / 語音切換暫拿掉、Phase 2 重新接入時恢復
                Phase 1 只開放文字模式、voiceMode state 保留 default=false
                註：switchToText / switchToVoice 函數保留、Phase 2 直接 uncomment 即可 */}
            {/*
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
              <button onClick={switchToText} title="文字模式" ...>💬</button>
              <button onClick={switchToVoice} title="語音模式" ...>🎙️</button>
            </div>
            */}

            {/* 回到 NUWA：訂閱與帳號管理都在公版 */}
            <a
              href={MARKET_BASE_URL}
              className="text-xs text-primary-600 font-medium px-2 py-1 rounded-lg hover:bg-primary-50 flex items-center gap-1 whitespace-nowrap"
              title="回到 NUWA 平台（訂閱、帳號管理）"
            >
              <ExternalLink size={13} strokeWidth={2} />
              <span>回到 NUWA</span>
            </a>
          </div>
        </div>
      </div>

      {/* ── v1.3.6 Sticky Banner — Day title / Topic title 從 header 移到這裡
          v1.5.x 7/30（2026-08-22 backport）：條件從 `hasJourney && today` 放寬成 showPracticeContent，
          讓完成 21 天（無 active journey）的用戶看歷史輪次時也有 Day 標題列與前後箭頭。─ */}
      {activeTab === 'practice' && showPracticeContent && (viewingDayInfo || today) && (() => {
        const displayDay = viewingDay !== null && viewingDayInfo ? viewingDayInfo : today!;
        const isReadOnly = viewingDay !== null;
        // 箭頭上限：看歷史輪次時用那輪的 current_day、否則用當前輪次的 day_number
        const maxDayN = viewingJourneyId
          ? (viewingJourneyMaxDay ?? displayDay.day_number)
          : (today?.day_number ?? displayDay.day_number);
        // 切換前後天時要留在同一輪（歷史輪次要帶 journeyId、否則會跳回當前輪次）
        const navJourneyId = viewingJourneyId ?? undefined;
        const viewDayN = displayDay.day_number;
        return (
          <div className="bg-white border-b border-gray-100 px-4 py-2 shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={() => switchToDay(viewDayN - 1, navJourneyId)}
                disabled={viewDayN <= 0}
                className={`w-7 h-7 rounded-md flex items-center justify-center text-sm font-bold transition-all ${
                  viewDayN <= 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100'
                }`}
                title={viewDayN > 0 ? `看 Day ${viewDayN - 1}` : '已在 Day 0'}
              >
                ◀
              </button>
              <div className="flex-1 min-w-0 text-center">
                <h1 className="font-bold text-gray-800 text-sm">
                  Day {viewDayN} - {displayDay.course.theme}
                  {isReadOnly && <span className="ml-1 text-[10px] text-orange-500 font-normal">📖 歷史</span>}
                </h1>
                <p className="text-xs text-gray-400 truncate">{displayDay.course.subtitle}</p>
              </div>
              <button
                onClick={() => switchToDay(viewDayN + 1, navJourneyId)}
                disabled={viewDayN >= maxDayN}
                className={`w-7 h-7 rounded-md flex items-center justify-center text-sm font-bold transition-all ${
                  viewDayN >= maxDayN ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100'
                }`}
                title={viewDayN < maxDayN ? `看 Day ${viewDayN + 1}` : '已是這輪最後一天'}
              >
                ▶
              </button>
            </div>
            {/* 知識卡片（collapsible、default 收合）— v1.5.x Pearl cream 底
                7/26：課程內容也含 markdown、展開時渲染。
                收合時用 stripMarkdown 純文字（markdown 會產生多個 block 元素、line-clamp 會失效）*/}
            {/* v1.5.x 7/30（2026-08-22 backport）：改用 displayDay（原本寫死 today）、看歷史時才會顯示那天的課程內容 */}
            {displayDay?.course.knowledge_point && (
              <div className="mt-2 bg-[#fbfaf8] rounded-xl p-2.5 border border-[#f6bf8e]/25">
                {knowledgeExpanded ? (
                  <MarkdownMessage
                    content={displayDay.course.knowledge_point}
                    className="!text-xs text-[#5a4530]"
                  />
                ) : (
                  <p className="text-xs text-[#5a4530] leading-relaxed line-clamp-2">
                    {stripMarkdown(displayDay.course.knowledge_point)}
                  </p>
                )}
                {displayDay.course.knowledge_point.length > 60 && (
                  <button
                    onClick={() => setKnowledgeExpanded(v => !v)}
                    className="mt-1 text-xs text-primary-600 font-medium hover:text-primary-700"
                  >
                    {knowledgeExpanded ? '收起 ▲' : '展開全文 ▼'}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })()}
      {/* v1.3.7 banner for 我卡住，幫我拆 tab — show default tagline */}
      {activeTab === 'consultant' && (
        <div className="bg-white border-b border-gray-100 px-4 py-2 shrink-0">
          <h1 className="font-bold text-gray-800 text-sm truncate text-center">
            🤝 我卡住，幫我拆
          </h1>
          <p className="text-xs text-gray-400 truncate text-center">
            把卡點告訴小羽老師、陪你拆
          </p>
        </div>
      )}
      {/* v1.3.6 banner for 21 天 tab no journey
          v1.5.x 7/30（2026-08-22 backport）：看歷史輪次時讓位給上面的 Day 標題列、不要兩個標題疊著 */}
      {activeTab === 'practice' && !showPracticeContent && (
        <div className="bg-white border-b border-gray-100 px-4 py-2 shrink-0">
          <h1 className="font-bold text-gray-800 text-sm text-center">🌱 21 天刻意練習</h1>
          <p className="text-xs text-gray-400 text-center">每天一個小任務、21 天改變慣性</p>
        </div>
      )}

      {/* ── 訊息列表 ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-hide">

        {/* 21天練習訊息
            v1.5.x 7/30（2026-08-22 backport）：showPracticeContent = hasJourney || isViewingHistory
            完成 21 天的用戶（hasJourney=false）點側板歷史任務的某天時、也要顯示對話而非空狀態 */}
        {activeTab === 'practice' && (
          showPracticeContent ? (
            <>
              {/* v1.3.3d：viewingDay !== null 時顯示歷史 messages、否則顯示當前互動 messages */}
              {(viewingDay !== null ? viewingDayMessages : practiceMessages).map((msg, i) => (
                <MessageBubble key={i} message={msg} tab="practice" />
              ))}
              {practiceTyping && (
                <div className="flex justify-start">
                  {/* v1.5.x: typing avatar 也用小羽頭像 */}
                  <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center mr-2 flex-shrink-0 mt-1 overflow-hidden border border-[#f6bf8e]/30">
                    <Image
                      src="/images/logo/avatar-xiaoyu.png"
                      alt="小羽老師"
                      width={32}
                      height={32}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <TypingIndicator />
                </div>
              )}
            </>
          ) : (
            /* v1.3.2b trier-first CTA：沒 active journey 時顯示邀請
               v1.5.x 7/30（2026-08-22 backport）：區分「從沒開始」vs「上一輪已完成」——
               對 Angel / Pearl 這種做完 21 天的人說「還沒開始第 1 輪」很怪。
               順手拿掉裸露的 ** （這裡是 JSX 純文字、不會被 markdown 渲染） */
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4 px-4">
              <div className="w-20 h-20 bg-primary-50 rounded-full flex items-center justify-center">
                <span className="text-3xl">{hasCompletedRound ? '🎉' : '🌱'}</span>
              </div>
              {hasCompletedRound ? (
                <>
                  <h3 className="font-semibold text-gray-700 text-base">上一輪 21 天已完成</h3>
                  <p className="text-sm text-gray-500 leading-relaxed max-w-xs">
                    想再練一輪嗎？可以換一個對象、或針對同一段關係再深一層。
                    <br />過去的紀錄都在，從左上角選單可以隨時回看。
                  </p>
                </>
              ) : (
                <>
                  <h3 className="font-semibold text-gray-700 text-base">還沒開始第 1 輪 21 天練習</h3>
                  <p className="text-sm text-gray-500 leading-relaxed max-w-xs">
                    {/* 這裡是 JSX 純文字，不會被 markdown 渲染 —— 寫 ** 會讓用戶
                        直接看到兩顆星號（封測回報過，見上方 AI 訊息渲染的註解）。
                        要強調就用 <strong>。（採 Jeff 12f3272 的寫法，
                        比原 backport 用「」引號更好：真的做到強調） */}
                    21 天刻意練習是針對<strong className="font-semibold">一段特定關係</strong>（伴侶 / 親子 / 同事⋯）的深度練習。
                    <br />每天一個小任務、慢慢建立新的溝通慣性。
                  </p>
                  <p className="text-xs text-gray-400 leading-relaxed max-w-xs">
                    還在試水溫？也可以先去隔壁「🤝 我卡住了，幫我拆」直接問小羽老師。
                  </p>
                </>
              )}
              <button
                onClick={() => router.push('/onboarding/practice')}
                className="btn-primary px-6 py-2.5 text-sm mt-4"
              >
                {hasCompletedRound ? '🚀 開始新一輪練習' : '🚀 開始第 1 輪 21 天練習'}
              </button>
            </div>
          )
        )}

        {/* 諮詢師訊息 */}
        {activeTab === 'consultant' && (
          <>
            {/* 歡迎卡片（無訊息時）*/}
            {consultantMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                {/* v1.5.x: 諮詢歡迎卡片 avatar 也用小羽頭像 */}
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center overflow-hidden border border-[#f6bf8e]/30 shadow-sm">
                  <Image
                    src="/images/logo/avatar-xiaoyu.png"
                    alt="小羽老師"
                    width={80}
                    height={80}
                    className="w-full h-full object-cover"
                  />
                </div>
                <h3 className="font-semibold text-gray-700">幸福關係諮詢師</h3>
                <p className="text-sm text-gray-400 leading-relaxed max-w-xs">
                  不管是伴侶、親子、家人還是職場的關係困擾，<br />說出來，我來幫你分析、給你方法。
                </p>
              </div>
            )}
            {consultantMessages.map((msg, i) => (
              <MessageBubble key={i} message={msg} tab="consultant" />
            ))}
            {consultantTyping && (
              <div className="flex justify-start">
                {/* v1.5.x: 諮詢 typing avatar 也用小羽頭像 */}
                <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center mr-2 flex-shrink-0 mt-1 overflow-hidden border border-[#f6bf8e]/30">
                  <Image
                    src="/images/logo/avatar-xiaoyu.png"
                    alt="小羽老師"
                    width={32}
                    height={32}
                    className="w-full h-full object-cover"
                  />
                </div>
                <TypingIndicator />
              </div>
            )}
          </>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── 完成今日提示（只在21天練習 Tab 顯示） ── */}
      {activeTab === 'practice' && hasJourney && completedToday && today && (
        <div className="mx-4 mb-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-center">
          <p className="text-green-700 text-sm font-medium">✅ Day {today.day_number} 完成！</p>
        </div>
      )}

      {/* ── 新徽章通知 ── */}
      {newBadge && (
        <div className="mx-4 mb-2 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-center animate-bounce-soft">
          <p className="text-yellow-700 text-sm font-medium">🏅 解鎖新徽章：{newBadge}</p>
          <button onClick={() => setNewBadge(null)} className="text-yellow-500 text-xs mt-1">關閉</button>
        </div>
      )}

      {/* ── 底部：語音面板 or 文字輸入 ── */}
      {voiceMode ? (
        <VoicePanel
          tab={activeTab}
          isConnected={voice.isConnected}
          isConnecting={voice.isConnecting}
          isUserSpeaking={voice.isUserSpeaking}
          isAssistantSpeaking={voice.isAssistantSpeaking}
          userLevel={voice.userLevel}
          statusText={voice.statusText}
          completedToday={completedToday}
          onConnect={() => voice.connect(activeTab)}
          onDisconnect={voice.disconnect}
          onOpenComplete={() => setShowCompleteModal(true)}
        />
      ) : activeTab === 'practice' ? (
        /* 21天練習文字輸入 */
        <div className="border-t border-gray-100 bg-white px-4 py-3">
          {/* v1.3.3d：read-only banner、看歷史 Day 時顯示 + disable input
              v1.5.x 7/26：看「歷史輪次」時額外標明是哪一輪、避免用戶以為看的是當前任務 */}
          {viewingDay !== null && (
            <div className="mb-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs text-orange-700 flex items-center justify-between gap-2">
              <span className="truncate">
                📖 正在看{viewingJourneyId && <span className="font-medium">歷史任務的 </span>}
                Day {viewingDay} 紀錄（唯讀）
              </span>
              {/* v1.5.x 7/30（2026-08-22 backport）：沒有 active journey 時「回當前 Day」會失效
                  （switchToDay 守衛擋掉）、改成「離開檢視」直接清狀態回到空狀態 CTA */}
              <button
                onClick={() => {
                  if (hasJourney) {
                    switchToDay(today?.day_number ?? 0);
                  } else {
                    setViewingDay(null);
                    setViewingDayInfo(null);
                    setViewingDayMessages([]);
                    setViewingJourneyId(null);
                    setViewingJourneyMaxDay(null);
                  }
                }}
                className="text-orange-600 hover:text-orange-800 font-medium ml-2 underline shrink-0"
              >
                {hasJourney ? '回當前 Day' : '離開檢視'}
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              ref={practiceInputRef}
              value={practiceInput}
              onChange={e => setPracticeInput(e.target.value)}
              onInput={e => {
                // v1.3.6：auto-grow textarea（Line/iMessage 風格）max ~5 行 = 120px
                const ta = e.currentTarget;
                ta.style.height = 'auto';
                ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
              }}
              onKeyDown={e => {
                // v1.5.x 7/26 fix：中文輸入法（IME）組字中按 Enter 是「確認選字」、不該送出。
                //   舊版沒擋 → IME commit 造成的 onChange 晚一步觸發、把已清空的 input 又寫回文字，
                //   結果訊息送出了但輸入框沒清空（Steve 7/26 回報）。
                //   isComposing / keyCode 229 是判斷 IME 組字中的標準做法（229 給舊瀏覽器 fallback）。
                const composing = e.nativeEvent.isComposing || e.keyCode === 229;
                if (e.key === 'Enter' && !e.shiftKey && !composing) {
                  e.preventDefault();
                  sendPracticeMessage(practiceInput);
                }
              }}
              placeholder={
                !hasJourney
                  ? '點上方「＋」開始新一輪 21 天練習'
                  : viewingDay !== null
                    ? '看歷史紀錄中、不能傳新訊息'
                    : '想對小羽說...'
              }
              disabled={viewingDay !== null || !hasJourney}
              className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm resize-none max-h-[120px] overflow-y-auto focus:outline-none focus:ring-2 focus:ring-primary-400 placeholder:text-gray-400 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
              rows={1}
            />
            <button
              onClick={() => sendPracticeMessage(practiceInput)}
              disabled={!practiceInput.trim() || practiceStreaming || viewingDay !== null || !hasJourney}
              className="text-white w-10 h-10 rounded-full shrink-0 flex items-center justify-center bg-pearl-gradient hover:opacity-90 disabled:!bg-gray-200 disabled:!bg-none disabled:text-gray-400 disabled:cursor-not-allowed transition-all"
              title="送出"
              aria-label="送出"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
            {!completedToday && (
              <button
                onClick={() => setShowCompleteModal(true)}
                className="bg-pearl-gradient text-white px-3 h-10 text-xs shrink-0 rounded-xl font-bold hover:opacity-90 transition-opacity"
                title="完成今日"
              >
                完成
              </button>
            )}
            {completedToday && (
              <Link href="/progress">
                <button className="bg-pearl-gradient text-white px-3 h-10 text-xs shrink-0 rounded-xl font-bold hover:opacity-90 transition-opacity">Done</button>
              </Link>
            )}
            {/* v1.5.x 7/16：DEV-ONLY「⏭ Dev」按鈕已刪除（Pearl + Steve 都完成 21 天測試、任務完成）*/}
          </div>
        </div>
      ) : (
        /* 諮詢師文字輸入 */
        <div className="border-t border-gray-100 bg-white px-4 py-3">
          {/* v1.3.3c.1：pendingNewTopic 視覺 feedback、解決「點＋沒反應」UX */}
          {pendingNewTopic && activeTab === 'consultant' && (
            <div className="mb-2 bg-primary-50 border border-primary-200 rounded-lg px-3 py-2 text-xs text-primary-700 flex items-center justify-between">
              <span>✨ 新主題模式 — 送出訊息後小羽自動命名</span>
              <button
                onClick={() => setPendingNewTopic(false)}
                className="text-primary-400 hover:text-primary-600 ml-2"
                title="取消"
              >
                ✕
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              ref={consultantInputRef}
              value={consultantInput}
              onChange={e => setConsultantInput(e.target.value)}
              onInput={e => {
                // v1.3.6：auto-grow textarea（Line/iMessage 風格）max ~5 行 = 120px
                const ta = e.currentTarget;
                ta.style.height = 'auto';
                ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
              }}
              onKeyDown={e => {
                // v1.5.x 7/26 fix：同 practice tab — IME 組字中按 Enter 不送出（見上方註解）
                const composing = e.nativeEvent.isComposing || e.keyCode === 229;
                if (e.key === 'Enter' && !e.shiftKey && !composing) {
                  e.preventDefault();
                  sendConsultantMessage(consultantInput);
                }
              }}
              placeholder="說說你遇到的問題..."
              className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm resize-none max-h-[120px] overflow-y-auto focus:outline-none focus:ring-2 focus:ring-primary-400 placeholder:text-gray-400"
              rows={1}
            />
            <button
              onClick={() => sendConsultantMessage(consultantInput)}
              disabled={!consultantInput.trim() || consultantStreaming}
              className="text-white w-10 h-10 rounded-full shrink-0 flex items-center justify-center bg-pearl-gradient hover:opacity-90 disabled:!bg-gray-200 disabled:!bg-none disabled:text-gray-400 disabled:cursor-not-allowed transition-all"
              title="送出"
              aria-label="送出"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ── 完成今日 Modal（只在有 journey 時可開）── */}
      {showCompleteModal && journey && (
        <CompleteDayModal
          onClose={() => setShowCompleteModal(false)}
          onComplete={handleComplete}
          partnerName={journey.partner_nickname}
        />
      )}
      </div>{/* /主對話區 v1.3.3c sidebar layout */}
    </div>
  );
}
