# 專案 Context 一頁速覽（PROJECT-CONTEXT.md）

> **這份文件的用途**：給未來的 AI 助理、新加入的工程師（如 Jeff）、或休假後回來的自己——3 分鐘進入狀況、不用從零問。
>
> **更新節奏**：每次有「重大里程碑」（新 Phase 完成、新人加入、stack 變動）才改、不是每天改。日常變動寫進 spec 的 §14 版本紀錄就好。
>
> **建立日**：2026-06-12｜**最後更新**：2026-06-12（OPENAI_API_KEY 事件後）

---

## 0. 一頁看懂

| 項目 | 內容 |
|---|---|
| 產品名 | **羽升幸福養成學苑** |
| 一句話定位 | 21 天 AI 陪伴的非暴力溝通（NVC）養成課程、給卡在伴侶/親子/職場關係的用戶 |
| 用戶輪廓 | **25–45 歲**、有伴侶 / 親子 / 職場溝通困擾、願意自我成長、不喜歡「速成法」、看重「心法 > 話術」 |
| **AI 互動核心** | **LEAD（引導）→ PROBE（探問）→ HOOK（鉤引）** 三段式 — 詳見 §5.4 |
| **核心區隔** | 用戶**最終能自己解決**、不依賴諮商；**知識 → 技能 → 本能**、不停在「知道」 — 詳見 §5.4.4 / §5.4.5 |
| **技術護城河** | **三層記憶架構** — 小羽記得 21 天但 token 不隨天數成長（Day 3 與 Day 21 用量幾乎相同）— 詳見 §5.5 |
| **AI 教練名稱** | **小羽老師**（2026-06-14 拍板「小羽」→ 2026-07-08 Pearl Cover 定稿補「老師」尾綴、對外統一為「小羽老師」）— 對外用戶介面、所有 UI 文案、行銷素材**統一**用「小羽老師」；不再用「Angel」「Angel 老師」等其他名稱。內部技術文件（spec / code comment / Claude 助理協作）沿用「小羽」（不加老師、簡潔內部代號） |
| 商業模式 | 訂閱制（trial / basic / advanced / premium）+ 邀請碼制 onboarding |
| 當前狀態 | Phase 1A（訂閱系統）已完成、Phase 1B（紅陽金流串接）2026-06-12 交接 Jeff |
| 技術棧 | Next.js 14 + Supabase + Anthropic Claude（文字）+ OpenAI Realtime（語音、未上線） |
| Repo | https://github.com/SteveWeng1108/happy-relationship-app（branch: `main`） |
| 部署 | Vercel（Production: `happy-nuwa-app-v3.vercel.app`） |
| Spec 版本 | v1.4.x（記錄在 `docs/v2.1-course-spec.md`） |

---

## 1. 「閱讀順序」給新加入的 AI 或人

請依以下順序讀、別跳：

1. **這份**（PROJECT-CONTEXT.md）— 拿到全貌
2. **docs/v2.1-course-spec.md** — 產品的「憲法」、所有規則與紀律都在這
3. **docs/jeff-handoff-phase-1b.md** — 如果你要碰金流 / Phase 1B
4. **docs/admin-user-guide.md** — 後台怎麼用
5. **docs/user-guide-v1.md** — 使用者怎麼用
6. **docs/field-test-cases/** — 真實對話案例（理解 AI prompt 為何這樣寫）
7. **docs/product-positioning-v0.1.md** + **positioning-v0.4-升維-stack.md** — 商業策略
8. **src/lib/ai/buildContext.ts** — AI prompt 主檔（**Steve 的個人手工活、Jeff 別動**）

---

## 2. Tech Stack & 關鍵 dependencies

```
Next.js 14.2.29 (App Router + TypeScript)
React 18
Tailwind CSS（**無**其他 UI library、請勿擅自加）
Supabase (PostgreSQL + Auth + JSONB)
@anthropic-ai/sdk ^0.39.0     ← 文字模式 AI
@supabase/supabase-js ^2.49.4
jose ^5.10.0                  ← JWT 處理
framer-motion ^12             ← 動畫
react-markdown + remark-gfm   ← spec viewer
lucide-react                  ← icon
```

**外部服務**：
- **Anthropic Claude**（已用、付費）— 文字模式 AI Tutor
- **OpenAI Realtime API**（已連、按鈕隱藏中）— 未來語音模式、model 用 `gpt-realtime`
- **紅陽金流**（Phase 1B 待串）— PCI-DSS 規範、卡號永遠不入庫
- **Vercel**（部署）
- **Supabase**（DB + Auth）

---

## 3. 專案結構地圖

```
happy-nuwa-app-v21/
├── src/
│   ├── app/
│   │   ├── (使用者頁面)  /chat /progress /settings /onboarding
│   │   ├── admin/        後台 10 個 module
│   │   └── api/
│   │       ├── ai/       AI 對話端點（consultant、chat）
│   │       ├── admin/    後台 API
│   │       ├── billing/  訂閱 / 用量
│   │       ├── realtime/ 語音 session
│   │       └── auth, day, journey, progress, user, conversation
│   ├── lib/
│   │   ├── ai/
│   │   │   ├── buildContext.ts    ★ AI prompt 主檔（核心 IP、Steve 親自維護）
│   │   │   └── (其他 prompt 組件)
│   │   ├── billing/
│   │   │   ├── plans.ts           訂閱方案定義
│   │   │   └── quotas.ts          quota 檢查與記錄
│   │   └── supabase/
│   ├── components/
│   │   └── UsageChip.tsx          chat header 用量顯示
│   └── hooks/
│       └── useRealtimeVoice.ts    語音 hook
├── supabase/migrations/   12 個 migration、最新 012_subscription_system.sql
├── docs/                  所有規格、手冊、case study
├── scripts/seed-test-users.mjs
├── next.config.js         有 outputFileTracingIncludes（讓 docs/ 進 serverless bundle）
└── .env.local             ⚠️ 不入 git
```

---

## 4. 環境變數（.env.local + Vercel）

| 變數 | 用途 | 注意 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | — |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 前端 key | — |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 後端 key | 🚨 不可洩漏 |
| `ANTHROPIC_API_KEY` | Claude API | 開頭 `sk-ant-...` |
| `OPENAI_API_KEY` | OpenAI API | 開頭 `sk-proj-...` 或 `sk-...` |
| `OPENAI_REALTIME_MODEL` | （optional）覆寫 model | 預設 `gpt-realtime` |
| `OPENAI_REALTIME_VOICE` | （optional）覆寫音色 | 預設 `marin` |
| `BILLING_ENFORCEMENT` | 訂閱系統是否強制執行 | `true` / `false`、Phase 1B 啟用 |
| `JWT_SECRET` | 簽 JWT 用 | 32 字以上隨機字串 |

**血淚教訓（2026-06-12 OPENAI_API_KEY 事件）**：
- Vercel 上設環境變數時、**值貼錯**是真會發生的事（曾把 Anthropic key 貼到 OPENAI 那欄）
- 未來可加 `src/lib/env-validate.ts` 在 startup 檢查 prefix（`sk-ant-` vs `sk-proj-`）
- 改 env var **不會自動 redeploy**、要手動 trigger
- 驗證 key 用 `curl https://api.openai.com/v1/models -H "Authorization: Bearer sk-..."`

---

## 5. 規範與紀律（不可違反）

### 5.1 程式碼層級

- **無新 UI library**：除 Tailwind 外、不加 daisy / shadcn / Chakra 等。要加先問 Steve。
- **無 SQL 直接執行**：AI 只能寫 migration 檔、Steve 自己在 Supabase 跑。
- **commit 紀律**：
  - AI **不可擅自 commit / push**、只 stage 並描述 diff
  - **不跳 git hook**（`--no-verify`）
  - 不 force push 到 main
  - 不改 git config
- **AI prompt 是 Steve 的手工活**：`src/lib/ai/buildContext.ts` 是核心智財、Jeff 與其他工程師**不應修改**

### 5.2 安全層級

- **PCI-DSS（Phase 1B 金流）**：卡號**永遠不入 DB、永遠不入 log**。紅陽走 token 化、後端只存 token。
- **Trade Secret 防護**：`/admin/spec` 與 `/admin/prompts` 頁面有 admin role 檢查、AI prompt 不對一般用戶外洩
- **audit_logs**：所有 admin 動作（改訂閱、改邀請碼、改 spec）都進 audit log
- **invite code**：production 用 `NUWA-XXXX-XXX` 格式、test 用 `NUWA-TEST-XXX`

### 5.3 設計哲學（兩條 CSF、寫進 spec §1.5）

1. **Critical Few**：每天只練 1-3 件最重要的事、不貪多
2. **慢就是快**：21 天節奏不能塞滿、用戶要有「呼吸 + 反思」空間

### 5.4 AI Tutor 三段式核心：**LEAD + PROBE + HOOK** ⭐

> 這節是整個產品的**靈魂**、若只能讀一節、就讀這節。
> 這也是整個 AI Tutor（小羽）對話設計的**主架構**、寫死在 `src/lib/ai/buildContext.ts` 的 `LEAD_PROBE_SOP_BLOC` 裡。

#### 5.4.1 三段式速覽

| 階段 | 中文 | AI 在做什麼 | 用戶感受 |
|---|---|---|---|
| **LEAD** | 引導 | 用一個貼近用戶情境的開場、把對話**主動帶進來** | 「她懂我在哪、不是 robot」 |
| **PROBE** | 探問 | 用**精準的多回合提問**、抽絲剝繭往下挖掘 | 「ㄟ我才發現原來是這樣」 |
| **HOOK** | 鉤引 | 用 benefits / issues 像**魚餌釣魚**、引起用戶想試 MBTI / NVC 21 天 | 「我想趕快試試看」 |

#### 5.4.2 每段背後的深層設計

**🧭 LEAD（引導）**

AI **主動**帶用戶進入對話、不被動等用戶開口。
- 不冷、不疏離、不像客服
- 用「貼近用戶情境的開場」建立信任感

**🔍 PROBE（探問）— 這是技術含量最高的一段**

像三種專業角色的綜合體：

| 對標 | 在做什麼 |
|---|---|
| **薩提爾「冰山理論」** | 挖出冰山**下**的真正想法、情緒、需求、渴望 |
| **中醫問診辨症** | 一問一答、一層一層往下、找出真正的「病因」（盲點） |
| **諮商師 / 催眠師** | 多回合、漸進式深入、不一次到底、讓用戶**自己看見** |

**核心動作**：drill down 抽絲剝繭、不是一次性提一個大問題、而是**多回合**逐層接近真相。

**🪝 HOOK（鉤引）— soft sell, not hard sell**

這是「**銷售術語**」、但用的是 **soft selling / pull**、不是 hard selling / push。

| 不是 | 而是 |
|---|---|
| ❌ 強迫推銷「來上 21 天課」 | ✅ 用 benefits / issues 像**魚餌** |
| ❌ Push「快買快買」 | ✅ Pull、引起**高度興趣與好奇** |
| ❌ 讓用戶覺得被推銷 | ✅ 讓用戶**自己想**衝動急迫來 try |

#### 5.4.3 為什麼這三段缺一不可

- **沒有 LEAD** → 用戶覺得 AI 不懂我、冷、走人
- **沒有 PROBE** → 對話停留表層、用戶沒看見自己冰山下的盲點、沒洞察
- **沒有 HOOK** → 一次性解決暫時問題、用戶**依賴諮商**、無法**自己賦能**

#### 5.4.4 產品根本區隔（vs 傳統諮商 / 傳統課程）

| 別人在做 | 我們在做 |
|---|---|
| **傳統諮商**：解決一次性問題、用戶**依賴**諮商師 | 21 天系統化學習+刻意練習、用戶**最終自己能解決** |
| **傳統線上課程**：只傳遞知識、停留在「知道」 | 知識 → 技能 → **本能**反應 |
| **一次性洞察** | **累積式養成** |
| 表面式一句話安慰 | **有系統**的深層轉化 |

#### 5.4.5 哲學基礎：知道 ≠ 做得到

> **大部分課堂或視頻課程、只完成「傳遞知識」、缺乏「不斷的刻意練習」。
> 沒有刻意練習、知識永遠不會變成技能、更不會變成慣性的「本能」。**

我們的設計三步驟：

```
知識傳遞  →  刻意練習  →  慣性本能
（知道）    （做得到）    （不用想就會做）
```

**以終為始**：學習最終的目的是「**用得出來、用得對、用得好**」。

#### 5.4.6 教育創新願景

這套（**AI Lead + 結構化 Probe + Soft Hook + 21 天刻意練習**）不只是我們的產品方法、而是：

> 🌱 **未來所有教育學習、都應該採用的方式 —— 更快速、效果更大、以終為始。**

這是 Steve 對教育的長期信念、也是這個產品想驗證的命題。

#### 5.4.7 相關 BLOC（在 `buildContext.ts`）

```
LEAD_PROBE_SOP_BLOC      ← 主規範（三段式 SOP）
SOFT_LANDING_BLOC        ← Mode B 前 N 輪用日常語言、不馬上 MBTI / NVC 術語
MODE_A_LOCK_BLOC         ← Mode A（學）的紀律
MODE_B_LOCK_BLOC         ← Mode B（諮詢師）的紀律
```

#### 5.4.8 關鍵紀律（踩坑學到）

- Mode B（諮詢師）的**前幾輪要 soft landing**、不要直接砸 MBTI 術語或 NVC 公式（用戶會嚇跑）
- LEAD 階段**禁止幻覺虛構**：不能編造用戶沒講過的事
- HOOK 階段要鉤**當天的**心法、不要鉤錯日
- Mode A 與 Mode B 是**跨 tab 獨立紀律**：B 的對話不能污染 A 的學習脈絡（反之亦然）

**真實案例**：`docs/field-test-cases/` — 每個案例都對應一條規範學到的教訓。

### 5.5 三層記憶架構 — 小羽為什麼記得住 21 天 ⭐⭐⭐

> **這是我們的 key competitive advantage 之一。**
> 「AI 陪你 21 天」聽起來簡單，但技術上真正的難題是：
> Day 15 時，小羽要怎麼記得前面 14 天？
>
> 天真解法是把所有對話塞進 prompt —— 那會在 Day 21 時燒掉 6 萬字 token，
> 而且效果**更差**（見下方「為什麼壓縮比塞更多有效」）。

#### 5.5.1 架構總覽

| 層 | 內容 | 保存位置 | 送進 prompt 的量 |
|---|---|---|---|
| **L1 短期** | 當天逐字對話 | `conversations`（一天一筆） | 最近 20 則 |
| **L2 中期** | 每日記憶摘要（5 欄位） | `daily_memories`（一天一筆） | **最近 3 天** |
| **L3 長期** | 盲點記錄 | `blindspot_records` | 最近 30 筆、**聚合成統計** |

**關鍵：Day 3 與 Day 21 的 token 用量幾乎相同**，不隨天數線性成長。

#### 5.5.2 L1 短期記憶 — 當天逐字

`src/app/api/ai/chat/route.ts`：

```js
.from('conversations')
.eq('journey_id', journey.id)
.eq('day_number', dayNumber)     // ← 只撈「今天」這一筆
...
messages.slice(-20)               // ← 且只送最近 20 則
```

Day 15 的 API call **完全看不到** Day 1–14 的逐字紀錄。

#### 5.5.3 L2 中期記憶 — 每日摘要（核心設計）

**寫入**：每天晚上按「完成今日」後，`src/lib/ai/extractMemory.ts` 背景跑**一次額外的 AI 呼叫**（Sonnet、max_tokens 500），把當天對話壓成 5 個欄位：

```json
{
  "emotion_note": "今天情緒偏積極，有嘗試新方法",
  "task_result": "完成 + 簡述",
  "partner_obs": "對方今天的反應或觀察",
  "key_insight": "學員今天最重要的一個洞察或成長",
  "follow_up": "明天需要追蹤的一件事"
}
```

存進 `daily_memories`，**一天約 100 字**。失敗時有 fallback 預設值，不拋錯、不擋主流程。

**讀出**：`buildContext.ts` 只取最近 3 天：

```js
.from('daily_memories')
.order('day_number', { ascending: false })
.limit(3)
```

`formatMemories()` 格式化後長這樣（總共約 200 字）：

```
Day 14：情緒偏積極。發現自己一直在替她做決定（待追蹤：週末那次對話）
Day 13：有點挫折。第一次講出「我需要」而不是「你應該」
Day 12：平穩。開始能分辨事實與評論
```

#### 5.5.4 L3 長期記憶 — 盲點統計

撈 30 筆 `blindspot_records`，但**不逐筆送**，`formatBlindspotHistory()` 先聚合：

```
累積盲點：B03×7、B01×4、B05×2
最近 3 次：
  Day 14 B03：「他就是不聽我說」
  Day 12 B01：「我已經很努力了」
  Day 09 B03：「她應該要知道啊」
```

30 筆 → 壓成 **6 行**。

#### 5.5.5 Token 帳

| | 天真做法 | 我們的做法 |
|---|---|---|
| Day 15 送進去的量 | 15 天 × 20 則 × 200 字<br>**≈ 60,000 字** | 當天 20 則 ~4,000 字<br>+ 3 天摘要 ~200 字<br>+ 盲點統計 ~100 字<br>**≈ 4,300 字** |
| 成長曲線 | 隨天數**線性成長** | **平的** |

差距約 **14 倍**，且 Day 21 時差距更大。

#### 5.5.6 為什麼壓縮比塞更多**有效**（不只是省錢）⭐

這是最重要的一段 —— 三層架構不是妥協，是**設計上更正確**：

**① 對抗 attention dilution**
LLM 在長 context 有「lost in the middle」問題，資訊在中段最容易被忽略。
60,000 字裡的 Day 7 洞察會被淹沒；`key_insight` 是**已萃取的結論**，直接進 prompt 高權重位置。

**② 摘要即抽象**
「Day 13 第一次講出『我需要』而不是『你應該』」—— 這句話**原始逐字稿裡沒有**，
是 AI 從當天對話判斷出來的成長訊號。塞逐字稿反而丟失這層抽象。

**③ `follow_up` 是主動記憶**
AI 自己決定「明天要追蹤什麼」，隔天讀到會主動問。
這是**有意圖的記憶**，不是被動翻資料。

**④ 盲點頻次 > 盲點內容**
`B03×7` 這個數字，逐字稿看一百遍也算不出來。
這是把非結構化對話轉成**結構化訊號**，讓 AI 能判斷「這是慣性模式，不是偶發」。

> 呼應 §5.4.2 PROBE 的設計目標：小羽要能像中醫「辨症」一樣認出**反覆出現的模式**，
> 而不是逐句回顧。三層記憶架構正是為此服務。

#### 5.5.7 已知取捨（誠實記錄）

**代價**：Day 15 時，小羽對 Day 5 的細節只剩當初萃取的 5 個欄位，逐字內容不在視野裡。

若用戶問「你記得我 Day 5 講的那個機場的事嗎？」，小羽會答不上來 ——
除非那件事當初被寫進 `key_insight`。

**為什麼可接受**：從 Angel / Pearl 的真實軌跡看，她們的突破不是靠「AI 記得某句話」，
而是靠**累積的模式辨識**（B03 出現 7 次 → 這是慣性 → 值得深挖）。架構對準了真正有效的那件事。

**未來若要補**：可考慮加向量檢索（RAG）讓 AI 在需要時撈回特定逐字片段，
但這會增加複雜度與延遲，目前沒有證據顯示必要。

#### 5.5.8 相關檔案

| 檔案 | 角色 |
|---|---|
| `src/lib/ai/extractMemory.ts` | L2 摘要萃取（晚間背景執行） |
| `src/lib/ai/buildContext.ts` | 三層組裝、`formatMemories()` / `formatBlindspotHistory()` |
| `src/app/api/ai/chat/route.ts` | L1 當天對話撈取 + `slice(-20)` |
| `src/app/api/day/complete/route.ts` | 觸發 `extractDailyMemory()` |
| DB：`daily_memories` | L2 儲存（`journey_id` + `day_number` 唯一） |
| DB：`blindspot_records` | L3 儲存 |

---

## 6. Steve 的工作習慣 / 偏好

### 6.1 語言與風格

- **繁體中文**（不用簡中）
- 技術術語可保留英文（API、deploy、env var、prompt 等）
- **emoji 適量用**：在能比文字更精準傳達情緒 / 狀態 / 視覺分區時用（例如 ✅ ❌ 🚨 🎯 🟢🟡🔴）、不要堆砌
- markdown table 與 bullet list 接受度高、複雜資訊優先用 table
- 喜歡「先給結論、再展開細節」
- 喜歡「明確的下一步行動」、不要含糊收尾

### 6.2 協作節奏

- 喜歡先看「規格 / 設計文件」、確認方向後才寫 code
- 重大改動前會問「這樣做對嗎？」、希望 AI 給建議而非默默改
- 一次 session 處理「**一件事 + 順手做的小事**」、不貪多
- 卡關時直接說「我卡住了」、希望 AI 給選項 A/B/C 而不是繼續推

### 6.3 不喜歡的事

- AI 擅自 commit（即使覺得安全）
- AI 自行決定刪除檔案
- AI 假裝執行了某個動作（例如「我已 run SQL」實際只是寫了 SQL）
- AI 給含糊「應該可以喔」式答案、希望要 **verified / unverified** 標明

### 6.4 決策互動模式

當 AI 不確定時、希望這樣呈現：
```
A. 推薦做法（理由）
B. 替代做法（理由）
C. 不做（理由）
建議：A、因為 XXX
要 A 還是 B？
```

---

## 7. 已完成 / 進行中 / 待辦

### ✅ 已完成（截至 2026-06-12）

- **Day 0 onboarding**（8 bug fix、多輪對話、心法預告）
- **21 天課程內容**（Week 1-3 完整改版至 v1.4）
- **AI Tutor**：Mode A（學）+ Mode B（諮詢師、漸進式 soft hook）
- **MBTI 翻譯引擎**（內部使用、不外顯）
- **後台**：10 個 admin module（Course Content edit / Settings / Spec viewer / Prompts viewer / Invite Code / Subscriptions / Usage / Users / Audit logs / Stats）
- **訂閱系統 Phase 1A**：plan_tier、quotas、usage logs、admin 管理介面、user 自助頁
- **AI prompt 紀律**：Mode A/B cross-tab 獨立、SOFT_LANDING_BLOC override、3 條 parallel routing
- **環境變數修復**：OPENAI_API_KEY 誤填事件已解（2026-06-12）

### 🔄 進行中

- **Phase 1B：紅陽金流串接**（Jeff 接手、2026-06-13 啟動）
  - 詳見 `docs/jeff-handoff-phase-1b.md`
  - 5 個 block：紅陽串接 / Trial 自動轉付費 / 升降級取消 / 失敗重試 / 啟動

### ⏳ 待辦（backlog）

- `src/lib/env-validate.ts`（startup 檢查 API key prefix）
- 8 個 npm vulnerabilities（等 Jeff Phase 1B 結束一起處理、避開 Next 14→15 風險）
- W3 §4.5 D15-D21 三級分層補完（待 W3 self-test 後做、spec v1.1.2 patch）
- positioning v0.2 §3 三層定價擴充
- 語音模式（按鈕已隱藏、key 已就位、需 UI 重啟 + 上線測試）

---

## 8. 角色與聯絡人

| 角色 | 人 | 負責 |
|---|---|---|
| Owner / Product / AI prompt | **Steve**（steveweng7@gmail.com） | 全局決策、AI prompt 維護、spec 修訂 |
| Backend / Payment（Phase 1B+） | **Jeff** | 紅陽串接、訂閱 lifecycle、bug fix |
| AI 協作者 | **小羽**（AI、Claude） | 對齊 spec、寫 code、不擅自 commit |

---

## 9. 常用指令

### 9.1 本地開發

```bash
npm install
npm run dev              # http://localhost:3000
npm run build            # 確認 production build 過
npm run lint
```

### 9.2 部署

```bash
# 推 main = 自動 deploy production
git push origin main

# Vercel CLI 也可
vercel --prod
```

### 9.3 環境變數驗證

```bash
# 測 OpenAI key 是否 valid
curl -s https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  | grep '"id"' | head -5

# 測 Anthropic key 是否 valid
curl -s https://api.anthropic.com/v1/models \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  | head -20
```

### 9.4 Supabase

- Dashboard：https://supabase.com/dashboard/project/[project-id]
- Migration 用 Supabase web UI 跑、**AI 不直接連 DB**
- 最新 migration：`012_subscription_system.sql`

### 9.5 Vercel logs

- Dashboard → Deployments → 點某筆 → **Logs** tab
- Runtime log 搜尋：`"invalid API key"` / `401` / 任何 error 關鍵字
- Build log 的 `DYNAMIC_SERVER_USAGE` 是 **無害的** Next.js 抱怨、可忽略

### 9.6 🚨 Vercel 沒有自動 deploy 的排查 SOP

> 來源：2026-07-26 事件——push 成功但 Vercel 完全沒動靜、查了一輪才找到兇手是
> **GitHub App 有待批准的權限請求**。這條 SOP 讓下次 5 分鐘內解決。

**依序檢查（由快到慢、由常見到罕見）：**

**① 確認 GitHub 真的收到**

```bash
git log --oneline -1 origin/main
```

顯示的 commit hash 要跟你剛推的一致。不一致 = push 沒成功（回頭看 push log）。

**② Vercel Deployments 的 Status 篩選器**

右上角 `Status x/7`——如果不是 `7/7`，`Building` / `Queued` 狀態可能被濾掉、
正在建置的 deployment 不會出現在列表。點開全部勾起來。

**③ ⭐ GitHub App 是否有待批准的權限請求（2026-07-26 的兇手）**

```
https://github.com/settings/installations
```

找 **Vercel** → **Configure** → 看 Permissions 區塊有沒有黃色橫幅：

> ⚠️ *Vercel is requesting an update to its permissions.* [Review request]

有的話 → 點 **Review request** → 批准。批准後空推一次觸發：

```bash
git commit --allow-empty -m "chore: trigger vercel rebuild"
git push origin main
```

**④ Repository access 範圍**

同一頁往下、**Repository access** 要是 `All repositories`，
或 `Only select repositories` 但清單裡有 `happy-relationship-app`。

**⑤ Vercel 端 git 連結**

Vercel Project → Settings → Git → 確認 Connected Git Repository 正確、且沒被 Paused。

---

**踩坑筆記：**

- GitHub **Settings → Webhooks 頁面空白是正常的**。Vercel 用的是 GitHub App
  （走 `settings/installations`），不是傳統 repo webhook。不要以為 webhook 不見了。
- `npx vercel --prod` 手動部署需要 CLI token，過期會噴
  `The specified token is not valid`，要先 `npx vercel login`（走 email 驗證）。
  但這只是繞路，**不解決 webhook 根因**。
- Vercel deployment 列表那筆右邊的 `⋯`（Redeploy 選單）要**滑鼠移到該列**才出現，
  且在最右邊、視窗太窄會被切掉。也可以點進 deployment 詳情頁，右上角同樣有 Redeploy。

---

## 10. AI 助理（小羽 / Claude）的工作守則

當你接手一個新 task、按以下流程：

1. **讀這份**（PROJECT-CONTEXT.md）建立大框架
2. **讀 spec 對應章節**（`docs/v2.1-course-spec.md`）
3. **如果碰 AI prompt**：先看 `field-test-cases/` 對應案例、理解規範背後的「為什麼」
4. **改動前先報告**：「我打算改 X、Y、Z、理由是 A、B、C、可以嗎？」
5. **改動後給 diff summary**：不要假裝執行了 git 操作、Steve 自己 commit
6. **遇到資安 / 金流相關**：要極度小心、寧可問也別擅自做
7. **遇到不確定**：用「A / B / C + 建議」格式呈現、讓 Steve 選

**禁止行為**：
- ❌ 擅自 `git commit` / `git push`
- ❌ 改 git config
- ❌ 跳 git hook
- ❌ 跑 destructive SQL（DELETE / DROP / TRUNCATE）
- ❌ 把 secret 寫進 code 或 log
- ❌ 修改 `src/lib/ai/buildContext.ts` 而沒明確被授權
- ❌ 給含糊的「應該可以」答案、要明確標 verified / unverified

---

## 11. 變更歷史的查詢路徑

不同層級的「歷史」放在不同地方、**別放錯地方**：

| 想找什麼 | 去哪 |
|---|---|
| 課程 / spec 的版本變動 | `docs/v2.1-course-spec.md` §14 版本紀錄 |
| 訂閱 / billing 改動 | `docs/jeff-handoff-phase-1b.md` |
| AI 對話真實案例 | `docs/field-test-cases/*.md` |
| 既有 archive | `docs/archive/` |
| code 改動 | `git log` |
| Migration 順序 | `supabase/migrations/` 檔名排序 |
| 這份 context 的更新 | 這份檔案開頭的「最後更新」欄 |

---

## 12. 給未來自己的提醒

寫這份文件當下、Steve 剛經歷：
- 一場 OPENAI_API_KEY 與 ANTHROPIC_API_KEY 混淆事件（已解）
- 連續多週的 5 個新 module + 訂閱系統 + AI prompt 改寫
- 明天（2026-06-13）要把 Phase 1B 交接給 Jeff

**心情筆記**：在這個時間點、Steve 重視「**穩定** > **新功能**」。

如果接手的 AI 看到這、請優先協助：
1. 穩住既有架構、別擅自重構
2. 讓 Jeff 順利接手
3. 文件化所有「曾經卡到 Steve」的 gotcha

不要：
1. 推銷新 framework / lib
2. 重寫 AI prompt（那是 Steve 的手工活）
3. 「優化」沒被要求的東西

---

> **這份是「活文件」**。如果你（未來的 AI 或人）讀完發現有過時、跟現況不符的地方、**請主動指出來、不要照舊版本做事**。
