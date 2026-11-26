// 放置路徑：src/app/api/admin/guardrail-logs/route.ts
//
// GET /api/admin/guardrail-logs
//   ?risk_tier=mid|high        (optional)
//   ?route=chat|consultant     (optional)
//   ?reviewed=true|false       (optional，不給 = 全部)
//   ?cursor=<ISO ts>           (optional, created_at < cursor)
//   ?limit=50                  (default 50, max 200)
//
// 讀 happy.guardrail_logs（見 supabase/migrations/020_guardrail_logs.sql），
// 只記套話風險（extraction）軸的 mid／high 對話，給人工事後審查誤判用。
// 回傳含 joined user email/name（同 audit-logs 的做法）。

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { supabaseAdmin } from '@/lib/supabase';
import type { ApiResponse } from '@/types';

interface GuardrailLogListItem {
  id: string;
  created_at: string;
  user_id: string | null;
  user_email: string | null;
  user_name: string | null;
  session_key: string;
  route: string;
  message: string;
  outcome: string;
  risk_tier: string;
  refusal_text: string | null;
  reviewed: boolean;
  reviewer_note: string | null;
}

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;

  try {
    const url = new URL(request.url);
    const riskTier = url.searchParams.get('risk_tier')?.trim() || '';
    const routeFilter = url.searchParams.get('route')?.trim() || '';
    const reviewedParam = url.searchParams.get('reviewed');
    const cursor = url.searchParams.get('cursor');
    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get('limit') || '50', 10), 1),
      200
    );

    let query = supabaseAdmin
      .from('guardrail_logs')
      .select('id, created_at, user_id, session_key, route, message, outcome, risk_tier, refusal_text, reviewed, reviewer_note')
      .order('created_at', { ascending: false })
      .limit(limit + 1); // 多撈 1 筆判斷 hasMore

    if (riskTier === 'mid' || riskTier === 'high') query = query.eq('risk_tier', riskTier);
    if (routeFilter === 'chat' || routeFilter === 'consultant') query = query.eq('route', routeFilter);
    if (reviewedParam === 'true') query = query.eq('reviewed', true);
    if (reviewedParam === 'false') query = query.eq('reviewed', false);
    if (cursor) query = query.lt('created_at', cursor);

    const { data: logs, error: queryError } = await query;
    if (queryError) {
      console.error('[GET /api/admin/guardrail-logs] query failed:', queryError);
      return NextResponse.json<ApiResponse>(
        { data: null, error: '查詢失敗', timestamp: new Date().toISOString() },
        { status: 500 }
      );
    }

    const rows = logs || [];
    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore && pageRows.length > 0
      ? pageRows[pageRows.length - 1].created_at
      : null;

    // 收集 user_id（去 null + dedup）→ 一次 lookup users.email/name
    const userIds = Array.from(
      new Set(pageRows.map(r => r.user_id).filter((x): x is string => !!x))
    );

    const userInfoMap = new Map<string, { email: string; name: string | null }>();
    if (userIds.length > 0) {
      const { data: userInfos } = await supabaseAdmin
        .from('users')
        .select('id, email, name')
        .in('id', userIds);
      (userInfos || []).forEach(u => {
        userInfoMap.set(u.id, { email: u.email, name: u.name });
      });
    }

    const result: GuardrailLogListItem[] = pageRows.map(r => {
      const userInfo = r.user_id ? userInfoMap.get(r.user_id) : null;
      return {
        id: r.id,
        created_at: r.created_at,
        user_id: r.user_id,
        user_email: userInfo?.email ?? null,
        user_name: userInfo?.name ?? null,
        session_key: r.session_key,
        route: r.route,
        message: r.message,
        outcome: r.outcome,
        risk_tier: r.risk_tier,
        refusal_text: r.refusal_text,
        reviewed: r.reviewed,
        reviewer_note: r.reviewer_note,
      };
    });

    // 未審查筆數（給側欄/頁首顯示提醒用，不受目前篩選影響）
    const { count: unreviewedCount } = await supabaseAdmin
      .from('guardrail_logs')
      .select('*', { count: 'exact', head: true })
      .eq('reviewed', false);

    return NextResponse.json<ApiResponse>({
      data: {
        logs: result,
        next_cursor: nextCursor,
        has_more: hasMore,
        unreviewed_count: unreviewedCount || 0,
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[GET /api/admin/guardrail-logs] unexpected error:', err);
    return NextResponse.json<ApiResponse>(
      { data: null, error: '伺服器錯誤', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
