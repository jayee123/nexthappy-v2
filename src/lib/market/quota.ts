/**
 * src/lib/market/quota.ts
 *
 * AI 對話額度的**唯一真值在公版**（nuwa/v2 docs/QUOTA-PLAN.md，階段 2）：
 *   - 已用次數：public.ai_dialog_usage（各 App 共用一池，依來源分項）
 *   - 上限：public.dialog_limit_for()（方案次數 + 本期補發）
 *   - 週期：訂閱起算日（dialogPeriod，與 SQL dialog_period_start 一致）
 *   - 檢查 + 扣次：public.consume_dialog() 在一個交易內完成，對同一人加鎖
 *
 * 私版自己的 usage_quotas 從階段 2 起只當成本帳本，不再決定能不能對話。
 *
 * 紀律：讀取失敗回 null，由呼叫端決定 fallback；扣次失敗回 null，
 * 由 quotas.ts 依 BILLING_ENFORCEMENT 決定擋或放（拿不到回應時不偷偷放行）。
 */

import { getMarketClient } from './client';
import { MARKET_APP_SLUG } from './plan';
import { dialogPeriod, shortDateLabel } from './dialogPeriod';

export interface MarketQuota {
  used: number;
  limit: number;
  /** YYYY-MM-DD */
  periodStart: string;
  /** YYYY-MM-DD */
  nextReset: string;
  /** 'M/D'，畫面用 */
  nextResetLabel: string;
}

/**
 * 讀公版的本期額度（不扣次）。
 * @returns 未綁定 / 查無此人 / 查詢失敗 → null
 */
export async function getMarketQuota(
  nuwaUserId: string | null,
  now: Date = new Date(),
): Promise<MarketQuota | null> {
  if (!nuwaUserId) return null;
  const market = getMarketClient();

  const [{ data: sub, error: subErr }, { data: u, error: userErr }] = await Promise.all([
    market
      .from('subscriptions')
      .select('starts_at')
      .eq('user_id', nuwaUserId)
      .eq('status', 'active')
      .gt('ends_at', now.toISOString())
      .order('starts_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    market.from('users').select('created_at').eq('id', nuwaUserId).maybeSingle(),
  ]);
  if (subErr || userErr) {
    console.error('[market/quota] 讀取錨點失敗:', subErr?.message ?? userErr?.message);
    return null;
  }
  const anchor = (sub?.starts_at as string | undefined) ?? (u?.created_at as string | undefined);
  if (!anchor) return null;

  const period = dialogPeriod(new Date(anchor), now);

  const [{ data: limit, error: limitErr }, { data: rows, error: usageErr }] = await Promise.all([
    market.rpc('dialog_limit_for', { p_user: nuwaUserId, p_period: period.start }),
    market
      .from('ai_dialog_usage')
      .select('used')
      .eq('user_id', nuwaUserId)
      .eq('period_start', period.start),
  ]);
  if (limitErr || usageErr) {
    console.error('[market/quota] 讀取額度失敗:', limitErr?.message ?? usageErr?.message);
    return null;
  }

  const used = ((rows ?? []) as { used: number | null }[]).reduce((sum, r) => sum + (r.used ?? 0), 0);
  return {
    used,
    limit: Number(limit ?? 0),
    periodStart: period.start,
    nextReset: period.nextReset,
    nextResetLabel: shortDateLabel(period.nextReset),
  };
}

export interface ConsumeResult {
  allowed: boolean;
  used: number;
  limit: number;
  /** consume_dialog 拒絕時的原因（'quota_exceeded' | 'user_not_found'） */
  reason: string | null;
}

/**
 * 檢查 + 扣一次（原子）。這是 AI 呼叫前唯一該用的入口。
 * @returns RPC 失敗 → null（呼叫端不得視為允許）
 */
export async function consumeMarketDialog(nuwaUserId: string): Promise<ConsumeResult | null> {
  const { data, error } = await getMarketClient().rpc('consume_dialog', {
    p_user: nuwaUserId,
    p_source: MARKET_APP_SLUG,
  });
  if (error || !data || typeof data !== 'object') {
    console.error('[market/quota] consume_dialog 失敗:', error?.message ?? 'empty result');
    return null;
  }
  const r = data as { allowed?: boolean; used?: number; limit?: number; reason?: string };
  return {
    allowed: r.allowed === true,
    used: Number(r.used ?? 0),
    limit: Number(r.limit ?? 0),
    reason: r.reason ?? null,
  };
}

/**
 * 只記不擋。給「BILLING_ENFORCEMENT 關著、但 consume_dialog 說超額」的情況用：
 * 內測期不擋人，可是帳還是要記，否則打開閘門那天數字對不上。
 */
export async function recordMarketDialog(nuwaUserId: string): Promise<void> {
  const { error } = await getMarketClient().rpc('record_dialog', {
    p_user: nuwaUserId,
    p_source: MARKET_APP_SLUG,
  });
  if (error) console.error('[market/quota] record_dialog 失敗:', error.message);
}
