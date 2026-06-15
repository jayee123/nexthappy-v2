-- ============================================================
-- Phase 2 Migration 005：MBTI global 化 — 從 journey 抽到 user
-- ============================================================
-- 版本：2026-05-19（Phase 2 Week 1 Day 1）
-- 分支：v3.0-awareness-restructure
-- 規格：docs/v2.1-course-spec.md v1.3.0
--       docs/architecture-phase-2-proposal.md §1.3
--
-- 動機（Trier-first Onboarding shift）：
--   v3.0 Phase 1 把 mbti_self 放在 journeys 表（per-relationship）
--   但 user 的 4 字母是**本質屬性**、跨關係、跨 round 都不變
--   原設計問題：
--     (a) 第 2 round 21 天時、user 要重填一次 MBTI → redundant + risk inconsistent
--     (b) Mode B「我卡住了，幫我拆」可在 user 沒 journey 時直接使用
--         → 需要 user-level MBTI 給 USER MBTI GROUND TRUTH bloc（spec v1.2.0）讀取
--     (c) 共用 onboarding（2 步 trier-first flow）需要 user-level MBTI 欄位
--
-- 新增 3 個欄位到 users 表：
--   1. mbti_self TEXT — global ground truth、4 字母（E/I)(S/N)(T/F)(J/P)
--   2. mbti_confidence TEXT — low / medium / high
--   3. mbti_set_at TIMESTAMPTZ — 第一次設定時間（onboarding completion 訊號）
--
-- Journey 表變動：
--   - mbti_self 從 NOT NULL → nullable
--     語意：NULL = inherit user.mbti_self；NOT NULL = override per relationship（罕見）
--   - mbti_confidence 保留（如有 per-relationship 信心差異）
--
-- Backfill 邏輯：
--   - 取每個 user 的「最相關 journey」MBTI 寫進 user
--   - 優先序：is_active=true → 最新 created_at
--   - 沒任何 journey 的 user（剛 seed 的 team test accounts）→ NULL，下次登入觸發 onboarding
--
-- buildContext.ts 影響（後續 task）：
--   - buildUserMbtiGroundTruthBloc 改從 users.mbti_self 拉、不是 journey.mbti_self
--   - Mode B 諮詢可在 journey 不存在時運作（不再 404）
-- ============================================================

BEGIN;

-- ── ① users 表加 3 個 MBTI 欄位 ──────────────────────────

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS mbti_self TEXT,
  ADD COLUMN IF NOT EXISTS mbti_confidence TEXT DEFAULT 'medium'
    CHECK (mbti_confidence IN ('low', 'medium', 'high')),
  ADD COLUMN IF NOT EXISTS mbti_set_at TIMESTAMPTZ;

-- 4 字母格式 CHECK（允許 NULL = 尚未 onboard）
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_mbti_self_format;

ALTER TABLE users
  ADD CONSTRAINT users_mbti_self_format
  CHECK (mbti_self IS NULL OR mbti_self ~ '^[EI][SN][TF][JP]$');

-- ── ② Backfill：從 journey 拉每個 user 的「最相關」MBTI ────

WITH ranked_journeys AS (
  SELECT DISTINCT ON (user_id)
    user_id,
    mbti_self,
    mbti_confidence,
    created_at
  FROM journeys
  WHERE mbti_self IS NOT NULL
    AND mbti_self ~ '^[EI][SN][TF][JP]$'  -- 排除髒資料
  ORDER BY user_id, is_active DESC, created_at DESC
)
UPDATE users u
SET mbti_self = rj.mbti_self,
    mbti_confidence = COALESCE(rj.mbti_confidence, 'medium'),
    mbti_set_at = rj.created_at  -- 用 journey 創建時間當「first set」時間
FROM ranked_journeys rj
WHERE rj.user_id = u.id
  AND u.mbti_self IS NULL;

-- ── ③ journeys.mbti_self 放寬：NOT NULL → nullable ──────

ALTER TABLE journeys
  ALTER COLUMN mbti_self DROP NOT NULL;

-- COMMENT 補上 schema 語意（避免日後 dev 看 NULL 困惑）
COMMENT ON COLUMN journeys.mbti_self IS
  'Per-journey MBTI override（罕見）。NULL = inherit users.mbti_self（預設、推薦）。';

COMMENT ON COLUMN users.mbti_self IS
  'Global MBTI ground truth、跨 mode + 跨 round 共用。對應 spec v1.2.0 USER MBTI GROUND TRUTH bloc。NULL = user 尚未完成 onboarding step 1。';

-- ── ④ Index 加速 Mode B 諮詢時的 user MBTI lookup ───────

CREATE INDEX IF NOT EXISTS idx_users_mbti_self
  ON users(mbti_self)
  WHERE mbti_self IS NOT NULL;

-- ── ⑤ 後設資料：紀錄 backfill 統計（用於 debugging）─────

DO $$
DECLARE
  total_users INT;
  backfilled INT;
  unfilled INT;
BEGIN
  SELECT COUNT(*) INTO total_users FROM users;
  SELECT COUNT(*) INTO backfilled FROM users WHERE mbti_self IS NOT NULL;
  unfilled := total_users - backfilled;

  RAISE NOTICE '── Migration 005 backfill 統計 ──';
  RAISE NOTICE 'Total users:       %', total_users;
  RAISE NOTICE 'Backfilled MBTI:   %', backfilled;
  RAISE NOTICE 'Unfilled (NULL):   % ← 這些 user 下次登入會走 trier-first onboarding', unfilled;
END $$;

COMMIT;

-- ============================================================
-- Rollback（保留參考、不執行）
-- ============================================================
-- BEGIN;
-- ALTER TABLE users DROP CONSTRAINT IF EXISTS users_mbti_self_format;
-- DROP INDEX IF EXISTS idx_users_mbti_self;
-- ALTER TABLE users DROP COLUMN IF EXISTS mbti_self;
-- ALTER TABLE users DROP COLUMN IF EXISTS mbti_confidence;
-- ALTER TABLE users DROP COLUMN IF EXISTS mbti_set_at;
-- ALTER TABLE journeys ALTER COLUMN mbti_self SET NOT NULL;
-- COMMIT;
