// 放置路徑：src/app/api/admin/guardrail-logs/[id]/route.ts
//
// PATCH /api/admin/guardrail-logs/<id>
//   Body: { reviewed?: boolean; reviewer_note?: string | null; verdict?: 'correct' | 'false_positive' | null }
//
// 給人工標記「這筆是不是誤判」、留備註，用於後續打磨 guardrail prompt。
// verdict='false_positive' 的案例會被 api/guardrail-check.py 動態撈出來
// （見 src/lib/ai/guardrailCorrections.ts），塞進分類 prompt 當 few-shot
// 糾正範例——人工複查的結論會真的回頭影響下一次 AI 的判斷。
// 寫 audit log（before/after diff），同 users/[id] PATCH 的慣例。

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { logAdminAction } from '@/lib/admin/auditLog';
import { supabaseAdmin } from '@/lib/supabase';
import type { ApiResponse } from '@/types';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error: authError, adminUser } = await requireAdmin(request);
  if (authError) return authError;
  if (!adminUser) {
    return NextResponse.json<ApiResponse>(
      { data: null, error: '無 admin user', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }

  try {
    const logId = params.id;
    if (!uuidRegex.test(logId)) {
      return NextResponse.json<ApiResponse>(
        { data: null, error: 'id 格式不對', timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    const body = await request.json();

    const { data: currentLog, error: fetchError } = await supabaseAdmin
      .from('guardrail_logs')
      .select('id, reviewed, reviewer_note, verdict')
      .eq('id', logId)
      .maybeSingle();

    if (fetchError || !currentLog) {
      return NextResponse.json<ApiResponse>(
        { data: null, error: '找不到這筆記錄', timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    const updates: Record<string, unknown> = {};
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};

    if (typeof body.reviewed === 'boolean' && body.reviewed !== currentLog.reviewed) {
      updates.reviewed = body.reviewed;
      before.reviewed = currentLog.reviewed;
      after.reviewed = body.reviewed;
    }

    if (body.reviewer_note !== undefined) {
      const newNote = body.reviewer_note === null ? null : String(body.reviewer_note).trim().slice(0, 2000) || null;
      if (newNote !== currentLog.reviewer_note) {
        updates.reviewer_note = newNote;
        before.reviewer_note = currentLog.reviewer_note;
        after.reviewer_note = newNote;
      }
    }

    if (body.verdict !== undefined) {
      if (body.verdict !== null && body.verdict !== 'correct' && body.verdict !== 'false_positive') {
        return NextResponse.json<ApiResponse>(
          { data: null, error: 'verdict 必須是 correct、false_positive 或 null', timestamp: new Date().toISOString() },
          { status: 400 }
        );
      }
      if (body.verdict !== currentLog.verdict) {
        updates.verdict = body.verdict;
        before.verdict = currentLog.verdict;
        after.verdict = body.verdict;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json<ApiResponse>(
        { data: null, error: '沒有任何欄位要更新', timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    const { data: updatedLog, error: updateError } = await supabaseAdmin
      .from('guardrail_logs')
      .update(updates)
      .eq('id', logId)
      .select('id, created_at, user_id, session_key, route, message, outcome, risk_tier, refusal_text, reviewed, reviewer_note, verdict')
      .single();

    if (updateError || !updatedLog) {
      console.error('[PATCH /api/admin/guardrail-logs/[id]] update failed:', updateError);
      return NextResponse.json<ApiResponse>(
        { data: null, error: '更新失敗', timestamp: new Date().toISOString() },
        { status: 500 }
      );
    }

    await logAdminAction({
      request,
      adminUserId: adminUser.id,
      action: 'guardrail_log.review',
      targetType: 'guardrail_log',
      targetId: logId,
      before,
      after,
    });

    return NextResponse.json<ApiResponse>({
      data: { log: updatedLog },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[PATCH /api/admin/guardrail-logs/[id]] unexpected error:', err);
    return NextResponse.json<ApiResponse>(
      { data: null, error: '伺服器錯誤', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
