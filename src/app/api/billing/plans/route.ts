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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[GET /api/billing/plans] failed:', message);
    return NextResponse.json<ApiResponse>(
      { data: null, error: '查詢失敗', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
