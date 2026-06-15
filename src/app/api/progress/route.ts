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

    const { data: journey } = await supabaseAdmin
      .from('journeys')
      .select('*')
      .eq('user_id', session.userId)
      .eq('is_active', true)
      .single();

    if (!journey) {
      return NextResponse.json<ApiResponse>({ data: null, error: '找不到旅程', timestamp: new Date().toISOString() }, { status: 404 });
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
