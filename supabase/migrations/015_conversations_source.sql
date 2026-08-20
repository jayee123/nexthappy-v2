-- ============================================================
-- 015_conversations_source.sql
--
-- 補上 conversations.source 欄位。
--
-- 問題：
--   程式碼一直在讀寫這個欄位，但從來沒有任何 migration 建立它。
--   造成兩個一直存在、且互不相關的故障：
--
--   ① 後台「對話歷史」點進任何一筆 → 顯示「找不到此對話」
--      src/app/api/admin/conversations/[id]/route.ts:63 的 select 含 source，
--      PostgREST 回 400（42703 column does not exist），
--      程式把它當成查無資料，回 404。
--      → 影響【全部】對話，不只語音。
--
--   ② 語音對話 100% 儲存失敗、內容直接遺失
--      src/app/api/realtime/save/route.ts:71 insert 帶 source: 'voice'，
--      同樣 42703 → 使用者看到「儲存失敗」。
--
-- 預設值為何是 'text'：
--   全部既有資料都來自文字路徑（ai/chat、ai/consultant、day/*），
--   那些路徑都不寫 source。只有 realtime/save 會寫 'voice'。
--   執行當下既有 2 筆，皆為文字對話。
-- ============================================================

ALTER TABLE happy.conversations
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'text';

-- 限制合法值。用 DO 包起來讓這支可以重複執行。
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'conversations_source_check'
  ) THEN
    ALTER TABLE happy.conversations
      ADD CONSTRAINT conversations_source_check CHECK (source IN ('text', 'voice'));
  END IF;
END $$;

COMMENT ON COLUMN happy.conversations.source IS
  '對話來源：text = 文字輸入（預設）、voice = 語音（realtime/save 寫入）';


-- ── 驗證（預期：欄位存在、既有資料皆為 text）──────────────
SELECT source, count(*) FROM happy.conversations GROUP BY source;
