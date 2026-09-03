-- ============================================================
-- 99_dev_seed_extra.sql —— 補在 dev-seed.sql 之後跑
--
-- dev-seed.sql 的 8 個人物都沒有：
--   1. is_admin = true 的帳號（沒辦法登入 /admin）
--   2. Mode B「我卡住，幫我拆」的對話（8 個人物全部都是 Mode A）
--   3. 邀請碼資料（/admin/invites 會是空的）
--
-- 這份補上這三塊，讓資料庫「開箱」看起來更完整。
-- 全部合成資料，ID 用 e1000000- 開頭跟原本 dev-seed 的 d0000000- 區隔，
-- 保證不會撞號。
-- ============================================================

BEGIN;

-- ── 第 9 個人物：管理者（唯一 is_admin = true 的帳號）───────────
INSERT INTO public.users (id, phone, email, nickname, current_plan, role)
VALUES ('e1000000-0001-4000-8000-000000000009', '0900000009', 'admin@example.test', '管理者', 'premium', 'admin')
ON CONFLICT (id) DO NOTHING;

INSERT INTO happy.users (id, email, name, password_hash, nuwa_user_id, current_plan,
       mbti_self, mbti_confidence, mbti_set_at, is_admin)
VALUES ('e1000000-1001-4000-8000-000000000009', 'admin@example.test', '管理者', 'dev-no-password',
        'e1000000-0001-4000-8000-000000000009', 'premium',
        'INTJ', 'high', (CURRENT_DATE - INTERVAL '30 days'), TRUE)
ON CONFLICT (id) DO NOTHING;

-- 給管理者一個輕量的 journey（day 5/21），讓這個帳號同時能看前台使用者體驗
INSERT INTO happy.journeys (id, user_id, mbti_self, mbti_partner, mbti_confidence,
       partner_nickname, relationship_type, goal_statement, initial_problem,
       start_date, current_day, is_active, total_points)
VALUES ('e1000000-0002-4000-8000-000000000009', 'e1000000-1001-4000-8000-000000000009', 'INTJ', 'ENFP', 'high',
        '測試對象・管理者用', 'couple',
        '想在管理後台看得到自己前台的練習狀況。',
        '常常忙著看數據，忘記自己也要練習。',
        (CURRENT_DATE - INTERVAL '5 days'), 5,
        TRUE, 50)
ON CONFLICT (id) DO NOTHING;

INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('e1000000-0003-4000-8000-000000000901', 'e1000000-0002-4000-8000-000000000009', 1, (CURRENT_DATE - INTERVAL '4 days'), TRUE, 'success', 7, '第一天，先熟悉一下練習節奏。', 10)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('e1000000-0004-4000-8000-000000000901', 'e1000000-0002-4000-8000-000000000009', 'e1000000-1001-4000-8000-000000000009', 1, 'morning',
        '[{"role":"user","content":"我想先看看這個練習大概長怎樣。"},{"role":"assistant","content":"歡迎！我們就從今天的小任務開始，你想先聊聊最近跟他之間印象最深的一次互動嗎？"}]'::jsonb,
        '第 1 天的練習', NOW() - INTERVAL '4 days', NULL)
ON CONFLICT (id) DO NOTHING;

-- ── Mode B「我卡住，幫我拆」對話補充（原本 8 個人物全是 Mode A）──

-- 用「測試用戶・進行中」補一則已封存的諮詢主題
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('e1000000-0004-4000-8000-000000000101', 'd0000000-0002-4000-8000-000000000003', 'd0000000-1001-4000-8000-000000000003', 0, 'consultant',
        '[{"role":"user","content":"我主管一直在會議上打斷我說話，我該怎麼辦？"},{"role":"assistant","content":"聽起來這件事讓你很不好受。可以說說最近一次發生的情況嗎？"},{"role":"user","content":"上週三的專案會議，我話講到一半他就說「重點是什麼」，我當下腦袋一片空白。"},{"role":"assistant","content":"那個當下，你心裡冒出的第一個念頭是什麼？"},{"role":"user","content":"覺得自己是不是講話太沒重點了，很丟臉。"},{"role":"assistant","content":"如果先不管「該不該覺得丟臉」，你當下真正想要的是什麼？"},{"role":"user","content":"我想要他讓我把話講完，至少給我三十秒。"}]'::jsonb,
        '主管開會打斷我、講話沒自信', NOW() - INTERVAL '6 days', NOW() - INTERVAL '5 days')
ON CONFLICT (id) DO NOTHING;

-- 用「測試用戶・未開課」補一則進行中的諮詢主題（trier 模式：不需要 journey）
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('e1000000-0004-4000-8000-000000000102', NULL, 'd0000000-1001-4000-8000-000000000008', 0, 'consultant',
        '[{"role":"user","content":"我女兒最近考試成績掉很多，一問她就說「隨便」，我很擔心又不知道怎麼開口。"},{"role":"assistant","content":"嗨，我是小羽老師 🌸 聽起來你很在意她，也有點不知所措。她說「隨便」的時候，語氣是什麼樣子？"},{"role":"user","content":"很冷淡，眼睛也不看我，滑手機。"},{"role":"assistant","content":"我聽到了。那當下你的第一反應是什麼？是想繼續追問、還是先離開？"},{"role":"user","content":"我會想繼續問，但問到後來變成說教，她就更不想理我。"}]'::jsonb,
        '女兒成績下滑、不肯講話', NOW() - INTERVAL '1 days', NULL)
ON CONFLICT (id) DO NOTHING;

-- 用管理者帳號補一則諮詢主題，測「同一帳號同時有 Mode A + Mode B 資料」
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('e1000000-0004-4000-8000-000000000103', 'e1000000-0002-4000-8000-000000000009', 'e1000000-1001-4000-8000-000000000009', 0, 'consultant',
        '[{"role":"user","content":"同事一直把工作丟給我，我不知道怎麼拒絕。"},{"role":"assistant","content":"這種情況感覺不是第一次發生了。上一次類似的事，你是怎麼處理的？"},{"role":"user","content":"上次我還是接了，結果自己加班到很晚。"}]'::jsonb,
        '同事一直推工作、不會拒絕', NOW() - INTERVAL '2 days', NULL)
ON CONFLICT (id) DO NOTHING;

-- ── 邀請碼（/admin/invites 用）───────────────────────────────
INSERT INTO happy.invite_codes (code, used_by, used_at, created_at, expires_at) VALUES
  ('BETA-2026-001', 'd0000000-1001-4000-8000-000000000003', NOW() - INTERVAL '12 days', NOW() - INTERVAL '20 days', NULL),
  ('BETA-2026-002', 'd0000000-1001-4000-8000-000000000004', NOW() - INTERVAL '21 days', NOW() - INTERVAL '25 days', NULL),
  ('BETA-2026-003', NULL, NULL, NOW() - INTERVAL '10 days', NOW() + INTERVAL '80 days'),
  ('BETA-2026-004', NULL, NULL, NOW() - INTERVAL '10 days', NOW() + INTERVAL '80 days'),
  ('BETA-2026-005', NULL, NULL, NOW() - INTERVAL '10 days', NOW() + INTERVAL '80 days'),
  ('INTERNAL-TEST-001', NULL, NULL, NOW() - INTERVAL '60 days', NOW() - INTERVAL '5 days'),
  ('INTERNAL-TEST-002', NULL, NULL, NOW() - INTERVAL '60 days', NOW() - INTERVAL '5 days')
ON CONFLICT (code) DO NOTHING;

COMMIT;

-- ── 產生內容摘要 ──────────────────────────────────────────────
--   管理者               premium    day  5/21  is_admin=true，唯一能登入 /admin 的帳號
--   + 3 則 Mode B「我卡住，幫我拆」對話（進行中/未開課/管理者 各補一則）
--   + 7 組邀請碼（2 已使用、3 可用、2 已過期）
