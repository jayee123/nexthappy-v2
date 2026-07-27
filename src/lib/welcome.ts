/**
 * src/lib/welcome.ts
 *
 * /welcome 5 頁導引相關的客戶端 helpers。
 *
 * 用 localStorage 記錄「has_seen_intro」、給以下場景判斷用：
 * - 未來想做「沒看過就強推 /welcome」的 client-side logic
 * - Settings 等地方判斷狀態
 *
 * 抽到 lib 是為了符合 Next.js App Router 限制：
 * page.tsx 不能 export 自訂函式（只允許 default + 規定的 metadata 等）。
 */

const STORAGE_KEY = 'has_seen_intro';

/**
 * 標記用戶已看過導引頁
 */
export function markIntroSeen(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, 'true');
  } catch {
    // localStorage 不可用（隱私模式 / 滿載）→ silently ignore
  }
}

/**
 * 查詢用戶是否已看過導引頁
 */
export function hasSeenIntro(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}
