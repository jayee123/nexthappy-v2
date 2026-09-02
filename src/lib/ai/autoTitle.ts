// 放置路徑：src/lib/ai/autoTitle.ts
// v1.3.3a 新增：諮詢主題 auto-titling
// 用 Claude Haiku 4.5（fast + cheap）從 user 第一句訊息生成 5-15 字主題標題
//
// 對應：Migration 006 conversations.topic_title 欄位
//       docs/architecture-phase-2-proposal.md §3.4 auto-titling 機制
//
// 使用：
//   import { generateTopicTitle } from '@/lib/ai/autoTitle';
//   const title = await generateTopicTitle(userFirstMessage);
//   // → e.g. "兒子玩手機、成績掉、絕食"

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MAX_TITLE_LENGTH = 20;
const MAX_INPUT_LENGTH = 500;

/** 模型判斷「這句話沒有可下標的內容」時要回的字串 */
const NO_TOPIC_TOKEN = 'NONE';

/**
 * 模型「在解釋而不是在下標」的跡象。
 *
 * 為什麼需要這道檢查：模型被要求「給一個標題」時，即使輸入沒有內容
 * （例如只有「你好」），它也傾向擠出一句話交差 —— 而那句話會被原封不動
 * 寫進 topic_title。正式站上就出現過主題叫「無法判斷諮詢主題」。
 * NO_TOPIC_TOKEN 給了模型正確的出口，這裡是萬一它仍然造句時的第二道網。
 */
const NOT_A_TITLE_PATTERNS = [
  /無法/, /不能/, /沒有.*(內容|資訊|主題)/, /抱歉/, /對不起/,
  /請(提供|告訴|說明)/, /需要更多/, /^(sorry|i\s)/i,
];

/**
 * 從 user 第一句諮詢訊息、生成 5-15 字的短主題標題
 *
 * @param userMessage 要據以下標的 user 訊息
 * @returns 5-20 字的中文標題；**無法判斷或失敗時回 null**
 *
 * 回 null 而不是回一個假標題，是為了讓呼叫端「不要寫入 topic_title」——
 * 欄位維持 NULL，前端 fallback 顯示「新主題」，而且下一句訊息還能再試一次。
 * 若在這裡回 '新主題'，那個值會被當成真的標題寫進 DB，就再也沒有第二次機會了。
 *
 * 範例：
 *   input：「我兒子每天玩手機好幾個小時、成績掉到倒數⋯」
 *   output：「兒子玩手機、成績掉、絕食」
 *
 *   input：「我老婆已經 3 天不跟我講話⋯」
 *   output：「老婆冷戰、不肯講話」
 */
export async function generateTopicTitle(userMessage: string): Promise<string | null> {
  const trimmed = (userMessage || '').slice(0, MAX_INPUT_LENGTH).trim();
  if (!trimmed) return null;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 30,
      messages: [
        {
          role: 'user',
          content: `以下是 user 諮詢的第一句訊息、請用 5-15 個中文字幫這個諮詢主題下一個短標題。

要求：
- 直接給標題文字、不要加標點符號 / 引號 / 解釋
- 5-15 字、聚焦最關鍵的「對象 + 行為 / 卡點」
- **若這句訊息沒有具體的諮詢內容（例如只是打招呼、只有一兩個字、看不出在談什麼），
  只輸出 NONE 這四個字母、不要解釋、不要自己造一個標題。**
- 範例：
   input「你好」→ output「NONE」
   input「在嗎」→ output「NONE」
   input「我兒子每天玩手機⋯成績掉⋯絕食」→ output「兒子玩手機、成績掉、絕食」
   input「我老婆 3 天不講話」→ output「老婆冷戰、不肯講話」
   input「主管 micromanage」→ output「主管不信任、micromanage」

User 訊息：
${trimmed}

標題：`,
        },
      ],
    });

    const block = response.content[0];
    if (!block || block.type !== 'text') return null;

    // 清理：去引號、去換行、去前後空白、限制長度
    let title = block.text.trim()
      .replace(/^["「『'`]+|["」』'`]+$/g, '')
      .replace(/[\n\r]+/g, ' ')
      .replace(/^標題[：:\s]*/, '') // 去掉模型可能殘留的「標題：」前綴
      .trim();

    if (!title) return null;

    // 模型給的出口
    if (title.toUpperCase() === NO_TOPIC_TOKEN) return null;

    // 第二道網：模型仍然在解釋而不是在下標
    if (NOT_A_TITLE_PATTERNS.some((re) => re.test(title))) {
      console.warn('[autoTitle] 模型回的不像標題，視為無法判斷:', title);
      return null;
    }

    if (title.length > MAX_TITLE_LENGTH) {
      title = title.slice(0, MAX_TITLE_LENGTH);
    }

    return title;
  } catch (err) {
    console.error('[autoTitle] generation failed:', err);
    return null;
  }
}
