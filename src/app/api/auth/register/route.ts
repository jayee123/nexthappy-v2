import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createToken, hashPassword, COOKIE_NAME } from '@/lib/auth';
import type { ApiResponse } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name, invite_code } = body;

    if (!email || !password || !invite_code) {
      return NextResponse.json<ApiResponse>({
        data: null,
        error: '請填入 Email、密碼與邀請碼',
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }

    // 驗證邀請碼
    const { data: codeData, error: codeError } = await supabaseAdmin
      .from('invite_codes')
      .select('*')
      .eq('code', invite_code.toUpperCase())
      .single();

    if (codeError || !codeData) {
      return NextResponse.json<ApiResponse>({
        data: null,
        error: '邀請碼無效，請確認後再試',
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }

    if (codeData.used_by) {
      return NextResponse.json<ApiResponse>({
        data: null,
        error: '此邀請碼已被使用',
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }

    if (codeData.expires_at && new Date(codeData.expires_at) < new Date()) {
      return NextResponse.json<ApiResponse>({
        data: null,
        error: '邀請碼已過期',
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }

    // 檢查 Email 是否已存在
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existingUser) {
      return NextResponse.json<ApiResponse>({
        data: null,
        error: '此 Email 已註冊，請直接登入',
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }

    // 建立用戶
    const passwordHash = await hashPassword(password);
    const { data: newUser, error: createError } = await supabaseAdmin
      .from('users')
      .insert({
        email: email.toLowerCase(),
        name: name || null,
        password_hash: passwordHash,
        invite_code: invite_code.toUpperCase(),
      })
      .select()
      .single();

    if (createError || !newUser) {
      throw new Error('建立帳號失敗');
    }

    // 標記邀請碼已使用
    await supabaseAdmin
      .from('invite_codes')
      .update({ used_by: newUser.id, used_at: new Date().toISOString() })
      .eq('code', invite_code.toUpperCase());

    // 建立 JWT Token
    const token = await createToken({
      userId: newUser.id,
      email: newUser.email,
      name: newUser.name,
    });

    const response = NextResponse.json<ApiResponse>({
      data: { user: { id: newUser.id, email: newUser.email, name: newUser.name } },
      error: null,
      timestamp: new Date().toISOString(),
    });

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      // 與 login 一致：正式環境用 none，紅陽跨網域 POST 導回時 session cookie 才會送出
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 天
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json<ApiResponse>({
      data: null,
      error: '伺服器錯誤，請稍後再試',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
