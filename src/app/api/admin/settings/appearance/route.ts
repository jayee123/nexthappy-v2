// 放置路徑：src/app/api/admin/settings/appearance/route.ts
//
// 後台外觀設定：公版欄位的標示配色。
//
// GET  → 目前配色（DB 沒設或值不合法時回預設色）
// PUT  → 寫入新配色，body: { bg: '#RRGGBB', fg: '#RRGGBB' }
//
// 為什麼要在這裡驗 hex：
//   這兩個值最後會進到 CSS 變數、直接套在 style 上。
//   若不限制格式，寫進來的字串會被當成 CSS 值解讀
//   （例如 `red; background-image: url(...)` 這類）。
//   限制成六位數 hex 之後，能寫進去的只剩顏色，沒有其他 CSS 語法的空間。

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { getSystemParams, setSystemParams } from '@/lib/admin/systemParams';
import {
  MARKET_FIELD_BG_KEY,
  MARKET_FIELD_FG_KEY,
  DEFAULT_MARKET_FIELD_BG,
  DEFAULT_MARKET_FIELD_FG,
  HEX_COLOR_PATTERN,
} from '@/lib/admin/marketField';
import type { ApiResponse } from '@/types';

interface AppearanceSettings {
  bg: string;
  fg: string;
}

const ok = (data: AppearanceSettings) =>
  NextResponse.json<ApiResponse>({ data, error: null, timestamp: new Date().toISOString() });

const fail = (message: string, status: number) =>
  NextResponse.json<ApiResponse>(
    { data: null, error: message, timestamp: new Date().toISOString() },
    { status }
  );

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;

  const params = await getSystemParams([MARKET_FIELD_BG_KEY, MARKET_FIELD_FG_KEY]);
  const pick = (key: string, fallback: string) => {
    const v = params.get(key);
    return v && HEX_COLOR_PATTERN.test(v) ? v : fallback;
  };

  return ok({
    bg: pick(MARKET_FIELD_BG_KEY, DEFAULT_MARKET_FIELD_BG),
    fg: pick(MARKET_FIELD_FG_KEY, DEFAULT_MARKET_FIELD_FG),
  });
}

export async function PUT(request: NextRequest) {
  const { error: authError, session } = await requireAdmin(request);
  if (authError) return authError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail('請求內容不是合法的 JSON', 400);
  }

  const { bg, fg } = (body ?? {}) as Partial<AppearanceSettings>;

  if (typeof bg !== 'string' || !HEX_COLOR_PATTERN.test(bg)) {
    return fail('底色格式不正確，需為 #RRGGBB（六位數 hex）', 400);
  }
  if (typeof fg !== 'string' || !HEX_COLOR_PATTERN.test(fg)) {
    return fail('文字色格式不正確，需為 #RRGGBB（六位數 hex）', 400);
  }

  // 統一存成大寫，避免同一個顏色因大小寫不同看起來像被改過
  const normalizedBg = bg.toUpperCase();
  const normalizedFg = fg.toUpperCase();

  const { error: writeError } = await setSystemParams(
    [
      { key: MARKET_FIELD_BG_KEY, value: normalizedBg },
      { key: MARKET_FIELD_FG_KEY, value: normalizedFg },
    ],
    session!.userId
  );

  if (writeError) return fail('儲存失敗，請稍後再試', 500);

  return ok({ bg: normalizedBg, fg: normalizedFg });
}
