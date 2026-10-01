import { describe, expect, test } from 'vitest';
import { postConsumeQuota, preCheckQuota, quotaExceededMessage } from '../quotaDecision';

// 額度是會擋住付費使用者的東西，什麼情況擋、擋的時候說什麼，必須有測試守著。

describe('preCheckQuota —— 內測（BILLING_ENFORCEMENT 關）', () => {
  test('什麼狀況都放行，連未綁定與試用到期也放', () => {
    expect(preCheckQuota({ enforcementOn: false, planActive: false, trialExpired: true, linked: false })).toBeNull();
  });
});

describe('preCheckQuota —— 開閘', () => {
  const base = { enforcementOn: true, planActive: true, trialExpired: false, linked: true };

  test('正常付費、已綁定 → 繼續往下扣次', () => {
    expect(preCheckQuota(base)).toBeNull();
  });

  test('取消的方案 → no_active_plan', () => {
    const v = preCheckQuota({ ...base, planActive: false });
    expect(v?.reason).toBe('no_active_plan');
  });

  test('試用到期 → trial_expired，訊息引導去訂閱基本方案（不是進階）', () => {
    const v = preCheckQuota({ ...base, trialExpired: true });
    expect(v?.reason).toBe('trial_expired');
    expect(v?.user_message).toContain('基本方案');
    expect(v?.user_message).not.toContain('進階');
  });

  test('未綁公版 → not_linked（沒有公版帳號就沒有額度可查，不能放）', () => {
    const v = preCheckQuota({ ...base, linked: false });
    expect(v?.reason).toBe('not_linked');
  });

  test('順序：方案停用優先於試用到期', () => {
    const v = preCheckQuota({ ...base, planActive: false, trialExpired: true });
    expect(v?.reason).toBe('no_active_plan');
  });
});

describe('postConsumeQuota —— 開閘', () => {
  test('consume 允許 → 放行、不需補記', () => {
    const v = postConsumeQuota({ enforcementOn: true, consume: { allowed: true, limit: 50 }, nextResetLabel: '10/20' });
    expect(v).toEqual({ allowed: true, shouldRecordAnyway: false });
  });

  test('consume 拒絕 → quota_exceeded，訊息帶上限與重置日、引導去進階方案', () => {
    const v = postConsumeQuota({ enforcementOn: true, consume: { allowed: false, limit: 50 }, nextResetLabel: '10/20' });
    expect(v.allowed).toBe(false);
    expect(v.reason).toBe('quota_exceeded');
    expect(v.user_message).toContain('50 則');
    expect(v.user_message).toContain('10/20 重置');
    expect(v.user_message).toContain('進階方案');
  });

  test('RPC 失敗 → 擋（拿不到回應不偷偷放行）', () => {
    const v = postConsumeQuota({ enforcementOn: true, consume: null, nextResetLabel: null });
    expect(v.allowed).toBe(false);
    expect(v.reason).toBe('quota_check_failed');
  });
});

describe('postConsumeQuota —— 內測', () => {
  test('consume 拒絕 → 仍放行，但要補記一筆（打開閘門那天數字才對得上）', () => {
    const v = postConsumeQuota({ enforcementOn: false, consume: { allowed: false, limit: 50 }, nextResetLabel: '10/20' });
    expect(v.allowed).toBe(true);
    expect(v.shouldRecordAnyway).toBe(true);
  });

  test('RPC 失敗 → 放行、不補記', () => {
    const v = postConsumeQuota({ enforcementOn: false, consume: null, nextResetLabel: null });
    expect(v).toEqual({ allowed: true, shouldRecordAnyway: false });
  });
});

describe('quotaExceededMessage', () => {
  test('沒有重置日就不寫日期，句子仍通順', () => {
    expect(quotaExceededMessage(200, null)).toBe('本期 AI 對話次數已用完（200 則），升級到進階方案可以繼續使用。');
  });
});
