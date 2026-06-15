// 放置路徑：src/app/api/admin/course-content/route.ts
//
// Week 5 Session 5A-1：課程內容列表 API
//
// 回傳 22 day（Day 0-21）的概要資料：
//   - 基本欄位（day_number, theme, subtitle, course_unit）
//   - 預覽欄位（knowledge_point + today_task 前 80 字）
//   - JSONB 計數（evening_questions 幾題 / special_content 是否有）

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { supabaseAdmin } from '@/lib/supabase';
import type { ApiResponse } from '@/types';

interface CourseContentListItem {
  id: string;
  day_number: number;
  theme: string;
  subtitle: string | null;
  course_unit: string | null;
  knowledge_point_preview: string;
  today_task_preview: string;
  evening_questions_count: number;
  has_special_content: boolean;
  created_at: string | null;
}

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;

  try {
    const { data, error } = await supabaseAdmin
      .from('course_content')
      .select('id, day_number, theme, subtitle, course_unit, knowledge_point, today_task, evening_questions, special_content, created_at')
      .order('day_number', { ascending: true });

    if (error) {
      console.error('[course-content list] fetch error:', error);
      throw error;
    }

    const rows = data || [];

    const items: CourseContentListItem[] = rows.map(row => ({
      id: row.id,
      day_number: row.day_number,
      theme: row.theme,
      subtitle: row.subtitle,
      course_unit: row.course_unit,
      knowledge_point_preview: (row.knowledge_point || '').slice(0, 80),
      today_task_preview: (row.today_task || '').slice(0, 80),
      evening_questions_count: Array.isArray(row.evening_questions)
        ? row.evening_questions.length
        : 0,
      has_special_content: row.special_content !== null && row.special_content !== undefined,
      created_at: row.created_at,
    }));

    return NextResponse.json<ApiResponse>({
      data: { course_days: items, total: items.length },
      error: null,
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    console.error('Course content list error:', err);
    return NextResponse.json<ApiResponse>({
      data: null,
      error: err instanceof Error ? err.message : '查詢失敗',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}