-- ============================================================
-- v3.0 Phase 2 Task 1：user_state schema extension on users table
-- ============================================================
-- 版本：2026-05-03（Phase 2，v0.2 修正版）
-- 分支：v3.0-awareness-restructure
-- 規格：docs/v2.1-course-spec.md v1.1.1
--       §1.16.3 / §1.16.5 / §1.16.6 / §1.16.8
--       §13.1.2 同一 User、雙姿態
--       §13.2.2 兩 Mode 共讀共寫同一份 user_state
--
-- v0.1 → v0.2 重要修正：
--   - 原本 fields 加在 journeys 表 → 移到 users 表
--   - 理由：
--     (a) §1.16.5 升級條件「完成 2 輪 21 天 → Master」需要跨 journey 持久
--     (b) Mode 2 諮詢師對話應在無 active journey 時也能讀 user state
--     (c) §13.1.2「同一 User、雙姿態」要求 state 為 user-level
--
-- 新增 4 個欄位到 users 表：
--   1. current_level: 'beginner' | 'advanced' | 'master'（default 'beginner'）
--   2. detected_personality_axes JSONB: { T_F, S_N, J_P, E_I } 浮動 bias
--   3. mastery_signals JSONB: AI 觀察到的熟練度訊號 array
--   4. level_upgrade_history JSONB: 升級判定歷史 array
--
-- Phase 2 涵蓋：
--   - Task 1（本檔）：schema 建立
--   - Task 5：personality 從 MBTI 簡單 mapping
--   - Task 2-3：buildContext.ts 讀 user_state 做動態 branching
--
-- Phase 2.5 涵蓋（不在此 migration）：
--   - Live-detect personality 動態調整 detected_personality_axes
--   - Auto-detect mastery criteria 從 mastery_signals 累積判定升級
--
-- 套用方式：
--   Supabase Dashboard → SQL Editor → New Query → 貼上全部 → Run
--
-- 可重跑：使用 ADD COLUMN IF NOT EXISTS，重跑安全。
-- 前置條件：必須先跑 001 + 002 + 003。
-- ============================================================


-- ============================================================
-- 1. 新增 user_state 4 個欄位到 users 表（user-level，跨 journey 持久）
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS current_level TEXT DEFAULT 'beginner'
    CHECK (current_level IN ('beginner', 'advanced', 'master')),
  ADD COLUMN IF NOT EXISTS detected_personality_axes JSONB DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS mastery_signals JSONB DEFAULT '[]'::JSONB,
  ADD COLUMN IF NOT EXISTS level_upgrade_history JSONB DEFAULT '[]'::JSONB;


-- ============================================================
-- 2. 加 column comments（給 schema documentation）
-- ============================================================

COMMENT ON COLUMN users.current_level IS
  'v1.1.0 §1.16.3 Maturity Level — beginner（未開始或第一輪 in progress）/ advanced（4S 已熟、完成 1 輪）/ master（完成 2+ 輪）。User-level state，跨所有 journey 持久。AI Tutor 按此 level 動態調整教學深度。';

COMMENT ON COLUMN users.detected_personality_axes IS
  'v1.1.0 §1.16.3 Personality bias — JSONB { T_F: number, S_N: number, J_P: number, E_I: number }，值域 -1.0 ~ +1.0。AI 用來調整教學風格（T-lead / F-lead 等）。Phase 2 從 MBTI 字母簡單推導；Phase 2.5 加 live-detect 動態調整。User-level，因為人格傾向跨 journey 不變。';

COMMENT ON COLUMN users.mastery_signals IS
  'v1.1.0 §1.16.6 AI 觀察到的熟練度訊號 array — [{ date, journey_id, signal_type, content }]。例如「連續 5 天能自然產出 4 步骨架」「自發雙向覺察出現」。累積 across journeys 觸發 maturity 升級。';

COMMENT ON COLUMN users.level_upgrade_history IS
  'v1.1.0 §1.16.5 升級判定歷史 array — [{ from_level, to_level, date, journey_id, criteria_met }]。記錄 user 從 beginner → advanced → master 的升級時點與依據。';


-- ============================================================
-- 3. 為既有 users 初始化 personality axes（從各自最新 active journey 的 mbti_self 推導）
-- ============================================================
-- 因為 mbti_self 在 journeys 表，需要 JOIN 取得
-- 同邏輯也在 src/lib/ai/personality.ts mbtiToPersonalityAxes() 實作

UPDATE users u
SET detected_personality_axes = jsonb_build_object(
  'E_I', CASE WHEN substring(j.mbti_self FROM 1 FOR 1) = 'E' THEN 0.7 ELSE -0.7 END,
  'S_N', CASE WHEN substring(j.mbti_self FROM 2 FOR 1) = 'S' THEN -0.7 ELSE 0.7 END,
  'T_F', CASE WHEN substring(j.mbti_self FROM 3 FOR 1) = 'T' THEN 0.7 ELSE -0.7 END,
  'J_P', CASE WHEN substring(j.mbti_self FROM 4 FOR 1) = 'J' THEN 0.7 ELSE -0.7 END
)
FROM journeys j
WHERE j.user_id = u.id
  AND j.is_active = true
  AND j.mbti_self IS NOT NULL
  AND char_length(j.mbti_self) = 4
  AND u.detected_personality_axes = '{}'::JSONB;


-- ============================================================
-- 驗證查詢（跑完後手動確認）
-- ============================================================
-- SELECT u.id, u.email, u.current_level, u.detected_personality_axes, j.mbti_self
-- FROM users u
-- LEFT JOIN journeys j ON j.user_id = u.id AND j.is_active = true;
--
-- 預期：
--   - 所有 users 的 current_level = 'beginner'
--   - 有 active journey + mbti_self 的 user → detected_personality_axes 已填入 ±0.7 bias
--   - 例：你（ENTJ）→ { E_I: 0.7, S_N: 0.7, T_F: 0.7, J_P: 0.7 }
--   - mastery_signals = []
--   - level_upgrade_history = []
