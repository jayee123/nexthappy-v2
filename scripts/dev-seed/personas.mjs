/**
 * scripts/dev-seed/personas.mjs
 *
 * 合成測試資料的【情境定義】與文字素材。
 *
 * 這裡沒有任何真實用戶資料 —— 全部是為了覆蓋開發情境而手工設計的。
 * 挑選原則：不是「造幾筆資料」，而是「每個會讓 UI 或邏輯出錯的狀態都要有人踩到」。
 */

/** 課程總天數（見 migrations/003_v3.0_course_content.sql） */
export const TOTAL_DAYS = 21;

/** blindspot_taxonomy 的合法代碼（見 migrations/001_v2.1_schema.sql） */
export const BLINDSPOT_CODES = ['B1', 'B2', 'B3', 'B4', 'B5'];

/** conversations.context_type 的合法值 */
export const CONTEXT_TYPES = ['onboarding', 'morning', 'realtime', 'evening'];

/**
 * 測試人物。每一位都是為了「某個開發時會卡住的狀態」而存在，
 * why 欄位寫的就是「不放這筆會漏測什麼」。
 */
export const PERSONAS = [
  {
    key: 'trial_fresh',
    name: '測試用戶・全新',
    plan: 'trial',
    marketPlan: 'free',
    currentDay: 0,
    why: '剛 SSO 進來、user 層還沒有 MBTI。測 /sso 落在 /onboarding 這條路徑',
    journey: null,     // 沒有 journey
    // userMbti 也不給 —— 這位測的是「連 MBTI 都還沒有」。
    // 「有 MBTI 但沒 journey」是另一個狀態，見最後一位 onboarded_no_journey。
  },
  {
    key: 'basic_early',
    name: '測試用戶・初期',
    plan: 'basic',
    marketPlan: 'basic',
    currentDay: 3,
    why: '剛起步。測進度條低百分比、成就尚未解鎖',
    journey: { mbtiSelf: 'INFP', mbtiPartner: 'ESTJ', relationship: 'couple', confidence: 'medium' },
  },
  {
    key: 'advanced_mid',
    name: '測試用戶・進行中',
    plan: 'advanced',
    marketPlan: 'advanced',
    currentDay: 12,
    why: '最典型的使用中狀態。資料量最完整，日常開發主要看這筆',
    journey: { mbtiSelf: 'ENFJ', mbtiPartner: 'INTP', relationship: 'couple', confidence: 'high' },
  },
  {
    key: 'premium_done',
    name: '測試用戶・已完課',
    plan: 'premium',
    marketPlan: 'premium',
    currentDay: TOTAL_DAYS,
    why: '21 天全完成。測結業畫面、滿版成就、進度條 100% 不會溢位',
    journey: { mbtiSelf: 'ISTJ', mbtiPartner: 'ENFP', relationship: 'couple', confidence: 'high' },
  },
  {
    key: 'cancelled_mid',
    name: '測試用戶・已退訂',
    plan: 'cancelled',
    marketPlan: 'cancelled',
    currentDay: 8,
    why: '有資料但方案已失效。測額度擋人時舊資料還讀不讀得到',
    journey: { mbtiSelf: 'ISFP', mbtiPartner: 'ENTJ', relationship: 'couple', confidence: 'low' },
  },
  {
    key: 'edge_cases',
    name: '測試用戶・邊界值',
    plan: 'premium',
    marketPlan: 'premium',
    currentDay: 5,
    why: '專門放極端值：超長日記、emoji、單輪與超長對話、可為 null 的欄位全空',
    journey: {
      mbtiSelf: 'INTJ', mbtiPartner: null, relationship: 'workplace', confidence: 'low',
      nullOptionals: true, // goal_statement / initial_problem 留空
    },
  },
  {
    key: 'parent_child',
    name: '測試用戶・親子',
    plan: 'basic',
    marketPlan: 'basic',
    currentDay: 6,
    why: 'relationship_type 不是 couple。文案會依關係類型變化，只測 couple 會漏',
    journey: { mbtiSelf: 'ESFJ', mbtiPartner: 'ISTP', relationship: 'parent_child', confidence: 'medium' },
  },
  {
    key: 'onboarded_no_journey',
    name: '測試用戶・未開課',
    plan: 'basic',
    marketPlan: 'basic',
    currentDay: 0,
    why: '做完 onboarding（user 層已有 MBTI）但還沒開任何一輪。測 /chat 空狀態，以及 Mode B 不需 journey 也能用',
    journey: null,
    // journey 為 null 時 user 層 MBTI 要自己指定 —— 這位存在的意義就是
    // 「有 MBTI、沒 journey」這個組合。少了他，/chat 空狀態沒有人踩得到
    // （dev1 的 mbti_self 是 NULL，/sso 會把他攔在 /onboarding）。
    userMbti: { self: 'ENTP', confidence: 'medium' },
  },
];

/** 伴侶暱稱素材（明顯是假名，避免看起來像真人） */
export const PARTNER_NICKNAMES = ['測試對象A', '測試對象B', '小樣本', '範例夥伴', '示範同事', '樣板家人'];

/** 目標陳述素材 */
export const GOAL_STATEMENTS = [
  '希望吵架的時候可以先停下來，不要馬上回嘴。',
  '想練習把心裡的感受講出來，而不是等對方猜。',
  '希望每天至少有一次好好聽對方說完話。',
  '想找回剛在一起時那種可以聊很久的感覺。',
];

/** 初始問題素材（刻意寫得普通、不指涉任何具體個人） */
export const INITIAL_PROBLEMS = [
  '最近很常因為小事就吵起來，事後又想不起來到底在吵什麼。',
  '我講的話好像都傳不到對方那邊，久了就懶得講了。',
  '對方一沉默我就開始焦慮，然後講出更難聽的話。',
  '兩個人都很忙，回到家幾乎沒有交集。',
];

/** 日記素材（長度刻意不一，測換行與截斷） */
export const JOURNAL_TEXTS = [
  '今天試著在對話中停三秒再回應，感覺沒有想像中困難。',
  '早上出門前有好好說再見，是這幾週第一次。',
  '還是忍不住先講了道理，等到講完才發現對方只是想被聽見。今天算失敗，但至少我察覺到了。',
  '沒什麼特別的一天。',
  '照著今天的任務做了，但心裡其實有點抗拒，覺得這樣很刻意。不過做完之後氣氛真的有比較鬆一點，可能刻意也沒關係吧。明天再試一次看看。',
];

/** 對話素材：user 與 assistant 交替，內容貼近 LEAD → PROBE → HOOK 的節奏 */
export const DIALOG_PAIRS = [
  { user: '今天又吵架了，我真的不知道該怎麼辦。', ai: '聽起來今天不太好過。可以說說吵架前，最後一句話是誰講的嗎？' },
  { user: '我先講的，我說「你都不聽我說話」。', ai: '那句話說出口的時候，你心裡最想讓對方知道的是什麼？' },
  { user: '大概是……我覺得自己不重要吧。', ai: '「我覺得自己不重要」——這句話你有直接跟對方說過嗎？' },
  { user: '沒有，我講不出口。', ai: '講不出口的時候，通常會冒出什麼念頭擋住你？' },
  { user: '會覺得講了很丟臉，好像在討拍。', ai: '如果今天換成對方這樣對你說，你會覺得他在討拍嗎？' },
  { user: '不會啊，我應該會想抱抱他。', ai: '那你剛剛給自己的標準，跟給對方的標準，好像不太一樣。' },
  { user: '……真的耶。', ai: '今天的心法就在這裡：先把對自己的那套標準放鬆一點，話才出得來。' },
];

/** emoji 與長文邊界測試素材 */
export const EDGE_TEXTS = {
  emoji: '今天心情還不錯 😊 對方也笑了 🎉 想記錄一下這個瞬間 ✨💛',
  veryLong: '這是一段刻意寫很長的測試日記，用來確認前端的換行、截斷與捲動行為是否正常。'.repeat(12),
  single: '嗯。',
};

/** daily_memories 各欄素材 */
export const MEMORY_TEXTS = {
  emotion_note: ['比昨天平靜一些', '有點煩躁但有察覺', '情緒起伏不大', '早上很急，晚上緩下來了'],
  task_result: ['完成，但做得有點勉強', '順利完成', '只做了一半', '忘記了，晚上補做'],
  partner_obs: ['對方今天話比較多', '對方看起來有心事', '沒有特別觀察到什麼', '對方主動問了我一句'],
  key_insight: ['我太快想解決問題了', '沉默不一定是生氣', '我需要的是被聽見', '先處理心情再處理事情'],
  follow_up: ['明天試著只聽不回', '找機會說出今天的感受', '暫時不用做什麼', '提醒自己停三秒'],
};

/** blindspot_records 素材 */
export const BLINDSPOT_TEXTS = {
  trigger: ['你每次都這樣', '算了，不講了', '隨便你', '我早就說過了'],
  feedback: [
    '這句話把「這一次」變成了「每一次」，對方會覺得被否定整個人。',
    '停止對話會讓問題留在原地，也讓對方猜不到你的需要。',
    '這是放棄溝通的訊號，但對方可能解讀成不在乎。',
    '強調自己是對的，會讓對方把注意力放在防禦而不是理解。',
  ],
};
