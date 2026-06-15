# Architecture Phase 2 Proposal — Trier-first Onboarding + History Retention + PDF Export

- 版本：**v0.1**
- 日期：2026-05-19
- 狀態：Strategic memo（post-demo articulation、待 implementation kickoff）
- 來源：Steve 2026-05-19 post-demo 4 條 architectural insights articulation
- 影響範圍：onboarding flow / DB schema / UI sidebar / PDF export / spec §2/§8/§13/§15/§16
- 前置依賴：v3.0 Phase 1 收尾完成（v1.2.2 spec + Mode B routing 穩定 + MBTI 字母防漂）

---

## TL;DR

v3.0 Phase 1 把 Mode A（21 天）+ Mode B（諮詢）兩個 mode 的內容跑通了，但 **onboarding flow 是 founder-think 不是 user-think**——強迫 new user 在進 mode 前完成 5 步 Day 0 設定，違反 SaaS funnel「low-friction try → trust → high-commitment buy」黃金法則。多數 new trier 不會直接 commit 21 天、而是先試 Mode B（light）、有 value 才走 Mode A（heavy）。

**Phase 2 四條 architectural shifts**：
1. **P0** — Onboarding flow 重構：MBTI + 暱稱共用 onboarding（≤2 步）→ 主畫面 mode 選擇 → mode-specific setup（Mode A 才填對象關係 / 對象 MBTI / 目標 / 任務稱呼）
2. **P0** — Mode B 命名拍板：「**我卡住了，幫我拆**」（取代「跟諮詢師對話」「我有困擾請幫我分析」）
3. **P1** — Sidebar 歷史對話 retention：21 天多 round 任務列表 + Day 1-21 navigation；諮詢主題列表 + 完整對話回看
4. **P2** — PDF export：每天 / 每主題完整對話下載

總工作量：**~5-8 天 code**。

---

## 0. 背景：產品哲學轉折（Founder-think → User-think）

### 0.1 原設計假設（v3.0 Phase 1 之前）

> User 是「**Learner**」、有強烈學習動機、進來就 commit 21 天刻意練習。

→ Onboarding 設計：登入 → Day 0 5 步驟設定（認識小羽 / 關係 / 對象暱稱 / 對象 MBTI / 目標）→ 開始 Day 1。

### 0.2 真實 user behavior（post-demo 觀察）

> 多數 new user 是「**Trier**」、對產品價值不確定、想先試 light 版驗證、有感才 commit heavy 版。

→ 新 user 心智：「**先試試這個 AI 能不能幫我解決一個困擾、再決定要不要 commit 21 天**」。

### 0.3 對應 SaaS 黃金法則

| 維度 | Founder-think（原設計）| User-think（Phase 2 新設計） |
|---|---|---|
| 第一次體驗門檻 | 5 步驟 Day 0（高 friction） | MBTI + 暱稱 ≤2 步（低 friction） |
| Funnel 順序 | **force commit → try** | **try → trust → commit** |
| User 心智假設 | 「我要學 21 天」 | 「先試試這個能不能幫我」 |
| 流失點 | onboarding 棄置（5 步太多） | 諮詢 → 21 天 conversion（自然） |
| 商業思維 | 賣訂閱 | 賣價值 → 訂閱跟著來 |

→ 這條 insight 不只是 UX patch、是**整個產品定位的 funnel 重設計**。

---

## 1. P0 — Trier-first Onboarding Flow 重構

### 1.1 新 Flow 全景

```
登入後
   ↓
[ 共用 Onboarding ]（一次性、跨 mode、≤2 步）
   ┌────────────────────────────────────────┐
   │ Step 1：認識小羽 + 你的 MBTI            │
   │   - 你的 4 字母 MBTI（global 共用）     │
   │   - 不確定？4 題小測 or 「先猜一個」    │
   │ Step 2：你想被怎麼稱呼？（optional）    │
   └────────────────────────────────────────┘
   ↓
[ 主畫面 — 兩個 mode tab ]
   ┌─────────────────────┬─────────────────────┐
   │ 🌱 21 天刻意練習    │ 🤝 我卡住了，幫我拆 │
   │  （heavy commit）   │   （light try）     │
   └─────────────────────┴─────────────────────┘
              ↓                       ↓
   ┌─────────────────────┐   ┌─────────────────────┐
   │ Mode A onboarding   │   │ 直接進對話            │
   │ （only when chosen）│   │ 對方資訊由 AI         │
   │  - 對象關係         │   │ 在 chat 中問取        │
   │  - 對象暱稱         │   │ （Mode B 既有方法論）│
   │  - 對象 MBTI        │   │                       │
   │  - 目標             │   │                       │
   │  - 任務稱呼         │   │                       │
   │       ↓             │   │                       │
   │   Day 1 開始        │   │                       │
   └─────────────────────┘   └─────────────────────┘
```

### 1.2 為什麼 MBTI 必須抽到共用 onboarding（不只是 Mode A 設定）

兩個理由：

**理由 1：MBTI 是 user 本質屬性、不是某段關係的屬性**
- 一個 user 跟伴侶、跟孩子、跟同事所有對話都共用「我自己的 MBTI = X」
- 寫進 `journeys.mbti_self` 是 schema 設計錯誤（耦合 user 與 relationship）
- 應寫進 `users.mbti_self`（global、永久、跨 mode 共用）

**理由 2：21 天可以多 round、第 2 round 重填 MBTI 是 redundant + risk inconsistent**
- 第 1 round 填 ENFJ、第 2 round 不小心填 ENTJ → AI 行為混亂、user 困惑
- v1.2.0 USER MBTI GROUND TRUTH bloc 已假設 user MBTI 是 stable ground truth、與 user table 對齊更乾淨

**第 3 個附加好處**：Mode B 諮詢也直接受惠——v1.2.0 ground truth bloc 從 `users.mbti_self` 拉（不是 `journeys.mbti_self`）、消除「user 在 Mode B 沒 journey」的 edge case。

### 1.3 DB Schema 變動

```sql
-- 新增 users.mbti_self（global ground truth）
ALTER TABLE users
  ADD COLUMN mbti_self TEXT,
  ADD COLUMN mbti_confidence TEXT DEFAULT 'medium'
    CHECK (mbti_confidence IN ('low', 'medium', 'high'));

-- journeys.mbti_self 變成 optional override（罕見場景：user 在不同關係下覺得自己呈現不同）
-- 預設行為：journey.mbti_self IS NULL → fallback to users.mbti_self
ALTER TABLE journeys
  ALTER COLUMN mbti_self DROP NOT NULL;

-- 既有 user 資料遷移（從 journey 拉到 user）
UPDATE users u
SET mbti_self = j.mbti_self,
    mbti_confidence = j.mbti_confidence
FROM journeys j
WHERE j.user_id = u.id
  AND j.is_active = true
  AND u.mbti_self IS NULL;
```

### 1.4 Code 變動清單

| 檔案 | 變動 |
|---|---|
| `supabase/migrations/005_user_mbti_global.sql`（新） | Schema migration + data backfill |
| `src/lib/ai/buildContext.ts` `buildUserMbtiGroundTruthBloc` | 改從 `user.mbti_self` 拉、不是 `journey.mbti_self` |
| `src/app/api/auth/register/route.ts` | 註冊後不創建 journey、只跑共用 onboarding |
| `src/app/onboarding/page.tsx`（新或重構）| 共用 onboarding 2 步 |
| `src/app/(authenticated)/page.tsx`（新）| 主畫面 mode tab |
| `src/app/(authenticated)/practice/onboarding/page.tsx`（新或從 Day 0 拆出）| Mode A 專屬 5 步 setup |
| `src/app/(authenticated)/consultant/page.tsx` | 不再要求 journey 存在、可直接進對話 |
| `src/app/api/ai/consultant/route.ts` | 移除 `if (!journey) return 404`、改成 fallback to user-only context |

### 1.5 工作量：1-2 天

- Schema migration + backfill：0.5 天
- Onboarding UI 拆兩段：0.5-1 天
- Route + API 改：0.5 天
- 測試：0.5 天

---

## 2. P0 — Mode B 命名拍板：「我卡住了，幫我拆」

### 2.1 拍板理由

| 維度 | 「跟諮詢師對話」（原）| 「我有困擾請幫我分析」（候選）| **「我卡住了，幫我拆」**（拍板）⭐ |
|---|---|---|---|
| 長度 | 6 字 | 10 字 | **5 字** |
| 語氣 | formal、有距離 | 直白但偏 T 系 | 口語、F + T 都吃 |
| 跟 spec 對齊 | 弱 | 弱 | **強**（「卡點」§1.2.5 + 「拆」呼應 §13.7「找最關鍵 1 格」+ §1.6 拿魚給貓的「拆解」）|
| User 心智 | 「諮詢師很 formal、貴」 | 「來分析、像問醫生」 | 「我卡住、有東西幫我拆」 |
| Sidebar 顯示 | OK | 擁擠 | **乾淨** |

### 2.2 對應 spec patch

需要 search-replace：
- `src/lib/ai/buildContext.ts` MODE_B_LOCK_BLOC：「諮詢師」→ 保留 AI 角色名稱（小羽老師）、但 mode 顯示名改
- `src/app/(authenticated)/consultant/page.tsx` header：「跟諮詢師對話」→「我卡住了，幫我拆」
- spec `§13` 子標題更新
- spec `§13.1` 引言更新

### 2.3 工作量：30 min

純命名搜尋替換 + spec patch。

---

## 3. P1 — Sidebar 歷史對話 Retention

### 3.1 為什麼這條 critical（不是 nice-to-have）

> User 看到自己的累積軌跡 = 內化「我有在進步」感 = §1.4 認知升維的 visualization layer。

對應：
- **§1.2.5 慢就是快**：21 天每天累積、user 看得到才有「慢」的價值感
- **§1.4 認知升維**：D21 儀式對 D1 對比、需要 D1 對話完整保留才能對比
- **§1.13 brand integrity**：AI 說「我記得你」、就要 UI 顯示得出來「記得」的證據

### 3.2 兩個 Mode 的 Sidebar 結構

**🌱 21 天刻意練習 sidebar**：

```
[+ 新練習]
─────────────
🌱 跟 ninon 的 21 天（round 2）  ← active
   • Day 11 — 具體請求          ← current
   • Day 10 — 矛盾情境（輕）
   • Day 9  — 觀察記錄
   • ...
   • Day 1  — 我對 ninon 的盲點

🌱 跟兒子的 21 天（round 1、completed）
   • Day 21 — 認知升維儀式
   • ...
   • Day 1
```

點 Day N → 顯示該天完整對話（包含 user input + AI response、可重看）。
有左右滑箭頭（◀ Day 10 / Day 12 ▶）跨日 navigation。

**🤝 我卡住了，幫我拆 sidebar**：

```
[+ 新主題]
─────────────
🤝 兒子玩手機、成績掉、絕食       ← 2026-05-19
🤝 老婆冷戰、不肯講話             ← 2026-05-17
🤝 主管 micromanage、不信任我     ← 2026-05-15
🤝 朋友 A 借錢沒還、怎麼開口      ← 2026-05-10
```

每個主題 = 一個獨立 conversation thread、點進去看完整對話。

### 3.3 DB Schema 變動

```sql
-- 21 天 sidebar 需要 journey.title 顯示
-- （已存在「任務稱呼」欄位、確認 schema 有就好）

-- 諮詢主題 sidebar 需要 conversations 多 thread 支援 + topic_title
-- 現狀：context_type='consultant' + day_number=0 是單一持續累積 thread
-- 改為：每個 consultation case 是獨立 thread、day_number 不再固定 0

ALTER TABLE conversations
  ADD COLUMN topic_title TEXT,         -- 主題標題（AI auto-generate）
  ADD COLUMN topic_started_at TIMESTAMPTZ DEFAULT NOW();

-- 改 schema 邏輯：
--   context_type='consultant' 不再用 day_number=0 鎖定單一 thread
--   每個諮詢主題 = 一個獨立 conversations row、topic_title 區隔
```

### 3.4 諮詢主題 Auto-titling 機制

User 開始新諮詢 → 第 1 round message 完成後 → 後端 trigger Claude Haiku（快速便宜）generate 5-15 字主題標題：

```typescript
const titlePrompt = `以下是用戶剛開始的諮詢主題對話、請用 5-15 字幫這個主題下一個短標題，
不要加標點、不要引號、直接給標題文字：

用戶：${firstUserMessage}

標題：`;
```

範例 output：
- input：「我兒子每天玩手機好幾個小時、成績給我掉到倒數⋯」
  → output：「兒子玩手機、成績掉、絕食」
- input：「我老婆已經 3 天不跟我講話、不知道怎麼開口⋯」
  → output：「老婆冷戰、不肯講話」

### 3.5 Code 變動清單

| 檔案 | 變動 |
|---|---|
| `supabase/migrations/006_conversation_threading.sql`（新） | conversations 多 thread + topic_title |
| `src/components/Sidebar.tsx`（新或重構） | 兩個 mode 各自的 sidebar component |
| `src/app/api/ai/consultant/route.ts` | 改成 multi-thread + topic_title auto-generation |
| `src/app/api/practice/[journeyId]/days/[dayNumber]/route.ts` | 加 day-by-day conversation 查詢 endpoint |
| `src/app/(authenticated)/practice/page.tsx` | sidebar 整合 + Day navigation arrows |

### 3.6 工作量：2-3 天

- Schema migration + backfill：0.5 天
- Sidebar component（兩個 mode）：1 天
- Day navigation + history view：0.5-1 天
- Topic auto-titling：0.5 天
- 測試：0.5 天

---

## 4. P2 — PDF Export

### 4.1 Use Case

| 場景 | 匯出單位 | 用途 |
|---|---|---|
| 21 天每日 | 每天完整對話 1 PDF | 學員當天結束複習 |
| 21 天整 round | 21 天合輯 1 PDF | 月底回顧整體進度 |
| 諮詢主題 | 每主題完整對話 1 PDF | 留存洞察、之後遇到類似情境查閱 |
| 開發者（Steve）| 任何對話 | self-test 歸檔到 field-test-cases/ |

### 4.2 技術選擇對比

| 方案 | 優點 | 缺點 | 適合 |
|---|---|---|---|
| **browser-side jsPDF** | 零後端、立即下載 | 純文字、難排版中文字型、emoji 缺 | ❌ 不適合（中文 + emoji + markdown）|
| **browser-side html2pdf** | 渲染現有 UI 為 PDF | 跨瀏覽器一致性差、字型 fallback | ⚠️ 中等 |
| **server-side puppeteer**（推薦）⭐ | render HTML 完整、中文字型可控、markdown + emoji 完美 | 後端 dependency、Vercel serverless 跑 puppeteer 麻煩 | ✅ 推薦但需 workaround |
| **server-side @react-pdf/renderer** | React component-based、好控制 | 學習曲線、複雜 markdown 需自己 parser | ⚠️ 中等 |
| **server-side Playwright + chromium-aws-lambda** | Vercel-friendly puppeteer 替代 | 較新、文件較少 | ✅ 推薦 if 走 server-side |

**推薦**：server-side `@sparticuz/chromium` + `puppeteer-core`（Vercel serverless 友好的 chromium 套件）。

### 4.3 PDF 內容 layout

```
┌────────────────────────────────────────┐
│ [Logo] 羽升幸福關係                    │
│ ────────────────────────────────────── │
│ 21 天刻意練習・Day 11・具體請求         │
│ 2026-05-19 23:45                       │
│ ────────────────────────────────────── │
│                                        │
│ 小羽：嗨仲華！早安 😊                  │
│ 先接著昨天 Day 10 — 你練了 ⋯⋯         │
│                                        │
│ 你：我跟小玟說「週末要不要一起咖啡⋯」│
│                                        │
│ 小羽：很好！這就是 S6 具體請求⋯      │
│                                        │
│ [⋯整篇對話 markdown render⋯]          │
│                                        │
│ ────────────────────────────────────── │
│ Generated by 羽升 AI · 2026-05-19     │
└────────────────────────────────────────┘
```

### 4.4 Code 變動清單

| 檔案 | 變動 |
|---|---|
| `src/app/api/export/conversation/[id]/route.ts`（新） | PDF generation endpoint |
| `src/lib/pdf/generateConversationPdf.ts`（新） | core PDF logic + HTML template |
| `src/components/PdfDownloadButton.tsx`（新） | UI button + download trigger |
| `package.json` | 加 `puppeteer-core` + `@sparticuz/chromium` |

### 4.5 工作量：1-2 天

- HTML template + 中文字型載入：0.5 天
- API endpoint + puppeteer integration：0.5-1 天
- UI button + 測試：0.5 天

---

## 5. Schema Changes 統合

統合 Phase 2 三條 schema migration：

| Migration | 內容 | 對應 P0/P1/P2 |
|---|---|---|
| `005_user_mbti_global.sql` | `users.mbti_self`、journey 的改為 optional override | P0 |
| `006_conversation_threading.sql` | conversations 多 thread + `topic_title` + `topic_started_at` | P1 |
| `007_pdf_export_metadata.sql`（optional） | conversations 加 `pdf_exported_at`、`pdf_url`（cache） | P2 |

---

## 6. Implementation Sequence

```
Week 1（P0 — Trier-first Onboarding + Mode 命名）
├── Day 1-2：Migration 005 + backfill + 共用 onboarding UI
├── Day 2-3：主畫面 mode tab + Mode A 拆出 onboarding
└── Day 3：Mode 命名 search-replace + spec patch

Week 2（P1 — Sidebar + History）
├── Day 4：Migration 006 + sidebar component shell
├── Day 5：21 天 sidebar + Day navigation arrows
├── Day 6：諮詢主題 sidebar + auto-titling
└── Day 7：整合測試 + edge case fix

Week 3（P2 — PDF Export，可平行）
├── Day 8：HTML template + 中文字型
├── Day 9：API + UI button
└── Day 10：測試 + 部署

總時程：~10 天 work（含測試）、可壓縮到 7-8 天 if focus
```

**依賴關係**：
- P0 → P1：sidebar 要 multi-round 設計、依賴 onboarding 新 flow
- P1 → P2：PDF export 從 conversation thread 拉、依賴 thread schema
- P0 → P2：PDF export 內容依賴 Mode 命名更新

→ 順序不可調換。**P0 必做先**。

---

## 7. Spec Patches Required

Phase 2 完成後需要寫進 spec 的 sections：

| Spec section | 改動性質 |
|---|---|
| **§2.x（新）** Trier-first Onboarding Flow | 新章節、product philosophy + funnel design |
| **§8 Schema**（修改） | 加 `users.mbti_self`、`conversations.topic_title` 等欄位 |
| **§13.1 Mode 1 vs Mode 2**（修改） | Mode B 命名更新「我卡住了，幫我拆」 |
| **§15（新）** Sidebar UX + History Retention 紀律 | 對應 §1.2.5 慢就是快 + §1.4 認知升維 visualization |
| **§16（新）** PDF Export 規格 | layout + 觸發點 + 內容 standard |
| **§14 版本紀錄** | 新增 v1.3.0 entry（Phase 2 整體里程碑） |

---

## 8. Open Questions — Steve 已拍板（2026-05-19）

| # | 問題 | 拍板 | Implementation 含義 |
|---|---|---|---|
| 1 | Mode A 多 round 之間是否能跨 round 看歷史？ | **跳過**（先不做） | Sidebar 只顯示當前 round 內 Day 1-21、不顯示歷史 round 內容、減少 UI 複雜度 |
| 2 | 諮詢主題列表是否需要 archive 功能？ | **需要** | 主題列表加 archive action、archived 主題不顯示在 active 列表、有獨立 archive view（or filter toggle）|
| 3 | PDF 是否需要 password / 浮水印？ | **之後再說** | Phase 2 PDF 純 export、不加 security layer、可作為 v1.3.x patch 後做 |
| 4 | 共用 onboarding 是否問「目前關係狀態」？ | **先不需要** | Onboarding 維持極簡 2 步（MBTI + 暱稱）、不增加 friction、對應 trier-first 原則 |
| 5 | 第 2 round 21 天 title 是 user 重填 or copy round 1？ | **User 重填** | 每 round task 獨立命名、journey.title 不繼承 round 1 |

### 8.x 拍板衍生的 Schema / UX 補充

**針對 Q2 archive 功能**：

```sql
-- Migration 006 加 archive flag
ALTER TABLE conversations
  ADD COLUMN archived_at TIMESTAMPTZ;  -- NULL = active、NOT NULL = archived
```

- 諮詢主題 sidebar default 只顯示 `archived_at IS NULL`
- Sidebar 底部加「📁 已封存（N）」展開連結 or filter toggle
- 封存動作：主題 hover → ⋯ menu → Archive
- 解封存：archive view 內 hover → ⋯ menu → Restore
- 永久刪除（destructive）需 confirmation modal

**針對 Q5 round 2 title 重填**：

Mode A 進入第 2 round 時、UI flow 改成「部分 inherit、title + goal 重填」：

- Step 1：「要繼續跟[round 1 對象暱稱] 練習嗎？還是新對象？」
  - 同對象 → inherit 暱稱 + MBTI + 關係類型、進 Step 2
  - 新對象 → 全新 5 步 onboarding
- Step 2 (同對象 path)：「這一輪你想叫它什麼？」（提示句：「跟 [暱稱] 第 2 輪」「跟 [暱稱] 練習溝通」）
- Step 3：新目標 + 任務稱呼

→ 重填項：title / goal / task_name；inherit 項：partner_nickname / mbti_partner / relationship_type

---

## 9. Decision Log

| 日期 | 決定 | 決定人 |
|---|---|---|
| 2026-05-19 | Mode B 命名拍板「我卡住了，幫我拆」 | Steve |
| 2026-05-19 | Phase 2 4 條 architectural shifts approved（P0 P0 P1 P2） | Steve |
| 2026-05-19 | 此 memo 歸檔到 `docs/architecture-phase-2-proposal.md`、作為 Phase 2 kickoff reference | Steve |
| 2026-05-19 | §8 Q1：Mode A 多 round 跨 round 看歷史 → **跳過**（先不做） | Steve |
| 2026-05-19 | §8 Q2：諮詢主題列表 archive 功能 → **需要**（加 archive flag + archive view）| Steve |
| 2026-05-19 | §8 Q3：PDF password / 浮水印 → **之後再說**（不做 Phase 2、留 v1.3.x 後續） | Steve |
| 2026-05-19 | §8 Q4：共用 onboarding 問「關係狀態」 → **先不需要**（維持極簡 2 步） | Steve |
| 2026-05-19 | §8 Q5：Round 2 title → **user 重填**（不繼承 round 1） | Steve |

---

## 10. Next Step

1. Steve review 此 memo + 回答 §8 5 個 open questions
2. 確認 Phase 2 起跑日期 + 工作節奏（全速 vs 分散排程）
3. 起跑後第一 task：Migration 005 + 共用 onboarding UI 拆兩段
4. 每完成一個 P0/P1/P2 patch → spec §14 同步歸檔

---

**附註**：這個 memo 對應 spec §1.2.5「Critical Few + 慢就是快」精神——4 條 insights 都是 must-do、按 priority 順序執行、不貪、不亂。Phase 2 完成後、產品才算真正從 founder-think 進化到 user-think。
