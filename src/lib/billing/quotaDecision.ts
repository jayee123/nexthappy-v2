// 放置路徑：src/lib/billing/quotaDecision.ts
//
// 額度判斷的**純函式**部分（不碰 DB），讓 quotas.ts 只剩「查資料 → 交給這裡判斷」。
// 所有「什麼情況擋、什麼情況放、擋的時候說什麼」都在這一檔，單元測試釘死。
//
// 兩段式：
//   preCheckQuota   —— AI 呼叫前、扣次之前：訂閱狀態、試用到期、有沒有綁公版
//   postConsumeQuota —— consume_dialog 回來之後：超額、RPC 失敗
//
// BILLING_ENFORCEMENT 關著（內測）時一律放行，但帳照記（見 shouldRecordAnyway）。

export type QuotaReason =
  | 'no_active_plan'
  | 'trial_expired'
  | 'not_linked'
  | 'quota_exceeded'
  | 'quota_check_failed';

export interface QuotaVerdict {
  allowed: boolean;
  reason?: QuotaReason;
  /** 給 API 回傳、使用者看得到的一句話 */
  user_message?: string;
}

export const QUOTA_MESSAGES: Record<QuotaReason, string> = {
  no_active_plan: '你的訂閱已停用，請重新訂閱以繼續使用 AI 對話。',
  // 4.6：試用到期 = 擋在 App 門口，引導去「訂閱基本方案以上」
  trial_expired: '試用已結束，訂閱基本方案以上即可繼續使用。',
  not_linked: '這個帳號還沒和 NUWA 平台連結，請從 NUWA 平台重新進入 App。',
  // 4.6：額度用完 = 只擋 AI 對話，引導去「進階方案」（買的是次數）。
  // 跟試用到期刻意分開 —— 使用者看到錯的訊息會去買錯的東西。
  quota_exceeded: '本期 AI 對話次數已用完，升級到進階方案可以繼續使用。',
  quota_check_failed: '額度服務暫時無法使用，請稍後再試。',
};

export interface PreCheckInput {
  enforcementOn: boolean;
  planActive: boolean;
  trialExpired: boolean;
  /** happy.users.nuwa_user_id 有值 */
  linked: boolean;
}

/**
 * 扣次前的守門。回 null 表示可以繼續往下（去 consume）。
 * 內測（enforcementOn=false）永遠回 null。
 */
export function preCheckQuota(i: PreCheckInput): QuotaVerdict | null {
  if (!i.enforcementOn) return null;
  if (!i.planActive) return { allowed: false, reason: 'no_active_plan', user_message: QUOTA_MESSAGES.no_active_plan };
  if (i.trialExpired) return { allowed: false, reason: 'trial_expired', user_message: QUOTA_MESSAGES.trial_expired };
  if (!i.linked) return { allowed: false, reason: 'not_linked', user_message: QUOTA_MESSAGES.not_linked };
  return null;
}

export interface PostConsumeInput {
  enforcementOn: boolean;
  /** consume_dialog 的結果；RPC 失敗為 null */
  consume: { allowed: boolean; limit: number } | null;
  /** 'M/D'；拿不到就不寫日期 */
  nextResetLabel: string | null;
}

export interface PostConsumeVerdict extends QuotaVerdict {
  /** 內測期被 consume 拒絕仍要放行 → 呼叫端要另外 record_dialog 把帳記上 */
  shouldRecordAnyway: boolean;
}

/**
 * consume_dialog 回來之後的判斷。
 * - RPC 失敗：開閘時**擋**（拿不到回應不偷偷放行，QUOTA-PLAN §4）；內測放
 * - 超額：開閘時擋，附上限與重置日；內測放，但要補記一筆
 * - 允許：放（consume 已經扣過）
 */
export function postConsumeQuota(i: PostConsumeInput): PostConsumeVerdict {
  if (!i.consume) {
    if (i.enforcementOn) {
      return { allowed: false, reason: 'quota_check_failed', user_message: QUOTA_MESSAGES.quota_check_failed, shouldRecordAnyway: false };
    }
    return { allowed: true, shouldRecordAnyway: false };
  }
  if (!i.consume.allowed) {
    if (i.enforcementOn) {
      return { allowed: false, reason: 'quota_exceeded', user_message: quotaExceededMessage(i.consume.limit, i.nextResetLabel), shouldRecordAnyway: false };
    }
    return { allowed: true, shouldRecordAnyway: true };
  }
  return { allowed: true, shouldRecordAnyway: false };
}

export function quotaExceededMessage(limit: number, nextResetLabel: string | null): string {
  const reset = nextResetLabel ? `${nextResetLabel} 重置；` : '';
  return `本期 AI 對話次數已用完（${limit} 則），${reset}升級到進階方案可以繼續使用。`;
}
