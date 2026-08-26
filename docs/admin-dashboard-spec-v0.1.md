# Admin Dashboard Spec v0.1

- 版本：**v0.1（後台管理 MVP 規格、給工程 Jeff 開工用）**
- 日期：2026-05-25
- 作者：Steve（子奇老師）+ Claude AI 協作 articulate
- 狀態：⚠️ **給 Jeff（@jeff5242）開工 brief**、開發前先讀完整份、有不清楚的問 Steve 拍板再動
- 範圍：本份只規格化「後台管理 v1 MVP」的 7 個模組、不包含 billing / email marketing / A/B testing 等 future scope
- 對應 spec：[`v2.1-course-spec.md`](./v2.1-course-spec.md) v1.3.8（user-facing 產品 spec）+ [`positioning-v0.4-升維-stack.md`](./positioning-v0.4-升維-stack.md)（策略願景）

---

## 0. 給 Jeff 的開工須知（一頁版）

**你的任務**：建一個 `/admin/` 後台、讓 Steve 跟未來的客服 / 課程編輯人員可以管理 user / 對話 / 課程內容、看 stats。

**範圍**：純新增、**不動任何 user-facing 既有檔案**。
- ✅ 新建 `/src/app/admin/*` 路徑
- ✅ 新建 `/src/app/api/admin/*` API endpoints
- ✅ 新建 Migration 008（加 `users.is_admin` 欄位 + audit log table）
- ❌ **不動** `src/lib/ai/buildContext.ts`（AI prompts、Steve 親自打磨、改了會破壞 user 體驗）
- ❌ **不動** `/chat` `/onboarding` `/settings` `/progress` 既有 user-facing 頁面
- ❌ **不動** 既有 `/api/ai/*` `/api/journey/*` `/api/conversation/*` endpoints

**Tech stack（沿用 Steve 既有的、別引新 dependency）**：
- Next.js 14 App Router + TypeScript
- Supabase（PostgreSQL + JSONB）
- Tailwind CSS（無 UI library、純 Tailwind 寫）
- 既有 auth pattern: `getSessionFromRequest` from `@/lib/auth`、`supabaseAdmin` from `@/lib/supabase`

**先讀 4 份文件**：
1. `docs/LOCAL-SETUP.md`（本機開發環境設定）
2. `docs/v2.1-course-spec.md` §14 版本紀錄（理解產品演化）
3. `docs/positioning-v0.4-升維-stack.md`（整體願景、後台設計要前瞻三產品線）
4. **本份**

**MVP 上線時間目標**：6-8 週（每週 stand-up 跟 Steve 同步進度）

---

## 1. 架構 + 技術選擇

### 1.1 整體結構

```
src/app/admin/
├── layout.tsx              # admin 共用 layout（sidebar nav + auth gate）
├── page.tsx                # /admin 首頁 = stats dashboard
├── users/
│   ├── page.tsx           # /admin/users 列表
│   └── [id]/page.tsx      # /admin/users/[id] 詳情
├── journeys/
│   ├── page.tsx
│   └── [id]/page.tsx
├── conversations/
│   ├── page.tsx
│   └── [id]/page.tsx
├── topics/
│   └── page.tsx
├── course/
│   ├── page.tsx           # Day 0-21 列表
│   └── [day]/page.tsx     # 編輯特定 day
└── settings/
    └── page.tsx           # 系統設定（admin 管理 / audit log）

src/app/api/admin/
├── users/route.ts          # GET list
├── users/[id]/route.ts     # GET detail / PATCH / DELETE
├── journeys/route.ts
├── journeys/[id]/route.ts
├── conversations/route.ts
├── conversations/[id]/route.ts
├── topics/route.ts
├── course/route.ts         # GET all 22 days
├── course/[day]/route.ts   # GET / PATCH day N
├── stats/route.ts          # GET aggregate
└── audit-logs/route.ts     # GET log entries

src/lib/admin/
├── requireAdmin.ts         # auth helper
└── auditLog.ts             # 寫 audit log helper

supabase/migrations/
└── 008_admin_role_and_audit.sql
```

### 1.2 設計原則

1. **MVP first**：先做 read-only 列表 + 必要編輯、不做 fancy 圖表 / 不做高級 filter / 不做 export
2. **Mobile-friendly secondary**：後台主要 desktop 用、mobile 能看就好、不用優化
3. **Sober UI**：純 Tailwind utility、灰白 + Steve 既有 primary 色、不用 emoji 不用裝飾
4. **無 dependency 增加**：不引 shadcn/ui / Ant Design / Material UI、用既有 stack 寫
5. **Auth pattern 沿用**：跟既有 `/api/user/me` 一樣用 `getSessionFromRequest`、不引 NextAuth

---

## 2. 認證 + 權限

### 2.1 Schema 變動（Migration 008）

```sql
-- supabase/migrations/008_admin_role_and_audit.sql

-- (1) users 表加 is_admin 欄位
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE NOT NULL;
CREATE INDEX IF NOT EXISTS users_is_admin_idx ON users (is_admin) WHERE is_admin = TRUE;
COMMENT ON COLUMN users.is_admin IS '是否為後台管理員、預設 FALSE、只能由現有 admin 手動授權';

-- (2) admin_audit_logs 表（記錄所有 admin 動作、用於 debug + 安全追蹤）
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,           -- 'user.update_mbti' / 'user.suspend' / 'course.edit_day' / 'admin.grant' 等
  target_type TEXT,                -- 'user' / 'journey' / 'conversation' / 'course_content' / 'topic'
  target_id TEXT,                  -- 被動作的 entity id（可能 UUID 也可能 day_number）
  changes JSONB,                   -- before/after diff、{ before: {...}, after: {...} }
  ip_address TEXT,                 -- 來源 IP（從 request header 取）
  user_agent TEXT,                 -- 來源 UA
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX admin_audit_logs_admin_user_id_idx ON admin_audit_logs (admin_user_id, created_at DESC);
CREATE INDEX admin_audit_logs_target_idx ON admin_audit_logs (target_type, target_id);

COMMENT ON TABLE admin_audit_logs IS '後台動作審計 log、所有 PATCH/DELETE/admin grant 都要寫';

-- (3) 設第一個 admin = Steve 本人（手動跑、deploy 後執行一次）
-- UPDATE users SET is_admin = TRUE WHERE email = 'steveweng7@gmail.com';
```

**Migration 跑完後 Jeff 要做 1 件事**：到 Supabase SQL editor 跑：
```sql
UPDATE users SET is_admin = TRUE WHERE email = 'steveweng7@gmail.com';
```
（讓 Steve 變第一個 admin、之後 admin 互相 grant、不用再下 SQL）

### 2.2 Auth helper

```typescript
// src/lib/admin/requireAdmin.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function requireAdmin(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return { error: NextResponse.json({ error: '請先登入' }, { status: 401 }), session: null };
  }
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, email, is_admin')
    .eq('id', session.userId)
    .single();
  if (!user?.is_admin) {
    return { error: NextResponse.json({ error: '需要管理員權限' }, { status: 403 }), session: null };
  }
  return { error: null, session, adminUser: user };
}
```

每個 `/api/admin/*` endpoint 開頭都用：
```typescript
const { error, session, adminUser } = await requireAdmin(request);
if (error) return error;
// ... 正常邏輯
```

### 2.3 前端 auth gate

`/src/app/admin/layout.tsx` 在 server side fetch `/api/user/me`、check `is_admin`、若否 redirect 到 `/chat`：

```typescript
// src/app/admin/layout.tsx (Server Component)
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession(cookies());
  if (!session) redirect('/auth/login?from=/admin');

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('is_admin')
    .eq('id', session.userId)
    .single();

  if (!user?.is_admin) redirect('/chat'); // 非 admin 踢回 user 主頁

  return (
    <div className="flex h-screen">
      <AdminSidebar />
      <main className="flex-1 overflow-auto bg-gray-50">{children}</main>
    </div>
  );
}
```

### 2.4 Audit log helper

```typescript
// src/lib/admin/auditLog.ts
import { supabaseAdmin } from '@/lib/supabase';
import { NextRequest } from 'next/server';

export async function logAdminAction(params: {
  request: NextRequest;
  adminUserId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}) {
  const { request, adminUserId, action, targetType, targetId, before, after } = params;
  const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  await supabaseAdmin.from('admin_audit_logs').insert({
    admin_user_id: adminUserId,
    action,
    target_type: targetType,
    target_id: targetId,
    changes: before || after ? { before: before ?? null, after: after ?? null } : null,
    ip_address: ipAddress,
    user_agent: userAgent,
  });
}
```

每個 PATCH / DELETE / grant admin endpoint 都要 call `logAdminAction`、不可省略。

---

## 3. 7 個模組詳述

### 3.1 模組 1：User 管理 `/admin/users`

**功能**：
- 列表頁：顯示所有 user、可搜尋 email / name、可按註冊時間 / 最後活躍時間排序
- 詳情頁：看單一 user 完整資料（含 journey list + conversation list）
- 編輯：可改 `mbti_self` / `mbti_confidence` / `name` / `is_admin` / 停權 / 刪除

**列表欄位**：
| Column | 來源 |
|---|---|
| Email | users.email |
| Name | users.name |
| MBTI | users.mbti_self |
| 註冊時間 | users.created_at |
| 最後活躍 | MAX(conversations.updated_at) |
| 對話數 | COUNT(conversations.id) |
| 21 天進度 | journeys.current_day（若 active journey 存在） |
| Admin? | users.is_admin（badge） |
| 動作 | 「查看」「編輯」「停權」 |

**搜尋 + 篩選**：
- 搜尋 box：對 email + name 做 `ilike` 模糊查詢
- Filter：is_admin（all / yes / no）、有/沒有 journey、過去 7 天活躍

**Pagination**：每頁 50 筆、cursor-based（用 created_at 排序、不要 OFFSET 大數）

**詳情頁佈局**：
```
左欄（基本資料）：
- Email、Name、MBTI、Confidence、註冊時間、最後活躍
- [編輯按鈕] 開 modal 改 name / mbti / is_admin
- [停權按鈕]（軟刪除、加 users.suspended_at 欄位）
- [刪除按鈕]（hard delete + cascade、需要 confirm 兩次）

右欄（活動歷史）：
- Journey List（含每個 round 的 current_day、partner、是否 active）
- Conversation List（最近 20 筆、點開可看完整對話、對應 §3.3）
```

**安全考量**：
- ❌ 不顯示 password hash 或任何 secret
- ❌ Email 修改要二次確認（避免誤改）
- ❌ Admin 不能停權 / 刪除自己（防自鎖 + admin 數量歸零）
- ❌ Demote admin（is_admin → false）要 confirm

### 3.2 模組 2：Journey 管理 `/admin/journeys`

**功能**：列出所有 21 天練習 journey、看每個 user 練到哪一天、找出 stuck 的 user。

**列表欄位**：
| Column | 來源 |
|---|---|
| User email | users.email |
| Round | journeys.round_label 或 round_number |
| Current Day | journeys.current_day |
| Partner | journeys.partner_nickname (mbti_partner) |
| Active? | journeys.is_active |
| 創建時間 | journeys.created_at |
| 最後對話 | MAX(conversations.updated_at) where journey_id |
| 完成天數 | COUNT(DISTINCT conversations.day_number) where day_number > 0 |

**篩選**：is_active / current_day range（0-21）/ relationship_type（couple / parent_child / workplace）

**詳情頁**：read-only、顯示完整 journey context + 每天對話 link

### 3.3 模組 3：對話歷史 `/admin/conversations`

**功能**：看任一 user 的對話內容（debug / 客服用）。**Read-only**、絕不能修改對話內容。

**列表欄位**：
| Column | 來源 |
|---|---|
| User | users.email |
| Mode | context_type（practice / consultant） |
| Day / Topic | day_number 或 topic_title |
| 訊息數 | jsonb_array_length(messages) |
| 來源 | source（text / voice） |
| 最後更新 | updated_at |
| 動作 | 「查看」 |

**篩選**：context_type / source / 日期範圍 / user email 搜尋

**詳情頁**：完全套用既有 `/export/conversation/[id]/page.tsx` 的 styling（複用、不要重寫）、但隱藏 print 按鈕、加 admin metadata（IP / user agent if available）。

**隱私警告 banner**：
> ⚠️ 這是 user 私人對話、僅限客服 / debug 用途、不可截圖外流、不可分享。所有查看會記錄在 audit log。

每次點開詳情都寫 audit log（`action: 'conversation.view'`）。

### 3.4 模組 4：諮詢主題管理 `/admin/topics`

**功能**：看 Mode B「我卡住，幫我拆」所有 topics 的統計、找出熱門主題 keywords。

**列表欄位**：
| Column | 來源 |
|---|---|
| Topic title | conversations.topic_title |
| User | users.email |
| 訊息數 | jsonb_array_length(messages) |
| Archived? | conversations.archived_at IS NOT NULL |
| 創建時間 | conversations.topic_started_at |
| 最後更新 | conversations.updated_at |
| 動作 | 「查看對話」（跳到 §3.3 詳情） |

**加值功能（可選 phase 2）**：Top 50 topic keywords 統計（從 topic_title 做中文 tokenize、找出熱門關鍵字）—— 給 Steve 看「user 最常卡在什麼」。

### 3.5 模組 5：Course Content 編輯 `/admin/course`

**功能**：讓 Steve 不用改 spec + 不用跑 migration 就能直接改 Day 0-21 的 `theme` / `subtitle` / `knowledge_point`。

**列表頁**：Day 0-21 一覽（22 列）+ 每列顯示 theme / 最後修改時間 / [編輯] 按鈕

**編輯頁 `/admin/course/[day]`**：
- 顯示當前 day 完整資料（theme / subtitle / knowledge_point / course_unit / 其他欄位）
- 可編輯：theme / subtitle / knowledge_point（textarea、支援 markdown）
- **不可編輯**：day_number / course_unit（這些是 schema 結構、改了會破壞 21 天 routing）
- 編輯前後 diff 寫 audit log
- 改完 save、立即生效（下次 user load Day N 看到新內容）

**警告 banner**：
> ⚠️ 修改 Day N 內容會立刻影響所有正在練 Day N 的 user。建議在低活躍時段操作（凌晨）+ 改完通知 Steve 跑一次 sanity test。

### 3.6 模組 6：Stats Dashboard `/admin`（後台首頁）

**功能**：一頁版 KPI、Steve 每天打開看狀況。

**MVP 必要 metric**：
| Metric | 算法 |
|---|---|
| 總註冊人數 | COUNT(users) |
| 今日新增 | COUNT(users WHERE created_at >= today) |
| 過去 7 天活躍 user | COUNT(DISTINCT user_id from conversations WHERE updated_at >= 7d ago) |
| 過去 30 天活躍 user | 同上、30d |
| 平均每日對話訊息數 | SUM(jsonb_array_length(messages)) / 30 |
| Mode A 用戶數 | COUNT(DISTINCT user_id from conversations WHERE context_type = 'practice') |
| Mode B 用戶數 | COUNT(DISTINCT user_id from conversations WHERE context_type = 'consultant') |
| 21 天完成人數 | COUNT(journeys WHERE current_day >= 21) |
| 21 天完成率 | 完成人數 / 啟動 journey 人數 |
| Day 流失分析 | bar chart：每個 Day 0-21 還有多少 user 在練（用 current_day distribution） |

**UI**：用純 div + Tailwind 排 grid 4 個 cards 一排、不引 chart library（要做 bar chart 用 `<div>` 寬度比例硬刻）

**Phase 2 nice-to-have**：
- 註冊 / 活躍 user 日線圖（用 recharts）
- 完成率漏斗圖
- Top 10 topic keywords cloud

### 3.7 模組 7：系統設定 `/admin/settings`

**功能**：管理 admin 列表 + 看 audit log。

**Tabs**：

**Tab 1：Admin 列表**
- 列出所有 `is_admin = TRUE` 的 user
- 「Grant admin」：輸入 email → 設 is_admin = TRUE（寫 audit log）
- 「Revoke admin」：每個 admin row 有按鈕、revoke 前 confirm（防自鎖、admin 數量 >= 1 才能 revoke）

**Tab 2：Audit Log**
- 列出最近 200 筆 admin 動作
- 篩選：admin user / action type / 日期範圍
- 每筆顯示：時間 / admin / action / target / changes diff（展開看 JSON）

---

## 4. API Endpoints 完整列表

所有 endpoint 開頭都 `await requireAdmin(request)`、所有 mutation endpoint（PATCH / DELETE / POST）都要 `logAdminAction`。

| Method | Path | 用途 | 寫 audit? |
|---|---|---|---|
| GET | `/api/admin/users` | List users（pagination / search / filter） | No |
| GET | `/api/admin/users/[id]` | User detail（含 journeys + conversation count） | No |
| PATCH | `/api/admin/users/[id]` | Update name / mbti / is_admin / suspended_at | ✅ |
| DELETE | `/api/admin/users/[id]` | Hard delete + cascade（需 confirm header） | ✅ |
| GET | `/api/admin/journeys` | List journeys（filter is_active / day range） | No |
| GET | `/api/admin/journeys/[id]` | Journey detail | No |
| GET | `/api/admin/conversations` | List conversations（filter / paginated） | No |
| GET | `/api/admin/conversations/[id]` | Conversation full content | ✅（view log） |
| GET | `/api/admin/topics` | List Mode B topics + 統計 | No |
| GET | `/api/admin/course` | List all 22 days course content | No |
| GET | `/api/admin/course/[day]` | Day N detail | No |
| PATCH | `/api/admin/course/[day]` | Update theme/subtitle/knowledge_point | ✅ |
| GET | `/api/admin/stats` | Aggregate stats（含 distribution） | No |
| GET | `/api/admin/audit-logs` | List audit log entries | No |
| POST | `/api/admin/audit-logs/export` | Export CSV（phase 2 optional） | ✅ |

---

## 5. UI 規範

### 5.1 顏色

沿用既有 Tailwind config（`primary-500` / `primary-600` / `gray-*`）、新加：
- Danger action（停權 / 刪除）：`bg-red-600 text-white hover:bg-red-700`
- Warning banner：`bg-amber-50 border-amber-200 text-amber-700`
- Info banner：`bg-blue-50 border-blue-200 text-blue-700`

### 5.2 Sidebar nav

```
┌──────────────┐
│ 🛠 後台管理   │
├──────────────┤
│ 📊 Dashboard │  /admin
│ 👥 User 管理  │  /admin/users
│ 🗺 Journeys │  /admin/journeys
│ 💬 對話歷史  │  /admin/conversations
│ 📁 諮詢主題  │  /admin/topics
│ 📚 課程內容  │  /admin/course
│ ⚙️ 系統設定  │  /admin/settings
├──────────────┤
│ steve@... ↩  │  登出
└──────────────┘
```

### 5.3 共用 components

請建 `/src/components/admin/`：
- `<DataTable />` — 通用列表（sortable header、pagination footer）
- `<DetailCard />` — 通用詳情頁 layout（左右兩欄）
- `<EditModal />` — 通用編輯 modal（form fields + save/cancel）
- `<ConfirmDialog />` — 二次確認 dialog（用於 dangerous actions）
- `<AdminSidebar />` — 上面那個 nav
- `<AuditLogBadge />` — 顯示「動作會被記錄」的小提示

---

## 6. 開發里程碑（6-8 週）

**Week 1：基礎建設**
- Migration 008 寫好 + 跑通
- `requireAdmin` + `logAdminAction` helper
- `/admin/layout.tsx` + AdminSidebar
- 設 Steve 為第一個 admin

**Week 2-3：模組 1 + 2 + 7**
- User 管理（列表 + 詳情 + 編輯）
- Journey 管理（列表 + 詳情）
- 系統設定（admin 列表 + audit log）

**Week 4-5：模組 3 + 4 + 6**
- 對話歷史（列表 + 詳情 read-only）
- 諮詢主題管理
- Stats Dashboard MVP（核心 10 個 metric）

**Week 6：模組 5 + polish**
- Course Content 編輯
- UI 微調、bug 修
- 跟 Steve 走 final user test

**Week 7-8：buffer + deploy**
- 修 Steve test 抓到的 bug
- 寫簡單的 admin user guide（README in `/admin`）
- Production deploy（先到 staging environment 測一週、再上 prod）

---

## 7. 安全 / 隱私 / GDPR 考量

### 7.1 必做
- ✅ 所有 `/api/admin/*` 都 `requireAdmin` gate
- ✅ 對話內容 view 寫 audit log
- ✅ User delete 是 hard delete + cascade（Supabase FK ON DELETE CASCADE 已設）
- ✅ Admin 自身保護：不能 demote / suspend / delete 自己
- ✅ 不在 list endpoint 回傳 password hash 或 session token
- ✅ Audit log retention：至少保留 12 個月

### 7.2 暫不做（但要在 README 標記為 known limit）
- ❌ Row Level Security（Supabase RLS）—— 現在用 `supabaseAdmin` service role bypass、Phase 2 再上 RLS
- ❌ Two-factor auth for admin —— Phase 2
- ❌ IP allowlist for admin login —— Phase 2
- ❌ 完整 GDPR 流程（user 主動 export / delete）—— 待法務需求

### 7.3 GDPR-friendly 設計
- User delete 一定要 cascade 刪所有 journeys + conversations + audit logs（保留 admin id 但匿名 user 部分）
- 對話 view audit log 含 admin id + 時間 + IP、未來若有調查需求可追溯

---

## 8. Out of Scope（**Jeff 請不要做、超過範圍找 Steve 拍板**）

- ❌ Billing / 訂閱管理（產品還沒上付費）
- ❌ Email marketing / push notification 發送
- ❌ 內容排程 / 課程內容 A/B 測試
- ❌ AI prompt 編輯介面（buildContext.ts 不准動）
- ❌ User-facing 任何頁面修改
- ❌ 新增 OAuth login（保持現有 email + password）
- ❌ 多語系（i18n）
- ❌ Real-time websocket（後台不需要、polling 即可）
- ❌ Mobile app（後台 desktop only、mobile 能看就好）
- ❌ 任何引入新 dependency 的決定（要先 Slack 問 Steve）

如果開發過程發現需求超出本份 spec、**先停下來 Slack 問 Steve 拍板**、不要自己延伸。

---

## 9. 跟 Steve 的協作節奏

- **每週一 10am**：30 分鐘 stand-up（screen share 跑當週 progress + demo）
- **PR review**：開 PR 後 24 小時內 Steve review、有 question 在 PR comment 討論
- **緊急問題**：直接 line Steve（不要等 stand-up）
- **大方向變動**：先 line / Zoom 拍板、再寫 code

---

## 10. 第一週要交付的東西（DoD - Definition of Done）

Jeff 開工第一週（Week 1）結束時、main branch 應該有：

1. ✅ Migration 008 跑通（`is_admin` 欄位 + `admin_audit_logs` table 都建好）
2. ✅ Steve 帳號（`steveweng7@gmail.com`）`is_admin = TRUE`
3. ✅ `/admin` 頁面可開、非 admin 會被 redirect 到 `/chat`
4. ✅ Sidebar nav 7 個 link 都可點（每個頁面先 placeholder「即將推出」）
5. ✅ `requireAdmin` + `logAdminAction` helper 寫好 + 有單元測試（用 vitest 或 jest）
6. ✅ 開了 PR 從 `feat/admin-dashboard` → `main`、Steve review 後 merge

第一週 DoD 達成 = 基礎建設完成、Week 2 可以開始實作功能。

---

## 11. FAQ for Jeff

**Q：我可以引入新 UI library 嗎（如 shadcn/ui）？**
A：先 Slack 問 Steve。原則上不要、用既有 Tailwind 寫。

**Q：admin 頁面要不要支援 mobile？**
A：能看就好、不用優化。後台主要 desktop 使用。

**Q：要用 React Server Components 還是 Client Components？**
A：能用 RSC 就用 RSC（list 頁、stats）；需要 interactive form 的用 client component。

**Q：對話內容 view 要不要 mask 個資（電話 / email 在對話 text 裡）？**
A：MVP 不做、Phase 2 再加。但 view 要寫 audit log。

**Q：發現既有 spec 或 code 有 bug 怎麼辦？**
A：先確認不影響你後台開發、開 GitHub Issue 告訴 Steve、不要自己改。

**Q：API endpoint 命名為什麼用 `/api/admin/*` 而不是 `/api/v2/admin/*`？**
A：現有 endpoint 沒有版本前綴、保持一致。未來真要分版本再 refactor。

**Q：要不要寫 e2e 測試？**
A：MVP 階段、寫 critical path 的 e2e 即可（admin login + view user list + edit user）。其他靠 Steve 手動 test。

---

## 12. 版本紀錄

| 版本 | 日期 | 變更 |
|---|---|---|
| v0.1 | 2026-05-25 | 初稿、7 個模組規格 + Migration 008 + 6-8 週里程碑 + Out of scope + Jeff FAQ |

---

**Jeff、有問題隨時 line Steve / 開 Slack。**
**Steve、你 review 完這份覺得要調的地方、直接改這份 doc、commit message: `admin-spec v0.1 → v0.2`、Jeff 會以 main 的最新版為準。**
