-- supabase/migrations/011_fk_cascade_fix.sql
--
-- Week 2 Session 2D：修 user 刪除被 FK 擋的問題
--
-- 改 2 個 FK 的 delete_rule：
-- 1. invite_codes.used_by:        NO ACTION → SET NULL
-- 2. admin_audit_logs.admin_user_id: RESTRICT → SET NULL
--
-- 為什麼 SET NULL（不 CASCADE）：
-- 這 2 個是「歷史紀錄」、不該因 user 刪除而消失。
-- 保留邀請碼 / audit log（時間 / 動作 / target metadata）、
-- 只清「user reference」、變成「已刪除 user」狀態。
--
-- conversations.user_id 跟 journeys.user_id 已 CASCADE、不動。

-- ─────────────────────────────────────────
-- (1) invite_codes.used_by → SET NULL
-- ─────────────────────────────────────────

ALTER TABLE invite_codes DROP CONSTRAINT IF EXISTS fk_invite_used_by;

ALTER TABLE invite_codes
  ADD CONSTRAINT fk_invite_used_by
  FOREIGN KEY (used_by)
  REFERENCES users(id)
  ON DELETE SET NULL;

-- ─────────────────────────────────────────
-- (2) admin_audit_logs.admin_user_id → SET NULL
-- 先讓欄位 nullable、再改 constraint
-- ─────────────────────────────────────────

ALTER TABLE admin_audit_logs
  ALTER COLUMN admin_user_id DROP NOT NULL;

ALTER TABLE admin_audit_logs
  DROP CONSTRAINT IF EXISTS admin_audit_logs_admin_user_id_fkey;

ALTER TABLE admin_audit_logs
  ADD CONSTRAINT admin_audit_logs_admin_user_id_fkey
  FOREIGN KEY (admin_user_id)
  REFERENCES users(id)
  ON DELETE SET NULL;