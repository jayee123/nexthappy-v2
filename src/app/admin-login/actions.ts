// 放置路徑：src/app/admin-login/actions.ts
//
// 管理者專用的獨立登入動作，完全不經過 NUWA SSO。
//
// 刻意跟一般使用者登入分開的原因：
//   - 管理者是內部人員，不需要跟一般會員走一樣的 NUWA 帳號流程
//   - 這裡驗證的是 happy.users.password_hash（本機用 hashPassword 產生），
//     跟 NUWA 的帳密系統完全無關、互不影響
//   - 只有 is_admin = true 的帳號能透過這裡登入，其他帳號一律拒絕
//     （這不是給一般會員用的後門登入）

'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';
import { createToken, verifyPassword, COOKIE_NAME } from '@/lib/auth';

export async function adminLogin(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');

  if (!email || !password) {
    return { error: '請輸入 Email 與密碼' };
  }

  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('id, email, name, password_hash, is_admin, suspended_at')
    .ilike('email', email)
    .maybeSingle();

  if (error || !user) {
    return { error: 'Email 或密碼錯誤' };
  }

  if (!user.is_admin) {
    // 刻意跟「帳密錯誤」用同一句話，不透露「這個帳號存在但不是管理者」
    return { error: 'Email 或密碼錯誤' };
  }

  if (user.suspended_at) {
    return { error: '此帳號已被停權' };
  }

  const passwordOk = await verifyPassword(password, user.password_hash || '');
  if (!passwordOk) {
    return { error: 'Email 或密碼錯誤' };
  }

  const token = await createToken({
    userId: user.id,
    email: user.email,
    name: user.name,
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });

  redirect('/admin');
}
