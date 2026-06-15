// 放置路徑：src/lib/admin/requireAdmin.ts
//
// Admin endpoint 認證中介層、給所有 /api/admin/* 用
//
// 用法（每個 /api/admin/* endpoint 開頭）：
//   const { error, session, adminUser } = await requireAdmin(request);
//   if (error) return error;
//   // ... 正常邏輯
//
// 返回 3 種狀態：
//   1. 未登入  → error = 401 response
//   2. 已登入但非 admin → error = 403 response
//   3. admin → error = null、可使用 session / adminUser

import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export interface AdminUser {
  id: string;
  email: string;
  is_admin: boolean;
}

interface RequireAdminResult {
  error: NextResponse | null;
  session: { userId: string } | null;
  adminUser: AdminUser | null;
}

export async function requireAdmin(request: NextRequest): Promise<RequireAdminResult> {
  // 1. 檢查登入
  const session = await getSessionFromRequest(request);
  if (!session) {
    return {
      error: NextResponse.json(
        { data: null, error: '請先登入', timestamp: new Date().toISOString() },
        { status: 401 }
      ),
      session: null,
      adminUser: null,
    };
  }

  // 2. 查 user 資料 + is_admin 旗標
  const { data: user, error: queryError } = await supabaseAdmin
    .from('users')
    .select('id, email, is_admin')
    .eq('id', session.userId)
    .single();

  if (queryError || !user) {
    return {
      error: NextResponse.json(
        { data: null, error: '找不到使用者', timestamp: new Date().toISOString() },
        { status: 404 }
      ),
      session: null,
      adminUser: null,
    };
  }

  // 3. 檢查 is_admin
  if (!user.is_admin) {
    return {
      error: NextResponse.json(
        { data: null, error: '需要管理員權限', timestamp: new Date().toISOString() },
        { status: 403 }
      ),
      session: null,
      adminUser: null,
    };
  }

  // 4. 全通過、返回 adminUser 給 endpoint 用
  return {
    error: null,
    session,
    adminUser: user as AdminUser,
  };
}