#!/usr/bin/env node
/**
 * scripts/dev-seed/generate.mjs
 *
 * 產生本機開發用的【合成】測試資料 SQL。
 *
 * ⚠️ 這支腳本【不連任何資料庫】，也不讀取任何正式資料。
 *    輸出的每一個字都來自 personas.mjs 裡手寫的素材。
 *
 * 產出是決定性的（固定 UUID + 固定亂數種子）——
 * 同樣的輸入永遠得到同樣的 SQL，重跑不會產生無意義的 diff。
 *
 * 用法：
 *   node scripts/dev-seed/generate.mjs supabase/dev-seed.sql
 *
 * ⚠️ 請用參數指定輸出檔，不要用 shell 重導向（`> file`）。
 *    重導向會【先把檔案截成 0 行】才執行腳本 —— 腳本一旦失敗，
 *    你會得到一個空檔，而後續的 psql 跑空檔會回報「成功」。
 *    實際踩過一次，很難察覺。用參數的話寫入前會先檢查產出是否合理。
 */
import {
  TOTAL_DAYS, BLINDSPOT_CODES, CONTEXT_TYPES, PERSONAS,
  PARTNER_NICKNAMES, GOAL_STATEMENTS, INITIAL_PROBLEMS,
  JOURNAL_TEXTS, DIALOG_PAIRS, EDGE_TEXTS, MEMORY_TEXTS, BLINDSPOT_TEXTS,
} from './personas.mjs';
import { writeFileSync } from 'fs';

// --- 決定性亂數（mulberry32）：換種子才會換結果，重跑結果不變 ---
function makeRng(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = makeRng(20260819);
const pick = (arr) => arr[Math.floor(rng() * arr.length)];

// --- 固定 UUID：一眼看得出是測試資料，且每次產生都相同 ---
const uuid = (group, n) => `d0000000-${group}-4000-8000-${String(n).padStart(12, '0')}`;
const USER = (i) => uuid('0001', i);
const JOURNEY = (i) => uuid('0002', i);
const RECORD = (i, d) => uuid('0003', i * 100 + d);
const CONVO = (i, d) => uuid('0004', i * 100 + d);
const MEMORY = (i, d) => uuid('0005', i * 100 + d);
const BLIND = (i, d) => uuid('0006', i * 100 + d);
const ACHIEVE = (i, n) => uuid('0007', i * 100 + n);
const APP_ID = 'd0000000-0009-4000-8000-000000000001';

// --- SQL 值格式化 ---
const q = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const raw = (v) => (v === null || v === undefined ? 'NULL' : String(v));
const jsonb = (v) => `${q(JSON.stringify(v))}::jsonb`;
/** 相對今天往前推 n 天，避免寫死日期讓資料看起來很舊 */
const daysAgo = (n) => `(CURRENT_DATE - INTERVAL '${n} days')`;

const out = [];
const w = (s = '') => out.push(s);

// ============================================================
w(`-- ============================================================
-- nexthappy 本機開發用測試資料（合成）
--
-- ⚠️ 這份檔案【不含任何真實用戶資料】。
--    所有姓名、對話、日記都是 scripts/dev-seed/personas.mjs 裡手寫的素材，
--    由 scripts/dev-seed/generate.mjs 產生。要改內容請改那兩支再重新產生。
--
-- 前置條件（順序不可顛倒）：
--   1. 已跑完公版 nuwa 的 23 支 migration    → public schema
--   2. 已建立 happy schema 並跑完私版 13 支 migration
--      ⚠️ 私版 migration 【沒有寫 schema 前綴、也沒設 search_path】，
--         執行前務必先 SET search_path TO happy; 否則表會建到 public，
--         跟公版的 users 表撞在一起。
--
-- 執行：貼進 Supabase SQL Editor，或 psql -f supabase/dev-seed.sql
-- ============================================================

BEGIN;
`);

// --- public.apps：SSO 用，app_url 指向本機私版 ---
w(`-- ── public.apps ──────────────────────────────────────────────
-- SSO 的目標網址。本機開發指向 localhost:3001（私版的 port）。
-- sso_secret 是佔位字串，本機只要與私版 .env.local 的 SSO_SECRET 一致即可。
INSERT INTO public.apps (id, slug, name, tagline, icon, app_url, db_schema, sso_secret, required_plan, status, sort_order)
VALUES (${q(APP_ID)}, 'happy', '幸福關係', '21 天關係練習', '💛',
        'http://localhost:3001', 'happy', 'dev-local-sso-secret-change-me', NULL, 'active', 1)
ON CONFLICT (slug) DO UPDATE
  SET app_url = EXCLUDED.app_url, sso_secret = EXCLUDED.sso_secret, status = 'active';
`);

// --- public.users + happy.users ---
w(`-- ── public.users（公版帳號主檔）──────────────────────────────
-- 私版透過 happy.users.nuwa_user_id 指回這裡，讀 email / nickname / current_plan。`);
PERSONAS.forEach((p, i) => {
  const id = USER(i + 1);
  w(`INSERT INTO public.users (id, phone, email, nickname, current_plan, role)
VALUES (${q(id)}, ${q(`0900000${String(i + 1).padStart(3, '0')}`)}, ${q(`dev${i + 1}@example.test`)}, ${q(p.name)}, ${q(p.marketPlan)}, 'user')
ON CONFLICT (id) DO NOTHING;   -- ${p.why}`);
});
w();

w(`-- ── happy.users（私版帳號）───────────────────────────────────
-- password_hash 是佔位值：SSO 帳號本來就沒有密碼，只能走 /sso 進入。`);
PERSONAS.forEach((p, i) => {
  const id = USER(i + 1);
  w(`INSERT INTO happy.users (id, email, name, password_hash, nuwa_user_id, current_plan)
VALUES (${q(id)}, ${q(`dev${i + 1}@example.test`)}, ${q(p.name)}, 'dev-no-password', ${q(id)}, ${q(p.plan)})
ON CONFLICT (id) DO NOTHING;`);
});
w();

// --- happy.journeys 與其下的所有紀錄 ---
w(`-- ── happy.journeys 與每日紀錄 ────────────────────────────────`);
PERSONAS.forEach((p, i) => {
  const uid = USER(i + 1);
  if (!p.journey) {
    w(`-- ${p.name}：刻意【不建立 journey】—— ${p.why}`);
    w();
    return;
  }
  const jid = JOURNEY(i + 1);
  const j = p.journey;
  const nullOpt = j.nullOptionals === true;

  w(`-- ${p.name}（day ${p.currentDay}/${TOTAL_DAYS}）：${p.why}`);
  w(`INSERT INTO happy.journeys (id, user_id, mbti_self, mbti_partner, mbti_confidence,
       partner_nickname, relationship_type, goal_statement, initial_problem,
       start_date, current_day, is_active, total_points)
VALUES (${q(jid)}, ${q(uid)}, ${q(j.mbtiSelf)}, ${q(j.mbtiPartner)}, ${q(j.confidence)},
        ${q(pick(PARTNER_NICKNAMES))}, ${q(j.relationship)},
        ${nullOpt ? 'NULL' : q(pick(GOAL_STATEMENTS))},
        ${nullOpt ? 'NULL' : q(pick(INITIAL_PROBLEMS))},
        ${daysAgo(p.currentDay)}, ${raw(p.currentDay)},
        ${p.plan === 'cancelled' ? 'FALSE' : 'TRUE'}, ${raw(p.currentDay * 10)})
ON CONFLICT (id) DO NOTHING;`);   // journeys 沒有 UNIQUE(user_id)：設計上允許同一人開多輪（見 combined-happy-schema.sql:318）

  // 每一天產生：日記 + 對話 +（部分天）記憶與盲點
  for (let d = 1; d <= p.currentDay; d++) {
    const isEdge = p.key === 'edge_cases';
    const journal = isEdge
      ? (d === 1 ? EDGE_TEXTS.veryLong : d === 2 ? EDGE_TEXTS.emoji : d === 3 ? EDGE_TEXTS.single : pick(JOURNAL_TEXTS))
      : pick(JOURNAL_TEXTS);
    const score = 1 + Math.floor(rng() * 10);           // CHECK: 1..10
    const done = rng() > 0.25;
    const ctype = done ? (rng() > 0.3 ? 'success' : 'partial') : 'failed';

    w(`INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES (${q(RECORD(i + 1, d))}, ${q(jid)}, ${raw(d)}, ${daysAgo(p.currentDay - d)}, ${done ? 'TRUE' : 'FALSE'}, ${q(ctype)}, ${raw(score)}, ${q(journal)}, ${raw(done ? 10 : 0)})
ON CONFLICT (id) DO NOTHING;`);

    // 對話輪數刻意不一：邊界人物給 1 輪與滿輪，其餘隨機
    const turns = isEdge ? (d === 1 ? 1 : DIALOG_PAIRS.length) : 2 + Math.floor(rng() * (DIALOG_PAIRS.length - 2));
    const messages = [];
    for (let t = 0; t < turns; t++) {
      const pair = DIALOG_PAIRS[t % DIALOG_PAIRS.length];
      messages.push({ role: 'user', content: pair.user });
      messages.push({ role: 'assistant', content: pair.ai });
    }
    // user_id 是 007 之後才加的必填欄位；topic_* / archived_at 來自 006 的對話串功能。
    // 每 4 天封存一則，讓「已封存對話」這個狀態在本機也看得到。
    const archived = d % 4 === 0;
    w(`INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES (${q(CONVO(i + 1, d))}, ${q(jid)}, ${q(uid)}, ${raw(d)}, ${q(CONTEXT_TYPES[d % CONTEXT_TYPES.length])}, ${jsonb(messages)},
        ${q(`第 ${d} 天的練習`)}, NOW() - INTERVAL '${p.currentDay - d} days', ${archived ? `NOW() - INTERVAL '${Math.max(0, p.currentDay - d - 1)} days'` : 'NULL'})
ON CONFLICT (id) DO NOTHING;`);

    if (d % 2 === 0) {
      w(`INSERT INTO happy.daily_memories (id, journey_id, day_number, emotion_note, task_result, partner_obs, key_insight, follow_up)
VALUES (${q(MEMORY(i + 1, d))}, ${q(jid)}, ${raw(d)}, ${q(pick(MEMORY_TEXTS.emotion_note))}, ${q(pick(MEMORY_TEXTS.task_result))}, ${q(pick(MEMORY_TEXTS.partner_obs))}, ${q(pick(MEMORY_TEXTS.key_insight))}, ${q(pick(MEMORY_TEXTS.follow_up))})
ON CONFLICT (id) DO NOTHING;`);
    }
    if (d % 3 === 0) {
      w(`INSERT INTO happy.blindspot_records (id, journey_id, day_number, blindspot_code, context_type, trigger_snippet, ai_feedback)
VALUES (${q(BLIND(i + 1, d))}, ${q(jid)}, ${raw(d)}, ${q(BLINDSPOT_CODES[d % BLINDSPOT_CODES.length])}, ${q(CONTEXT_TYPES[1 + (d % 3)])}, ${q(pick(BLINDSPOT_TEXTS.trigger))}, ${q(pick(BLINDSPOT_TEXTS.feedback))})
ON CONFLICT (id) DO NOTHING;`);
    }
  }

  // 成就：每 7 天一枚
  for (let n = 1; n * 7 <= p.currentDay; n++) {
    w(`INSERT INTO happy.achievements (id, journey_id, badge_id, badge_name, points)
VALUES (${q(ACHIEVE(i + 1, n))}, ${q(jid)}, ${q(`week_${n}`)}, ${q(`第 ${n} 週完成`)}, 50)
ON CONFLICT (id) DO NOTHING;`);
  }
  w();
});

w(`COMMIT;

-- ── 產生內容摘要 ──────────────────────────────────────────────`);
PERSONAS.forEach((p) => {
  w(`--   ${p.name.padEnd(18)} ${String(p.plan).padEnd(10)} day ${String(p.currentDay).padStart(2)}/${TOTAL_DAYS}  ${p.why}`);
});

// --- 輸出 ---------------------------------------------------
// 寫檔前先確認產出合理，避免「腳本壞掉 → 空檔 → 下游誤判成功」。
const MIN_EXPECTED_LINES = 400;
const sql = out.join('\n') + '\n';
const outPath = process.argv[2];

if (!outPath) {
  process.stderr.write('用法：node scripts/dev-seed/generate.mjs <輸出檔路徑>\n');
  process.exit(1);
}
// 注意：out 是「片段陣列」，多數片段本身就是多行 SQL，
// 因此要數實際換行數，不能用 out.length。
const lineCount = sql.split('\n').length;
if (lineCount < MIN_EXPECTED_LINES) {
  process.stderr.write(`產出只有 ${lineCount} 行，少於預期的 ${MIN_EXPECTED_LINES} 行 —— 不寫入。\n`);
  process.exit(1);
}

writeFileSync(outPath, sql);
process.stderr.write(`✅ 已寫入 ${outPath}（${lineCount} 行）\n`);
