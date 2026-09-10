import { cache } from 'react';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { supabaseAdmin } from './supabase';
import type { User } from '@/types';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret-change-in-production');
const COOKIE_NAME = 'happy_session';

export interface SessionPayload {
  userId: string;
  email: string;
  name: string | null;
}

// 產生 JWT Token
//
// accessUntilSec（epoch 秒）：這張 session 的效期上限，來自公版 SSO token 的
// access_until —— 試用進場時 = 試用到期。少了它，30 天的 session 會比 14 天的
// 試用活得久：試用到期後直接打私版網址、cookie 還在，launch gate 形同虛設。
// 效期直接烙進 JWT 的 exp（簽發當下試用到期日已知，不用每請求查 DB）；
// 試用中途被後台延長的人，從公版再點一次「進入 App」就會拿到新效期的 session。
export async function createToken(payload: SessionPayload, accessUntilSec?: number): Promise<string> {
  const thirtyDaysSec = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;
  const expSec = accessUntilSec ? Math.min(accessUntilSec, thirtyDaysSec) : thirtyDaysSec;
  return await new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expSec)
    .sign(JWT_SECRET);
}

// 驗證 JWT Token
export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * 這個 user 是否已被停權。
 *
 * ⚠️ 為什麼要在每次取 session 時查一次 DB：
 *
 * session 是無狀態 JWT、效期 30 天，簽出去就收不回來。後台按「停權」只是把
 * `users.suspended_at` 寫進 DB —— 在這個檢查加進來之前，`suspended_at` 全站
 * 只出現在後台的 UI 與 API，`/sso`、middleware、任何 API 都沒有讀它。
 * 結果是停權完全沒有作用：管理員看到紅色「已停權」，那個人手上的 cookie
 * 卻照樣能用到 30 天後，從公版點一次「進入 App」還會拿到新的一張。
 *
 * 要讓停權即時生效，只有兩條路：縮短 session 效期，或每次驗證時查一次 DB。
 * 這裡選後者 —— 多一次 `select suspended_at`，而呼叫端幾乎都本來就要查 DB。
 *
 * 查詢失敗時**不**擋人（回 false）：DB 短暫不通不應該讓全站登出。
 * 停權是管理動作，不是安全邊界的最後一道；真正不可繞過的檢查在 /sso。
 *
 * 用 React cache() 包起來，讓同一個請求裡只查一次：
 * 一個頁面請求會經過 layout → page →（可能還有）內層元件，各自呼叫一次
 * getSession()，不去重的話同一筆 suspended_at 會被查三次。
 * cache() 的作用域是單一請求，所以「這個請求進行到一半被停權」不會被看見 ——
 * 那沒有影響，下一個請求就擋住了。
 */
const isSuspended = cache(async function isSuspended(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('suspended_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('[auth] 查詢停權狀態失敗，本次不擋:', error.message);
    return false;
  }
  return Boolean(data?.suspended_at);
});

// 從 Cookie 取得當前 session
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload) return null;
  if (await isSuspended(payload.userId)) return null;
  return payload;
}

// 從 Request Headers 取得 session（API Routes 用）
export async function getSessionFromRequest(request: Request): Promise<SessionPayload | null> {
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;

  const payload = await verifyToken(match[1]);
  if (!payload) return null;
  if (await isSuspended(payload.userId)) return null;
  return payload;
}

// 密碼 hash（使用 crypto，不引入 bcrypt 避免 edge runtime 問題）
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + process.env.JWT_SECRET);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const computed = await hashPassword(password);
  return computed === hash;
}

// 取得當前用戶完整資料
export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  if (!session) return null;

  const { data } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', session.userId)
    .single();

  return data;
}

export { COOKIE_NAME };
