// 放置路徑：src/app/api/realtime/save/route.ts
//
// 功能：語音 session 結束時，把完整逐字稿存入 conversations 表
//       並標記 source = 'voice'（區別於文字對話）
//
// v1.3.7c：support mode='consultant' —— 自動建立諮詢主題（context_type='consultant' +
//          generateTopicTitle 自動命名 + topic_started_at + user_id-based 持久化）
//          以前 voice mode 只寫 default context_type、'我卡住'tab sidebar 查不到語音對話、user 看到「還沒主題」placeholder

import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { generateTopicTitle } from '@/lib/ai/autoTitle';

interface VoiceMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  source: 'voice';
}

export async function POST(req: NextRequest) {
  try {
    // 1. 驗證登入
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }
    const userId = session.userId;

    // 2. 解析 body
    const body = await req.json();
    const messages: VoiceMessage[] = body.messages ?? [];
    // v1.3.7c: mode 區分 practice / consultant，預設 practice 以保留向後相容
    const mode: 'practice' | 'consultant' = body.mode === 'consultant' ? 'consultant' : 'practice';

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: '沒有對話內容可儲存' }, { status: 400 });
    }

    // 3. 取得用戶的 journey_id（consultant mode 允許無 journey、trier user 也能存）
    const { data: journey } = await supabaseAdmin
      .from('journeys')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    // practice mode 強制要有 journey、否則拒絕（21 天練習邏輯需要）
    if (mode === 'practice' && !journey) {
      return NextResponse.json({ error: '找不到旅程資料' }, { status: 404 });
    }

    // 4. consultant mode：generateTopicTitle + 寫 topic_title / context_type / topic_started_at
    let topicTitle: string | null = null;
    if (mode === 'consultant') {
      // 抓第一句 user 訊息給 autoTitle
      const firstUserMsg = messages.find(m => m.role === 'user');
      if (firstUserMsg?.content) {
        try {
          topicTitle = await generateTopicTitle(firstUserMsg.content);
        } catch (e) {
          console.warn('[realtime/save] autoTitle failed, fallback to NULL:', e);
        }
      }
    }

    // 5. 儲存對話到 conversations 表
    const insertPayload: Record<string, unknown> = {
      user_id: userId,
      journey_id: journey?.id ?? null, // consultant mode 可能 NULL (trier user)
      source: 'voice',
      messages: messages,
      created_at: new Date().toISOString(),
    };
    if (mode === 'consultant') {
      insertPayload.context_type = 'consultant';
      insertPayload.topic_title = topicTitle;
      insertPayload.topic_started_at = new Date().toISOString();
      insertPayload.day_number = 0; // consultant 對話不掛 Day
    }

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('conversations')
      .insert(insertPayload)
      .select('id')
      .single();

    if (insertErr) {
      console.error('[realtime/save] Insert error:', insertErr);
      return NextResponse.json({ error: '儲存失敗' }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      saved: messages.length,
      mode,
      conversation_id: inserted?.id,
      topic_title: topicTitle,
    });
  } catch (err) {
    console.error('[realtime/save] Error:', err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}
