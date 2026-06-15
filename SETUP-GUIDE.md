# 🕊️ 21天幸福關係練習系統 - 部署指南

## 你需要申請的帳號（全部免費）

### Step 1：Anthropic Claude API Key
1. 前往 https://console.anthropic.com/
2. 點「Sign Up」，用 Email 或 Google 帳號註冊
3. 進入後點左側 **API Keys** → 「Create Key」
4. 複製 API Key（格式：`sk-ant-api03-xxxxx`）
5. ⚠️ **需要綁定信用卡才能使用**（建議預付 $5-10 USD，100學員每月約 $30）

### Step 2：Supabase（資料庫）
1. 前往 https://supabase.com/
2. 點「Start your project」，用 GitHub 帳號登入（最方便）
3. 點「New project」
   - 填入專案名稱：`happy-relationship`
   - 設定資料庫密碼（記住！）
   - Region 選 **Southeast Asia (Singapore)**
   - 點「Create new project」（等 2 分鐘）
4. 建立好後，左側點 **Settings → API**
5. 複製三個值：
   - `Project URL`（格式：`https://xxxxx.supabase.co`）
   - `anon public` key
   - `service_role secret` key（點 reveal 才看得到）

### Step 3：建立資料庫
1. 在 Supabase 左側點 **SQL Editor**
2. 點「New query」
3. 複製貼上 `supabase/schema.sql` 全部內容 → 點「Run」
4. 再新增一個 query，複製貼上 `supabase/functions.sql` → 點「Run」

### Step 4：GitHub（存放程式碼）
1. 前往 https://github.com/ 並登入（或免費註冊）
2. 右上角 **+** → **New repository**
   - Repository name: `happy-relationship-app`
   - 設為 **Private**
   - 點「Create repository」
3. 把程式碼推上去（在你的電腦終端機執行）：
   ```bash
   cd happy-relationship-app
   git init
   git add .
   git commit -m "feat: initial commit"
   git remote add origin https://github.com/你的帳號/happy-relationship-app.git
   git push -u origin main
   ```

### Step 5：Vercel（部署）
1. 前往 https://vercel.com/ 並用 GitHub 帳號登入
2. 點「Add New → Project」
3. 找到 `happy-relationship-app` → 點「Import」
4. 在 **Environment Variables** 填入以下內容（全部都要填！）：

| 變數名稱 | 值 |
|---------|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 你的 Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 你的 anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | 你的 service_role key |
| `ANTHROPIC_API_KEY` | 你的 Claude API key |
| `JWT_SECRET` | 隨機字串（例如到 https://randomkeygen.com/ 取一個 256-bit key）|
| `ENCRYPTION_KEY` | 64位的隨機 hex 字串（到 https://generate.plus/en/hex 產生64位）|
| `NEXT_PUBLIC_APP_URL` | `https://happy.nuwa.chg2asc.com` |

5. 點「Deploy」（等 3-5 分鐘）
6. 部署成功後，點「Settings → Domains」
7. 點「Add」，輸入：`happy.nuwa.chg2asc.com`
8. Vercel 會給你一個 CNAME 值，例如：`cname.vercel-dns.com`

### Step 6：GoDaddy DNS 設定
1. 登入 GoDaddy → My Products → DNS
2. 找到你的網域 `nuwa.chg2asc.com`（或其上一層 `chg2asc.com`）
3. 新增一筆 **CNAME** 記錄：
   - Type: `CNAME`
   - Name: `happy`（這樣會產生 `happy.nuwa.chg2asc.com`）
   - Value: Vercel 給你的 CNAME 值（例如 `cname.vercel-dns.com`）
   - TTL: 1 Hour
4. 等 5-30 分鐘讓 DNS 生效
5. 回到 Vercel → Domains，它會自動驗證並啟用 HTTPS

---

## 🎉 完成！測試你的 App

1. 前往 https://happy.nuwa.chg2asc.com
2. 用邀請碼 `HAPPY-2026-BETA` 註冊第一個帳號
3. 完成 Day 0 引導設定
4. 開始和小羽對話！

---

## 管理邀請碼

在 Supabase **Table Editor → invite_codes** 可以新增或查看邀請碼。

新增邀請碼的 SQL：
```sql
INSERT INTO invite_codes (code, expires_at) VALUES
  ('你的邀請碼', NOW() + INTERVAL '6 months');
```

---

## 常見問題

**Q: 小羽沒有回應？**
- 檢查 Vercel 的環境變數 `ANTHROPIC_API_KEY` 是否正確
- 在 Vercel Functions Log 查看錯誤

**Q: 資料庫連線錯誤？**
- 確認 `NEXT_PUBLIC_SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY` 正確

**Q: 怎麼更新課程內容？**
- 在 Supabase Table Editor → course_content 直接編輯

---

## 費用估算（100名學員）

| 項目 | 費用 |
|-----|------|
| Vercel | 免費 |
| Supabase | 免費（500MB 夠用） |
| Claude API | ~$30 USD/月 |
| GoDaddy 網域 | 已有，無額外費用 |
| **合計** | **~$30 USD/月（約 NT$960）** |
