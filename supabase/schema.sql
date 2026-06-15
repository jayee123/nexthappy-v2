-- =============================================
-- 21天幸福關係練習系統 - 資料庫 Schema
-- 在 Supabase SQL Editor 執行此檔案
-- =============================================

-- 啟用 UUID 擴充
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ① 邀請碼管理
CREATE TABLE invite_codes (
  code TEXT PRIMARY KEY,
  used_by UUID,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- ② 學員基本資料
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  password_hash TEXT NOT NULL,
  invite_code TEXT REFERENCES invite_codes(code),
  nuwa_user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 更新 invite_codes 的 used_by 外鍵
ALTER TABLE invite_codes ADD CONSTRAINT fk_invite_used_by
  FOREIGN KEY (used_by) REFERENCES users(id);

-- ③ 21天練習旅程設定（每個學員一筆）
CREATE TABLE journeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  mbti_self TEXT NOT NULL,
  mbti_partner TEXT,
  mbti_confidence TEXT DEFAULT 'medium' CHECK (mbti_confidence IN ('low', 'medium', 'high')),
  partner_nickname TEXT NOT NULL,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('couple', 'parent_child', 'workplace')),
  goal_statement TEXT,
  initial_problem TEXT,
  start_date DATE NOT NULL,
  current_day INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  total_points INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ④ 每日任務記錄
CREATE TABLE daily_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID REFERENCES journeys(id) ON DELETE CASCADE,
  day_number INT NOT NULL,
  date DATE NOT NULL,
  task_completed BOOLEAN DEFAULT FALSE,
  completion_type TEXT CHECK (completion_type IN ('success', 'partial', 'failed')),
  emotion_score INT CHECK (emotion_score BETWEEN 1 AND 10),
  journal_text TEXT,
  points_earned INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(journey_id, day_number)
);

-- ⑤ AI 對話記錄
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID REFERENCES journeys(id) ON DELETE CASCADE,
  day_number INT NOT NULL,
  context_type TEXT CHECK (context_type IN ('morning', 'realtime', 'evening', 'onboarding')),
  messages JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ⑥ 每日記憶摘要（AI 萃取，用於下一天的 context）
CREATE TABLE daily_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID REFERENCES journeys(id) ON DELETE CASCADE,
  day_number INT NOT NULL,
  emotion_note TEXT,
  task_result TEXT,
  partner_obs TEXT,
  key_insight TEXT,
  follow_up TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(journey_id, day_number)
);

-- ⑦ 成就與積分
CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID REFERENCES journeys(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL,
  badge_name TEXT NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  points INT DEFAULT 0
);

-- ⑧ 課程內容（靜態，由管理者填入）
CREATE TABLE course_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_number INT UNIQUE NOT NULL,
  theme TEXT NOT NULL,
  subtitle TEXT,
  course_unit TEXT,
  knowledge_point TEXT NOT NULL,
  today_task TEXT NOT NULL,
  evening_questions JSONB DEFAULT '[]',
  special_content JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 索引優化
-- =============================================
CREATE INDEX idx_journeys_user_id ON journeys(user_id);
CREATE INDEX idx_daily_records_journey_id ON daily_records(journey_id);
CREATE INDEX idx_daily_records_day ON daily_records(journey_id, day_number);
CREATE INDEX idx_conversations_journey_day ON conversations(journey_id, day_number);
CREATE INDEX idx_daily_memories_journey_day ON daily_memories(journey_id, day_number);
CREATE INDEX idx_achievements_journey_id ON achievements(journey_id);

-- =============================================
-- 預設管理員邀請碼（初始測試用）
-- =============================================
INSERT INTO invite_codes (code, expires_at) VALUES
  ('HAPPY-2026-BETA', NOW() + INTERVAL '1 year'),
  ('NUWA-TEST-001', NOW() + INTERVAL '1 year'),
  ('NUWA-TEST-002', NOW() + INTERVAL '1 year'),
  ('NUWA-TEST-003', NOW() + INTERVAL '1 year'),
  ('NUWA-TEST-004', NOW() + INTERVAL '1 year'),
  ('NUWA-TEST-005', NOW() + INTERVAL '1 year');

-- =============================================
-- 課程內容（示範內容，待老師填入真實課程）
-- =============================================
INSERT INTO course_content (day_number, theme, subtitle, course_unit, knowledge_point, today_task, evening_questions, special_content) VALUES
(0, '開始你的旅程', '設定你的練習目標', '前置準備',
  '溝通不只是說了什麼，更重要的是對方在那個當下能接收到什麼。當我們說話時，要同時考慮「我想表達什麼」和「對方現在能接收什麼」。',
  '今天先觀察：今天和對方互動後，注意他們的一個反應，無論正負面都記下來。',
  '["今天觀察到什麼讓你印象深刻？", "你最希望在這21天改善的一件事是什麼？"]',
  '{}'),

(1, '建立安全感與連結', '傾聽與正向肯定', '幸福關係的底層邏輯',
  '幸福關係的核心不是「沒有衝突」，而是「有安全感可以說真心話」。當你說出情緒而不是指責時，對方更容易敞開心房。今天試著用「我覺得...」開頭說一句話。',
  '今天試著用「我覺得...」開頭，說一句真實的感受給對方聽。不需要完整，一句話就夠了。',
  '["你說出「我覺得...」之後，對方有什麼反應？", "說出感受的當下，你有什麼感覺？"]',
  '{"tip": "伴侶間的安全感建立在「我可以脆弱而不被嘲笑」的信任上。"}'),

(2, 'MBTI 自我與他人覺察', '認識八大主導功能與「被理解」的渴望', 'MBTI 人格類型',
  '每個人都有自己的「認知語言」。MBTI 不是標籤，而是理解對方為何這樣反應的地圖。真正的理解，是看懂對方的語言，讓對方感到真的有被接住。',
  '今天觀察：當對方說話時，放下手機，眼神接觸，偶爾點點頭說「我聽著呢」。讓他知道你沒有在想下一句要說什麼。',
  '["你今天做到「全心傾聽」了嗎？對方有沒有什麼不一樣的反應？", "今天問你一個小事：你覺得他說話時最在意什麼？"]',
  '{"tip": "MBTI 差異常是吸引力來源，也是摩擦來源。試著用對方想要的方式去靠近。"}'),

(3, '建立關係溝通規則', '共同協議與合作', '如何推導 MBTI 主導輔助功能',
  '關係規則能讓互動更有可預測性，降低防衛。你們不需要所有事情都一致，但需要對「怎麼吵架」「怎麼說不」有共識。',
  '今天練習「用心聽」：當對方開始說話時，問自己「我現在是想回應，還是想理解？」這個停頓就夠了。',
  '["今天你問自己「想回應還是想理解」時，發現了什麼？", "根據你建議的「傾聽」原則，你今天做到了嗎？"]',
  '{"milestone": "streak_3days", "milestone_message": "第一個轉折點！你已經踏出了很多人跨不過去的那一步 🎉"}'),

(4, '練習肯定語言', '如何建立幸福關係', '如何建立幸福關係',
  '幸福關係的建立有四步驟：透視自己 → 了解他人 → 贏得他的心 → 獲得幸福關係。肯定語言是其中關鍵的一環——讓對方感受到「你看到我了」。',
  '今天給對方一個真心的讚美。不要讚美結果（「你好厲害」），而是讚美過程（「我看到你為了這件事付出很多」）。',
  '["你今天說了什麼讚美？對方的反應是什麼？", "說完讚美後，你自己有什麼感覺？"]',
  '{}'),

(5, '一次搞懂 F 型和 T 型人性格需求', '理智 T 人 vs. 情感 F 人', '一次搞懂 F 和 T 人性格需求',
  'F 型人在關係中需要的是「被感受到」——他們說問題時，往往想要的是共鳴，不是解決方案。T 型人則傾向用邏輯解決問題，直接給建議是他們表達關心的方式。兩者都是愛，只是語言不同。',
  '今天觀察：當對方說一件困擾的事，你先問「你現在需要我聽，還是需要我幫你想辦法？」然後照他說的做。',
  '["你問了「需要聽還是想辦法」嗎？對方怎麼回答？", "這個問法讓你們的對話有什麼不同？"]',
  '{"f_need": "被感受到、被接納、情緒共鳴", "t_need": "被尊重、有效率、邏輯清晰", "common_misunderstanding": "F 人說問題不是要解決，T 人給建議不是不關心"}'),

(6, 'Fe/Fi vs Te/Ti 的實際應用', '揭密情感與思考的深層差異', '揭密 Fe·Fi 與 Te·Ti 的性格反差',
  'Fe（外向情感）重視群體和諧，容易感受到他人情緒。Fi（內向情感）有強烈的個人價值觀，需要被真正理解。Te（外向思考）注重效率和結果。Ti（內向思考）追求邏輯一致性和深度理解。',
  '今天練習：當對方分享一件事，先說「我理解你的感受是...」，確認對方感受後再說你的想法。',
  '["今天你確認對方感受時，他的反應是什麼？", "這種先確認感受的方式，對你來說難嗎？為什麼？"]',
  '{"fe": "在乎所有人都感覺好", "fi": "在乎自己的價值觀和真實感受", "te": "用系統和效率解決問題", "ti": "用邏輯和原則分析問題"}'),

(7, 'Week 1 里程碑回顧', 'AI 生成你的第一週成長報告', '第一週總結',
  '你已經完成了第一週的練習。這一週，你開始觀察、開始說出感受、開始傾聽。改變從來不是一蹴而就的，但你已經在路上了。',
  '今天是里程碑日。回顧這一週，寫下三件你注意到的改變——不管多小都算。',
  '["這一週你最大的改變是什麼？", "你覺得對方有注意到你的不同嗎？"]',
  '{"milestone": "week1", "milestone_message": "🎖️ 解鎖「關係觀察者」徽章！你已完成第一週，這不是小事。"}'),

(8, '一次搞懂 N 型和 S 型人性格需求', 'N 型直覺 vs. S 型感官', '一次搞懂 N 型和 S 型人性格需求',
  'S 型人活在具體的現在——他們相信眼睛看到的、手能摸到的。N 型人活在可能性裡——他們常常在想「如果...會怎樣」。這兩種思維在溝通時很容易錯過對方。',
  '今天觀察：當你們聊到未來或計畫時，對方是偏向具體細節還是大方向想像？今晚跟小羽說說你的觀察。',
  '["你今天觀察到對方是 N 型還是 S 型傾向？有什麼讓你這樣想？", "在你們的日常溝通中，這個差異在哪裡最明顯？"]',
  '{"n_need": "探索可能性、概念討論、想像未來", "s_need": "具體計畫、實際行動、當下感受"}'),

(9, 'Ne/Ni vs Se/Si 的應對策略', '揭密直覺與感官的深層差異', '揭密 Ne·Ni 與 Se·Si 的性格反差',
  'Ne（外向直覺）喜歡腦力激盪，跳躍式思考。Ni（內向直覺）傾向深度預測，專注核心洞察。Se（外向感知）活在當下刺激，行動導向。Si（內向感知）重視過往經驗，穩定可預測。',
  '今天練習用對方的語言溝通：如果他是 S 型，給一個具體例子；如果是 N 型，先說大方向。',
  '["你今天嘗試用對方偏好的方式說話了嗎？效果如何？", "這需要你做什麼調整？"]',
  '{}'),

(10, '主動讚美技術', '表達練習週開始', '整合應用',
  '有效讚美不是說「你好棒」，而是描述你具體看到了什麼。「我看到你昨天為了這件事忙到很晚，你真的很用心」——這種讚美讓對方感覺被真正看見。',
  '今天給對方一個「三層讚美」：說你看到的行為 + 你猜測他背後的用心 + 這對你的意義。',
  '["你今天的讚美對方有什麼反應？", "說出這種具體讚美，對你來說自然嗎？"]',
  '{"praise_format": "我看到你[具體行為]，我覺得你一定[背後用心]，這對我來說[意義]。"}'),

(11, '感謝的力量', '感謝 vs 讚美的差異', '整合應用',
  '感謝和讚美不同。讚美是「你做得好」，感謝是「你的存在讓我的生活變得不一樣」。感謝讓對方感受到他對你的價值，這是最深的連結之一。',
  '今天說一句真心的感謝。不是感謝他做了某件事，而是感謝他「是這樣的人」。',
  '["你說了什麼感謝？對方的反應是什麼？", "說出這句感謝時，你有什麼感覺？"]',
  '{}'),

(12, '表達需求，不是抱怨', '從抱怨到需求的轉換', '整合應用',
  '抱怨句：「你都不聽我說話。」需求句：「我需要你在我說話時，放下手機看著我。」把「你讓我不開心」轉換成「我需要什麼」，對方更能回應，也更不容易防禦。',
  '今天練習：把心裡一個抱怨，轉換成需求句說出來。格式：「我需要...，因為...」',
  '["你轉換後說出的需求句是什麼？對方怎麼回應？", "這種說法對你來說困難嗎？哪裡最難？"]',
  '{"complaint": "你都不XXX", "need": "我需要你XXX，因為這對我來說XXX"}'),

(13, '設定邊界', '健康邊界是關係的保護', '整合應用',
  '邊界不是牆，是門。健康的邊界讓兩個人都有空間做自己，又能選擇靠近彼此。設定邊界不是拒絕，而是保護關係長久。',
  '今天說出一個你的邊界：「這件事對我來說很重要，我需要...」讓對方知道你在乎什麼。',
  '["你設定了什麼邊界？怎麼說的？", "對方的反應是什麼？你感覺如何？"]',
  '{}'),

(14, 'Week 2 里程碑', '語言轉化師成就解鎖', '第二週總結',
  '兩週了。你從觀察、傾聽，到開始練習說出感受、讚美、感謝、需求和邊界。這些都是關係裡最重要的溝通技能。你還在路上。',
  '今天回顧第二週：你最大的突破是什麼？說一件讓你驚訝的事。',
  '["這一週你最驚訝的一個改變是什麼？", "還有什麼你想繼續練習的？"]',
  '{"milestone": "week2", "milestone_message": "🏅 解鎖「語言轉換師」徽章！你已掌握關係溝通的基本語言。"}'),

(15, '衝突是關係的測試，不是終點', '健康衝突的定義', '進階應用',
  '衝突不代表關係壞了，而是代表兩個人都在意這段關係。健康的衝突是：你們吵的是事情，不是互相攻擊對方的人格。衝突後的修復，比沒有衝突更能建立信任。',
  '今天準備一個衝突修復工具：當你們下次有摩擦，你會先說什麼？準備好你的「開場白」。',
  '["你準備的開場白是什麼？", "想到最近一次衝突，現在回頭看，你覺得可以怎麼不同？"]',
  '{}'),

(16, '修復的藝術', '衝突後如何重建連結', '進階應用',
  '修復步驟：1. 冷靜後主動靠近 2. 說出你的感受（不是指責）3. 問對方的感受 4. 找到一個共識。修復不需要分出對錯，需要的是兩個人都感覺被理解。',
  '今天試著主動發起一次「修復性對話」——可以是最近的小摩擦，或者說一句「謝謝你包容我上次的脾氣」。',
  '["你嘗試了修復性對話嗎？發生了什麼？", "主動靠近的感覺怎麼樣？"]',
  '{}'),

(17, '情感帳戶', '存款與提款的平衡', '進階應用',
  '情感帳戶像是銀行存款：每次讚美、傾聽、支持是存款；每次指責、忽略、失信是提款。當帳戶餘額足夠時，偶爾的提款（衝突、壞心情）不會讓關係破產。',
  '今天做一筆「存款」：一個小行動，讓對方感覺被重視。不需要大，一杯水、一條訊息都算。',
  '["你今天做了什麼存款行動？", "你覺得你們現在的情感帳戶餘額怎麼樣？"]',
  '{"deposit": "讚美、傾聽、支持、驚喜、記得重要的事", "withdrawal": "指責、忽略、失信、冷漠、批評"}'),

(18, '習慣地圖', '找到你的練習節奏', '進階應用',
  '習慣建立需要找到屬於你的觸發點。「每次我們吃晚餐，我就問他今天一件開心的事」——把練習綁定在已有的習慣上，比憑意志力更容易持續。',
  '今天設計你自己的「關係習慣」：選一個你每天都做的事，在那個時候加入一個關係練習行動。',
  '["你設計的關係習慣是什麼？", "你覺得這個習慣對你來說能持續嗎？"]',
  '{}'),

(19, '給關係寫一封信', '把心裡話說出來', '進階應用',
  '有些話說不出口，但寫下來就能說清楚。今天，給這段關係寫一封信——說你感謝的、說你期待的、說你承諾的。不一定要給對方看，但寫的過程本身就有療癒力量。',
  '今天給這段關係寫一封信。方向：1. 我感謝你... 2. 我希望我們... 3. 我承諾... 寫完後，決定要不要分享。',
  '["你寫了什麼？願意跟小羽分享一段嗎？", "寫完後你有什麼感覺？"]',
  '{}'),

(20, '最後一哩路', '準備迎接第21天', '進階應用',
  '你快到了。這不是終點，而是一個新的起點。21天的練習建立了一個基礎，真正的改變在接下來的每一天繼續發生。',
  '今天回顧：從第1天到現在，你和這段關係有哪些最重要的改變？明天你會繼續帶著什麼？',
  '["這21天最大的改變是什麼？", "明天結束後，你最想繼續保持的一個習慣是什麼？"]',
  '{}'),

(21, '21天成果慶典', '幸福實踐者，你做到了！', '完整回顧',
  '你完成了21天的練習。你不只是學了技巧，你在練習一種生活方式——帶著覺察、帶著溝通、帶著愛去經營這段關係。這是幸福實踐者的樣子。',
  '今天是慶典日。做一件讓對方感受到你這21天改變的事——可以是一個行動、一句話、或者一份小禮物。',
  '["你今天為對方做了什麼？他的反應是什麼？", "21天後，你如何定義「幸福關係」？"]',
  '{"milestone": "day21", "milestone_message": "🏆 解鎖「幸福實踐者」徽章！你完成了21天的旅程，這是真正的改變。"}');
