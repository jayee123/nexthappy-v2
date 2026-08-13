// 放置路徑：src/app/api/auth/login/route.ts
//
// 私版沒有自己的登入。帳號真值在公版（NUWA），session 由 /sso 在驗過
// Market 簽發的 token 之後建立，所以這裡不再提供 POST 密碼登入
// （SSO 建立的帳號 password_hash 是隨機值，本來就無法用密碼登入）。
//
// 只保留 DELETE：登出時清掉私版自己發的 happy_session。

import { NextResponse } from 'next/server';
import { COOKIE_NAME } from '@/lib/auth';
import type { ApiResponse } from '@/types';

export async function DELETE() {
  const response = NextResponse.json<ApiResponse>({
    data: { success: true },
    error: null,
    timestamp: new Date().toISOString(),
  });

  response.cookies.delete(COOKIE_NAME);
  return response;
}
