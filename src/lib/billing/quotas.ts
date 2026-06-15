// 放置路徑：src/lib/billing/quotas.ts
//
// Phase 1A：用量配額追蹤 helpers
//
// 公開的 helper：
//   - isEnforcementEnabled()      → 讀 BILLING_ENFORCEMENT env var、決定是否擋額度
//   - getCurrentUsage(userId)     → 抓 user 當月用量（含方案上限）
//   - checkQuotaAvailable(userId) → 進 AI call 前 check、回傳 { allowed, ...info }
//   - recordUsage({ ... })        → AI call 完成後寫 log + 更新 quota
//
// 設計紀律：
//   - 額度週期 = 自然月（每月 1 號 00:00 重置）
//   - 「一則對話」= user 一輪 + AI 一輪 = 每次 AI 成功回覆 +1
//   - BILLING_ENFORCEMENT=false → checkQuotaAvailable 永遠 allow（但 usage log 還是寫）
//   - 失敗（譬如 DB error）不阻塞主流程、log 後 fail-open allow

import { supabaseAdmin } from '@/lib/supabase';
import { PLANS, type PlanTier, estimateClaudeCallCostTwd, getMonthlyMessageQuota, isPlanActive } from './plans';

// ============================================================
// Env var：是否啟用額度檢查
// ============================================================

/**
 * 是否啟用 billing enforcement（擋超量）
 * - false（預設）：內測階段、不擋、所有 user 可任意對話
 * - true：Jeff 接好金流後翻 true、額度用完會被擋
 */
export function isEnforcementEnabled(): boolean {
  return process.env.BILLING_ENFORCEMENT === 'true';
}

// ============================================================
// Util：取得「本月 1 號」DATE 字串（給 PG DATE 欄位）
// ============================================================

function getCurrentPeriodStart(): string {
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
  period_start: string;
  messages_used: number;
  messages_limit: number;
  messages_remaining: number;
  cost_twd_estimated: number;
  /** 是否處於試用期、true = 用 trial 額度 */
  is_trial: boolean;
  /** trial 到期日（若是 trial）*/
  trial_expires_at: string | null;
}

/**
 * 取得 user 當月用量 + 方案資訊
 * 找不到 user → throw
 * 該月還沒 row → 自動建一筆 zero quota（lazy init）
 */
export async function getCurrentUsage(userId: string): Promise<UserUsageInfo> {
  // 抓 user 方案 + trial 資訊
  const { data: user, error: userError } = await supabaseAdmin
    .from('users')
    .select('id, current_plan, trial_started_at')
    .eq('id', userId)
    .single();

  if (userError || !user) {
    throw new Error(`找不到 user: ${userId}`);
  }

  const plan = user.current_plan as PlanTier;
  const planSpec = PLANS[plan];
  const periodStart = getCurrentPeriodStart();

  // 抓當月 quota row、沒有就建
  let { data: quota } = await supabaseAdmin
    .from('usage_quotas')
    .select('messages_count, cost_twd_estimated')
    .eq('user_id', userId)
    .eq('period_start', periodStart)
    .maybeSingle();

  if (!quota) {
    // Lazy create（不阻塞、INSERT 失敗仍給預設值）
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
    quota = { messages_count: 0, cost_twd_estimated: 0 };
  }

  // Trial 資訊
  const is_trial = plan === 'trial';
  let trial_expires_at: string | null = null;
  if (is_trial && user.trial_started_at) {
    const exp = new Date(user.trial_started_at);
    exp.setDate(exp.getDate() + (planSpec.trial_days || 7));
    trial_expires_at = exp.toISOString();
  }

  const limit = getMonthlyMessageQuota(plan);
  const used = quota.messages_count || 0;

  return {
    plan,
    plan_label: planSpec.label,
    period_start: periodStart,
    messages_used: used,
    messages_limit: limit,
    messages_remaining: Math.max(0, limit - used),
    cost_twd_estimated: Number(quota.cost_twd_estimated || 0),
    is_trial,
    trial_expires_at,
  };
}

export interface QuotaCheckResult {
  allowed: boolean;
  reason?: 'no_active_plan' | 'monthly_quota_exceeded' | 'trial_expired';
  usage: UserUsageInfo;
  /** 額外的人類可讀訊息（給 API error 回傳） */
  user_message?: string;
}

/**
 * AI call 前 check user 是否有額度
 * - BILLING_ENFORCEMENT=false 永遠 allow
 * - 取消的 plan 不 allow
 * - 月額度用完不 allow
 * - Trial 過期不 allow
 *
 * 注意：DB error 時 fail-open allow（避免擋住 user）
 */
export async function checkQuotaAvailable(userId: string): Promise<QuotaCheckResult> {
  let usage: UserUsageInfo;
  try {
    usage = await getCurrentUsage(userId);
  } catch (err) {
    console.error('[quotas check] getCurrentUsage failed, fail-open:', err);
    // Fail-open：允許繼續、但回一個假 usage struct
    return {
      allowed: true,
      usage: {
        plan: 'premium',
        plan_label: 'Premium 整合（fallback）',
        period_start: getCurrentPeriodStart(),
        messages_used: 0,
        messages_limit: 999_999,
        messages_remaining: 999_999,
        cost_twd_estimated: 0,
        is_trial: false,
        trial_expires_at: null,
      },
    };
  }

  // BILLING_ENFORCEMENT=false → 永遠 allow（內測模式）
  if (!isEnforcementEnabled()) {
    return { allowed: true, usage };
  }

  // Cancelled 方案不 allow
  if (!isPlanActive(usage.plan)) {
    return {
      allowed: false,
      reason: 'no_active_plan',
      usage,
      user_message: '你的訂閱已停用、請重新訂閱以繼續使用 AI 對話。',
    };
  }

  // Trial 過期 check
  if (usage.is_trial && usage.trial_expires_at) {
    const exp = new Date(usage.trial_expires_at);
    if (exp < new Date()) {
      return {
        allowed: false,
        reason: 'trial_expired',
        usage,
        user_message: '7 天免費試用已結束、請選擇訂閱方案以繼續使用。',
      };
    }
  }

  // 月額度用完 check
  if (usage.messages_remaining <= 0) {
    return {
      allowed: false,
      reason: 'monthly_quota_exceeded',
      usage,
      user_message: `本月 ${usage.plan_label} 方案 ${usage.messages_limit} 則對話額度已用完、升級享更多、或下月 1 號重置。`,
    };
  }

  return { allowed: true, usage };
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
 * AI call 完成後寫 log + 累加 quota
 * 任一步驟失敗都 log 但不 throw（不阻塞主流程）
 */
export async function recordUsage(params: RecordUsageParams): Promise<void> {
  const { userId, conversationId, contextType, model, inputTokens, outputTokens } = params;
  const costTwd = estimateClaudeCallCostTwd(inputTokens, outputTokens);
  const periodStart = getCurrentPeriodStart();

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
    if (logError) {
      console.error('[quotas recordUsage] log insert failed:', logError);
    }
  } catch (err) {
    console.error('[quotas recordUsage] log unexpected error:', err);
  }

  // 2. 累加 quota（read-modify-write upsert）
  //    Phase 1A 單 user low concurrency、可接受小 race 風險
  //    將來 user 多 + 高並發、再 migrate 到 SQL function atomic increment
  try {
    const { data: existing } = await supabaseAdmin
      .from('usage_quotas')
      .select('messages_count, tokens_input, tokens_output, cost_twd_estimated')
      .eq('user_id', userId)
      .eq('period_start', periodStart)
      .maybeSingle();

    const newCount = (existing?.messages_count || 0) + 1;
    const newInput = (existing?.tokens_input || 0) + inputTokens;
    const newOutput = (existing?.tokens_output || 0) + outputTokens;
    const newCost = Number(existing?.cost_twd_estimated || 0) + costTwd;

    const { error: upsertError } = await supabaseAdmin
      .from('usage_quotas')
      .upsert(
        {
          user_id: userId,
          period_start: periodStart,
          messages_count: newCount,
          tokens_input: newInput,
          tokens_output: newOutput,
          cost_twd_estimated: newCost,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,period_start' }
      );

    if (upsertError) {
      console.error('[quotas recordUsage] quota upsert failed:', upsertError);
    }
  } catch (err) {
    console.error('[quotas recordUsage] quota update unexpected error:', err);
  }
}
