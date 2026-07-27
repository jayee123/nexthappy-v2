// 放置路徑：src/app/api/admin/subscriptions/[userId]/route.ts
//
// Phase 1A：admin 手動調整 user 訂閱方案
//
// PATCH /api/admin/subscriptions/<userId>
//   body: { current_plan?: PlanTier, auto_renewal?: boolean, start_trial?: boolean, cancel?: boolean }
//
// 用途：
//   - admin 手動 grant trial / change plan / cancel / restore
//   - 內測階段所有 plan 變動都在這操作（Jeff 接好金流後改自動）

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { logAdminAction } from '@/lib/admin/auditLog';
import { supabaseAdmin } from '@/lib/supabase';
import type { PlanTier } from '@/lib/billing/plans';
import type { ApiResponse } from '@/types';

const VALID_PLANS: PlanTier[] = ['trial', 'basic', 'advanced', 'premium', 'cancelled'];

interface PatchBody {
  current_plan?: unknown;
  auto_renewal?: unknown;
  start_trial?: unknown;
  cancel?: unknown;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  const { error: authError, adminUser } = await requireAdmin(request);
  if (authError) return authError;
  if (!adminUser) {
    return NextResponse.json<ApiResponse>(
      { data: null, error: '無法識別 admin', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }

  const userId = params.userId;
  if (!userId) {
    return NextResponse.json<ApiResponse>(
      { data: null, error: '缺少 userId', timestamp: new Date().toISOString() },
      { status: 400 }
    );
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json<ApiResponse>(
      { data: null, error: 'JSON 解析失敗', timestamp: new Date().toISOString() },
      { status: 400 }
    );
  }

  try {
    // 抓 before snapshot
    const { data: before, error: beforeError } = await supabaseAdmin
      .from('users')
      .select('id, email, current_plan, trial_started_at, auto_renewal, cancelled_at')
      .eq('id', userId)
      .maybeSingle();

    if (beforeError || !before) {
      return NextResponse.json<ApiResponse>(
        { data: null, error: '找不到 user', timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    const updates: Record<string, unknown> = {};
    const auditBefore: Record<string, unknown> = {};
    const auditAfter: Record<string, unknown> = {};

    // 1. current_plan 變更
    if (typeof body.current_plan === 'string' && body.current_plan !== '') {
      if (!VALID_PLANS.includes(body.current_plan as PlanTier)) {
        return NextResponse.json<ApiResponse>(
          { data: null, error: `無效方案：${body.current_plan}`, timestamp: new Date().toISOString() },
          { status: 400 }
        );
      }
      if (body.current_plan !== before.current_plan) {
        updates.current_plan = body.current_plan;
        auditBefore.current_plan = before.current_plan;
        auditAfter.current_plan = body.current_plan;
      }
    }

    // 2. auto_renewal toggle
    if (typeof body.auto_renewal === 'boolean') {
      if (body.auto_renewal !== before.auto_renewal) {
        updates.auto_renewal = body.auto_renewal;
        auditBefore.auto_renewal = before.auto_renewal;
        auditAfter.auto_renewal = body.auto_renewal;
      }
    }

    // 3. start_trial：把 trial_started_at 設為 NOW、current_plan = 'trial'
    if (body.start_trial === true) {
      const now = new Date().toISOString();
      updates.current_plan = 'trial';
      updates.trial_started_at = now;
      updates.cancelled_at = null;
      auditBefore.trial_started_at = before.trial_started_at;
      auditAfter.trial_started_at = now;
      auditBefore.current_plan = before.current_plan;
      auditAfter.current_plan = 'trial';
    }

    // 4. cancel：current_plan = 'cancelled'、cancelled_at = NOW
    if (body.cancel === true) {
      const now = new Date().toISOString();
      updates.current_plan = 'cancelled';
      updates.cancelled_at = now;
      updates.auto_renewal = false;
      auditBefore.current_plan = before.current_plan;
      auditAfter.current_plan = 'cancelled';
      auditBefore.cancelled_at = before.cancelled_at;
      auditAfter.cancelled_at = now;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json<ApiResponse>(
        { data: null, error: '沒有任何欄位要更新', timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    updates.updated_at = new Date().toISOString();

    const { data: after, error: updateError } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select(
        'id, email, current_plan, trial_started_at, subscription_started_at, subscription_renews_at, auto_renewal, cancelled_at'
      )
      .single();

    if (updateError || !after) {
      console.error('[PATCH /api/admin/subscriptions] update failed:', updateError);
      return NextResponse.json<ApiResponse>(
        { data: null, error: '更新失敗', timestamp: new Date().toISOString() },
        { status: 500 }
      );
    }

    // Audit log
    let action = 'subscription.update';
    if (body.start_trial === true) action = 'subscription.start_trial';
    else if (body.cancel === true) action = 'subscription.cancel';
    else if ('current_plan' in auditAfter) action = 'subscription.change_plan';

    await logAdminAction({
      request,
      adminUserId: adminUser.id,
      action,
      targetType: 'subscription',
      targetId: userId,
      before: auditBefore,
      after: auditAfter,
    });

    return NextResponse.json<ApiResponse>({
      data: after,
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[PATCH /api/admin/subscriptions] unexpected:', err);
    return NextResponse.json<ApiResponse>(
      { data: null, error: '伺服器錯誤', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
