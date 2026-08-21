#!/usr/bin/env node
/**
 * scripts/dev-login.mjs —— 本機開發用的登入捷徑
 *
 * 為什麼需要這支：
 *   私版已經沒有自己的登入頁（帳號真值只在公版）。未登入的請求會被
 *   middleware 導到「正式站」的公版登入頁，而公版是依資料庫 apps.app_url
 *   把人送回「正式站」的私版 —— 不會回到 localhost。
 *   結果就是：本機永遠登不進去。
 *
 * 這支做的事：
 *   用 SSO_SECRET 自己簽一張跟公版格式完全相同的短效 token，
 *   讓你打自己本機的 /sso。沒有繞過任何驗證 —— /sso 該驗的照驗，
 *   只是簽發者從公版換成你自己（你本來就持有這把 secret）。
 *
 * 用法：
 *   node scripts/dev-login.mjs <nuwa_user_id> [--to app|welcome] [--port 3000]
 *
 *   nuwa_user_id 去公版資料庫 public.users 撈（就是你自己那筆的 id）。
 */
import { createHmac } from 'crypto';
import { readFileSync } from 'fs';

const TOKEN_TTL_SECONDS = 120; // 與公版 launch route 一致

// --- 讀 .env.local（不覆蓋已存在的環境變數）---
try {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
} catch {
  // 沒有 .env.local 也沒關係，可能直接用環境變數帶進來
}

// --- 參數 ---
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const to = flag('to', 'app');
const port = flag('port', '3000');

// 位置參數 = 扣掉所有 --flag 與其值之後剩下的第一個
const positional = [];
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) { i++; continue; } // 跳過 flag 與它的值
  positional.push(args[i]);
}
const nuwaUserId = positional[0];

if (!nuwaUserId) {
  console.error('用法：node scripts/dev-login.mjs <nuwa_user_id> [--to app|welcome] [--port 3000]');
  console.error('nuwa_user_id 請從公版資料庫 public.users 取得。');
  process.exit(1);
}

const secret = process.env.SSO_SECRET;
if (!secret) {
  console.error('❌ 找不到 SSO_SECRET。');
  console.error('   請確認 .env.local 裡有這個變數，且值與公版 apps.sso_secret（slug=happy）一致。');
  process.exit(1);
}

// --- 簽 token（HS256，格式與公版 launch route 相同）---
const b64url = (s) => Buffer.from(s).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const payload = {
  sub: nuwaUserId,
  email: process.env.DEV_LOGIN_EMAIL || `${nuwaUserId}@sso.local`,
  name: process.env.DEV_LOGIN_NAME || 'Dev User',
  app: 'happy',
  to,
  iat: now,
  exp: now + TOKEN_TTL_SECONDS,
};

const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
const body = b64url(JSON.stringify(payload));
const sig = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
const token = `${header}.${body}.${sig}`;

console.log(`\n貼到瀏覽器（${TOKEN_TTL_SECONDS} 秒內有效）：\n`);
console.log(`http://localhost:${port}/sso?token=${token}\n`);
