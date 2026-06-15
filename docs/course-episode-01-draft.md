# 課程草稿 — Episode 1：1 天從 0 到 Production

> **「用 Claude 蓋一個真實在跑的後台管理系統」**
> ─ 子奇老師 × Claude 結對開發實戰示範

- 版本：**Draft v0.1（2026-05-29 課程草稿）**
- 隸屬：**羽升升維 Stack 元產品 — 「教學員用 Claude 開發 APP」課程系列第 1 集**
- 上游：[`positioning-v0.4-升維-stack.md`](./positioning-v0.4-升維-stack.md) §8（教學課程提案）
- 來源原始素材：2026-05-29 子奇老師（Steve）+ Claude 完整協作對話 + commit history（commit `e21f975` ~ `51ed088`）
- 目的：給 Steve 拍片參考 + 文字配套講義雙用
- 狀態：⚠️ 草稿、需 Steve 拍前 review 拍板腳本順序、刪減冗長處

---

## 0. Episode 元資料

| 項目 | 內容 |
|---|---|
| **集數** | Episode 1 |
| **片名候選** | 「1 天從 0 到 Production：用 Claude 蓋一個真實在跑的後台」 |
| **副標** | 「沒寫過程式的我、怎麼用 AI 從零做出 admin dashboard」 |
| **目標時長** | 60-75 分鐘（含 chapter）/ 拍完剪 45-55 分鐘 |
| **目標學員** | 子奇老師既有學員 + 想用 AI 蓋 APP 變現的創業者；**前提：不會寫程式、會用電腦、有 GitHub 帳號** |
| **學員學完能做到** | 用 Claude 把任何「我想做一個 X 功能」變成 production 上跑的 feature；學會 git workflow 與 PR review；不再害怕看 code |
| **前置（不會也沒關係、影片中講）** | macOS Terminal 基礎、Chrome 使用、Gmail 帳號 |
| **配套素材** | (1) GitHub repo（學員 fork）(2) 文字講義（本份）(3) 投影片 |

---

## 1. 整體故事弧（學員旅程）

```
🪝 開場（5 min）
   「你看著 Jeff 工程師那種神祕、覺得自己永遠不會嗎？
    我今天 1 天從零做出來給你看。」
        ↓
🌱 為什麼這條路是對的（10 min）
   「不靠捷徑、靠真功夫 → 升維哲學鋪墊」
   「Claude 不是來幫你『偷懶』、是幫你『升維』」
        ↓
🛠 實戰 6 個 module（45 min）
   Module 1: DB Migration（10 min）
   Module 2: Auth Helper（10 min）
   Module 3: Admin Layout + Sidebar（10 min）
   Module 4: 7 個 Placeholder Pages（5 min）
   Module 5: Git + PR 流程（10 min）
   Module 6: Vercel Production Deploy（5 min）
        ↓
🪞 我犯過的 5 個錯（你也會犯、不用怕）（5 min）
        ↓
🚀 預告下集 + Homework（5 min）
```

**核心 narrative**：「我（子奇）不是程式背景、但我用 Claude 1 天蓋出來。你跟著做、3 天也能做出來。」

---

## 2. 開場 Hook（5 分鐘）

### 2.1 Cold open（30 秒）

直接放成果畫面：
- 螢幕錄影：打開 https://happy-nuwa-app-v3.vercel.app/admin
- 看到 sidebar + Dashboard + 7 個 nav links 都運作
- 旁白：「這是我今天做的後台、production 上跑的、沒寫一行 code 從 0 開始。」

### 2.2 為什麼你應該看完這集（3 分鐘）

**子奇老師對鏡頭講**：

> 「過去 10 多年我教奇門遁甲、學員問我最多的問題：『老師、我也想用 AI 做個 APP、但我不會寫程式、怎麼開始？』
>
> 我自己也卡在這個問題很久。直到我發現：**不是要會寫程式、是要會「跟 Claude 對話」**。
>
> 今天這集、我要把我**今天 1 天**從零做出後台管理系統的**全部過程**show 給你看。
>
> 不是教學影片、是**實戰側錄**。包含我踩過的坑、Claude 給的錯指令、我怎麼 debug。
>
> 看完你會發現 3 件事：
> 1. 蓋 APP 沒有想像中難
> 2. Claude 是你的工程師 partner、你是 product owner
> 3. **真正的 moat 不在會寫 code、在你會 articulate 你要什麼**
>
> 這就是我們課程系列的第一集。準備好了嗎？」

### 2.3 對標 anti-pattern（1.5 分鐘）

**指出市場上 AI 課的兩個 fail mode**：
- ❌ 「3 天學會 Python」→ 教語法、學完不會做產品
- ❌ 「ChatGPT 寫 100 個 prompt」→ 教 prompt engineering、學完做不出商業可用的東西
- ✅ 「**用 Claude 1 天蓋一個 production 後台、3 個月你能 ship 第一個 APP**」

「我們教的是**第三條路**、實戰、接地氣、看得到結果。」

---

## 3. 為什麼這條路是對的（10 分鐘）

### 3.1 升維哲學鋪墊（5 分鐘）

> 子奇老師：「教奇門遁甲 10 年、我看到太多人用『外掛 / 捷徑 / 求老天』思維解決事業 / 賺錢 / 關係問題。短期有效、長期讓你失去『自己長能力』的機會。
>
> 用 AI 做產品也是。你可以叫 ChatGPT 幫你寫一段 code、貼上去、沒壞就好。**但你永遠不知道發生什麼**、出 bug 你不會 debug、要 scale 你不會擴展。那是『**外力**』。
>
> 我今天要教的是『**自力**』—— 用 Claude 結對協作、**你理解每一步**、Claude 寫 code、你 review、你 ship。出 bug 你跟 Claude 一起 debug、Claude 解釋給你聽。
>
> 練 1 個月、你會發現你**真的會了**。不是『會背 code』、是會『設計 + ship feature』。
>
> 這就是『**升維**』—— 從『不會 → 會背』升到『不會 → 會跑流程 → 會評估好壞』。」

（這段對應 `positioning-v0.4-升維-stack.md` §4 奇門 vs 心智成長哲學）

### 3.2 今天我做了什麼總覽（5 分鐘）

**用一張 diagram 概覽**（投影片）：

```
2026-05-29 子奇老師 1 天工作量

DB layer:        Migration 008 (1 個 SQL 檔)
Backend layer:   2 個 TypeScript helper
Frontend layer:  1 個 layout + 1 個 sidebar component + 7 個 page
Workflow:        1 個 feat branch + 1 個 PR + 1 次 merge + 1 次 production deploy

= 13 個檔案、589 行新 code、production 上跑

如果叫一般工程師、可能 3-5 天（含設計討論、stand-up、文件）
我用 Claude 結對、1 天搞定。
```

「這集影片我會把這 13 個檔案怎麼做、為什麼這樣設計、踩過哪些坑、show 給你看。」

---

## 4. 實戰 Module 1：DB Migration（10 分鐘）

### 4.1 什麼是 Migration？（2 分鐘）

**白話比喻**（給非技術學員）：

> 「你的 DB 像一棟房子的房間配置。每次你想多一個房間（新功能要存的資料）、就要寫一張**裝潢藍圖**告訴施工隊：『請在 X 牆挖一個門、Y 位置加一個櫃子』。
>
> 這張藍圖叫 Migration。寫好藍圖、跑一次施工、房間就改好了。
>
> 比起『手動進去 DB 一個一個改』、Migration 的好處是：（1）可重複跑（2）有歷史紀錄（3）team 其他人也能跑同一份藍圖、得到同一個房間配置。」

### 4.2 我今天要加的房間：admin 功能（1 分鐘）

「我要做後台管理、需要 2 個新東西：
1. `users` 表加一個欄位 `is_admin`（標記誰是 admin）
2. 新建 `admin_audit_logs` 表（記錄 admin 做過什麼）

對應的 Migration 檔我跟 Claude 對話、Claude 幫我寫 SQL。」

### 4.3 跟 Claude 對話實況（5 分鐘）

**Show 對話畫面**：

```
我：「我要做後台管理、需要 users 加 is_admin 欄位 + 新建 audit log 表、幫我寫 migration」

Claude：（給完整 SQL、含 ALTER TABLE / CREATE TABLE / INDEX / COMMENT / NOTICE）
```

**Show 把 SQL 貼進 Supabase SQL Editor、按 Run、看到 ✅ Success**

**Show 跳出 RLS warning**（這是學員一定會撞的坑）：

```
Potential issue detected
This query creates a table without enabling RLS.
[Run without RLS]  [Run and enable RLS]
```

**子奇老師講解**（接地氣）：
> 「這時候 Supabase 在問你：『要不要加一道鎖？』
>
> 我又問 Claude：『黃色 vs 綠色差別？選哪個？』
>
> Claude 解釋：『RLS = Row Level Security、像房間裡的保險箱。你後端 API 用 service role key 進來、有鑰匙、不受鎖影響。前端用 anon key 進來、沒鑰匙、被擋。對 admin 機密資料、加鎖比較安全。』
>
> 我選綠色『Run and enable RLS』、安全多一層。」

→ **takeaway**：「Claude 不只給 code、會幫你解釋 trade-off。你問就好。」

### 4.4 順手把 Steve 設為第一個 admin（2 分鐘）

跑一段：
```sql
UPDATE users SET is_admin = TRUE WHERE email = 'steveweng7@gmail.com';
```

「現在我就是後台管理員了。」

### 4.5 Module 1 takeaway

- ✅ 學會什麼是 Migration
- ✅ 學會把 Claude 給的 SQL 貼進 Supabase 跑
- ✅ 學會 Supabase 跳 warning 時怎麼問 Claude

---

## 5. 實戰 Module 2：Auth Helper（10 分鐘）

### 5.1 為什麼需要 Helper？（2 分鐘）

> 「想像你後台 7 個頁面、每個都要檢查『這個訪客是不是 admin』。
>
> 笨方法：每個頁面複製貼上同一段檢查 code、改一行就要改 7 個地方。
>
> 聰明方法：寫 1 個 helper、7 個頁面都呼叫它。改一次、7 個地方都生效。
>
> 這叫 **DRY 原則**（Don't Repeat Yourself）—— 不要重複自己。」

### 5.2 跟 Claude 對話寫 helper（5 分鐘）

我跟 Claude 講：

```
「寫一個 requireAdmin 中介層、給所有 /api/admin/* endpoint 用、
 檢查 3 件事：
 1. 有沒有登入（沒 → 401）
 2. 是不是 admin（不是 → 403）
 3. 找不到 user（→ 404）」
```

Claude 給完整 TypeScript code（49 行）、含完整 type 定義、註解、錯誤訊息中文化。

**Show code 給觀眾看一眼**：

```typescript
export async function requireAdmin(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return { error: NextResponse.json(...401...), ... };
  
  const { data: user } = await supabaseAdmin
    .from('users').select('id, email, is_admin')
    .eq('id', session.userId).single();
  
  if (!user?.is_admin) return { error: NextResponse.json(...403...), ... };
  
  return { error: null, session, adminUser: user };
}
```

「不用每一行都懂、知道**整體在做什麼**就夠了。」

### 5.3 第 2 個 helper：auditLog（3 分鐘）

「每次 admin 做動作（改 user MBTI / 停權 / grant 別人當 admin）、要記錄下來、未來能查。

跟 Claude 講：『寫 logAdminAction helper、寫進 admin_audit_logs 表、含 IP / user agent / 變更前後 diff』。

Claude 給 52 行 TypeScript code。我貼進 `src/lib/admin/auditLog.ts`。完成。」

### 5.4 驗證：`npx tsc --noEmit`（1 分鐘）

「跑這指令、確認 Claude 寫的 code 沒打錯字、type 都對。沒輸出 = ✅ 過關。」

### 5.5 Module 2 takeaway

- ✅ 學會什麼是 Helper / DRY 原則
- ✅ 學會請 Claude 寫 reusable code
- ✅ 學會用 TypeScript 編譯檢查（不用懂 TypeScript、會跑這指令就行）

---

## 6. 實戰 Module 3：Admin Layout + Sidebar（10 分鐘）

### 6.1 什麼是 Layout？（2 分鐘）

> 「Layout 就是『每個頁面共用的外框』。
>
> 想像一個雜誌：每一頁都有 header（雜誌名）+ footer（頁碼）、但中間內容每頁不同。Header + footer 那層叫 Layout、內容那層叫 Page。」

### 6.2 我要的後台 layout（1 分鐘）

```
┌─ 後台管理（雜誌名）─────────────┐
│ Sidebar  │   Page 內容          │
│ 7 nav    │   （每個 nav 點下去  │
│ links    │    換不同 page）     │
│ Footer   │                     │
└─────────────────────────────────┘
```

### 6.3 跟 Claude 對話建 layout + sidebar（5 分鐘）

我跟 Claude 講：

```
「建 admin/layout.tsx，server-side auth gate：
 - 未登入 redirect /auth/login
 - 非 admin redirect /chat
 - 渲染 sidebar + main content area

 加一個 AdminSidebar component：
 - 7 nav links: Dashboard / 用戶 / Journey / 對話 / 主題 / 課程 / 設定
 - 當前 active 那條 highlight 紫色
 - footer 顯示 admin email + 登出按鈕」
```

Claude 給完整 React code。我貼進 2 個檔案。

### 6.4 真實踩坑 #1：檔案放錯資料夾（2 分鐘）

「Claude 給的指令我照做、但 `/admin` 變 404。我以為 code 寫錯。

跟 Claude 求救、Claude 教我下 `ls src/app/admin/`、發現我把檔案放到 `src/components/admin/` 去了。

Next.js 規定 route 檔必須在 `src/app/<path>/page.tsx`、`components/` 是放 reusable 元件。

**這就是 Claude 結對的價值：debug 速度極快、Claude 知道一切框架規則。**」

→ takeaway：「**遇到問題、立刻問 Claude、不要自己鑽牛角尖**。」

---

## 7. 實戰 Module 4：7 個 Placeholder Pages（5 分鐘）

### 7.1 什麼是 placeholder？為什麼先做？（2 分鐘）

> 「Placeholder = 暫時的位子。
>
> 我要做 7 個後台模組、但今天 1 天做不完全部功能。我先建 7 個『空頁面』、每個寫『🚧 即將推出』、讓 sidebar 7 個 link 都點得了、用戶看得到藍圖。
>
> 這叫**先框架、再填內容**。蓋房子先打地基 + 立柱子、再裝潢。」

### 7.2 一次性建 6 個 placeholder page（2 分鐘）

跟 Claude 講：
```
「建 6 個 placeholder page：users / journeys / conversations / topics / course / settings
 每個 page 有：標題 + 副標 + 🚧 即將推出 card + 對應 spec 章節引用」
```

Claude 給 6 個檔案 code、我一個一個貼。1 分鐘搞定。

### 7.3 真實踩坑 #2：layout 太窄（1 分鐘）

「測試時發現 Dashboard 右邊內容超窄、3-col grid 中文字逼成直書。

我問 Claude『為什麼？』Claude 教我用 dev tools 量 viewport width。

最後找到 root cause：root layout 有 `max-w-md mx-auto`（給原本手機 chat 介面用的）卡住整個 app。

Claude 用 `fixed inset-0` 讓 admin layout 跳出限制、終於全寬。

**這集示範：debug 不是工程師的『天賦』、是『系統化問問題』的能力。** 」

---

## 8. 實戰 Module 5：Git + PR 流程（10 分鐘）

### 8.1 Git 是什麼？（2 分鐘）

> 「Git 像你寫小說的『存檔系統』。
>
> 每改完一段、按一次『save』、就建立一個版本快照。未來想看上禮拜的版本、或回到 3 天前那版、都做得到。
>
> 多人合作時、每個人在自己的 branch（草稿本）寫、寫完再合併到主稿。」

### 8.2 4 個指令 commit + push（5 分鐘）

**Live demo terminal**：

```bash
# 1. 看改了哪些檔案
git status

# 2. 把改動加進暫存區
git add supabase/migrations/008_admin_role_and_audit.sql \
        src/lib/admin/ src/app/admin/ src/components/admin/

# 3. 存成一個 commit（含說明訊息）
git commit -m "Week 1: Admin Dashboard foundation"

# 4. 上傳到 GitHub
git push -u origin feat/admin-dashboard
```

「commit 後我看了 `git log` 確認 author 是『Steve (as Jeff sim)』、用 dummy 帳號 commit、未來看 git history 看得出誰寫的。」

### 8.3 PR 流程（提交 + Review + Merge）（3 分鐘）

「PR 像作家把章節稿件**寄給總編輯審稿**。

我（用 dummy 帳號）開了 PR 寄給總編（我自己主帳號）。
總編進 GitHub 看 Files changed（12 個檔案、589 行）、點 Approve、點 Merge。
PR 從綠色 Open 變紫色 Merged。
草稿合進正式書（main branch）。」

**Show 截圖**：PR #1 從 Open → Approved → Merged 的 3 個狀態。

---

## 9. 實戰 Module 6：Vercel Production Deploy（5 分鐘）

### 9.1 Vercel 是什麼？（1 分鐘）

> 「Vercel 是『**自動上架平台**』。
>
> 你每次 push 到 GitHub main branch、Vercel 自動 build 你的 code、上架到 production 網址。
>
> 你不用自己租伺服器、不用配環境、push 完吃飯回來、網站就更新了。」

### 9.2 真實踩坑 #3：Vercel block dummy 帳號（2 分鐘）

「我 PR 用 dummy 帳號 push、Vercel 5 個 project 全部 ❌ Blocked、原因：『Git author steveweng-dev must have access to the project on Vercel』。

這不是 bug、是 Vercel 的**資安保護**：不認識的 GitHub 帳號 push、不自動上 production、防有人開惡意 PR。

解法：merge PR 後、merge commit 的 author 變成我主帳號 SteveWeng1108、Vercel 認得、5 個 project 都 ✅ Ready。」

→ takeaway：「**資安 block 不可怕、看 error message 就知道原因**。」

### 9.3 開啟 production 驗證（2 分鐘）

打開 https://happy-nuwa-app-v3.vercel.app/admin、login、看到後台 Dashboard。

「**這是 production、現在全世界都看得到、admin dashboard 真的上線了**。」

🎉

---

## 10. 我犯過的 5 個錯（你也會犯、不用怕）（5 分鐘）

整集示範時抓到的真實坑：

| # | 坑 | 怎麼解 |
|---|---|---|
| 1 | zsh 不認 `#` 註解、整段 paste 失敗 | 一行一行貼、或開 `setopt interactivecomments` |
| 2 | 檔案放錯資料夾、`/admin` 變 404 | 用 `ls` 查、跟 Claude 求救 |
| 3 | RLS warning 不知道選哪個 | 問 Claude、選綠色「Run and enable RLS」 |
| 4 | Dashboard 太窄、文字逼成直書 | dev tools 量 viewport、找 root cause（root layout `max-w-md`） |
| 5 | Vercel Blocked、不知道為什麼 | 看 error message、是資安 block、merge 後自動解 |

**子奇老師對鏡頭講**：
> 「每一個坑都讓我花了 5-15 分鐘 debug。你今天看影片 5 秒鐘就知道、是因為**我已經幫你踩過了**。
>
> **第 1 次做的人會卡。第 2 次做的人會順。第 3 次做的人會教別人。** 你跟著我做就直接跳到第 2 次。」

---

## 11. 收尾 + Homework + 下集預告（5 分鐘）

### 11.1 你今天學了什麼總結（2 分鐘）

「跟著這集做完、你已經會：

✅ DB Migration（用 SQL 改 schema）
✅ TypeScript helper（請 Claude 寫 reusable code）
✅ Next.js Layout + Page（React 框架）
✅ Git commit + push（保存 + 上傳）
✅ GitHub PR（提案 + Review + Merge）
✅ Vercel 自動 deploy（上線到 production）

**8 個工程核心 skill**、一般人需要 2-4 週看書、你 1 集影片 + 跟著做 1 天搞定。」

### 11.2 Homework（2 分鐘）

「你的回家功課（建議今天 / 明天就做、不要拖）：

1. **fork 我的 repo**（連結在 description）
2. **照影片步驟做一次 Week 1**（從 Migration 008 跑起、到 PR merge）
3. **跑通你自己的 production /admin**

過程中卡關 → **問 Claude**、不要問我。我給 Claude 的 prompt 全部在講義裡、你可以照抄。

做完 PR merged + production 跑通 → 來社群截圖、我幫你蓋章 ✅。」

### 11.3 下集預告（1 分鐘）

「下集 Episode 2：**用戶管理模組**

我會帶你：
- 寫真正的 API endpoint（不是 placeholder）
- 把 DB 真實資料拉出來、顯示在後台列表
- 加搜尋 / filter / 編輯功能
- 真實互動完整 ship 一個 feature

下集預估 60 分鐘、學完你會 ship 你人生第一個 production CRUD 功能。

訂閱、按讚、開鈴鐺 🔔。我們下集見。」

---

## 12. 配套講義（給學員邊看邊跟做）

**這份直接複製到 PDF / Notion 給學員下載**

### 12.1 環境準備清單

- [ ] Mac / Windows 電腦
- [ ] GitHub 主帳號 + dummy 帳號（用 Gmail `+dev` alias 技巧）
- [ ] Supabase 免費帳號 + 新建 project
- [ ] Vercel 免費帳號（用 GitHub login）
- [ ] Cursor IDE 或 VS Code
- [ ] Terminal + git 基礎指令會跑

### 12.2 Step-by-step 操作講義

[此處整理今天 Week 1 全部 Step 1-4 操作步驟、含每段 Claude 對話 prompt + 期望輸出 + 踩坑提示]

（草稿階段、Steve review 時補完整 step-by-step、約 30-50 頁 A4）

### 12.3 「卡關自救」對照表

| 症狀 | 怎麼問 Claude |
|---|---|
| `/admin` 404 | 「我的 /admin 404、檔案放對了嗎？」+ 貼 `ls src/app/admin/` 結果 |
| TypeScript error | 「Cannot find module @/lib/auth、怎麼解？」 |
| Vercel Blocked | 「Vercel 顯示 Git author X must have access、什麼意思？」 |
| Layout 太窄 / 太寬 | 「Layout 看起來怪、幫我量 main.clientWidth / aside.clientWidth / body.clientWidth、debug」 |
| Supabase RLS warning | 「Run without RLS vs Run and enable RLS、選哪個？」 |

---

## 13. 拍片技術建議（給 Steve 拍前準備）

### 13.1 設備

- 1080p 螢幕錄影（QuickTime / OBS Studio）
- 收音麥（領夾麥推薦、低底噪 + 清晰）
- 攝影機 / iPhone 拍 talking head（開場 + 中段過場 + 收尾）

### 13.2 拍攝順序建議

1. **先拍 talking head 部分**（開場 / 各 Module 的 intro 講解 / 收尾）
2. **再 screen record 操作部分**（terminal + browser + VS Code）
3. **剪接時**：talking head + screen record 交叉剪、節奏感

### 13.3 剪輯建議

- **加 subtitle**（中英對照、提升海外傳播）
- **關鍵段落加 emphasized 字卡**（「踩坑 #1」「⭐ Claude 對話」）
- **節奏控制**：每 5-7 分鐘有 1 個 callout / 強調點、避免冗長

### 13.4 上架平台

- YouTube（主、長片完整版）
- B 站 / 抖音 / Threads（剪短 1-3 分鐘 clip 引流）
- 自家課程平台（完整版 + 講義 PDF + 配套 repo）

---

## 14. 商業 model 建議（給 Steve 拍板）

### 14.1 定價建議

| 方案 | 內容 | 售價 |
|---|---|---|
| **單集購買** | Episode 1 影片 + 講義 + repo | NT$1,500 |
| **完整 10 集系列** | 全部 episode + 講義 + 1 對 1 諮詢 1 小時 | NT$25,000-35,000 |
| **VIP 包月共修** | 完整課程 + 月度 Q&A + 社群 | NT$3,000 / 月 |

### 14.2 上市節奏

- **第 1 階段**：第 1 集免費公開（YouTube）、引流用、build trust
- **第 2 階段**：第 2-3 集付費（單集 / 完整系列）
- **第 3 階段**：完整 10 集 + 後續課程（奇門 AI APP / 創富 AI APP）形成 ecosystem

### 14.3 目標 audience（per positioning v0.4 §6）

- 子奇老師既有命理學員（trust pre-existing）→ first 100 buyer
- 想用 AI 創業的中年中產（35-55 歲、有事業基礎、想找新方向）
- 對「不靠捷徑、靠真功夫」哲學 resonate 的學員

---

## 15. 版本紀錄

| 版本 | 日期 | 變更 |
|---|---|---|
| v0.1 | 2026-05-29 | 初稿、依 2026-05-29 Steve + Claude Week 1 admin dashboard 完整協作對話轉成課程 Episode 1 草稿、含開場 hook + 6 module 實戰 + 5 踩坑 + 配套講義大綱 + 拍片建議 + 定價提案 |

---

## 16. 給 Steve 的 review checklist

拍片前、Steve 自己 review 這份草稿、確認：

- [ ] **片名 / 副標**：你滿意嗎？想改哪段？
- [ ] **時長**：60-75 分目標、要不要拆成上下集（30 + 30）？
- [ ] **開場 hook**：cold open 用 production 畫面 OK 嗎？
- [ ] **升維哲學鋪墊**：你想多談一點 / 少談一點？
- [ ] **6 個 module 順序**：DB → Helper → Layout → Page → Git → Deploy、OK 嗎？
- [ ] **5 個踩坑**：完整呈現 vs 簡化 vs 拿掉？
- [ ] **homework 設計**：fork repo + 跟著做 + 來社群截圖、會不會太重 / 太輕？
- [ ] **下集預告**：Episode 2 = 用戶管理、OK 還是改別的？
- [ ] **講義細節度**：30-50 頁 A4、合適嗎？
- [ ] **定價**：NT$1,500 單集 / NT$25-35k 完整、可接受嗎？

review 完跟 Claude 說「拍板 X / Y / Z」、Claude 出 v0.2 拍攝完整劇本。

---

**結尾 note**：這份是 Episode 1 草稿、未來 Episode 2-10 依此模板擴展。每集都對應一個 Week / 一個明確的 production feature ship、學員看完跟著做 = 真的會 ship。

— Steve（子奇老師）+ Claude AI 協作、2026-05-29
