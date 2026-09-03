/**
 * 方案代碼 → 顯示名（私版）。
 *
 * ── 為什麼要有這一份 ────────────────────────────────────
 *
 * 語言規則（AI-COLLABORATION §7.6）：
 *   UI 給人看的字一律繁體中文；DB 欄位、程式變數、方案代碼一律英文小寫。
 *
 * 在這一份出現之前，同一個 premium 在私版就有三個來源：
 *   admin/users          直接渲染 market_plan → 畫面上是 free / premium
 *   admin/subscriptions  PLAN_META            → Basic / Advanced / Premium
 *   lib/billing/plans    label                → 「Basic 啟動練習階段」
 * 加上公版還有兩份，使用者在不同畫面看到同一個方案有四種寫法。
 *
 * ── 為什麼一份對照要同時涵蓋兩套值域 ──────────────────────
 *
 * 私版後台同時顯示兩邊的方案：
 *   私版 happy.users.current_plan  : trial / basic / advanced / premium / cancelled
 *   公版 public.users.current_plan : free / basic / advanced / premium
 *                                    （學員管理的「方案」欄，經 market/users.ts 取回）
 *
 * 兩套值域只有 free 與 trial 不重疊，其餘同名。收成一份最不容易漏。
 */

/** 短標籤：badge、表格、下拉。對齊公版 lib/plans.ts 的 PLAN_LABEL。 */
export const PLAN_LABEL: Record<string, string> = {
  // 公版才有
  free: '免費',
  // 私版才有
  trial: '試用',
  cancelled: '已取消',
  // 兩邊都有
  basic: '基本',
  advanced: '進階',
  premium: '旗艦',
};

/**
 * 認不得的代碼**原樣回傳**，不要換成「未知」之類的字。
 *
 * 那是刻意的：兩套值域混用時（例如私版的 trial 流進公版的欄位），
 * 直接把原碼露在畫面上，比顯示一個看似正常的字更容易被發現。
 * 公版 dev-seed 把 dev5 的 current_plan 寫成 'cancelled' 就是這樣被抓到的。
 */
export function planLabel(code: string | null | undefined): string {
  if (!code) return '—';
  return PLAN_LABEL[code] ?? code;
}
