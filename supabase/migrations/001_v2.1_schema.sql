-- ============================================================
-- v2.1 Schema Migration
-- ============================================================
-- 版本：2026-04-19
-- 分支：v2.1-course-update
-- 規格：docs/v2.1-course-spec.md §8
--
-- 用途：
--   1. 修改 journeys 表：支援同一 user 練習多輪
--   2. 新增 mbti_profiles：16 型人格「盲點/渴望/地雷/解鎖」對照
--   3. 新增 blindspot_taxonomy：5 種常見盲點定義 + 對應缺失技能
--   4. 新增 blindspot_records：學員被偵測到的盲點累積紀錄
--
-- 套用方式：
--   Supabase Dashboard → SQL Editor → New Query → 貼上全部 → Run
--
-- 可重跑：所有語句都使用 IF NOT EXISTS / ON CONFLICT，重跑安全。
-- ============================================================


-- ============================================================
-- 1. 修改 journeys 表：支援多輪練習
-- ============================================================

-- 1.1 移除 UNIQUE(user_id) 約束（讓同一 user 可以開多輪）
ALTER TABLE journeys DROP CONSTRAINT IF EXISTS journeys_user_id_key;

-- 1.2 新增 round_number 與 round_label 欄位
ALTER TABLE journeys
  ADD COLUMN IF NOT EXISTS round_number INT NOT NULL DEFAULT 1;

ALTER TABLE journeys
  ADD COLUMN IF NOT EXISTS round_label TEXT;

-- 1.3 既有資料：把現有記錄 round_number 設為 1（DEFAULT 已處理，顯式再跑一次保險）
UPDATE journeys SET round_number = 1 WHERE round_number IS NULL;

-- 1.4 新 UNIQUE 約束：(user_id, round_number) 避免同一輪號重複
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'journeys_user_round_unique'
  ) THEN
    ALTER TABLE journeys
      ADD CONSTRAINT journeys_user_round_unique UNIQUE (user_id, round_number);
  END IF;
END $$;


-- ============================================================
-- 2. mbti_profiles：16 型人格對照（盲點 / 渴望 / 地雷 / 解鎖）
-- 資料來源：docs/v2.1-mbti-16-types.md v0.2
-- ============================================================

CREATE TABLE IF NOT EXISTS mbti_profiles (
  mbti_type TEXT PRIMARY KEY CHECK (mbti_type ~ '^[EI][SN][TF][JP]$'),
  temperament TEXT NOT NULL CHECK (temperament IN ('NF', 'NT', 'SJ', 'SP')),
  core_tagline TEXT NOT NULL,
  blindspot TEXT NOT NULL,
  desire TEXT NOT NULL,
  landmine TEXT NOT NULL,
  unlock TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.1 Seed 16 types
INSERT INTO mbti_profiles (mbti_type, temperament, core_tagline, blindspot, desire, landmine, unlock) VALUES
  ('INFJ', 'NF',
    '安靜的理想主義者，看人看到骨子裡',
    '太快讀懂別人情緒，反而忽略自己也需要被理解；以為別人不懂他是「自己解釋不夠」',
    '被「看見」深層的自己——不只是表面體貼',
    '被當成萬能情緒處理器、被工具化、被要求「立刻開心一點」、被強迫社交過量',
    '一句「你不用解釋，我懂你為什麼在意」；給獨處恢復時間；讓他主導深度對話的節奏'),
  ('ENFJ', 'NF',
    '溫暖的帶頭人，全場的情緒都在他雷達上',
    '太會讀別人情緒，反而不承認自己的疲憊；容易過度付出到崩潰還責怪對方「沒感覺」',
    '有人「也」在乎他的感受——不要總是他在在乎所有人',
    '被冷處理、被指責「你都沒真的懂」、被晾在一邊看不到他的付出',
    '主動問「你今天呢？你自己還好嗎？」；具體指出他為大家做了什麼；讓他有機會被照顧'),
  ('INFP', 'NF',
    '內在價值強烈，柔軟但固執的理想主義者',
    '認為自己的感受太複雜、別人不懂，乾脆不說；誤以為沉默=保護關係',
    '被接納「真實的那個我」，包含矛盾、脆弱、不完美',
    '被當太敏感、被要求「現實一點」、被貼標籤、被在公眾場合逼表態',
    '「你的感受很重要，不管別人怎麼看」；不催促；給他獨處空間再回來'),
  ('ENFP', 'NF',
    '熱情、點子多、情緒起伏大的可能性追逐者',
    '開啟很多話題但少收尾；以為「熱情」就是最好的在乎方式，忽略對方可能需要穩定',
    '被看見靈魂深處，不只是被當「很有趣」「很會 high 場子」',
    '被潑冷水、被困在 routine、被說「你想太多」、被要求定下來卻不給理由',
    '陪他深談一個他真正在意的事；支持他的可能性而不急著收斂'),
  ('INTJ', 'NT',
    '遠見、系統化、獨立的策略師',
    '誤以為「直接講邏輯」=對別人好；不承認自己也需要情感交流，把脆弱視為弱點',
    '被當對等、被肯定見解——不是被「照顧」或「擔心」',
    '被情緒勒索、被打斷深度思考、被要求閒聊、被質疑能力但拿不出理據',
    '用邏輯討論他在意的事；尊重他的獨處時間；偶爾肯定他「看得比別人遠」'),
  ('ENTJ', 'NT',
    '目標導向、決策快、天生領導',
    '把「溝通」視為「解決問題」，忽略情感過程；用「效率」取代「在意」',
    '被認可能力；私下能有一個不用當領導、可以脆弱的空間',
    '被質疑判斷、被浪費時間、被無效會議、被挑戰權威卻沒理據',
    '肯定他扛起的責任；私下給他一個不用扛的空間；用具體結果佐證的讚美'),
  ('INTP', 'NT',
    '好奇、分析、理論探索的觀察者',
    '把情感問題當邏輯問題來解；不理解「情緒表達」有什麼「邏輯用途」',
    '有人懂他的「想法架構」，不只是想法的結論',
    '被要求立刻做情緒反應、被社交義務綁架、被打斷思考、被要求給「正確答案」',
    '讓他把想法講完不打斷；用好奇問「那個邏輯怎麼運作的？」；允許他靜默思考'),
  ('ENTP', 'NT',
    '點子工廠、辯論愛好者、挑戰既有規則',
    '以為「辯論=關心」；沒意識到對方被他辯得很累，以為這只是腦力激盪',
    '有人能接他的跳躍思考並回辯，而不是被「嚇到」或「當敵意」',
    '被限制、被強迫執行無聊規則、被要求定下來、被指責「太愛抬槓」',
    '願意跟他玩概念辯論；給他空間瘋一下想法；認真回應他最「離譜」的點子'),
  ('ISTJ', 'SJ',
    '責任、穩定、傳統的默默守護者',
    '以為「把事做好」就是愛的表現；不擅表達情感，以為做到位就等於說過了',
    '被肯定他的可靠；被看見他默默做了很多',
    '被臨時變動、被破壞規則、被指責「冷淡」、被要求即興',
    '具體肯定他做的事（「你每週都幫我…我都記得」）；給他計畫空間；尊重他的節奏'),
  ('ESTJ', 'SJ',
    '組織、效率、負責任的管理者',
    '把「管理」當「關心」，把「糾正」當「幫助」——以為幫你改錯就是愛你',
    '被尊重判斷、被認可扛起的責任；被明確告知你要什麼（他最怕含糊）',
    '被挑戰權威、被拖延、被含糊其辭、被無視他訂的規則',
    '肯定他扛的東西；明確告訴他你要什麼、什麼時候；不繞圈子'),
  ('ISFJ', 'SJ',
    '默默照顧、重視和諧的服務型人格',
    '覺得自己的需求不重要，習慣委屈；誤以為忍讓=愛。累到極限才會爆',
    '被「主動問」他的需求——不是要他開口才有回應',
    '付出被忽略、家庭衝突、被當作理所當然、被在外人面前批評',
    '主動問「你今天還好嗎？有什麼是你想要但沒說的？」；具體感謝他做的小事'),
  ('ESFJ', 'SJ',
    '熱心、社群黏著劑、在乎關係的照顧者',
    '用「多做一點」表達愛，然後自己累死並期待對方回報相同的量',
    '被同等方式回饋，不是被冷淡接受她的付出',
    '被孤立、被批評她照顧不夠好、被認為「太多事」',
    '主動回饋她做的事；表達「我感謝你」的具體版本（不是一句謝謝）'),
  ('ISTP', 'SP',
    '動手派、冷靜、實用主義的問題解決者',
    '以為「不說話」就是和平；情感交流覺得浪費時間',
    '被允許按自己步調，不被逼表達感受',
    '被追問感受、被規劃行程、被情緒勒索、被強迫社交',
    '一起做事（不一定要講話）；給他空間與工具；事情講重點、不囉嗦'),
  ('ESTP', 'SP',
    '行動派、當下最大、愛冒險的玩家',
    '用「刺激」代替「在乎」；不擅深度情感對話，以為活得精彩=對你好',
    '被當有趣的夥伴，不被當成「只會玩」',
    '被困住、被碎念、被規訓、被要求計畫長遠',
    '一起體驗；當下即時的讚美；讓他知道他帶給你的樂趣被看見'),
  ('ISFP', 'SP',
    '溫柔、價值觀強、美感敏銳的低調表達者',
    '內心很多感受但不善言辭，常被誤解為冷淡；不說不代表不在乎',
    '被讀懂那些「沒說出口的心意」',
    '被強迫表態、被批評沒主見、被在公眾場合施壓',
    '觀察他無言的付出並說出來（「我看到你幫我…」）；尊重他的節奏與空間'),
  ('ESFP', 'SP',
    '陽光、帶動氣氛、活在當下的溫度製造者',
    '用歡樂掩蓋深層情緒；以為「快樂」就等於「好」，不願承認脆弱',
    '當他低落時，有人不被嚇跑、還願意陪著',
    '被潑冷水、被批評「膚淺」、被指責「只會玩」',
    '笑的時候一起笑，不笑的時候不逃；肯定他帶來的溫度；允許他偶爾不開朗')
ON CONFLICT (mbti_type) DO UPDATE SET
  temperament = EXCLUDED.temperament,
  core_tagline = EXCLUDED.core_tagline,
  blindspot = EXCLUDED.blindspot,
  desire = EXCLUDED.desire,
  landmine = EXCLUDED.landmine,
  unlock = EXCLUDED.unlock,
  updated_at = NOW();


-- ============================================================
-- 3. blindspot_taxonomy：5 種常見盲點 + 對應缺失技能
-- 資料來源：docs/v2.1-course-spec.md §7.1 + §7.4
-- ============================================================

CREATE TABLE IF NOT EXISTS blindspot_taxonomy (
  code TEXT PRIMARY KEY CHECK (code ~ '^B[0-9]+$'),
  name TEXT NOT NULL,
  definition TEXT NOT NULL,
  missing_skills TEXT[] NOT NULL,
  typical_phrases TEXT,
  remediation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO blindspot_taxonomy (code, name, definition, missing_skills, typical_phrases, remediation) VALUES
  ('B1', '猴子給香蕉',
    '用自己想要的方式去給予對方（MBTI 錯配）',
    ARRAY['S2', 'S3'],
    'F 老公送 T 老婆一束花而不幫她解決問題',
    '重做 S2 翻譯練習 + 換 S3 表達方式'),
  ('B2', '假性 NVC',
    '用「我覺得你…」包裝的指責',
    ARRAY['S5'],
    '「我覺得你總是不在乎我」（實為評斷）',
    '重寫 NVC 四步驟'),
  ('B3', '解決模式',
    '對方要情緒共鳴，學員跳去給建議',
    ARRAY['S4'],
    '「那你應該…」「你可以試試…」',
    '在回應前加一句情緒共鳴'),
  ('B4', '反擊 / 辯解',
    '對方情緒上來時，學員先自我防衛',
    ARRAY['S1', 'S4'],
    '「我又沒有…」「是你先…」',
    '先收事實、接情緒，再回應'),
  ('B5', '逃避 / 冷處理',
    '用沉默或轉移話題回避對話',
    ARRAY['S1', 'S2', 'S3', 'S4', 'S5', 'S6'],
    '「算了」「再說吧」「我去忙了」',
    '回到「我在這」的最小技能（S3）')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  definition = EXCLUDED.definition,
  missing_skills = EXCLUDED.missing_skills,
  typical_phrases = EXCLUDED.typical_phrases,
  remediation = EXCLUDED.remediation;


-- ============================================================
-- 4. blindspot_records：學員盲點累積紀錄（Week 3 診斷來源）
-- ============================================================

CREATE TABLE IF NOT EXISTS blindspot_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID REFERENCES journeys(id) ON DELETE CASCADE NOT NULL,
  day_number INT NOT NULL,
  blindspot_code TEXT REFERENCES blindspot_taxonomy(code) NOT NULL,
  context_type TEXT NOT NULL CHECK (context_type IN ('morning', 'realtime', 'evening', 'onboarding')),
  trigger_snippet TEXT,
  ai_feedback TEXT,
  detected_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blindspot_records_journey
  ON blindspot_records(journey_id);

CREATE INDEX IF NOT EXISTS idx_blindspot_records_journey_day
  ON blindspot_records(journey_id, day_number);

CREATE INDEX IF NOT EXISTS idx_blindspot_records_code
  ON blindspot_records(blindspot_code);


-- ============================================================
-- 5. 驗證查詢（可選，跑完後手動執行確認）
-- ============================================================
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'journeys' AND column_name IN ('round_number','round_label');
-- SELECT COUNT(*) AS mbti_profile_count FROM mbti_profiles;     -- 應該是 16
-- SELECT COUNT(*) AS blindspot_count FROM blindspot_taxonomy;   -- 應該是 5
-- SELECT COUNT(*) AS record_count FROM blindspot_records;       -- 初始 0
