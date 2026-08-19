/**
 * src/lib/market.ts
 *
 * NUWA 公版（Market）對外連結。
 *
 * #3a 之後私版不再自行註冊：帳號真值只有公版一份，私版帳號一律由
 * Market → /sso 的 token handoff 建立（見 src/app/sso/route.ts）。
 * 所有「去註冊」的入口都指向這裡，避免網址散落在各個 component。
 */

/**
 * 公版站台網址。
 *
 * 本機整合開發時，公版與私版都跑在 localhost（公版 :3000 / 私版 :3001），
 * 硬寫正式站網址會讓本機一登出就被彈到正式站、再也回不來。
 * 因此允許用環境變數覆寫；正式站不設這個變數，行為與過去完全相同。
 *
 * ⚠️ 必須是 NEXT_PUBLIC_ 前綴 —— 這個常數有四處在瀏覽器端使用
 *   （Sidebar / AdminSidebar / progress / chat 的 window.location 與 <a href>），
 *   少了前綴瀏覽器會拿到 undefined，登出按鈕會直接壞掉。
 *
 * ⚠️ NEXT_PUBLIC_* 在 build 時寫死進 bundle。本機設成 localhost 之後，
 *   不要拿本機的 build 產物去部署。
 */
export const MARKET_BASE_URL =
  process.env.NEXT_PUBLIC_MARKET_BASE_URL ?? 'https://next.nuwa.chg2asc.com';

/** 公版註冊頁（需邀請碼，見 nuwa/v2 register/actions.ts） */
export const MARKET_REGISTER_URL = `${MARKET_BASE_URL}/register`;

/**
 * 公版登入頁 —— 私版不再有自己的登入入口。
 * 登入後從公版「App 服務」進來，由 /sso 建立私版 session。
 */
export const MARKET_LOGIN_URL = `${MARKET_BASE_URL}/login`;

/** 公版訂閱管理 —— 付費一律在公版，私版只讀方案（見 src/lib/market/plan.ts） */
export const MARKET_SUBSCRIBE_URL = `${MARKET_BASE_URL}/dashboard/subscribe`;
