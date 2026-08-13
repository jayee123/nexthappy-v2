/**
 * src/lib/market/users.ts
 *
 * 讀公版帳號資料（email、暱稱、方案）。
 *
 * 為什麼私版不直接用自己的 email：帳號真值在公版，私版的 happy.users.email
 * 只是 SSO 當下的快照 —— 用戶之後在公版改 email，私版不會跟著變；
 * 公版沒給 email 時 /sso 還會塞 `{nuwa_user_id}@sso.local` 的假值。
 * 後台要對帳、要跟公版對照，一律以公版為準。
 */

import { getMarketClient } from './client';

export interface MarketUserInfo {
  /** 公版 users.id（= 私版 happy.users.nuwa_user_id） */
  id: string;
  email: string | null;
  nickname: string | null;
  phone: string | null;
  currentPlan: string | null;
}

/**
 * 批次取公版帳號資料。
 * @param nuwaUserIds 私版各筆 user 的 nuwa_user_id（null / 重複會自動忽略）
 * @returns Map<nuwa_user_id, MarketUserInfo>；查詢失敗回空 Map，呼叫端 fallback 本地值
 */
export async function getMarketUsers(
  nuwaUserIds: (string | null | undefined)[],
): Promise<Map<string, MarketUserInfo>> {
  const ids = Array.from(new Set(nuwaUserIds.filter((id): id is string => Boolean(id))));
  if (ids.length === 0) return new Map();

  const { data, error } = await getMarketClient()
    .from('users')
    .select('id, email, nickname, phone, current_plan')
    .in('id', ids);

  if (error) {
    console.error('[market/users] 讀取公版帳號失敗，後台改顯示私版本地值:', error.message);
    return new Map();
  }

  return new Map(
    (data ?? []).map(u => [
      u.id as string,
      {
        id: u.id as string,
        email: (u.email as string | null) ?? null,
        nickname: (u.nickname as string | null) ?? null,
        phone: (u.phone as string | null) ?? null,
        currentPlan: (u.current_plan as string | null) ?? null,
      },
    ]),
  );
}
