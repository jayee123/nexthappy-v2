-- supabase/migrations/009_users_suspended_at.sql
--
-- Week 2 用戶管理：軟刪除支援
-- users 加 suspended_at TIMESTAMPTZ NULL 欄位
-- - NULL = 正常 user
-- - 有值 = 已被 admin 停權、不能登入但資料保留
--
-- 對應 spec admin-dashboard-spec-v0.1.md §3.1「停權按鈕」

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ NULL;

-- Index 給「找出停權 user」用（之後 admin filter）
CREATE INDEX IF NOT EXISTS users_suspended_at_idx
  ON users (suspended_at)
  WHERE suspended_at IS NOT NULL;

COMMENT ON COLUMN users.suspended_at IS
  '軟刪除時間戳、NULL=正常 user、有值=已被 admin 停權、登入時拒絕';