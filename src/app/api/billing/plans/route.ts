// 放置路徑：src/app/api/billing/plans/route.ts
//
// Phase 1A：返回所有可訂閱方案 spec
//
// GET /api/billing/plans → { plans: [basic, advanced, premium], current_plan }
//
// 用途：
//   - /settings/billing 頁面、列出三方案讓 user 選

import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { PLANS, PURCHASABLE_PLANS, type PlanTier } from '@/lib/billing/plans';
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
    // 抓 user 當前方案
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('current_plan')
      .eq('id', session.userId)
      .single();

    const plans = PURCHASABLE_PLANS.map(tier => PLANS[tier]);

    return NextResponse.json<ApiResponse>({
      data: {
        plans,
        current_plan: (user?.current_plan as PlanTier) ?? 'trial',
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[GET /api/billing/plans] failed:', err);
    return NextResponse.json<ApiResponse>(
      { data: null, error: '查詢失敗', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
