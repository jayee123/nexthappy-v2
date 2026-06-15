// 放置路徑：src/app/api/admin/audit-logs/route.ts
//
// Week 5 Session 5C：admin 動作 audit log viewer（Module 7 Tab 2）
//
// GET /api/admin/audit-logs
//   ?action=user.grant_admin   (optional, exact match)
//   ?admin_user_id=<uuid>      (optional, filter by 哪個 admin 做的)
//   ?target_type=user          (optional)
//   ?cursor=<ISO ts>           (optional, created_at < cursor)
//   ?limit=50                  (default 50, max 200)
//
// 回傳含 joined admin email/name（saves 前端二次 lookup）。
// admin_user_id 可能為 NULL（migration 011 把 FK 改成 ON DELETE SET NULL）、
// 顯示為「已刪除 user」。

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { supabaseAdmin } from '@/lib/supabase';
import type { ApiResponse } from '@/types';

interface AuditLogListItem {
  id: string;
  admin_user_id: string | null;
  admin_email: string | null;
  admin_name: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  changes: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;

  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action')?.trim() || '';
    const adminUserIdFilter = url.searchParams.get('admin_user_id')?.trim() || '';
    const targetType = url.searchParams.get('target_type')?.trim() || '';
    const cursor = url.searchParams.get('cursor');
    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get('limit') || '50', 10), 1),
      200
    );

    let query = supabaseAdmin
      .from('admin_audit_logs')
      .select('id, admin_user_id, action, target_type, target_id, changes, ip_address, user_agent, created_at')
      .order('created_at', { ascending: false })
      .limit(limit + 1); // 多撈 1 筆判斷 hasMore

    if (action) query = query.eq('action', action);
    if (adminUserIdFilter) query = query.eq('admin_user_id', adminUserIdFilter);
    if (targetType) query = query.eq('target_type', targetType);
    if (cursor) query = query.lt('created_at', cursor);

    const { data: logs, error: queryError } = await query;
    if (queryError) {
      console.error('[GET /api/admin/audit-logs] query failed:', queryError);
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

    // 收集所有 admin_user_id（去 null + dedup）→ 一次 lookup users.email/name
    const adminIds = Array.from(
      new Set(pageRows.map(r => r.admin_user_id).filter((x): x is string => !!x))
    );

    const adminInfoMap = new Map<string, { email: string; name: string | null }>();
    if (adminIds.length > 0) {
      const { data: adminInfos } = await supabaseAdmin
        .from('users')
        .select('id, email, name')
        .in('id', adminIds);
      (adminInfos || []).forEach(u => {
        adminInfoMap.set(u.id, { email: u.email, name: u.name });
      });
    }

    const result: AuditLogListItem[] = pageRows.map(r => {
      const adminInfo = r.admin_user_id ? adminInfoMap.get(r.admin_user_id) : null;
      return {
        id: r.id,
        admin_user_id: r.admin_user_id,
        admin_email: adminInfo?.email ?? null,
        admin_name: adminInfo?.name ?? null,
        action: r.action,
        target_type: r.target_type,
        target_id: r.target_id,
        changes: r.changes as Record<string, unknown> | null,
        ip_address: r.ip_address,
        user_agent: r.user_agent,
        created_at: r.created_at,
      };
    });

    return NextResponse.json<ApiResponse>({
      data: {
        logs: result,
        next_cursor: nextCursor,
        has_more: hasMore,
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[GET /api/admin/audit-logs] unexpected error:', err);
    return NextResponse.json<ApiResponse>(
      { data: null, error: '伺服器錯誤', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
