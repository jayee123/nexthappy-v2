# 後台管理 使用手冊（Admin User Guide）

- 版本：**v1.0（2026-06-04 初版）**
- 作者：Steve + Claude 協作
- 適用對象：**所有 admin 使用者**——含客服、課程編輯、Steve 本人、Jeff（工程師）
- 對應 spec：[`admin-dashboard-spec-v0.1.md`](./admin-dashboard-spec-v0.1.md)（產品規格）

---

## 0. 一頁版（給趕時間的人）

| 我想做⋯ | 去哪 |
|---|---|
| 看每日整體 metric | `/admin` Dashboard |
| 搜尋特定 user / 改他 MBTI / 停權 / 刪除 | `/admin/users` |
| 找哪個 user 卡在 21 天哪一天 | `/admin/journeys` |
| 看某 user 跟 AI 講了什麼（debug / 客訴） | `/admin/conversations` |
| 看大家最常卡在什麼問題（Mode B） | `/admin/topics` |
| 改 Day 0-21 的課程內容 | `/admin/course` |
| 加新 admin / 看誰做了什麼 | `/admin/settings` |

**⚠️ 三條鐵律**：

1. **對話內容隱私**——任何 user 對話不可截圖外流、不可分享群組。所有查看會記到 audit log。
2. **危險動作不可逆**——刪除 user 是 hard delete + cascade（會清掉他所有 journey + conversation）、停權容易、刪除請三思。
3. **改課程內容會立刻生效**——所有正在練該 Day 的 user 馬上看到新版。建議低活躍時段操作 + 改完通知 Steve sanity test。

---

## 1. 後台是什麼

**羽升幸福養成學苑後台**是給 Steve / 客服 / 課程編輯人員管理 user / 對話 / 課程內容 / 看統計的內部工具。

**做得到**：
- 看用戶資料、journey 進度、AI 對話內容
- 改用戶 MBTI / name / 停權 / 刪除
- 改 Day 0-21 課程內容（theme / 心法 / 任務 / 晚間問題）
- 管理 admin 名單
- 查所有 admin 動作 audit log

**做不到（也不該做）**：
- 改 AI prompt（在 `src/lib/ai/buildContext.ts`、Steve 親自打磨）
- 改 user 對話內容（read-only、就算有 bug 也只能停權帳號、不可改對話）
- 發送 push notification / 寄信
- 收費 / billing（沒接金流）

---

## 2. 怎麼拿到 admin 權限

1. **你必須先有一個一般 user 帳號**——到 https://happy.nuwa.chg2asc.com/auth/register 用你的工作 email 註冊
2. **聯絡 Steve（或現有 admin）** → 請他到 `/admin/settings` 把你 email 升 admin
3. **重新登入 / 重新整理瀏覽器** → 你登入後就會看到 `/admin` 的入口（在 sidebar 或網址列直接輸入）

> 💡 提示：admin 帳號跟一般 user 帳號是**同一個**——你登入後既能用前台（/chat 練 21 天）也能用後台（/admin 管理）。**用你自己的工作 email、不要跟別人共用帳號**（audit log 會記名）。

---

## 3. 登入 + 找路

### 3.1 入口
- **後台首頁**：https://happy.nuwa.chg2asc.com/admin
- 沒 admin 權限 → 自動 redirect 回 `/chat`（前台）

### 3.2 Sidebar 導覽

```
🛠 後台管理
─────────────
📊 Dashboard       /admin
👥 用戶管理        /admin/users
🗺 Journey 管理   /admin/journeys
💬 對話歷史        /admin/conversations
📁 諮詢主題        /admin/topics
📚 課程內容        /admin/course
⚙️ 系統設定        /admin/settings
─────────────
你的 email
回前台 | 登出
```

點 「回前台」回 user 主畫面 `/chat`、點「登出」清 session。

---

## 4. 7 個 Module 詳述

### 4.1 📊 Dashboard `/admin`

**這頁是做什麼**：總覽 KPI、Steve 每天打開看狀況的首頁。

**主要 metric**：
| Metric | 意義 |
|---|---|
| 總註冊人數 | 累積至今所有 user |
| 今日新增 | 過去 24 小時新註冊 |
| 7 天 / 30 天活躍 | 過去 N 天有跟 AI 對話過的 user |
| 平均每日對話訊息數 | 整體活躍度 indicator |
| Mode A / B 用戶數 | 各 mode 滲透率（A=21 天練習、B=我卡住幫我拆） |
| 21 天完成率 | (完成 21 天 user) / (啟動 journey user) |
| Day 流失 bar chart | 每個 Day 0-21 還有多少 user 在練（看哪一天最多人卡住） |

**什麼時候用**：每天早上開啟 app 看一眼（30 秒）、特別注意完成率變化。

---

### 4.2 👥 用戶管理 `/admin/users`

**這頁是做什麼**：搜尋 user、看詳情、編輯資料、停權、刪除。

**主要功能**：

| 動作 | 怎麼做 | 注意 |
|---|---|---|
| 搜尋 user | 上方 search box 輸入 email 或 name 模糊比對 | 4 秒延遲 debounce、不用按 enter |
| 篩選 | 「全部」/「admin」/「停權」/「過去 7 天活躍」 | 篩選後 cursor 重置 |
| 看詳情 | 點任一 row「查看」→ 進詳情頁 | |
| 編輯資料 | 詳情頁右上「編輯」→ 改 name / MBTI / is_admin | 改 MBTI 寫 audit log |
| 停權 | 詳情頁「停權」→ confirm | 軟刪除（保留 record、user 無法登入） |
| 解除停權 | 已停權 user 詳情頁「解除停權」 | 寫 audit log |
| 刪除 | 詳情頁「刪除」→ 兩次 confirm | ⚠️ **hard delete + cascade、無法 undo** |

**什麼時候用**：
- 客服反應「某 user MBTI 寫錯了」→ 編輯改
- 違規 / 異常 user → 先停權、收集證據再決定刪除
- GDPR 刪除請求 → 走刪除流程

⚠️ **不可做**：
- 不可停權 / 刪除 / 撤 admin **自己**（系統會 403 擋）
- 不可改 user email（avoiding mistake、有需要找 Steve）

---

### 4.3 🗺 Journey 管理 `/admin/journeys`

**這頁是做什麼**：列出所有 21 天 journey、看誰練到第幾天、找出卡住的 user。

**主要欄位**：User / Round / Current Day / Partner / Active / 創建時間 / 最後對話 / 完成天數

**篩選**：is_active（進行中 / 全部）、current_day range、relationship_type（couple / parent_child / workplace）

**什麼時候用**：
- 找 Day 5 卡了超過 7 天沒動的 user → 主動聯繫
- 看 Mode A 真實 funnel 狀況、跟 Dashboard 數字 cross check

---

### 4.4 💬 對話歷史 `/admin/conversations`

**這頁是做什麼**：看任一 user 的 AI 對話內容、debug AI 品質 / 處理客訴。**Read-only**、絕不可改對話。

**主要欄位**：類型 / Day / User / 主題或預覽 / 訊息數 / 時間

**篩選**：context_type（晨間 / 晚間 / 諮詢）/ Day 篩選 / search by email

**詳情頁**：完整對話氣泡 + Context card（user / journey / 時間 / 訊息數）

🚨 **隱私紀律（必讀）**：
- 這是 user 私人對話、僅限 debug / 客服用途
- **不可截圖外流**、**不可分享給群組**、**不可拿來訓練第三方 AI**
- 每次點開詳情**會寫 audit log**（誰看、看誰、什麼時候）

**什麼時候用**：
- User 回報「Day 5 AI 講錯話」→ 進來看完整對話
- 客訴調查
- AI 品質 audit（Steve 隨機抽看）

---

### 4.5 📁 諮詢主題 `/admin/topics`

**這頁是做什麼**：列出所有 Mode B「我卡住，幫我拆」topics、看熱門關鍵字。

**主要欄位**：Topic title / User / 訊息數 / archived / 創建時間

**加值統計**：Top 50 topic keywords（從 topic_title 抽中文關鍵字）—— 看 user 最常卡在什麼。

**什麼時候用**：
- 每週 review user 最常 topic 是什麼 → feedback 給課程設計
- 找特定 keyword（譬如「兒子」「老婆」「主管」）的所有 case → 累積 field test case
- 點任一 row「查看對話」→ 跳對話歷史詳情頁

---

### 4.6 📚 課程內容 `/admin/course`

**這頁是做什麼**：直接編輯 Day 0-21 的課程內容、不用改 spec / 不用跑 migration / 不用重新部署。

**列表頁**：22 row（Day 0-21）、顯示 theme / unit / 最後更新時間。

**編輯頁** `/admin/course/[day]`：

可編輯欄位（5 個）：
| 欄位 | 用途 | 字數上限 |
|---|---|---|
| theme | 主標題（user 看到的「Day N — XXX」） | 100 字 |
| subtitle | 副標題 | 200 字 |
| knowledge_point | 核心心法、user 看到當日教學、AI 引用 | 10000 字 |
| today_task | 今日任務、AI morning 開場引用 | 5000 字 |
| evening_questions | 晚間回顧問題、AI evening 引用、可加 / 刪 / 排序 | 最多 10 題、每題 500 字 |

不可編輯（schema 結構性）：
- `day_number`、`course_unit`（會破壞 21 天 routing）
- `special_content`（JSONB 結構化資料）

**SOP**：
1. 列表點 day → 進詳情
2. 右上「✏️ 編輯」進入編輯模式
3. ⚠️ 黃色 warning banner 跳出（影響 live user）
4. 改完點「💾 儲存」
5. 綠色 ✅ toast 跳出「儲存成功」
6. 自動回 read-only mode 顯示新值

⚠️ **編輯紀律**：
- **改 Day N 內容會立刻影響所有正在練 Day N 的 user**——建議在低活躍時段（凌晨）改
- 改完一定**通知 Steve 跑一次 sanity test**（自己當 user 走一輪 morning + evening）
- 所有變更**寫 audit log**——誰改、什麼時候、改了什麼欄位、before/after 都記
- 若不確定 → **先去 spec 文件查 [`v2.1-course-spec.md`](./v2.1-course-spec.md) §4 課程設計**

---

### 4.7 ⚙️ 系統設定 `/admin/settings`

**這頁是做什麼**：管理 admin 名單 + 看所有 admin 動作 audit log。

**Tab 1：👤 Admin 列表**

| 動作 | 怎麼做 |
|---|---|
| 升 admin | 上方 form 輸入 email → 點「升 admin」（必須是已註冊 user） |
| 撤銷 admin | 名單表格每 row「撤銷」紅色 button → confirm dialog → 確認 |
| 查看自己 | 你 row 會標「你」chip + 「（不可撤自己）」灰字 |

🚨 **保護機制**：
- **自我保護**：你不能撤自己的 admin（防自鎖）
- **最後一位保護**：系統至少要 1 位 admin、不能撤掉最後一位

**Tab 2：📝 Audit Log**

| 欄位 | 內容 |
|---|---|
| 時間 | 精確到秒（YYYY/MM/DD HH:MM:SS）|
| Admin | 做動作的 admin email + name（user 已刪除 → 「已刪除 user」）|
| 動作 | 升 admin / 撤 admin / 停權 user / 改 MBTI / 編輯課程內容 / ⋯ |
| Target | 被動作的 entity type + ID（顯示前 8 字）|
| 變更 | 點「展開」→ 看 `{before, after}` JSON + IP + UA |

**篩選**：Action（下拉）+ Admin（下拉）+ 清除篩選

**Pagination**：「載入更多」 button 滾動載 50 筆。

**什麼時候用**：
- 「Day 5 的 theme 怎麼變了？」→ filter action = 「編輯課程內容」、看誰改、什麼時候
- 「Peter 為什麼被停權？」→ filter target.id = peter_user_id 找停權紀錄
- 安全 audit：每月看一次有沒有異常 admin 動作

---

## 5. 常見任務 SOP

### 5.1 User 回報「Day 5 AI 講錯話」

1. `/admin/users` 搜 user email → 進詳情頁
2. 看「Conversation List」找 Day 5 那筆 → 點查看
3. **跳到 `/admin/conversations/[id]`** 看完整對話
4. 確認問題：是 user 誤解？AI 真的講錯？單一案例 or pattern？
5. 若是 **AI 真的有 bug** → Slack 告訴 Steve（含對話連結）
6. 若是 **單一案例 / user 誤解** → 客服回 user 解釋
7. 若是 **pattern**（多 user 都中）→ Steve 修 AI prompt（不是改 user 對話）

### 5.2 新員工加 admin

1. 員工先用工作 email 到 https://happy.nuwa.chg2asc.com/auth/register 註冊
2. 註冊完叫他傳 email 給你
3. 你進 `/admin/settings` → Tab 1 → 輸入他 email → 「升 admin」
4. 綠色 ✅ toast 表示成功
5. 通知員工：重新整理瀏覽器、進 https://happy.nuwa.chg2asc.com/admin

### 5.3 改課程內容（譬如 Day 11 的 today_task）

1. **先去 spec [`v2.1-course-spec.md`](./v2.1-course-spec.md)** confirm 改動方向跟 spec 一致
2. 進 `/admin/course/11` → 點「✏️ 編輯」
3. ⚠️ 看到 warning banner → 確認時段（避開晚間 8-11 點高峰）
4. 改 today_task → 儲存
5. 自己當 user 在 `/chat` 走一次 Day 11 morning trigger、看 AI 開場有沒有引用新版
6. 若有問題 → 回 `/admin/course/11` 改回去 + Slack 告訴 Steve
7. 完成後在 Slack 通知 team「Day 11 today_task 已更新、請 sanity test」

### 5.4 客訴調查流程

1. 確認 user 真實 email（不是 nickname）
2. `/admin/users` 找 user → 詳情頁看 last_active / journey / conversation count
3. 看可疑 conversation（用「對話歷史」帶 user_id filter）
4. 若需要採取行動：
   - 改 user 資料 → User 編輯 modal
   - 停權（暫時）→ User 停權 button
   - 刪除（最終）→ User 刪除 button（**兩次 confirm + cascade、無法 undo**）
5. 所有動作會寫 audit log、隨時可追溯

### 5.5 每日早安 Health Check（建議 SOP）

1. `/admin` Dashboard → 看昨天活躍 / 完成率 / 新增 user 有沒有異常數字
2. `/admin/journeys` → filter active → 看有沒有人卡 Day N > 7 天
3. `/admin/settings` Tab 2 → 看昨天 audit log 有沒有可疑動作（不該有的 user.delete）

**~3 分鐘搞定**。

---

## 6. 🚨 安全紀律（必讀）

### 6.1 隱私（最高優先）

| 守則 | 為什麼 |
|---|---|
| **user 對話 NOT 截圖外流**、NOT 分享群組、NOT 拿去訓練第三方 AI | user 信任我們存他的私人對話、外流會徹底毀掉品牌 |
| 客訴對話 review 後不留個人 copy | 你電腦遺失 / 被駭就外流 |
| 不用 admin 帳號跑 user 端的「練習」 | 你的對話也會出現在 admin、難辨真假 |

### 6.2 帳號

| 守則 | 為什麼 |
|---|---|
| **每人一個 admin 帳號**、不共用 | audit log 才能追究誰做什麼 |
| 離職立刻撤 admin（不是停權、是撤 admin） | 防止離職員工讀對話 |
| Admin 密碼跟一般網站不同 | 防撞庫攻擊 |

### 6.3 危險動作（不可逆）

| 動作 | 後果 | 建議 |
|---|---|---|
| 刪除 user | hard delete + cascade（清掉所有 journey + conversation） | 先停權 30 天觀察、確定刪 |
| 改 user MBTI | AI 後續對話會用新 MBTI 給建議 | 確認過 user 真的想改 |
| 改課程內容 | 立刻影響所有 live user | 低活躍時段 + sanity test |
| 撤 admin | 對方馬上失去後台權限 | 確定不會誤刪整個營運團隊 |

### 6.4 緊急狀況

- **發現 bug 但不確定怎麼修** → **不要自己改 code**、Slack Steve、附情境 + 截圖
- **看到可疑 admin 活動**（譬如有人狂讀對話）→ 馬上找 Steve、保留 audit log 截圖
- **User 在對話裡透露自殺 / 自傷意念** → 馬上告訴 Steve、Steve 會聯繫專業資源

---

## 7. 給 Jeff（工程師）的開發備註

### 7.1 Tech Stack

| Layer | Tool |
|---|---|
| Framework | Next.js 14 App Router |
| Language | TypeScript |
| DB | Supabase PostgreSQL (JSONB heavy) |
| Auth | 既有 `getSessionFromRequest` from `@/lib/auth` |
| Admin auth gate | `requireAdmin` from `@/lib/admin/requireAdmin` |
| Audit log | `logAdminAction` from `@/lib/admin/auditLog` |
| UI | Tailwind CSS 純 utility（無 UI library）|
| Deploy | Vercel auto-deploy from `main` branch |

### 7.2 不可動的檔案

| File | 為什麼 |
|---|---|
| `src/lib/ai/buildContext.ts` | AI prompts、Steve 親自打磨、改了會破壞 user 體驗 |
| `src/app/api/ai/*` | AI route、跟 buildContext.ts 緊密 coupled |
| `src/app/chat/`、`src/app/onboarding/`、`src/app/settings/`、`src/app/progress/` | user-facing pages |
| `src/app/api/journey/*`、`src/app/api/conversation/*` | user-facing endpoints |

### 7.3 加新 admin module 的 pattern

每個 module 大約 3-5 個檔：

1. **Migration**（如需新 schema）：`supabase/migrations/0XX_*.sql`
2. **API list endpoint**：`src/app/api/admin/<module>/route.ts`
   - 開頭 `await requireAdmin(request)`
   - cursor pagination（不用 OFFSET）
   - filter via query params
3. **API detail endpoint**：`src/app/api/admin/<module>/[id]/route.ts`
   - GET / PATCH / DELETE
   - mutation 一定 `await logAdminAction({...})`
4. **List page**：`src/app/admin/<module>/page.tsx`
   - 'use client' + useEffect 抓資料
   - 篩選 + 表格 + pagination footer
5. **Detail page**：`src/app/admin/<module>/[id]/page.tsx`
   - read-only + edit modal pattern
6. **Sidebar nav entry**：`src/components/admin/AdminSidebar.tsx` 加 link

### 7.4 Audit log 紀律

- 所有 **PATCH / DELETE / POST grant** 都要 `logAdminAction`、不可省略
- `action` 命名：`<entity>.<action>` 例：`user.suspend` / `course.edit_day`
- `before / after` 只記**有變動**的欄位、不要整 row dump
- `logAdminAction` 失敗不會 throw、會 console.error、不阻塞主操作

### 7.5 Migration 規範

- 用既有的 `supabase/migrations/0XX_*.sql` 編號（目前到 011）
- 每個 migration 上面寫註解：版本 / 目的 / 改動 / risk
- 跑前**先 Slack Steve confirm**、不要直接 push
- 寫 idempotent SQL（`IF NOT EXISTS` / `IF EXISTS`）防止重跑出錯

### 7.6 部署

- `main` branch 是 prod
- Vercel auto-deploy（push 完 ~2 分鐘 Ready）
- Hotfix workflow：直接 commit + push 到 main（小 fix）
- 大 feature：開 `feat/<name>` branch → PR → review → merge

### 7.7 常用 SQL（debug 用）

```sql
-- 看最近 20 筆 admin 動作
SELECT created_at, admin_user_id, action, target_type, target_id
FROM admin_audit_logs
ORDER BY created_at DESC
LIMIT 20;

-- 找某 user 的所有對話
SELECT id, day_number, context_type, jsonb_array_length(messages) AS msg_count, created_at
FROM conversations
WHERE user_id = '<uuid>'
ORDER BY created_at DESC;

-- 看每個 Day 的活躍 user 分布
SELECT current_day, COUNT(*) AS active_users
FROM journeys
WHERE is_active = TRUE
GROUP BY current_day
ORDER BY current_day;
```

---

## 8. FAQ

**Q：我可以用同一個 admin 帳號跑 user 端嗎？**
A：可以、但**不建議**——你的對話會跟真實 user 對話混在 admin 後台、難辨真假。建議用另一個 test email 跑 user 端 sanity test。

**Q：admin 密碼 reset 怎麼做？**
A：跟一般 user 一樣、走 https://happy.nuwa.chg2asc.com/auth/forgot-password 流程。admin 權限不會因為改密碼消失。

**Q：我點刪除 user、按到第二次 confirm 才發現按錯了、能 undo 嗎？**
A：**不能**——hard delete + cascade、user + 所有 journey + 所有 conversation 都已從 DB 移除。請聯繫 Steve 看有沒有最近 DB backup 可救（不保證）。

**Q：改課程內容後 user 已經跟舊版對話過、會不會錯亂？**
A：不會。AI 抓「目前」DB 裡的內容做 system prompt、不會回溯。**但 user 那則對話已存了「舊版 context」的 AI 回應**——你改了內容後、舊對話顯示的是舊回應、新對話會看到新版。

**Q：audit log 會無限長嗎？**
A：MVP 階段不會 cap、未來會做 retention（至少保留 12 個月）。現在每筆 audit log 很小（< 1 KB）、長期成本可忽略。

**Q：發現 admin 後台有 bug 怎麼辦？**
A：開 GitHub issue（or Slack）告訴 Jeff / Steve、附「在哪頁、做什麼動作、預期 vs 實際、截圖」。**不要自己改 code 或繞過**。

**Q：我能匯出 user 列表到 CSV 嗎？**
A：MVP 階段沒做 export 功能、Phase 2 規劃。臨時需要 → 找 Jeff 跑 SQL 給你。

---

## 9. 版本紀錄

| 版本 | 日期 | 變更 |
|---|---|---|
| v1.0 | 2026-06-04 | 初版、7 個 module 完整 SOP + 安全紀律 + Jeff 工程備註 + FAQ |

---

**有問題 Slack Steve / Jeff、不要自己猜。**
