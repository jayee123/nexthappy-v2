// 放置路徑：src/app/api/admin/users/route.ts
//
// Week 2 用戶管理：GET 列表 endpoint
//
// 功能：
//   - 列出所有 user（cursor-based pagination、預設 50 / page）
//   - 搜尋 email / name（ilike 模糊比對）
//   - filter：admin / active（過去 7 天）/ suspended / none
//   - 聚合：每個 user 的對話數 + 最後活躍時間 + 當前 21 天進度
//
// Query params:
//   ?search=foo
//   ?filter=admin|active|suspended|none
//   ?cursor=2026-05-29T10:00:00.000Z  (上一頁最後一筆的 created_at)
//   ?limit=50  (max 100)
//
// 對應 spec admin-dashboard-spec-v0.1.md §3.1 + §4

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { supabaseAdmin } from '@/lib/supabase';
import type { ApiResponse } from '@/types';

interface UserListItem {
  id: string;
  email: string;
  name: string | null;
  mbti_self: string | null;
  is_admin: boolean;
  suspended_at: string | null;
  created_at: string;
  conversation_count: number;
  last_active: string | null;
  journey_current_day: number | null;
  journey_partner: string | null;
  journey_round: number | null;
}

export async function GET(request: NextRequest) {
  // 1. Auth gate
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;

  try {
    // 2. Parse query params
    const url = new URL(request.url);
    const search = url.searchParams.get('search')?.trim() || '';
    const filter = url.searchParams.get('filter') || 'none';
    const cursor = url.searchParams.get('cursor');
    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get('limit') || '50', 10), 1),
      100
    );

    // 3. Build base users query
    let query = supabaseAdmin
      .from('users')
      .select('id, email, name, mbti_self, mbti_confidence, is_admin, suspended_at, created_at')
      .order('created_at', { ascending: false })
      .limit(limit + 1); // 多撈 1 筆判斷 hasMore

    // Search（email + name 模糊比對）
    if (search) {
      // escape % 跟 _ 避免 SQL injection（Supabase ilike 已 parameterize、相對安全）
      const escapedSearch = search.replace(/[%_]/g, '\\$&');
      query = query.or(`email.ilike.%${escapedSearch}%,name.ilike.%${escapedSearch}%`);
    }

    // Filter
    if (filter === 'admin') {
      query = query.eq('is_admin', true);
    } else if (filter === 'suspended') {
      query = query.not('suspended_at', 'is', null);
    }
    // 'active' filter 需要 conversation 資料、留到 step 7 post-merge 處理

    // Cursor pagination
    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data: users, error: usersError } = await query;
    if (usersError) {
      console.error('[/api/admin/users] users query failed:', usersError);
      return NextResponse.json<ApiResponse>(
        { data: null, error: '查詢 user 失敗', timestamp: new Date().toISOString() },
        { status: 500 }
      );
    }

    // 4. hasMore + nextCursor
    const hasMore = (users?.length ?? 0) > limit;
    const pageUsers = hasMore ? users!.slice(0, limit) : users || [];
    const nextCursor = hasMore && pageUsers.length > 0
      ? pageUsers[pageUsers.length - 1].created_at
      : null;

    if (pageUsers.length === 0) {
      return NextResponse.json<ApiResponse>({
        data: { users: [], next_cursor: null, has_more: false },
        error: null,
        timestamp: new Date().toISOString(),
      });
    }

    const userIds = pageUsers.map(u => u.id);

    // 5. 撈這頁 user 的 conversation 聚合（count + max updated_at）
    const { data: convs } = await supabaseAdmin
      .from('conversations')
      .select('user_id, updated_at')
      .in('user_id', userIds);

    const convMap = new Map<string, { count: number; lastActive: string | null }>();
    (convs || []).forEach(c => {
      const existing = convMap.get(c.user_id) || { count: 0, lastActive: null };
      existing.count += 1;
      if (!existing.lastActive || c.updated_at > existing.lastActive) {
        existing.lastActive = c.updated_at;
      }
      convMap.set(c.user_id, existing);
    });

    // 6. 撈這頁 user 的 active journey
    const { data: journeys } = await supabaseAdmin
      .from('journeys')
      .select('user_id, current_day, partner_nickname, round_number')
      .in('user_id', userIds)
      .eq('is_active', true);

    interface JourneyRow {
      user_id: string;
      current_day: number;
      partner_nickname: string | null;
      round_number: number | null;
    }
    const journeyMap = new Map<string, JourneyRow>();
    
    (journeys || []).forEach(j => {
      // 若一個 user 有多個 active journey、留最新（理論上不該、但保險）
      if (!journeyMap.has(j.user_id)) journeyMap.set(j.user_id, j);
    });

    // 7. Merge + apply 'active' filter
    let result: UserListItem[] = pageUsers.map(u => {
      const conv = convMap.get(u.id);
      const j = journeyMap.get(u.id);
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        mbti_self: u.mbti_self,
        is_admin: u.is_admin,
        suspended_at: u.suspended_at,
        created_at: u.created_at,
        conversation_count: conv?.count ?? 0,
        last_active: conv?.lastActive ?? null,
        journey_current_day: j?.current_day ?? null,
        journey_partner: j?.partner_nickname ?? null,
        journey_round: j?.round_number ?? null,
      };
    });

    if (filter === 'active') {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      result = result.filter(u => u.last_active && u.last_active >= sevenDaysAgo);
    }

    // 8. 回傳
    return NextResponse.json<ApiResponse>({
      data: {
        users: result,
        next_cursor: nextCursor,
        has_more: hasMore,
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[/api/admin/users] unexpected error:', err);
    return NextResponse.json<ApiResponse>(
      { data: null, error: '伺服器錯誤', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}