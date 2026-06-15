// 放置路徑：src/app/api/admin/course-content/[day]/route.ts
//
// Week 5 Session 5A-1：課程內容詳情 API（by day_number、GET）
// Week 5 Session 5A-2：加 PATCH 編輯功能（theme / subtitle / knowledge_point / today_task / evening_questions）
//
// URL: /api/admin/course-content/11 → 撈 Day 11 完整資料
// PATCH /api/admin/course-content/11 with body { theme, subtitle, ... } → 編輯該 day
//
// PATCH 紀律：
//   - 寫 audit log（action: 'course.edit_day'、含 before/after diff）
//   - 不可改 day_number / course_unit / special_content（schema 結構性）
//   - validate 必填欄位 + 長度上限

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { logAdminAction } from '@/lib/admin/auditLog';
import { supabaseAdmin } from '@/lib/supabase';
import type { ApiResponse } from '@/types';

// ============================================================
// 編輯欄位 validation 紀律（v1.4.x Session 5A-2）
// ============================================================

const LIMITS = {
  theme: 100,
  subtitle: 200,
  knowledge_point: 10000,
  today_task: 5000,
  evening_question_count: 10,
  evening_question_length: 500,
} as const;

interface CoursePatchBody {
  theme?: unknown;
  subtitle?: unknown;
  knowledge_point?: unknown;
  today_task?: unknown;
  evening_questions?: unknown;
}

interface ValidatedPatch {
  theme: string;
  subtitle: string | null;
  knowledge_point: string;
  today_task: string;
  evening_questions: string[] | null;
}

/**
 * Validate + normalize PATCH body。
 * 回傳 { ok: true, value } 或 { ok: false, error }。
 */
function validatePatch(body: CoursePatchBody): { ok: true; value: ValidatedPatch } | { ok: false; error: string } {
  // theme（必填、非空）
  if (typeof body.theme !== 'string' || body.theme.trim() === '') {
    return { ok: false, error: 'theme 為必填欄位' };
  }
  if (body.theme.length > LIMITS.theme) {
    return { ok: false, error: `theme 不可超過 ${LIMITS.theme} 字（目前 ${body.theme.length}）` };
  }

  // subtitle（可選、可空字串 → null）
  let subtitle: string | null = null;
  if (body.subtitle !== undefined && body.subtitle !== null) {
    if (typeof body.subtitle !== 'string') {
      return { ok: false, error: 'subtitle 必須是字串或 null' };
    }
    const trimmed = body.subtitle.trim();
    if (trimmed.length > LIMITS.subtitle) {
      return { ok: false, error: `subtitle 不可超過 ${LIMITS.subtitle} 字（目前 ${trimmed.length}）` };
    }
    subtitle = trimmed === '' ? null : body.subtitle;
  }

  // knowledge_point（必填、非空）
  if (typeof body.knowledge_point !== 'string' || body.knowledge_point.trim() === '') {
    return { ok: false, error: 'knowledge_point 為必填欄位' };
  }
  if (body.knowledge_point.length > LIMITS.knowledge_point) {
    return { ok: false, error: `knowledge_point 不可超過 ${LIMITS.knowledge_point} 字（目前 ${body.knowledge_point.length}）` };
  }

  // today_task（必填、非空）
  if (typeof body.today_task !== 'string' || body.today_task.trim() === '') {
    return { ok: false, error: 'today_task 為必填欄位' };
  }
  if (body.today_task.length > LIMITS.today_task) {
    return { ok: false, error: `today_task 不可超過 ${LIMITS.today_task} 字（目前 ${body.today_task.length}）` };
  }

  // evening_questions（可選、array of strings、可 null / 可空 array → 存 null）
  let evening_questions: string[] | null = null;
  if (body.evening_questions !== undefined && body.evening_questions !== null) {
    if (!Array.isArray(body.evening_questions)) {
      return { ok: false, error: 'evening_questions 必須是字串陣列或 null' };
    }
    if (body.evening_questions.length > LIMITS.evening_question_count) {
      return { ok: false, error: `evening_questions 最多 ${LIMITS.evening_question_count} 題（目前 ${body.evening_questions.length}）` };
    }
    const cleaned: string[] = [];
    for (let i = 0; i < body.evening_questions.length; i++) {
      const q = body.evening_questions[i];
      if (typeof q !== 'string') {
        return { ok: false, error: `第 ${i + 1} 題不是字串` };
      }
      const trimmed = q.trim();
      if (trimmed === '') {
        // 空字串題目忽略（user 多按了加新題沒填）
        continue;
      }
      if (trimmed.length > LIMITS.evening_question_length) {
        return { ok: false, error: `第 ${i + 1} 題超過 ${LIMITS.evening_question_length} 字（目前 ${trimmed.length}）` };
      }
      cleaned.push(trimmed);
    }
    evening_questions = cleaned.length > 0 ? cleaned : null;
  }

  return {
    ok: true,
    value: {
      theme: body.theme,
      subtitle,
      knowledge_point: body.knowledge_point,
      today_task: body.today_task,
      evening_questions,
    },
  };
}

// ============================================================
// GET：撈 Day N 完整資料
// ============================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { day: string } }
) {
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;

  const dayNum = parseInt(params.day, 10);
  if (isNaN(dayNum) || dayNum < 0 || dayNum > 21) {
    return NextResponse.json<ApiResponse>({
      data: null,
      error: '無效的 day_number（須為 0-21）',
      timestamp: new Date().toISOString(),
    }, { status: 400 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('course_content')
      .select('*')
      .eq('day_number', dayNum)
      .single();

    if (error || !data) {
      console.error('[course-content detail] fetch error:', error);
      return NextResponse.json<ApiResponse>({
        data: null,
        error: `找不到 Day ${dayNum} 的課程內容`,
        timestamp: new Date().toISOString(),
      }, { status: 404 });
    }

    return NextResponse.json<ApiResponse>({
      data,
      error: null,
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    console.error('Course content detail error:', err);
    return NextResponse.json<ApiResponse>({
      data: null,
      error: err instanceof Error ? err.message : '查詢失敗',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

// ============================================================
// PATCH：編輯 Day N（v1.4.x Session 5A-2）
// ============================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: { day: string } }
) {
  const { error: authError, adminUser } = await requireAdmin(request);
  if (authError) return authError;

  const dayNum = parseInt(params.day, 10);
  if (isNaN(dayNum) || dayNum < 0 || dayNum > 21) {
    return NextResponse.json<ApiResponse>({
      data: null,
      error: '無效的 day_number（須為 0-21）',
      timestamp: new Date().toISOString(),
    }, { status: 400 });
  }

  // Parse body
  let rawBody: CoursePatchBody;
  try {
    rawBody = await request.json() as CoursePatchBody;
  } catch {
    return NextResponse.json<ApiResponse>({
      data: null,
      error: '請求 body 不是有效 JSON',
      timestamp: new Date().toISOString(),
    }, { status: 400 });
  }

  // Validate
  const validation = validatePatch(rawBody);
  if (!validation.ok) {
    return NextResponse.json<ApiResponse>({
      data: null,
      error: validation.error,
      timestamp: new Date().toISOString(),
    }, { status: 400 });
  }
  const patch = validation.value;

  try {
    // 抓 before snapshot（給 audit log diff）
    const { data: beforeRow, error: beforeError } = await supabaseAdmin
      .from('course_content')
      .select('id, theme, subtitle, knowledge_point, today_task, evening_questions')
      .eq('day_number', dayNum)
      .single();

    if (beforeError || !beforeRow) {
      return NextResponse.json<ApiResponse>({
        data: null,
        error: `找不到 Day ${dayNum} 的課程內容`,
        timestamp: new Date().toISOString(),
      }, { status: 404 });
    }

    // Update
    const { data: afterRow, error: updateError } = await supabaseAdmin
      .from('course_content')
      .update({
        theme: patch.theme,
        subtitle: patch.subtitle,
        knowledge_point: patch.knowledge_point,
        today_task: patch.today_task,
        evening_questions: patch.evening_questions,
      })
      .eq('day_number', dayNum)
      .select('*')
      .single();

    if (updateError || !afterRow) {
      console.error('[course-content PATCH] update error:', updateError);
      return NextResponse.json<ApiResponse>({
        data: null,
        error: '更新失敗',
        timestamp: new Date().toISOString(),
      }, { status: 500 });
    }

    // 寫 audit log（diff 只記實際變動的欄位、不寫整個 row）
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    const fields: Array<keyof typeof patch> = ['theme', 'subtitle', 'knowledge_point', 'today_task', 'evening_questions'];
    for (const field of fields) {
      const oldVal = (beforeRow as Record<string, unknown>)[field];
      const newVal = patch[field];
      // 比較（陣列用 JSON.stringify、其他直接 !==）
      const oldJson = JSON.stringify(oldVal ?? null);
      const newJson = JSON.stringify(newVal ?? null);
      if (oldJson !== newJson) {
        before[field] = oldVal ?? null;
        after[field] = newVal ?? null;
      }
    }

    if (Object.keys(after).length > 0 && adminUser) {
      await logAdminAction({
        request,
        adminUserId: adminUser.id,
        action: 'course.edit_day',
        targetType: 'course_content',
        targetId: String(dayNum),
        before,
        after,
      });
    }

    return NextResponse.json<ApiResponse>({
      data: afterRow,
      error: null,
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    console.error('Course content PATCH error:', err);
    return NextResponse.json<ApiResponse>({
      data: null,
      error: err instanceof Error ? err.message : '更新失敗',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
