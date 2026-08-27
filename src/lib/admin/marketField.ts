/**
 * 後台表格中「資料來源為公版（NUWA 市集）」的欄位標示。
 *
 * 私版的後台會同時列出兩種資料：
 *   - 公版來的（帳號、手機、方案 —— 帳號與付費的真相來源，私版唯讀）
 *   - 私版自己的（學員暱稱、MBTI、課程進度 —— 私版可寫）
 *
 * 兩者混在同一張表裡，管理員很難一眼分辨哪些欄位改了沒用
 * （公版欄位在私版改不動，要去公版後台改）。用底色區隔。
 *
 * ── 為什麼是 CSS 變數而不是 Tailwind class ──────────────────
 * 顏色改成可由管理員在 /admin/settings 調整後，值是 runtime 才從 DB 取得的。
 * Tailwind 在 build 時掃描原始碼、只產生它「看得見」的 class，
 * 從 DB 讀出來的 `bg-green-50` 在任何檔案裡都不存在
 * → CSS 不會被產生 → 顏色不會生效，表頭變成沒有樣式。
 *
 * 因此改用 CSS 變數：admin layout（server component）讀 DB 後把值寫進
 * wrapper 的 style，底下的 client component 直接引用變數。
 * 好處是不經 Tailwind、不必額外打 API、也不會有預設色閃一下才變的問題。
 */
import { getSystemParams } from '@/lib/admin/systemParams';

/** system_params 的鍵名 */
export const MARKET_FIELD_BG_KEY = 'admin.market_field_bg';
export const MARKET_FIELD_FG_KEY = 'admin.market_field_fg';

/**
 * 預設配色 —— 等同 Tailwind 的 bg-blue-50 / text-blue-700。
 * DB 讀不到、值不合法、或 migration 還沒跑時都用這組，
 * 所以後台在任何情況下都不會變成沒有標示的裸表頭。
 */
export const DEFAULT_MARKET_FIELD_BG = '#EFF6FF';
export const DEFAULT_MARKET_FIELD_FG = '#1D4ED8';

/** CSS 變數名，layout 寫入、表格引用 */
export const MARKET_FIELD_BG_VAR = '--market-field-bg';
export const MARKET_FIELD_FG_VAR = '--market-field-fg';

/** 六位數 hex，例如 #EFF6FF。寫入端與讀取端共用，避免兩邊規則漂移。 */
export const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export interface MarketFieldColors {
  bg: string;
  fg: string;
}

/**
 * 從 DB 取標示配色（server 端用）。
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

/**
 * 表頭用的 style。client component 直接用這個，
 * 值來自 layout 注入的 CSS 變數；變數不存在時 fallback 到預設色。
 */
export const MARKET_FIELD_HEADER_STYLE: React.CSSProperties = {
  background: `var(${MARKET_FIELD_BG_VAR}, ${DEFAULT_MARKET_FIELD_BG})`,
  color: `var(${MARKET_FIELD_FG_VAR}, ${DEFAULT_MARKET_FIELD_FG})`,
};

// ── 對比度（WCAG 2.1）────────────────────────────────────────
// 讓管理員自由選色，就有可能選出看不清的組合。不擋，但要提醒。

/** sRGB 相對亮度，WCAG 定義 */
function relativeLuminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

/**
 * 兩色的對比度，1（相同）～ 21（黑白）。
 * WCAG AA 對一般文字要求 4.5，大字（≥18.66px 粗體或 24px）要求 3。
 * 表頭是 14px 的 font-medium，適用 4.5。
 */
export function contrastRatio(hexA: string, hexB: string): number {
  if (!HEX_COLOR_PATTERN.test(hexA) || !HEX_COLOR_PATTERN.test(hexB)) return 1;
  const a = relativeLuminance(hexA);
  const b = relativeLuminance(hexB);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

export const WCAG_AA_NORMAL_TEXT = 4.5;
