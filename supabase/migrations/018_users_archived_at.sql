-- ============================================================
-- 018_users_archived_at.sql
--
-- 用戶「封存」欄位：happy.users.archived_at
--
-- 三個機制是正交的，各管各的事（2026-09-02 與 Steve 對齊的結論）：
--   suspended_at   停權（有意圖的管理處分）→ 擋登入、後台看得到（紅字）
--   archived_at    封存（整理視野，無處分意味）→ 不擋登入、後台預設隱藏
--   永久刪除        GDPR → DELETE + CASCADE，資料真的沒了（既有 DELETE API）
--
-- 封存的語意：
--   - 「試用完沒回來的人佔著後台列表」→ 封存收進抽屜，不是懲罰
--   - 不擋登入。人從公版再走 /sso 進來時自動解封存 + 寫 audit log
--   - 懲罰用 suspended_at，那條路已經做好也生效了
--
-- ⚠️ 欄位叫 archived_at，「不要」改名成 deleted_at：
--   公版 public.users.deleted_at 是會擋 SSO 的（launch/route.ts）。
--   私版若同名但不擋登入，就是同名不同義 —— 正是這一輪一直在修的那類 bug。
--
-- 不建 index：後台列表用 `archived_at IS NULL` 過濾，帳號數在千級以下
-- 全表掃無感；等真的慢了再建 partial index 也不遲（同 009 的做法反過來想）。
--
-- 可重跑：ADD COLUMN IF NOT EXISTS，重跑安全。
-- ============================================================

ALTER TABLE happy.users
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN happy.users.archived_at IS
  '封存時間戳。NULL=正常；有值=已封存（後台列表預設隱藏）。'
  '不擋登入 —— 用戶走 /sso 回來時自動清掉並寫 audit log。'
  '停權請用 suspended_at；永久刪除走 DELETE API。別改名成 deleted_at（公版同名欄位會擋 SSO，同名不同義）。';


-- ─────────────────────────────────────────────────────────
-- 驗證：跑完貼這段
-- ─────────────────────────────────────────────────────────
-- 期待：欄位存在 = true、目前封存數 = 0
--
-- SELECT
--   EXISTS (
--     SELECT 1 FROM information_schema.columns
--     WHERE table_schema = 'happy' AND table_name = 'users' AND column_name = 'archived_at'
--   ) AS 欄位存在,
--   (SELECT count(*) FROM happy.users WHERE archived_at IS NOT NULL) AS 目前封存數;
