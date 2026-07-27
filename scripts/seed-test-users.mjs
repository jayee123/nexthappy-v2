#!/usr/bin/env node
/**
 * scripts/seed-test-users.mjs
 *
 * 為 team members 預建 10 個測試帳號 + 對應邀請碼。
 * Idempotent — 重複跑會 skip 既有帳號、不會重複建。
 *
 * 使用方式：
 *   npm run seed:test-users
 *
 * 需要 .env.local 含：
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - JWT_SECRET
 *
 * 跑完會 print 10 組登入 credentials。
 */

import { createClient } from '@supabase/supabase-js';
import { webcrypto as crypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ──────────────────────────────────────────────
// 1. 手動 load .env.local（兼容 Node <20）
// ──────────────────────────────────────────────

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), '.env.local');
  try {
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      // 去除前後引號
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
    console.log('✅ 已讀取 .env.local\n');
  } catch (err) {
    // 找不到 .env.local 不算錯——可能 env vars 已從 process.env 提供（如 export 或 vercel env pull）
    console.log('ℹ️  找不到 .env.local、改用 process.env\n');
  }
}

loadEnvLocal();

// ──────────────────────────────────────────────
// 2. Env vars check
// ──────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !JWT_SECRET) {
  console.error('❌ 缺少 env vars。確認 .env.local 內含：');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  console.error('   - JWT_SECRET');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ──────────────────────────────────────────────
// 2. Password hash function（跟 src/lib/auth.ts 完全一致）
// ──────────────────────────────────────────────

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + JWT_SECRET);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ──────────────────────────────────────────────
// 3. 帳號清單（10 個）
// ──────────────────────────────────────────────

const TEST_PASSWORD = 'nuwa2026';
const COUNT = 10;

const accounts = Array.from({ length: COUNT }, (_, i) => {
  const n = String(i + 1).padStart(2, '0');
  return {
    email: `team${n}@nuwa.test`,
    password: TEST_PASSWORD,
    name: `測試用戶 ${n}`,
    invite_code: `NUWA-TEAM-${n}`,
  };
});

// ──────────────────────────────────────────────
// 4. Main
// ──────────────────────────────────────────────

async function main() {
  console.log('🌱 開始 seed 10 個 team test 帳號\n');

  const passwordHash = await hashPassword(TEST_PASSWORD);
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  for (const acc of accounts) {
    // 4.1 確保 invite_code 存在
    const { data: existingCode } = await supabase
      .from('invite_codes')
      .select('code, used_by')
      .eq('code', acc.invite_code)
      .maybeSingle();

    if (!existingCode) {
      const { error } = await supabase
        .from('invite_codes')
        .insert({ code: acc.invite_code, expires_at: expiresAt.toISOString() });
      if (error) {
        console.error(`  ❌ 建 invite_code ${acc.invite_code} 失敗:`, error.message);
        continue;
      }
    }

    // 4.2 檢查 user 是否已存在
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', acc.email)
      .maybeSingle();

    let userId;
    if (existingUser) {
      userId = existingUser.id;
      console.log(`  ⏭️  ${acc.email} — 已存在、skip（密碼維持 ${TEST_PASSWORD}）`);
    } else {
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          email: acc.email,
          name: acc.name,
          password_hash: passwordHash,
          invite_code: acc.invite_code,
        })
        .select('id')
        .single();
      if (createError || !newUser) {
        console.error(`  ❌ 建 user ${acc.email} 失敗:`, createError?.message);
        continue;
      }
      userId = newUser.id;
      console.log(`  ✅ 建立 ${acc.email}`);
    }

    // 4.3 標記 invite_code 已使用
    if (existingCode?.used_by !== userId) {
      await supabase
        .from('invite_codes')
        .update({ used_by: userId, used_at: new Date().toISOString() })
        .eq('code', acc.invite_code);
    }
  }

  // ──────────────────────────────────────────────
  // 5. Print credentials table
  // ──────────────────────────────────────────────

  console.log('\n─────────────────────────────────────────────────────────');
  console.log('🎉 10 個 team test 帳號全部就緒！credential 如下：\n');
  console.log('編號 | Email               | 密碼      | 名稱');
  console.log('-----|---------------------|-----------|----------');
  for (const acc of accounts) {
    const num = acc.invite_code.split('-').pop();
    console.log(`  ${num} | ${acc.email.padEnd(20)}| ${acc.password}  | ${acc.name}`);
  }
  console.log('\n📝 給 team 的 message template：');
  console.log('-----------------------------------------------------------');
  console.log('Hi team，明天的 demo 用這 10 組測試帳號之一登入：');
  console.log('');
  console.log('登入網址：https://[你的-production-domain] /auth/login');
  console.log('密碼：' + TEST_PASSWORD + '（10 個帳號統一）');
  console.log('Email：請從 team01@nuwa.test ～ team10@nuwa.test 任選一組');
  console.log('（請大家事前協調好誰用 01 / 02 / 03...，避免撞號）');
  console.log('');
  console.log('登入後會走 Day 0 onboarding（設定 MBTI / 對象暱稱），');
  console.log('完成後就可以體驗「21 天練習」+「跟諮詢師對話」兩個模式。');
  console.log('-----------------------------------------------------------\n');
}

main().catch(err => {
  console.error('💥 Script error:', err);
  process.exit(1);
});
