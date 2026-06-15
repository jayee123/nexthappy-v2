// 放置路徑：src/app/api/admin/admins/[userId]/route.ts
//
// Week 5 Session 5C：撤銷某 user 的 admin 權限
//
// DELETE /api/admin/admins/<userId> → 設 is_admin=FALSE
//
// 安全護欄：
//   1. 自我保護：不可撤自己（防自鎖）
//   2. 數量保護：不可撤掉「最後一位 admin」（系統最少要 1 個 admin）
//   3. 已非 admin → 200 idempotent
//   4. 寫 audit log（action='user.revoke_admin'、跟 PATCH /users/[id] 一致）

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { logAdminAction } from '@/lib/admin/auditLog';
import { supabaseAdmin } from '@/lib/supabase';
import type { ApiResponse } from '@/types';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  const { error: authError, adminUser } = await requireAdmin(request);
  if (authError) return authError;
  if (!adminUser) {
    // requireAdmin 通過理應有 adminUser、防呆
    return NextResponse.json<ApiResponse>(
      { data: null, error: '無法識別當前 admin', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }

  const targetUserId = params.userId;
  if (!targetUserId) {
    return NextResponse.json<ApiResponse>(
      { data: null, error: '缺少 userId', timestamp: new Date().toISOString() },
      { status: 400 }
    );
  }

  // 自我保護
  if (targetUserId === adminUser.id) {
    return NextResponse.json<ApiResponse>(
      { data: null, error: '不可撤銷自己的 admin 權限（防自鎖）', timestamp: new Date().toISOString() },
      { status: 403 }
    );
  }

  try {
    // Lookup target
    const { data: targetUser, error: lookupError } = await supabaseAdmin
      .from('users')
      .select('id, email, name, is_admin')
      .eq('id', targetUserId)
      .maybeSingle();

    if (lookupError) {
      console.error('[DELETE /api/admin/admins] lookup error:', lookupError);
      return NextResponse.json<ApiResponse>(
        { data: null, error: '查詢失敗', timestamp: new Date().toISOString() },
        { status: 500 }
      );
    }
    if (!targetUser) {
      return NextResponse.json<ApiResponse>(
        { data: null, error: '找不到目標 user', timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    // 已非 admin → idempotent return
    if (!targetUser.is_admin) {
      return NextResponse.json<ApiResponse>({
        data: { id: targetUser.id, email: targetUser.email, already_revoked: true },
        error: null,
        timestamp: new Date().toISOString(),
      });
    }

    // 數量保護：先 count current admin 數
    const { count: adminCount, error: countError } = await supabaseAdmin
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('is_admin', true);

    if (countError) {
      console.error('[DELETE /api/admin/admins] count error:', countError);
      return NextResponse.json<ApiResponse>(
        { data: null, error: '查詢 admin 數量失敗', timestamp: new Date().toISOString() },
        { status: 500 }
      );
    }

    if ((adminCount ?? 0) <= 1) {
      return NextResponse.json<ApiResponse>(
        { data: null, error: '系統至少要保留 1 位 admin、不可撤銷最後一位', timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    // Update is_admin = false
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ is_admin: false, updated_at: new Date().toISOString() })
      .eq('id', targetUserId);

    if (updateError) {
      console.error('[DELETE /api/admin/admins] update failed:', updateError);
      return NextResponse.json<ApiResponse>(
        { data: null, error: '撤銷 admin 失敗', timestamp: new Date().toISOString() },
        { status: 500 }
      );
    }

    // Audit log
    await logAdminAction({
      request,
      adminUserId: adminUser.id,
      action: 'user.revoke_admin',
      targetType: 'user',
      targetId: targetUserId,
      before: { is_admin: true },
      after: { is_admin: false },
    });

    return NextResponse.json<ApiResponse>({
      data: { id: targetUser.id, email: targetUser.email, revoked: true },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[DELETE /api/admin/admins] unexpected error:', err);
    return NextResponse.json<ApiResponse>(
      { data: null, error: '伺服器錯誤', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
