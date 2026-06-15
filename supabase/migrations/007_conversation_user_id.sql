-- ============================================================
-- Phase 2 P2 Migration 007：conversations.user_id（trier 持久化）
-- ============================================================
-- 版本：2026-05-19（Phase 2 P2 起步、v1.3.4）
-- 分支：v3.0-awareness-restructure
-- 規格：docs/v2.1-course-spec.md v1.3.4
--       docs/architecture-phase-2-proposal.md §3.5（trier 持久化）
--
-- 動機（Trier 模式對話持久化）：
--   v1.3.2a-c 之前：consultant route 在 user 沒 journey 時走 lite path、**不持久化**
--   問題：trier user（剛 onboarding 完 MBTI、還沒啟動 21 天）關掉瀏覽器、對話消失
--         → 無法 sidebar 列「我卡住了」歷史主題
--   修：conversations table 加 user_id（canonical owner）、journey_id 變 optional
--         → trier user 對話也能持久化、sidebar 列得出來
--
-- 新增 1 個欄位到 conversations：
--   1. user_id UUID REFERENCES users(id) ON DELETE CASCADE — canonical owner
--      Mode B consultant：永遠 set user_id（不管有沒 journey）
--      Mode A practice：永遠 set user_id + journey_id（雙 owner）
--
-- 變動：
--   - journey_id 從 FK REFERENCE 改成 nullable（trier mode 對話沒 journey）
--   - 加 CHECK constraint：user_id 或 journey_id 至少一個非 NULL
--   - 加 partial index for trier-mode lookup
--
-- Backfill：既有 conversations 從 journey_id 推 user_id
-- 之後 consultant/route.ts 改成 user_id-based query（work 在 trier + user-with-journey）
-- ============================================================

BEGIN;

-- ── ① conversations 加 user_id 欄位 ──────────────────────

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- ── ② Backfill 既有 conversations 的 user_id（從 journey 推）──

UPDATE conversations c
SET user_id = j.user_id
FROM journeys j
WHERE c.journey_id = j.id
  AND c.user_id IS NULL;

-- ── ③ user_id NOT NULL（backfill 完才能加這 constraint）──

ALTER TABLE conversations
  ALTER COLUMN user_id SET NOT NULL;

-- ── ④ journey_id 放寬 nullable（trier 對話沒 journey）──

ALTER TABLE conversations
  ALTER COLUMN journey_id DROP NOT NULL;

-- ── ⑤ CHECK constraint：必須有 user_id（保險、防 orphan）──

ALTER TABLE conversations
  DROP CONSTRAINT IF EXISTS conversations_owner_check;

ALTER TABLE conversations
  ADD CONSTRAINT conversations_owner_check
  CHECK (user_id IS NOT NULL);

-- ── ⑥ Indexes for trier mode lookup ────────────────────

-- user_id-based 主查詢（Mode B sidebar 列 topics）
CREATE INDEX IF NOT EXISTS idx_conversations_user_id
  ON conversations(user_id);

-- (user_id, context_type, archived_at) 複合 index for sidebar filter
CREATE INDEX IF NOT EXISTS idx_conversations_user_consultant
  ON conversations(user_id, context_type, archived_at)
  WHERE context_type = 'consultant';

-- ── ⑦ COMMENTs ──────────────────────────────────────────

COMMENT ON COLUMN conversations.user_id IS
  'Canonical owner（v1.3.4 新增）。永遠 set、用於 trier 模式 sidebar 列 topics + cross-mode 持久化。';

COMMENT ON COLUMN conversations.journey_id IS
  'Optional（v1.3.4 放寬 nullable）。Mode A practice 必設、Mode B consultant trier 模式可 NULL。';

-- ── ⑧ Backfill 統計（debugging）──────────────────────────

DO $$
DECLARE
  total_conv INT;
  with_journey INT;
  trier_orphan INT;
BEGIN
  SELECT COUNT(*) INTO total_conv FROM conversations;
  SELECT COUNT(*) INTO with_journey FROM conversations WHERE journey_id IS NOT NULL;
  trier_orphan := total_conv - with_journey;

  RAISE NOTICE '── Migration 007 backfill 統計 ──';
  RAISE NOTICE 'Total conversations:        %', total_conv;
  RAISE NOTICE 'With journey_id (Mode A/B): %', with_journey;
  RAISE NOTICE 'Trier-only (no journey):    %', trier_orphan;
END $$;

COMMIT;

-- ============================================================
-- Rollback（保留參考、不執行）
-- ============================================================
-- BEGIN;
-- DROP INDEX IF EXISTS idx_conversations_user_consultant;
-- DROP INDEX IF EXISTS idx_conversations_user_id;
-- ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_owner_check;
-- ALTER TABLE conversations ALTER COLUMN journey_id SET NOT NULL;
-- ALTER TABLE conversations DROP COLUMN IF EXISTS user_id;
-- COMMIT;
