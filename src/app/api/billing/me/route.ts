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
        enforcement_enabled: isEnforcementEnabled(),
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[GET /api/billing/me] failed:', message);
    return NextResponse.json<ApiResponse>(
      { data: null, error: '查詢失敗', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
