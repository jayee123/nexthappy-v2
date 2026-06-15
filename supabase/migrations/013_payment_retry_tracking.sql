-- supabase/migrations/013_payment_retry_tracking.sql
--
-- Phase 1B：紅陽金流追蹤
--
-- 內容：
--   (1) payment_transactions：所有金流操作紀錄（綁卡、月扣款、升級差額、重試）
--   (2) payment_retries：失敗扣款重試排程追蹤
--   (3) users.pending_downgrade_plan：降級標記（下月生效）
--
-- 依賴：Migration 012（plan_tier enum 必須已存在）
-- 規則：012 以前的 SQL 不動，新增用 013+

-- ─────────────────────────────────────────
-- (1) payment_transactions
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_tier plan_tier NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'TWD',

  order_no TEXT NOT NULL,
  esafe_no TEXT,
  errcode TEXT,
  errmsg TEXT,

  status TEXT NOT NULL DEFAULT 'pending',
  transaction_type TEXT NOT NULL,

  idempotency_key TEXT UNIQUE NOT NULL,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE payment_transactions IS
  '所有金流操作紀錄（綁卡 / 月扣款 / 升級差額 / 重試），idempotency_key 防重複';

COMMENT ON COLUMN payment_transactions.status IS
  'pending / success / failed';

COMMENT ON COLUMN payment_transactions.transaction_type IS
  'bind_card / renewal / upgrade_diff / retry';

CREATE INDEX IF NOT EXISTS payment_tx_user_idx
  ON payment_transactions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS payment_tx_order_idx
  ON payment_transactions (order_no);

CREATE INDEX IF NOT EXISTS payment_tx_idempotency_idx
  ON payment_transactions (idempotency_key);


-- ─────────────────────────────────────────
-- (2) payment_retries
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payment_retries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_transaction_id UUID REFERENCES payment_transactions(id),
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  last_error TEXT,
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE payment_retries IS
  '失敗扣款重試排程。retry_count 0=首次失敗, 1-3=重試, resolved=true 表成功或放棄';

CREATE INDEX IF NOT EXISTS payment_retries_pending_idx
  ON payment_retries (next_retry_at)
  WHERE resolved = FALSE AND next_retry_at IS NOT NULL;


-- ─────────────────────────────────────────
-- (3) users 加降級標記欄位
-- ─────────────────────────────────────────

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS pending_downgrade_plan plan_tier;

COMMENT ON COLUMN users.pending_downgrade_plan IS
  '降級目標方案（下月生效），NULL = 無降級意圖';
