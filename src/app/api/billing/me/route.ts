// 放置路徑：src/app/api/billing/me/route.ts
//
// Phase 1A：返回當前登入 user 的訂閱資訊
//
// GET /api/billing/me → { plan, plan_label, messages_used, messages_limit,
//                         messages_remaining, is_trial, trial_expires_at, ... }
//
// 用途：
//   - /settings/billing 頁面顯示「我的方案 + 額度」
//   - /chat header 顯示「剩餘 65/80 則」chip
//   - 任何前端需要展示 billing 狀態

import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getCurrentUsage, isEnforcementEnabled } from '@/lib/billing/quotas';
import type { ApiResponse } from '@/types';

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json<ApiResponse>(
      { data: null, error: '請先登入', timestamp: new Date().toISOString() },
      { status: 401 }
    );
  }

  try {
    const usage = await getCurrentUsage(session.userId);
    return NextResponse.json<ApiResponse>({
      data: {
        ...usage,
        // 內測階段告訴前端「目前不擋額度」
        enforcement_enabled: isEnforcementEnabled(),
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[GET /api/billing/me] failed:', err);
    return NextResponse.json<ApiResponse>(
      { data: null, error: '查詢失敗', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
