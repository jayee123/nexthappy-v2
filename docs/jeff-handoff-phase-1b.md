# Jeff 接手 Phase 1B 交接清單

- 對象：Jeff（工程師）
- Steve 開會日期：2026-06-11
- 你接手的範圍：**紅陽金流串接 + Trial 自動轉換 + 升降級 / 取消 / 失敗扣款重試**
- Phase 1A（DB schema + 訂閱 UI + 用量追蹤 + Admin module）**已完成**、你直接 build on top of it

---

## 0. 一頁看懂

**現況**：
- Steve 的羽升幸福養成學苑訂閱系統**框架已 100% 就緒**、就差金流
- 所有內測 user 預設「Premium」、暫不擋額度（BILLING_ENFORCEMENT=false）
- Spec、UI、Admin 管理頁、用量追蹤 middleware **全部 ready**

**你的任務**：
1. 串紅陽（Steve 公司既有金流商）
2. 加 Trial 7 天 auto-convert
3. 加升降級 / 取消 / 失敗重試
4. 完成後翻 `BILLING_ENFORCEMENT=true` 上線

**估時**：6-10 工作天（看你跟紅陽溝通速度）

---

## 1. 先讀這 5 份文件（按順序）

1. **本文件**（你現在看的）
2. [`admin-user-guide.md`](./admin-user-guide.md) — 後台管理使用手冊、了解 admin 操作 + tech stack 紀律
3. [`admin-dashboard-spec-v0.1.md`](./admin-dashboard-spec-v0.1.md) — 後台 7 模組規格（已實作完）
4. [`v2.1-course-spec.md`](./v2.1-course-spec.md) §13 — Mode B 諮詢設計（不用全讀、了解產品脈絡即可）
5. **訂閱定價結構**：Basic NT$299/月（80 則） / Advanced NT$699（200 則） / Premium NT$1888（500 則） / Trial 7 天 100 則上限

---

## 2. 環境準備

Steve 會給你：

| 資源 | 你需要的權限 |
|---|---|
| GitHub repo `SteveWeng1108/happy-relationship-app` | Write |
| Supabase project | Read（先）→ Admin（之後） |
| Vercel project `happy-nuwa-app-v3` | Read（看 deploy 日誌）→ 之後可能要設 env var |
| 後台 admin 帳號 | Steve 進 `/admin/settings` 把你 email 升 admin |
| 紅陽商家後台 | 從 Steve 公司既有合約取得 |
| `.env.local` 變數 | Steve 提供 |

**先做**：
```bash
git clone git@github.com:SteveWeng1108/happy-relationship-app.git
cd happy-relationship-app
npm install
cp .env.example .env.local  # 從 Steve 拿真實 keys
npm run dev
```

確認 dev mode 跑得起來、能登入後台、看到訂閱管理 / 用量分析頁。

---

## 3. Phase 1A 已完成清單（你 build on top of 這些）

### 3.1 DB Schema（Migration 012）

```sql
-- 訂閱方案 enum
CREATE TYPE plan_tier AS ENUM ('trial', 'basic', 'advanced', 'premium', 'cancelled');

-- users 表 6 個新欄位（已 grandfather 所有現有 user = 'premium'）
users.current_plan plan_tier DEFAULT 'premium'
users.trial_started_at TIMESTAMPTZ
users.subscription_started_at TIMESTAMPTZ
users.subscription_renews_at TIMESTAMPTZ
users.payment_method_token TEXT     -- ← 你要填這個
users.auto_renewal BOOLEAN DEFAULT TRUE
users.cancelled_at TIMESTAMPTZ

-- 新 table：每月用量
usage_quotas (
  user_id, period_start (該月 1 號), messages_count, tokens_input,
  tokens_output, cost_twd_estimated, updated_at
)

-- 新 table：每次 AI 呼叫精準 token log（給 billing reconciliation）
ai_usage_logs (
  id, user_id, conversation_id, context_type, model,
  input_tokens, output_tokens, cost_twd, created_at
)
```

**Migration 檔案**：`supabase/migrations/012_subscription_system.sql`

### 3.2 Billing 核心 lib

| 檔案 | 用途 | 你會用到 |
|---|---|---|
| `src/lib/billing/plans.ts` | 4 方案定義、訂價、token cost rates | ✅ 別動結構、改價格找 Steve 確認 |
| `src/lib/billing/quotas.ts` | `checkQuotaAvailable` + `recordUsage` + `getCurrentUsage` + `isEnforcementEnabled` | ✅ Trial 邏輯擴充在這 |

### 3.3 AI Route Middleware（已串好）

`src/app/api/ai/chat/route.ts` + `consultant/route.ts` 都已加：

```typescript
// 前置：check 額度（BILLING_ENFORCEMENT=false 時永遠通過）
const quotaCheck = await checkQuotaAvailable(session.userId);
if (!quotaCheck.allowed) return 429;

// 後置：寫 usage log + 累加 quota
await recordUsage({ userId, conversationId, contextType, model, inputTokens, outputTokens });
```

✅ 你不用改 AI route、只要正確設 `BILLING_ENFORCEMENT=true`、額度檢查自動啟用。

### 3.4 User-facing UI

| 路徑 | 內容 | 你要改的地方 |
|---|---|---|
| `/settings/billing` | 3 方案 cards + 用量 progress + 「金流串接中」鎖定 modal | ✅ 把鎖定 modal 換成真實「選擇方案 → 跳紅陽」flow |
| `src/components/UsageChip.tsx` | chat header 用量 chip | 不用改 |

### 3.5 Admin UI（已完成、你不用動）

| 路徑 | 用途 |
|---|---|
| `/admin/subscriptions` | 看 user 訂閱狀態、手動改方案、啟動 trial、取消 |
| `/admin/usage` | API cost vs revenue 監控、Top 10 spender |

### 3.6 環境變數開關

```env
# .env.local（內測）
BILLING_ENFORCEMENT=false
```

當你**全部 Phase 1B 開發 + 測試完成後**、改：

```env
BILLING_ENFORCEMENT=true
```

立刻啟動全面額度檢查、扣款、trial 過期邏輯。

---

## 4. Phase 1B 你要做的事（5 大塊）

### Block 1：紅陽金流串接（核心、佔大半工時）

**4.1.1 跟紅陽要的東西**
- 商家號 (MerchantID)
- 串接金鑰 (HashKey + HashIV)
- API 文件（定期定額 + tokenization）
- Webhook 簽章驗證方式
- 測試環境 vs 正式環境 URL

**4.1.2 串接重點**

| 功能 | 紅陽 API 對應 | 你要寫的檔 |
|---|---|---|
| 信用卡 tokenization | 信用卡綁定授權 | `src/lib/payment/hongyang.ts` 新增 |
| 月扣款（定期定額） | 定期定額 setup | 同上 |
| 取消 / 變更 schedule | 定期定額管理 API | 同上 |
| Webhook 接收 | POST callback | `src/app/api/payment/webhook/route.ts` 新增 |

**4.1.3 信用卡綁定 flow（建議）**

```
User 在 /settings/billing 點「選擇 Premium 方案」
  ↓
跳出紅陽信用卡輸入頁（iframe or redirect）
  ↓
User 填卡片資訊、紅陽驗證
  ↓
紅陽回傳 tokenization 結果 + token
  ↓
我們 store 進 users.payment_method_token
  ↓
我們呼叫紅陽「定期定額 setup」、設定下月 1 號開始扣款
  ↓
更新 users：current_plan, subscription_started_at, subscription_renews_at
  ↓
回 user「✅ 訂閱成功、下次扣款日期：XXX」
```

**4.1.4 PCI-DSS 安全**

- ❌ 卡片資訊絕對不存我們 DB
- ❌ 卡片資訊絕對不打 log
- ✅ 只 store 紅陽回傳的 token（已脫敏）
- ✅ Webhook 一律驗簽章
- ✅ HTTPS only（Vercel 已預設）

---

### Block 2：Trial 7 天 auto-convert

**4.2.1 建帳號 hook 修改**

> 📌 **#3a 更新**：私版註冊 API（`src/app/api/auth/register/route.ts`）已移除，
> 新用戶一律由 Market SSO 建立 → 改看 **`src/app/sso/route.ts`**（建 user 的 insert 在 `:89-95`）。

新用戶預設應為：

```typescript
{
  current_plan: 'trial',       // ← 改、原本是 'premium'（內測用）
  trial_started_at: new Date(),
  auto_renewal: true,
}
```

⚠️ 注意：現有 user 仍然是 'premium'（grandfather）、只有**新建立**的走 trial。

🚨 **已知落差**：`sso/route.ts:94` 目前只寫 `current_plan: 'trial'`、**沒寫 `trial_started_at`**。
`api/admin/subscriptions/route.ts:186-191` 靠 `trial_started_at` 推算到期日，NULL 會讓
`trial_expires_at` 永遠是 null（後台看不到到期日、trial 等於不會過期）。修這個要一併確認。

**4.2.2 Trial 過期 cron**

每天凌晨 3am 跑：

```sql
SELECT id, email, trial_started_at, payment_method_token
FROM users
WHERE current_plan = 'trial'
  AND trial_started_at + INTERVAL '7 days' < NOW();
```

對每個 expired user：

- **有 payment_method_token**（已綁卡） → 升 Premium、扣款、寄收據
- **沒 payment_method_token** → 降 cancelled、寄「試用結束、訂閱挽留」email

**4.2.3 Cron 實作**

> ⚠️ **私版不能用 Vercel Cron。**
> 私版部署在 berth（EC2 Docker），`vercel.json` 在那裡根本不會被讀取；
> 該檔案已於 2026-08-22 移除（commit `af0ca9d`），原有的安全標頭改由 `next.config.js` 送出。
> 容易搞混是因為**公版確實跑在 Vercel**、它的三個 cron 就是用 `vercel.json` 設的——私版不是。

選一個：
- **A. Supabase `pg_cron` + `net.http_post` 打私版 API route**（推薦：不需要多一台機器、排程與資料同源）
- B. EC2 上的 crontab 打 `curl`（要 SSH 進 berth 主機設定，該主機多專案共用、改動要小心）
- C. 金流 cron 整個移到公版做（帳號真值本來就只有公版一份，見 #3a）

不論選哪一種，被打的 API route 都必須驗 `CRON_SECRET`，不可裸奔。

**4.2.4 Email 通知**

需要選個 transactional email service：
- 🟢 **Resend**（推薦、簡單、便宜）
- SendGrid / Postmark / AWS SES

時機：
- Trial 倒數 48 小時：「再 2 天免費試用結束、要不要訂閱？」
- Trial 倒數 24 小時：「明天結束、立即訂閱享 X 優惠？」
- Trial 結束當天：成功扣款 → 收據；扣款失敗 → 升級失敗通知

---

### Block 3：升降級 / 取消邏輯

**4.3.1 升級**

User 從 Basic → Premium：
1. Calculate 按比例差額（例：當月還剩 15 天、差額 = (1888-299)/30 * 15）
2. 呼叫紅陽**立即扣款**差額
3. 更新 users.current_plan = 'premium'
4. 寄收據 email

**4.3.2 降級**

User 從 Premium → Basic：
1. **不立即生效**、不退費
2. 設 users.pending_downgrade_plan = 'basic'（你需要加這欄位、或用其他機制標記）
3. 顯示「降級會在下次續訂日生效」
4. 月底紅陽自動扣 Basic 金額

**4.3.3 取消**

User 點「取消訂閱」：
1. 設 users.auto_renewal = false
2. 設 users.cancelled_at = NOW
3. 呼叫紅陽**停止後續扣款**
4. user 仍可用到本月底
5. 月底後 users.current_plan = 'cancelled'

---

### Block 4：失敗扣款重試

**4.4.1 紅陽 webhook 接收**

```typescript
// POST /api/payment/webhook
export async function POST(request) {
  // 1. 驗簽章
  // 2. 解析 webhook payload
  // 3. 對應 event:
  //    - 扣款成功 → 更新 users.subscription_renews_at = +1 month
  //    - 扣款失敗 → trigger retry
  //    - 卡片過期 → email user + 標記 needs_card_update
}
```

**4.4.2 Retry 機制**

```
首次扣款失敗
  ↓ 24 hr 後
重試 1（紅陽 API call）
  ↓ 24 hr 後（若仍失敗）
重試 2
  ↓ 24 hr 後（若仍失敗）
重試 3
  ↓ 仍失敗
降 cancelled + 寄 email「卡片無法扣款、訂閱已暫停、更新卡片即可恢復」
```

實作建議：
- 用 4.2.3 選定的 cron 機制 + DB 狀態追蹤
- 或更專業：用 BullMQ + Redis（overkill for now）

---

### Block 5：啟動正式運作

**測試完所有上面後**：

```bash
# .env.production（Vercel 後台設）
BILLING_ENFORCEMENT=true
```

部署上 prod、立刻啟動：
- 所有 user 額度檢查啟用
- 新註冊走 trial flow
- 月扣款 cron 啟動
- Trial 過期 cron 啟動

---

## 5. 你要新建的檔案 / 改的檔案

### 新建（estimated）

| 檔案 | 用途 |
|---|---|
| `src/lib/payment/hongyang.ts` | 紅陽 API client（綁卡、月扣款、取消、查詢） |
| `src/app/api/payment/webhook/route.ts` | 接收紅陽 webhook |
| `src/app/api/payment/bind-card/route.ts` | 啟動信用卡綁定流程 |
| `src/app/api/payment/checkout/route.ts` | 處理「選擇方案 → 紅陽」流程 |
| `src/app/api/cron/expire-trials/route.ts` | 每日 trial 過期檢查（由 4.2.3 選定的 cron 觸發、需驗 `CRON_SECRET`） |
| `src/app/api/cron/charge-renewals/route.ts` | 每日月扣款檢查（or 整合在上一個） |
| `src/app/api/cron/retry-failed-charges/route.ts` | 重試失敗扣款 |
| `src/lib/email/templates.ts` | Email 範本（trial 提醒、收據、扣款失敗、取消確認） |
| `src/lib/email/send.ts` | Resend / SendGrid wrapper |
| `supabase/migrations/013_payment_retry_tracking.sql` | 新增 retry tracking 欄位 |
| `docs/payment-integration-spec.md` | 你寫的串接規格給 Steve review |

### 修改

| 檔案 | 改什麼 |
|---|---|
| `src/app/sso/route.ts` | SSO 新建帳號 default trial + 補 `trial_started_at`（先別 push、Steve confirm 時機）<br>（#3a：原 `api/auth/register/route.ts` 已移除） |
| `src/app/settings/billing/page.tsx` | 拿掉「金流串接中」鎖定 modal、改成真實 checkout flow |
| `.env.example` | 加 `HONGYANG_*` 變數 + `RESEND_API_KEY` 等 |

---

## 6. 規範 / 紀律

### 6.1 不可動的東西（碰了會破壞 user 體驗）

| 區域 | 原因 |
|---|---|
| `src/lib/ai/buildContext.ts` | AI prompts、Steve 親自打磨 |
| `/api/ai/chat` 跟 `/api/ai/consultant` 業務邏輯 | quota middleware 之外的部分 |
| Migration 001-012 任何既有 SQL | 跑過了、別改、需要改就建 Migration 013+ |
| User 對話 / journey 資料 | 不可清、不可改 schema |

### 6.2 紀律

| 紀律 | 為什麼 |
|---|---|
| 不引新 UI library（不要 shadcn/ui / antd / mui）| 既有 stack 用 Tailwind 寫就好 |
| 不寫 password / 卡片資訊到 log | PCI / 隱私 |
| 所有金錢 mutation 寫 audit log | 出事可追溯 |
| webhook 一律驗簽 + idempotency | 防 replay attack + 重複扣款 |
| dev / staging 永遠 BILLING_ENFORCEMENT=false | 防誤扣 |
| 用 Steve 的測試帳號扣假錢測過、再上 prod | 紅陽有 sandbox 用 sandbox |

### 6.3 Audit log

所有 mutation 寫到 `admin_audit_logs`、用既有 `logAdminAction` helper：

| Action 名 | 何時用 |
|---|---|
| `payment.bind_card` | user 綁卡成功 |
| `payment.charge_success` | 扣款成功 |
| `payment.charge_failed` | 扣款失敗 |
| `payment.refund` | 退款 |
| `subscription.upgrade_from_trial` | Trial 過期自動升 Premium |
| `subscription.failed_charge_cancelled` | 重試 3 次失敗、降 cancelled |

**重要**：Webhook trigger 的 audit log、admin_user_id 用 NULL（不是 admin 動作）、加 metadata 表示 source = 'webhook'。

---

## 7. 測試清單（上 prod 前 100% 過）

### 7.1 紅陽串接

- [ ] Sandbox 環境綁卡成功、token store 進 DB
- [ ] Sandbox 環境扣款成功、webhook 收到 + 驗簽過
- [ ] 故意打錯卡號 → 紅陽回 error → 我們正確處理
- [ ] Webhook replay 同樣 payload → idempotent、不會重複扣款

### 7.2 Trial flow

- [ ] 新註冊 user current_plan = 'trial'、trial_started_at = NOW
- [ ] 試用期 100 則對話 cap 正確擋住第 101 則
- [ ] Trial 第 5 天寄「再 2 天結束」email
- [ ] Trial 第 6 天寄「明天結束」email
- [ ] Trial 第 7 天 + 有綁卡 → 自動升 Premium、扣款成功
- [ ] Trial 第 7 天 + 沒綁卡 → 降 cancelled、寄挽留 email

### 7.3 升降級 / 取消

- [ ] Basic → Premium 立即生效 + 扣差額 + 寄收據
- [ ] Premium → Basic 顯示「下月生效」、月底正確扣 Basic
- [ ] 取消 → auto_renewal=false、本月底失效、不再扣款
- [ ] 取消後重新訂閱 → 流程正常

### 7.4 失敗扣款

- [ ] 第一次失敗 → 24hr 後重試
- [ ] 連續 3 次失敗 → 降 cancelled + 寄 email
- [ ] 卡片過期 → 寄 email + 標記、user 更新卡片後可正常扣款

### 7.5 額度 + 用量

- [ ] BILLING_ENFORCEMENT=true 後、Basic 用超過 80 則被擋
- [ ] Admin 後台手動改方案、額度上限即時更新
- [ ] 跨月 → usage_quotas 自動建新 period_start row、額度重置

### 7.6 Edge cases

- [ ] User 月扣款日剛好取消 → 那次扣款不發生
- [ ] User 在試用期升 Premium（不等到自動過期）→ 立即扣月費、trial_started_at clear
- [ ] 紅陽 API down → 我們正確 fallback / 重試

---

## 8. 跟 Steve 的協作節奏

- **每週一 10am stand-up**（同你進前台時的協作節奏）
- **大方向變動**：紅陽串接遇到結構問題 → 立即 line Steve、不要 silent 推進
- **PR review**：開 PR 後 24 hr 內 Steve review
- **緊急問題**：直接 line Steve、不要等 stand-up

---

## 9. FAQ

**Q：紅陽要求一些東西、Steve 不在、要怎辦？**
A：紅陽是 Steve 公司既有合約、Steve 比你熟。**遇到任何需要決策的事先停下來問 Steve**、不要替他簽合約 / 改商家設定。

**Q：可以引新 NPM 套件嗎？**
A：紅陽 SDK 必要套件、可以。其他先問 Steve。已知會用到：`resend`（or 等價）+ 紅陽 SDK（如果有）。

**Q：可以動 AI prompt 嗎？**
A：**不可以**。`src/lib/ai/buildContext.ts` 是 Steve 親自打磨、改了會破壞 user 體驗。

**Q：用量已經有 admin 後台、我還要做 dashboard 嗎？**
A：不用。Steve 用 `/admin/usage` 看 cost vs revenue。你只要確保 `ai_usage_logs` 正確 append、admin 後台自然看得到。

**Q：trial 期間用量怎麼算？**
A：BILLING_ENFORCEMENT=true 後、checkQuotaAvailable 會看 user.current_plan：
- trial → 100 則上限（7 天）
- basic → 80 則上限（每月重置）
- premium → 500 則上限（每月重置）

你不用改這層 logic、只要正確設 plan tier。

**Q：之前有 user 已經是 'premium' grandfather、他們不會被 trial 流程影響？**
A：對。Trial flow 只 apply 給**新註冊**（current_plan='trial'）。既有 user 都已是 'premium'、會走月扣款流程（你做的）。但**他們沒綁卡**、所以你要設計：第一次扣款前要先邀請他們綁卡。建議：升 BILLING_ENFORCEMENT=true 前、給他們一個月 grace period + email 通知「請更新付款方式以繼續訂閱」。

**Q：發現 bug 怎辦？**
A：開 GitHub issue / 直接傳 Steve。**不要自己改 AI prompts / user-facing pages**。

---

## 10. 參考連結

- 後台管理使用手冊：[`docs/admin-user-guide.md`](./admin-user-guide.md)
- 後台 7 模組規格：[`docs/admin-dashboard-spec-v0.1.md`](./admin-dashboard-spec-v0.1.md)
- 產品規格 v1.4.x：[`docs/v2.1-course-spec.md`](./v2.1-course-spec.md)
- 全 commit 歷史：`git log --oneline --all`
- 開發環境 setup：[`docs/LOCAL-SETUP.md`](./LOCAL-SETUP.md)
- 訂閱 Phase 1A commit hash：`d6690e2`（你的工作從這個 commit 之後接續）

---

**Jeff、有問題隨時 line Steve。不要等到 stand-up。**
**Steve、有要補的點直接改這份 doc、commit message：`docs: jeff handoff updates`**

---

## 版本紀錄

| 版本 | 日期 | 變更 |
|---|---|---|
| v1.0 | 2026-06-10 | 初版、Phase 1A 完成後給 Jeff 接 Phase 1B |
