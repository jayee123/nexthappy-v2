-- ============================================================
-- 021_guardrail_logs_verdict.sql
--
-- 讓人工審查能真的「改變」guardrail 的判斷，而不是只留備註看好玩：
-- 在 020_guardrail_logs.sql 的 reviewed／reviewer_note 之外，加一個
-- 結構化的 verdict 欄位，讓人工明確下結論「系統這次判斷對不對」。
--
-- 之後 verdict = 'false_positive' 的案例，會被 api/guardrail-check.py
-- 動態撈出來（經 src/lib/ai/guardrailCorrections.ts 快取），當成
-- few-shot 範例塞進 self_check_extraction 的分類 prompt 裡，
-- 讓真人複查的結論直接回頭影響下一次的 AI 判斷——不是只存著好看。
--
-- 只有 false_positive 會被拿去當範例；correct（判斷正確、人工確認）
-- 只是留紀錄，不會反過來影響 prompt（本來就判對了，不需要糾正）。
--
-- 可重跑：ADD COLUMN IF NOT EXISTS、CREATE INDEX IF NOT EXISTS。
-- ============================================================

ALTER TABLE happy.guardrail_logs
  ADD COLUMN IF NOT EXISTS verdict TEXT CHECK (verdict IN ('correct', 'false_positive'));

COMMENT ON COLUMN happy.guardrail_logs.verdict IS
  '人工複查結論：correct=系統判斷正確、false_positive=系統誤判。NULL=尚未下結論。false_positive 會被 api/guardrail-check.py 動態撈出來，回饋進 self_check_extraction 的分類 prompt。';

-- 只給「還沒下結論」跟「誤判」兩種狀態建索引：
--   1. reviewed=false 的（既有，見 020）是人工待審查的 queue
--   2. verdict='false_positive' 的是 api/guardrail-check.py 要撈的 correction 來源
CREATE INDEX IF NOT EXISTS idx_guardrail_logs_false_positive
  ON happy.guardrail_logs (created_at DESC)
  WHERE verdict = 'false_positive';


-- ── 驗證：跑完貼這段 ──────────────────────────────
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_schema = 'happy' AND table_name = 'guardrail_logs' AND column_name = 'verdict';
