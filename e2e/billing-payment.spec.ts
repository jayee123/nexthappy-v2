/**
 * 我的方案（唯讀）— 驗收測試
 *
 * 付費已統一到公版：私版不再有訂閱／升降級／綁卡／取消，
 * 對應的 API（/api/payment/*）與扣款 cron 也已移除。
 * 這裡驗證兩件事：頁面仍能正確顯示方案與用量、付費端點確實不存在。
 */
import { test, expect, type Page } from '@playwright/test';
import { SignJWT } from 'jose';

const TEST_USER = {
  userId: 'f9090753-48b6-497b-a8ea-0faeb64b89af',
  email: 'jeff@milkidea.com',
  name: 'Jeff',
};

const REMOVED_PAYMENT_ENDPOINTS = [
  '/api/payment/bind-card',
  '/api/payment/checkout',
  '/api/payment/callback',
  '/api/cron/charge-renewals',
  '/api/cron/retry-failed',
  '/api/cron/expire-trials',
];

async function loginAs(page: Page, user = TEST_USER) {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  const token = await new SignJWT(user as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret);

  await page.context().addCookies([
    { name: 'happy_session', value: token, domain: 'localhost', path: '/' },
  ]);
}

// ─── Middleware ────────────────────────────────────────────

test('API routes 不做轉址、各自回 401', async ({ request }) => {
  const res = await request.get('/api/billing/me');
  expect(res.status()).toBe(401);
  expect(res.headers()['location']).toBeUndefined();
});

test('未登入進 /settings/billing 會被導走', async ({ page }) => {
  const res = await page.goto('/settings/billing');
  expect(res?.url()).not.toContain('/settings/billing');
});

// ─── 我的方案（唯讀）──────────────────────────────────────

test('顯示目前方案與本月用量', async ({ page }) => {
  await loginAs(page);
  await page.goto('/settings/billing');

  await expect(page.getByRole('heading', { name: '我的方案' })).toBeVisible();
  await expect(page.getByText('目前方案')).toBeVisible();
  await expect(page.getByText('本月已用對話次數')).toBeVisible();
});

test('提供前往公版管理訂閱的外連', async ({ page }) => {
  await loginAs(page);
  await page.goto('/settings/billing');

  const link = page.getByRole('link', { name: '前往 NUWA 管理訂閱' });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', /nuwa\.chg2asc\.com/);
});

test('頁面不再有任何付費操作', async ({ page }) => {
  await loginAs(page);
  await page.goto('/settings/billing');

  for (const label of ['立即訂閱', '升級方案', '降級', '取消訂閱', '綁定信用卡']) {
    await expect(page.getByRole('button', { name: label })).toHaveCount(0);
  }
});

// ─── 付費端點確實已移除 ────────────────────────────────────

test.describe('付費端點已移除', () => {
  for (const endpoint of REMOVED_PAYMENT_ENDPOINTS) {
    test(`${endpoint} 回 404`, async ({ request }) => {
      const post = await request.post(endpoint, { data: {} });
      const get = await request.get(endpoint);
      expect(
        post.status() === 404 && get.status() === 404,
        `${endpoint} 應已不存在（POST=${post.status()} GET=${get.status()}）`,
      ).toBe(true);
    });
  }
});
