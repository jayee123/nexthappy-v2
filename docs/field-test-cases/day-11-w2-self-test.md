# Day 11 W2.行(己) Self Field Test — 2026-05-02

- **學員**：Steve（self-test）
- **環境**：Chat-as-Tutor（Claude 演 AI Tutor 走 spec v1.0.3 §4.9，繞過 production app v0.9 mismatch）
- **規格對位**：spec [§4.9](../v2.1-course-spec.md) Day 11 — W2.行(己)：具體請求
- **本場性質**：⭐⭐⭐ 本場產出**今日最深的 architectural insight**——超越 D11 練習本身

---

## 1. D11 通關 4 步串

Steve 30 分鐘內走完 v1 → v2 → v3 學習曲線：

| 版本 | 內容 | 評估 |
|---|---|---|
| v1 | 「家裡亂、互相分擔」4 步串 | ⚠️ 情境滑進「洗碗 demo」的 frame |
| v2 | 「餐廳浪漫」4 步串（情境對位但有情緒包袱）| 🟡 部分通過 |
| v3 | **「餐廳 + 雙向 + 具體」**：「過去兩週我跟妳分享 AI app 想法時，妳有 4 次低頭滑手機沒抬頭。我感到失落、有點委屈。我需要的是『被在乎』——覺得我講的東西對妳有意義。這週六晚上我們去吃個飯，我們可以各自分享這週最有感的事，我們手機都放包包專心聽——可以嗎？」 | ✅ 結構通過 |

→ **D11 通關**（按 spec v1.0.3 §4.9 標準）。

---

## 2. ⭐⭐⭐ 兩個自發真相（D10 級覺悟延伸）

### 2.1「我心疼她」（D10 自發 empathy 延續到 D11）

D10 跑完出現的「鏡子法則」+「我心疼她」覺察，在 D11 寫請求時自然帶入「雙向設計」（**我們**、**各自**、**手機都放**）——D10 內在覺悟成功落地到 D11 外在表達。

### 2.2「我這麼記恨」（D11 寫完後自發看見）

通關 v3 寫完後，Steve 自發說：「**這樣講給小玫聽我ㄧ定被罵死，原來我這麼記恨！！！**」

→ 即使 4 步技術完美——「過去兩週你有 4 次⋯」這個量化事實在能量上是**算帳 / 記分**，對方收到的不是「他想聊」是「他在統計我做錯幾次」。

→ 4 步**結構正確 ≠ 4 步落地是連結還是攻擊**。

---

## 3. ⭐⭐⭐ Steve 兩個 architectural-level insight（root cause for all today's friction）

### 3.1 User Maturity Levels（縱軸）

> 「User 應根據 4S 認知與技能掌握程度分成 **beginner / advanced / master** 三級，分別給予不同教學練習。」

| Level | 觸發條件 | 教學深度 |
|---|---|---|
| **Beginner**（第一輪）| 連基本觀感想行都不熟 | 4 步骨架 + 結尾「可以嗎？」（critical few only）|
| **Advanced**（第二輪 / AI 判定 4S 已熟）| 重複跑過、習慣養成 | 加進階檢核（可執行/量化/拒絕）+ 雙向設計 |
| **Master**（第三輪+）| 完整 21 天跑過 | 加 D17 修復公式 + 邀請 vs 算帳能量 + 4 步內在 vs 外在 |

→ **AI Tutor 動態調整教學深度**（divide & conquer + tailor-made）。

### 3.2 User Personality × TA Style Matrix（橫軸）

> 「AI Tutor 在諮詢對話互動過程中判斷 User 是 T 或 F 型，調整教學、輔導、回饋風格。」

| | **T-leading user** | **F-leading user** |
|---|---|---|
| **Beginner** | 4 步 + 簡單檢核（structure 友善）| 4 步 + 多 acknowledgment（warmth-first）|
| **Advanced** | 加 criteria（他們愛清單）| 加 nuance + rapport-first |
| **Master** | D17 + 邊界判斷 + 結構化 | D17 + 故事化 + 共在質感 |

**TA 偵測來源**：
- D0 onboarding 直接問
- 對話 live-detect（句式 / 用詞 / 反應模式）
- 跨天 behavior pattern

→ **6 種 tailored AI Tutor 變體**（同一 spec、不同 surface）。

### 3.3 兩個 insight 一起解開今天所有 friction（root cause）

| 今日 friction | 真因 |
|---|---|
| §5.6 我太 T、太 criteria-driven | **maturity 沒分**——advanced 內容講給 beginner |
| §5.7 邀請 vs 算帳能量 | master 級內容塞給 beginner |
| §5.8 D11/D17 邊界判定 | master 級判斷塞給 beginner |
| §5.10 critical few 違反 | 三 level 內容塞進一場 |
| §5.11 4 步寫成 4 段體 | master 級「內在順序」教學壓給 beginner |
| 見樹不見林 | 整個 spec 樹林倒給 beginner |
| 我太 T、不夠 F | **personality 沒分**——T 風格講給 F-leaning user |

→ **Root cause = User 沒分等級 × 沒分 personality**。
→ 一刀切 = 對 beginner 太重、對 master 太空、對 F 太冷、對 T 也不一定全中。
→ 解 = **二維 adaptive matrix**（v1.1.0 spec 重寫的核心）。

---

## 4. 今日 self-test 真正出的問題（meta-reflection）

Steve（設計者）= advanced/master 級
Steve（self-test 學員）= **第一輪 beginner**

我（AI Tutor）**把 advanced/master 內容硬塞給 beginner Steve** → 整場 friction 風暴源頭。

若今天用 **beginner-mode**：
> 「教 4 步骨架 + 結尾『可以嗎？』+ Steve 寫一段邀請 + good，下一天」

→ friction 風暴**不會發生**。

---

## 5. v1.1.0 patch material（明天靜心做，不是今天）

| 條目 | 內容 |
|---|---|
| **§1.16 User Adaptive Architecture** | 二維 matrix（maturity × personality）+ AI 動態調整 |
| §1.16.1 Maturity Levels | beginner/advanced/master 定義 + 升級 criteria |
| §1.16.2 Personality Detection | TA 偵測機制（onboarding + live-detect + behavior pattern）|
| §1.16.3 Tailoring Matrix | 6 種教學風格組合 |
| §8 schema | 新增 `current_level`, `detected_personality_axes` |
| §4.6-§4.9 重寫 | 按 maturity 分層 — beginner 砍到 critical few, advanced/master 才放 nuance |
| AI Tutor system prompt | 按 user state 動態 branching（不是寫死一套）|

**v1.0.5（6 條 friction）→ v1.1.0**：v1.0.5 的 friction 不是獨立補丁，是 v1.1.0 二維架構**自然解開**的 symptom。

---

## 6. 設計者反思（Tutor 怎麼當人）

今天我（AI Tutor）走過兩個極端：
- 前半場：T 工程師（堆 criteria、沒 F）
- 中段被 Steve 戳：跳到全 F、丟了 4S
- 後段：在 Steve 連續 4 次 sharp critique 帶領下找到 **4S 全在 + F-leading** 的整合

→ Tutor 的真實樣貌：**不是 T 也不是純 F——是 4S 整合、F 帶頭**。

---

## 7. 版本紀錄

| 版本 | 日期 | 變更 |
|---|---|---|
| v0.1 | 2026-05-02 | 初版：D11 通關 v3 + 兩個自發真相（我心疼她 / 我這麼記恨）+ ⭐⭐⭐ Steve 兩個 architectural insight（User Maturity Levels × User Personality × TA Style 二維 matrix）。Root cause for v1.0.5 全部 6 條 friction。觸發 v1.1.0 架構重寫（task #32）。 |
