import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionFromRequest } from '@/lib/auth';
import type { ApiResponse, TodayInfo } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json<ApiResponse>({ data: null, error: '請先登入', timestamp: new Date().toISOString() }, { status: 401 });
    }

    // v1.5.x: 支援 ?journey_id=xxx 查特定 journey（含歷史已完成）
    // 用途：Pearl 7/16 事件後、sidebar 歷史列表點過去看已完成 journey
    // 安全：查完後檢查 journey.user_id 必須匹配 session（防跨用戶偷看）
    const url = new URL(request.url);
    const requestedJourneyId = url.searchParams.get('journey_id');

    // v1.3.2b: journey 變 optional——trier-first user 可在無 journey 狀態下落地 /chat、
    // 21 天 tab 顯示「開始第 1 輪」CTA、Mode B「我卡住了，幫我拆」走 lite path
    let journey;
    if (requestedJourneyId) {
      const { data } = await supabaseAdmin
        .from('journeys')
        .select('*')
        .eq('id', requestedJourneyId)
        .eq('user_id', session.userId)   // ⚠️ 安全檢查、防跨用戶
        .maybeSingle();
      journey = data;
    } else {
      const { data } = await supabaseAdmin
        .from('journeys')
        .select('*')
        .eq('user_id', session.userId)
        .eq('is_active', true)
        .maybeSingle();
      journey = data;
    }

    if (!journey) {
      return NextResponse.json<ApiResponse>({
        data: { today: null, journey: null },
        error: null,
        timestamp: new Date().toISOString(),
      });
    }

    // v2.1 day-advance 邏輯（2026-04-20）：
    //   規則：若 current_day 的 record 已完成 且 record.date < 今天（且還沒到 Day 21），
    //         就自動推進 current_day 到 N+1。
    //   目的：讓晚間「完成今日」複盤停留在 Day N 脈絡；次日早上開 app 自動進 Day N+1。
    //   副作用：這裡可能會把 journey.current_day 改寫到 DB，後續 fetch 使用新值。
    let dayNumber = journey.current_day;
    const today = new Date().toISOString().split('T')[0];

    if (dayNumber < 21) {
      const { data: currentRecord } = await supabaseAdmin
        .from('daily_records')
        .select('task_completed, date')
        .eq('journey_id', journey.id)
        .eq('day_number', dayNumber)
        .maybeSingle();

      if (
        currentRecord?.task_completed === true &&
        currentRecord.date &&
        currentRecord.date < today
      ) {
        const advancedDay = dayNumber + 1;
        const { error: advanceError } = await supabaseAdmin
          .from('journeys')
          .update({ current_day: advancedDay })
          .eq('id', journey.id);
        if (!advanceError) {
          dayNumber = advancedDay;
          journey.current_day = advancedDay;
        }
      }
    }

    // 並行取得今日資料
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
        .single(),
      supabaseAdmin
        .from('conversations')
        .select('*')
        .eq('journey_id', journey.id)
        .eq('day_number', dayNumber)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
      supabaseAdmin
        .from('daily_memories')
        .select('*')
        .eq('journey_id', journey.id)
        .order('day_number', { ascending: false })
        .limit(3),
    ]);

    const todayInfo: TodayInfo = {
      day_number: dayNumber,
      course: courseResult.data!,
      record: recordResult.data || null,
      conversation: conversationResult.data || null,
      memories: memoriesResult.data || [],
    };

    return NextResponse.json<ApiResponse>({
      data: { today: todayInfo, journey },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Today error:', error);
    return NextResponse.json<ApiResponse>({ data: null, error: '伺服器錯誤', timestamp: new Date().toISOString() }, { status: 500 });
  }
}
