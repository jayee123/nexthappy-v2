import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionFromRequest } from '@/lib/auth';
import { buildContextData, buildSystemPrompt } from '@/lib/ai/buildContext';
import { addPoints, POINT_RULES } from '@/lib/points';
import { checkQuotaAvailable, recordUsage } from '@/lib/billing/quotas';
import type { ChatMessage, ContextType } from '@/types';

const MODEL_NAME = 'claude-sonnet-4-5';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Rate limiting: 每用戶每天最多 50 次呼叫（簡易實作）
const rateLimitMap = new Map<string, { count: number; date: string }>();

function checkRateLimit(userId: string): boolean {
  const today = new Date().toISOString().split('T')[0];
  const current = rateLimitMap.get(userId);

  if (!current || current.date !== today) {
    rateLimitMap.set(userId, { count: 1, date: today });
    return true;
  }

  if (current.count >= 50) return false;

  current.count++;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    if (!checkRateLimit(session.userId)) {
      return NextResponse.json({ error: '今日對話次數已達上限（50次），明天再繼續吧！' }, { status: 429 });
    }

    // Phase 1A：訂閱方案額度檢查（BILLING_ENFORCEMENT=false 時永遠通過）
    const quotaCheck = await checkQuotaAvailable(session.userId);
    if (!quotaCheck.allowed) {
      return NextResponse.json({
        error: quotaCheck.user_message || '已達使用上限',
        quota_exceeded: true,
        quota_reason: quotaCheck.reason,
        usage: quotaCheck.usage,
      }, { status: 429 });
    }

    const body = await request.json();
    const { message, context_type = 'realtime' } = body as {
      message: string;
      context_type?: ContextType;
    };

    // 取得旅程
    const { data: journey } = await supabaseAdmin
      .from('journeys')
      .select('*')
      .eq('user_id', session.userId)
      .eq('is_active', true)
      .single();

    if (!journey) {
      return NextResponse.json({ error: '找不到進行中的旅程' }, { status: 404 });
    }

    const dayNumber = journey.current_day;

    // 取得或建立今日對話
    // Bug #2 follow-up: 改 .single() → .order().limit(1).maybeSingle()
    //   - .single() 在 0 row 或 >1 row 都 error、會誤觸 INSERT 路徑
    //   - 一旦有重複 row（race / 歷史殘留）、每次對話都會 INSERT 新 row、runaway
    //   - .maybeSingle() 在 0 row 返 null、不 error；.limit(1).order(desc) 確保拿最新
    let { data: convRecord } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('journey_id', journey.id)
      .eq('day_number', dayNumber)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const messages: ChatMessage[] = (convRecord?.messages as ChatMessage[]) || [];

    // 加入用戶訊息
    const newUserMessage: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };
    messages.push(newUserMessage);

    // 組裝 Context
    const contextData = await buildContextData(journey.id, dayNumber);
    if (!contextData) {
      return NextResponse.json({ error: '無法載入今日課程' }, { status: 500 });
    }
    const systemPrompt = buildSystemPrompt(contextData);

    // 呼叫 Claude API（Streaming）
    const anthropicMessages = messages.slice(-20).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const stream = await anthropic.messages.stream({
      model: MODEL_NAME,
      max_tokens: 1500,
      system: systemPrompt,
      messages: anthropicMessages,
    });

    // 建立 SSE 回應
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

          // 儲存完整對話
          const assistantMessage: ChatMessage = {
            role: 'assistant',
            content: fullResponse,
            timestamp: new Date().toISOString(),
          };
          messages.push(assistantMessage);

          if (convRecord) {
            const { error: updateError } = await supabaseAdmin
              .from('conversations')
              .update({ messages, updated_at: new Date().toISOString() })
              .eq('id', convRecord.id);
            if (updateError) {
              console.error('[ai/chat] conversation UPDATE failed:', updateError);
            }
          } else {
            // Bug #2 fix: 補 user_id（NOT NULL、無 default、之前 silent insert fail）
            // 補 source（有 default 'text'、explicit 寫出避免日後 schema 改動踩雷）
            // 加 error log（之前 silent fail 是因為沒檢查 .insert() 的 error）
            const { error: insertError } = await supabaseAdmin
              .from('conversations')
              .insert({
                user_id: session.userId,
                journey_id: journey.id,
                day_number: dayNumber,
                context_type,
                source: 'text',
                messages,
              });
            if (insertError) {
              console.error('[ai/chat] conversation INSERT failed:', insertError);
            }
          }

          // 加入 AI 諮詢積分
          await addPoints(journey.id, POINT_RULES.AI_CONSULT);

          // Phase 1A：精準 token usage tracking
          try {
            const finalMsg = await stream.finalMessage();
            const inputTokens = finalMsg.usage?.input_tokens ?? 0;
            const outputTokens = finalMsg.usage?.output_tokens ?? 0;
            // recordUsage fail-soft（不阻塞、log 失敗）
            recordUsage({
              userId: session.userId,
              conversationId: convRecord?.id ?? null,
              contextType: context_type,
              model: MODEL_NAME,
              inputTokens,
              outputTokens,
            }).catch(err => console.error('[ai/chat] recordUsage failed:', err));
          } catch (err) {
            console.error('[ai/chat] usage tracking failed:', err);
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('Stream error:', error);
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
    console.error('Chat error:', error);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}
