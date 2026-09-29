-- ============================================================
-- 019_bind_tzchi_nuwa_user.sql（09-29 改寫：不綁定，改停權）
--
-- 背景（Steve 2026-09-28 §三）：私版有 tzchi0823@gmail.com（子奇，私版時代建立，
-- nuwa_user_id 為 NULL、2026-09-02 已封存、0 對話 0 呼叫）；公版用戶管理看不到它。
--
-- 原本要把它綁到公版同 email 的帳號。**再查證後不能綁**：公版那個帳號
-- 2026-08-04 建立、**2026-08-12 已軟刪除**（users.deleted_at，migration 020），
-- 所以用戶管理才看不到。綁到一個已刪除的公版帳號沒有意義，也違反
-- 「公版是帳號真值」—— 公版說這個人不存在，私版就不該讓他還能進來。
--
-- 改成：私版這筆一併停權（suspended_at），與公版的刪除狀態一致。
--   · 封存（archived_at）不擋登入，停權才擋（018 的三分法）
--   · 這筆沒綁公版，若私版本地登入仍可用，它會繞過所有額度檢查 —— 停權堵住這個口
-- 子奇本人用 techi0823（兩邊都有、已綁定）正常使用，不受影響。
--
-- 只動「未綁定且尚未停權」的那一筆；跑第二次是 no-op。
-- ============================================================

UPDATE happy.users
   SET suspended_at = NOW()
 WHERE email = 'tzchi0823@gmail.com'
   AND nuwa_user_id IS NULL
   AND suspended_at IS NULL;

-- ── 驗證（跑完會回一列）───────────────────────────────────────
SELECT h.email,
       h.nuwa_user_id,
       h.archived_at,
       h.suspended_at,
       p.deleted_at AS 公版刪除時間,
       CASE WHEN h.suspended_at IS NOT NULL AND p.deleted_at IS NOT NULL
            THEN '✅ 019 完成：私版已停權，與公版刪除狀態一致'
            ELSE '❌ 狀態不符' END AS 驗證結果
  FROM happy.users h
  LEFT JOIN public.users p ON p.email = h.email
 WHERE h.email = 'tzchi0823@gmail.com';
