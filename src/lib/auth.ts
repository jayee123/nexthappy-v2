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
export async function createToken(payload: SessionPayload): Promise<string> {
  return await new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
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
 */
async function isSuspended(userId: string): Promise<boolean> {
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
}

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
