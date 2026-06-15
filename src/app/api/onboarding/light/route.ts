// 放置路徑：src/app/api/onboarding/light/route.ts
// v1.3.2b 新增：trier-first 輕量 onboarding endpoint
//   - 只設 user.mbti_self + mbti_confidence + mbti_set_at (+ 選填 name)
//   - **不建立 journey**（journey 由 Mode A 獨立 onboarding 創建、v1.3.2c）
//
// 設計對應：docs/architecture-phase-2-proposal.md §1.1 共用 onboarding 2 步
// Schema 對應：Migration 005 users.mbti_self 等欄位

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionFromRequest } from '@/lib/auth';
import type { ApiResponse } from '@/types';

const MBTI_REGEX = /^[EI][SN][TF][JP]$/;

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json<ApiResponse>(
        { data: null, error: '請先登入', timestamp: new Date().toISOString() },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      mbti_self,
      mbti_confidence = 'medium',
      name,
    } = body as {
      mbti_self: string;
      mbti_confidence?: 'low' | 'medium' | 'high';
      name?: string;
    };

    // 驗證 MBTI 格式（4 字母）
    if (!mbti_self || !MBTI_REGEX.test(mbti_self.toUpperCase())) {
      return NextResponse.json<ApiResponse>(
        {
          data: null,
          error: 'MBTI 格式不正確，請選 4 字母組合（例如 ENFJ、ISTJ）',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // 驗證 mbti_confidence
    if (!['low', 'medium', 'high'].includes(mbti_confidence)) {
      return NextResponse.json<ApiResponse>(
        { data: null, error: 'mbti_confidence 必須是 low / medium / high', timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    // 更新 user
    const updateFields: Record<string, string> = {
      mbti_self: mbti_self.toUpperCase(),
      mbti_confidence,
      mbti_set_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (name && name.trim()) {
      updateFields.name = name.trim();
    }

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .update(updateFields)
      .eq('id', session.userId)
      .select('id, email, name, mbti_self, mbti_confidence, mbti_set_at')
      .single();

    if (error || !user) {
      console.error('[onboarding/light] update error:', error);
      throw new Error('儲存失敗');
    }

    return NextResponse.json<ApiResponse>({
      data: { user },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[onboarding/light] error:', error);
    return NextResponse.json<ApiResponse>(
      { data: null, error: '伺服器錯誤，請稍後再試', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
