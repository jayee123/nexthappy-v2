// 訂閱扣款週期設定
//
// ★ 目前為「試用測試模式」（客戶指定）：
//   - 首刷只收 $1（卡片驗證，非真正訂閱費）→ 幾乎等於不扣款
//   - 隔 24 小時起，每天用 token 扣 $5
//   用來向客戶/同事驗證「token 定期扣款」的效果。
//
// 正式對外收費時要改回：首刷收方案月費、週期改為每月（見 plans.ts price_twd）。

/** 首刷金額（TWD）：卡片驗證用，非真正訂閱費 */
export const BIND_AMOUNT_TWD = 1

/** 每次 token 扣款金額（TWD） */
export const DAILY_CHARGE_TWD = 5

/** 扣款週期：24 小時 */
export const CHARGE_INTERVAL_MS = 24 * 60 * 60 * 1000

/** 由基準時間算出下次扣款時間（隔一個週期） */
export function nextChargeAt(from: Date): Date {
  return new Date(from.getTime() + CHARGE_INTERVAL_MS)
}
