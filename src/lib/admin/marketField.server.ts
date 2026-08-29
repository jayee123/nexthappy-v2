/**
 * 公版欄位標示配色 —— 需要讀 DB 的部分。**只能由 server component / API route 引用。**
 *
 * ⚠️ 為什麼要跟 marketField.ts 分開：
 *   這支會 import supabaseAdmin（service_role client），它在 module 載入時就
 *   呼叫 createClient()。瀏覽器裡 SUPABASE_SERVICE_ROLE_KEY 是 undefined
 *   （Next.js 只把 NEXT_PUBLIC_* 注入 client bundle），createClient 直接 throw
 *   → 整頁白畫面。
 *
 *   2026-08-27 就是這樣把 /admin/users 弄壞的：那頁是 'use client'，
 *   卻 import 了同時含有常數與 DB 讀取的 marketField.ts，
 *   整條 supabaseAdmin 依賴鏈被打包進 client。
 *
 *   （金鑰本身沒有外洩 —— 非 NEXT_PUBLIC_ 的環境變數不會被注入 client bundle，
 *     實測 client 檔案裡找不到金鑰值。壞的是模組初始化，不是機密。）
 *
 *   檔名的 .server 後綴就是提醒 —— 在 client component 裡看到這個 import 就是錯的。
 *   （官方的 `server-only` 套件能讓這種錯誤在 build 期直接報錯，
 *     但那要新增依賴，等有需要時再一起評估。）
 */
import { getSystemParams } from '@/lib/admin/systemParams';
import {
  MARKET_FIELD_BG_KEY,
  MARKET_FIELD_FG_KEY,
  DEFAULT_MARKET_FIELD_BG,
  DEFAULT_MARKET_FIELD_FG,
  HEX_COLOR_PATTERN,
  type MarketFieldColors,
} from '@/lib/admin/marketField';

/**
 * 從 DB 取標示配色。
 *
 * 讀出來的值仍會過一次格式檢查 —— 寫入端雖然擋過，但 DB 也可能被
 * 直接改（Supabase console、SQL），不能假設裡面一定乾淨。
 * 不合法就當作沒設定、用預設值。
 */
export async function getMarketFieldColors(): Promise<MarketFieldColors> {
  const params = await getSystemParams([MARKET_FIELD_BG_KEY, MARKET_FIELD_FG_KEY]);

  const pick = (key: string, fallback: string) => {
    const v = params.get(key);
    return v && HEX_COLOR_PATTERN.test(v) ? v : fallback;
  };

  return {
    bg: pick(MARKET_FIELD_BG_KEY, DEFAULT_MARKET_FIELD_BG),
    fg: pick(MARKET_FIELD_FG_KEY, DEFAULT_MARKET_FIELD_FG),
  };
}
