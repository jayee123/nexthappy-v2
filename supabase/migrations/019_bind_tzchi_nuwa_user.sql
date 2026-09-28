-- ============================================================
-- 019_bind_tzchi_nuwa_user.sql
--
-- 資料修正：把私版遺留的 tzchi0823@gmail.com 綁到公版同 email 的帳號
--
-- 背景（Steve 2026-09-28 §三）：私版訂閱管理有 6 人、公版只有 5 人，多出來的
-- 是 tzchi0823（子奇，私版時代建立，nuwa_user_id 為 NULL）。查證：
--   · 私版：2026-07-30 建立，欄位寫 premium，2026-09-02 已封存，0 對話 0 呼叫
--   · 公版：同 email 的帳號 2026-08-04 建立，free
-- 他下次用這個 email 從公版進來，/sso 也會自動用 email 補綁；主動綁掉比較乾淨，
-- 後台就不會再有「公版看不到的人」。綁定後方案由公版決定（free），私版那個
-- premium 只是過期欄位，不再被讀。
--
-- 只綁「還沒綁」的那一筆；跑第二次是 no-op。
-- ============================================================

UPDATE happy.users h
   SET nuwa_user_id = p.id
  FROM public.users p
 WHERE h.email = 'tzchi0823@gmail.com'
   AND h.nuwa_user_id IS NULL
   AND p.email = 'tzchi0823@gmail.com';

-- ── 驗證（跑完會回一列）───────────────────────────────────────
SELECT h.email,
       h.nuwa_user_id,
       p.current_plan AS 公版方案,
       CASE WHEN h.nuwa_user_id = p.id THEN '✅ 019 已綁定' ELSE '❌ 未綁定' END AS 驗證結果
  FROM happy.users h
  LEFT JOIN public.users p ON p.email = h.email
 WHERE h.email = 'tzchi0823@gmail.com';
