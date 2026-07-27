// 放置路徑：src/app/api/journey/list/route.ts
//
// v1.5.x：回傳當前 user 的**所有** journeys（含歷史已完成 + 當前 active）
//
// 用途：
//   - Sidebar 練習 tab 顯示歷史 rounds 列表
//   - 前台讓用戶可回看已完成的 21 天輪次
//
// 起因：Pearl 7/16 事件——她 Day 21 完成後、is_active=false、前台完全空白
//   Steve 發現「+」按鈕缺失 + sidebar 只顯示 active 是設計漏洞
//   詳見 spec §14 v1.5.x (?)

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionFromRequest } from '@/lib/auth';
import type { ApiResponse } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json<ApiResponse>(
        { data: null, error: '請先登入', timestamp: new Date().toISOString() },
        { status: 401 }
      );
    }

    // 全部 journeys、新到舊排序（active 通常最新、歷史往下排）
    const { data: journeys, error } = await supabaseAdmin
      .from('journeys')
      .select('id, round_label, round_number, partner_nickname, relationship_type, mbti_partner, current_day, is_active, created_at, updated_at, total_points')
      .eq('user_id', session.userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[journey/list] error:', error);
      return NextResponse.json<ApiResponse>(
        { data: null, error: '載入 journey 列表失敗', timestamp: new Date().toISOString() },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse>({
      data: { journeys: journeys || [] },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[journey/list] unexpected error:', error);
    return NextResponse.json<ApiResponse>(
      { data: null, error: '伺服器錯誤', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
