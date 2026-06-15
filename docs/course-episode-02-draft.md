# 課程草稿 — Episode 2：從 Placeholder 到真實 CRUD module

> **「用 Claude 蓋一個能用的後台用戶管理 — 4 個 API + 編輯 + 停權 + 刪除全套」**
> ─ 子奇老師 × Claude 結對開發實戰示範（Week 2 完整側錄）

- 版本：**Draft v0.1（2026-05-31 課程草稿）**
- 隸屬：**羽升升維 Stack 元產品 — 「教學員用 Claude 開發 APP」課程系列第 2 集**
- 上游：[`course-episode-01-draft.md`](./course-episode-01-draft.md)（第 1 集、Week 1 admin foundation）
- 來源原始素材：2026-05-30 ~ 31 子奇老師 + Claude 完整協作對話 + commit history（`a9a7df5` → `e19fb72` → PR #2 merge `beddb2b`）
- 目的：給 Steve 拍片參考 + 文字配套講義雙用
- 狀態：⚠️ 草稿、Steve review 拍板後可進 v0.2 完整劇本

---

## 0. Episode 元資料

| 項目 | 內容 |
|---|---|
| **集數** | Episode 2 |
| **片名候選** | 「真實 CRUD 上線：用 Claude 1 天蓋出後台用戶管理完整功能」 |
| **副標** | 「placeholder 之後、user 真的看到 user list」 |
| **目標時長** | 75-90 分鐘 / 剪完 50-60 分鐘（含 5 sessions + Vercel cleanup） |
| **目標學員** | 看過 Episode 1 跟著做完 Week 1 的學員（基礎已具備） |
| **前置** | Episode 1 全部跑過、有 admin layout + 7 placeholder pages 在 production |
| **學員學完能做到** | 真實 ship CRUD module；理解 cursor pagination、React state、cascade FK、audit log、防自鎖；管理 Vercel 多 project |

---

## 1. 整體故事弧

```
🎬 開場（5 min）
   「Week 1 蓋了房子框架（layout + 7 個 placeholder）、
    今天我們要把第一個房間裝潢起來、變成『真的能用』的後台。」
        ↓
📋 Pre-flight: Week 1 recap（3 min）
        ↓
🛠 5 個 Session（每個約 10-12 min）
   Session 2A: 用戶列表（Migration 009 + API + UI）
   Session 2B: 用戶詳情頁
   Session 2C: 編輯 + 停權 + 復原 + Audit log
   Session 2D: 刪除（cascade + 2-step confirm）
   Session 2E: PR + merge + production deploy
        ↓
🧹 Bonus: Vercel 清理（5 min）
   5 個重複 project 砍成 1 個、custom domain 平移
        ↓
🐛 8 個踩坑紀錄（10 min）
        ↓
🚀 收尾 + Homework + Episode 3 預告（5 min）
```

**核心 narrative**：「Week 1 是框架、Week 2 是真實功能。看完這集你會知道：實作 CRUD 不是『工程師魔法』、是『重複同個 pattern 5 次』。」

---

## 2. 開場 Hook（5 分鐘）

### 2.1 Cold open（30 秒）

直接放成果畫面：
- 螢幕錄影：訪 `https://happy.nuwa.chg2asc.com/admin/users`
- 看到真實 12 個 user 列表、搜尋「steve」過濾出 3 個
- 點任一 user 進詳情頁、看到 profile + journey + 對話 + stats
- 點「編輯」開 modal、改 MBTI 即時 refresh

旁白：「這是後台用戶管理、production 上跑、我 1 天蓋的。」

### 2.2 為什麼你應該看完這集（3 分鐘）

**子奇老師對鏡頭講**：

> 「Episode 1 我們蓋好房子的骨架——admin layout 跟 7 個空房間。
>
> 那是『框架』、不是『產品』。沒有 user、沒有 data、不能用。
>
> 今天我們要做第一個能用的房間：用戶管理。
>
> 看完這集你會知道一件事：**ship 一個真實 CRUD 功能、不是工程師的『魔法』、是『把同一個 pattern 跑 5 次』**——列表、詳情、編輯、停權、刪除。每一個都有同樣結構：API endpoint + UI page + 跟 Claude 對話。
>
> 跟著我做、你會在你自己的 production 上看到真實的 user data。從『學會跑流程』升維到『真的會 ship feature』。」

### 2.3 對標 anti-pattern（1.5 分鐘）

**指出市場上學 web 的 fail mode**：
- ❌ 學完 React tutorial、會做 To-Do List、但不會 ship production CRUD
- ❌ 看 30 集 Next.js 教學、不知道 audit log 為什麼要寫
- ❌ 跟著 ChatGPT 抄 code、出 bug 不會 debug、推不上 production
- ✅ 今天這集教你「**從 spec 到 production**」的完整循環、含 5 sessions + 8 個真實踩坑 debug

---

## 3. Pre-flight：Week 1 recap（3 分鐘）

快速複習上集成果：
- ✅ Migration 008（admin_audit_logs + is_admin）
- ✅ auth helpers（requireAdmin + logAdminAction）
- ✅ /admin layout + AdminSidebar
- ✅ 7 個 placeholder page（dashboard / users / journeys / conversations / topics / course / settings）
- ✅ PR #1 merged + production deploy

「今天我們把『用戶』那個 placeholder 變成真實功能。其他 6 個會在後續 Episode 慢慢做。」

---

## 4. Session 2A：用戶列表（12 分鐘）

### 4.1 範圍（1 min）

3 件 deliverables：
1. **Migration 009**：users 加 `suspended_at` 欄位
2. **GET `/api/admin/users`**：列表 API（search + filter + cursor pagination）
3. **`/admin/users` UI**：真實列表頁取代 placeholder

### 4.2 Migration 009（2 min）

跟 Claude 對話：「users 加一個 suspended_at TIMESTAMPTZ 欄位、用於軟刪除」

Claude 給 SQL、貼進 Supabase SQL Editor 跑、看到 ✅。

順手在 login route 加擋停權的邏輯：
```typescript
if (user.suspended_at) {
  return 403 '此帳號已被停權';
}
```

### 4.3 GET API endpoint（5 min）

跟 Claude 講需求：
- search by email/name（ilike）
- filter（admin / active / suspended）
- cursor pagination 50/page
- 聚合每個 user 的對話數 + 最後活躍時間 + journey 進度

Claude 給 ~100 行 TypeScript code。重點 patterns：
- `supabaseAdmin.from(...).select(...).limit(limit + 1)` 多撈 1 筆判斷 hasMore
- 不用 N+1、改用 IN query 一次撈 conversations + journeys、JS 聚合
- Cursor-based pagination（`gt(created_at, cursor)`、無 OFFSET）

**踩坑點 #1**：檔案路徑寫成 `src/app/admin/users/route.ts`（跟 placeholder page.tsx 撞）、應該是 `src/app/api/admin/users/route.ts`。Next.js App Router 規則。

**踩坑點 #2**：TypeScript error `typeof journeys[0]` — 因為 `journeys` 可能是 `null`。改用 explicit interface。

### 4.4 UI 列表頁（4 min）

跟 Claude 講：「真實列表頁、9 欄表格 + 搜尋 + filter + pagination」

Claude 給 ~200 行 React code。重點 patterns：
- `'use client'`、useState + useEffect + useCallback
- Debounce search（setTimeout 400ms）
- Cursor stack 記錄歷史 cursor（給「上一頁」用）
- Loading / error / empty state 分支
- 相對時間格式化（「3 天前」「16 分鐘前」）

→ refresh 看到真實 13 個 user 列表 ✅

---

## 5. Session 2B：用戶詳情頁（10 分鐘）

### 5.1 範圍

- GET `/api/admin/users/[id]` API（含 journeys + recent 20 conversations + stats）
- `/admin/users/[id]/page.tsx` UI（左 1/3 profile、右 2/3 journeys + conversations）

### 5.2 API（4 min）

跟 Claude 講：「user detail endpoint、回傳 user + 所有 journeys + 最近 20 對話 + 統計」

Claude 設計 4 個 query 並行：
1. user metadata
2. 所有 journeys
3. recent 20 conversations（只撈 metadata、不撈 messages payload、節省 size）
4. 總對話 count（用 `count: 'exact', head: true` 只算數、不撈資料）

回傳 4 段 JSON 給前端用。

### 5.3 UI（5 min）

跟 Claude 講：「2-column layout、左基本資料 + stats、右 journey list + conversation list」

Claude 給 ~290 行 React。重點：
- `useParams<{ id: string }>()` 取 URL 參數
- `grid-cols-1 lg:grid-cols-3` 響應式
- 編輯/停權/刪除 button 先 placeholder（alert）、Session 2C/2D 再串
- Conversation list 顯示「查看 (Week 4)」（對話歷史模組未來才建）

→ 從列表頁點「查看」跳詳情頁、看到完整資料 ✅

---

## 6. Session 2C：編輯 + 停權 + 復原 + Audit log（15 分鐘）

### 6.1 範圍

- PATCH `/api/admin/users/[id]`（改 name / mbti / is_admin / suspended_at）
- EditUserModal component
- 詳情頁串接 button、含 confirm dialog
- 真實寫 audit log

### 6.2 PATCH API（4 min）

field-by-field validation pattern：
- 只 update body 中提供的欄位
- 每欄位都驗證（MBTI regex、confidence enum、is_admin boolean）
- 建 before/after diff 給 audit log
- 防自鎖：admin 不能降自己 is_admin、不能停權自己

### 6.3 EditUserModal（3 min）

跟 Claude 講：「modal 改 name / MBTI / confidence / is_admin、Save 按鈕 disabled 直到有改動、is_admin checkbox 對自己 disabled」

Claude 給 ~225 行 modal component。重點：
- `fixed inset-0 z-50` overlay + click backdrop close
- Local form state、isDirty 計算
- Save 後 callback 給 parent refresh

### 6.4 詳情頁串接 + 測試（4 min）

- 加 `useRouter` + `currentAdminId` state（從 `/api/user/me` 撈）
- handleSuspend / handleUnsuspend / handleEditSaved 函式
- isSelf = currentAdminId === user.id（決定 button disable）

測試 5 個 case：
- 編輯 modal → 改 user MBTI → ✅ refresh
- 停權 → confirm → ✅ 停權 badge 出現
- 復原 → ✅ badge 消失
- 自己詳情頁：所有危險 action disabled
- 編輯自己：is_admin checkbox disabled

### 6.5 **重大踩坑 #3**：RLS 把 service_role 都擋了（4 min）

PATCH 全部成功、但 `admin_audit_logs` 表是空的！

dev server terminal 找到：
```
[logAdminAction] insert failed: 
  code: 42501
  message: 'new row violates row-level security policy for table "admin_audit_logs"'
```

**Root cause**：建 Migration 008 時選了 Supabase「Run and enable RLS」option、用了 `FORCE ROW LEVEL SECURITY`、連 service_role bypass 都失效。

**修法**：Migration 010 `ALTER TABLE admin_audit_logs DISABLE ROW LEVEL SECURITY;`

**takeaway**：「**沒看 dev server terminal 就找不到 silent fail 的 error**。Console.error 不會跳到瀏覽器、只在 server 端印。」

---

## 7. Session 2D：刪除（cascade + 2-step confirm）（12 分鐘）

### 7.1 範圍

- DELETE `/api/admin/users/[id]`
- 詳情頁串接刪除 button（兩次 confirm）
- DB FK 自動 cascade conversations / journeys

### 7.2 DELETE API（3 min）

```typescript
1. 撈 target user
2. 防自鎖：不可刪自己、不可刪其他 admin（要先降為 user）
3. 寫 audit log BEFORE delete（用 before 保留 user metadata）
4. DELETE FROM users WHERE id = userId
5. DB FK CASCADE 自動刪 conversations + journeys
```

### 7.3 UI 兩次 confirm（3 min）

```typescript
1st confirm: 「確定要刪除 X？下一步會問再次確認」
2nd confirm: 「🚨 最終確認：會永久刪 N 筆對話 / M 個 Journey、無法復原」
→ DELETE API → router.push('/admin/users') redirect
```

### 7.4 **重大踩坑 #4**：FK constraint 擋刪除（4 min）

第一次按刪除、API 回傳：
```
update or delete on table "users" violates foreign key 
constraint "fk_invite_used_by" on table "invite_codes"
```

**Root cause**：`invite_codes` 表有 FK 指向 users.id、delete_rule 是 NO ACTION（不允許）。

跑 SQL audit 找出所有指向 users 的 FK：
| Table | FK | Rule |
|---|---|---|
| conversations | user_id | CASCADE ✅ |
| journeys | user_id | CASCADE ✅ |
| **invite_codes** | used_by | **NO ACTION** ❌ |
| **admin_audit_logs** | admin_user_id | **RESTRICT** ❌ |

**修法**：Migration 011 改 2 個 FK 為 `SET NULL`（保留歷史紀錄、清 user reference）。

**takeaway**：「**DB schema 設計時就要想 delete 行為**——CASCADE 跟著刪、SET NULL 保留紀錄、RESTRICT 擋人。產品 grow 後改 FK 比一開始就設好痛 10 倍。」

### 7.5 測試 + 驗證 cascade（2 min）

刪 team02@nuwa.test：
- ✅ 刪除成功
- ✅ DB COUNT conversations = 0（cascade work）
- ✅ admin_audit_logs 有 user.delete 紀錄（含 before 欄位）

---

## 8. Session 2E：PR + merge + production deploy（5 分鐘）

### 8.1 PR 流程（複習 Week 1）

```
1. 開無痕視窗、login dummy 帳號
2. 訪 .../pull/new/feat/week2-user-management
3. 填 Title + Description（含 Week 2 DoD + Test Plan）
4. Create pull request
5. 切回主帳號、訪 PR
6. 個人 repo 直接 Merge pull request（不用先 Approve）
7. Confirm merge → Delete branch
```

### 8.2 Production deploy 驗證

- Vercel 自動 build（這次因為 merge commit author 是主帳號、會 ✅ 不 Blocked）
- 訪 `https://happy.nuwa.chg2asc.com/admin/users`（custom domain）
- 看到 12 user（少了刪掉的 team02）、所有功能 work ✅

---

## 9. Bonus：Vercel 清理（10 分鐘）

### 9.1 為什麼要清

```
原本 5 個 Vercel project 全掛同 GitHub repo：
- happy-nuwa-app
- happy-nuwa-app-v1
- happy-nuwa-app-v2 ← 有 custom domain
- happy-nuwa-app-v3 ← Steve test 用
- happy-relationship-app

問題：
- 每次 push trigger 5 個 deploy（純浪費）
- PR 頁面 5 個 Vercel checks（noise）
- Vercel credits 月底用爆
```

### 9.2 行動前 3 個確認（critical、不可跳過）

1. **確認 production 真實 URL**：哪個給 user 用的？（這次 = `happy.nuwa.chg2asc.com`、綁在 v2）
2. **check 其他 4 個 project 有沒有 custom domain**：避免刪了 domain 還在外面、broken user 流量
3. **env vars 完整**：保留下來的 project 必須有齊全 keys

### 9.3 搬 custom domain（zero downtime）

跟 Claude 對話、Claude 教 Vercel UI 操作：
1. v3 → Domains tab → Add Existing → 輸入 `happy.nuwa.chg2asc.com`
2. Vercel 偵測「domain 在 v2、Move 過來？」→ 確認
3. 秒搬完成、訪 custom domain 已從 v3 serving

### 9.4 刪 4 個 project

每個 project：Settings → General → 滑底 Danger Zone → Delete Project → 輸入 project 名稱 confirm。

刪完只剩 1 個 `happy-nuwa-app-v3`、清爽。

### 9.5 真實踩坑 #5：Vercel UI 改版了

```
舊版 Domains 在：Project → Settings → Domains
新版 Domains 在：Project → 左側 sidebar → Domains（在 Environment Variables 下方）
```

→ takeaway：「**SaaS 工具 UI 會改、不要記死路徑、記功能名找**。」

---

## 10. 8 個今天踩過的真實坑（10 分鐘）

| # | 坑 | 怎麼解 | takeaway |
|---|---|---|---|
| 1 | zsh `[id]` 要 escape | 用引號包 `"[id]"` | shell 特殊字元要 escape |
| 2 | route.ts 放錯資料夾、`/admin/users` 變 JSON 而非 UI | mv 到 `src/app/api/...` | Next.js App Router 規則：API 必須在 `/api/` 底下 |
| 3 | TypeScript `typeof journeys[0]` 失敗 | 改 explicit interface | nullable array 不能用 `[0]` |
| 4 | RLS 把 service_role 也擋了、audit log silent fail | Migration 010 DISABLE RLS | **dev server terminal 必查、silent fail 都在那** |
| 5 | DELETE 被 FK 擋（invite_codes / admin_audit_logs） | Migration 011 改 SET NULL | **DB schema 設計時就要想 delete 行為** |
| 6 | Vercel 5 個 project 全 Blocked PR check | Merge 後自動解（merge commit author = 主帳號） | Vercel 對 unknown author 預防性 block |
| 7 | Custom domain 在錯的 project | Vercel UI「Add Existing」→ 自動偵測 Move | 平移 domain 是 zero downtime 的、不用怕 |
| 8 | Vercel UI 改版、Domains 不在 Settings | 左側 sidebar 找 Domains | SaaS UI 會改、學「找功能」不是「背路徑」 |

**子奇老師對鏡頭講**：
> 「每一個坑都是我今天踩的、影片裡你看到我跟 Claude 怎麼 debug。
>
> **debug 不是『工程師天賦』、是『系統化問問題』**。看 error → 給 Claude → Claude 給假設 → 你驗證 → 對症下藥。
>
> 你不用會 debug、你會問 Claude 就好。但你得**訓練自己看 error message + 看 server terminal + 跑驗證 SQL 的習慣**。」

---

## 11. 收尾 + Homework + Episode 3 預告（5 分鐘）

### 11.1 你今天學了什麼（2 min）

跟 Episode 1 重複的：DB / TypeScript / React / Git / PR / Vercel deploy

**新學的 8 個 skill**（Episode 2 獨家）：

| Skill | 哪一段學到的 |
|---|---|
| **Cursor pagination** | Session 2A 列表 |
| **React state + debounce** | Session 2A search box |
| **多表 query + JS 聚合** | Session 2A + 2B |
| **field-by-field PATCH validation** | Session 2C |
| **Modal component pattern** | Session 2C EditUserModal |
| **DB FK cascade / SET NULL / RESTRICT** | Session 2D Migration 011 |
| **Audit log 設計**（before/after diff） | Session 2C |
| **Self-protection 防自鎖** | 跨整個 Week 2 |
| **Vercel custom domain 平移** | Bonus 清理 |

### 11.2 Homework（2 min）

1. **跑通你自己的 Week 2**（從 Migration 009 跑起、5 個 session 全做）
2. **真實刪掉 1 個你 dev DB 的測試 user**、看 cascade work
3. **看 admin_audit_logs 表**、確認 audit log 寫進去
4. （optional）**清理你 Vercel 多餘 project**（如果有）
5. 完成 PR merged + production 跑通 → 來社群截圖、我蓋章 ✅

### 11.3 Episode 3 預告（1 min）

「下集：**Journey 管理**（spec §3.2）

範圍比 Week 2 簡單：
- read-only（不用 PATCH / DELETE / modal）
- 列表 + 詳情、聚焦『找 stuck user』
- 預估 2-3 sessions、4-6 hours

學完你會：用 admin 角度監控 user 進度、找出 21 天卡住的 user。

訂閱、按讚、下集見。」

---

## 12. 配套講義大綱

[完整 step-by-step 講義之後寫、約 20-30 頁 A4]

包含：
- Week 2 全 5 session 操作步驟
- 每段 Claude prompt 範本
- 8 個踩坑「症狀 → 怎麼問 Claude」對照表
- SQL audit query 模板
- Vercel custom domain 平移 SOP

---

## 13. 拍片技術建議

- 拍片重點：**dev server terminal** 要錄到、踩坑 #4 RLS 那段就是看 terminal 才找到 root cause
- 螢幕同時開：browser + VS Code + terminal + Supabase Dashboard 4 個視窗、切換要快
- 編輯時把長 debug 過程加速 2x、保留 Claude 答覆關鍵段

---

## 14. 給 Steve 的 review checklist

拍前 Steve review、勾完跟 Claude 說「拍板 X」、出 v0.2 完整劇本：

- [ ] 片名 / 副標：OK？
- [ ] 5 sessions 順序：OK？
- [ ] Bonus Vercel 清理放這集 vs 獨立 Episode 0.5？
- [ ] 8 個踩坑全展示 vs 簡化 3-4 個？
- [ ] Homework 設計：5 個 task 太重 / 太輕？
- [ ] Episode 3 預告：Journey 管理 OK 還是先休息出？
- [ ] 時長 75-90 分：可接受？要拆上下集嗎？

---

## 15. 版本紀錄

| 版本 | 日期 | 變更 |
|---|---|---|
| v0.1 | 2026-05-31 | 初稿、依 2026-05-30~31 Steve+Claude Week 2 完整協作對話 + Vercel 清理轉成課程 Episode 2 草稿、含 5 sessions + bonus + 8 踩坑 + Episode 3 預告 |

---

**結尾 note**：Episode 2 跟 Episode 1 形成「框架 → 第一個真實 module」的完整二集弧。Episode 3 開始進入「擴展模式」、每集對應一個 Week / 一個 module。

— Steve（子奇老師）+ Claude AI 協作、2026-05-31
