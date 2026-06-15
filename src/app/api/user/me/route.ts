// 放置路徑：src/app/api/user/me/route.ts
// v1.3.2b 新增：GET 返回當前 user 的基本資料（含 mbti_self、用於 trier-first routing gate）
// v1.3.8 新增：PATCH 讓 user 在 settings page 更新 mbti_self / name / mbti_confidence
//             （對應 spec v1.3.8 hotfix #8 — user 中途發現 onboarding MBTI 不對、可自行更新）

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionFromRequest } from '@/lib/auth';
import type { ApiResponse } from '@/types';

const MBTI_REGEX = /^[EI][SN][TF][JP]$/;

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json<ApiResponse>(
        { data: null, error: '請先登入', timestamp: new Date().toISOString() },
        { status: 401 }
      );
    }

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, email, name, mbti_self, mbti_confidence, mbti_set_at, created_at')
      .eq('id', session.userId)
      .single();

    if (error || !user) {
      return NextResponse.json<ApiResponse>(
        { data: null, error: '找不到使用者', timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    return NextResponse.json<ApiResponse>({
      data: { user },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[user/me GET]', error);
    return NextResponse.json<ApiResponse>(
      { data: null, error: '伺服器錯誤', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
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
      mbti_confidence,
      name,
    } = body as {
      mbti_self?: string;
      mbti_confidence?: 'low' | 'medium' | 'high';
      name?: string;
    };

    const updateFields: Record<string, string> = {
      updated_at: new Date().toISOString(),
    };

    // MBTI 更新（optional、但若提供必須通過驗證）
    if (typeof mbti_self === 'string') {
      const normalized = mbti_self.toUpperCase().trim();
      if (!MBTI_REGEX.test(normalized)) {
        return NextResponse.json<ApiResponse>(
          {
            data: null,
            error: 'MBTI 格式不正確，請輸入 4 字母組合（例如 ENFJ、ISTJ）',
            timestamp: new Date().toISOString(),
          },
          { status: 400 }
        );
      }
      updateFields.mbti_self = normalized;
      updateFields.mbti_set_at = new Date().toISOString();
    }

    if (typeof mbti_confidence === 'string') {
      if (!['low', 'medium', 'high'].includes(mbti_confidence)) {
        return NextResponse.json<ApiResponse>(
          { data: null, error: 'mbti_confidence 必須是 low / medium / high', timestamp: new Date().toISOString() },
          { status: 400 }
        );
      }
      updateFields.mbti_confidence = mbti_confidence;
    }

    if (typeof name === 'string' && name.trim()) {
      updateFields.name = name.trim().slice(0, 50);
    }

    // 沒任何欄位要更新
    if (Object.keys(updateFields).length === 1) {
      return NextResponse.json<ApiResponse>(
        { data: null, error: '沒有提供任何要更新的欄位', timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .update(updateFields)
      .eq('id', session.userId)
      .select('id, email, name, mbti_self, mbti_confidence, mbti_set_at, created_at')
      .single();

    if (error || !user) {
      console.error('[user/me PATCH] update error:', error);
      return NextResponse.json<ApiResponse>(
        { data: null, error: '儲存失敗', timestamp: new Date().toISOString() },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse>({
      data: { user },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[user/me PATCH] error:', error);
    return NextResponse.json<ApiResponse>(
      { data: null, error: '伺服器錯誤、請稍後再試', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
