// 放置路徑：src/app/api/conversation/[id]/route.ts
//
// v1.3.5 新增：取單一 conversation 完整 metadata + messages（給 export PDF page 用）
//
// 使用：GET /api/conversation/abc123 → 返回該 conv 完整 data
//
// Security：user_id-based owner check（不分 trier / journey）

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionFromRequest } from '@/lib/auth';
import type { ApiResponse } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json<ApiResponse>(
        { data: null, error: '請先登入', timestamp: new Date().toISOString() },
        { status: 401 }
      );
    }

    // 取 conversation（user_id security check）
    const { data: conv, error } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', session.userId)
      .maybeSingle();

    if (error || !conv) {
      return NextResponse.json<ApiResponse>(
        { data: null, error: '找不到對話', timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    // 取 user 資料（含 MBTI、name）
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, email, name, mbti_self')
      .eq('id', session.userId)
      .single();

    // 若有 journey 連帶取 partner / round 資料
    let journey = null;
    if (conv.journey_id) {
      const { data: j } = await supabaseAdmin
        .from('journeys')
        .select('partner_nickname, mbti_partner, relationship_type, round_label, round_number')
        .eq('id', conv.journey_id)
        .maybeSingle();
      journey = j;
    }

    // Day N course content（practice 模式才有）
    let course = null;
    if (conv.context_type !== 'consultant' && typeof conv.day_number === 'number') {
      const { data: c } = await supabaseAdmin
        .from('course_content')
        .select('theme, subtitle, knowledge_point')
        .eq('day_number', conv.day_number)
        .maybeSingle();
      course = c;
    }

    return NextResponse.json<ApiResponse>({
      data: {
        conversation: conv,
        user,
        journey,
        course,
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[conversation/[id]/GET]', err);
    return NextResponse.json<ApiResponse>(
      { data: null, error: '伺服器錯誤', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
