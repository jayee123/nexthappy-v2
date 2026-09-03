// 放置路徑：src/lib/ai/autoTitle.ts
// v1.3.3a 新增：諮詢主題 auto-titling
// 用 GPT-4o mini（fast + cheap）從 user 第一句訊息生成 5-15 字主題標題
//
// 對應：Migration 006 conversations.topic_title 欄位
//       docs/architecture-phase-2-proposal.md §3.4 auto-titling 機制
//
// 使用：
//   import { generateTopicTitle } from '@/lib/ai/autoTitle';
//   const title = await generateTopicTitle(userFirstMessage);
//   // → e.g. "兒子玩手機、成績掉、絕食"

import { callOpenAIChat } from '@/lib/ai/openai';

const FALLBACK_TITLE = '新主題';
const MAX_TITLE_LENGTH = 20;
const MAX_INPUT_LENGTH = 500;

/**
 * 從 user 第一句諮詢訊息、生成 5-15 字的短主題標題
 *
 * @param userMessage user 第一句 message 內容
 * @returns 5-20 字的中文標題（失敗 fallback「新主題」）
 *
 * 範例：
 *   input：「我兒子每天玩手機好幾個小時、成績掉到倒數⋯」
 *   output：「兒子玩手機、成績掉、絕食」
 *
 *   input：「我老婆已經 3 天不跟我講話⋯」
 *   output：「老婆冷戰、不肯講話」
 */
export async function generateTopicTitle(userMessage: string): Promise<string> {
  const trimmed = (userMessage || '').slice(0, MAX_INPUT_LENGTH).trim();
  if (!trimmed) return FALLBACK_TITLE;

  try {
    const text = await callOpenAIChat({
      model: 'gpt-4o-mini',
      maxTokens: 30,
      messages: [
        {
          role: 'user',
          content: `以下是 user 諮詢的第一句訊息、請用 5-15 個中文字幫這個諮詢主題下一個短標題。

要求：
- 直接給標題文字、不要加標點符號 / 引號 / 解釋
- 5-15 字、聚焦最關鍵的「對象 + 行為 / 卡點」
- 範例：
   input「我兒子每天玩手機⋯成績掉⋯絕食」→ output「兒子玩手機、成績掉、絕食」
   input「我老婆 3 天不講話」→ output「老婆冷戰、不肯講話」
   input「主管 micromanage」→ output「主管不信任、micromanage」

User 訊息：
${trimmed}

標題：`,
        },
      ],
    });

    if (!text) return FALLBACK_TITLE;

    // 清理：去引號、去換行、去前後空白、限制長度
    let title = text.trim()
      .replace(/^["「『'`]+|["」』'`]+$/g, '')
      .replace(/[\n\r]+/g, ' ')
      .replace(/^標題[：:\s]*/, '') // 去掉模型可能殘留的「標題：」前綴
      .trim();

    if (title.length > MAX_TITLE_LENGTH) {
      title = title.slice(0, MAX_TITLE_LENGTH);
    }

    return title || FALLBACK_TITLE;
  } catch (err) {
    console.error('[autoTitle] generation failed:', err);
    return FALLBACK_TITLE;
  }
}
