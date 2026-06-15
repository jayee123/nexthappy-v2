// 放置路徑：src/app/api/admin/admins/route.ts
//
// Week 5 Session 5C：admin 管理 endpoints（Module 7 Tab 1）
//
// GET  /api/admin/admins      → 列出所有 is_admin=TRUE 的 user
// POST /api/admin/admins      → 升某 email 為 admin（body: { email }）
//
// Revoke 在 [userId]/route.ts。
// Self-protection + admin 數量保護都在這層做（不依賴 client 守規）。

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { logAdminAction } from '@/lib/admin/auditLog';
import { supabaseAdmin } from '@/lib/supabase';
import type { ApiResponse } from '@/types';

interface AdminListItem {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
  is_self: boolean;
}

// ============================================================
// GET：列出所有 admin
// ============================================================

export async function GET(request: NextRequest) {
  const { error: authError, adminUser } = await requireAdmin(request);
  if (authError) return authError;

  try {
    const { data: admins, error } = await supabaseAdmin
      .from('users')
      .select('id, email, name, created_at')
      .eq('is_admin', true)
      .order('created_at', { ascending: true }); // 老的 admin 在前（Steve 第一個 admin 永遠在最上）

    if (error) {
      console.error('[GET /api/admin/admins] query failed:', error);
      return NextResponse.json<ApiResponse>(
        { data: null, error: '查詢 admin 失敗', timestamp: new Date().toISOString() },
        { status: 500 }
      );
    }

    const list: AdminListItem[] = (admins || []).map(a => ({
      id: a.id,
      email: a.email,
      name: a.name,
      created_at: a.created_at,
      is_self: adminUser?.id === a.id,
    }));

    return NextResponse.json<ApiResponse>({
      data: { admins: list },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[GET /api/admin/admins] unexpected error:', err);
    return NextResponse.json<ApiResponse>(
      { data: null, error: '伺服器錯誤', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}

// ============================================================
// POST：升某 email 為 admin
// ============================================================

interface GrantBody {
  email?: unknown;
}

export async function POST(request: NextRequest) {
  const { error: authError, adminUser } = await requireAdmin(request);
  if (authError) return authError;

  // Parse body
  let body: GrantBody;
  try {
    body = await request.json() as GrantBody;
  } catch {
    return NextResponse.json<ApiResponse>(
      { data: null, error: '請求 body 不是有效 JSON', timestamp: new Date().toISOString() },
      { status: 400 }
    );
  }

  // Validate email
  if (typeof body.email !== 'string' || body.email.trim() === '') {
    return NextResponse.json<ApiResponse>(
      { data: null, error: 'email 為必填欄位', timestamp: new Date().toISOString() },
      { status: 400 }
    );
  }
  const email = body.email.trim().toLowerCase();
  // 簡易 email 格式檢查（precise validation 留給 DB constraint）
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json<ApiResponse>(
      { data: null, error: 'email 格式不正確', timestamp: new Date().toISOString() },
      { status: 400 }
    );
  }

  try {
    // Lookup user by email
    const { data: targetUser, error: lookupError } = await supabaseAdmin
      .from('users')
      .select('id, email, name, is_admin')
      .ilike('email', email)
      .maybeSingle();

    if (lookupError) {
      console.error('[POST /api/admin/admins] lookup error:', lookupError);
      return NextResponse.json<ApiResponse>(
        { data: null, error: '查詢失敗', timestamp: new Date().toISOString() },
        { status: 500 }
      );
    }
    if (!targetUser) {
      return NextResponse.json<ApiResponse>(
        { data: null, error: `找不到 email 為 ${email} 的 user。請對方先註冊一次再 grant。`, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    // 已是 admin → idempotent return（不視為 error）
    if (targetUser.is_admin) {
      return NextResponse.json<ApiResponse>({
        data: {
          id: targetUser.id,
          email: targetUser.email,
          name: targetUser.name,
          already_admin: true,
        },
        error: null,
        timestamp: new Date().toISOString(),
      });
    }

    // Update is_admin = true
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('users')
      .update({ is_admin: true, updated_at: new Date().toISOString() })
      .eq('id', targetUser.id)
      .select('id, email, name, created_at')
      .single();

    if (updateError || !updated) {
      console.error('[POST /api/admin/admins] update failed:', updateError);
      return NextResponse.json<ApiResponse>(
        { data: null, error: '升 admin 失敗', timestamp: new Date().toISOString() },
        { status: 500 }
      );
    }

    // Audit log（用既有的 'user.grant_admin' action name、跟 PATCH 路徑一致）
    if (adminUser) {
      await logAdminAction({
        request,
        adminUserId: adminUser.id,
        action: 'user.grant_admin',
        targetType: 'user',
        targetId: targetUser.id,
        before: { is_admin: false },
        after: { is_admin: true },
      });
    }

    return NextResponse.json<ApiResponse>({
      data: updated,
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[POST /api/admin/admins] unexpected error:', err);
    return NextResponse.json<ApiResponse>(
      { data: null, error: '伺服器錯誤', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
