import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createToken, verifyPassword, COOKIE_NAME } from '@/lib/auth';
import type { ApiResponse } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json<ApiResponse>({
        data: null,
        error: '請填入 Email 與密碼',
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (error || !user) {
      return NextResponse.json<ApiResponse>({
        data: null,
        error: 'Email 或密碼錯誤',
        timestamp: new Date().toISOString(),
      }, { status: 401 });
    }

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json<ApiResponse>({
        data: null,
        error: 'Email 或密碼錯誤',
        timestamp: new Date().toISOString(),
      }, { status: 401 });
    }

    // Week 2 Session 2A: 擋停權 user 登入
    if (user.suspended_at) {
      return NextResponse.json<ApiResponse>({
        data: null,
        error: '此帳號已被停權、若有疑問請聯繫客服',
        timestamp: new Date().toISOString(),
      }, { status: 403 });
    }

    const token = await createToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    const response = NextResponse.json<ApiResponse>({
      data: { user: { id: user.id, email: user.email, name: user.name } },
      error: null,
      timestamp: new Date().toISOString(),
    });

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json<ApiResponse>({
      data: null,
      error: '伺服器錯誤，請稍後再試',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json<ApiResponse>({
    data: { success: true },
    error: null,
    timestamp: new Date().toISOString(),
  });

  response.cookies.delete(COOKIE_NAME);
  return response;
}
