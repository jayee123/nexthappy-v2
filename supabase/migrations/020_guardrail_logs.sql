-- ============================================================
-- 020_guardrail_logs.sql
--
-- 中高風險 guardrail 對話記錄表：給人工事後審查誤判用。
--
-- 背景：public/roadmap/guardrail-plan.html §10「防護記錄要不要存訊息
-- 原文」一直是待決策狀態；這次需求明確要求中高風險的對話要留 log 給
-- 人工（語者2）截圖、回饋、打磨規則，所以決定要存。
--
-- 只記套話風險（extraction）軸的 mid／high，不含單純離題（off_topic）——
-- 離題只是體驗優化，不是商業 IP 防護的核心，不需要留原文審查。
--
-- 寫入端：src/app/api/ai/chat/route.ts、consultant/route.ts 在 guardrail
-- 判定 blocked 且風險軸是 extraction 時寫一筆（見這兩支檔案的改動）。
--
-- 為什麼沒有 RLS：
--   跟 016_system_params.sql 同理，所有存取都走 API Routes 的
--   supabaseAdmin（service_role）。
--   （另見 010_disable_audit_log_rls.sql：Supabase 用 FORCE ROW LEVEL
--     SECURITY 的話連 service_role 都會被擋，開了反而讀不到。）
--
-- 可重跑：CREATE TABLE/INDEX 都加 IF NOT EXISTS。
-- ============================================================

CREATE TABLE IF NOT EXISTS happy.guardrail_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id        UUID REFERENCES happy.users(id) ON DELETE SET NULL,
  session_key    TEXT NOT NULL,
  route          TEXT NOT NULL CHECK (route IN ('chat', 'consultant')),
  message        TEXT NOT NULL,
  outcome        TEXT NOT NULL,
  risk_tier      TEXT NOT NULL CHECK (risk_tier IN ('mid', 'high')),
  refusal_text   TEXT,
  reviewed       BOOLEAN NOT NULL DEFAULT false,
  reviewer_note  TEXT
);

COMMENT ON TABLE happy.guardrail_logs IS
  '套話風險 mid／high 的對話原文記錄，供人工事後審查是否誤判、回饋打磨 prompt。只記 extraction 軸，不含單純離題 off_topic。';
COMMENT ON COLUMN happy.guardrail_logs.session_key IS
  '對應 api/guardrail-check.py 升級階梯計數的 key（例如 "<userId>:chat"）。';
COMMENT ON COLUMN happy.guardrail_logs.outcome IS
  '例如 extraction_mid_1／extraction_mid_2／extraction_mid_3／extraction_mid_escalated／extraction_high，見 api/guardrail-check.py。';
COMMENT ON COLUMN happy.guardrail_logs.refusal_text IS
  '實際回給使用者的那句話（中風險前兩步是動態生成的反問句，每次可能不同）。';
COMMENT ON COLUMN happy.guardrail_logs.reviewed IS
  '人工是否已經看過這筆、確認是不是誤判。預設 false；後台頁面做出來後可以勾選。';
COMMENT ON COLUMN happy.guardrail_logs.reviewer_note IS
  '人工複查備註，例如「誤判，使用者只是想問媽媽的心理」。';

CREATE INDEX IF NOT EXISTS idx_guardrail_logs_created_at ON happy.guardrail_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guardrail_logs_reviewed ON happy.guardrail_logs (reviewed) WHERE reviewed = false;


-- ── 驗證：跑完貼這段 ──────────────────────────────
-- 期待：欄位齊全、目前 0 筆
--
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_schema = 'happy' AND table_name = 'guardrail_logs'
--   ORDER BY ordinal_position;
--
-- SELECT count(*) FROM happy.guardrail_logs;
