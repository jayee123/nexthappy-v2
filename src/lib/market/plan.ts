/**
 * src/lib/market/plan.ts
 *
 * 訂閱方案的**唯一真值來源**：公版（NUWA Market）的 public.users.current_plan。
 *
 * 背景：#3a 之後帳號真值只有公版一份，付費也統一在公版。私版不再自行訂閱、
 * 也不該自己維護一份方案狀態，否則兩邊會不同步（用戶在公版升級、私版還當 trial）。
 *
 * 做法：兩邊在同一個 Postgres（公版 public schema、私版 happy schema），
 * 私版用 service role 另開一個指向 public 的 client，靠 happy.users.nuwa_user_id
 * 對應回公版帳號讀方案。不需要 HTTP API、不需要同步邏輯。
 *
 * 失敗時一律 fallback 到私版本地的 current_plan，不讓對話功能因為讀不到方案而中斷。
 */

import type { PlanTier } from '@/lib/billing/plans';
import { getMarketClient } from './client';

/** 這支私版對應公版 apps.slug。與 market/usage.ts 的 APP_SLUG 同值。 */
export const MARKET_APP_SLUG = 'happy';

/**
 * 公版 current_plan → 私版 PlanTier
 * 公版有 'free'（未訂閱），私版沒有對應層級，對到 'trial'（免費體驗額度）。
 */
const MARKET_PLAN_TO_TIER: Record<string, PlanTier> = {
  free: 'trial',
  basic: 'basic',
  advanced: 'advanced',
  premium: 'premium',
  cancelled: 'cancelled',
};

/**
 * 公版方案字串 → 私版 PlanTier。認不得的值回 null，讓呼叫端 fallback。
 * 抽成純函式方便單元測試（getMarketPlan 需要 DB）。
 */
export function mapMarketPlanToTier(marketPlan: string | null | undefined): PlanTier | null {
  if (!marketPlan) return null;
  return MARKET_PLAN_TO_TIER[marketPlan] ?? null;
}

export interface MarketPlanInfo {
  tier: PlanTier;
  /** 公版原始值（除錯 / 後台顯示用） */
  marketPlan: string;
  /** 公版方案到期日 */
  planDeadline: string | null;
}

/**
 * 讀公版方案。
 * @param nuwaUserId happy.users.nuwa_user_id
 * @returns 讀不到（未綁定 / 查無資料 / 查詢失敗）時回 null，由呼叫端 fallback
 */
export async function getMarketPlan(nuwaUserId: string | null): Promise<MarketPlanInfo | null> {
  if (!nuwaUserId) return null;

  const { data, error } = await getMarketClient()
    .from('users')
    .select('current_plan, plan_deadline')
    .eq('id', nuwaUserId)
    .maybeSingle();

  if (error) {
    console.error('[market/plan] 讀取公版方案失敗，fallback 用私版本地值:', error.message);
    return null;
  }
  if (!data) return null;

  const marketPlan = String(data.current_plan ?? 'free');
  const tier = mapMarketPlanToTier(marketPlan);

  if (!tier) {
    console.error(`[market/plan] 未知的公版方案 "${marketPlan}"，fallback 用私版本地值`);
    return null;
  }

  return {
    tier,
    marketPlan,
    planDeadline: data.plan_deadline ?? null,
  };
}

/**
 * 讀公版的「這支 App 的試用到期日」。
 *
 * 試用到期的唯一真值在公版 `public.user_app_trials.expires_at`
 * （兌換或自動開試用時由 `apps.trial_days` 算出來）。私版不該自己推算 ——
 * 公版 happy 設 14 天、私版常數寫死 7 天，各算各的就會在第 8 天起
 * 擋掉還在試用期內的人（Steve 2026-09-23 §四）。
 *
 * @param nuwaUserId happy.users.nuwa_user_id（未歸戶為 null）
 * @returns ISO 字串；未歸戶 / 查無紀錄 / 查詢失敗一律回 null，由呼叫端 fallback
 */
export async function getMarketTrialExpiry(nuwaUserId: string | null): Promise<string | null> {
  if (!nuwaUserId) return null;

  const market = getMarketClient();

  const { data: app, error: appErr } = await market
    .from('apps')
    .select('id')
    .eq('slug', MARKET_APP_SLUG)
    .maybeSingle();

  if (appErr || !app) {
    console.error('[market/plan] 讀不到公版 App 紀錄:', appErr?.message ?? 'not found');
    return null;
  }

  const { data, error } = await market
    .from('user_app_trials')
    .select('expires_at')
    .eq('user_id', nuwaUserId)
    .eq('app_id', app.id)
    .maybeSingle();

  if (error) {
    console.error('[market/plan] 讀取公版試用到期日失敗:', error.message);
    return null;
  }
  return data?.expires_at ? String(data.expires_at) : null;
}
