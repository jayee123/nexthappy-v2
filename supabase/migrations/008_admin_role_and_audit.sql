-- supabase/migrations/008_admin_role_and_audit.sql
--
-- v1.3.8 admin dashboard foundation：
-- 1. users 表加 is_admin 欄位（後台權限 gate）
-- 2. 新增 admin_audit_logs 表（記錄所有 admin 動作、供 debug + 安全追蹤）

-- (1) users 表加 is_admin
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE NOT NULL;

CREATE INDEX IF NOT EXISTS users_is_admin_idx
  ON users (is_admin)
  WHERE is_admin = TRUE;

COMMENT ON COLUMN users.is_admin IS
  '是否為後台管理員、預設 FALSE、只能由現有 admin 手動授權';


-- (2) admin_audit_logs 表
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  changes JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_audit_logs_admin_user_id_idx
  ON admin_audit_logs (admin_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS admin_audit_logs_target_idx
  ON admin_audit_logs (target_type, target_id);

COMMENT ON TABLE admin_audit_logs IS
  '後台動作審計 log、所有 PATCH/DELETE/admin grant 都要寫';