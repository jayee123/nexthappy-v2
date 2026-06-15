import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionFromRequest } from '@/lib/auth';
import { checkMilestones, addPoints, POINT_RULES } from '@/lib/points';
import { extractDailyMemory } from '@/lib/ai/extractMemory';
import type { ApiResponse, CompletionType, ChatMessage } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json<ApiResponse>({ data: null, error: '請先登入', timestamp: new Date().toISOString() }, { status: 401 });
    }

    const body = await request.json();
    const { completion_type, emotion_score, journal_text } = body as {
      completion_type: CompletionType;
      emotion_score: number;
      journal_text?: string;
    };

    // 取得旅程
    const { data: journey, error: journeyError } = await supabaseAdmin
      .from('journeys')
      .select('*')
      .eq('user_id', session.userId)
      .eq('is_active', true)
      .single();

    if (journeyError || !journey) {
      return NextResponse.json<ApiResponse>({ data: null, error: '找不到旅程', timestamp: new Date().toISOString() }, { status: 404 });
    }

    const dayNumber = journey.current_day;
    const today = new Date().toISOString().split('T')[0];
    const isCompleted = completion_type !== 'failed';
    const pointsEarned = isCompleted ? POINT_RULES.DAILY_COMPLETE : 0;

    // 儲存每日記錄（upsert）
    await supabaseAdmin
      .from('daily_records')
      .upsert(
        {
          journey_id: journey.id,
          day_number: dayNumber,
          date: today,
          task_completed: isCompleted,
          completion_type,
          emotion_score,
          journal_text: journal_text || null,
          points_earned: pointsEarned,
        },
        { onConflict: 'journey_id,day_number' }
      );

    // 加積分
    if (isCompleted) {
      await addPoints(journey.id, pointsEarned);
    }

    // v2.1 day-advance 設計變更（2026-04-20）：
    //   不在這裡推進 current_day。晚間複盤應該停留在 Day N 脈絡，
    //   讓 AI 跟 UI 都指向「剛完成的 Day N」。
    //   次日早上 /api/day/today 會根據「current_day 的 record 已完成 + record.date < 今天」
    //   自動推進到 Day N+1。
    //   這裡只處理 Day 21 畢業時關閉 journey（讓使用者可開下一輪）。
    const isFinalDay = dayNumber === 21 && isCompleted;
    if (isFinalDay) {
      await supabaseAdmin
        .from('journeys')
        .update({ is_active: false })
        .eq('id', journey.id);
    }
    const nextDay = dayNumber < 21 ? dayNumber + 1 : dayNumber;

    // 檢查里程碑徽章
    const newBadges = await checkMilestones(journey.id, dayNumber);

    // 背景執行記憶萃取
    const { data: conversation } = await supabaseAdmin
      .from('conversations')
      .select('messages')
      .eq('journey_id', journey.id)
      .eq('day_number', dayNumber)
      .single();

    if (conversation?.messages) {
      // 非同步執行，不阻塞回應
      extractDailyMemory(journey.id, dayNumber, conversation.messages as ChatMessage[]).catch(console.error);
    }

    return NextResponse.json<ApiResponse>({
      data: {
        success: true,
        points_earned: pointsEarned,
        new_badges: newBadges,
        next_day: nextDay,
        is_complete: dayNumber === 21,
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Complete day error:', error);
    return NextResponse.json<ApiResponse>({ data: null, error: '伺服器錯誤', timestamp: new Date().toISOString() }, { status: 500 });
  }
}
