// 放置路徑：src/app/api/admin/invites/[code]/route.ts
//
// Week 5 Session 5E：邀請碼單一動作
//
// PATCH /api/admin/invites/<code>  → 立即停用（設 expires_at = NOW）
//   - 只能停用「未使用且未過期」的碼（available 狀態）
//   - 已使用的碼是 immutable history、不允許更動
//   - 已過期的碼已經沒有作用、不用再停用
//
// （沒做 DELETE — 保留所有歷史紀錄、stop 用 PATCH 就好）

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { logAdminAction } from '@/lib/admin/auditLog';
import { supabaseAdmin } from '@/lib/supabase';
import type { ApiResponse } from '@/types';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  const { error: authError, adminUser } = await requireAdmin(request);
  if (authError) return authError;
  if (!adminUser) {
    return NextResponse.json<ApiResponse>(
      { data: null, error: '無法識別當前 admin', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }

  const code = params.code?.toUpperCase();
  if (!code) {
    return NextResponse.json<ApiResponse>(
      { data: null, error: '缺少邀請碼', timestamp: new Date().toISOString() },
      { status: 400 }
    );
  }

  try {
    // 抓現況
    const { data: invite, error: lookupError } = await supabaseAdmin
      .from('invite_codes')
      .select('code, used_by, used_at, expires_at, created_at')
      .eq('code', code)
      .maybeSingle();

    if (lookupError) {
      console.error('[PATCH /api/admin/invites] lookup error:', lookupError);
      return NextResponse.json<ApiResponse>(
        { data: null, error: '查詢失敗', timestamp: new Date().toISOString() },
        { status: 500 }
      );
    }
    if (!invite) {
      return NextResponse.json<ApiResponse>(
        { data: null, error: '找不到此邀請碼', timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    // 已使用 → 不允許動
    if (invite.used_by) {
      return NextResponse.json<ApiResponse>(
        {
          data: null,
          error: '此邀請碼已被使用、不可變更（保留歷史紀錄）',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // 已過期 → idempotent return
    const now = new Date();
    if (invite.expires_at && new Date(invite.expires_at) < now) {
      return NextResponse.json<ApiResponse>({
        data: { code: invite.code, already_expired: true },
        error: null,
        timestamp: new Date().toISOString(),
      });
    }

    // 設 expires_at = NOW（軟性停用、保留紀錄）
    const beforeExpiresAt = invite.expires_at;
    const newExpiresAt = now.toISOString();

    const { error: updateError } = await supabaseAdmin
      .from('invite_codes')
      .update({ expires_at: newExpiresAt })
      .eq('code', code);

    if (updateError) {
      console.error('[PATCH /api/admin/invites] update failed:', updateError);
      return NextResponse.json<ApiResponse>(
        { data: null, error: '停用失敗', timestamp: new Date().toISOString() },
        { status: 500 }
      );
    }

    // Audit log
    await logAdminAction({
      request,
      adminUserId: adminUser.id,
      action: 'invite.revoke',
      targetType: 'invite_code',
      targetId: code,
      before: { expires_at: beforeExpiresAt },
      after: { expires_at: newExpiresAt },
    });

    return NextResponse.json<ApiResponse>({
      data: { code, revoked: true, expires_at: newExpiresAt },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[PATCH /api/admin/invites] unexpected error:', err);
    return NextResponse.json<ApiResponse>(
      { data: null, error: '伺服器錯誤', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
