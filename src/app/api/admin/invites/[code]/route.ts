// 放置路徑：src/app/api/admin/invites/[code]/route.ts
//
// PATCH /api/admin/invites/<code> → 410：停用功能已移除
//
// 2026-09：邀請碼一律由公版發放與管理（金流與試用架構定案 §01/§06），
// 私版不再提供停用。回 410 而不是刪掉整條 route，
// 是為了讓還開著舊頁面的人得到明確訊息，而非 404 誤判成部署壞了。
// 舊的停用實作（available 狀態檢查 + expires_at=NOW + audit log）在 git 歷史裡。

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import type { ApiResponse } from '@/types';

export async function PATCH(request: NextRequest) {
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;

  return NextResponse.json<ApiResponse>(
    {
      data: null,
      error: '邀請碼已改由公版後台統一管理，私版停用功能已移除',
      timestamp: new Date().toISOString(),
    },
    { status: 410 }
  );
}
