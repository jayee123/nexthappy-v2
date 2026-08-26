-- ============================================================
-- nexthappy 本機開發用測試資料（合成）
--
-- ⚠️ 這份檔案【不含任何真實用戶資料】。
--    所有姓名、對話、日記都是 scripts/dev-seed/personas.mjs 裡手寫的素材，
--    由 scripts/dev-seed/generate.mjs 產生。要改內容請改那兩支再重新產生。
--
-- 前置條件（順序不可顛倒）：
--   1. 已跑完公版 nuwa 的 23 支 migration    → public schema
--   2. 已建立 happy schema 並跑完私版 13 支 migration
--      ⚠️ 私版 migration 【沒有寫 schema 前綴、也沒設 search_path】，
--         執行前務必先 SET search_path TO happy; 否則表會建到 public，
--         跟公版的 users 表撞在一起。
--
-- 執行：貼進 Supabase SQL Editor，或 psql -f supabase/dev-seed.sql
-- ============================================================

BEGIN;

-- ── public.apps ──────────────────────────────────────────────
-- SSO 的目標網址。本機開發指向 localhost:3001（私版的 port）。
-- sso_secret 是佔位字串，本機只要與私版 .env.local 的 SSO_SECRET 一致即可。
INSERT INTO public.apps (id, slug, name, tagline, icon, app_url, db_schema, sso_secret, required_plan, status, sort_order)
VALUES ('d0000000-0009-4000-8000-000000000001', 'happy', '幸福關係', '21 天關係練習', '💛',
        'http://localhost:3001', 'happy', 'dev-local-sso-secret-change-me', NULL, 'active', 1)
ON CONFLICT (slug) DO UPDATE
  SET app_url = EXCLUDED.app_url, sso_secret = EXCLUDED.sso_secret, status = 'active';

-- ── public.users（公版帳號主檔）──────────────────────────────
-- 私版透過 happy.users.nuwa_user_id 指回這裡，讀 email / nickname / current_plan。
INSERT INTO public.users (id, phone, email, nickname, current_plan, role)
VALUES ('d0000000-0001-4000-8000-000000000001', '0900000001', 'dev1@example.test', '測試用戶・全新', 'free', 'user')
ON CONFLICT (id) DO NOTHING;   -- 剛 SSO 進來、user 層還沒有 MBTI。測 /sso 落在 /onboarding 這條路徑
INSERT INTO public.users (id, phone, email, nickname, current_plan, role)
VALUES ('d0000000-0001-4000-8000-000000000002', '0900000002', 'dev2@example.test', '測試用戶・初期', 'basic', 'user')
ON CONFLICT (id) DO NOTHING;   -- 剛起步。測進度條低百分比、成就尚未解鎖
INSERT INTO public.users (id, phone, email, nickname, current_plan, role)
VALUES ('d0000000-0001-4000-8000-000000000003', '0900000003', 'dev3@example.test', '測試用戶・進行中', 'advanced', 'user')
ON CONFLICT (id) DO NOTHING;   -- 最典型的使用中狀態。資料量最完整，日常開發主要看這筆
INSERT INTO public.users (id, phone, email, nickname, current_plan, role)
VALUES ('d0000000-0001-4000-8000-000000000004', '0900000004', 'dev4@example.test', '測試用戶・已完課', 'premium', 'user')
ON CONFLICT (id) DO NOTHING;   -- 21 天全完成。測結業畫面、滿版成就、進度條 100% 不會溢位
INSERT INTO public.users (id, phone, email, nickname, current_plan, role)
VALUES ('d0000000-0001-4000-8000-000000000005', '0900000005', 'dev5@example.test', '測試用戶・已退訂', 'cancelled', 'user')
ON CONFLICT (id) DO NOTHING;   -- 有資料但方案已失效。測額度擋人時舊資料還讀不讀得到
INSERT INTO public.users (id, phone, email, nickname, current_plan, role)
VALUES ('d0000000-0001-4000-8000-000000000006', '0900000006', 'dev6@example.test', '測試用戶・邊界值', 'premium', 'user')
ON CONFLICT (id) DO NOTHING;   -- 專門放極端值：超長日記、emoji、單輪與超長對話、可為 null 的欄位全空
INSERT INTO public.users (id, phone, email, nickname, current_plan, role)
VALUES ('d0000000-0001-4000-8000-000000000007', '0900000007', 'dev7@example.test', '測試用戶・親子', 'basic', 'user')
ON CONFLICT (id) DO NOTHING;   -- relationship_type 不是 couple。文案會依關係類型變化，只測 couple 會漏
INSERT INTO public.users (id, phone, email, nickname, current_plan, role)
VALUES ('d0000000-0001-4000-8000-000000000008', '0900000008', 'dev8@example.test', '測試用戶・未開課', 'basic', 'user')
ON CONFLICT (id) DO NOTHING;   -- 做完 onboarding（user 層已有 MBTI）但還沒開任何一輪。測 /chat 空狀態，以及 Mode B 不需 journey 也能用

-- ── happy.users（私版帳號）───────────────────────────────────
-- password_hash 是佔位值：SSO 帳號本來就沒有密碼，只能走 /sso 進入。
INSERT INTO happy.users (id, email, name, password_hash, nuwa_user_id, current_plan,
       mbti_self, mbti_confidence, mbti_set_at)
VALUES ('d0000000-1001-4000-8000-000000000001', 'dev1@example.test', '測試用戶・全新', 'dev-no-password', 'd0000000-0001-4000-8000-000000000001', 'trial',
        NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.users (id, email, name, password_hash, nuwa_user_id, current_plan,
       mbti_self, mbti_confidence, mbti_set_at)
VALUES ('d0000000-1001-4000-8000-000000000002', 'dev2@example.test', '測試用戶・初期', 'dev-no-password', 'd0000000-0001-4000-8000-000000000002', 'basic',
        'INFP', 'medium', (CURRENT_DATE - INTERVAL '3 days'))
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.users (id, email, name, password_hash, nuwa_user_id, current_plan,
       mbti_self, mbti_confidence, mbti_set_at)
VALUES ('d0000000-1001-4000-8000-000000000003', 'dev3@example.test', '測試用戶・進行中', 'dev-no-password', 'd0000000-0001-4000-8000-000000000003', 'advanced',
        'ENFJ', 'high', (CURRENT_DATE - INTERVAL '12 days'))
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.users (id, email, name, password_hash, nuwa_user_id, current_plan,
       mbti_self, mbti_confidence, mbti_set_at)
VALUES ('d0000000-1001-4000-8000-000000000004', 'dev4@example.test', '測試用戶・已完課', 'dev-no-password', 'd0000000-0001-4000-8000-000000000004', 'premium',
        'ISTJ', 'high', (CURRENT_DATE - INTERVAL '21 days'))
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.users (id, email, name, password_hash, nuwa_user_id, current_plan,
       mbti_self, mbti_confidence, mbti_set_at)
VALUES ('d0000000-1001-4000-8000-000000000005', 'dev5@example.test', '測試用戶・已退訂', 'dev-no-password', 'd0000000-0001-4000-8000-000000000005', 'cancelled',
        'ISFP', 'low', (CURRENT_DATE - INTERVAL '8 days'))
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.users (id, email, name, password_hash, nuwa_user_id, current_plan,
       mbti_self, mbti_confidence, mbti_set_at)
VALUES ('d0000000-1001-4000-8000-000000000006', 'dev6@example.test', '測試用戶・邊界值', 'dev-no-password', 'd0000000-0001-4000-8000-000000000006', 'premium',
        'INTJ', 'low', (CURRENT_DATE - INTERVAL '5 days'))
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.users (id, email, name, password_hash, nuwa_user_id, current_plan,
       mbti_self, mbti_confidence, mbti_set_at)
VALUES ('d0000000-1001-4000-8000-000000000007', 'dev7@example.test', '測試用戶・親子', 'dev-no-password', 'd0000000-0001-4000-8000-000000000007', 'basic',
        'ESFJ', 'medium', (CURRENT_DATE - INTERVAL '6 days'))
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.users (id, email, name, password_hash, nuwa_user_id, current_plan,
       mbti_self, mbti_confidence, mbti_set_at)
VALUES ('d0000000-1001-4000-8000-000000000008', 'dev8@example.test', '測試用戶・未開課', 'dev-no-password', 'd0000000-0001-4000-8000-000000000008', 'basic',
        'ENTP', 'medium', (CURRENT_DATE - INTERVAL '0 days'))
ON CONFLICT (id) DO NOTHING;

-- ── happy.journeys 與每日紀錄 ────────────────────────────────
-- 測試用戶・全新：刻意【不建立 journey】—— 剛 SSO 進來、user 層還沒有 MBTI。測 /sso 落在 /onboarding 這條路徑

-- 測試用戶・初期（day 3/21）：剛起步。測進度條低百分比、成就尚未解鎖
INSERT INTO happy.journeys (id, user_id, mbti_self, mbti_partner, mbti_confidence,
       partner_nickname, relationship_type, goal_statement, initial_problem,
       start_date, current_day, is_active, total_points)
VALUES ('d0000000-0002-4000-8000-000000000002', 'd0000000-1001-4000-8000-000000000002', 'INFP', 'ESTJ', 'medium',
        '測試對象B', 'couple',
        '想練習把心裡的感受講出來，而不是等對方猜。',
        '兩個人都很忙，回到家幾乎沒有交集。',
        (CURRENT_DATE - INTERVAL '3 days'), 3,
        TRUE, 30)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000201', 'd0000000-0002-4000-8000-000000000002', 1, (CURRENT_DATE - INTERVAL '2 days'), FALSE, 'failed', 7, '早上出門前有好好說再見，是這幾週第一次。', 0)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000201', 'd0000000-0002-4000-8000-000000000002', 'd0000000-1001-4000-8000-000000000002', 1, 'morning', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"},{"role":"user","content":"大概是……我覺得自己不重要吧。"},{"role":"assistant","content":"「我覺得自己不重要」——這句話你有直接跟對方說過嗎？"},{"role":"user","content":"沒有，我講不出口。"},{"role":"assistant","content":"講不出口的時候，通常會冒出什麼念頭擋住你？"},{"role":"user","content":"會覺得講了很丟臉，好像在討拍。"},{"role":"assistant","content":"如果今天換成對方這樣對你說，你會覺得他在討拍嗎？"}]'::jsonb,
        '第 1 天的練習', NOW() - INTERVAL '2 days', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000202', 'd0000000-0002-4000-8000-000000000002', 2, (CURRENT_DATE - INTERVAL '1 days'), TRUE, 'success', 2, '還是忍不住先講了道理，等到講完才發現對方只是想被聽見。今天算失敗，但至少我察覺到了。', 10)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000202', 'd0000000-0002-4000-8000-000000000002', 'd0000000-1001-4000-8000-000000000002', 2, 'realtime', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"},{"role":"user","content":"大概是……我覺得自己不重要吧。"},{"role":"assistant","content":"「我覺得自己不重要」——這句話你有直接跟對方說過嗎？"},{"role":"user","content":"沒有，我講不出口。"},{"role":"assistant","content":"講不出口的時候，通常會冒出什麼念頭擋住你？"},{"role":"user","content":"會覺得講了很丟臉，好像在討拍。"},{"role":"assistant","content":"如果今天換成對方這樣對你說，你會覺得他在討拍嗎？"},{"role":"user","content":"不會啊，我應該會想抱抱他。"},{"role":"assistant","content":"那你剛剛給自己的標準，跟給對方的標準，好像不太一樣。"}]'::jsonb,
        '第 2 天的練習', NOW() - INTERVAL '1 days', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_memories (id, journey_id, day_number, emotion_note, task_result, partner_obs, key_insight, follow_up)
VALUES ('d0000000-0005-4000-8000-000000000202', 'd0000000-0002-4000-8000-000000000002', 2, '情緒起伏不大', '只做了一半', '對方今天話比較多', '先處理心情再處理事情', '找機會說出今天的感受')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000203', 'd0000000-0002-4000-8000-000000000002', 3, (CURRENT_DATE - INTERVAL '0 days'), FALSE, 'failed', 6, '沒什麼特別的一天。', 0)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000203', 'd0000000-0002-4000-8000-000000000002', 'd0000000-1001-4000-8000-000000000002', 3, 'evening', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"},{"role":"user","content":"大概是……我覺得自己不重要吧。"},{"role":"assistant","content":"「我覺得自己不重要」——這句話你有直接跟對方說過嗎？"},{"role":"user","content":"沒有，我講不出口。"},{"role":"assistant","content":"講不出口的時候，通常會冒出什麼念頭擋住你？"}]'::jsonb,
        '第 3 天的練習', NOW() - INTERVAL '0 days', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.blindspot_records (id, journey_id, day_number, blindspot_code, context_type, trigger_snippet, ai_feedback)
VALUES ('d0000000-0006-4000-8000-000000000203', 'd0000000-0002-4000-8000-000000000002', 3, 'B4', 'morning', '我早就說過了', '停止對話會讓問題留在原地，也讓對方猜不到你的需要。')
ON CONFLICT (id) DO NOTHING;

-- 測試用戶・進行中（day 12/21）：最典型的使用中狀態。資料量最完整，日常開發主要看這筆
INSERT INTO happy.journeys (id, user_id, mbti_self, mbti_partner, mbti_confidence,
       partner_nickname, relationship_type, goal_statement, initial_problem,
       start_date, current_day, is_active, total_points)
VALUES ('d0000000-0002-4000-8000-000000000003', 'd0000000-1001-4000-8000-000000000003', 'ENFJ', 'INTP', 'high',
        '測試對象B', 'couple',
        '希望吵架的時候可以先停下來，不要馬上回嘴。',
        '對方一沉默我就開始焦慮，然後講出更難聽的話。',
        (CURRENT_DATE - INTERVAL '12 days'), 12,
        TRUE, 120)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000301', 'd0000000-0002-4000-8000-000000000003', 1, (CURRENT_DATE - INTERVAL '11 days'), TRUE, 'success', 1, '還是忍不住先講了道理，等到講完才發現對方只是想被聽見。今天算失敗，但至少我察覺到了。', 10)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000301', 'd0000000-0002-4000-8000-000000000003', 'd0000000-1001-4000-8000-000000000003', 1, 'morning', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"},{"role":"user","content":"大概是……我覺得自己不重要吧。"},{"role":"assistant","content":"「我覺得自己不重要」——這句話你有直接跟對方說過嗎？"},{"role":"user","content":"沒有，我講不出口。"},{"role":"assistant","content":"講不出口的時候，通常會冒出什麼念頭擋住你？"},{"role":"user","content":"會覺得講了很丟臉，好像在討拍。"},{"role":"assistant","content":"如果今天換成對方這樣對你說，你會覺得他在討拍嗎？"}]'::jsonb,
        '第 1 天的練習', NOW() - INTERVAL '11 days', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000302', 'd0000000-0002-4000-8000-000000000003', 2, (CURRENT_DATE - INTERVAL '10 days'), TRUE, 'success', 9, '沒什麼特別的一天。', 10)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000302', 'd0000000-0002-4000-8000-000000000003', 'd0000000-1001-4000-8000-000000000003', 2, 'realtime', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"}]'::jsonb,
        '第 2 天的練習', NOW() - INTERVAL '10 days', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_memories (id, journey_id, day_number, emotion_note, task_result, partner_obs, key_insight, follow_up)
VALUES ('d0000000-0005-4000-8000-000000000302', 'd0000000-0002-4000-8000-000000000003', 2, '早上很急，晚上緩下來了', '順利完成', '沒有特別觀察到什麼', '先處理心情再處理事情', '找機會說出今天的感受')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000303', 'd0000000-0002-4000-8000-000000000003', 3, (CURRENT_DATE - INTERVAL '9 days'), TRUE, 'success', 5, '今天試著在對話中停三秒再回應，感覺沒有想像中困難。', 10)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000303', 'd0000000-0002-4000-8000-000000000003', 'd0000000-1001-4000-8000-000000000003', 3, 'evening', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"},{"role":"user","content":"大概是……我覺得自己不重要吧。"},{"role":"assistant","content":"「我覺得自己不重要」——這句話你有直接跟對方說過嗎？"},{"role":"user","content":"沒有，我講不出口。"},{"role":"assistant","content":"講不出口的時候，通常會冒出什麼念頭擋住你？"}]'::jsonb,
        '第 3 天的練習', NOW() - INTERVAL '9 days', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.blindspot_records (id, journey_id, day_number, blindspot_code, context_type, trigger_snippet, ai_feedback)
VALUES ('d0000000-0006-4000-8000-000000000303', 'd0000000-0002-4000-8000-000000000003', 3, 'B4', 'morning', '算了，不講了', '強調自己是對的，會讓對方把注意力放在防禦而不是理解。')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000304', 'd0000000-0002-4000-8000-000000000003', 4, (CURRENT_DATE - INTERVAL '8 days'), FALSE, 'failed', 5, '早上出門前有好好說再見，是這幾週第一次。', 0)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000304', 'd0000000-0002-4000-8000-000000000003', 'd0000000-1001-4000-8000-000000000003', 4, 'onboarding', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"}]'::jsonb,
        '第 4 天的練習', NOW() - INTERVAL '8 days', NOW() - INTERVAL '7 days')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_memories (id, journey_id, day_number, emotion_note, task_result, partner_obs, key_insight, follow_up)
VALUES ('d0000000-0005-4000-8000-000000000304', 'd0000000-0002-4000-8000-000000000003', 4, '有點煩躁但有察覺', '順利完成', '對方看起來有心事', '沉默不一定是生氣', '明天試著只聽不回')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000305', 'd0000000-0002-4000-8000-000000000003', 5, (CURRENT_DATE - INTERVAL '7 days'), FALSE, 'failed', 9, '沒什麼特別的一天。', 0)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000305', 'd0000000-0002-4000-8000-000000000003', 'd0000000-1001-4000-8000-000000000003', 5, 'morning', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"}]'::jsonb,
        '第 5 天的練習', NOW() - INTERVAL '7 days', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000306', 'd0000000-0002-4000-8000-000000000003', 6, (CURRENT_DATE - INTERVAL '6 days'), FALSE, 'failed', 4, '今天試著在對話中停三秒再回應，感覺沒有想像中困難。', 0)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000306', 'd0000000-0002-4000-8000-000000000003', 'd0000000-1001-4000-8000-000000000003', 6, 'realtime', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"},{"role":"user","content":"大概是……我覺得自己不重要吧。"},{"role":"assistant","content":"「我覺得自己不重要」——這句話你有直接跟對方說過嗎？"},{"role":"user","content":"沒有，我講不出口。"},{"role":"assistant","content":"講不出口的時候，通常會冒出什麼念頭擋住你？"},{"role":"user","content":"會覺得講了很丟臉，好像在討拍。"},{"role":"assistant","content":"如果今天換成對方這樣對你說，你會覺得他在討拍嗎？"}]'::jsonb,
        '第 6 天的練習', NOW() - INTERVAL '6 days', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_memories (id, journey_id, day_number, emotion_note, task_result, partner_obs, key_insight, follow_up)
VALUES ('d0000000-0005-4000-8000-000000000306', 'd0000000-0002-4000-8000-000000000003', 6, '比昨天平靜一些', '只做了一半', '沒有特別觀察到什麼', '先處理心情再處理事情', '暫時不用做什麼')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.blindspot_records (id, journey_id, day_number, blindspot_code, context_type, trigger_snippet, ai_feedback)
VALUES ('d0000000-0006-4000-8000-000000000306', 'd0000000-0002-4000-8000-000000000003', 6, 'B2', 'morning', '我早就說過了', '停止對話會讓問題留在原地，也讓對方猜不到你的需要。')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000307', 'd0000000-0002-4000-8000-000000000003', 7, (CURRENT_DATE - INTERVAL '5 days'), TRUE, 'partial', 3, '還是忍不住先講了道理，等到講完才發現對方只是想被聽見。今天算失敗，但至少我察覺到了。', 10)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000307', 'd0000000-0002-4000-8000-000000000003', 'd0000000-1001-4000-8000-000000000003', 7, 'evening', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"},{"role":"user","content":"大概是……我覺得自己不重要吧。"},{"role":"assistant","content":"「我覺得自己不重要」——這句話你有直接跟對方說過嗎？"}]'::jsonb,
        '第 7 天的練習', NOW() - INTERVAL '5 days', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000308', 'd0000000-0002-4000-8000-000000000003', 8, (CURRENT_DATE - INTERVAL '4 days'), FALSE, 'failed', 4, '沒什麼特別的一天。', 0)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000308', 'd0000000-0002-4000-8000-000000000003', 'd0000000-1001-4000-8000-000000000003', 8, 'onboarding', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"},{"role":"user","content":"大概是……我覺得自己不重要吧。"},{"role":"assistant","content":"「我覺得自己不重要」——這句話你有直接跟對方說過嗎？"},{"role":"user","content":"沒有，我講不出口。"},{"role":"assistant","content":"講不出口的時候，通常會冒出什麼念頭擋住你？"},{"role":"user","content":"會覺得講了很丟臉，好像在討拍。"},{"role":"assistant","content":"如果今天換成對方這樣對你說，你會覺得他在討拍嗎？"}]'::jsonb,
        '第 8 天的練習', NOW() - INTERVAL '4 days', NOW() - INTERVAL '3 days')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_memories (id, journey_id, day_number, emotion_note, task_result, partner_obs, key_insight, follow_up)
VALUES ('d0000000-0005-4000-8000-000000000308', 'd0000000-0002-4000-8000-000000000003', 8, '早上很急，晚上緩下來了', '只做了一半', '沒有特別觀察到什麼', '我太快想解決問題了', '提醒自己停三秒')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000309', 'd0000000-0002-4000-8000-000000000003', 9, (CURRENT_DATE - INTERVAL '3 days'), TRUE, 'success', 4, '沒什麼特別的一天。', 10)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000309', 'd0000000-0002-4000-8000-000000000003', 'd0000000-1001-4000-8000-000000000003', 9, 'morning', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"},{"role":"user","content":"大概是……我覺得自己不重要吧。"},{"role":"assistant","content":"「我覺得自己不重要」——這句話你有直接跟對方說過嗎？"},{"role":"user","content":"沒有，我講不出口。"},{"role":"assistant","content":"講不出口的時候，通常會冒出什麼念頭擋住你？"},{"role":"user","content":"會覺得講了很丟臉，好像在討拍。"},{"role":"assistant","content":"如果今天換成對方這樣對你說，你會覺得他在討拍嗎？"}]'::jsonb,
        '第 9 天的練習', NOW() - INTERVAL '3 days', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.blindspot_records (id, journey_id, day_number, blindspot_code, context_type, trigger_snippet, ai_feedback)
VALUES ('d0000000-0006-4000-8000-000000000309', 'd0000000-0002-4000-8000-000000000003', 9, 'B5', 'morning', '我早就說過了', '停止對話會讓問題留在原地，也讓對方猜不到你的需要。')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000310', 'd0000000-0002-4000-8000-000000000003', 10, (CURRENT_DATE - INTERVAL '2 days'), TRUE, 'success', 3, '早上出門前有好好說再見，是這幾週第一次。', 10)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000310', 'd0000000-0002-4000-8000-000000000003', 'd0000000-1001-4000-8000-000000000003', 10, 'realtime', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"},{"role":"user","content":"大概是……我覺得自己不重要吧。"},{"role":"assistant","content":"「我覺得自己不重要」——這句話你有直接跟對方說過嗎？"},{"role":"user","content":"沒有，我講不出口。"},{"role":"assistant","content":"講不出口的時候，通常會冒出什麼念頭擋住你？"},{"role":"user","content":"會覺得講了很丟臉，好像在討拍。"},{"role":"assistant","content":"如果今天換成對方這樣對你說，你會覺得他在討拍嗎？"}]'::jsonb,
        '第 10 天的練習', NOW() - INTERVAL '2 days', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_memories (id, journey_id, day_number, emotion_note, task_result, partner_obs, key_insight, follow_up)
VALUES ('d0000000-0005-4000-8000-000000000310', 'd0000000-0002-4000-8000-000000000003', 10, '有點煩躁但有察覺', '順利完成', '沒有特別觀察到什麼', '我需要的是被聽見', '提醒自己停三秒')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000311', 'd0000000-0002-4000-8000-000000000003', 11, (CURRENT_DATE - INTERVAL '1 days'), TRUE, 'success', 1, '今天試著在對話中停三秒再回應，感覺沒有想像中困難。', 10)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000311', 'd0000000-0002-4000-8000-000000000003', 'd0000000-1001-4000-8000-000000000003', 11, 'evening', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"},{"role":"user","content":"大概是……我覺得自己不重要吧。"},{"role":"assistant","content":"「我覺得自己不重要」——這句話你有直接跟對方說過嗎？"},{"role":"user","content":"沒有，我講不出口。"},{"role":"assistant","content":"講不出口的時候，通常會冒出什麼念頭擋住你？"}]'::jsonb,
        '第 11 天的練習', NOW() - INTERVAL '1 days', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000312', 'd0000000-0002-4000-8000-000000000003', 12, (CURRENT_DATE - INTERVAL '0 days'), TRUE, 'success', 6, '沒什麼特別的一天。', 10)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000312', 'd0000000-0002-4000-8000-000000000003', 'd0000000-1001-4000-8000-000000000003', 12, 'onboarding', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"}]'::jsonb,
        '第 12 天的練習', NOW() - INTERVAL '0 days', NOW() - INTERVAL '0 days')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_memories (id, journey_id, day_number, emotion_note, task_result, partner_obs, key_insight, follow_up)
VALUES ('d0000000-0005-4000-8000-000000000312', 'd0000000-0002-4000-8000-000000000003', 12, '有點煩躁但有察覺', '忘記了，晚上補做', '對方看起來有心事', '先處理心情再處理事情', '提醒自己停三秒')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.blindspot_records (id, journey_id, day_number, blindspot_code, context_type, trigger_snippet, ai_feedback)
VALUES ('d0000000-0006-4000-8000-000000000312', 'd0000000-0002-4000-8000-000000000003', 12, 'B3', 'morning', '你每次都這樣', '這句話把「這一次」變成了「每一次」，對方會覺得被否定整個人。')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.achievements (id, journey_id, badge_id, badge_name, points)
VALUES ('d0000000-0007-4000-8000-000000000301', 'd0000000-0002-4000-8000-000000000003', 'week_1', '第 1 週完成', 50)
ON CONFLICT (id) DO NOTHING;

-- 測試用戶・已完課（day 21/21）：21 天全完成。測結業畫面、滿版成就、進度條 100% 不會溢位
INSERT INTO happy.journeys (id, user_id, mbti_self, mbti_partner, mbti_confidence,
       partner_nickname, relationship_type, goal_statement, initial_problem,
       start_date, current_day, is_active, total_points)
VALUES ('d0000000-0002-4000-8000-000000000004', 'd0000000-1001-4000-8000-000000000004', 'ISTJ', 'ENFP', 'high',
        '範例夥伴', 'couple',
        '希望每天至少有一次好好聽對方說完話。',
        '我講的話好像都傳不到對方那邊，久了就懶得講了。',
        (CURRENT_DATE - INTERVAL '21 days'), 21,
        FALSE, 210)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000401', 'd0000000-0002-4000-8000-000000000004', 1, (CURRENT_DATE - INTERVAL '20 days'), TRUE, 'success', 8, '照著今天的任務做了，但心裡其實有點抗拒，覺得這樣很刻意。不過做完之後氣氛真的有比較鬆一點，可能刻意也沒關係吧。明天再試一次看看。', 10)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000401', 'd0000000-0002-4000-8000-000000000004', 'd0000000-1001-4000-8000-000000000004', 1, 'morning', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"},{"role":"user","content":"大概是……我覺得自己不重要吧。"},{"role":"assistant","content":"「我覺得自己不重要」——這句話你有直接跟對方說過嗎？"}]'::jsonb,
        '第 1 天的練習', NOW() - INTERVAL '20 days', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000402', 'd0000000-0002-4000-8000-000000000004', 2, (CURRENT_DATE - INTERVAL '19 days'), TRUE, 'success', 6, '今天試著在對話中停三秒再回應，感覺沒有想像中困難。', 10)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000402', 'd0000000-0002-4000-8000-000000000004', 'd0000000-1001-4000-8000-000000000004', 2, 'realtime', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"}]'::jsonb,
        '第 2 天的練習', NOW() - INTERVAL '19 days', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_memories (id, journey_id, day_number, emotion_note, task_result, partner_obs, key_insight, follow_up)
VALUES ('d0000000-0005-4000-8000-000000000402', 'd0000000-0002-4000-8000-000000000004', 2, '有點煩躁但有察覺', '只做了一半', '沒有特別觀察到什麼', '我太快想解決問題了', '提醒自己停三秒')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000403', 'd0000000-0002-4000-8000-000000000004', 3, (CURRENT_DATE - INTERVAL '18 days'), FALSE, 'failed', 5, '照著今天的任務做了，但心裡其實有點抗拒，覺得這樣很刻意。不過做完之後氣氛真的有比較鬆一點，可能刻意也沒關係吧。明天再試一次看看。', 0)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000403', 'd0000000-0002-4000-8000-000000000004', 'd0000000-1001-4000-8000-000000000004', 3, 'evening', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"}]'::jsonb,
        '第 3 天的練習', NOW() - INTERVAL '18 days', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.blindspot_records (id, journey_id, day_number, blindspot_code, context_type, trigger_snippet, ai_feedback)
VALUES ('d0000000-0006-4000-8000-000000000403', 'd0000000-0002-4000-8000-000000000004', 3, 'B4', 'morning', '你每次都這樣', '這句話把「這一次」變成了「每一次」，對方會覺得被否定整個人。')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000404', 'd0000000-0002-4000-8000-000000000004', 4, (CURRENT_DATE - INTERVAL '17 days'), TRUE, 'success', 1, '還是忍不住先講了道理，等到講完才發現對方只是想被聽見。今天算失敗，但至少我察覺到了。', 10)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000404', 'd0000000-0002-4000-8000-000000000004', 'd0000000-1001-4000-8000-000000000004', 4, 'onboarding', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"},{"role":"user","content":"大概是……我覺得自己不重要吧。"},{"role":"assistant","content":"「我覺得自己不重要」——這句話你有直接跟對方說過嗎？"},{"role":"user","content":"沒有，我講不出口。"},{"role":"assistant","content":"講不出口的時候，通常會冒出什麼念頭擋住你？"},{"role":"user","content":"會覺得講了很丟臉，好像在討拍。"},{"role":"assistant","content":"如果今天換成對方這樣對你說，你會覺得他在討拍嗎？"}]'::jsonb,
        '第 4 天的練習', NOW() - INTERVAL '17 days', NOW() - INTERVAL '16 days')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_memories (id, journey_id, day_number, emotion_note, task_result, partner_obs, key_insight, follow_up)
VALUES ('d0000000-0005-4000-8000-000000000404', 'd0000000-0002-4000-8000-000000000004', 4, '情緒起伏不大', '只做了一半', '對方今天話比較多', '我需要的是被聽見', '明天試著只聽不回')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000405', 'd0000000-0002-4000-8000-000000000004', 5, (CURRENT_DATE - INTERVAL '16 days'), TRUE, 'success', 1, '照著今天的任務做了，但心裡其實有點抗拒，覺得這樣很刻意。不過做完之後氣氛真的有比較鬆一點，可能刻意也沒關係吧。明天再試一次看看。', 10)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000405', 'd0000000-0002-4000-8000-000000000004', 'd0000000-1001-4000-8000-000000000004', 5, 'morning', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"},{"role":"user","content":"大概是……我覺得自己不重要吧。"},{"role":"assistant","content":"「我覺得自己不重要」——這句話你有直接跟對方說過嗎？"},{"role":"user","content":"沒有，我講不出口。"},{"role":"assistant","content":"講不出口的時候，通常會冒出什麼念頭擋住你？"},{"role":"user","content":"會覺得講了很丟臉，好像在討拍。"},{"role":"assistant","content":"如果今天換成對方這樣對你說，你會覺得他在討拍嗎？"}]'::jsonb,
        '第 5 天的練習', NOW() - INTERVAL '16 days', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000406', 'd0000000-0002-4000-8000-000000000004', 6, (CURRENT_DATE - INTERVAL '15 days'), TRUE, 'partial', 5, '照著今天的任務做了，但心裡其實有點抗拒，覺得這樣很刻意。不過做完之後氣氛真的有比較鬆一點，可能刻意也沒關係吧。明天再試一次看看。', 10)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000406', 'd0000000-0002-4000-8000-000000000004', 'd0000000-1001-4000-8000-000000000004', 6, 'realtime', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"},{"role":"user","content":"大概是……我覺得自己不重要吧。"},{"role":"assistant","content":"「我覺得自己不重要」——這句話你有直接跟對方說過嗎？"},{"role":"user","content":"沒有，我講不出口。"},{"role":"assistant","content":"講不出口的時候，通常會冒出什麼念頭擋住你？"},{"role":"user","content":"會覺得講了很丟臉，好像在討拍。"},{"role":"assistant","content":"如果今天換成對方這樣對你說，你會覺得他在討拍嗎？"}]'::jsonb,
        '第 6 天的練習', NOW() - INTERVAL '15 days', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_memories (id, journey_id, day_number, emotion_note, task_result, partner_obs, key_insight, follow_up)
VALUES ('d0000000-0005-4000-8000-000000000406', 'd0000000-0002-4000-8000-000000000004', 6, '早上很急，晚上緩下來了', '完成，但做得有點勉強', '對方主動問了我一句', '先處理心情再處理事情', '找機會說出今天的感受')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.blindspot_records (id, journey_id, day_number, blindspot_code, context_type, trigger_snippet, ai_feedback)
VALUES ('d0000000-0006-4000-8000-000000000406', 'd0000000-0002-4000-8000-000000000004', 6, 'B2', 'morning', '隨便你', '這是放棄溝通的訊號，但對方可能解讀成不在乎。')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000407', 'd0000000-0002-4000-8000-000000000004', 7, (CURRENT_DATE - INTERVAL '14 days'), FALSE, 'failed', 10, '還是忍不住先講了道理，等到講完才發現對方只是想被聽見。今天算失敗，但至少我察覺到了。', 0)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000407', 'd0000000-0002-4000-8000-000000000004', 'd0000000-1001-4000-8000-000000000004', 7, 'evening', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"},{"role":"user","content":"大概是……我覺得自己不重要吧。"},{"role":"assistant","content":"「我覺得自己不重要」——這句話你有直接跟對方說過嗎？"},{"role":"user","content":"沒有，我講不出口。"},{"role":"assistant","content":"講不出口的時候，通常會冒出什麼念頭擋住你？"},{"role":"user","content":"會覺得講了很丟臉，好像在討拍。"},{"role":"assistant","content":"如果今天換成對方這樣對你說，你會覺得他在討拍嗎？"},{"role":"user","content":"不會啊，我應該會想抱抱他。"},{"role":"assistant","content":"那你剛剛給自己的標準，跟給對方的標準，好像不太一樣。"}]'::jsonb,
        '第 7 天的練習', NOW() - INTERVAL '14 days', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000408', 'd0000000-0002-4000-8000-000000000004', 8, (CURRENT_DATE - INTERVAL '13 days'), TRUE, 'success', 4, '今天試著在對話中停三秒再回應，感覺沒有想像中困難。', 10)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000408', 'd0000000-0002-4000-8000-000000000004', 'd0000000-1001-4000-8000-000000000004', 8, 'onboarding', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"},{"role":"user","content":"大概是……我覺得自己不重要吧。"},{"role":"assistant","content":"「我覺得自己不重要」——這句話你有直接跟對方說過嗎？"},{"role":"user","content":"沒有，我講不出口。"},{"role":"assistant","content":"講不出口的時候，通常會冒出什麼念頭擋住你？"},{"role":"user","content":"會覺得講了很丟臉，好像在討拍。"},{"role":"assistant","content":"如果今天換成對方這樣對你說，你會覺得他在討拍嗎？"}]'::jsonb,
        '第 8 天的練習', NOW() - INTERVAL '13 days', NOW() - INTERVAL '12 days')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_memories (id, journey_id, day_number, emotion_note, task_result, partner_obs, key_insight, follow_up)
VALUES ('d0000000-0005-4000-8000-000000000408', 'd0000000-0002-4000-8000-000000000004', 8, '情緒起伏不大', '順利完成', '對方今天話比較多', '沉默不一定是生氣', '提醒自己停三秒')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000409', 'd0000000-0002-4000-8000-000000000004', 9, (CURRENT_DATE - INTERVAL '12 days'), FALSE, 'failed', 2, '照著今天的任務做了，但心裡其實有點抗拒，覺得這樣很刻意。不過做完之後氣氛真的有比較鬆一點，可能刻意也沒關係吧。明天再試一次看看。', 0)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000409', 'd0000000-0002-4000-8000-000000000004', 'd0000000-1001-4000-8000-000000000004', 9, 'morning', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"},{"role":"user","content":"大概是……我覺得自己不重要吧。"},{"role":"assistant","content":"「我覺得自己不重要」——這句話你有直接跟對方說過嗎？"},{"role":"user","content":"沒有，我講不出口。"},{"role":"assistant","content":"講不出口的時候，通常會冒出什麼念頭擋住你？"},{"role":"user","content":"會覺得講了很丟臉，好像在討拍。"},{"role":"assistant","content":"如果今天換成對方這樣對你說，你會覺得他在討拍嗎？"}]'::jsonb,
        '第 9 天的練習', NOW() - INTERVAL '12 days', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.blindspot_records (id, journey_id, day_number, blindspot_code, context_type, trigger_snippet, ai_feedback)
VALUES ('d0000000-0006-4000-8000-000000000409', 'd0000000-0002-4000-8000-000000000004', 9, 'B5', 'morning', '我早就說過了', '這是放棄溝通的訊號，但對方可能解讀成不在乎。')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000410', 'd0000000-0002-4000-8000-000000000004', 10, (CURRENT_DATE - INTERVAL '11 days'), FALSE, 'failed', 7, '照著今天的任務做了，但心裡其實有點抗拒，覺得這樣很刻意。不過做完之後氣氛真的有比較鬆一點，可能刻意也沒關係吧。明天再試一次看看。', 0)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000410', 'd0000000-0002-4000-8000-000000000004', 'd0000000-1001-4000-8000-000000000004', 10, 'realtime', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"},{"role":"user","content":"大概是……我覺得自己不重要吧。"},{"role":"assistant","content":"「我覺得自己不重要」——這句話你有直接跟對方說過嗎？"}]'::jsonb,
        '第 10 天的練習', NOW() - INTERVAL '11 days', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_memories (id, journey_id, day_number, emotion_note, task_result, partner_obs, key_insight, follow_up)
VALUES ('d0000000-0005-4000-8000-000000000410', 'd0000000-0002-4000-8000-000000000004', 10, '早上很急，晚上緩下來了', '忘記了，晚上補做', '對方今天話比較多', '先處理心情再處理事情', '提醒自己停三秒')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000411', 'd0000000-0002-4000-8000-000000000004', 11, (CURRENT_DATE - INTERVAL '10 days'), TRUE, 'success', 4, '沒什麼特別的一天。', 10)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000411', 'd0000000-0002-4000-8000-000000000004', 'd0000000-1001-4000-8000-000000000004', 11, 'evening', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"},{"role":"user","content":"大概是……我覺得自己不重要吧。"},{"role":"assistant","content":"「我覺得自己不重要」——這句話你有直接跟對方說過嗎？"},{"role":"user","content":"沒有，我講不出口。"},{"role":"assistant","content":"講不出口的時候，通常會冒出什麼念頭擋住你？"},{"role":"user","content":"會覺得講了很丟臉，好像在討拍。"},{"role":"assistant","content":"如果今天換成對方這樣對你說，你會覺得他在討拍嗎？"}]'::jsonb,
        '第 11 天的練習', NOW() - INTERVAL '10 days', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000412', 'd0000000-0002-4000-8000-000000000004', 12, (CURRENT_DATE - INTERVAL '9 days'), FALSE, 'failed', 7, '還是忍不住先講了道理，等到講完才發現對方只是想被聽見。今天算失敗，但至少我察覺到了。', 0)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000412', 'd0000000-0002-4000-8000-000000000004', 'd0000000-1001-4000-8000-000000000004', 12, 'onboarding', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"}]'::jsonb,
        '第 12 天的練習', NOW() - INTERVAL '9 days', NOW() - INTERVAL '8 days')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_memories (id, journey_id, day_number, emotion_note, task_result, partner_obs, key_insight, follow_up)
VALUES ('d0000000-0005-4000-8000-000000000412', 'd0000000-0002-4000-8000-000000000004', 12, '情緒起伏不大', '順利完成', '沒有特別觀察到什麼', '沉默不一定是生氣', '提醒自己停三秒')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.blindspot_records (id, journey_id, day_number, blindspot_code, context_type, trigger_snippet, ai_feedback)
VALUES ('d0000000-0006-4000-8000-000000000412', 'd0000000-0002-4000-8000-000000000004', 12, 'B3', 'morning', '隨便你', '這是放棄溝通的訊號，但對方可能解讀成不在乎。')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000413', 'd0000000-0002-4000-8000-000000000004', 13, (CURRENT_DATE - INTERVAL '8 days'), FALSE, 'failed', 7, '早上出門前有好好說再見，是這幾週第一次。', 0)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000413', 'd0000000-0002-4000-8000-000000000004', 'd0000000-1001-4000-8000-000000000004', 13, 'morning', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"},{"role":"user","content":"大概是……我覺得自己不重要吧。"},{"role":"assistant","content":"「我覺得自己不重要」——這句話你有直接跟對方說過嗎？"}]'::jsonb,
        '第 13 天的練習', NOW() - INTERVAL '8 days', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000414', 'd0000000-0002-4000-8000-000000000004', 14, (CURRENT_DATE - INTERVAL '7 days'), TRUE, 'success', 4, '照著今天的任務做了，但心裡其實有點抗拒，覺得這樣很刻意。不過做完之後氣氛真的有比較鬆一點，可能刻意也沒關係吧。明天再試一次看看。', 10)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000414', 'd0000000-0002-4000-8000-000000000004', 'd0000000-1001-4000-8000-000000000004', 14, 'realtime', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"},{"role":"user","content":"大概是……我覺得自己不重要吧。"},{"role":"assistant","content":"「我覺得自己不重要」——這句話你有直接跟對方說過嗎？"},{"role":"user","content":"沒有，我講不出口。"},{"role":"assistant","content":"講不出口的時候，通常會冒出什麼念頭擋住你？"}]'::jsonb,
        '第 14 天的練習', NOW() - INTERVAL '7 days', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_memories (id, journey_id, day_number, emotion_note, task_result, partner_obs, key_insight, follow_up)
VALUES ('d0000000-0005-4000-8000-000000000414', 'd0000000-0002-4000-8000-000000000004', 14, '早上很急，晚上緩下來了', '只做了一半', '對方今天話比較多', '沉默不一定是生氣', '明天試著只聽不回')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000415', 'd0000000-0002-4000-8000-000000000004', 15, (CURRENT_DATE - INTERVAL '6 days'), FALSE, 'failed', 6, '沒什麼特別的一天。', 0)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000415', 'd0000000-0002-4000-8000-000000000004', 'd0000000-1001-4000-8000-000000000004', 15, 'evening', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"},{"role":"user","content":"大概是……我覺得自己不重要吧。"},{"role":"assistant","content":"「我覺得自己不重要」——這句話你有直接跟對方說過嗎？"},{"role":"user","content":"沒有，我講不出口。"},{"role":"assistant","content":"講不出口的時候，通常會冒出什麼念頭擋住你？"},{"role":"user","content":"會覺得講了很丟臉，好像在討拍。"},{"role":"assistant","content":"如果今天換成對方這樣對你說，你會覺得他在討拍嗎？"}]'::jsonb,
        '第 15 天的練習', NOW() - INTERVAL '6 days', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.blindspot_records (id, journey_id, day_number, blindspot_code, context_type, trigger_snippet, ai_feedback)
VALUES ('d0000000-0006-4000-8000-000000000415', 'd0000000-0002-4000-8000-000000000004', 15, 'B1', 'morning', '隨便你', '強調自己是對的，會讓對方把注意力放在防禦而不是理解。')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000416', 'd0000000-0002-4000-8000-000000000004', 16, (CURRENT_DATE - INTERVAL '5 days'), TRUE, 'success', 4, '今天試著在對話中停三秒再回應，感覺沒有想像中困難。', 10)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000416', 'd0000000-0002-4000-8000-000000000004', 'd0000000-1001-4000-8000-000000000004', 16, 'onboarding', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"},{"role":"user","content":"大概是……我覺得自己不重要吧。"},{"role":"assistant","content":"「我覺得自己不重要」——這句話你有直接跟對方說過嗎？"},{"role":"user","content":"沒有，我講不出口。"},{"role":"assistant","content":"講不出口的時候，通常會冒出什麼念頭擋住你？"}]'::jsonb,
        '第 16 天的練習', NOW() - INTERVAL '5 days', NOW() - INTERVAL '4 days')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_memories (id, journey_id, day_number, emotion_note, task_result, partner_obs, key_insight, follow_up)
VALUES ('d0000000-0005-4000-8000-000000000416', 'd0000000-0002-4000-8000-000000000004', 16, '比昨天平靜一些', '忘記了，晚上補做', '對方主動問了我一句', '我太快想解決問題了', '提醒自己停三秒')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000417', 'd0000000-0002-4000-8000-000000000004', 17, (CURRENT_DATE - INTERVAL '4 days'), TRUE, 'success', 6, '照著今天的任務做了，但心裡其實有點抗拒，覺得這樣很刻意。不過做完之後氣氛真的有比較鬆一點，可能刻意也沒關係吧。明天再試一次看看。', 10)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000417', 'd0000000-0002-4000-8000-000000000004', 'd0000000-1001-4000-8000-000000000004', 17, 'morning', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"},{"role":"user","content":"大概是……我覺得自己不重要吧。"},{"role":"assistant","content":"「我覺得自己不重要」——這句話你有直接跟對方說過嗎？"},{"role":"user","content":"沒有，我講不出口。"},{"role":"assistant","content":"講不出口的時候，通常會冒出什麼念頭擋住你？"},{"role":"user","content":"會覺得講了很丟臉，好像在討拍。"},{"role":"assistant","content":"如果今天換成對方這樣對你說，你會覺得他在討拍嗎？"},{"role":"user","content":"不會啊，我應該會想抱抱他。"},{"role":"assistant","content":"那你剛剛給自己的標準，跟給對方的標準，好像不太一樣。"}]'::jsonb,
        '第 17 天的練習', NOW() - INTERVAL '4 days', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000418', 'd0000000-0002-4000-8000-000000000004', 18, (CURRENT_DATE - INTERVAL '3 days'), TRUE, 'success', 6, '還是忍不住先講了道理，等到講完才發現對方只是想被聽見。今天算失敗，但至少我察覺到了。', 10)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000418', 'd0000000-0002-4000-8000-000000000004', 'd0000000-1001-4000-8000-000000000004', 18, 'realtime', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"},{"role":"user","content":"大概是……我覺得自己不重要吧。"},{"role":"assistant","content":"「我覺得自己不重要」——這句話你有直接跟對方說過嗎？"},{"role":"user","content":"沒有，我講不出口。"},{"role":"assistant","content":"講不出口的時候，通常會冒出什麼念頭擋住你？"},{"role":"user","content":"會覺得講了很丟臉，好像在討拍。"},{"role":"assistant","content":"如果今天換成對方這樣對你說，你會覺得他在討拍嗎？"}]'::jsonb,
        '第 18 天的練習', NOW() - INTERVAL '3 days', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_memories (id, journey_id, day_number, emotion_note, task_result, partner_obs, key_insight, follow_up)
VALUES ('d0000000-0005-4000-8000-000000000418', 'd0000000-0002-4000-8000-000000000004', 18, '有點煩躁但有察覺', '只做了一半', '對方看起來有心事', '先處理心情再處理事情', '提醒自己停三秒')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.blindspot_records (id, journey_id, day_number, blindspot_code, context_type, trigger_snippet, ai_feedback)
VALUES ('d0000000-0006-4000-8000-000000000418', 'd0000000-0002-4000-8000-000000000004', 18, 'B4', 'morning', '你每次都這樣', '強調自己是對的，會讓對方把注意力放在防禦而不是理解。')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000419', 'd0000000-0002-4000-8000-000000000004', 19, (CURRENT_DATE - INTERVAL '2 days'), FALSE, 'failed', 6, '早上出門前有好好說再見，是這幾週第一次。', 0)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000419', 'd0000000-0002-4000-8000-000000000004', 'd0000000-1001-4000-8000-000000000004', 19, 'evening', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"},{"role":"user","content":"大概是……我覺得自己不重要吧。"},{"role":"assistant","content":"「我覺得自己不重要」——這句話你有直接跟對方說過嗎？"}]'::jsonb,
        '第 19 天的練習', NOW() - INTERVAL '2 days', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000420', 'd0000000-0002-4000-8000-000000000004', 20, (CURRENT_DATE - INTERVAL '1 days'), FALSE, 'failed', 3, '沒什麼特別的一天。', 0)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000420', 'd0000000-0002-4000-8000-000000000004', 'd0000000-1001-4000-8000-000000000004', 20, 'onboarding', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"},{"role":"user","content":"大概是……我覺得自己不重要吧。"},{"role":"assistant","content":"「我覺得自己不重要」——這句話你有直接跟對方說過嗎？"}]'::jsonb,
        '第 20 天的練習', NOW() - INTERVAL '1 days', NOW() - INTERVAL '0 days')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_memories (id, journey_id, day_number, emotion_note, task_result, partner_obs, key_insight, follow_up)
VALUES ('d0000000-0005-4000-8000-000000000420', 'd0000000-0002-4000-8000-000000000004', 20, '情緒起伏不大', '忘記了，晚上補做', '對方主動問了我一句', '沉默不一定是生氣', '暫時不用做什麼')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000421', 'd0000000-0002-4000-8000-000000000004', 21, (CURRENT_DATE - INTERVAL '0 days'), TRUE, 'success', 7, '照著今天的任務做了，但心裡其實有點抗拒，覺得這樣很刻意。不過做完之後氣氛真的有比較鬆一點，可能刻意也沒關係吧。明天再試一次看看。', 10)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000421', 'd0000000-0002-4000-8000-000000000004', 'd0000000-1001-4000-8000-000000000004', 21, 'morning', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"},{"role":"user","content":"大概是……我覺得自己不重要吧。"},{"role":"assistant","content":"「我覺得自己不重要」——這句話你有直接跟對方說過嗎？"},{"role":"user","content":"沒有，我講不出口。"},{"role":"assistant","content":"講不出口的時候，通常會冒出什麼念頭擋住你？"}]'::jsonb,
        '第 21 天的練習', NOW() - INTERVAL '0 days', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.blindspot_records (id, journey_id, day_number, blindspot_code, context_type, trigger_snippet, ai_feedback)
VALUES ('d0000000-0006-4000-8000-000000000421', 'd0000000-0002-4000-8000-000000000004', 21, 'B2', 'morning', '隨便你', '這是放棄溝通的訊號，但對方可能解讀成不在乎。')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.achievements (id, journey_id, badge_id, badge_name, points)
VALUES ('d0000000-0007-4000-8000-000000000401', 'd0000000-0002-4000-8000-000000000004', 'week_1', '第 1 週完成', 50)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.achievements (id, journey_id, badge_id, badge_name, points)
VALUES ('d0000000-0007-4000-8000-000000000402', 'd0000000-0002-4000-8000-000000000004', 'week_2', '第 2 週完成', 50)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.achievements (id, journey_id, badge_id, badge_name, points)
VALUES ('d0000000-0007-4000-8000-000000000403', 'd0000000-0002-4000-8000-000000000004', 'week_3', '第 3 週完成', 50)
ON CONFLICT (id) DO NOTHING;

-- 測試用戶・已退訂（day 8/21）：有資料但方案已失效。測額度擋人時舊資料還讀不讀得到
INSERT INTO happy.journeys (id, user_id, mbti_self, mbti_partner, mbti_confidence,
       partner_nickname, relationship_type, goal_statement, initial_problem,
       start_date, current_day, is_active, total_points)
VALUES ('d0000000-0002-4000-8000-000000000005', 'd0000000-1001-4000-8000-000000000005', 'ISFP', 'ENTJ', 'low',
        '範例夥伴', 'couple',
        '想練習把心裡的感受講出來，而不是等對方猜。',
        '對方一沉默我就開始焦慮，然後講出更難聽的話。',
        (CURRENT_DATE - INTERVAL '8 days'), 8,
        FALSE, 80)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000501', 'd0000000-0002-4000-8000-000000000005', 1, (CURRENT_DATE - INTERVAL '7 days'), FALSE, 'failed', 8, '今天試著在對話中停三秒再回應，感覺沒有想像中困難。', 0)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000501', 'd0000000-0002-4000-8000-000000000005', 'd0000000-1001-4000-8000-000000000005', 1, 'morning', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"},{"role":"user","content":"大概是……我覺得自己不重要吧。"},{"role":"assistant","content":"「我覺得自己不重要」——這句話你有直接跟對方說過嗎？"},{"role":"user","content":"沒有，我講不出口。"},{"role":"assistant","content":"講不出口的時候，通常會冒出什麼念頭擋住你？"}]'::jsonb,
        '第 1 天的練習', NOW() - INTERVAL '7 days', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000502', 'd0000000-0002-4000-8000-000000000005', 2, (CURRENT_DATE - INTERVAL '6 days'), TRUE, 'success', 3, '照著今天的任務做了，但心裡其實有點抗拒，覺得這樣很刻意。不過做完之後氣氛真的有比較鬆一點，可能刻意也沒關係吧。明天再試一次看看。', 10)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000502', 'd0000000-0002-4000-8000-000000000005', 'd0000000-1001-4000-8000-000000000005', 2, 'realtime', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"},{"role":"user","content":"大概是……我覺得自己不重要吧。"},{"role":"assistant","content":"「我覺得自己不重要」——這句話你有直接跟對方說過嗎？"},{"role":"user","content":"沒有，我講不出口。"},{"role":"assistant","content":"講不出口的時候，通常會冒出什麼念頭擋住你？"},{"role":"user","content":"會覺得講了很丟臉，好像在討拍。"},{"role":"assistant","content":"如果今天換成對方這樣對你說，你會覺得他在討拍嗎？"},{"role":"user","content":"不會啊，我應該會想抱抱他。"},{"role":"assistant","content":"那你剛剛給自己的標準，跟給對方的標準，好像不太一樣。"}]'::jsonb,
        '第 2 天的練習', NOW() - INTERVAL '6 days', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_memories (id, journey_id, day_number, emotion_note, task_result, partner_obs, key_insight, follow_up)
VALUES ('d0000000-0005-4000-8000-000000000502', 'd0000000-0002-4000-8000-000000000005', 2, '有點煩躁但有察覺', '忘記了，晚上補做', '對方主動問了我一句', '我太快想解決問題了', '暫時不用做什麼')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000503', 'd0000000-0002-4000-8000-000000000005', 3, (CURRENT_DATE - INTERVAL '5 days'), FALSE, 'failed', 7, '還是忍不住先講了道理，等到講完才發現對方只是想被聽見。今天算失敗，但至少我察覺到了。', 0)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000503', 'd0000000-0002-4000-8000-000000000005', 'd0000000-1001-4000-8000-000000000005', 3, 'evening', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"},{"role":"user","content":"大概是……我覺得自己不重要吧。"},{"role":"assistant","content":"「我覺得自己不重要」——這句話你有直接跟對方說過嗎？"}]'::jsonb,
        '第 3 天的練習', NOW() - INTERVAL '5 days', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.blindspot_records (id, journey_id, day_number, blindspot_code, context_type, trigger_snippet, ai_feedback)
VALUES ('d0000000-0006-4000-8000-000000000503', 'd0000000-0002-4000-8000-000000000005', 3, 'B4', 'morning', '我早就說過了', '這是放棄溝通的訊號，但對方可能解讀成不在乎。')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000504', 'd0000000-0002-4000-8000-000000000005', 4, (CURRENT_DATE - INTERVAL '4 days'), TRUE, 'success', 9, '還是忍不住先講了道理，等到講完才發現對方只是想被聽見。今天算失敗，但至少我察覺到了。', 10)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000504', 'd0000000-0002-4000-8000-000000000005', 'd0000000-1001-4000-8000-000000000005', 4, 'onboarding', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"},{"role":"user","content":"大概是……我覺得自己不重要吧。"},{"role":"assistant","content":"「我覺得自己不重要」——這句話你有直接跟對方說過嗎？"},{"role":"user","content":"沒有，我講不出口。"},{"role":"assistant","content":"講不出口的時候，通常會冒出什麼念頭擋住你？"},{"role":"user","content":"會覺得講了很丟臉，好像在討拍。"},{"role":"assistant","content":"如果今天換成對方這樣對你說，你會覺得他在討拍嗎？"}]'::jsonb,
        '第 4 天的練習', NOW() - INTERVAL '4 days', NOW() - INTERVAL '3 days')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_memories (id, journey_id, day_number, emotion_note, task_result, partner_obs, key_insight, follow_up)
VALUES ('d0000000-0005-4000-8000-000000000504', 'd0000000-0002-4000-8000-000000000005', 4, '有點煩躁但有察覺', '忘記了，晚上補做', '對方看起來有心事', '我需要的是被聽見', '明天試著只聽不回')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000505', 'd0000000-0002-4000-8000-000000000005', 5, (CURRENT_DATE - INTERVAL '3 days'), TRUE, 'partial', 2, '還是忍不住先講了道理，等到講完才發現對方只是想被聽見。今天算失敗，但至少我察覺到了。', 10)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000505', 'd0000000-0002-4000-8000-000000000005', 'd0000000-1001-4000-8000-000000000005', 5, 'morning', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"},{"role":"user","content":"大概是……我覺得自己不重要吧。"},{"role":"assistant","content":"「我覺得自己不重要」——這句話你有直接跟對方說過嗎？"},{"role":"user","content":"沒有，我講不出口。"},{"role":"assistant","content":"講不出口的時候，通常會冒出什麼念頭擋住你？"}]'::jsonb,
        '第 5 天的練習', NOW() - INTERVAL '3 days', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000506', 'd0000000-0002-4000-8000-000000000005', 6, (CURRENT_DATE - INTERVAL '2 days'), TRUE, 'success', 5, '今天試著在對話中停三秒再回應，感覺沒有想像中困難。', 10)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000506', 'd0000000-0002-4000-8000-000000000005', 'd0000000-1001-4000-8000-000000000005', 6, 'realtime', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"},{"role":"user","content":"大概是……我覺得自己不重要吧。"},{"role":"assistant","content":"「我覺得自己不重要」——這句話你有直接跟對方說過嗎？"},{"role":"user","content":"沒有，我講不出口。"},{"role":"assistant","content":"講不出口的時候，通常會冒出什麼念頭擋住你？"},{"role":"user","content":"會覺得講了很丟臉，好像在討拍。"},{"role":"assistant","content":"如果今天換成對方這樣對你說，你會覺得他在討拍嗎？"}]'::jsonb,
        '第 6 天的練習', NOW() - INTERVAL '2 days', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_memories (id, journey_id, day_number, emotion_note, task_result, partner_obs, key_insight, follow_up)
VALUES ('d0000000-0005-4000-8000-000000000506', 'd0000000-0002-4000-8000-000000000005', 6, '有點煩躁但有察覺', '完成，但做得有點勉強', '沒有特別觀察到什麼', '我太快想解決問題了', '提醒自己停三秒')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.blindspot_records (id, journey_id, day_number, blindspot_code, context_type, trigger_snippet, ai_feedback)
VALUES ('d0000000-0006-4000-8000-000000000506', 'd0000000-0002-4000-8000-000000000005', 6, 'B2', 'morning', '我早就說過了', '這是放棄溝通的訊號，但對方可能解讀成不在乎。')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000507', 'd0000000-0002-4000-8000-000000000005', 7, (CURRENT_DATE - INTERVAL '1 days'), TRUE, 'partial', 4, '沒什麼特別的一天。', 10)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000507', 'd0000000-0002-4000-8000-000000000005', 'd0000000-1001-4000-8000-000000000005', 7, 'evening', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"}]'::jsonb,
        '第 7 天的練習', NOW() - INTERVAL '1 days', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000508', 'd0000000-0002-4000-8000-000000000005', 8, (CURRENT_DATE - INTERVAL '0 days'), TRUE, 'partial', 2, '沒什麼特別的一天。', 10)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000508', 'd0000000-0002-4000-8000-000000000005', 'd0000000-1001-4000-8000-000000000005', 8, 'onboarding', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"},{"role":"user","content":"大概是……我覺得自己不重要吧。"},{"role":"assistant","content":"「我覺得自己不重要」——這句話你有直接跟對方說過嗎？"},{"role":"user","content":"沒有，我講不出口。"},{"role":"assistant","content":"講不出口的時候，通常會冒出什麼念頭擋住你？"},{"role":"user","content":"會覺得講了很丟臉，好像在討拍。"},{"role":"assistant","content":"如果今天換成對方這樣對你說，你會覺得他在討拍嗎？"}]'::jsonb,
        '第 8 天的練習', NOW() - INTERVAL '0 days', NOW() - INTERVAL '0 days')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_memories (id, journey_id, day_number, emotion_note, task_result, partner_obs, key_insight, follow_up)
VALUES ('d0000000-0005-4000-8000-000000000508', 'd0000000-0002-4000-8000-000000000005', 8, '情緒起伏不大', '只做了一半', '沒有特別觀察到什麼', '我太快想解決問題了', '找機會說出今天的感受')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.achievements (id, journey_id, badge_id, badge_name, points)
VALUES ('d0000000-0007-4000-8000-000000000501', 'd0000000-0002-4000-8000-000000000005', 'week_1', '第 1 週完成', 50)
ON CONFLICT (id) DO NOTHING;

-- 測試用戶・邊界值（day 5/21）：專門放極端值：超長日記、emoji、單輪與超長對話、可為 null 的欄位全空
INSERT INTO happy.journeys (id, user_id, mbti_self, mbti_partner, mbti_confidence,
       partner_nickname, relationship_type, goal_statement, initial_problem,
       start_date, current_day, is_active, total_points)
VALUES ('d0000000-0002-4000-8000-000000000006', 'd0000000-1001-4000-8000-000000000006', 'INTJ', NULL, 'low',
        '測試對象B', 'workplace',
        NULL,
        NULL,
        (CURRENT_DATE - INTERVAL '5 days'), 5,
        TRUE, 50)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000601', 'd0000000-0002-4000-8000-000000000006', 1, (CURRENT_DATE - INTERVAL '4 days'), TRUE, 'success', 3, '這是一段刻意寫很長的測試日記，用來確認前端的換行、截斷與捲動行為是否正常。這是一段刻意寫很長的測試日記，用來確認前端的換行、截斷與捲動行為是否正常。這是一段刻意寫很長的測試日記，用來確認前端的換行、截斷與捲動行為是否正常。這是一段刻意寫很長的測試日記，用來確認前端的換行、截斷與捲動行為是否正常。這是一段刻意寫很長的測試日記，用來確認前端的換行、截斷與捲動行為是否正常。這是一段刻意寫很長的測試日記，用來確認前端的換行、截斷與捲動行為是否正常。這是一段刻意寫很長的測試日記，用來確認前端的換行、截斷與捲動行為是否正常。這是一段刻意寫很長的測試日記，用來確認前端的換行、截斷與捲動行為是否正常。這是一段刻意寫很長的測試日記，用來確認前端的換行、截斷與捲動行為是否正常。這是一段刻意寫很長的測試日記，用來確認前端的換行、截斷與捲動行為是否正常。這是一段刻意寫很長的測試日記，用來確認前端的換行、截斷與捲動行為是否正常。這是一段刻意寫很長的測試日記，用來確認前端的換行、截斷與捲動行為是否正常。', 10)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000601', 'd0000000-0002-4000-8000-000000000006', 'd0000000-1001-4000-8000-000000000006', 1, 'morning', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"}]'::jsonb,
        '第 1 天的練習', NOW() - INTERVAL '4 days', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000602', 'd0000000-0002-4000-8000-000000000006', 2, (CURRENT_DATE - INTERVAL '3 days'), TRUE, 'success', 3, '今天心情還不錯 😊 對方也笑了 🎉 想記錄一下這個瞬間 ✨💛', 10)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000602', 'd0000000-0002-4000-8000-000000000006', 'd0000000-1001-4000-8000-000000000006', 2, 'realtime', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"},{"role":"user","content":"大概是……我覺得自己不重要吧。"},{"role":"assistant","content":"「我覺得自己不重要」——這句話你有直接跟對方說過嗎？"},{"role":"user","content":"沒有，我講不出口。"},{"role":"assistant","content":"講不出口的時候，通常會冒出什麼念頭擋住你？"},{"role":"user","content":"會覺得講了很丟臉，好像在討拍。"},{"role":"assistant","content":"如果今天換成對方這樣對你說，你會覺得他在討拍嗎？"},{"role":"user","content":"不會啊，我應該會想抱抱他。"},{"role":"assistant","content":"那你剛剛給自己的標準，跟給對方的標準，好像不太一樣。"},{"role":"user","content":"……真的耶。"},{"role":"assistant","content":"今天的心法就在這裡：先把對自己的那套標準放鬆一點，話才出得來。"}]'::jsonb,
        '第 2 天的練習', NOW() - INTERVAL '3 days', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_memories (id, journey_id, day_number, emotion_note, task_result, partner_obs, key_insight, follow_up)
VALUES ('d0000000-0005-4000-8000-000000000602', 'd0000000-0002-4000-8000-000000000006', 2, '有點煩躁但有察覺', '完成，但做得有點勉強', '對方主動問了我一句', '我太快想解決問題了', '找機會說出今天的感受')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000603', 'd0000000-0002-4000-8000-000000000006', 3, (CURRENT_DATE - INTERVAL '2 days'), FALSE, 'failed', 6, '嗯。', 0)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000603', 'd0000000-0002-4000-8000-000000000006', 'd0000000-1001-4000-8000-000000000006', 3, 'evening', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"},{"role":"user","content":"大概是……我覺得自己不重要吧。"},{"role":"assistant","content":"「我覺得自己不重要」——這句話你有直接跟對方說過嗎？"},{"role":"user","content":"沒有，我講不出口。"},{"role":"assistant","content":"講不出口的時候，通常會冒出什麼念頭擋住你？"},{"role":"user","content":"會覺得講了很丟臉，好像在討拍。"},{"role":"assistant","content":"如果今天換成對方這樣對你說，你會覺得他在討拍嗎？"},{"role":"user","content":"不會啊，我應該會想抱抱他。"},{"role":"assistant","content":"那你剛剛給自己的標準，跟給對方的標準，好像不太一樣。"},{"role":"user","content":"……真的耶。"},{"role":"assistant","content":"今天的心法就在這裡：先把對自己的那套標準放鬆一點，話才出得來。"}]'::jsonb,
        '第 3 天的練習', NOW() - INTERVAL '2 days', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.blindspot_records (id, journey_id, day_number, blindspot_code, context_type, trigger_snippet, ai_feedback)
VALUES ('d0000000-0006-4000-8000-000000000603', 'd0000000-0002-4000-8000-000000000006', 3, 'B4', 'morning', '隨便你', '強調自己是對的，會讓對方把注意力放在防禦而不是理解。')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000604', 'd0000000-0002-4000-8000-000000000006', 4, (CURRENT_DATE - INTERVAL '1 days'), TRUE, 'success', 3, '今天試著在對話中停三秒再回應，感覺沒有想像中困難。', 10)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000604', 'd0000000-0002-4000-8000-000000000006', 'd0000000-1001-4000-8000-000000000006', 4, 'onboarding', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"},{"role":"user","content":"大概是……我覺得自己不重要吧。"},{"role":"assistant","content":"「我覺得自己不重要」——這句話你有直接跟對方說過嗎？"},{"role":"user","content":"沒有，我講不出口。"},{"role":"assistant","content":"講不出口的時候，通常會冒出什麼念頭擋住你？"},{"role":"user","content":"會覺得講了很丟臉，好像在討拍。"},{"role":"assistant","content":"如果今天換成對方這樣對你說，你會覺得他在討拍嗎？"},{"role":"user","content":"不會啊，我應該會想抱抱他。"},{"role":"assistant","content":"那你剛剛給自己的標準，跟給對方的標準，好像不太一樣。"},{"role":"user","content":"……真的耶。"},{"role":"assistant","content":"今天的心法就在這裡：先把對自己的那套標準放鬆一點，話才出得來。"}]'::jsonb,
        '第 4 天的練習', NOW() - INTERVAL '1 days', NOW() - INTERVAL '0 days')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_memories (id, journey_id, day_number, emotion_note, task_result, partner_obs, key_insight, follow_up)
VALUES ('d0000000-0005-4000-8000-000000000604', 'd0000000-0002-4000-8000-000000000006', 4, '有點煩躁但有察覺', '順利完成', '對方今天話比較多', '我太快想解決問題了', '明天試著只聽不回')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000605', 'd0000000-0002-4000-8000-000000000006', 5, (CURRENT_DATE - INTERVAL '0 days'), TRUE, 'success', 2, '照著今天的任務做了，但心裡其實有點抗拒，覺得這樣很刻意。不過做完之後氣氛真的有比較鬆一點，可能刻意也沒關係吧。明天再試一次看看。', 10)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000605', 'd0000000-0002-4000-8000-000000000006', 'd0000000-1001-4000-8000-000000000006', 5, 'morning', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"},{"role":"user","content":"大概是……我覺得自己不重要吧。"},{"role":"assistant","content":"「我覺得自己不重要」——這句話你有直接跟對方說過嗎？"},{"role":"user","content":"沒有，我講不出口。"},{"role":"assistant","content":"講不出口的時候，通常會冒出什麼念頭擋住你？"},{"role":"user","content":"會覺得講了很丟臉，好像在討拍。"},{"role":"assistant","content":"如果今天換成對方這樣對你說，你會覺得他在討拍嗎？"},{"role":"user","content":"不會啊，我應該會想抱抱他。"},{"role":"assistant","content":"那你剛剛給自己的標準，跟給對方的標準，好像不太一樣。"},{"role":"user","content":"……真的耶。"},{"role":"assistant","content":"今天的心法就在這裡：先把對自己的那套標準放鬆一點，話才出得來。"}]'::jsonb,
        '第 5 天的練習', NOW() - INTERVAL '0 days', NULL)
ON CONFLICT (id) DO NOTHING;

-- 測試用戶・親子（day 6/21）：relationship_type 不是 couple。文案會依關係類型變化，只測 couple 會漏
INSERT INTO happy.journeys (id, user_id, mbti_self, mbti_partner, mbti_confidence,
       partner_nickname, relationship_type, goal_statement, initial_problem,
       start_date, current_day, is_active, total_points)
VALUES ('d0000000-0002-4000-8000-000000000007', 'd0000000-1001-4000-8000-000000000007', 'ESFJ', 'ISTP', 'medium',
        '小樣本', 'parent_child',
        '希望每天至少有一次好好聽對方說完話。',
        '兩個人都很忙，回到家幾乎沒有交集。',
        (CURRENT_DATE - INTERVAL '6 days'), 6,
        TRUE, 60)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000701', 'd0000000-0002-4000-8000-000000000007', 1, (CURRENT_DATE - INTERVAL '5 days'), TRUE, 'success', 9, '沒什麼特別的一天。', 10)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000701', 'd0000000-0002-4000-8000-000000000007', 'd0000000-1001-4000-8000-000000000007', 1, 'morning', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"},{"role":"user","content":"大概是……我覺得自己不重要吧。"},{"role":"assistant","content":"「我覺得自己不重要」——這句話你有直接跟對方說過嗎？"}]'::jsonb,
        '第 1 天的練習', NOW() - INTERVAL '5 days', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000702', 'd0000000-0002-4000-8000-000000000007', 2, (CURRENT_DATE - INTERVAL '4 days'), TRUE, 'success', 8, '照著今天的任務做了，但心裡其實有點抗拒，覺得這樣很刻意。不過做完之後氣氛真的有比較鬆一點，可能刻意也沒關係吧。明天再試一次看看。', 10)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000702', 'd0000000-0002-4000-8000-000000000007', 'd0000000-1001-4000-8000-000000000007', 2, 'realtime', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"},{"role":"user","content":"大概是……我覺得自己不重要吧。"},{"role":"assistant","content":"「我覺得自己不重要」——這句話你有直接跟對方說過嗎？"},{"role":"user","content":"沒有，我講不出口。"},{"role":"assistant","content":"講不出口的時候，通常會冒出什麼念頭擋住你？"},{"role":"user","content":"會覺得講了很丟臉，好像在討拍。"},{"role":"assistant","content":"如果今天換成對方這樣對你說，你會覺得他在討拍嗎？"},{"role":"user","content":"不會啊，我應該會想抱抱他。"},{"role":"assistant","content":"那你剛剛給自己的標準，跟給對方的標準，好像不太一樣。"}]'::jsonb,
        '第 2 天的練習', NOW() - INTERVAL '4 days', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_memories (id, journey_id, day_number, emotion_note, task_result, partner_obs, key_insight, follow_up)
VALUES ('d0000000-0005-4000-8000-000000000702', 'd0000000-0002-4000-8000-000000000007', 2, '比昨天平靜一些', '順利完成', '沒有特別觀察到什麼', '沉默不一定是生氣', '提醒自己停三秒')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000703', 'd0000000-0002-4000-8000-000000000007', 3, (CURRENT_DATE - INTERVAL '3 days'), TRUE, 'success', 10, '沒什麼特別的一天。', 10)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000703', 'd0000000-0002-4000-8000-000000000007', 'd0000000-1001-4000-8000-000000000007', 3, 'evening', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"},{"role":"user","content":"大概是……我覺得自己不重要吧。"},{"role":"assistant","content":"「我覺得自己不重要」——這句話你有直接跟對方說過嗎？"}]'::jsonb,
        '第 3 天的練習', NOW() - INTERVAL '3 days', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.blindspot_records (id, journey_id, day_number, blindspot_code, context_type, trigger_snippet, ai_feedback)
VALUES ('d0000000-0006-4000-8000-000000000703', 'd0000000-0002-4000-8000-000000000007', 3, 'B4', 'morning', '你每次都這樣', '強調自己是對的，會讓對方把注意力放在防禦而不是理解。')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000704', 'd0000000-0002-4000-8000-000000000007', 4, (CURRENT_DATE - INTERVAL '2 days'), TRUE, 'success', 5, '還是忍不住先講了道理，等到講完才發現對方只是想被聽見。今天算失敗，但至少我察覺到了。', 10)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000704', 'd0000000-0002-4000-8000-000000000007', 'd0000000-1001-4000-8000-000000000007', 4, 'onboarding', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"},{"role":"user","content":"大概是……我覺得自己不重要吧。"},{"role":"assistant","content":"「我覺得自己不重要」——這句話你有直接跟對方說過嗎？"},{"role":"user","content":"沒有，我講不出口。"},{"role":"assistant","content":"講不出口的時候，通常會冒出什麼念頭擋住你？"},{"role":"user","content":"會覺得講了很丟臉，好像在討拍。"},{"role":"assistant","content":"如果今天換成對方這樣對你說，你會覺得他在討拍嗎？"},{"role":"user","content":"不會啊，我應該會想抱抱他。"},{"role":"assistant","content":"那你剛剛給自己的標準，跟給對方的標準，好像不太一樣。"}]'::jsonb,
        '第 4 天的練習', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 days')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_memories (id, journey_id, day_number, emotion_note, task_result, partner_obs, key_insight, follow_up)
VALUES ('d0000000-0005-4000-8000-000000000704', 'd0000000-0002-4000-8000-000000000007', 4, '比昨天平靜一些', '完成，但做得有點勉強', '對方主動問了我一句', '沉默不一定是生氣', '暫時不用做什麼')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000705', 'd0000000-0002-4000-8000-000000000007', 5, (CURRENT_DATE - INTERVAL '1 days'), TRUE, 'success', 6, '照著今天的任務做了，但心裡其實有點抗拒，覺得這樣很刻意。不過做完之後氣氛真的有比較鬆一點，可能刻意也沒關係吧。明天再試一次看看。', 10)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000705', 'd0000000-0002-4000-8000-000000000007', 'd0000000-1001-4000-8000-000000000007', 5, 'morning', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"},{"role":"user","content":"大概是……我覺得自己不重要吧。"},{"role":"assistant","content":"「我覺得自己不重要」——這句話你有直接跟對方說過嗎？"},{"role":"user","content":"沒有，我講不出口。"},{"role":"assistant","content":"講不出口的時候，通常會冒出什麼念頭擋住你？"},{"role":"user","content":"會覺得講了很丟臉，好像在討拍。"},{"role":"assistant","content":"如果今天換成對方這樣對你說，你會覺得他在討拍嗎？"}]'::jsonb,
        '第 5 天的練習', NOW() - INTERVAL '1 days', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_records (id, journey_id, day_number, date, task_completed, completion_type, emotion_score, journal_text, points_earned)
VALUES ('d0000000-0003-4000-8000-000000000706', 'd0000000-0002-4000-8000-000000000007', 6, (CURRENT_DATE - INTERVAL '0 days'), FALSE, 'failed', 3, '沒什麼特別的一天。', 0)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.conversations (id, journey_id, user_id, day_number, context_type, messages, topic_title, topic_started_at, archived_at)
VALUES ('d0000000-0004-4000-8000-000000000706', 'd0000000-0002-4000-8000-000000000007', 'd0000000-1001-4000-8000-000000000007', 6, 'realtime', '[{"role":"user","content":"今天又吵架了，我真的不知道該怎麼辦。"},{"role":"assistant","content":"聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？"},{"role":"user","content":"我先講的，我說「你都不聽我說話」。"},{"role":"assistant","content":"那句話說出口的時候，你心裡最想讓對方知道的是什麼？"},{"role":"user","content":"大概是……我覺得自己不重要吧。"},{"role":"assistant","content":"「我覺得自己不重要」——這句話你有直接跟對方說過嗎？"},{"role":"user","content":"沒有，我講不出口。"},{"role":"assistant","content":"講不出口的時候，通常會冒出什麼念頭擋住你？"},{"role":"user","content":"會覺得講了很丟臉，好像在討拍。"},{"role":"assistant","content":"如果今天換成對方這樣對你說，你會覺得他在討拍嗎？"}]'::jsonb,
        '第 6 天的練習', NOW() - INTERVAL '0 days', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.daily_memories (id, journey_id, day_number, emotion_note, task_result, partner_obs, key_insight, follow_up)
VALUES ('d0000000-0005-4000-8000-000000000706', 'd0000000-0002-4000-8000-000000000007', 6, '比昨天平靜一些', '順利完成', '對方今天話比較多', '沉默不一定是生氣', '明天試著只聽不回')
ON CONFLICT (id) DO NOTHING;
INSERT INTO happy.blindspot_records (id, journey_id, day_number, blindspot_code, context_type, trigger_snippet, ai_feedback)
VALUES ('d0000000-0006-4000-8000-000000000706', 'd0000000-0002-4000-8000-000000000007', 6, 'B2', 'morning', '你每次都這樣', '這是放棄溝通的訊號，但對方可能解讀成不在乎。')
ON CONFLICT (id) DO NOTHING;

-- 測試用戶・未開課：刻意【不建立 journey】—— 做完 onboarding（user 層已有 MBTI）但還沒開任何一輪。測 /chat 空狀態，以及 Mode B 不需 journey 也能用

COMMIT;

-- ── 產生內容摘要 ──────────────────────────────────────────────
--   測試用戶・全新            trial      day  0/21  剛 SSO 進來、user 層還沒有 MBTI。測 /sso 落在 /onboarding 這條路徑
--   測試用戶・初期            basic      day  3/21  剛起步。測進度條低百分比、成就尚未解鎖
--   測試用戶・進行中           advanced   day 12/21  最典型的使用中狀態。資料量最完整，日常開發主要看這筆
--   測試用戶・已完課           premium    day 21/21  21 天全完成。測結業畫面、滿版成就、進度條 100% 不會溢位
--   測試用戶・已退訂           cancelled  day  8/21  有資料但方案已失效。測額度擋人時舊資料還讀不讀得到
--   測試用戶・邊界值           premium    day  5/21  專門放極端值：超長日記、emoji、單輪與超長對話、可為 null 的欄位全空
--   測試用戶・親子            basic      day  6/21  relationship_type 不是 couple。文案會依關係類型變化，只測 couple 會漏
--   測試用戶・未開課           basic      day  0/21  做完 onboarding（user 層已有 MBTI）但還沒開任何一輪。測 /chat 空狀態，以及 Mode B 不需 journey 也能用
