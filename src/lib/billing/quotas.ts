// 放置路徑：src/lib/billing/quotas.ts
//
// 用量配額 helpers —— 階段 2（nuwa/v2 docs/QUOTA-PLAN.md）：額度真值在公版
//
// 公開的 helper：
//   - isEnforcementEnabled()      → 讀 BILLING_ENFORCEMENT env var、決定是否擋額度
//   - getCurrentUsage(userId)     → 本期用量（讀公版 ai_dialog_usage）+ 方案資訊
//   - checkQuotaAvailable(userId) → AI call 前「檢查 + 扣次」一步完成（公版 consume_dialog）
//   - recordUsage({ ... })        → AI call 完成後寫私版成本帳 + 回報公版 token 用量
//
// 設計紀律：
//   - 額度週期 = **訂閱起算日**（§4.4），不是每月 1 號；沒訂閱 = 公版註冊日
//   - 「一則對話」= user 一輪 + AI 一輪；扣次在 AI 回覆**之前**由 consume_dialog 原子完成
//   - 各 App 共用一池：上限 = 公版方案次數 + 本期補發，已用 = 所有 App 加總
//   - BILLING_ENFORCEMENT=false → 永遠 allow，但帳照記
//   - 開閘後拿不到公版回應 → **擋**（不再 fail-open；QUOTA-PLAN §4）
//   - 私版自己的 usage_quotas 只剩「成本帳本」的角色，不再決定能不能對話
//   - 未綁定公版（nuwa_user_id 為 null）的人：內測放行、開閘後擋（沒有額度可查）

import { supabaseAdmin } from '@/lib/supabase';
import { getMarketPlan, getMarketTrialExpiry } from '@/lib/market/plan';
import { consumeMarketDialog, getMarketQuota, recordMarketDialog } from '@/lib/market/quota';
import { shortDateLabel } from '@/lib/market/dialogPeriod';
import { reportUsageToMarket } from '@/lib/market/usage';
import { PLANS, type PlanTier, estimateOpenAICallCostTwd, getMonthlyMessageQuota, isPlanActive } from './plans';
import { postConsumeQuota, preCheckQuota, QUOTA_MESSAGES, type QuotaReason } from './quotaDecision';

// ============================================================
// Env var：是否啟用額度檢查
// ============================================================

/**
 * 是否啟用 billing enforcement（擋超量）
 * - false（預設）：內測階段、不擋、所有 user 可任意對話
 * - true：額度用完會被擋（QUOTA-PLAN 階段 4 才打開）
 */
export function isEnforcementEnabled(): boolean {
  return process.env.BILLING_ENFORCEMENT === 'true';
}

// ============================================================
// Util：私版成本帳本用的「本月 1 號」DATE 字串
// ============================================================

function getLocalCostPeriodStart(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

// ============================================================
// 公開 API
// ============================================================

export interface UserUsageInfo {
  plan: PlanTier;
  plan_label: string;
  /** 本期起算日 YYYY-MM-DD（公版週期；未綁定時退回本月 1 號） */
  period_start: string;
  /** 下次重置日 YYYY-MM-DD；未綁定為 null */
  next_reset: string | null;
  messages_used: number;
  messages_limit: number;
  messages_remaining: number;
  /** 額度數字從哪來：公版（真值）或私版本地（未綁定時的 fallback） */
  quota_source: 'market' | 'local';
  /** 私版本月 API 成本估算（成本是 App 自己關心的，仍按自然月記） */
  cost_twd_estimated: number;
  is_trial: boolean;
  trial_expires_at: string | null;
  has_payment_method: boolean;
  auto_renewal: boolean;
  pending_downgrade_plan: PlanTier | null;
  subscription_renews_at: string | null;
  cancelled_at: string | null;
}

interface UserRow {
  id: string;
  nuwa_user_id: string | null;
  current_plan: string;
  trial_started_at: string | null;
  payment_method_token: string | null;
  auto_renewal: boolean | null;
  pending_downgrade_plan: string | null;
  subscription_renews_at: string | null;
  cancelled_at: string | null;
}

async function loadUser(userId: string): Promise<UserRow> {
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('id, nuwa_user_id, current_plan, trial_started_at, payment_method_token, auto_renewal, pending_downgrade_plan, subscription_renews_at, cancelled_at')
    .eq('id', userId)
    .single();
  if (error || !user) throw new Error(`找不到 user: ${userId}`);
  return user as UserRow;
}

interface LocalCostRow {
  messages_count: number;
  cost_twd_estimated: number;
}

/** 私版成本帳本：抓當月 row、沒有就建（lazy init） */
async function loadLocalCostRow(userId: string): Promise<LocalCostRow> {
  const periodStart = getLocalCostPeriodStart();
  const { data: quota } = await supabaseAdmin
    .from('usage_quotas')
    .select('messages_count, cost_twd_estimated')
    .eq('user_id', userId)
    .eq('period_start', periodStart)
    .maybeSingle();
  if (quota) {
    return { messages_count: quota.messages_count ?? 0, cost_twd_estimated: Number(quota.cost_twd_estimated ?? 0) };
  }

  const { error: insertError } = await supabaseAdmin.from('usage_quotas').insert({
    user_id: userId,
    period_start: periodStart,
    messages_count: 0,
    tokens_input: 0,
    tokens_output: 0,
    cost_twd_estimated: 0,
  });
  if (insertError && !insertError.message.includes('duplicate key')) {
    console.error('[quotas getCurrentUsage] insert failed:', insertError);
  }
  return { messages_count: 0, cost_twd_estimated: 0 };
}

async function resolveTrialExpiry(user: UserRow, planSpec: (typeof PLANS)[PlanTier]): Promise<string | null> {
  // 試用到期日的唯一真值在公版 user_app_trials.expires_at（由 apps.trial_days 決定）
  const fromMarket = await getMarketTrialExpiry(user.nuwa_user_id);
  if (fromMarket) return fromMarket;
  if (!user.trial_started_at) return null;
  console.warn('[quotas] 讀不到公版試用到期日，fallback 用本地推算:', user.id);
  const exp = new Date(user.trial_started_at);
  exp.setDate(exp.getDate() + (planSpec.trial_days || 7));
  return exp.toISOString();
}

/**
 * 取得 user 本期用量 + 方案資訊
 * 找不到 user → throw
 */
export async function getCurrentUsage(userId: string): Promise<UserUsageInfo> {
  const user = await loadUser(userId);

  // 方案真值在公版；讀不到（未綁定 / 查詢失敗）才用私版本地值，避免對話功能中斷
  const [marketPlan, marketQuota, localCost] = await Promise.all([
    getMarketPlan(user.nuwa_user_id),
    getMarketQuota(user.nuwa_user_id),
    loadLocalCostRow(userId),
  ]);
  const plan = (marketPlan?.tier ?? user.current_plan) as PlanTier;
  const planSpec = PLANS[plan];

  const is_trial = plan === 'trial';
  const trial_expires_at = is_trial ? await resolveTrialExpiry(user, planSpec) : null;

  // 額度：公版為真值；未綁定才退回私版本地帳本 + 方案常數
  const used = marketQuota ? marketQuota.used : localCost.messages_count;
  const limit = marketQuota ? marketQuota.limit : getMonthlyMessageQuota(plan);

  return {
    plan,
    plan_label: planSpec.label,
    period_start: marketQuota?.periodStart ?? getLocalCostPeriodStart(),
    next_reset: marketQuota?.nextReset ?? null,
    messages_used: used,
    messages_limit: limit,
    messages_remaining: Math.max(0, limit - used),
    quota_source: marketQuota ? 'market' : 'local',
    cost_twd_estimated: localCost.cost_twd_estimated,
    is_trial,
    trial_expires_at,
    has_payment_method: !!user.payment_method_token,
    auto_renewal: user.auto_renewal ?? false,
    pending_downgrade_plan: (user.pending_downgrade_plan as PlanTier) ?? null,
    subscription_renews_at: user.subscription_renews_at ?? null,
    cancelled_at: user.cancelled_at ?? null,
  };
}

export interface QuotaCheckResult {
  allowed: boolean;
  reason?: QuotaReason;
  usage: UserUsageInfo;
  /** 額外的人類可讀訊息（給 API error 回傳） */
  user_message?: string;
}

function fallbackUsage(): UserUsageInfo {
  return {
    plan: 'premium',
    plan_label: '旗艦 整合與達成階段（fallback）',
    period_start: getLocalCostPeriodStart(),
    next_reset: null,
    messages_used: 0,
    messages_limit: 999_999,
    messages_remaining: 999_999,
    quota_source: 'local',
    cost_twd_estimated: 0,
    is_trial: false,
    trial_expires_at: null,
    has_payment_method: false,
    auto_renewal: false,
    pending_downgrade_plan: null,
    subscription_renews_at: null,
    cancelled_at: null,
  };
}

/** consume 之後把回傳的已用／上限套回 usage（不改原物件） */
function applyConsume(usage: UserUsageInfo, consume: { allowed: boolean; used: number; limit: number }): UserUsageInfo {
  const limit = consume.limit || usage.messages_limit;
  const used = consume.allowed ? consume.used : usage.messages_used;
  return { ...usage, messages_used: used, messages_limit: limit, messages_remaining: Math.max(0, limit - used) };
}

/**
 * AI call 前的「檢查 + 扣次」。
 *
 * 順序：
 *   1. 讀用量與方案（讀不到：內測放行、開閘擋）
 *   2. preCheckQuota：訂閱停用 / 試用到期 / 未綁定 → 開閘時擋在扣次之前
 *   3. consume_dialog（公版，原子）：超額或 RPC 失敗 → 開閘時擋；內測放行但補記
 *
 * 判斷邏輯全在 quotaDecision.ts（純函式、有測試），這裡只負責查資料與呼叫。
 */
export async function checkQuotaAvailable(userId: string): Promise<QuotaCheckResult> {
  const enforcementOn = isEnforcementEnabled();

  let usage: UserUsageInfo;
  let nuwaUserId: string | null;
  try {
    nuwaUserId = (await loadUser(userId)).nuwa_user_id;
    usage = await getCurrentUsage(userId);
  } catch (err) {
    console.error('[quotas check] getCurrentUsage failed:', err);
    if (enforcementOn) {
      return { allowed: false, reason: 'quota_check_failed', usage: fallbackUsage(), user_message: QUOTA_MESSAGES.quota_check_failed };
    }
    return { allowed: true, usage: fallbackUsage() };
  }

  const trialExpired = usage.is_trial && !!usage.trial_expires_at && new Date(usage.trial_expires_at) < new Date();
  const pre = preCheckQuota({ enforcementOn, planActive: isPlanActive(usage.plan), trialExpired, linked: !!nuwaUserId });
  if (pre) return { ...pre, usage };

  // 未綁定的人走到這裡只可能是內測：沒有公版帳號可扣，直接放行
  if (!nuwaUserId) return { allowed: true, usage };

  const consume = await consumeMarketDialog(nuwaUserId);
  const verdict = postConsumeQuota({
    enforcementOn,
    consume,
    nextResetLabel: usage.next_reset ? shortDateLabel(usage.next_reset) : null,
  });
  if (verdict.shouldRecordAnyway) await recordMarketDialog(nuwaUserId);

  return {
    allowed: verdict.allowed,
    reason: verdict.reason,
    user_message: verdict.user_message,
    usage: consume ? applyConsume(usage, consume) : usage,
  };
}

export interface RecordUsageParams {
  userId: string;
  conversationId?: string | null;
  contextType?: string | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * AI call 完成後：寫私版成本帳（精準 log + 月彙總）、回報公版 token 用量。
 * 次數不在這裡扣 —— 已由 checkQuotaAvailable 的 consume_dialog 扣過。
 * 任一步驟失敗都 log 但不 throw（不阻塞主流程）。
 */
export async function recordUsage(params: RecordUsageParams): Promise<void> {
  const { userId, conversationId, contextType, model, inputTokens, outputTokens } = params;
  const costTwd = estimateOpenAICallCostTwd(inputTokens, outputTokens);
  const periodStart = getLocalCostPeriodStart();

  // 1. 寫精準 log
  try {
    const { error: logError } = await supabaseAdmin.from('ai_usage_logs').insert({
      user_id: userId,
      conversation_id: conversationId ?? null,
      context_type: contextType ?? null,
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_twd: costTwd,
    });
    if (logError) console.error('[quotas recordUsage] log insert failed:', logError);
  } catch (err) {
    console.error('[quotas recordUsage] log unexpected error:', err);
  }

  // 2. 私版成本月彙總（read-modify-write upsert；只是成本帳本，不再決定額度）
  try {
    const { data: existing } = await supabaseAdmin
      .from('usage_quotas')
      .select('messages_count, tokens_input, tokens_output, cost_twd_estimated')
      .eq('user_id', userId)
      .eq('period_start', periodStart)
      .maybeSingle();

    const { error: upsertError } = await supabaseAdmin.from('usage_quotas').upsert(
      {
        user_id: userId,
        period_start: periodStart,
        messages_count: (existing?.messages_count || 0) + 1,
        tokens_input: (existing?.tokens_input || 0) + inputTokens,
        tokens_output: (existing?.tokens_output || 0) + outputTokens,
        cost_twd_estimated: Number(existing?.cost_twd_estimated || 0) + costTwd,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,period_start' },
    );
    if (upsertError) console.error('[quotas recordUsage] quota upsert failed:', upsertError);
  } catch (err) {
    console.error('[quotas recordUsage] quota update unexpected error:', err);
  }

  // 3. 回寫公版做跨 App token 用量歸戶（成本、不是次數）
  try {
    const { data: user } = await supabaseAdmin.from('users').select('nuwa_user_id').eq('id', userId).maybeSingle();
    await reportUsageToMarket({ nuwaUserId: user?.nuwa_user_id, inputTokens, outputTokens, costTwd });
  } catch (err) {
    console.error('[quotas recordUsage] 回寫公版用量失敗:', err);
  }
}
