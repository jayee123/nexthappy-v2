# 本機開發環境設定（私版 nexthappy）

本文件的每一步都在一個乾淨的 PostgreSQL 15 容器上實際跑過，
包含下面標示 ⚠️ 的四個陷阱 —— 那些都是實測時真的撞到的，不是預防性提醒。

搭配公版一起跑的整合設定見最後一節。

---

## 0. 需要準備的東西

| | 說明 |
|---|---|
| Node.js | 專案使用的版本見 `package.json` |
| 一個 Supabase project | **用你自己的**，不要連公司正式站 |
| Anthropic API key | 你自己的（按用量計費） |
| Docker（選用） | 只有要跑本機 Postgres 才需要 |

---

## 1. 建立資料庫

私版的資料放在同一個 Supabase project 的 `happy` schema，
`public` schema 則是公版的 —— 兩者靠 `happy.users.nuwa_user_id` 串接。
因此**公版的表也要建**，私版才讀得到方案與帳號資料。

在 Supabase SQL Editor 依序執行：

### 1-1 公版 schema（`public`）

把 `nuwa/v2/supabase/migrations/` 的 23 支 SQL **依編號順序**貼上執行。
（你對該 repo 有讀取權限，clone 下來即可取得。）

### 1-2 建立 happy schema

```sql
CREATE SCHEMA IF NOT EXISTS happy;
SET search_path TO happy, public;
```

> ⚠️ **陷阱 1：私版的 migration 沒有 schema 前綴、也沒有自己設 `search_path`。**
> 忘了先 `SET search_path` 就執行，`users`、`journeys` 這些表會被建到 `public`，
> 跟公版的 `users` 表撞在一起。**這不會報錯**，只會安靜地做出一個壞掉的資料庫，
> 事後極難查。每開一個新的 SQL Editor 分頁都要重設一次。

### 1-3 私版 schema

> ⚠️ **陷阱 2：順序不能顛倒 —— 先 combined，後 migrations。**
> `migrations/001_v2.1_schema.sql` 只建了 8 張表，
> 核心的 7 張（`users`、`journeys`、`conversations`、`daily_records`、
> `daily_memories`、`achievements`、`course_content`）**只存在於
> `combined-happy-schema.sql`**。
> 直覺地「從 001 跑到 013」會在 002 就失敗：`relation "course_content" does not exist`。

依序執行：

1. `supabase/combined-happy-schema.sql`
2. `supabase/migrations/` 的 13 支，依編號順序

> ⚠️ **陷阱 3：`combined-happy-schema.sql` 不是最新的。**
> 它缺少 `012`／`013` 加的訂閱欄位（`current_plan`、`payment_method_token` 等），
> 也缺少 `007` 把 `conversations.user_id` 改成必填的變更。
> 所以它**不能單獨使用**，一定要接著跑完 migrations。

### 1-4 灌測試資料

```sql
-- supabase/dev-seed.sql
```

這份是**合成資料**，不含任何真實用戶內容。內容由
`scripts/dev-seed/personas.mjs`（素材）與 `generate.mjs`（產生器）決定，
要調整請改那兩支再重新產生：

```bash
node scripts/dev-seed/generate.mjs supabase/dev-seed.sql
```

產生器是決定性的（固定 UUID + 固定亂數種子），重跑不會產生無意義的 diff。

灌進去之後有 7 個測試人物，各自對應一種開發時會卡住的狀態：

| 人物 | 方案 | 進度 | 為什麼需要這一筆 |
|---|---|---|---|
| 全新 | trial | **沒有 journey** | 空狀態畫面 |
| 初期 | basic | 3/21 | 低百分比進度條 |
| 進行中 | advanced | 12/21 | 日常開發主力，資料最完整 |
| 已完課 | premium | 21/21 | 結業畫面、進度 100% 不溢位 |
| 已退訂 | cancelled | 8/21 | 方案失效後舊資料還讀不讀得到 |
| 邊界值 | premium | 5/21 | 超長日記、emoji、單輪對話、null 欄位 |
| 親子 | basic | 6/21 | `relationship_type` 非 couple，文案會變 |

---

## 2. 設定環境變數

複製 `.env.example` 成 `.env.local` 並填值。各變數的必要性與敏感度見該檔註解。

`JWT_SECRET` 與 `SSO_SECRET` 自己產一把即可，不必與任何人相同：

```bash
openssl rand -base64 48
```

---

## 3. 啟動

```bash
npm install
npm run dev
```

---

## 4. 登入

> ⚠️ **陷阱 4：直接開 `http://localhost:3000` 會登不進去。這是正常的。**
>
> 私版已經沒有自己的登入頁 —— 帳號真值只在公版。未登入的請求會被
> middleware 導向公版登入頁，而公版登入後是依資料庫 `apps.app_url`
> 把人送回**該欄位指定的網址**，不會回到你的 localhost。

用這支自己簽一張 SSO token 打進本機的 `/sso`：

```bash
node scripts/dev-login.mjs <nuwa_user_id>
```

它會印出一個 120 秒內有效的網址，貼進瀏覽器即可取得 session。

`nuwa_user_id` 用 seed 建好的測試人物，例如「進行中」那位：

```
d0000000-0001-4000-8000-000000000003
```

（全部 7 個 id 是 `d0000000-0001-4000-8000-00000000000N`，N = 1..7，
順序同上表。）

**這不是後門**：`/sso` 該做的驗證一項都沒少，只是簽發者從公版換成你自己 ——
你本機的 `SSO_SECRET` 本來就是你自己設的。

---

## 5. 與公版一起跑（整合開發）

兩個都是 Next.js，預設都搶 3000，要分開：

```bash
# 終端機 A — 公版
cd nuwa/v2 && PORT=3000 npm run dev

# 終端機 B — 私版
cd nexthappy && PORT=3001 npm run dev
```

兩邊各自加上這組環境變數，讓 SSO 在本機互相找得到：

| repo | 變數 | 值 |
|---|---|---|
| 公版 | `DEV_APP_URL_HAPPY` | `http://localhost:3001` |
| 私版 | `NEXT_PUBLIC_MARKET_BASE_URL` | `http://localhost:3000` |

> 🚨 **不要為了讓本機通而去改資料庫的 `apps.app_url`。**
> 那是正式站 SSO 的目標網址 —— 改了會讓所有真實用戶被導去你的 localhost。
> 上面兩個環境變數存在的理由就是避免任何人需要動那一欄。

設定完成後，本機公版的「App 服務 → 幸福關係」就會正確導向本機私版。

> `NEXT_PUBLIC_*` 會在 build 時寫死進 bundle。設過 localhost 之後，
> **不要拿本機的 build 產物去部署**。

---

## 疑難排解

| 症狀 | 原因 |
|---|---|
| `relation "course_content" does not exist` | 陷阱 2：沒有先跑 `combined-happy-schema.sql` |
| 表建到了 `public` 而不是 `happy` | 陷阱 1：忘了 `SET search_path TO happy` |
| 插入 `conversations` 失敗說 `user_id` 不可為 null | 陷阱 3：沒跑完 migrations（`007` 才加這欄） |
| 一直被導去正式站的登入頁 | 陷阱 4：用 `scripts/dev-login.mjs` 登入 |
| 登出按鈕沒反應 | `NEXT_PUBLIC_MARKET_BASE_URL` 少了 `NEXT_PUBLIC_` 前綴 |
| `/chat` 沒有回應 | `ANTHROPIC_API_KEY` 未設定或額度用盡 |
