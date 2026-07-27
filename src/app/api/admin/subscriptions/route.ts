// 放置路徑：src/app/api/admin/subscriptions/route.ts
//
// Phase 1A：admin 訂閱管理 API
//
// GET /api/admin/subscriptions
//   ?plan=trial|basic|advanced|premium|cancelled  (optional filter)
//   ?search=foo  (email/name 模糊)
//   ?cursor=ISO
//   ?limit=50
//
// 回傳：每 user 的當前方案 + 本月用量 + 試用狀態 + 訂閱起算 / 續訂日
//
// 用途：admin 看訂閱狀態總覽、找需要關注的 user（譬如試用快到期 / 超量）

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { supabaseAdmin } from '@/lib/supabase';
import { PLANS, type PlanTier } from '@/lib/billing/plans';
import type { ApiResponse } from '@/types';

interface SubscriptionListItem {
  user_id: string;
  email: string;
  name: string | null;
  current_plan: PlanTier;
  plan_label: string;
  plan_monthly_messages: number;
  trial_started_at: string | null;
  trial_expires_at: string | null;
  subscription_started_at: string | null;
  subscription_renews_at: string | null;
  auto_renewal: boolean;
  cancelled_at: string | null;
  messages_used_this_month: number;
  messages_remaining: number;
  cost_twd_this_month: number;
  created_at: string;
}

const VALID_PLANS: PlanTier[] = ['trial', 'basic', 'advanced', 'premium', 'cancelled'];

function getCurrentPeriodStart(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;

  try {
    const url = new URL(request.url);
    const planFilter = url.searchParams.get('plan') || '';
    const search = url.searchParams.get('search')?.trim() || '';
    const cursor = url.searchParams.get('cursor');
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50', 10), 1), 100);

    let query = supabaseAdmin
      .from('users')
      .select(
        'id, email, name, current_plan, trial_started_at, subscription_started_at, subscription_renews_at, auto_renewal, cancelled_at, created_at'
      )
      .order('created_at', { ascending: false })
      .limit(limit + 1);

    if (planFilter && VALID_PLANS.includes(planFilter as PlanTier)) {
      query = query.eq('current_plan', planFilter);
    }

    if (search) {
      const escaped = search.replace(/[%_]/g, '\\$&');
      query = query.or(`email.ilike.%${escaped}%,name.ilike.%${escaped}%`);
    }

    if (cursor) query = query.lt('created_at', cursor);

    const { data: users, error: usersError } = await query;
    if (usersError) {
      console.error('[GET /api/admin/subscriptions] users query failed:', usersError);
      return NextResponse.json<ApiResponse>(
        { data: null, error: '查詢失敗', timestamp: new Date().toISOString() },
        { status: 500 }
      );
    }

    const safeUsers = users || [];
    const hasMore = safeUsers.length > limit;
    const pageUsers = hasMore ? safeUsers.slice(0, limit) : safeUsers;
    const nextCursor =
      hasMore && pageUsers.length > 0 ? pageUsers[pageUsers.length - 1].created_at : null;

    if (pageUsers.length === 0) {
      return NextResponse.json<ApiResponse>({
        data: { subscriptions: [], next_cursor: null, has_more: false, counts: {} },
        error: null,
        timestamp: new Date().toISOString(),
      });
    }

    // 抓本月 usage_quotas
    const periodStart = getCurrentPeriodStart();
    const userIds = pageUsers.map(u => u.id);
    const { data: quotas } = await supabaseAdmin
      .from('usage_quotas')
      .select('user_id, messages_count, cost_twd_estimated')
      .in('user_id', userIds)
      .eq('period_start', periodStart);

    const quotaMap = new Map<string, { used: number; cost: number }>();
    (quotas || []).forEach(q => {
      quotaMap.set(q.user_id, {
        used: q.messages_count || 0,
        cost: Number(q.cost_twd_estimated || 0),
      });
    });

    const subscriptions: SubscriptionListItem[] = pageUsers.map(u => {
      const plan = u.current_plan as PlanTier;
      const planSpec = PLANS[plan];
      const used = quotaMap.get(u.id)?.used ?? 0;
      const cost = quotaMap.get(u.id)?.cost ?? 0;

      // Trial 到期日推算
      let trial_expires_at: string | null = null;
      if (u.trial_started_at) {
        const exp = new Date(u.trial_started_at);
        exp.setDate(exp.getDate() + (planSpec.trial_days || 7));
        trial_expires_at = exp.toISOString();
      }

      return {
        user_id: u.id,
        email: u.email,
        name: u.name,
        current_plan: plan,
        plan_label: planSpec.label,
        plan_monthly_messages: planSpec.monthly_messages,
        trial_started_at: u.trial_started_at,
        trial_expires_at,
        subscription_started_at: u.subscription_started_at,
        subscription_renews_at: u.subscription_renews_at,
        auto_renewal: u.auto_renewal,
        cancelled_at: u.cancelled_at,
        messages_used_this_month: used,
        messages_remaining: Math.max(0, planSpec.monthly_messages - used),
        cost_twd_this_month: cost,
        created_at: u.created_at,
      };
    });

    // 各方案總人數 counts（給頁面頂部 stat cards）
    const { data: countsByPlan } = await supabaseAdmin
      .from('users')
      .select('current_plan');
    const counts: Record<string, number> = { trial: 0, basic: 0, advanced: 0, premium: 0, cancelled: 0 };
    (countsByPlan || []).forEach(r => {
      const p = r.current_plan as string;
      counts[p] = (counts[p] || 0) + 1;
    });

    return NextResponse.json<ApiResponse>({
      data: {
        subscriptions,
        counts,
        next_cursor: nextCursor,
        has_more: hasMore,
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[GET /api/admin/subscriptions] unexpected:', err);
    return NextResponse.json<ApiResponse>(
      { data: null, error: '伺服器錯誤', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
