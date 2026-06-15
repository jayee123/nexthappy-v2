import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionFromRequest } from '@/lib/auth';
import type { ApiResponse, OnboardingData } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json<ApiResponse>(
        { data: null, error: '請先登入', timestamp: new Date().toISOString() },
        { status: 401 }
      );
    }

    const body: OnboardingData = await request.json();
    const {
      mbti_self,
      mbti_partner,
      mbti_confidence,
      partner_nickname,
      relationship_type,
      goal_statement,
      initial_problem,
      round_label,
    } = body;

    if (!mbti_self || !partner_nickname || !relationship_type) {
      return NextResponse.json<ApiResponse>(
        { data: null, error: '請填入必要資訊', timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    // v2.1 多輪支援：
    // 1. 檢查是否有「進行中」的旅程（is_active=true 且 current_day<21）→ 拒絕重啟
    // 2. 計算下一個 round_number（該 user 現有最大 round_number + 1，若無則為 1）
    const { data: activeJourney } = await supabaseAdmin
      .from('journeys')
      .select('id, current_day')
      .eq('user_id', session.userId)
      .eq('is_active', true)
      .maybeSingle();

    if (activeJourney && activeJourney.current_day < 21) {
      return NextResponse.json<ApiResponse>(
        {
          data: null,
          error: '你還有進行中的練習，請先完成或在設定中結束它再開始新一輪',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // 若已畢業的 journey 仍 active（例如 Day 21 還沒被 complete 設為 inactive），先把它關掉
    if (activeJourney && activeJourney.current_day >= 21) {
      await supabaseAdmin
        .from('journeys')
        .update({ is_active: false })
        .eq('id', activeJourney.id);
    }

    // 計算這個 user 下一個 round_number
    const { data: maxRoundRow } = await supabaseAdmin
      .from('journeys')
      .select('round_number')
      .eq('user_id', session.userId)
      .order('round_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextRoundNumber = (maxRoundRow?.round_number ?? 0) + 1;

    const today = new Date().toISOString().split('T')[0];

    const { data: journey, error } = await supabaseAdmin
      .from('journeys')
      .insert({
        user_id: session.userId,
        mbti_self: mbti_self.toUpperCase(),
        mbti_partner: mbti_partner?.toUpperCase() || null,
        mbti_confidence: mbti_confidence || 'medium',
        partner_nickname,
        relationship_type,
        goal_statement: goal_statement || null,
        initial_problem: initial_problem || null,
        start_date: today,
        current_day: 0, // v2.1：從 Day 0 開始（舊版從 Day 1，但 course_content 現在有 Day 0）
        round_number: nextRoundNumber,
        round_label: round_label || null,
        is_active: true,
      })
      .select()
      .single();

    if (error || !journey) {
      console.error('[journey/setup] insert error:', error);
      throw new Error('建立旅程失敗');
    }

    return NextResponse.json<ApiResponse>({
      data: { journey },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Journey setup error:', error);
    return NextResponse.json<ApiResponse>(
      { data: null, error: '伺服器錯誤', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
