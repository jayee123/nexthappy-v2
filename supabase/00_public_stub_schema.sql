-- ============================================================
-- 00_public_stub_schema.sql
--
-- 最小化的 public schema stub —— 不是完整的 NUWA v2（33 張表 / 23 支
-- migration），只建 nexthappy 自己真的會查的 3 張表，讓「方案 / 用量」
-- 相關功能不會直接報錯：
--
--   - public.users          市場帳號主檔（happy.users.nuwa_user_id 指向這裡，鬆散對應、無 FK）
--   - public.apps           App 註冊表（SSO 用得到 app_url/db_schema/sso_secret）
--   - public.ai_token_usage 跨 App 用量歸戶（src/lib/market/usage.ts 會寫入）
--
-- 欄位涵蓋 src/lib/market/*.ts 的查詢 + supabase/dev-seed.sql 的
-- INSERT 需求（dev-seed.sql 本身就會塞資料進這幾張表，這裡只建 DDL）。
--
-- public schema 本身已經是 Supabase 預設 Exposed schema，不用額外設定。
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text,
  email text,
  nickname text,
  current_plan text DEFAULT 'free',
  plan_deadline timestamptz,
  role text DEFAULT 'user',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.apps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text,
  tagline text,
  icon text,
  app_url text,
  db_schema text,
  sso_secret text,
  required_plan text,
  status text DEFAULT 'active',
  sort_order int DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.ai_token_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  app_id uuid,
  tokens_used int,
  cost_twd numeric(10,2),
  date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);
