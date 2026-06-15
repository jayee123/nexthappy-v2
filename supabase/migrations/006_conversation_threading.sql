-- ============================================================
-- Phase 2 Migration 006：Conversation threading + archive
-- ============================================================
-- 版本：2026-05-19（Phase 2 Week 2 Day 1、v1.3.3a）
-- 分支：v3.0-awareness-restructure
-- 規格：docs/v2.1-course-spec.md v1.3.3a
--       docs/architecture-phase-2-proposal.md §3.3
--
-- 動機（Sidebar history retention）：
--   v3.0 之前 conversations table 用 (journey_id, day_number, context_type) 區分：
--     - 21 天：每天一個 row（day_number = 1..21）
--     - 諮詢：固定 day_number=0 + context_type='consultant'、單一 thread 持續累積
--   問題：諮詢沒法多主題、sidebar 沒法列「我卡住了」的歷史討論
--
-- 新增 3 個欄位到 conversations：
--   1. topic_title TEXT — sidebar 顯示用標題
--      - 21 天：「Day N」（backfill 自動）
--      - 諮詢：AI Haiku 從 user 第一句訊息生成（5-15 字）
--   2. topic_started_at TIMESTAMPTZ — 主題起始時間（sidebar 排序）
--   3. archived_at TIMESTAMPTZ — archive 旗標（§8 Q2 拍板）
--      - NULL = active（sidebar 預設顯示）
--      - NOT NULL = archived（在「已封存」folder）
--
-- context_type CHECK constraint 升級：加 'consultant'（既有 production INSERT 用此值）
--
-- 後續 patches：
--   - v1.3.3b：consultant route 改 multi-thread + 整合 autoTitle
--   - v1.3.3c：sidebar UI 列出 topics
--   - v1.3.3d：Day 1-21 navigation 讀歷史 days
-- ============================================================

BEGIN;

-- ── ① conversations 加 3 欄 ──────────────────────────────

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS topic_title TEXT,
  ADD COLUMN IF NOT EXISTS topic_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- ── ② context_type CHECK 升級（加 'consultant'）─────────

ALTER TABLE conversations
  DROP CONSTRAINT IF EXISTS conversations_context_type_check;

ALTER TABLE conversations
  ADD CONSTRAINT conversations_context_type_check
  CHECK (context_type IN ('morning', 'realtime', 'evening', 'onboarding', 'consultant'));

-- ── ③ Backfill topic_title + topic_started_at ────────────

-- 21 天 practice 對話：標題用「Day N」
UPDATE conversations
SET topic_title = 'Day ' || day_number,
    topic_started_at = COALESCE(created_at, NOW())
WHERE context_type IN ('morning', 'realtime', 'evening', 'onboarding')
  AND topic_title IS NULL;

-- 諮詢對話：暫填 placeholder「諮詢主題」、v1.3.3b auto-title 機制上線後可重新生成
UPDATE conversations
SET topic_title = '諮詢主題',
    topic_started_at = COALESCE(created_at, NOW())
WHERE context_type = 'consultant'
  AND topic_title IS NULL;

-- ── ④ Indexes for sidebar listing performance ────────────

-- 主題列表查詢：依 journey 撈、archived_at IS NULL 過濾、依 topic_started_at DESC 排
CREATE INDEX IF NOT EXISTS idx_conversations_journey_archived
  ON conversations(journey_id, archived_at);

CREATE INDEX IF NOT EXISTS idx_conversations_topic_started
  ON conversations(topic_started_at DESC);

-- ── ⑤ COMMENTs（schema 語意自我說明）─────────────────────

COMMENT ON COLUMN conversations.topic_title IS
  'Sidebar 顯示用標題：21 天 = "Day N"；諮詢 = AI auto-generate 從 user 第一句訊息（5-15 字）';

COMMENT ON COLUMN conversations.topic_started_at IS
  'Sidebar 排序用（DESC）。一般等於 created_at、但保留獨立欄位以後可能用於合併同主題對話。';

COMMENT ON COLUMN conversations.archived_at IS
  'Archive 旗標（§8 Q2）。NULL = active、sidebar 預設顯示；NOT NULL = archived、在「📁 已封存」展開區。';

-- ── ⑥ Backfill 統計（debugging 用）──────────────────────

DO $$
DECLARE
  total_conv INT;
  with_title INT;
  practice_count INT;
  consultant_count INT;
BEGIN
  SELECT COUNT(*) INTO total_conv FROM conversations;
  SELECT COUNT(*) INTO with_title FROM conversations WHERE topic_title IS NOT NULL;
  SELECT COUNT(*) INTO practice_count FROM conversations
    WHERE context_type IN ('morning', 'realtime', 'evening', 'onboarding');
  SELECT COUNT(*) INTO consultant_count FROM conversations
    WHERE context_type = 'consultant';

  RAISE NOTICE '── Migration 006 backfill 統計 ──';
  RAISE NOTICE 'Total conversations:    %', total_conv;
  RAISE NOTICE 'With topic_title:       %', with_title;
  RAISE NOTICE 'Practice conversations: %', practice_count;
  RAISE NOTICE 'Consultant threads:     %', consultant_count;
END $$;

COMMIT;

-- ============================================================
-- Rollback（保留參考、不執行）
-- ============================================================
-- BEGIN;
-- DROP INDEX IF EXISTS idx_conversations_journey_archived;
-- DROP INDEX IF EXISTS idx_conversations_topic_started;
-- ALTER TABLE conversations DROP COLUMN IF EXISTS topic_title;
-- ALTER TABLE conversations DROP COLUMN IF EXISTS topic_started_at;
-- ALTER TABLE conversations DROP COLUMN IF EXISTS archived_at;
-- ALTER TABLE conversations
--   DROP CONSTRAINT IF EXISTS conversations_context_type_check,
--   ADD CONSTRAINT conversations_context_type_check
--     CHECK (context_type IN ('morning', 'realtime', 'evening', 'onboarding'));
-- COMMIT;
