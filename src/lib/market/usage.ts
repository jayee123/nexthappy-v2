/**
 * src/lib/market/usage.ts
 *
 * 把私版的 AI token 用量回寫到公版，讓公版能做「跨 App 用量歸戶」——
 * 以一個會員為單位，彙總他在各 App 的用量與成本。
 *
 * 公版的 public.ai_token_usage 已經有 app_id（migration 013），
 * /manage/ai-usage 也已按 App 分權限，缺的就是私版沒把資料送過去。
 *
 * 紀律：
 *   - 這是「回報」，不是主流程。任何失敗都只 log，不能影響對話。
 *   - 沒綁公版帳號（nuwa_user_id 為 null）就跳過，公版沒有對應的會員可歸戶。
 *   - 一次呼叫寫一列，與公版自身的寫法一致（見 nuwa/v2 api/chat/route.ts）。
 */

import { getMarketClient } from './client';

const APP_SLUG = 'happy';

/** app id 不會變，查一次就快取在 process 記憶體，避免每次呼叫都多一次查詢 */
let cachedAppId: string | null = null;

async function getHappyAppId(): Promise<string | null> {
  if (cachedAppId) return cachedAppId;

  const { data, error } = await getMarketClient()
    .from('apps')
    .select('id')
    .eq('slug', APP_SLUG)
    .maybeSingle();

  if (error || !data?.id) {
    console.error('[market/usage] 查不到 App，用量無法歸戶:', error?.message ?? 'app not found');
    return null;
  }

  cachedAppId = data.id as string;
  return cachedAppId;
}

export interface UsageReport {
  /** 私版 happy.users.nuwa_user_id；未綁定時為 null，會直接跳過 */
  nuwaUserId: string | null | undefined;
  inputTokens: number;
  outputTokens: number;
  costTwd: number;
}

/**
 * 回報一次 AI 呼叫的用量到公版。
 * 永遠不 throw —— 呼叫端不需要 try/catch，也不該 await 阻塞回應。
 */
export async function reportUsageToMarket(report: UsageReport): Promise<void> {
  if (!report.nuwaUserId) return;

  try {
    const appId = await getHappyAppId();
    if (!appId) return;

    const { error } = await getMarketClient().from('ai_token_usage').insert({
      user_id: report.nuwaUserId,
      app_id: appId,
      tokens_used: report.inputTokens + report.outputTokens,
      cost_twd: report.costTwd,
      date: new Date().toISOString().slice(0, 10),
    });

    if (error) {
      console.error('[market/usage] 回寫公版用量失敗:', error.message);
    }
  } catch (err) {
    console.error('[market/usage] 回寫公版用量發生未預期錯誤:', err);
  }
}
