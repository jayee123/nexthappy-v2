/**
 * src/lib/market/dialogPeriod.ts
 *
 * AI 對話額度的週期計算 —— 與公版 nuwa/v2 `src/lib/dialog-period.ts` **逐字相同**，
 * SQL 版 `dialog_period_start()`（公版 migration 030）也照同一套規則。
 * 三份行為必須一致；這份有單元測試釘死，改任何一邊都要同步另外兩邊。
 *
 * 週期從「錨點日」起算，不是每月 1 號（Steve §4.4）：月底訂閱的人第一個月
 * 不會只拿到幾天。錨點 = 有效訂閱的 starts_at；沒有訂閱 = 公版註冊日。
 *
 * 規則：
 *   - 以**台灣時間的日曆日**計算（使用者看到的「10/20 重置」是台灣的 10/20）
 *   - 錨點日在某月不存在（31 號遇到 30 天的月、2 月）→ 取該月最後一天，
 *     但只影響那一個月：2/28 那期之後回到 3/31，不會永久往前挪
 */

const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;

interface YMD {
  y: number;
  m: number; // 1–12
  d: number;
}

function toTaipeiYMD(date: Date): YMD {
  const t = new Date(date.getTime() + TAIPEI_OFFSET_MS);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** 某年某月的錨點日；該月沒有那一天就取月底。 */
function anchorIn(y: number, m: number, anchorDay: number): YMD {
  return { y, m, d: Math.min(anchorDay, daysInMonth(y, m)) };
}

function addMonths(y: number, m: number, delta: number): { y: number; m: number } {
  const idx = y * 12 + (m - 1) + delta;
  return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
}

function compare(a: YMD, b: YMD): number {
  return a.y - b.y || a.m - b.m || a.d - b.d;
}

function fmt({ y, m, d }: YMD): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export interface DialogPeriod {
  /** 本期起算日（含），YYYY-MM-DD，對應公版 ai_dialog_usage.period_start */
  start: string;
  /** 下次重置日（本期結束的隔一期起點），YYYY-MM-DD —— 畫面上「10/20 重置」用這個 */
  nextReset: string;
}

export function dialogPeriod(anchor: Date, now: Date): DialogPeriod {
  const a = toTaipeiYMD(anchor);
  const today = toTaipeiYMD(now);

  // 資料異常（錨點在未來）：不回傳比錨點更早的期
  if (compare(today, a) < 0) {
    const next = addMonths(a.y, a.m, 1);
    return { start: fmt(a), nextReset: fmt(anchorIn(next.y, next.m, a.d)) };
  }

  const thisMonth = anchorIn(today.y, today.m, a.d);
  const startMonth =
    compare(thisMonth, today) <= 0 ? { y: today.y, m: today.m } : addMonths(today.y, today.m, -1);
  const start = anchorIn(startMonth.y, startMonth.m, a.d);
  const next = addMonths(startMonth.y, startMonth.m, 1);

  return { start: fmt(start), nextReset: fmt(anchorIn(next.y, next.m, a.d)) };
}

/** 'YYYY-MM-DD' → 'M/D'（畫面用，例如「10/20 重置」） */
export function shortDateLabel(ymd: string): string {
  const [, m, d] = ymd.split('-');
  return `${Number(m)}/${Number(d)}`;
}
