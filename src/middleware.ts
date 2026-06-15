import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = [
  '/auth/login',
  '/auth/register',
  '/api/auth/login',
  '/api/auth/register',
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

  // 公開路徑不檢查
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // 檢查登入狀態
  const session = request.cookies.get('happy_session');
  if (!session) {
    // 用 nextUrl.clone() 代替 new URL(..., request.url)
    // 原因：Vercel edge 做 TLS termination，request.url 在 serverless function 裡
    //      會是 http://（內部 proxy scheme），導致使用者被踢到 http 版登入頁
    //      nextUrl 會尊重 x-forwarded-proto header，產生正確的 https URL
    const welcomeUrl = request.nextUrl.clone();
    welcomeUrl.pathname = '/welcome';
    return NextResponse.redirect(welcomeUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
