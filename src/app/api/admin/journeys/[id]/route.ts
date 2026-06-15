// 放置路徑：src/app/api/admin/journeys/[id]/route.ts
//
// Week 3 Session 3B：Journey 詳情 API
//
// 回傳：
//   - Journey 基本資料 + user 資訊（inner join）
//   - 每天 conversations 統計（day_number → count + first/last）
//   - 整體 stats（total convs, completed_days, days_since, is_stuck）
//
// 不回傳：對話原文（保留給 Week 4 對話歷史頁）

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { supabaseAdmin } from '@/lib/supabase';
import type { ApiResponse } from '@/types';

interface DayBreakdown {
  day_number: number;
  message_count: number;
  first_at: string;
  last_at: string;
}

interface JourneyDetail {
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
  stats: {
    total_conversations: number;
    completed_days: number[];
    days_since_last_activity: number | null;
    latest_conversation_at: string | null;
    is_stuck: boolean;
  };
  day_breakdown: DayBreakdown[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;

  const journeyId = params.id;
  if (!journeyId || !/^[0-9a-f-]{36}$/i.test(journeyId)) {
    return NextResponse.json<ApiResponse>({
      data: null,
      error: '無效的 journey ID',
      timestamp: new Date().toISOString(),
    }, { status: 400 });
  }

  try {
    // 1. Fetch journey + user
    const { data: journey, error: journeyError } = await supabaseAdmin
      .from('journeys')
      .select('id, user_id, round_number, round_label, partner_nickname, mbti_partner, relationship_type, current_day, is_active, created_at, users!inner(email, name, mbti_self)')
      .eq('id', journeyId)
      .single();

    if (journeyError || !journey) {
      console.error('[journey detail] fetch error:', journeyError);
      return NextResponse.json<ApiResponse>({
        data: null,
        error: '找不到此 journey',
        timestamp: new Date().toISOString(),
      }, { status: 404 });
    }

    // 2. Fetch conversations metadata (no content)
    const { data: conversations, error: convError } = await supabaseAdmin
      .from('conversations')
      .select('id, day_number, created_at')
      .eq('journey_id', journeyId)
      .order('created_at', { ascending: false });

    if (convError) {
      console.error('Conversations fetch error:', convError);
      throw convError;
    }

    const convs = conversations || [];

    // 3. Aggregate day breakdown
    const dayMap = new Map<number, { count: number; first: string; last: string }>();
    for (const c of convs) {
      const d = c.day_number;
      if (d === null || d === undefined) continue;
      const existing = dayMap.get(d);
      if (!existing) {
        dayMap.set(d, { count: 1, first: c.created_at, last: c.created_at });
      } else {
        existing.count++;
        if (c.created_at < existing.first) existing.first = c.created_at;
        if (c.created_at > existing.last) existing.last = c.created_at;
      }
    }

    const day_breakdown: DayBreakdown[] = Array.from(dayMap.entries())
      .map(([day_number, v]) => ({
        day_number,
        message_count: v.count,
        first_at: v.first,
        last_at: v.last,
      }))
      .sort((a, b) => a.day_number - b.day_number);

    // 4. Stats
    const completed_days = day_breakdown
      .filter(d => d.day_number > 0)
      .map(d => d.day_number);

    const latest = convs[0]?.created_at || null;
    const days_since = latest
      ? Math.floor((Date.now() - new Date(latest).getTime()) / 86400000)
      : null;

    const is_stuck = journey.is_active && days_since !== null && days_since > 7;

    // 5. Unwrap user join
    const userRaw = journey.users as unknown;
    const user = Array.isArray(userRaw) ? userRaw[0] : userRaw;
    const userObj = user as { email?: string; name?: string | null; mbti_self?: string | null } | undefined;

    const detail: JourneyDetail = {
      id: journey.id,
      user_id: journey.user_id,
      user_email: userObj?.email || '',
      user_name: userObj?.name || null,
      user_mbti_self: userObj?.mbti_self || null,
      round_number: journey.round_number,
      round_label: journey.round_label,
      partner_nickname: journey.partner_nickname,
      mbti_partner: journey.mbti_partner,
      relationship_type: journey.relationship_type,
      current_day: journey.current_day,
      is_active: journey.is_active,
      created_at: journey.created_at,
      stats: {
        total_conversations: convs.length,
        completed_days,
        days_since_last_activity: days_since,
        latest_conversation_at: latest,
        is_stuck,
      },
      day_breakdown,
    };

    return NextResponse.json<ApiResponse>({
      data: detail,
      error: null,
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    console.error('Journey detail error:', err);
    return NextResponse.json<ApiResponse>({
      data: null,
      error: err instanceof Error ? err.message : '查詢失敗',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}