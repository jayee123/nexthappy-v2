import { defineConfig } from '@playwright/test';
import { config as loadEnv } from 'dotenv';

// 針對「已部署的正式站」跑 E2E（不啟本機 dev server）。
// 讀 .env.production 取得 JWT_SECRET，才能簽出正式站認得的 session cookie。
loadEnv({ path: '.env.production' });

export default defineConfig({
  testDir: './e2e',
  testMatch: 'prod-verification.spec.ts',
  timeout: 45_000,
  retries: 1,
  reporter: [['list']],
  use: {
    baseURL: 'https://nexthappy.sakilu-dev.uk',
    headless: true,
    ignoreHTTPSErrors: true,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
