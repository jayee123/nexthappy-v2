-- supabase/migrations/012_subscription_system.sql
--
-- Phase 1A 訂閱系統 schema
--
-- 內容：
--   (1) 新 enum: plan_tier（trial / basic / advanced / premium / cancelled）
--   (2) users 表加 6 個訂閱相關欄位（current_plan / trial / subscription / payment / auto_renewal / cancelled_at）
--   (3) 新 table: usage_quotas（按月份追蹤 user 對話額度）
--   (4) 新 table: ai_usage_logs（每次 AI 呼叫精準 token + 成本 log、給 admin / billing reconciliation）
--
-- 預設：所有現有 user current_plan = 'premium'（內測階段全部 grandfather 進旗艦方案）
-- 環境變數 BILLING_ENFORCEMENT 控制是否啟用額度檢查（預設 false、Jeff 接好金流後翻 true）

-- ─────────────────────────────────────────
-- (1) plan_tier ENUM
-- ─────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE plan_tier AS ENUM ('trial', 'basic', 'advanced', 'premium', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;


-- ─────────────────────────────────────────
-- (2) users 表加訂閱欄位
-- ─────────────────────────────────────────

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS current_plan plan_tier NOT NULL DEFAULT 'premium';

COMMENT ON COLUMN users.current_plan IS
  '當前訂閱方案：trial（7 天免費）/ basic / advanced / premium / cancelled';

-- Trial 起算時間（用於計算 7 天到期日）
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;

COMMENT ON COLUMN users.trial_started_at IS
  '免費試用起算時間（onboarding 完成才算）。NULL = 還沒啟動 trial';

-- 訂閱期間欄位
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ;

COMMENT ON COLUMN users.subscription_started_at IS
  '首次訂閱付費起算時間（Jeff 接好金流後使用）';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS subscription_renews_at TIMESTAMPTZ;

COMMENT ON COLUMN users.subscription_renews_at IS
  '下次自動扣款時間。NULL = 不續訂或未訂';

-- 紅陽金流綁卡 token（Jeff 串接後填）
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS payment_method_token TEXT;

COMMENT ON COLUMN users.payment_method_token IS
  '金流綁卡 tokenization 結果（紅陽 / 將來其他）';

-- Auto-renewal 開關（user 可自行 toggle、cancel）
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS auto_renewal BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN users.auto_renewal IS
  '是否自動續訂。FALSE = user 已取消、subscription_renews_at 到時不續扣';

-- 取消時間（保留歷史）
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

COMMENT ON COLUMN users.cancelled_at IS
  '訂閱取消時間。NULL = 未取消';

-- Index 給 admin /subscriptions 查詢用
CREATE INDEX IF NOT EXISTS users_current_plan_idx
  ON users (current_plan)
  WHERE current_plan != 'cancelled';

CREATE INDEX IF NOT EXISTS users_subscription_renews_at_idx
  ON users (subscription_renews_at)
  WHERE auto_renewal = TRUE AND subscription_renews_at IS NOT NULL;


-- ─────────────────────────────────────────
-- (3) usage_quotas：每月用量 cap
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS usage_quotas (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,                           -- 該月 1 號
  messages_count INTEGER NOT NULL DEFAULT 0,            -- 本月已用對話次數
  tokens_input INTEGER NOT NULL DEFAULT 0,
  tokens_output INTEGER NOT NULL DEFAULT 0,
  cost_twd_estimated NUMERIC(10, 4) NOT NULL DEFAULT 0, -- 累計 API 成本（給 admin 看）
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, period_start)
);

CREATE INDEX IF NOT EXISTS usage_quotas_period_idx
  ON usage_quotas (period_start, messages_count DESC);

COMMENT ON TABLE usage_quotas IS
  '每 user 每月用量、cap 用於額度檢查';


-- ─────────────────────────────────────────
-- (4) ai_usage_logs：每次 AI call 的精準 token + 成本 log
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  conversation_id UUID,                       -- 不加 FK、避免 cascade 困擾
  context_type TEXT,                          -- 'practice' / 'consultant' / null
  model TEXT NOT NULL,                        -- 'claude-sonnet-4-5' / 將來其他
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cost_twd NUMERIC(10, 4) NOT NULL,           -- 該次 call 真實成本
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_usage_logs_user_id_idx
  ON ai_usage_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_usage_logs_created_at_idx
  ON ai_usage_logs (created_at DESC);

COMMENT ON TABLE ai_usage_logs IS
  '每次 AI 呼叫精準 token + 成本紀錄、給 admin 查 cost vs revenue + 將來 billing reconciliation';


-- ─────────────────────────────────────────
-- (5) Backfill：所有現有 users 設為 premium（內測 grandfather）
-- ─────────────────────────────────────────

-- ALTER COLUMN 設了 default、新加欄位的舊 row 會自動填 'premium'、不用額外 UPDATE
-- 此 migration 之後新註冊 user 也會 default 'premium'、直到 Jeff 接好金流改成 'trial'
