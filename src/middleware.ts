import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { MARKET_REGISTER_URL } from '@/lib/market';

// v1.5.x: /welcome 加入公開路徑（首次訪客的 6 頁產品導引、未登入也要看得到）
// /images 加入公開路徑保險（Cover 圖等靜態素材、next/image 雖然走 /_next/image 但直接路徑也放行）
// #3a: /api/auth/register 已移除（私版停用獨立註冊），白名單一併撤掉。
// /auth/register 保留、但只是 302 到公版註冊頁的轉接點。
const PUBLIC_PATHS = [
  '/auth/login',
  '/auth/register',
  '/api/auth/login',
  '/sso', // Market → App SSO 接收端（未登入時帶 token 進來）
  '/welcome',
  '/images',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 靜態資源不處理
  if (pathname.startsWith('/_next') || pathname.startsWith('/icons') || pathname === '/manifest.json') {
    return NextResponse.next();
  }

  // HTTPS 強制：Vercel 上的 production/preview 都應該走 https
  // 本地 dev (localhost) 例外：dev 是 http://localhost
  const proto = request.headers.get('x-forwarded-proto');
  const host = request.headers.get('host') || '';
  const isLocalDev = host.startsWith('localhost') || host.startsWith('127.0.0.1');
  if (!isLocalDev && proto && proto !== 'https') {
    const httpsUrl = request.nextUrl.clone();
    httpsUrl.protocol = 'https:';
    return NextResponse.redirect(httpsUrl, 308);
  }

  // #3a：註冊一律走公版。
  // 這段必須在 middleware 做，不能只靠 page 的 redirect()：
  // /auth/register 沒有動態資料，Next 會在 build 時預渲染並以 s-maxage=31536000 快取，
  // 快取住的 307 不帶 Location → 正式站上點註冊會停在原地（實測過）。
  // middleware 跑在 full route cache 之前，不受影響。
  if (pathname.startsWith('/auth/register')) {
    return NextResponse.redirect(MARKET_REGISTER_URL, 307);
  }

  // 公開路徑不檢查
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // API routes 不做 redirect，各自處理 401
  // （cron 等 server-to-server 呼叫無 session cookie，缺此放行會被導向登入頁而失敗）
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // 檢查登入狀態
  const session = request.cookies.get('happy_session');
  if (!session) {
    // 用 nextUrl.clone() 代替 new URL(..., request.url)
    // 原因：Vercel edge 做 TLS termination，request.url 在 serverless function 裡
    //      會是 http://（內部 proxy scheme），導致使用者被踢到 http 版登入頁
    //      nextUrl 會尊重 x-forwarded-proto header，產生正確的 https URL
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/auth/login';
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
