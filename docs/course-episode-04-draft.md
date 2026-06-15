# 課程草稿 — Episode 4：看 AI 真實表現

> **「能 ship 是基本、能看清楚 AI 在做什麼才是真本事」**
> ─ 子奇老師 × Claude 結對開發實戰示範（Week 4 完整側錄）

- 版本：**Draft v0.1（2026-06-01 課程草稿）**
- 隸屬：**羽升升維 Stack 元產品 — 「教學員用 Claude 開發 APP」課程系列第 4 集**
- 上游：
  - [`course-episode-01-draft.md`](./course-episode-01-draft.md)（Week 1 admin foundation）
  - [`course-episode-02-draft.md`](./course-episode-02-draft.md)（Week 2 CRUD module）
  - [`course-episode-03-draft.md`](./course-episode-03-draft.md)（Week 3 Journey 管理）
- 來源原始素材：2026-06-01 子奇老師 + Claude 完整協作對話 + commit history（Session 4A + 4B + PR #4 merge）
- 目的：給 Steve 拍片參考 + 文字配套講義雙用
- 狀態：⚠️ 草稿、Steve review 拍板後可進 v0.2 完整劇本

---

## 0. Episode 元資料

| 項目 | 內容 |
|---|---|
| **集數** | Episode 4 |
| **片名候選** | 「看 AI 真實表現：admin 對話歷史頁、JSONB 渲染 chat、mini markdown 不裝 lib」 |
| **副標** | 「能 ship 是基本、能看清楚 AI 在做什麼才是真本事」 |
| **目標時長** | 60-75 分鐘 / 剪完 40-50 分鐘 |
| **目標學員** | 看過 Episode 1+2+3 跟著做完 Week 1+2+3 的學員 |
| **前置** | Episode 1+2+3 全部跑過、有 admin layout + user / journey 觀察工具在 production |
| **學員學完能做到** | 設計 AI 對話 admin 觀察頁；render JSONB array 為 chat UI；不裝 lib 自寫 mini markdown；schema-driven design 思維；產品設計層面區分「系統注入」vs「user 真實輸入」 |

---

## 1. 整體故事弧

```
🎬 開場（5 min）
  「我手機現在打開、有個 admin 頁面、我能看到所有 user 跟 AI 真實對話。
   不是 metadata、不是統計、是『AI 真的講了什麼』。」
        ↓
📋 Pre-flight：admin 觀察工具鏈三部曲（3 min）
   Week 2 看 user（who）
   Week 3 看 journey（progress）
   Week 4 看 conversation（AI behavior）— **閉環**
        ↓
🔍 動工先看 schema（5 min）— Episode 系列第一次出現 schema 探索
        ↓
🛠 3 個 Session
   4A 列表（filter by mode A/B、預覽 first message）  20 min
   4B 詳情（chat bubble + mini markdown + 系統開場區分） 30 min
   4C PR + merge + deploy                            5 min
        ↓
🐛 5 個踩坑紀錄（8 min）
        ↓
💡 § 11 產品設計花絮：「系統開場」訊息的視覺區分（3 min）
        ↓
🚀 收尾 + Homework + Episode 5 預告（3 min）
```

**核心 narrative**：「Episode 1-3 是『蓋出來』、Episode 4 是『看清楚』。看清楚之後、你才有資格說『我做了一個 AI 產品』。沒有觀察工具的 AI 產品、本質上是『盲眼上線』。」

**閉環 narrative**：Week 2 user → Week 3 journey → Week 4 conversation 三層 drill down、跨頁雙向連結。**這是 production admin tool 的金標準**。

---

## 2. 開場 Hook（5 分鐘）

### 2.1 Cold open（45 秒）

直接播放：
- 螢幕：訪 `https://happy.nuwa.chg2asc.com/admin/conversations/d3485eb2-...`（Steve 自己 Day 11 那筆）
- 頁面顯示完整 chat thread：
  - 「🌅 晨間練習 Day 11」context badge
  - User 翁仲華 ENTJ / Journey 伴侶第 1 輪 · 小玫 INTJ
  - 「跨日對話」amber badge（5/3 → 5/12 跨 9 天）
  - 系統開場訊息 dashed border：「今天是第 11 天、主題是『矛盾情境（輕）』」
  - AI Tutor 回應：「嗨仲華！早安 😊」配上 **bold** 渲染：**S6 具體請求**、**矛盾情境（輕）**、**今日任務很簡單：**
  - User 回「你好」
  - AI 接著問起昨天進度
  - User 問「什麼是觀感想行 4 步？」
  - AI 完整解釋四步驟：**觀（看事實）**、**感（接情緒）**、**想（讀懂需求）**、**行（具體動作）**

旁白：「這是我 prod 上一個 user 跟 AI 真實對話。我能逐字看、能找問題、能改 prompt。我來告訴你怎麼蓋。」

### 2.2 為什麼你應該看完這集（3 分鐘）

**子奇老師對鏡頭講**：

> 「99% 的 AI APP 開發者、上線之後**不知道 AI 在跟 user 講什麼**。
>
> 要嘛開 OpenAI dashboard 看 logs——雜亂、沒產品脈絡、不知道這個 message 屬於哪個 user / journey / day。
>
> 要嘛叫 user 截圖回傳——無效、太晚、user 已經流失才知道。
>
> 要嘛裝 LangSmith / Helicone 等付費 SaaS——貴、又不能客製化你的產品脈絡。
>
> 今天教你**自己 1 天蓋出來**——而且比那些 SaaS 更貼合你的產品脈絡。你可以 filter Day / Mode A 練習 / Mode B 諮詢、可以連回 user / journey 詳情、可以區分『系統注入訊息』vs『user 真實輸入』。
>
> 看完這集你會：**有一個 production 工具、直接看到 AI 講過的每一句話**。從『盲眼上線』升維到『有眼睛的 AI 產品』。」

### 2.3 對標 anti-pattern（1 分鐘）

**指出 AI APP 開發者 fail mode**：
- ❌ 上線後不知道 AI 答案品質、靠 user 抱怨才發現問題
- ❌ 想改 prompt 但沒有 data 支持決策、瞎調
- ❌ 找了個付費 LLM observability SaaS、$XX/month、結果發現它不認得你的 Day / Mode 概念
- ✅ 今天這集教你「**為自己產品脈絡客製化的 AI 觀察工具**」、整套自己 own、隨時改、零月費

---

## 3. Pre-flight：觀察工具鏈三部曲（3 分鐘）

```
Episode 2 用戶管理   →  看「誰」（who is using）
Episode 3 Journey 管理 →  看「進度」（how far）
Episode 4 對話歷史   →  看「AI 行為」（what AI says）
                              ↑
                  這集閉環、admin 真的看得到所有東西
```

「閉環」意味著什麼：admin 從 user → journey → conversation 一路 drill down、每層都有跨頁連結（也能反向上跳）。

**子奇老師對鏡頭講**：

> 「為什麼叫『閉環』？因為三集做完、你的 admin 工具能回答**所有產品問題**：
>
> - 『誰在用？』→ Week 2
> - 『他們進度如何？』→ Week 3
> - 『AI 對他們講了什麼？』→ Week 4
>
> 任何 user 流失、你都能反查：『他停在 Day 幾？卡關前 AI 給了什麼建議？』整條線就在 admin 裡、不用回 SQL、不用裝 SaaS。
>
> **這是 production admin tool 的金標準**。」

---

## 4. ⭐ 動工先看 schema（5 分鐘）— Episode 系列第一次出現

### 4.1 為什麼這次要看 schema（1 min）

**子奇老師對鏡頭講**：

> 「Episode 1-3 我們都是『跟 Claude 講需求 → Claude 給 code』。今天不行。
>
> 為什麼？因為 **messages 欄位是 JSONB**——Claude 不知道你存什麼結構。每家 AI APP 的 messages 格式都自己定義：
>
> - 有人存 `[{role, content}]`
> - 有人存 `{user_msg, ai_response}` 兩欄
> - 有人存 `{turns: [...], meta: {...}}` 巢狀
>
> 不看 schema 直接寫 code、99% 寫一半要打掉重來。
>
> **動 code 前看 schema 5 分鐘、省半小時 debug**。」

### 4.2 三條 SQL 探索（3 min）

Supabase SQL Editor 跑：

```sql
-- 1. 看 conversations 表所有欄位
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'conversations'
ORDER BY ordinal_position;
```

回傳 11 欄：id / journey_id (nullable!) / day_number / context_type / messages (jsonb) / created_at / updated_at / source / topic_title / topic_started_at / archived_at / user_id

關鍵發現：
- **`journey_id` 是 nullable**——某些對話沒綁 journey（推測是自由諮詢）
- **`context_type` 是 text 欄位**——可能標 Mode A/B
- **`messages` 是 JSONB**——結構未知、待確認

```sql
-- 2. 看 context_type 有哪些值
SELECT context_type, COUNT(*) AS n
FROM conversations
GROUP BY context_type
ORDER BY n DESC;
```

回傳：
- `consultant`: 20 → **Mode B 諮詢**
- `morning`: 10 → Mode A 晨間練習
- `evening`: 6 → Mode A 晚間回顧

🔑 **大發現**：`context_type` 直接區分 Mode A/B、不用另外加欄位！

```sql
-- 3. 撈 1 筆 Day 11 的對話、看 messages 內部結構
SELECT id, messages
FROM conversations
WHERE day_number = 11
LIMIT 1;
```

回傳 `messages`：
```json
[
  {"role":"user","content":"今天是第 11 天，主題是「矛盾情境（輕）」..."},
  {"role":"assistant","content":"嗨仲華！早安 😊\n\n先接昨天 Day 10..."},
  ...
]
```

🔑 **大發現**：標準 OpenAI `[{role, content}]` 格式、好處理。

### 4.3 schema 探索的 takeaway（1 min）

**子奇老師對鏡頭講**：

> 「5 分鐘的 SQL 探索、給了你三個關鍵 insight：
>
> 1. `context_type` 已經區分 Mode A/B、UI filter 直接用
> 2. `messages` 是 OpenAI 標準格式、render code 不用客製
> 3. `journey_id` 可以是 null、API + UI 要 handle 這 case
>
> 沒做這 5 分鐘 → 你會：寫 code 時假設 messages 是 `{user, ai}` 結構、寫到一半發現是 array、整段重寫。
>
> **schema-driven design 不是工程師潔癖、是省自己時間**。」

---

## 5. Session 4A：對話列表（20 分鐘）

### 5.1 範圍（1 min）

2 件 deliverables：
1. **GET `/api/admin/conversations`**：列表 API（4 維 filter + JSONB 預覽抽取）
2. **`/admin/conversations` UI**：列表頁、含 Mode A/B filter pill + 紫底色行

### 5.2 API 設計（5 min）

跟 Claude 講：「列表 endpoint、可 filter by context_type / user_id / journey_id / day_number、不撈完整 messages 只算 length 跟抓 first user message」

核心 query：

```typescript
let query = supabaseAdmin
  .from('conversations')
  .select('id, user_id, journey_id, day_number, context_type, topic_title, messages, created_at, archived_at, users!inner(email, name)')
  .order('created_at', { ascending: false })
  .limit(limit + 1);

// 4 個 filter
if (search) {
  query = query.or(`email.ilike.%${escaped}%,name.ilike.%${escaped}%`, { referencedTable: 'users' });
}
if (contextType && VALID_CONTEXT_TYPES.includes(contextType)) {
  query = query.eq('context_type', contextType);
}
if (userId) query = query.eq('user_id', userId);
if (journeyId) query = query.eq('journey_id', journeyId);
if (dayNumberRaw !== null) {
  const dayNum = parseInt(dayNumberRaw, 10);
  if (!isNaN(dayNum)) query = query.eq('day_number', dayNum);
}
```

從 JSONB 抽出預覽（不裝 lib、原生 JS）：

```typescript
const messages = (row.messages as MessageItem[]) || [];
const message_count = messages.length;
const firstUserMsg = messages.find(m => m.role === 'user');
const first_user_message_preview = firstUserMsg
  ? firstUserMsg.content.slice(0, 100)
  : '';
```

**設計決策**：列表不撈完整 messages、只 `messages.length` + first user msg 預覽。減少 payload、加快列表 render。

### 5.3 API 測試（3 min）

從瀏覽器測（不用 curl、admin 已登入 cookie 自帶）：

- `?limit=5` → 5 筆對話
- `?context_type=consultant` → 只 20 筆 Mode B
- `?user_id=<uuid>` → 你 22 筆對話
- `?day_number=11` → Day 11 全部對話

✅ 所有 filter work、preview 中文 truncate 沒亂碼。

**踩坑點 #1 + #2**：zsh `?` 要 escape、cookies.txt 過期回 HTML。詳見 §8。

### 5.4 UI 列表頁（7 min）

跟 Claude 講：「7 欄表格（類型 / Day / User / 主題預覽 / 訊息數 / 時間 / 動作）、4 個 filter pill、Mode B row 淡紫底色、相對時間 format」

Claude 給 ~270 行 React。重點 patterns：

**Filter pill**：
```typescript
const CONTEXT_FILTERS = [
  { value: 'all', label: '全部' },
  { value: 'morning', label: '🌅 晨間練習' },
  { value: 'evening', label: '🌙 晚間回顧' },
  { value: 'consultant', label: '💬 Mode B 諮詢' },
];
```

**Context badge**：
```typescript
const CONTEXT_BADGE = {
  morning: { label: '晨', cls: 'bg-orange-50 text-orange-700' },
  evening: { label: '晚', cls: 'bg-indigo-50 text-indigo-700' },
  consultant: { label: '諮', cls: 'bg-purple-50 text-purple-700' },
};
```

**Mode B 紫底色行**：
```tsx
const isConsultant = c.context_type === 'consultant';
<tr className={`... ${isConsultant ? 'bg-purple-50/30' : ''}`}>
```

**相對時間 formatter**：
```typescript
function formatRelativeTime(iso: string): string {
  const diffDays = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (diffDays === 0) return `今天 ${hh}:${mm}`;
  if (diffDays === 1) return `昨天 ${hh}:${mm}`;
  if (diffDays <= 7) return `${diffDays} 天前`;
  return `${month}/${day}`;
}
```

→ refresh 看到 36 筆對話、Mode B 紫底、Mode A 白底、按時間倒序、3 個 user 都有資料 ✅

### 5.5 設計亮點：訊息數差異反映互動模式（4 min）

從列表 message_count 欄位可以一眼看出產品特性：
- **Mode A 晨間練習**：訊息數 10-24（深度練習、多輪 role-play）
- **Mode A 晚間回顧**：訊息數 2-6（快速回報、執行情況 + 心情）
- **Mode B 諮詢**：訊息數 2-16（單次問題深度討論）

**子奇老師對鏡頭講**：
> 「光看列表的『訊息數』欄位、我就知道：
>
> - Mode A 晨間是 user 跟 AI 練習場、訊息多正常
> - Mode A 晚間是『打卡回報』、訊息少正常
> - Mode B 諮詢是『問題深度討論』、訊息中等正常
>
> **如果哪天看到 Mode A 晨間只有 2 訊息**——代表那個 user 沒練就跳走、是流失警訊。
>
> **觀察工具的價值、不是『看到資料』、是『讓你一眼看到異常』**。」

---

## 6. Session 4B：對話詳情（30 分鐘）

### 6.1 範圍（1 min）

- GET `/api/admin/conversations/[id]`（含完整 messages JSONB）
- `/admin/conversations/[id]/page.tsx` UI（chat bubble + mini markdown + 系統開場區分）

### 6.2 API 設計（4 min）

跟 Claude 講：「對話詳情 endpoint、回傳完整 messages + user + journey context」

```typescript
// 撈 conversation + user（inner join）
const { data: conv } = await supabaseAdmin
  .from('conversations')
  .select('..., messages, ..., users!inner(email, name, mbti_self)')
  .eq('id', convId)
  .single();

// 若 journey_id 存在、二次撈 journey context
if (conv.journey_id) {
  const { data: jData } = await supabaseAdmin
    .from('journeys')
    .select('round_number, partner_nickname, mbti_partner, relationship_type')
    .eq('id', conv.journey_id)
    .single();
}
```

**設計決策**：journey context **二次 query** 而不是 join。因為 join 寫法在 nullable journey_id 上會複雜（需要 outer join 處理）、二次 query 簡單清楚。

### 6.3 UI 第一個亮點：chat bubble 渲染（8 min）

跟 Claude 講：「user 右、AI 左、max-width 80%、whitespace-pre-wrap 保留換行」

```tsx
detail.messages.map((msg, idx) => {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[85%]">
        <div className="text-xs text-gray-400 mb-1 px-1">
          {isUser ? '👤 User' : '🌟 AI Tutor'}
        </div>
        <div
          className={`px-4 py-3 rounded-lg whitespace-pre-wrap text-sm ${
            isUser
              ? 'bg-primary-50 text-gray-800 border border-primary-100'
              : 'bg-white text-gray-800 border border-gray-200'
          }`}
        >
          {renderContent(msg.content)}
        </div>
      </div>
    </div>
  );
})
```

**設計哲學**：admin 看 chat thread 的視覺、應該**跟 end-user 看的 chat 一樣**——這樣 admin 才能感受到 user 的真實 UX、找出體驗問題。

### 6.4 UI 第二個亮點：Mini markdown helper（6 min）— **不裝 lib 哲學**

**問題**：AI 大量用 markdown bold：`**S6 具體請求**`、`**矛盾情境（輕）**`、`**今日任務很簡單：**`。

**選擇 A**：裝 `react-markdown` + `remark-gfm` → 2 個 npm package、完整 markdown 支援。
**選擇 B**：自己寫 12 行 helper → 只處理 `**bold**`、其他 markdown 字面顯示。

**Steve 選 B**：

```typescript
function renderContent(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}
```

**為什麼選 B**：
- 12 行 < 2 個 npm package 的依賴重量
- 只處理 95% 案例（AI 9 成用 bold、少用其他 markdown）
- 後續加 italic / list 也只是多 5-10 行
- 哲學：**能用 12 行解決就不裝 lib**

**子奇老師對鏡頭講**：

> 「我知道有人會說『裝 react-markdown 比較完整』。
>
> 但你想：每個 npm package 都是技術債——版本相容、安全 audit、bundle size。
>
> AI APP 寫 prompt 時、你已經知道 AI 9 成只用 bold。為了那 1 成的 `*italic*` 跟 list、裝 2 個 package、值得嗎？
>
> **能用 12 行解決就不裝 lib**。等真的需要 table / code block / list 時再裝、那時你的需求已經明確、選 lib 也更精準。
>
> 這不是工程師潔癖、是『技術債最小化』的工程哲學。」

### 6.5 UI 第三個亮點：「系統開場」訊息區分（8 min）— **產品設計 insight**

**發現問題**：第一條 user role 訊息其實是**系統注入**的 Day kickoff、不是 user 真的講了「今天是第 11 天、主題是『矛盾情境（輕）』」。

如果直接 render 成「👤 User」、admin 會誤讀為「user 怎麼會這樣自言自語」。

**Steve 的設計決策**：

```typescript
const isSystemKickoff = idx === 0 && isUser;

// label
{isSystemKickoff ? '🤖 系統開場（注入為 user role）' : isUser ? '👤 User' : '🌟 AI Tutor'}

// bubble style
className={
  isSystemKickoff
    ? 'bg-gray-50 text-gray-600 border border-gray-200 border-dashed'  // dashed 虛線邊框
    : isUser
    ? 'bg-primary-50 ...'  // 實線、紫色
    : 'bg-white ...'        // 實線、白色
}

// 對齊
className={`flex ${isUser && !isSystemKickoff ? 'justify-end' : 'justify-start'}`}
// 系統開場跟 AI 一樣左對齊（因為它本質是「系統訊息」、不是 user 訊息）
```

**3 個視覺區分點**：
1. 標籤改成「🤖 系統開場」
2. dashed 虛線邊框（而非實線）
3. 左對齊（跟 AI 同邊、不是 user 同邊）

**子奇老師對鏡頭講**：

> 「這個小細節、可能是這集最有 leverage 的設計決策。
>
> 如果不區分、admin 看 chat thread 會誤讀 30% 的對話脈絡——『user 怎麼會自言自語講『今天是第幾天』？』
>
> 區分了之後、admin 一眼看出『這是系統開場、user 的真實話從第二筆才開始』。
>
> **產品設計 insight**——admin 工具不只是『把資料 render 出來』、是『讓 admin 正確理解資料含義』。
>
> 你之後做 AI APP、所有『系統注入訊息 vs user 真實輸入』都該這樣區分。」

### 6.6 跨日對話 amber badge（3 min）

發現某些對話 `created_at` 跟 `updated_at` 差很多天——Steve Day 11 對話跨 9 天（5/3 → 5/12）持續更新。

```tsx
const isMultiDay = detail.updated_at && detail.created_at &&
  detail.updated_at.slice(0, 10) !== detail.created_at.slice(0, 10);

{isMultiDay && (
  <span className="bg-amber-50 text-amber-700">跨日對話</span>
)}
```

**為什麼這個 badge 重要**：admin 看到「Day 11 對話 5/3 建立、5/12 更新」會困惑、加 badge 之後一眼理解「這是跨天對話、不是 1 天內完成的」。

### 6.7 踩坑 #5：code 貼一半被 Cursor AI tab 打斷（1 min）

貼 270 行 React code、貼到 257 行 `<Link>` href 那邊、Cursor AI tab 自動補完跳出來、Steve 按了 tab、貼完整段中斷。

`npx tsc --noEmit` 噴 9 個 error（最後一段沒貼完整、JSX tag 不平衡）。

修法：補完整段、重存。

**takeaway**：「**AI IDE 是助力也是噪音**——大段貼 code 時關 autocomplete 比較穩」

---

## 7. Session 4C：PR + merge + deploy（5 分鐘）

跟前面同套流程。**這集明確收掉 explicit teaching**——

**子奇老師對鏡頭講**：
> 「PR → merge → deploy 流程、Episode 1、2、3 我都 step-by-step 教過。
>
> 這集我快轉過去——你已經跑過 3 次、不熟才奇怪。
>
> 之後 Episode 5、6 我也不再 explicit 講這流程。**重複的東西反覆教是浪費你時間**。」

---

## 8. 5 個踩坑紀錄（8 分鐘）

| # | 坑 | 怎麼解 | takeaway |
|---|---|---|---|
| 1 | `curl http://...?key=val` 在 zsh 噴 `no matches found` | URL 加引號 `"http://...?key=val"` | shell 特殊字元防呆、養成 URL 全 quote 習慣 |
| 2 | `curl ... \| jq` 噴「Invalid numeric literal」、不是 JSON 是 HTML | cookies.txt 過期、瀏覽器直接打 URL 繞道 | **API debug 走瀏覽器比 curl 快**——你已經登入、cookie 自帶、不用維護 cookies.txt |
| 3 | AI markdown `**bold**` 字面顯示醜 | 12 行 mini renderer、token split + `<strong>` | **能用 12 行解決就不裝 lib**——但要看場景、複雜 markdown 還是該裝 react-markdown |
| 4 | 第一條 user role 訊息其實是系統注入「Day X kickoff」 | UI 加「🤖 系統開場」label + dashed border + 左對齊 | **產品層面 insight**——admin 工具設計要區分「系統行為」vs「user 真實輸入」、否則誤讀風險高 |
| 5 | code 貼一半被 Cursor AI tab 自動補完打斷、9 個 TS error | 補完整段、重存 | **AI IDE 是助力也是噪音**——大段貼 code 時關 autocomplete 比較穩 |

**子奇老師對鏡頭講**：
> 「Episode 2 講了 8 個坑、Episode 3 只 3 個、這集 5 個。坑的『質地』不一樣。
>
> 前 3 集踩的多半是 setup 性質的坑（路徑、shell escape、TypeScript narrowing）。
>
> **這集踩的是『產品設計層面』的坑**——系統注入訊息要不要區分、markdown 渲染哲學、AI IDE 的雜訊。
>
> **這代表你升級了**。從『跟著 SOP 做』升維到『要做產品設計決策』。
>
> 升級之後你會發現：技術問題其實已經不太擋你了、擋你的是『該怎麼設計才對 user 好』這類產品問題。」

---

## 9. 收尾 + Homework + Episode 5 預告（3 分鐘）

### 9.1 這 4 集的軌跡（1 min）

- **Ep1** 蓋骨架（layout + 7 placeholder）
- **Ep2** 蓋第一個房間（user CRUD module）
- **Ep3** 蓋觀察工具 1（journey 進度）
- **Ep4** 蓋觀察工具 2（AI 對話）→ **閉環**

「4 個 Episode 跑完、你有了一個能上線的 admin 觀察工具鏈。這在大廠是 PM + 1 個工程師 1 個月的事——你 4 集 + 一週做完。」

### 9.2 你新學的 7 個 skill（1 min）

| Skill | 哪一段學到的 |
|---|---|
| **schema-driven design**（動 code 前看 schema） | § 4 |
| **JSONB 解析**（messages array → preview + count） | Session 4A |
| **Filter pill UI pattern**（複數類別 toggle） | Session 4A |
| **Chat bubble 渲染**（user 右 / AI 左 / max-width） | Session 4B § 6.3 |
| **Mini markdown helper**（不裝 lib、12 行 token split） | Session 4B § 6.4 |
| **系統注入 vs user 真實輸入區分**（dashed border） | Session 4B § 6.5 |
| **跨日對話偵測**（created_at vs updated_at） | Session 4B § 6.6 |

### 9.3 Homework（1 min）

1. 跑通你自己的 Week 4
2. 故意讓 user 跟 AI 對話、然後到 admin 看 chat thread
3. **走完閉環**：user 詳情頁 → journey 詳情 → conversation 詳情 → 回 user
4. （challenge）把 mini markdown 擴充支援 `*italic*` 跟 `**bold**` 雙處理（hint：split regex 改 `/(\*\*?[^*]+\*\*?)/g`、判斷 `**` vs `*`）
5. PR merged + production → 來社群截圖蓋章

### 9.4 Episode 5 預告（30 秒）

「下集：**課程內容編輯**——admin 直接改 live AI prompts、不用 deploy。
最敏感、最有風險、也最有 leverage 的一集。預告：**要寫『安全護欄』**——避免 admin 不小心把 prompt 改壞、整個 AI 行為走鐘。

訂閱、按讚、下集見。」

---

## 10. 配套講義大綱

[完整 step-by-step 講義之後寫、約 25-30 頁 A4]

包含：
- Schema 探索 SOP（3 條 SQL 模板）
- Week 4 全 3 session 操作步驟
- 每段 Claude prompt 範本
- 5 個踩坑「症狀 → 怎麼問 Claude」對照表
- Chat bubble UI Tailwind class table
- Mini markdown helper 全 code（可直接複製）
- 「系統注入 vs user 真實輸入」設計 pattern

---

## 11. § 產品設計花絮：「系統開場」的視覺區分（3 分鐘）

**這集最有 leverage 的設計決策、單獨拉出來講**。

### 11.1 問題

OpenAI / Claude 等 LLM API 的 `messages` 是 `[{role, content}]`、其中 `role` 只有 `user` / `assistant` / `system`。

很多 AI APP 為了「給 AI 一個明確的 day kickoff context」、會在 conversation 開頭注入一筆 `role: 'user'` 的訊息（裝成 user 講的）：

```json
[
  {"role": "user", "content": "今天是第 11 天、主題是『矛盾情境（輕）』。請先追蹤..."},  ← 系統注入
  {"role": "assistant", "content": "嗨仲華！早安..."},   ← AI 真正回應
  {"role": "user", "content": "你好"},                  ← user 真實第一句
  ...
]
```

**問題**：admin 看 chat thread 會誤讀「user 怎麼會自己講『今天是第 11 天』」。

### 11.2 三種解法

| 解法 | 做法 | 評估 |
|---|---|---|
| A | DB schema 加 `is_system_injected` boolean | 完美、但要改 schema + migration |
| B | UI heuristic：第一條 user msg 一定是系統開場 | 簡單、但脆弱（萬一未來改 prompt 結構就掛） |
| C | 不區分、admin 自己看內容判斷 | 省工、但 admin 認知負擔高 |

**Steve 選 B**（heuristic）：

```typescript
const isSystemKickoff = idx === 0 && isUser;
```

理由：
- 目前 prompt 結構穩定、第一條 user msg 確實一律是系統注入
- 之後若改 prompt 結構、直接改 UI 邏輯就好（不用 migration）
- 視覺區分（dashed border + 左對齊 + label 改名）夠明顯

### 11.3 takeaway

**子奇老師對鏡頭講**：

> 「這個小決策背後是『**短期 vs 長期成本**』的取捨。
>
> 短期：選 B 最快、5 分鐘搞定。
> 長期：選 A 最穩、但要 migration、要改 backend、現在沒必要。
>
> **MVP 階段選 heuristic、產品成熟再改 schema-level**——這是工程師的『經濟學思維』。
>
> 不是『選最完美的解法』、是『選現在這個時點 ROI 最高的解法』。」

---

## 12. 拍片技術建議

- **Cold open 必錄 Steve Day 11 那筆**——markdown render + emoji + 跨日 badge + 系統開場 dashed border 一次到位、視覺殺
- **§ 4 schema 探索那段**、Supabase SQL editor 螢幕要清晰、3 條 SQL tab 切換要快、Claude 對話側錄
- **§ 6.4 mini markdown** 那段、放大螢幕看 12 行 helper code、配上 before/after 對比（**bold** 字面 vs 粗體渲染）
- **§ 6.5 系統開場區分** 那段、放大「🤖 系統開場 dashed border」vs「👤 User primary border」並列、講解視覺區分
- **§ 11 產品設計花絮** 可以額外搭配白板演示「短期 vs 長期成本」三選一表格
- **「閉環」可視化**：開 3 個 tab、user 詳情→ journey 詳情 → conversation 詳情、滑鼠示範跨頁跳

---

## 13. 給 Steve 的 review checklist

- [ ] 片名 / 副標：OK？
- [ ] 3 sessions 拆法：4A 列表 / 4B 詳情 / 4C deploy 三段、夠分？
- [ ] § 4 schema 探索 5 min 篇幅：太多 / 太少？
- [ ] § 6.5 系統開場區分 8 min 篇幅：是不是核心賣點該放更多？
- [ ] § 11 產品設計花絮 拉出來變獨立段落：保留還是合回踩坑表？
- [ ] 5 個踩坑：質地 OK 嗎？要不要加「gh CLI 不在 PATH」這個 minor 坑？
- [ ] Episode 5 預告：「最敏感、最有風險、最有 leverage」這個 hook OK？
- [ ] 時長 60-75 分：可接受？要剪到 50 分緊湊版嗎？

---

## 14. 版本紀錄

| 版本 | 日期 | 變更 |
|---|---|---|
| v0.1 | 2026-06-01 | 初稿、依 2026-06-01 Steve+Claude Week 4 對話歷史完整協作對話轉成課程 Episode 4 草稿、含 3 sessions + § schema 探索 + § 產品設計花絮 + 5 踩坑 + Episode 5 預告 |

---

**結尾 note**：Episode 4 是「觀察工具三部曲」收尾、與 Episode 3 形成兩集弧、與 Episode 1+2 形成完整 4 集教學循環（蓋骨架 → 蓋第一個房間 → 蓋觀察工具 1 → 蓋觀察工具 2 閉環）。Episode 5 開始進入「進階主題」（AI prompt 編輯安全護欄）、與前 4 集的「基礎工具鏈」分階段。

— Steve（子奇老師）+ Claude AI 協作、2026-06-01
