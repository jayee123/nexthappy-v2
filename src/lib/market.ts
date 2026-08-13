/**
 * src/lib/market.ts
 *
 * NUWA 公版（Market）對外連結。
 *
 * #3a 之後私版不再自行註冊：帳號真值只有公版一份，私版帳號一律由
 * Market → /sso 的 token handoff 建立（見 src/app/sso/route.ts）。
 * 所有「去註冊」的入口都指向這裡，避免網址散落在各個 component。
 */

export const MARKET_BASE_URL = 'https://next.nuwa.chg2asc.com';

/** 公版註冊頁（需邀請碼，見 nuwa/v2 register/actions.ts） */
export const MARKET_REGISTER_URL = `${MARKET_BASE_URL}/register`;

/** 公版訂閱管理 —— 付費一律在公版，私版只讀方案（見 src/lib/market/plan.ts） */
export const MARKET_SUBSCRIBE_URL = `${MARKET_BASE_URL}/dashboard/subscribe`;
