import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionFromRequest } from '@/lib/auth';
import type { ApiResponse } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json<ApiResponse>({ data: null, error: '請先登入', timestamp: new Date().toISOString() }, { status: 401 });
    }

    const { data: journey, error } = await supabaseAdmin
      .from('journeys')
      .select('*')
      .eq('user_id', session.userId)
      .eq('is_active', true)
      .single();

    if (error || !journey) {
      return NextResponse.json<ApiResponse>({ data: null, error: null, timestamp: new Date().toISOString() });
    }

    return NextResponse.json<ApiResponse>({
      data: { journey },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Journey me error:', error);
    return NextResponse.json<ApiResponse>({ data: null, error: '伺服器錯誤', timestamp: new Date().toISOString() }, { status: 500 });
  }
}
