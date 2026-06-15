// 放置路徑：src/app/api/ai/consultant/route.ts
//
// 功能：「我卡住了，幫我拆」模式的 API（v1.3.3b 重構：multi-thread + auto-titling）
//
// GET 模式（3 種）：
//   GET /api/ai/consultant                → 載入最新 active 主題（backward compat）
//   GET /api/ai/consultant?topic_id=xxx   → 載入指定主題完整對話
//   GET /api/ai/consultant?list=true      → 列出所有主題（sidebar 用、含 archived）
//
// POST 模式（3 種）：
//   POST /api/ai/consultant { message }                      → 繼續最新 active 主題（backward compat）
//   POST /api/ai/consultant { message, topic_id: xxx }       → 繼續指定主題
//   POST /api/ai/consultant { message, new_topic: true }     → 開新主題（autoTitle 自動命名）
//
// 對應：
//   Migration 006 (topic_title / topic_started_at / archived_at)
//   docs/v2.1-course-spec.md v1.3.3b
//   docs/architecture-phase-2-proposal.md §3

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionFromRequest } from '@/lib/auth';
import {
  buildContextData,
  buildConsultantPrompt,
  buildConsultantLiteContextData,
  buildConsultantPromptLite,
  extractMbtiCodes,
} from '@/lib/ai/buildContext';
import { generateTopicTitle } from '@/lib/ai/autoTitle';
import type { ChatMessage } from '@/types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Rate limiting
const rateLimitMap = new Map<string, { count: number; date: string }>();
function checkRateLimit(userId: string): boolean {
  const today = new Date().toISOString().split('T')[0];
  const current = rateLimitMap.get(userId);
  if (!current || current.date !== today) {
    rateLimitMap.set(userId, { count: 1, date: today });
    return true;
  }
  if (current.count >= 80) return false;
  current.count++;
  return true;
}

// =============================================================
// GET — 3 modes：list / specific / latest
// =============================================================

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: '請先登入' }, { status: 401 });

    const url = new URL(request.url);
    const topicId = url.searchParams.get('topic_id');
    const isList = url.searchParams.get('list') === 'true';
    const includeArchived = url.searchParams.get('include_archived') === 'true';

    // v1.3.4：改用 user_id-based query（work 在 trier + journey 兩種模式）
    const userId = session.userId;

    // ── Mode 1：列出所有主題（for sidebar）──
    if (isList) {
      let query = supabaseAdmin
        .from('conversations')
        .select('id, topic_title, topic_started_at, archived_at, messages, updated_at, created_at')
        .eq('user_id', userId)                  // v1.3.4：改 user_id-based
        .eq('context_type', 'consultant')
        .order('topic_started_at', { ascending: false, nullsFirst: false });

      if (!includeArchived) {
        query = query.is('archived_at', null);
      }

      const { data: topics } = await query;

      return NextResponse.json({
        topics: (topics || []).map(t => ({
          id: t.id,
          topic_title: t.topic_title || '新主題',
          topic_started_at: t.topic_started_at || t.created_at,
          archived_at: t.archived_at,
          message_count: Array.isArray(t.messages) ? (t.messages as ChatMessage[]).length : 0,
          last_updated_at: t.updated_at,
        })),
      });
    }

    // ── Mode 2：載入指定主題完整對話 ──
    if (topicId) {
      const { data: conv } = await supabaseAdmin
        .from('conversations')
        .select('*')
        .eq('id', topicId)
        .eq('user_id', userId)                  // v1.3.4：security 從 journey owner → user owner
        .eq('context_type', 'consultant')
        .maybeSingle();

      if (!conv) {
        return NextResponse.json({ error: '找不到主題', messages: [] }, { status: 404 });
      }

      return NextResponse.json({
        topic_id: conv.id,
        topic_title: conv.topic_title || '新主題',
        topic_started_at: conv.topic_started_at,
        archived_at: conv.archived_at,
        messages: conv.messages || [],
      });
    }

    // ── Mode 3：載入最新 active 主題（backward compat）──
    const { data: conv } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('user_id', userId)                    // v1.3.4：改 user_id-based
      .eq('context_type', 'consultant')
      .is('archived_at', null)
      .order('topic_started_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      topic_id: conv?.id || null,
      topic_title: conv?.topic_title || null,
      messages: conv?.messages || [],
    });
  } catch (err) {
    console.error('[consultant/GET]', err);
    return NextResponse.json({ messages: [] });
  }
}

// =============================================================
// POST — multi-thread + autoTitle
// =============================================================

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: '請先登入' }, { status: 401 });

    if (!checkRateLimit(session.userId)) {
      return NextResponse.json({ error: '今日對話次數已達上限，明天再繼續吧！' }, { status: 429 });
    }

    const body = await request.json();
    const {
      message,
      topic_id,
      new_topic = false,
    } = body as { message: string; topic_id?: string; new_topic?: boolean };

    if (!message?.trim()) return NextResponse.json({ error: '訊息不能為空' }, { status: 400 });

    // journey 變 optional——trier-first 場景 user 沒啟動 Mode A 也能用 Mode B
    const { data: journey } = await supabaseAdmin
      .from('journeys')
      .select('*')
      .eq('user_id', session.userId)
      .eq('is_active', true)
      .maybeSingle();

    // v1.3.4：改用 user_id-based 持久化（work 在 trier + journey 兩種模式）
    const userId = session.userId;

    // ── 載入既有對話（multi-thread routing）──
    type ConvRecordSlim = { id: string; messages: ChatMessage[]; topic_title: string | null };
    let convRecord: ConvRecordSlim | null = null;
    let isNewTopic = new_topic === true;

    if (!isNewTopic && topic_id) {
      // 載入指定主題（v1.3.4：user_id-based、不分 trier / journey）
      const { data } = await supabaseAdmin
        .from('conversations')
        .select('id, messages, topic_title')
        .eq('id', topic_id)
        .eq('user_id', userId)                  // security
        .eq('context_type', 'consultant')
        .maybeSingle();
      convRecord = (data as ConvRecordSlim | null) ?? null;
      if (!convRecord) isNewTopic = true;       // 找不到 → 當新主題開（容錯）
    } else if (!isNewTopic) {
      // 預設：載入最新 active 主題（backward compat）
      const { data } = await supabaseAdmin
        .from('conversations')
        .select('id, messages, topic_title')
        .eq('user_id', userId)
        .eq('context_type', 'consultant')
        .is('archived_at', null)
        .order('topic_started_at', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      convRecord = (data as ConvRecordSlim | null) ?? null;
      if (!convRecord) isNewTopic = true;
    }

    const messages: ChatMessage[] = convRecord ? [...convRecord.messages] : [];

    // 加入新用戶訊息
    messages.push({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    });

    // v1.2.1: message-level MBTI extraction
    const allMessageText = messages.map(m => m.content).join(' ');
    const declaredMbtis = extractMbtiCodes(allMessageText);

    // v1.3.2a: 兩條 path 組 prompt
    let systemPrompt: string;
    if (journey) {
      const contextData = await buildContextData(journey.id, journey.current_day);
      if (!contextData) return NextResponse.json({ error: '無法載入旅程資料' }, { status: 500 });
      systemPrompt = buildConsultantPrompt(contextData, declaredMbtis);
    } else {
      const liteContext = await buildConsultantLiteContextData(session.userId);
      if (!liteContext) {
        return NextResponse.json({
          error: '請先完成 2 步快速設定（MBTI + 暱稱）才能開始諮詢',
          code: 'NEEDS_ONBOARDING',
        }, { status: 400 });
      }
      systemPrompt = buildConsultantPromptLite(liteContext, declaredMbtis);
    }

    // 呼叫 Claude API（Streaming）
    const anthropicMessages = messages.slice(-30).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-5',
      max_tokens: 2500,
      system: systemPrompt,
      messages: anthropicMessages,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        let fullResponse = '';

        try {
          for await (const chunk of stream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              const text = chunk.delta.text;
              fullResponse += text;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
            }
          }

          messages.push({
            role: 'assistant',
            content: fullResponse,
            timestamp: new Date().toISOString(),
          });

          // ── 持久化（v1.3.4：user_id-based、trier + journey 都持久化）──
          let savedConvId: string | null = null;

          if (convRecord && !isNewTopic) {
            // UPDATE 既有主題
            await supabaseAdmin
              .from('conversations')
              .update({ messages, updated_at: new Date().toISOString() })
              .eq('id', convRecord.id);
            savedConvId = convRecord.id;
          } else {
            // INSERT 新主題（topic_title 先 NULL、下面 autoTitle 補）
            // v1.3.4：永遠 set user_id、journey_id optional（trier 模式 NULL）
            const nowIso = new Date().toISOString();
            const { data: newConv, error: insertError } = await supabaseAdmin
              .from('conversations')
              .insert({
                user_id: userId,                          // v1.3.4 canonical owner
                journey_id: journey?.id || null,          // v1.3.4：optional（trier NULL）
                day_number: 0,
                context_type: 'consultant',
                messages,
                topic_title: null,
                topic_started_at: nowIso,
              })
              .select('id')
              .single();
            if (insertError) {
              console.error('[consultant/POST INSERT]', insertError);
            }
            savedConvId = newConv?.id || null;
          }

          // ── Auto-title for 新主題（v1.3.3b）──
          // 只在新主題創建後 trigger、用 user 第一句訊息生成 5-15 字標題
          if (savedConvId && isNewTopic) {
            try {
              const title = await generateTopicTitle(message);
              await supabaseAdmin
                .from('conversations')
                .update({ topic_title: title })
                .eq('id', savedConvId);
            } catch (titleErr) {
              console.error('[consultant/autoTitle]', titleErr);
              // 失敗不影響主流程、保持 topic_title=NULL（前端顯示「新主題」fallback）
            }
          }

          // 傳回 topic_id 給 client（用於 sidebar 即時更新 / continuation）
          if (savedConvId) {
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ topic_id: savedConvId, is_new_topic: isNewTopic })}\n\n`
            ));
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('[consultant/POST stream]', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: '回應發生錯誤' })}\n\n`));
          controller.close();
        }
      },
    });

    return new NextResponse(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[consultant/POST]', error);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}

// =============================================================
// PATCH — 改 topic_title / archive / restore（sidebar 用）
// =============================================================

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: '請先登入' }, { status: 401 });

    const body = await request.json();
    const { topic_id, topic_title, archive } = body as {
      topic_id: string;
      topic_title?: string;
      archive?: boolean; // true = archive、false = restore
    };

    if (!topic_id) return NextResponse.json({ error: '缺少 topic_id' }, { status: 400 });

    const updates: Record<string, string | null> = { updated_at: new Date().toISOString() };
    if (typeof topic_title === 'string') {
      // v1.3.4 hotfix：放寬 20→30、配合 frontend maxLength 一致、避免中文 IME 衝突
      updates.topic_title = topic_title.trim().slice(0, 30) || '新主題';
    }
    if (typeof archive === 'boolean') {
      updates.archived_at = archive ? new Date().toISOString() : null;
    }

    // v1.3.4：security 改 user_id-based（work 在 trier + journey）
    const { error } = await supabaseAdmin
      .from('conversations')
      .update(updates)
      .eq('id', topic_id)
      .eq('user_id', session.userId)
      .eq('context_type', 'consultant');

    if (error) {
      console.error('[consultant/PATCH]', error);
      return NextResponse.json({ error: '更新失敗' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[consultant/PATCH]', err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}
