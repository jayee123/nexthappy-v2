// 放置路徑：src/lib/admin/auditLog.ts
//
// 寫 admin 動作審計 log 到 admin_audit_logs 表
//
// 用法（所有 mutation endpoint：PATCH / DELETE / grant 等）：
//   await logAdminAction({
//     request,
//     adminUserId: adminUser.id,
//     action: 'user.update_mbti',
//     targetType: 'user',
//     targetId: targetUserId,
//     before: { mbti_self: oldMbti },
//     after: { mbti_self: newMbti },
//   });
//
// action 命名規則：'<entity>.<action>'
//   範例：'user.update_mbti' / 'user.suspend' / 'admin.grant'
//        / 'course.edit_day' / 'conversation.view'
//
// 失敗時 console.error 但不 throw（不要阻塞主要操作）

import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

interface LogAdminActionParams {
  request: NextRequest;
  adminUserId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

export async function logAdminAction(params: LogAdminActionParams): Promise<void> {
  const { request, adminUserId, action, targetType, targetId, before, after } = params;

  // 抓 IP 地址（透過 Vercel / proxy 時用 x-forwarded-for）
  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  // 建 changes diff（只在有 before 或 after 時才寫）
  const changes = before || after
    ? { before: before ?? null, after: after ?? null }
    : null;

  try {
    const { error } = await supabaseAdmin.from('admin_audit_logs').insert({
      admin_user_id: adminUserId,
      action,
      target_type: targetType ?? null,
      target_id: targetId ?? null,
      changes,
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    if (error) {
      console.error('[logAdminAction] insert failed:', error);
    }
  } catch (err) {
    console.error('[logAdminAction] unexpected error:', err);
  }
}