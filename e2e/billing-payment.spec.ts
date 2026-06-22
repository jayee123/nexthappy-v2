import { test, expect, type Page } from '@playwright/test';
import { SignJWT } from 'jose';

const TRIAL_USER = {
  userId: 'f9090753-48b6-497b-a8ea-0faeb64b89af',
  email: 'jeff@milkidea.com',
  name: 'Jeff',
};

const PREMIUM_USER = {
  userId: '2a89c766-b84f-4519-8f3e-6b6ce6dbed63',
  email: 'test@nexthappy.test',
  name: '測試用戶',
};

async function loginAs(page: Page, user = TRIAL_USER) {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  const token = await new SignJWT(user as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret);

  await page.context().addCookies([
    {
      name: 'happy_session',
      value: token,
      domain: 'localhost',
      path: '/',
    },
  ]);
}

async function makeAuthCookie(user = TRIAL_USER): Promise<string> {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  return new SignJWT(user as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret);
}

// ─── Middleware: API routes bypass auth redirect ────────────

test('middleware lets API routes through without redirect', async ({ request }) => {
  const res = await request.get('/api/billing/me');
  expect(res.status()).toBe(401);
  expect(res.headers()['location']).toBeUndefined();
});

test('middleware redirects page routes without cookie', async ({ page }) => {
  const res = await page.goto('/settings/billing');
  expect(res?.url()).toContain('/welcome');
});

// ─── Billing Page (authenticated) ──────────────────────────

test('billing page loads and shows 3 plan cards', async ({ page }) => {
  await loginAs(page);
  await page.goto('/settings/billing');
  await expect(page.locator('h1')).toContainText('我的訂閱', { timeout: 10_000 });
  const planCards = page.locator('h3:has-text("Basic"), h3:has-text("Advanced"), h3:has-text("Premium")');
  await expect(planCards).toHaveCount(3);
});

test('billing page shows usage bar', async ({ page }) => {
  await loginAs(page);
  await page.goto('/settings/billing');
  await expect(page.locator('text=當前方案')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('text=本月已用對話次數')).toBeVisible();
});

test('trial user sees subscribe button', async ({ page }) => {
  await loginAs(page, TRIAL_USER);
  await page.goto('/settings/billing');
  await expect(page.locator('button:has-text("選擇方案")').first()).toBeVisible({ timeout: 10_000 });
});

test('clicking plan opens confirmation modal with bind-card prompt', async ({ page }) => {
  await loginAs(page, TRIAL_USER);
  await page.goto('/settings/billing');
  await page.locator('button:has-text("選擇方案")').first().click({ timeout: 10_000 });
  await expect(page.locator('text=確認訂閱')).toBeVisible();
  await expect(page.locator('text=前往綁卡付款')).toBeVisible();
});

test('confirmation modal dismisses on cancel click', async ({ page }) => {
  await loginAs(page, TRIAL_USER);
  await page.goto('/settings/billing');
  await page.locator('button:has-text("選擇方案")').first().click({ timeout: 10_000 });
  await expect(page.locator('text=確認訂閱')).toBeVisible();
  await page.locator('button:has-text("再考慮一下")').click();
  await expect(page.locator('text=確認訂閱')).not.toBeVisible();
});

test('premium user sees cancel button and retention modal', async ({ page }) => {
  await loginAs(page, PREMIUM_USER);
  await page.goto('/settings/billing');
  const cancelBtn = page.locator('button:has-text("取消訂閱")');
  await expect(cancelBtn).toBeVisible({ timeout: 10_000 });
  await cancelBtn.click();
  await expect(page.locator('text=我們很遺憾看到您想要取消')).toBeVisible();
  await page.locator('button:has-text("保留我的訂閱")').click();
  await expect(page.locator('text=我們很遺憾看到您想要取消')).not.toBeVisible();
});

// ─── Payment query param toast ─────────────────────────────

test('shows success toast on ?payment=success', async ({ page }) => {
  await loginAs(page);
  await page.goto('/settings/billing?payment=success');
  await expect(page.locator('text=付款成功')).toBeVisible({ timeout: 10_000 });
});

test('shows error toast on ?payment=failed', async ({ page }) => {
  await loginAs(page);
  await page.goto('/settings/billing?payment=failed');
  await expect(page.locator('text=付款失敗')).toBeVisible({ timeout: 10_000 });
});

// ─── Callback API ──────────────────────────────────────────

test('callback rejects invalid ChkValue', async ({ request }) => {
  const form = new URLSearchParams({
    web: 'S2502249051',
    Td: 'TEST_ORDER_E2E',
    MN: '299',
    errcode: '00',
    errmsg: 'Success',
    ChkValue: 'INVALID_SIGNATURE',
    buysafeno: 'BSN_E2E',
    note1: TRIAL_USER.userId,
  });

  const res = await request.post('/api/payment/callback', {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    data: form.toString(),
  });

  expect(res.status()).toBe(400);
  const text = await res.text();
  expect(text).toContain('ChkValue mismatch');
});

// ─── Auth guard on payment APIs ────────────────────────────

test('bind-card returns 401 without session', async ({ request }) => {
  const res = await request.post('/api/payment/bind-card', {
    headers: { 'Content-Type': 'application/json' },
    data: JSON.stringify({ tier: 'basic' }),
  });
  expect(res.status()).toBe(401);
});

test('checkout returns 401 without session', async ({ request }) => {
  const res = await request.post('/api/payment/checkout', {
    headers: { 'Content-Type': 'application/json' },
    data: JSON.stringify({ action: 'subscribe', targetTier: 'basic' }),
  });
  expect(res.status()).toBe(401);
});

test('bind-card rejects invalid tier with auth', async ({ request }) => {
  const token = await makeAuthCookie(TRIAL_USER);
  const res = await request.post('/api/payment/bind-card', {
    headers: {
      'Content-Type': 'application/json',
      Cookie: `happy_session=${token}`,
    },
    data: JSON.stringify({ tier: 'invalid_plan' }),
  });
  expect(res.status()).toBe(400);
});

test('checkout rejects invalid action with auth', async ({ request }) => {
  const token = await makeAuthCookie(TRIAL_USER);
  const res = await request.post('/api/payment/checkout', {
    headers: {
      'Content-Type': 'application/json',
      Cookie: `happy_session=${token}`,
    },
    data: JSON.stringify({ action: 'INVALID_ACTION', targetTier: 'basic' }),
  });
  expect(res.status()).toBe(400);
});
