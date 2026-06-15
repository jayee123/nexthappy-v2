// 放置路徑：src/app/api/realtime/session/route.ts
//
// 功能：驗證登入後，向 OpenAI 申請語音 ephemeral token，
//       並把完整小羽 system prompt（含語音補充指示）帶入 session config。

import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { buildContextData, buildSystemPrompt, buildConsultantPrompt } from '@/lib/ai/buildContext';

export async function GET(req: NextRequest) {
  try {
    // 1. 驗證登入
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }
    const userId = session.userId;

    if (!process.env.OPENAI_API_KEY) {
      console.error('[realtime/session] OPENAI_API_KEY 未設定');
      return NextResponse.json({ error: '語音功能尚未設定' }, { status: 500 });
    }

    // 2. 取得用戶旅程（拿 journey_id 和 current_day）
    const { data: journey, error: journeyErr } = await supabaseAdmin
      .from('journeys')
      .select('id, current_day')
      .eq('user_id', userId)
      .single();

    if (journeyErr || !journey) {
      return NextResponse.json({ error: '找不到旅程資料' }, { status: 404 });
    }

    // 3. 抓取完整 context 資料（user、memories、course content）
    const ctxData = await buildContextData(journey.id, journey.current_day);
    if (!ctxData) {
      return NextResponse.json({ error: '無法組建對話脈絡' }, { status: 500 });
    }

    // 4. 根據模式組裝語音版 system prompt
    const mode = req.nextUrl.searchParams.get('mode') ?? 'practice';

    let basePrompt: string;
    let voiceInstructions: string;

    if (mode === 'consultant') {
      basePrompt = buildConsultantPrompt(ctxData);
      voiceInstructions = `${basePrompt}

【語音諮詢特別指示】
你現在以語音方式進行諮詢。請務必遵守以下規則：
- 每次回應控制在 2～3 句話，絕對不要超過
- 使用純口語繁體中文，不能使用條列符號或 markdown 格式
- 每次只問一個問題，不要一口氣問多個
- 先取得「對象是誰 + MBTI + 具體情境」三要素，再進入分析
- 用「嗯」「我聽到了」「然後呢？」展現在聆聽
- 語氣溫柔、有同理心，像小羽老師在做諮詢`;
    } else {
      basePrompt = buildSystemPrompt(ctxData);
      voiceInstructions = `${basePrompt}

【語音模式特別指示】
你現在以語音方式與用戶對話。請務必遵守以下規則：
- 每次回應控制在 2～3 句話，絕對不要超過
- 使用純口語繁體中文，絕對不能使用條列符號、數字列表或任何 markdown 格式
- 每段回應以一個溫柔的問題結尾，引導對方繼續說
- 可以用「嗯」「對」「我懂」「聽起來⋯」等短暫回應，讓對話更有人情味
- 語氣溫柔、有陪伴感，就像好友在聊天，而不是在上課`;
    }

    // 5. 向 OpenAI 申請 ephemeral token
    //    body 結構完全對照參考 relay server（v2proj-realtime-copy）
    const oaiRes = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session: {
          type: 'realtime',
          model: process.env.OPENAI_REALTIME_MODEL ?? 'gpt-realtime',
          output_modalities: ['audio'],
          instructions: voiceInstructions,
          audio: {
            input: {
              // 啟用用戶語音轉文字逐字稿
              transcription: {
                model: 'whisper-1',
                language: 'zh',
              },
              turn_detection: {
                type: 'server_vad',
                create_response: true,
                // 不打斷用戶：讓用戶說完整句子再回應
                interrupt_response: false,
                // 延長靜音等待時間：讓用戶有時間思考、停頓
                idle_timeout_ms: 20000,
                prefix_padding_ms: 500,
                silence_duration_ms: 1500,
              },
            },
            output: {
              voice: process.env.OPENAI_REALTIME_VOICE ?? 'marin',
            },
          },
        },
      }),
    });

    if (!oaiRes.ok) {
      const errText = await oaiRes.text();
      console.error('[realtime/session] OpenAI error:', oaiRes.status, errText);
      return NextResponse.json({ error: '無法建立語音 session，請稍後再試' }, { status: 502 });
    }

    const data = await oaiRes.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('[realtime/session] Error:', err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}
