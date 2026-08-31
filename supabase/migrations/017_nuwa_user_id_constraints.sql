-- ============================================================
-- 017_nuwa_user_id_constraints.sql
--
-- happy.users.nuwa_user_id：型別對齊 UUID + 補上唯一索引。
--
-- 背景：
--   這一欄是私版指向公版身分的唯一連結（public.users.id），
--   但 combined-happy-schema.sql 只寫了一行 `nuwa_user_id TEXT,` ——
--   沒有型別對齊、沒有唯一性、沒有索引。三個實際後果：
--
--   ① 型別不符（TEXT vs 公版的 UUID）
--      lib/market/users.ts 的 `.in('id', ids)` 是靠 Postgres 隱式轉型才會動。
--      只要有一筆髒值不是合法 UUID，整個查詢會拋錯，後台學員列表的公版欄位
--      就全部 fallback 成私版本地值 —— 而且是靜默的（console.error 只在
--      server log，畫面上看不出來）。
--
--   ② 沒有 UNIQUE
--      兩筆私版帳號可以指向同一個公版用戶。而 sso/route.ts 用
--      `.eq('nuwa_user_id', ...).maybeSingle()` 查，撞到重複會拋錯 ——
--      那個人從此登不進來。
--      這不是假設：sso 第 2 步會用 email 補綁，同一個人若在私版有兩筆
--      （舊的本地帳號 + SSO 建的），就會產生同 nuwa_user_id 的兩列。
--      014 清掉的正是這類孤兒，但當時沒有加約束防止再發生。
--
--   ③ 沒有索引
--      每次 SSO 登入都要全表掃描 happy.users。
--
-- 為什麼不加 FOREIGN KEY：
--   公私版目前同一個 Supabase database，跨 schema FK 在 Postgres 做得到。
--   但加了之後，私版就再也不能搬到獨立的 Supabase project ——
--   而那正是第 2、3 隻 App 遲早要走的路（外部夥伴的 App 不會跟我們同一個庫）。
--   這是刻意的取捨，不是遺漏。**請不要「好心」補上。**
--
-- 前置檢查已於 2026-08-29 執行，7 筆全部乾淨：
--   id 與 nuwa_user_id 不相同、無 NULL、格式皆為合法 UUID、公版都查得到、無重複。
--
-- 可重跑：IF NOT EXISTS + 型別檢查，重跑安全。
-- ============================================================

SET search_path TO happy, public;


-- ─────────────────────────────────────────────────────────
-- STEP 0（只讀，先跑這段）：確認沒有髒值，否則 ::uuid 會炸
-- ─────────────────────────────────────────────────────────
-- 三個數字都要是 0 才能往下跑。
--
-- SELECT
--   (SELECT count(*) FROM happy.users
--      WHERE nuwa_user_id IS NOT NULL
--        AND nuwa_user_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
--   ) AS 格式不對,
--   (SELECT count(*) FROM (
--      SELECT nuwa_user_id FROM happy.users
--      WHERE nuwa_user_id IS NOT NULL
--      GROUP BY nuwa_user_id HAVING count(*) > 1) t
--   ) AS 重複綁定,
--   (SELECT count(*) FROM happy.users h
--      LEFT JOIN public.users p ON p.id::text = h.nuwa_user_id
--      WHERE h.nuwa_user_id IS NOT NULL AND p.id IS NULL
--   ) AS 公版查無此人;


-- ─────────────────────────────────────────────────────────
-- ① 型別 TEXT → UUID
-- ─────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'happy'
      AND table_name = 'users'
      AND column_name = 'nuwa_user_id'
      AND data_type <> 'uuid'
  ) THEN
    ALTER TABLE happy.users
      ALTER COLUMN nuwa_user_id TYPE UUID USING nuwa_user_id::uuid;
  END IF;
END $$;

COMMENT ON COLUMN happy.users.nuwa_user_id IS
  '公版 public.users.id（帳號的唯一真實來源）。NULL = 尚未綁定公版。'
  '刻意不設 FK —— 見 017 migration 的說明。';


-- ─────────────────────────────────────────────────────────
-- ② 唯一索引（NULL 不受限，未綁定的帳號可以有多筆）
-- ─────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS users_nuwa_user_id_key
  ON happy.users (nuwa_user_id)
  WHERE nuwa_user_id IS NOT NULL;


-- ─────────────────────────────────────────────────────────
-- 驗證：跑完貼這段，兩欄都要對
-- ─────────────────────────────────────────────────────────
SELECT
  (SELECT data_type FROM information_schema.columns
     WHERE table_schema='happy' AND table_name='users'
       AND column_name='nuwa_user_id')                          AS 型別,
  EXISTS(SELECT 1 FROM pg_indexes
     WHERE schemaname='happy' AND indexname='users_nuwa_user_id_key') AS 有唯一索引;
-- 期待：型別 = uuid、有唯一索引 = true
