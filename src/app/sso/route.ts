import { NextResponse } from 'next/server'
import { createHmac, timingSafeEqual, randomBytes } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { createToken, COOKIE_NAME } from '@/lib/auth'

// Market → App SSO 接收端（token handoff）
// GET /sso?token=<jwt>
//   1. 用 SSO_SECRET 驗 HS256 token（與 Market 端同一把 sso_secret）
//   2. 檢 exp / app=happy
//   3. 找/連/建 happy.users(nuwa_user_id=sub) → 發 happy_session cookie → 導 /

interface SsoPayload {
  sub: string // nuwa_user_id
  email?: string
  name?: string
  app?: string
  to?: string // 'welcome' | 'app' | 'admin'：公版指定進來後導向（未帶 → 交給首頁判斷）
  exp?: number
}

function verifySsoToken(token: string, secret: string): SsoPayload | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [h, p, s] = parts
  const expected = createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url')
  const sigBuf = Buffer.from(s)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null
  try {
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8')) as SsoPayload
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null
    return payload
  } catch {
    return null
  }
}

// 組公開網址：request.url 在容器內是 http://0.0.0.0:3000，導向要用反向代理的 x-forwarded-host
function publicUrl(request: Request, path: string): string {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || new URL(request.url).host
  const proto = request.headers.get('x-forwarded-proto') || 'https'
  return `${proto}://${host}${path}`
}

function loginFail(request: Request, reason: string) {
  return NextResponse.redirect(publicUrl(request, `/auth/login?error=sso_${reason}`))
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token')
  if (!token) return loginFail(request, 'no_token')

  const secret = process.env.SSO_SECRET
  if (!secret) {
    console.error('[sso] SSO_SECRET not configured')
    return loginFail(request, 'not_configured')
  }

  const payload = verifySsoToken(token, secret)
  if (!payload || !payload.sub) return loginFail(request, 'invalid')
  if (payload.app && payload.app !== 'happy') return loginFail(request, 'wrong_app')

  const nuwaUserId = payload.sub

  // 1) 先用 nuwa_user_id 找
  let { data: user } = await supabaseAdmin
    .from('users')
    .select('id, email, name, mbti_self')
    .eq('nuwa_user_id', nuwaUserId)
    .maybeSingle()

  // 2) 找不到但有 email → 用 email 找並補綁 nuwa_user_id（既有用戶第一次 SSO）
  if (!user && payload.email) {
    const { data: byEmail } = await supabaseAdmin
      .from('users')
      .select('id, email, name, mbti_self')
      .eq('email', payload.email)
      .maybeSingle()
    if (byEmail) {
      await supabaseAdmin.from('users').update({ nuwa_user_id: nuwaUserId }).eq('id', byEmail.id)
      user = byEmail
    }
  }

  // 3) 還是沒有 → 建立（SSO 用戶無密碼，password_hash 放隨機值、只能走 SSO）
  if (!user) {
    const { data: created, error } = await supabaseAdmin
      .from('users')
      .insert({
        nuwa_user_id: nuwaUserId,
        email: payload.email || `${nuwaUserId}@sso.local`,
        name: payload.name || 'User',
        password_hash: randomBytes(32).toString('hex'),
        current_plan: 'trial',
      })
      .select('id, email, name, mbti_self')
      .single()
    if (error || !created) {
      console.error('[sso] create user failed:', error)
      return loginFail(request, 'create_failed')
    }
    user = created
  }

  // 發 happy_session cookie
  const sessionToken = await createToken({ userId: user.id, email: user.email, name: user.name })
  const isProd = process.env.NODE_ENV === 'production'

  // 公版指定導向：
  //   welcome = 先看導覽、app = 直接進 App、admin = 課程後台（公版「App 管理」點進來的）
  //   未帶則交給首頁自行判斷
  // 注意：admin 只是「落點」，是否真的有後台權限由 /admin 的 layout 再驗一次
  //（公版管理者不等於私版管理者，兩邊的權限是分開的）。
  const appPath = (user as { mbti_self?: string | null }).mbti_self ? '/chat' : '/onboarding'
  const dest =
    payload.to === 'welcome' ? `/welcome?next=${encodeURIComponent(appPath)}`
    : payload.to === 'admin' ? '/admin'
    : payload.to === 'app' ? appPath
    : '/'
  const res = NextResponse.redirect(publicUrl(request, dest))
  res.cookies.set(COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax', // 允許跨站導向後帶 cookie
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
  return res
}
