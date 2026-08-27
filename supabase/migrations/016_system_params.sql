-- ============================================================
-- 016_system_params.sql
--
-- 後台通用設定表（key/value）。
--
-- 為什麼要這張表：
--   私版後台目前沒有任何「可調設定」的儲存位置 —— /admin/settings 底下
--   只有 Admin 列表與 Audit Log，兩者都是既有資料表的檢視，不是設定。
--   任何要讓管理員自己改的東西（第一個是公版欄位的標示配色）都無處可放，
--   只能寫死在程式碼裡、改一次要重新部署一次。
--
-- 為什麼叫 system_params：
--   與公版（nuwa v2）的 public.system_params 同名同形狀。兩版後台的設定
--   概念一致時用同一個名字，日後互相參照或搬移邏輯不用重新對應欄位。
--
-- 為什麼是 key/value 而不是每個設定一個欄位：
--   設定項會持續增加（配色、預設分頁筆數、通知開關⋯）。一設定一欄位的話
--   每加一項就要一支 migration；key/value 只要 INSERT 一列，零 migration。
--   代價是失去型別檢查 —— 因此值的驗證放在寫入端（API）做，見
--   src/app/api/admin/settings/appearance/route.ts 的 hex 格式檢查。
--
-- 為什麼沒有 RLS：
--   私版所有 DB 存取都走 API Routes 的 supabaseAdmin（service_role），
--   且此表的寫入端已由 requireAdmin() 擋過。
--   （另見 010_disable_audit_log_rls.sql：Supabase 用 FORCE ROW LEVEL SECURITY，
--     連 service_role 都會被擋，開了反而讀不到。）
-- ============================================================

CREATE TABLE IF NOT EXISTS happy.system_params (
  key         TEXT PRIMARY KEY,
  value       TEXT,
  updated_by  UUID REFERENCES happy.users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE happy.system_params IS
  '後台通用設定（key/value）。值的格式驗證在寫入端 API 做，不在 DB 層。';
COMMENT ON COLUMN happy.system_params.key IS
  '設定鍵，採 "區塊.項目" 命名，例如 admin.market_field_bg';
COMMENT ON COLUMN happy.system_params.updated_by IS
  '最後修改者。管理員被刪除時設為 NULL，不連帶刪掉設定值。';


-- ── 初始值：公版欄位的標示配色 ────────────────────────────
-- 與 src/lib/admin/marketField.ts 的 DEFAULT_* 一致（Tailwind 的
-- bg-blue-50 / text-blue-700）。這裡先寫進去，管理員之後可在
-- /admin/settings 的「外觀」分頁改。
--
-- ON CONFLICT DO NOTHING：讓這支可以重複執行，且不會把管理員
-- 已經改過的顏色蓋回預設值。
INSERT INTO happy.system_params (key, value) VALUES
  ('admin.market_field_bg', '#EFF6FF'),
  ('admin.market_field_fg', '#1D4ED8')
ON CONFLICT (key) DO NOTHING;


-- ── 驗證（預期：兩列，值如上）──────────────────────────────
SELECT key, value, updated_at
FROM happy.system_params
ORDER BY key;
