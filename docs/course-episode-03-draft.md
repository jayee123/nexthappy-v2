# 課程草稿 — Episode 3：Read-only 觀察工具

> **「不是 CRUD 越多越好、是『看清楚』比『做事多』有用」**
> ─ 子奇老師 × Claude 結對開發實戰示範（Week 3 完整側錄）

- 版本：**Draft v0.1（2026-06-01 課程草稿）**
- 隸屬：**羽升升維 Stack 元產品 — 「教學員用 Claude 開發 APP」課程系列第 3 集**
- 上游：
  - [`course-episode-01-draft.md`](./course-episode-01-draft.md)（Week 1 admin foundation）
  - [`course-episode-02-draft.md`](./course-episode-02-draft.md)（Week 2 CRUD module）
- 來源原始素材：2026-06-01 子奇老師 + Claude 完整協作對話 + commit history（`4d7b96d`（Session 3A）+ `4c7be16`（Session 3B）+ PR #3 merge `2a71ca2`）
- 目的：給 Steve 拍片參考 + 文字配套講義雙用
- 狀態：⚠️ 草稿、Steve review 拍板後可進 v0.2 完整劇本

---

## 0. Episode 元資料

| 項目 | 內容 |
|---|---|
| **集數** | Episode 3 |
| **片名候選** | 「Read-only 觀察工具：admin 如何在 21 天課程中找出『卡關 user』」 |
| **副標** | 「不是 CRUD 越多越好、是『看清楚』比『做事多』有用」 |
| **目標時長** | 50-60 分鐘 / 剪完 35-45 分鐘（含 3 sessions） |
| **目標學員** | 看過 Episode 1+2 跟著做完 Week 1+2 的學員 |
| **前置** | Episode 1+2 全部跑過、有 admin layout + user CRUD module 在 production |
| **學員學完能做到** | 設計 read-only admin tool；用 Day timeline 視覺化 user 進度；理解「觀察優先、行動次之」的工具哲學；多表 JOIN + JSONB 聚合 |

---

## 1. 整體故事弧

```
🎬 開場（4 min）
   「Week 2 蓋了 CRUD 衝刺、今天回到觀察。
    不是改 user、不是刪 user、是『看清楚 user 卡在哪』。」
        ↓
📋 Pre-flight：Week 2 recap + 為什麼 Week 3 不做 CRUD（3 min）
        ↓
🛠 3 個 Session
   3A Journey 列表（API + UI + ⚠️ 卡關 badge）     20 min
   3B Journey 詳情（含 Day 0-21 視覺 timeline）    25 min
   3C PR + merge + deploy                       5 min
        ↓
🐛 3 個踩坑紀錄（5 min）
        ↓
🚀 收尾 + Homework + Episode 4 預告（3 min）
```

**核心 narrative**：「Week 2 教你『做事』、Week 3 教你『看事』。一個好工程師在『做』之前要先『看』。」

**Anti-pattern 對標**：市場上學寫 admin 99% 在教 CRUD（CREATE/READ/UPDATE/DELETE）。但做產品的人知道、ship 之後最重要的不是『改資料』、是『看清楚資料』。Read-only 工具有自己的設計哲學、不比 CRUD 簡單。

---

## 2. 開場 Hook（4 分鐘）

### 2.1 Cold open（45 秒）

直接放成果畫面：
- 螢幕錄影：訪 `https://happy.nuwa.chg2asc.com/admin/journeys`
- 頁面 header 出現紅色 banner：「⚠️ 這頁有 2 個卡關」
- 列表 5 個 journey、其中 2 row amber 淡黃背景 + ⚠️ 卡關 badge：
  - `steve test1` Day 1、卡 19 天
  - `jeff` Day 2、卡 55 天
- 點 jeff 那一行「查看」、跳詳情頁
- 進度條 amber 色、Day 視覺看到 Day 0-2 highlight、Day 3-21 灰色
- 「最後活躍 55 天前」醒目顯示

旁白：「這個 admin 工具找到了 2 個快放棄的 user。一個卡 19 天、一個卡 55 天。我來告訴你怎麼蓋。」

### 2.2 為什麼你應該看完這集（2 分鐘）

**子奇老師對鏡頭講**：

> 「Episode 2 我們蓋了用戶管理——CRUD 完整一輪、會 ship 會改會刪。
>
> 但你做產品的人會發現一件事：**ship 之後你最常做的、不是『動 user 資料』、是『看 user 在幹嘛』**。
>
> 今天教你的、不是『多會做事』、是『多會看事』。
>
> 看完這集你會知道：**read-only 工具有自己的設計哲學**——它的核心不是『讓 admin 改東西』、是『讓 admin 一眼看出問題在哪』。
>
> 21 天課程上線之後、最重要的 admin 工具不是『可以改 prompt』、是『可以看到誰卡關了』。今天就教你蓋這個。」

### 2.3 對標 anti-pattern（1.5 分鐘）

**指出市場上做 AI APP / SaaS 的 fail mode**：
- ❌ 上線後盲眼跑、不知道哪個 user 卡關、流失率不知道哪來
- ❌ 用 Stripe / Mixpanel 看 metric、但看不到「這個 user 在 Day 5 開始就沒對話了」這種**產品脈絡**的事
- ❌ 工程師寫 CRUD 寫得很爽、PM 看不到 user 進度、產品決策瞎猜
- ✅ 今天這集教你「**為自己產品脈絡客製化的觀察工具**」——你自己的 Day 0-21 邏輯、自己的「卡關」定義（7 天無對話 + journey active）、自己的視覺呈現

---

## 3. Pre-flight：Week 2 recap + 為什麼 Week 3 不做 CRUD（3 分鐘）

### 3.1 Week 2 成果快速複習（1 min）

- ✅ 5 個 session：列表 / 詳情 / 編輯 / 停權 / 刪除全套
- ✅ Migration 008-011 修齊（RLS、FK SET NULL）
- ✅ PR #2 merged + production deploy
- ✅ 12 個 real user 可看可改可刪

### 3.2 為什麼 Week 3 不做 CRUD（2 min）

**子奇老師對鏡頭講**：

> 「有人會問：Week 3 是不是該做『Journey CRUD』？我可以改 journey、刪 journey、編輯 journey 內容？
>
> 我刻意**不做**。
>
> 因為 Journey 不該被 admin 隨便改——那是 user 的 21 天承諾、改了會破壞產品契約。Admin 的角色不是『編輯 journey』、是『看 user 怎麼跑這個 journey』。
>
> 換句話說：**Read-only 不是『偷懶』、是『刻意』**。
>
> Week 3 的價值不在『又做了一個 CRUD module』、在『展示一個觀察工具該怎麼設計』。下一集 Week 4 對話歷史也是 read-only、再下一集 Week 5 stats dashboard 還是 read-only。
>
> **Admin 工具 80% 是觀察、20% 是行動**——把 80% 那塊做好、你的產品才算真的 ship。」

---

## 4. Session 3A：Journey 列表（20 分鐘）

### 4.1 範圍（1 min）

2 件 deliverables：
1. **GET `/api/admin/journeys`**：列表 API（search / filter / pagination + 多表聚合）
2. **`/admin/journeys` UI**：真實列表頁取代 Week 1 placeholder、含 ⚠️ 卡關 badge + filter

### 4.2 設計決策對話（3 min）

跟 Claude 講需求：
- 列出所有 journey、依時間倒序
- search by user email / name
- filter：全部 / 進行中 / 已結束 / **卡關 7 天**
- 關係 type filter：伴侶 / 親子 / 職場
- 聚合每個 journey 的「最後活躍時間」「完成天數」「卡關判定」

**核心設計決策**：
- **inner join `users` 表**（一次 query、不 N+1）：
  ```typescript
  .select('id, user_id, ..., users!inner(email, name, mbti_self)')
  ```
- **聚合策略**：API 同時撈 journeys + conversations 兩張表、用 JS 聚合 `last_conversation_at` 跟 `completed_days_count`（不用 GROUP BY、避免 SQL 複雜度）
- **Stuck logic**：`is_active && days_since_last_activity > 7`
- **Completed days 排除 Day 0**（onboarding 不算「練習完成」）

Claude 給 ~200 行 TypeScript code。

### 4.3 GET API endpoint（5 min）

跟 Claude 對話、產出 `src/app/api/admin/journeys/route.ts`：

```typescript
// 核心 query
let query = supabaseAdmin
  .from('journeys')
  .select('id, user_id, round_number, round_label, partner_nickname, mbti_partner, relationship_type, current_day, is_active, created_at, users!inner(email, name, mbti_self)')
  .order('created_at', { ascending: false })
  .limit(limit + 1);  // +1 for hasMore detection

// search 用 referencedTable 過濾 join 的表
if (search) {
  query = query.or(`email.ilike.%${escaped}%,name.ilike.%${escaped}%`, { referencedTable: 'users' });
}

// 其他 filter
if (filter === 'active' || filter === 'stuck') query = query.eq('is_active', true);
if (relationship) query = query.eq('relationship_type', relationship);
if (cursor) query = query.lt('created_at', cursor);
```

撈完 journeys、再撈 conversations metadata 做聚合：

```typescript
// 對每個 journey 算 latest_conversation_at + completed_days_count
const convAgg = new Map<string, { latest: string; completedDays: Set<number> }>();
for (const c of conversations) {
  const agg = convAgg.get(c.journey_id) ?? { latest: '', completedDays: new Set() };
  if (c.created_at > agg.latest) agg.latest = c.created_at;
  if (c.day_number > 0) agg.completedDays.add(c.day_number);
  convAgg.set(c.journey_id, agg);
}

// 算 days_since_last_activity + is_stuck
const journeys = rawJourneys.map(j => {
  const agg = convAgg.get(j.id);
  const daysSince = agg?.latest
    ? Math.floor((Date.now() - new Date(agg.latest).getTime()) / 86400000)
    : null;
  return {
    ...j,
    completed_days_count: agg?.completedDays.size ?? 0,
    days_since_last_activity: daysSince,
    is_stuck: j.is_active && daysSince !== null && daysSince > 7,
  };
});

// stuck filter 在 post-merge 才做
if (filter === 'stuck') journeys = journeys.filter(j => j.is_stuck);
```

**踩坑點 #1**：route.ts 又放錯位置（連續第二次）。詳見 §7。

### 4.4 UI 列表頁（5 min）

跟 Claude 講：「8 欄表格 + filter pill + 搜尋 + Day filter dropdown + 卡關 row amber 背景」

Claude 給 ~330 行 React。重點 patterns：
- `'use client'`、useState + useEffect + useCallback
- Debounce search（400ms）
- Cursor stack pagination
- Filter pill 用 button group（active 紫底白字）
- Stuck row：
  ```tsx
  className={`... ${j.is_stuck ? 'bg-amber-50/30' : ''}`}
  ```
- Header banner：
  ```tsx
  {stuckCount > 0 && (
    <span className="bg-amber-50 text-amber-700">
      ⚠️ 這頁有 {stuckCount} 個卡關
    </span>
  )}
  ```

→ refresh 看到 5 個 journey、2 個卡關 row 淡黃背景、header banner 顯示「⚠️ 這頁有 2 個卡關」 ✅

### 4.5 測試（1 min）

跑 checklist：
- [x] 點「⚠️ 卡關 7 天」filter → 只剩 jeff + steveweng7+test1
- [x] 點「親子」filter → 只剩 Angel
- [x] 搜尋「jeff」→ 過濾正確
- [x] Cursor pagination 上下頁 work
- [x] Stuck row amber 背景 + ⚠️ 卡關 badge

---

## 5. Session 3B：Journey 詳情（25 分鐘）

### 5.1 範圍（1 min）

- GET `/api/admin/journeys/[id]` API（含完整聚合）
- `/admin/journeys/[id]/page.tsx` UI（含 Day 0-21 視覺 timeline）

### 5.2 API 設計（3 min）

跟 Claude 講：「Journey 詳情 endpoint、回傳 journey + user info + day-by-day stats、**不要撈對話原文**（留給 Week 4）」

**設計決策**：
- 撈 conversations metadata（id, day_number, created_at）、**不撈 messages JSONB**
- JS 聚合成 day_breakdown array：每天 message_count + first_at + last_at
- 計算 stats：total_conversations / completed_days / days_since / is_stuck

```typescript
// day_breakdown 聚合
const dayMap = new Map<number, { count: number; first: string; last: string }>();
for (const c of convs) {
  const d = c.day_number;
  if (d === null) continue;
  const existing = dayMap.get(d);
  if (!existing) {
    dayMap.set(d, { count: 1, first: c.created_at, last: c.created_at });
  } else {
    existing.count++;
    if (c.created_at < existing.first) existing.first = c.created_at;
    if (c.created_at > existing.last) existing.last = c.created_at;
  }
}
```

### 5.3 踩坑 #2：API silent fail（5 min）

**現象**：URL 正確、UUID 正確、但所有 journey detail 都回「找不到此 journey」。

**第一反應**：是不是 UUID validation regex 錯了？檢查、正確。

**第二反應**：是不是 RLS 擋了？但 list API 用同個 service_role 沒事。

**Claude 提示 console.error**：
```typescript
if (journeyError || !journey) {
  console.error('[journey detail] fetch error:', journeyError);
  return ...
}
```

dev server terminal 跑出來：
```
column journeys.completed_at does not exist
```

原來我在 select string 加了 `completed_at` 欄位、但 journeys 表根本沒這欄位（之前以為有）。整個 SELECT 失敗、`.single()` 回 PostgrestError、被 `!journey` 條件吃掉、UI 看到「找不到此 journey」。

**修法**：拿掉 `completed_at`、補齊 console.error。

**takeaway**：
- **API silent fail 必須 console.error 看具體訊息**——光看 HTTP status 不夠
- 加 `console.error` 不是 debug 工具、是**生產級 code 該有的常駐遙測**

### 5.4 UI Day 0-21 視覺 timeline（10 min）— **本集視覺賣點**

跟 Claude 講：「Day 0-21 視覺化、22 格、4 種顏色狀態」

**設計亮點**：
```
Day 0     onboarding 藍   bg-blue-50    border-blue-200
Day 1-N   已完成綠         bg-green-50   border-green-200
Day X     當前紫           bg-primary-500 text-white （current_day）
Day X+1   未練習灰         bg-gray-50    border-gray-200
```

實作：
```tsx
{Array.from({ length: 22 }, (_, i) => i).map(day => {
  const hasData = breakdownMap.has(day);
  const isCompleted = completedSet.has(day);
  const isCurrent = day === detail.current_day;
  const isOnboarding = day === 0;
  return (
    <div
      className={`w-8 h-8 rounded text-xs ... ${
        isCurrent
          ? 'bg-primary-500 text-white border-primary-600 font-bold'
          : isOnboarding && hasData
          ? 'bg-blue-50 text-blue-600 border-blue-200'
          : isCompleted
          ? 'bg-green-50 text-green-700 border-green-200'
          : 'bg-gray-50 text-gray-300 border-gray-200'
      }`}
      title={...}  // hover tooltip 顯示「Day X · N 訊息」
    >
      {day}
    </div>
  );
})}
```

→ 你的 Day 11 journey：Day 0 藍、Day 1-10 綠、Day 11 紫色當前、Day 12-21 灰 ✅

**設計哲學**：**好的 visualization 一眼讓人看到問題**。stuck user 的 timeline 一看就「大片灰」、active user 一看就「整排綠到尾」。比看 metrics 表格直觀 100 倍。

### 5.5 踩坑 #3：is_stuck 路徑（3 min）

tsc 報錯：
```
Property 'is_stuck' does not exist on type 'JourneyDetail'.
```

兩行：
```tsx
detail.is_stuck ? 'bg-amber-400' : 'bg-primary-500'
{detail.is_stuck ? (
```

**Root cause**：API 回傳結構是 `detail.stats.is_stuck`、不是 `detail.is_stuck`。我憑記憶寫存取路徑、忘了 nested。

**修法**：兩處都改 `detail.stats.is_stuck`。

**takeaway**：「**API 回傳結構要跟 UI types interface 對齊**——nested type 不要憑記憶寫存取路徑、要回去看 interface 定義」

### 5.6 詳情頁完整視覺（3 min）

整頁結構：
1. **Header**：breadcrumb「← 回 Journey 列表」+ User 名 + 「查看用戶完整資料 →」連結
2. **Overview card**：3 欄（關係 / 用戶 MBTI / 對方）+ 進度條（amber if stuck）+ stats 行
3. **Day 0-21 視覺 timeline**：22 格 + legend
4. **Day 對話明細表**：每天訊息數 + 首末時間

跨頁連結：「查看用戶完整資料 →」連回 Week 2 user 詳情頁、形成 admin 觀察的雙向 navigation。

---

## 6. Session 3C：PR + merge + deploy（5 分鐘）

跟 Week 2 同套 SOP：
1. jeff-sim folder 開 PR
2. 主 folder fetch + merge（GitHub UI）
3. Vercel preview ✗ 是 jeff-sim 帳號被擋（忽略）
4. main merge 後正常 deploy
5. prod smoke test：訪 `https://happy.nuwa.chg2asc.com/admin/journeys`

**這次的新東西**：因為已經是第三次跑這個流程、影片裡子奇老師可以說：

> 「如果你跑到第三次還記不住 PR → merge → deploy 流程、是你不熟、不是步驟太多。下次我就不再 explicit 講了、影片快轉過。」

---

## 7. 3 個踩坑紀錄（5 分鐘）

| # | 坑 | 怎麼解 | takeaway |
|---|---|---|---|
| 1 | route.ts 又放在 `src/app/admin/journeys/` 而非 `src/app/api/admin/journeys/`、瀏覽器 404 | `mv` 過去 | **第一次踩是學、第二次踩是壞習慣**——Episode 2 已經中過、Week 3 又中。pattern 第二次踩才會真的記住、要練到看到「建 API endpoint」就反射打 `src/app/api/...` |
| 2 | API 回「找不到此 journey」、但 UUID 正確 | 加 console.error → 看 terminal → `column completed_at does not exist` → 拿掉這欄位 | **silent fail 必須 console.error 看具體訊息**——光看 HTTP status 不夠、`.single()` 把 PostgrestError 吃掉了 |
| 3 | tsc 報 `is_stuck does not exist` | 改 `detail.is_stuck` → `detail.stats.is_stuck`（兩處） | **API 回傳結構要跟 UI types 對齊**——nested type 不要憑記憶、回去看 interface |

**子奇老師對鏡頭講**：
> 「Episode 2 講了 8 個坑、這集只 3 個。是不是變強了？
>
> 不完全是。Week 3 是觀察工具、邏輯本來就比 CRUD 單純、坑自然少。
>
> 重點是：**一樣的坑第二次又踩**——route.ts 放錯位置。
>
> 這代表你還沒把 pattern 內化、要練到看到『建 API endpoint』就反射打 `src/app/api/...`、不用想。
>
> 真正的工程能力、不是『記得多』、是『內化成反射』。」

---

## 8. 收尾 + Homework + Episode 4 預告（3 分鐘）

### 8.1 你今天學了什麼（1 min）

**新學的 6 個 skill**（Episode 3 獨家）：

| Skill | 哪一段學到的 |
|---|---|
| **Inner join with `users!inner(...)` syntax** | Session 3A |
| **referencedTable filter on joined column** | Session 3A search |
| **Multi-table aggregation in JS (Map / Set)** | Session 3A / 3B |
| **Post-merge filter (stuck flag)** | Session 3A |
| **Day 0-21 視覺化 timeline pattern** | Session 3B（Tailwind 22 格 4 色狀態） |
| **API silent fail debug pattern (console.error)** | Session 3B 踩坑 #2 |

### 8.2 Homework（1 min）

1. **跑通你自己的 Week 3**（從 GET API 跑起、3 session 全做）
2. **故意製造 stuck**：把 conversations.created_at 改成 8 天前、看 UI 是否正確跳卡關
3. **在 Day breakdown 表加一個 column**「執行情況評分」（自己玩 schema 改造）
4. **跨頁 navigation 全跑一遍**：journey 列表 → 詳情 → user 詳情 → 回 journey 列表
5. 完成 PR merged + production 跑通 → 來社群截圖、我蓋章 ✅

### 8.3 Episode 4 預告（1 min）

「下集：**對話歷史**（spec §3.3）

範圍是 Week 4 的對話原文閱讀工具：
- 列表 + 詳情、chat bubble 渲染
- mini markdown helper（不裝 lib）
- 區分「系統開場」vs「user 真實輸入」

預估 2-3 sessions、4-6 hours。

這集是 **admin 工具鏈最有戲劇張力的一集**——你會 production 上逐字看 AI 跟 user 真實對話。從『盲眼上線』升維到『有眼睛的 AI 產品』。

訂閱、按讚、下集見。」

---

## 9. 配套講義大綱

[完整 step-by-step 講義之後寫、約 15-20 頁 A4]

包含：
- Week 3 全 3 session 操作步驟
- 每段 Claude prompt 範本
- 3 個踩坑「症狀 → 怎麼問 Claude」對照表
- inner join 跟 multi-table aggregation pattern 範本
- Day 0-21 視覺 timeline Tailwind class table

---

## 10. 拍片技術建議

- **Cold open 必錄**：列表頁「⚠️ 這頁有 2 個卡關」banner + 點 jeff 進詳情 + 進度條 amber + Day 視覺
- **Day 0-21 視覺 timeline** 是本集視覺賣點、Session 3B 那段一定要錄到位、配上「綠 / 紫 / 灰」對比的縮放畫面
- **踩坑 #2 silent fail** 那段一定要錄完整：URL 對、UUID 對、但 UI 顯示「找不到」、跳到 terminal 看 console.error 找到 root cause
- 螢幕同時開：browser + VS Code + terminal + Supabase Dashboard 4 個視窗
- 編輯時把 boilerplate 加速 2x、保留 Claude prompt 跟答覆關鍵段

---

## 11. 給 Steve 的 review checklist

拍前 Steve review、勾完跟 Claude 說「拍板 X」、出 v0.2 完整劇本：

- [ ] 片名 / 副標：OK？
- [ ] 3 sessions 拆法：3A 列表 / 3B 詳情 / 3C deploy 三段、夠分？
- [ ] 踩坑只 3 個：要不要加「Vercel preview 又被擋」「gh CLI 不在 PATH」湊到 5 個跟 Ep4 對齊？
- [ ] Day 0-21 視覺 timeline 篇幅：Session 3B § 5.4 約 10 min、太長還是剛好？
- [ ] Episode 4 預告：「最有戲劇張力一集」這個 narrative OK？
- [ ] 時長 50-60 分：可接受？

---

## 12. 版本紀錄

| 版本 | 日期 | 變更 |
|---|---|---|
| v0.1 | 2026-06-01 | 初稿、依 2026-06-01 Steve+Claude Week 3 Journey 管理完整協作對話轉成課程 Episode 3 草稿、含 3 sessions + 3 踩坑 + Episode 4 預告 |

---

**結尾 note**：Episode 3 是「觀察工具三部曲」第一集（Ep3 journey / Ep4 conversation / Ep5 stats dashboard）。三集合在一起構成完整 admin 觀察工具鏈、與 Episode 1-2 的「foundation + CRUD」形成對比。

— Steve（子奇老師）+ Claude AI 協作、2026-06-01
