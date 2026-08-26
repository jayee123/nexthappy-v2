import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { MARKET_REGISTER_URL, MARKET_LOGIN_URL } from '@/lib/market';

// v1.5.x: /welcome 加入公開路徑（首次訪客的 6 頁產品導引、未登入也要看得到）
// /images 加入公開路徑保險（Cover 圖等靜態素材、next/image 雖然走 /_next/image 但直接路徑也放行）
// #3a: /api/auth/register 已移除（私版停用獨立註冊），白名單一併撤掉。
// /auth/register、/auth/login 保留在白名單，但實際上只是導向公版的轉接點（見下方）。
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

  // HTTPS 強制：http 進來一律導向 https。
  // ⚠️ 不能用 request.nextUrl.clone() —— 反向代理送進容器的 Host 是 0.0.0.0:3000，
  //    clone 出來會變成 https://0.0.0.0:3000（容器外連不到）。
  //    對外主機一律取 x-forwarded-host，與 sso/route.ts 的 publicUrl() 同源（819e5fb）。
  const proto = request.headers.get('x-forwarded-proto');
  const publicHost =
    request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
  const isLocalDev = publicHost.startsWith('localhost') || publicHost.startsWith('127.0.0.1');
  if (!isLocalDev && proto && proto !== 'https') {
    const target = new URL(
      request.nextUrl.pathname + request.nextUrl.search,
      `https://${publicHost}`
    );
    return NextResponse.redirect(target, 308);
  }

  // #3a：註冊一律走公版。
  // 這段必須在 middleware 做，不能只靠 page 的 redirect()：
  // /auth/register 沒有動態資料，Next 會在 build 時預渲染並以 s-maxage=31536000 快取，
  // 快取住的 307 不帶 Location → 正式站上點註冊會停在原地（實測過）。
  // middleware 跑在 full route cache 之前，不受影響。
  if (pathname.startsWith('/auth/register')) {
    return NextResponse.redirect(MARKET_REGISTER_URL, 307);
  }

  // 登入同樣一律走公版：私版沒有自己的帳號，密碼登入已移除。
  // 例外：SSO 失敗會導回 /auth/login?error=sso_*，那種情況要讓用戶看到原因，
  //       不能直接彈去公版（否則失敗訊息消失、用戶不知道發生什麼事）。
  if (pathname.startsWith('/auth/login') && !request.nextUrl.searchParams.has('error')) {
    return NextResponse.redirect(MARKET_LOGIN_URL, 307);
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

  // 檢查登入狀態：未登入直接導向公版登入（私版不再有自己的登入頁）。
  // 登入後從公版「App 服務」進來，由 /sso 建立私版 session。
  const session = request.cookies.get('happy_session');
  if (!session) {
    return NextResponse.redirect(MARKET_LOGIN_URL, 307);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
