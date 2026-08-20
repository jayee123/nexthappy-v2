-- ============================================================
-- 014_drop_unlinked_users.sql
--
-- 清除「未綁定公版」的私版帳號。
--
-- 背景：
--   #3a 之後私版停用獨立註冊，帳號真值只有公版一份，所有私版帳號都由
--   /sso 建立並寫入 nuwa_user_id。在那之前用私版註冊表單建立的帳號，
--   若其對應的公版帳號不存在或已停用，就會卡成孤兒 ——
--   永遠登不進來（登入要走公版），也永遠讀不到方案（要靠 nuwa_user_id）。
--
--   決策：以公版為單一真相來源，未同步的私版帳號一律放棄。
--
-- 執行前已確認（2026-08-20）：
--   唯一符合條件的是 tzchi0823@gmail.com（建於 2026-07-30），
--   journeys / conversations / daily_records / daily_memories /
--   blindspot_records / achievements / ai_usage_logs 全部為 0 筆。
--
-- ⚠️ 這支會 DELETE。請先跑 STEP 1 確認範圍，再跑 STEP 2。
-- ============================================================


-- ─────────────────────────────────────────────────────────
-- STEP 1：先看會刪到誰、各自有多少資料（唯讀，安全）
-- ─────────────────────────────────────────────────────────
SELECT
  u.id,
  u.email,
  u.name,
  u.created_at,
  (SELECT count(*) FROM happy.journeys      j WHERE j.user_id = u.id) AS journeys,
  (SELECT count(*) FROM happy.conversations c WHERE c.user_id = u.id) AS conversations,
  (SELECT count(*) FROM happy.ai_usage_logs a WHERE a.user_id = u.id) AS usage_logs
FROM happy.users u
WHERE u.nuwa_user_id IS NULL
ORDER BY u.created_at;

-- 🚨 若上面任何一列的 journeys / conversations / usage_logs 不是 0，
--    【停下來】不要跑 STEP 2 —— 那表示有資料會被連帶刪除
--    （FK 是 ON DELETE CASCADE，見 011_fk_cascade_fix.sql）。
--    這種情況應該改為補綁 nuwa_user_id，而不是刪除。


-- ─────────────────────────────────────────────────────────
-- STEP 2：確認 STEP 1 全部為 0 之後再執行
-- ─────────────────────────────────────────────────────────
-- 這裡刻意重複一次「零資料」條件，即使有人跳過 STEP 1 直接執行，
-- 有資料的帳號也不會被刪掉。
DELETE FROM happy.users u
WHERE u.nuwa_user_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM happy.journeys      j WHERE j.user_id = u.id)
  AND NOT EXISTS (SELECT 1 FROM happy.conversations c WHERE c.user_id = u.id)
  AND NOT EXISTS (SELECT 1 FROM happy.ai_usage_logs a WHERE a.user_id = u.id);


-- ─────────────────────────────────────────────────────────
-- STEP 3：驗證（預期回傳 0 列）
-- ─────────────────────────────────────────────────────────
SELECT count(*) AS remaining_unlinked
FROM happy.users
WHERE nuwa_user_id IS NULL;


-- ============================================================
-- 之後還會不會再產生孤兒？
--
--   不會。私版已無註冊入口（middleware 將 /auth/register 導向公版），
--   唯一的建帳號路徑是 src/app/sso/route.ts，該處三種情況都會寫入
--   nuwa_user_id。因此這是一次性的歷史資料清理。
-- ============================================================
