import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionFromRequest } from '@/lib/auth';
import type { ApiResponse, ProgressStats } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json<ApiResponse>({ data: null, error: '請先登入', timestamp: new Date().toISOString() }, { status: 401 });
    }

    // v1.5.x 7/30 fix（2026-08-22 從 v21 backport）：改撈「最新一輪」而非「active 那輪」
    //
    // 舊版 .eq('is_active', true).single()：
    //   Day 21 完成時 day/complete 會把 is_active 設 false（原設計、讓可開下一輪），
    //   於是查不到 → .single() error → 回 404 → 前端 stats 保持 null → 進度頁整頁空白。
    //   Angel / Pearl 這批第一梯完成 21 天的用戶會直接踩到。
    //
    // 改法：撈該 user 最新建立的一輪（不論 is_active）。
    //   完成 21 天的用戶點「進度」會看到剛完成那輪的完整成果（天數 / 積分 / 徽章 / 情緒曲線），
    //   而不是白畫面 —— 也符合「畢業後想回顧」的心理。
    //
    // ?journey_id=xxx 可指定看特定輪次（給側板歷史任務用、含 user_id 安全檢查）
    const requestedJourneyId = new URL(request.url).searchParams.get('journey_id');

    const journeyQuery = supabaseAdmin
      .from('journeys')
      .select('*')
      .eq('user_id', session.userId);

    const { data: journey } = requestedJourneyId
      ? await journeyQuery.eq('id', requestedJourneyId).maybeSingle()
      : await journeyQuery
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

    if (!journey) {
      return NextResponse.json<ApiResponse>({ data: null, error: '還沒有任何 21 天練習紀錄', timestamp: new Date().toISOString() }, { status: 404 });
    }

    const [recordsResult, achievementsResult] = await Promise.all([
      supabaseAdmin
        .from('daily_records')
        .select('*')
        .eq('journey_id', journey.id)
        .order('day_number', { ascending: true }),
      supabaseAdmin
        .from('achievements')
        .select('*')
        .eq('journey_id', journey.id)
        .order('earned_at', { ascending: false }),
    ]);

    const completedDays = (recordsResult.data || []).filter(r => r.task_completed).length;

    const stats: ProgressStats = {
      current_day: journey.current_day,
      total_days: 21,
      completed_days: completedDays,
      completion_rate: Math.round((completedDays / 21) * 100),
      total_points: journey.total_points,
      achievements: achievementsResult.data || [],
      daily_records: recordsResult.data || [],
      journey,
    };

    return NextResponse.json<ApiResponse>({
      data: { stats },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Progress error:', error);
    return NextResponse.json<ApiResponse>({ data: null, error: '伺服器錯誤', timestamp: new Date().toISOString() }, { status: 500 });
  }
}
