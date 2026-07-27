// 放置路徑：src/app/api/day/[dayNumber]/route.ts
//
// v1.3.3d 新增：載入歷史 Day N 對話（read-only）
//
// 使用：GET /api/day/5  → 載入該 user active journey 的 Day 5 對話 + course content + record
//
// 與 /api/day/today 差異：
//   - /api/day/today    → 當前 Day（含 auto-advance 邏輯、可寫）
//   - /api/day/[dayN]   → 指定 Day（純讀取、read-only）
//
// Security：必須是 active journey 的 owner（session 驗）+ dayNumber 在 0-21 範圍

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionFromRequest } from '@/lib/auth';
import type { ApiResponse, TodayInfo } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: { dayNumber: string } }
) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json<ApiResponse>(
        { data: null, error: '請先登入', timestamp: new Date().toISOString() },
        { status: 401 }
      );
    }

    const dayNumber = parseInt(params.dayNumber, 10);
    if (isNaN(dayNumber) || dayNumber < 0 || dayNumber > 21) {
      return NextResponse.json<ApiResponse>(
        { data: null, error: 'dayNumber 必須在 0-21 範圍', timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    // v1.5.x 7/26：支援 ?journey_id=xxx 查歷史輪次的 Day N
    //   用途：sidebar「歷史任務」展開後、點任一 Day 回溯前幾輪的對話
    //   安全：一律加 .eq('user_id', session.userId)、防跨用戶偷看
    const journeyId = new URL(request.url).searchParams.get('journey_id');

    const journeyQuery = supabaseAdmin
      .from('journeys')
      .select('*')
      .eq('user_id', session.userId);

    const { data: journey } = journeyId
      ? await journeyQuery.eq('id', journeyId).maybeSingle()
      : await journeyQuery.eq('is_active', true).maybeSingle();

    if (!journey) {
      return NextResponse.json<ApiResponse>(
        { data: null, error: journeyId ? '找不到指定旅程' : '找不到 active 旅程', timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    // 不能看未來的 Day
    if (dayNumber > journey.current_day) {
      return NextResponse.json<ApiResponse>(
        { data: null, error: `Day ${dayNumber} 還沒開始`, timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    // 並行取得 Day N 資料
    const [courseResult, recordResult, conversationResult, memoriesResult] = await Promise.all([
      supabaseAdmin
        .from('course_content')
        .select('*')
        .eq('day_number', dayNumber)
        .single(),
      supabaseAdmin
        .from('daily_records')
        .select('*')
        .eq('journey_id', journey.id)
        .eq('day_number', dayNumber)
        .maybeSingle(),
      supabaseAdmin
        .from('conversations')
        .select('*')
        .eq('journey_id', journey.id)
        .eq('day_number', dayNumber)
        .neq('context_type', 'consultant')  // 排除諮詢對話、只要練習對話
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from('daily_memories')
        .select('*')
        .eq('journey_id', journey.id)
        .order('day_number', { ascending: false })
        .limit(3),
    ]);

    if (courseResult.error || !courseResult.data) {
      return NextResponse.json<ApiResponse>(
        { data: null, error: `Day ${dayNumber} 課程內容不存在`, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    const todayInfo: TodayInfo = {
      day_number: dayNumber,
      course: courseResult.data,
      record: recordResult.data || null,
      conversation: conversationResult.data || null,
      memories: memoriesResult.data || [],
    };

    return NextResponse.json<ApiResponse>({
      data: {
        today: todayInfo,
        journey,
        is_read_only: dayNumber !== journey.current_day,  // 非當前 day 都是 read-only
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[day/[dayNumber]/GET]', error);
    return NextResponse.json<ApiResponse>(
      { data: null, error: '伺服器錯誤', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
