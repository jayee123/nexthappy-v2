import { test, expect, type BrowserContext } from '@playwright/test';
import { SignJWT } from 'jose';

// 正式站整站 E2E 驗證：公開頁 / 中介層 / 認證頁 / 金流 API / admin token 檢視。
// jeff 同時是一般用戶又是 admin（is_admin=true），用他的 JWT cookie 跑認證測試。

const JEFF = {
  userId: 'f9090753-48b6-497b-a8ea-0faeb64b89af',
  email: 'jeff@milkidea.com',
  name: '宇',
};
const DOMAIN = 'nexthappy.sakilu-dev.uk';

async function sessionToken(user = JEFF): Promise<string> {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  return new SignJWT(user as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret);
}

async function loginJeff(context: BrowserContext): Promise<void> {
  const token = await sessionToken();
  await context.addCookies([{ name: 'happy_session', value: token, domain: DOMAIN, path: '/' }]);
}

// ─────────────────────────────────────────────
test.describe('公開頁（未登入）', () => {
  test('/welcome onboarding 頁載入', async ({ page }) => {
    const res = await page.goto('/welcome');
    expect(res?.status(), 'HTTP 狀態應 < 400').toBeLessThan(400);
    await expect(page.locator('button, a').first()).toBeVisible();
  });

  test('/auth/login 有密碼欄位', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  // #3a：私版停用獨立註冊 —— /auth/register 只剩 302 到 NUWA 公版註冊頁
  test('/auth/register 導向 NUWA 公版註冊', async ({ request }) => {
    const res = await request.get('/auth/register', { maxRedirects: 0 });
    expect(res.status(), '應為 3xx 轉址').toBeGreaterThanOrEqual(300);
    expect(res.status()).toBeLessThan(400);
    expect(res.headers()['location']).toContain('next.nuwa.chg2asc.com/register');
  });

  test('私版註冊 API 已移除（後門關閉）', async ({ request }) => {
    const res = await request.post('/api/auth/register', {
      data: { email: 'probe@example.com', password: 'x', invite_code: 'X' },
    });
    expect(res.status(), '應為 404（route 已刪除）').toBe(404);
  });
});

// ─────────────────────────────────────────────
test.describe('中介層 / 認證', () => {
  test('未登入進 /chat 會被導向登入頁', async ({ page }) => {
    await page.goto('/chat');
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('未登入打 /api/billing/me → 401（非導向 HTML）', async ({ request }) => {
    const res = await request.get('/api/billing/me');
    expect(res.status()).toBe(401);
  });

  // 付費已統一到公版，私版的付費端點與扣款 cron 全數移除
  test('私版付費端點已移除', async ({ request }) => {
    const res = await request.post('/api/payment/bind-card', { data: { tier: 'basic' } });
    expect(res.status(), 'route 應已不存在').toBe(404);
  });
});

// ─────────────────────────────────────────────
test.describe('認證後頁面（jeff）', () => {
  test.beforeEach(async ({ context }) => {
    await loginJeff(context);
  });

  test('/chat 載入且未被導回登入', async ({ page }) => {
    const t0 = Date.now();
    await page.goto('/chat');
    await expect(page).toHaveURL(/\/chat/);
    // 首次進入會先顯示「小羽正在準備中…」（要載入 AI context），實測需 8 秒以上，
    // 預設 5 秒會誤判成失敗。給 30 秒，並印出實際耗時以便觀察是否惡化。
    await expect(page.locator('textarea, input[type="text"]').first()).toBeVisible({ timeout: 30_000 });
    console.log(`  /chat 輸入框出現耗時 ${((Date.now() - t0) / 1000).toFixed(1)} 秒`);
  });

  test('/progress 進度頁載入', async ({ page }) => {
    const res = await page.goto('/progress');
    expect(res?.status()).toBeLessThan(400);
    await expect(page).not.toHaveURL(/\/auth\/login/);
  });

  test('/settings/billing 顯示三方案', async ({ page }) => {
    await page.goto('/settings/billing');
    await expect(page).toHaveURL(/\/settings\/billing/);
    await expect(page.locator('body')).toContainText('Basic');
    await expect(page.locator('body')).toContainText('Advanced');
    await expect(page.locator('body')).toContainText('Premium');
  });

  test('/api/billing/me 回傳含付款欄位', async ({ page }) => {
    const res = await page.request.get('/api/billing/me');
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.data).toBeTruthy();
    expect(json.data.plan).toBeTruthy();
    expect(json.data).toHaveProperty('has_payment_method');
  });

  test('/api/billing/plans 回三個可訂閱方案', async ({ page }) => {
    const res = await page.request.get('/api/billing/plans');
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.data.plans)).toBeTruthy();
    expect(json.data.plans.length).toBe(3);
  });
});

// ─────────────────────────────────────────────
test.describe('Admin（jeff is_admin）', () => {
  test.beforeEach(async ({ context }) => {
    await loginJeff(context);
  });

  test('/api/admin/subscriptions 回傳含 token_info', async ({ page }) => {
    const res = await page.request.get('/api/admin/subscriptions?limit=5');
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.data.subscriptions)).toBeTruthy();
    expect(json.data.subscriptions.length).toBeGreaterThan(0);
    // 併回的 token 檢視：每筆都有 token_info（含 bound 旗標）
    expect(json.data.subscriptions[0]).toHaveProperty('token_info');
    expect(json.data.subscriptions[0].token_info).toHaveProperty('bound');
    expect(json.data.subscriptions[0]).toHaveProperty('recent_transactions');
  });

  test('/admin/subscriptions 頁有 Token 欄', async ({ page }) => {
    await page.goto('/admin/subscriptions');
    await expect(page).toHaveURL(/\/admin\/subscriptions/);
    await expect(page.locator('th', { hasText: 'Token' })).toBeVisible();
  });
});
