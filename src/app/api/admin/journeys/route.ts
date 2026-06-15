// 放置路徑：src/app/api/admin/journeys/route.ts
//
// Week 3 Session 3A：Journey 列表 endpoint（read-only）
//
// 功能：
//   - 列出所有 21 天 journey（cursor-based pagination、預設 50/page）
//   - 搜尋 by user email/name（inner join users 表）
//   - filter：all / active / inactive / stuck（>7 天沒對話 + 仍 active）
//   - filter：relationship_type (couple / parent_child / workplace)
//   - 聚合：每個 journey 的最後活躍時間 + 完成天數（Day 1+ distinct count）
//
// Query params:
//   ?search=foo
//   ?filter=all|active|inactive|stuck
//   ?relationship=couple|parent_child|workplace
//   ?cursor=2026-05-31T10:00:00.000Z
//   ?limit=50
//
// 對應 spec admin-dashboard-spec-v0.1.md §3.2

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { supabaseAdmin } from '@/lib/supabase';
import type { ApiResponse } from '@/types';

interface JourneyListItem {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string | null;
  user_mbti_self: string | null;
  round_number: number | null;
  round_label: string | null;
  partner_nickname: string | null;
  mbti_partner: string | null;
  relationship_type: string;
  current_day: number;
  is_active: boolean;
  created_at: string;
  latest_conversation_at: string | null;
  completed_days_count: number;
  days_since_last_activity: number | null;
  is_stuck: boolean;
}

interface JoinedUserInfo {
  email: string;
  name: string | null;
  mbti_self: string | null;
}

export async function GET(request: NextRequest) {
  // 1. Auth gate
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;

  try {
    // 2. Parse query
    const url = new URL(request.url);
    const search = url.searchParams.get('search')?.trim() || '';
    const filter = url.searchParams.get('filter') || 'all';
    const relationship = url.searchParams.get('relationship') || '';
    const cursor = url.searchParams.get('cursor');
    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get('limit') || '50', 10), 1),
      100
    );

    // 3. Build journeys query（含 inner join users 給 search 用）
    let query = supabaseAdmin
      .from('journeys')
      .select(
        'id, user_id, round_number, round_label, partner_nickname, mbti_partner, relationship_type, current_day, is_active, created_at, users!inner(email, name, mbti_self)'
      )
      .order('created_at', { ascending: false })
      .limit(limit + 1);

    if (search) {
      const escaped = search.replace(/[%_]/g, '\\$&');
      query = query.or(`email.ilike.%${escaped}%,name.ilike.%${escaped}%`, {
        referencedTable: 'users',
      });
    }

    // Filter is_active（'stuck' 也需要 is_active=true、之後 post-filter）
    if (filter === 'active' || filter === 'stuck') {
      query = query.eq('is_active', true);
    } else if (filter === 'inactive') {
      query = query.eq('is_active', false);
    }

    if (relationship && ['couple', 'parent_child', 'workplace'].includes(relationship)) {
      query = query.eq('relationship_type', relationship);
    }

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data: rawJourneys, error: journeysError } = await query;
    if (journeysError) {
      console.error('[/api/admin/journeys] query failed:', journeysError);
      return NextResponse.json<ApiResponse>(
        { data: null, error: '查詢 journey 失敗', timestamp: new Date().toISOString() },
        { status: 500 }
      );
    }

    // 4. Pagination metadata
    const hasMore = (rawJourneys?.length ?? 0) > limit;
    const pageJourneys = hasMore ? rawJourneys!.slice(0, limit) : rawJourneys || [];
    const nextCursor =
      hasMore && pageJourneys.length > 0
        ? pageJourneys[pageJourneys.length - 1].created_at
        : null;

    if (pageJourneys.length === 0) {
      return NextResponse.json<ApiResponse>({
        data: { journeys: [], next_cursor: null, has_more: false },
        error: null,
        timestamp: new Date().toISOString(),
      });
    }

    // 5. Aggregate conversations（latest updated_at + distinct day_number 完成天數）
    const journeyIds = pageJourneys.map(j => j.id);
    const { data: convs } = await supabaseAdmin
      .from('conversations')
      .select('journey_id, day_number, updated_at')
      .in('journey_id', journeyIds);

    const aggMap = new Map<string, { latest: string | null; completedDays: Set<number> }>();
    (convs || []).forEach(c => {
      if (!c.journey_id) return;
      const existing = aggMap.get(c.journey_id) || { latest: null, completedDays: new Set<number>() };
      if (!existing.latest || c.updated_at > existing.latest) {
        existing.latest = c.updated_at;
      }
      // 「完成天數」只算 Day 1+（Day 0 是 onboarding、不算完成練習天）
      if (typeof c.day_number === 'number' && c.day_number > 0) {
        existing.completedDays.add(c.day_number);
      }
      aggMap.set(c.journey_id, existing);
    });

    // 6. Merge + 計算 stuck flag
    const now = Date.now();
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    let result: JourneyListItem[] = pageJourneys.map(j => {
      const agg = aggMap.get(j.id);
      const latestAt = agg?.latest ?? null;
      const daysSince = latestAt
        ? Math.floor((now - new Date(latestAt).getTime()) / ONE_DAY_MS)
        : null;
      const isStuck = j.is_active && daysSince !== null && daysSince > 7;

      // Supabase inner join 回傳的 users 可能是 array 或 object（depends on schema config）
      const usersRaw = j.users as unknown;
      let userInfo: JoinedUserInfo;
      if (Array.isArray(usersRaw)) {
        userInfo = (usersRaw[0] as JoinedUserInfo) || { email: '', name: null, mbti_self: null };
      } else {
        userInfo = (usersRaw as JoinedUserInfo) || { email: '', name: null, mbti_self: null };
      }

      return {
        id: j.id,
        user_id: j.user_id,
        user_email: userInfo.email,
        user_name: userInfo.name,
        user_mbti_self: userInfo.mbti_self,
        round_number: j.round_number,
        round_label: j.round_label,
        partner_nickname: j.partner_nickname,
        mbti_partner: j.mbti_partner,
        relationship_type: j.relationship_type,
        current_day: j.current_day,
        is_active: j.is_active,
        created_at: j.created_at,
        latest_conversation_at: latestAt,
        completed_days_count: agg?.completedDays.size ?? 0,
        days_since_last_activity: daysSince,
        is_stuck: isStuck,
      };
    });

    // 7. Stuck filter post-merge（DB 層做不到、要 JS）
    if (filter === 'stuck') {
      result = result.filter(j => j.is_stuck);
    }

    return NextResponse.json<ApiResponse>({
      data: { journeys: result, next_cursor: nextCursor, has_more: hasMore },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[/api/admin/journeys] unexpected error:', err);
    return NextResponse.json<ApiResponse>(
      { data: null, error: '伺服器錯誤', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}