// 放置路徑：src/app/api/admin/users/[id]/route.ts
//
// Week 2 Session 2B：取單一 user 完整資料（含 journeys + recent conversations + stats）
//
// 回傳結構：
//   {
//     user: { id, email, name, mbti_self, ..., is_admin, suspended_at, nuwa_user_id },
//     market: { id, email, nickname, phone, currentPlan } | null,  ← 公版來的帳號資料

//     journeys: [ { id, partner_nickname, current_day, is_active, ... } ],
//     recent_conversations: [ { id, context_type, day_number, message_count, ... } ],（最近 20 筆）
//     stats: { total_conversations, total_journeys, first_activity, last_activity }
//   }
//
// 對應 spec admin-dashboard-spec-v0.1.md §3.1 詳情頁 + §4 API

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { logAdminAction } from '@/lib/admin/auditLog';
import { supabaseAdmin } from '@/lib/supabase';
import { getMarketUsers } from '@/lib/market/users';
import type { ApiResponse } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // 1. Auth gate
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;

  try {
    const userId = params.id;

    // UUID 格式檢查（避免亂塞字串）
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      return NextResponse.json<ApiResponse>(
        { data: null, error: 'user id 格式不對', timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    // 2. 撈 user 基本資料
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, name, mbti_self, mbti_confidence, mbti_set_at, is_admin, suspended_at, created_at, updated_at, nuwa_user_id')
      .eq('id', userId)
      .maybeSingle();

    if (userError) {
      console.error('[/api/admin/users/[id]] user query failed:', userError);
      return NextResponse.json<ApiResponse>(
        { data: null, error: '查詢 user 失敗', timestamp: new Date().toISOString() },
        { status: 500 }
      );
    }

    if (!user) {
      return NextResponse.json<ApiResponse>(
        { data: null, error: '找不到 user', timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    // 2-1. 撈公版帳號資料
    //
    // 帳號真值在公版：happy.users.email 只是 SSO 當下的快照，公版沒給 email 時
    // /sso 還會塞 `{nuwa_user_id}@sso.local` 的假值。列表頁（api/admin/users）
    // 早就這樣做了，詳情頁一直漏掉 —— 導致同一個人在列表看到公版 email、
    // 點進詳情卻看到私版快照。
    //
    // 查不到就回 null，前端 fallback 顯示私版本地值。
    const marketUsers = await getMarketUsers([user.nuwa_user_id]);
    const market = user.nuwa_user_id ? marketUsers.get(user.nuwa_user_id) ?? null : null;

    // 3. 撈所有 journeys（按建立時間倒序）
    const { data: journeys } = await supabaseAdmin
      .from('journeys')
      .select('id, partner_nickname, mbti_partner, relationship_type, round_label, round_number, current_day, is_active, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // 4. 撈最近 20 筆 conversations（不撈完整 messages、只撈 metadata + 算訊息數）
    const { data: rawConversations } = await supabaseAdmin
      .from('conversations')
      .select('id, context_type, day_number, topic_title, source, messages, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(20);

    // 計算每筆 message_count、不回傳完整 messages（節省 payload）
    const recent_conversations = (rawConversations || []).map(c => ({
      id: c.id,
      context_type: c.context_type,
      day_number: c.day_number,
      topic_title: c.topic_title,
      source: c.source,
      message_count: Array.isArray(c.messages) ? c.messages.length : 0,
      created_at: c.created_at,
      updated_at: c.updated_at,
    }));

    // 5. 撈完整對話總數（count only、不撈資料）
    const { count: total_conversations } = await supabaseAdmin
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // 6. 彙整 stats
    const stats = {
      total_conversations: total_conversations || 0,
      total_journeys: journeys?.length || 0,
      first_activity: rawConversations?.length
        ? rawConversations[rawConversations.length - 1].created_at
        : null,
      last_activity: rawConversations?.length ? rawConversations[0].updated_at : null,
    };

    // 7. 回傳
    return NextResponse.json<ApiResponse>({
      data: {
        user,
        market,
        journeys: journeys || [],
        recent_conversations,
        stats,
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[/api/admin/users/[id]] unexpected error:', err);
    return NextResponse.json<ApiResponse>(
      { data: null, error: '伺服器錯誤', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────
// PATCH /api/admin/users/[id]
//
// Body:
//   {
//     name?: string;
//     mbti_self?: string;          // 4 字母、會 normalize 成大寫
//     mbti_confidence?: 'low' | 'medium' | 'high';
//     is_admin?: boolean;
//     suspended_at?: string | null; // ISO timestamp 或 null（解除停權）
//   }
//
// 防自鎖：
//   - admin 不可降自己 is_admin 為 false
//   - admin 不可停權自己
//
// 每次成功更新都寫 audit log（before/after diff）
// ─────────────────────────────────────────────────

const MBTI_REGEX = /^[EI][SN][TF][JP]$/;

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error: authError, adminUser } = await requireAdmin(request);
  if (authError) return authError;
  if (!adminUser) {
    return NextResponse.json<ApiResponse>(
      { data: null, error: '無 admin user', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }

  try {
    const userId = params.id;

    // UUID 格式檢查
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      return NextResponse.json<ApiResponse>(
        { data: null, error: 'user id 格式不對', timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    const body = await request.json();

    // 1. 撈當前 user
    const { data: currentUser, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('id, email, name, mbti_self, mbti_confidence, is_admin, suspended_at')
      .eq('id', userId)
      .maybeSingle();

    if (fetchError || !currentUser) {
      return NextResponse.json<ApiResponse>(
        { data: null, error: '找不到 user', timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    // 2. 驗證 + 建 updates + before/after diff
    const updates: Record<string, unknown> = {};
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};

    if (typeof body.name === 'string') {
      const newName = body.name.trim().slice(0, 50) || null;
      if (newName !== currentUser.name) {
        updates.name = newName;
        before.name = currentUser.name;
        after.name = newName;
      }
    }

    if (typeof body.mbti_self === 'string') {
      const normalized = body.mbti_self.toUpperCase().trim();
      if (!MBTI_REGEX.test(normalized)) {
        return NextResponse.json<ApiResponse>(
          { data: null, error: 'MBTI 格式不正確、必須是 4 字母（如 ENFJ）', timestamp: new Date().toISOString() },
          { status: 400 }
        );
      }
      if (normalized !== currentUser.mbti_self) {
        updates.mbti_self = normalized;
        updates.mbti_set_at = new Date().toISOString();
        before.mbti_self = currentUser.mbti_self;
        after.mbti_self = normalized;
      }
    }

    if (typeof body.mbti_confidence === 'string') {
      if (!['low', 'medium', 'high'].includes(body.mbti_confidence)) {
        return NextResponse.json<ApiResponse>(
          { data: null, error: 'mbti_confidence 必須是 low / medium / high', timestamp: new Date().toISOString() },
          { status: 400 }
        );
      }
      if (body.mbti_confidence !== currentUser.mbti_confidence) {
        updates.mbti_confidence = body.mbti_confidence;
        before.mbti_confidence = currentUser.mbti_confidence;
        after.mbti_confidence = body.mbti_confidence;
      }
    }

    if (typeof body.is_admin === 'boolean') {
      if (body.is_admin !== currentUser.is_admin) {
        // 防自鎖：admin 不能降自己
        if (currentUser.id === adminUser.id && !body.is_admin) {
          return NextResponse.json<ApiResponse>(
            { data: null, error: '不可降自己的 admin 權限（防自鎖）', timestamp: new Date().toISOString() },
            { status: 403 }
          );
        }
        updates.is_admin = body.is_admin;
        before.is_admin = currentUser.is_admin;
        after.is_admin = body.is_admin;
      }
    }

    if (body.suspended_at !== undefined) {
      // null = 解除停權、有值 = 停權
      const newSuspended =
        body.suspended_at === null ? null : new Date(body.suspended_at).toISOString();
      if (newSuspended !== currentUser.suspended_at) {
        // 防自鎖：admin 不能停權自己
        if (currentUser.id === adminUser.id && newSuspended) {
          return NextResponse.json<ApiResponse>(
            { data: null, error: '不可停權自己', timestamp: new Date().toISOString() },
            { status: 403 }
          );
        }
        updates.suspended_at = newSuspended;
        before.suspended_at = currentUser.suspended_at;
        after.suspended_at = newSuspended;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json<ApiResponse>(
        { data: null, error: '沒有任何欄位要更新', timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    updates.updated_at = new Date().toISOString();

    // 3. 執行 update
    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select('id, email, name, mbti_self, mbti_confidence, mbti_set_at, is_admin, suspended_at, created_at, updated_at')
      .single();

    if (updateError || !updatedUser) {
      console.error('[PATCH /api/admin/users/[id]] update failed:', updateError);
      return NextResponse.json<ApiResponse>(
        { data: null, error: '更新失敗', timestamp: new Date().toISOString() },
        { status: 500 }
      );
    }

    // 4. 寫 audit log（按變動類型決定 action 名稱）
    let action = 'user.update';
    if ('is_admin' in after) {
      action = after.is_admin ? 'user.grant_admin' : 'user.revoke_admin';
    } else if ('suspended_at' in after) {
      action = after.suspended_at ? 'user.suspend' : 'user.unsuspend';
    } else if ('mbti_self' in after) {
      action = 'user.update_mbti';
    }

    await logAdminAction({
      request,
      adminUserId: adminUser.id,
      action,
      targetType: 'user',
      targetId: userId,
      before,
      after,
    });

    return NextResponse.json<ApiResponse>({
      data: { user: updatedUser },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[PATCH /api/admin/users/[id]] unexpected error:', err);
    return NextResponse.json<ApiResponse>(
      { data: null, error: '伺服器錯誤', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────
// DELETE /api/admin/users/[id]
//
// Hard delete + cascade（conversations / journeys 自動連帶刪除、見 Migration 007 ON DELETE CASCADE）
//
// 防護：
//   - 不可刪除自己（防自鎖）
//   - 不可刪除其他 admin（要先降為一般 user 再刪）
//
// 寫 audit log 在 DELETE 之前（DELETE 後 target_id 已不存在）
// ─────────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error: authError, adminUser } = await requireAdmin(request);
  if (authError) return authError;
  if (!adminUser) {
    return NextResponse.json<ApiResponse>(
      { data: null, error: '無 admin user', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }

  try {
    const userId = params.id;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      return NextResponse.json<ApiResponse>(
        { data: null, error: 'user id 格式不對', timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    // 1. 撈 target user（驗證存在 + 拿 metadata 給 audit log）
    const { data: targetUser, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('id, email, name, is_admin')
      .eq('id', userId)
      .maybeSingle();

    if (fetchError || !targetUser) {
      return NextResponse.json<ApiResponse>(
        { data: null, error: '找不到 user', timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    // 2. 防自鎖
    if (targetUser.id === adminUser.id) {
      return NextResponse.json<ApiResponse>(
        { data: null, error: '不可刪除自己', timestamp: new Date().toISOString() },
        { status: 403 }
      );
    }

    // 3. 不可刪其他 admin（要先 PATCH is_admin=false 再刪）
    if (targetUser.is_admin) {
      return NextResponse.json<ApiResponse>(
        { data: null, error: '不可刪除其他 admin、請先把 admin 降為一般 user 再刪', timestamp: new Date().toISOString() },
        { status: 403 }
      );
    }

    // 4. 寫 audit log（在 delete 之前、保留 user metadata）
    await logAdminAction({
      request,
      adminUserId: adminUser.id,
      action: 'user.delete',
      targetType: 'user',
      targetId: userId,
      before: {
        email: targetUser.email,
        name: targetUser.name,
        is_admin: targetUser.is_admin,
      },
    });

    // 5. 執行 delete（DB FK 會 cascade 刪 conversations / journeys）
    const { error: deleteError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', userId);

    if (deleteError) {
      console.error('[DELETE /api/admin/users/[id]] delete failed:', deleteError);
      return NextResponse.json<ApiResponse>(
        { data: null, error: '刪除失敗：' + deleteError.message, timestamp: new Date().toISOString() },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse>({
      data: { ok: true, deleted_user_id: userId, deleted_user_email: targetUser.email },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[DELETE /api/admin/users/[id]] unexpected error:', err);
    return NextResponse.json<ApiResponse>(
      { data: null, error: '伺服器錯誤', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}