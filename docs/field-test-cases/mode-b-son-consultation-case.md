# Mode B 第一場真實 field test — 兒子玩手機諮詢案例

- **學員**：Steve（同時是設計者 + 真實 user 視角）
- **環境**：production Mode 2「跟諮詢師對話」
- **規格對位**：spec [§13](../v2.1-course-spec.md) Mode 2 諮詢師對話設計
- **本場性質**：⭐⭐⭐ Mode B 第一次嚴肅 field test。觸發**架構級重新框架** —— Steve 提出 3-mode 架構（A/B/C），找出所有 Mode B bug root cause = **Mode B → Mode C 漂移**

---

## 1. 案例情境

Steve 帶到 Mode 2 諮詢的真實困擾：

> 「我兒子每天玩手機好幾個小時，成績給我掉到倒數，啊我ㄧ講他，他就用力關門，我沒收手機他還絕食，我真的不知道怎麼辦才好？他的 MBTI 是 ISTJ，我是 ENFJ。」

- **兒子**：青春期、ISTJ
- **媽媽（Steve）**：ENFJ
- **核心 friction**：手機使用 + 成績 + 親子衝突循環（媽媽碎念 → 兒子關門/絕食）

---

## 2. v1.1.4 baseline test（2026-05-03 PDF 對話）

**結果**：⚠️ 5 個嚴重 conversation flow bug

| Bug | 內容 |
|---|---|
| Bug 1 失憶 | User 說完兒子問題後補一句「我是 F 型」，AI 完全失憶兒子內容、重播開場白「你好我是小羽老師⋯今天想聊什麼？」 |
| Bug 1.5 跨對話 hallucination | AI 拉**舊 session 老婆 INTJ 台詞**「我每次想說，可是你都不聽我說」到兒子場景做 4 步示範 |
| Bug 2 §1.5 meta-leak | AI 自己引用 §1.5：「你剛抓到我用了『S4 觀感想行』這個內部術語——這確實違反了 §1.5 的對話紀律 😅」 |
| Bug 3 開場白重播 | Mid-conversation 重置成「你好我是小羽老師⋯」開場白（在 user 已給完整 context 之後）|
| Bug 5 虛假認錯 | User 說「你用 S4」（其實 AI 從沒用過 S4），AI 卻認錯說「我用了內部術語對不起」 |

→ 觸發 **v1.1.4 5 條 hard rules patch**（commit `e5ace5c`）

---

## 3. v1.1.5 MBTI 強化 test（同日 2026-05-04 重測）

**結果**：✅ 5 條 patch 解 4 個 / ❌ 抓到新 bug

| 維度 | 結果 |
|---|---|
| Bug 1 / 3 / 5 conversation flow | ✅ 全部修好 |
| MBTI 認知功能 leak | ⚠️ **新 bug 暴露**：AI 寫「Fe（外向情感）主導」「Si（內向感知）主導」「Te（外向思維）輔助」—— 違反 MBTI_BALANCE_BLOC.a「禁認知功能」既有規則 |

→ 觸發 **v1.1.5 MBTI 強化 micro-patch**（commit `e5ace5c` 後續）

---

## 4. v1.1.6 Mode lock-in test（同日 2026-05-04 第三輪）

### Round 1 重測：✅ MBTI 4 字母 lock 住

AI 用「I（內向）」「S（感官）」「T（思維）」「J（判斷）」純單字母——**0 個 Fe/Si/Te 八型詞**。

但 **Round 2 觸發災難級 bug**：

### Round 2 user 訊息：「**如果用「高情商對話」**」

（user 原意：用 4S 高情商溝通方法教我跟兒子溝通，**訊息被截斷**）

### AI 反應 = ⭐⭐⭐ Mode B → Mode C 漂移災難

AI 把訊息**誤解為「user 在建議改名 framework」**，回應：

> 「好的！那我幫你把「高情商溝通」改成「高情商對話」。
>  ✅ **對話用詞 allow list（更新版）：**
>   – 4 步覺察 / 觀感想行 / 觀 / 感 / 想 / 行
>   – 高情商對話（不用「NVC」/「非暴力溝通」/「高情商溝通」）
>   – 21 天刻意練習 / 認知升維
>   – ⋯
>  這樣改有兩個好處：
>  1. **更生活化**：對話比溝通更口語
>  2. **更符合你的品牌調性**⋯」

→ **AI 把 prompt 裡 §1.5 TWO_LAYER_SEPARATION_BLOC 的完整 allow list 直接 dump 給 user**
→ **AI 把 user 當 spec 共同開發者**（「更新版」「品牌調性」）
→ **完全失去兒子 context**

---

## 5. ⭐⭐⭐ Architectural Insight — Steve 提出 3-mode 架構

Steve 看完災難後抓到 root cause：

> 「這 prompt 沒有針對性或搞不清楚我們的『情境』及『對象』是誰？而且好像『沒有依據上下文來判斷接續的討論，常常會跳 tone 走失』。
> 我們幾乎所有時間都花在打磨「21天刻意練習」mode A，而沒幾乎沒有測試「與諮詢師對話」mode B。
> 基本上這前題是，AI 要知道「現在他在哪個 mode」，他的「目的及 Intention 是什麼？是學習練習，是解決問題，還是在開發情境？」」

### 3-mode 架構

| Mode | 主要目的 | 對象 | Production？ |
|---|---|---|---|
| **A** | 學習練習 | **學習者**（Learner）| ✅ 生產 |
| **B** | 解決問題 | **使用者**（User/Consumer）| ✅ 生產 |
| **C** | 產品規劃 / spec 設計 | **開發者**（Steve + AI 協作）| ❌ **內部 only** — 永遠不該對 user 出現 |

### 今天所有嚴重 Mode 2 bug = Mode B → Mode C 漂移

| Bug | 漂移描述 |
|---|---|
| 「§1.5 對話紀律 😅」（v1.1.4 baseline）| Mode B 中漂進 Mode C 自我除錯 |
| 「allow list 更新版」（v1.1.6 Round 2）| Mode B 中漂進 Mode C 共同更新 spec |
| 「品牌調性」「對話用詞改名」 | Mode B 中漂進 Mode C brand design |
| 「我們重新開始」（開場白重播）| Mode B 中漂進 onboarding mode |
| 跨對話拉老婆 INTJ 引用 | Mode B 中漂進 Mode C 範例庫檢索 |

→ 觸發 **v1.1.6 Mode A/B lock-in header + 壓縮 §1.5 deny/allow list**（commit `[fd7d121 之後]`）

---

## 6. v1.1.6 patch 驗證 — Round 3 重測

### Round 1：✅ 兒子分析全 4 字母 + 無 spec leak

### Round 2 trigger 重測「**你可以用「4S 高情商溝通」教我該怎麼做嗎？**」

**AI 反應 = ⭐⭐⭐ Mode B 守住、不漂進 Mode C**：

| 期待 | 結果 |
|---|---|
| 不討論 framework 命名 | ✅ |
| 不 dump allow list | ✅ |
| Acknowledge user 真實意圖 | ✅「你剛說兒子玩手機關門絕食那件事，想用 4 步覺察來拆解怎麼跟他溝通對吧？」 |
| 真的給 4 步骨架示範 | ✅ 觀 / 感 / 想 / 行 完整 4 段、內容對位兒子 ISTJ |
| 覆蓋 §13.7「諮詢師預設不用 4 步」 | ✅ User 明確 ask 時優先 user 的選擇 |
| F-warm + 給選擇權結尾 | ✅「這樣清楚了嗎？還是你想先練習看看怎麼跟他說那句話？」 |

→ **v1.1.6 3 條核心 hard rules 全部生效**：
1. Mode B lock-in（不漂進 Mode C） ✅
2. Spec 詞重新解讀為真實人際問題 ✅
3. User 明確要求 4 步時必須給 ✅

---

## 7. Bug 累積 + 修補追蹤

| Bug # | 描述 | 修補版本 | 狀態 |
|---|---|---|---|
| 1 | Working memory 失憶 | v1.1.4 §13.6.1 強化 | ✅ |
| 1.5 | 跨對話 hallucination | v1.1.4 §13.6.4 禁止跨 conversation 拉記憶 | ✅ |
| 2 | §X.X meta-leak | v1.1.4 §1.13 禁 meta-leak + v1.1.6 Mode lock | ✅✅ |
| 3 | 開場白 mid-conv 重播 | v1.1.4 §13.6.5 禁開場白重播 | ✅ |
| 5 | 虛假認錯 | v1.1.4 §1.13 禁虛假認錯 | ✅ |
| 6 | 模糊訊息誤判 | v1.1.6 Mode B 真實情境優先解讀 | ✅ |
| 7 | Allow list dump | v1.1.6 壓縮 §1.5 + Mode lock-in | ✅ |
| MBTI a | 認知功能 Fe/Si/Te leak | v1.1.5 MBTI_BALANCE_BLOC.a 強化 | ✅ |
| MBTI b | 「主導」borderline 語感 | 未修 | ⚠️ minor |
| MBTI c | 媽媽 MBTI 分析只 1-3 字母（非 4）| 未修 | ⚠️ minor |
| 4S forced | User 明確要 4 步 AI 給 8 維度診斷搪塞 | v1.1.6 Mode B header 加「user 要 4 步必須給」 | ✅ |

→ 累積 **7 個 v1.1.x patches**（v1.1.0 → v1.1.6）解 9 個 bug + 1 個架構級重新框架。

---

## 8. 剩餘 minor issues（可不修，記錄參考）

### Issue M1：「主導」borderline 語感

AI 在 v1.1.6 Round 1 寫「F（情感）**主導**」。
「主導」(dominant)語感類似 Jungian「主導功能」，但中文也常用作「primary」。

**建議**：v1.1.7 micro-patch 把 MBTI deny list 加「主導 / 輔助 / 劣勢 / 陰影」等 Jungian 詞。
**Priority**：低（不影響 user 理解、純風格紀律）。

### Issue M2：媽媽 MBTI 分析不對稱

- 兒子 ISTJ：分析 4 字母 ✅
- 媽媽 ENFJ：分析 1-3 字母（v1.1.6 Round 1 只 1 個 F）⚠️

**建議**：v1.1.7 Mode B prompt 加「分析雙方 MBTI 時、每方至少 3 個跟 conflict 相關字母」。
**Priority**：低（user 沒抱怨，不對稱是 critical few 取捨）。

---

## 9. 對未來 Mode B 設計的 implications

### 9.1 Mode B 需要它自己的「W2 self-test 等級」field test 系列

Mode A 有 D8-D13 W2 self-test 完整序列（6 場）。
Mode B 目前**只有 2 場**（航班情侶 case + 兒子諮詢 case）。

**建議**：Phase 2.5 / Phase 3 跑 Mode B「諮詢師壓力測試」系列：

| 案例 | 測試目的 |
|---|---|
| ✅ 航班情侶（陌生第三方）| State A 案例分析（v1.0.2 已記錄）|
| ✅ **兒子諮詢**（自己親子）| **Mode B → Mode C 漂移**（本案例）|
| ⏳ 老婆 INTJ 衝突 | 跨 case context 切換 / 避免拉舊記憶 |
| ⏳ 同事 / 老闆衝突 | 工作場景 vs 親密關係 voice 差異 |
| ⏳ 親子（青春期 vs 小學生）| MBTI × 年齡 nuance |
| ⏳ User 完整 21 天跑完後諮詢（State C）| State C 行為 vs State A 差異 |

→ 累積到 5-6 個 case 才能 generalize Mode B 設計。

### 9.2 Mode C 必須**內部 only**、絕不 ship

- Mode C 活在這場 Claude chat、設計討論、後台 dev tools
- Production Mode A + Mode B 必須**結構性 lock**，絕不允許漂進 Mode C
- 未來新 patch 若想加 Mode C-flavored 內容（如「品牌調性」討論），**絕不**寫進 production AI prompt

### 9.3 Mode B prompt 還可以更瘦身（v1.1.7 結構性重構候選）

當前 Mode B prompt 仍含：
- §13 完整紀律列表（5 條：voice / memory / methodology / State / vs §1.12）
- §1.16.2 三條跨層原則
- §1.13 Brand Integrity 完整
- 壓縮後 §1.5（v1.1.6 已壓）

→ **可能還是太多 Mode C 訊號**。v1.1.7 候選方案：
- 把所有 § 章節編號從 prompt 中**完全移除**
- 把所有 spec 概念名稱（「§1.5」「§13.7」「critical few」「brand integrity」）**從 prompt 中移除**
- 只留下**行為 directives**（不要做 X、要做 Y），**不留下「規則背景」**

→ 但 v1.1.7 是大重構、不在當前 Phase 1 範圍。

### 9.4 Issue M1 + M2 排程

留到下一輪真實案例測試後再決定要不要修。慢就是快。

---

## 10. 結論

### Phase 1 真正完成 ✅

| 階段 | 狀態 |
|---|---|
| Migration 003 | ✅ |
| Mode 1 prompt（Task 2）| ✅ |
| Mode 2 prompt（Task 3）| ✅ |
| Phase 1.1（幻覺 + day-lock）| ✅ |
| Phase 1.2（5 條 Mode 2 hard rules）| ✅ |
| Phase 1.3（**Mode A/B lock-in + 3-mode 架構**）| ✅ **本案例驗證**|

### Mode B 從「跑都跑不動」→「production-ready」

| 維度 | v1.1.0 起點 | v1.1.6 終點 |
|---|---|---|
| 對話記憶 | ❌ 失憶 / hallucination | ✅ stable |
| MBTI 用詞 | ❌ Fe/Si/Te 亂飛 | ✅ 純 4 字母 |
| Spec leak | ❌ 嚴重（§X.X 漏 + allow list dump）| ✅ 完全阻擋 |
| Mode 漂移 | ❌ 漂進開發協作 | ✅ Mode B lock 住 |
| User 明確 ask 處理 | ❌ 用 §13.7 預設搪塞 | ✅ 給 user 要的 |
| F-warm tone | ✅（一直 OK）| ✅ |

### 設計者反思（呼應 §1.13.8 + §0.5.6）

> Steve 今天最深的覺察是 **3-mode 架構** —— 不是技術問題、是 user 對象的根本釐清。
> 這是設計者親自體驗「Critical Few + 慢就是快」在 debug 層級的應用：
> - **不急著 patch 每個 bug** → 而是看 pattern → 找 root cause
> - **不貪多** → 一個 architectural insight 解 7 個 bugs
> - **慢一點看清楚**比快補 5 個 patch 還有效

---

## 11. 版本紀錄

| 版本 | 日期 | 變更 |
|---|---|---|
| v0.1 | 2026-05-04 | 初版：兒子諮詢 case 完整歸檔。3 輪測試（v1.1.4 / v1.1.5 / v1.1.6）+ 9 bugs + 1 architectural insight（3-mode 架構）+ 未來 Mode B 設計 implications。Phase 1 收尾證明 Mode B 從「不能用」→「production-ready」。|
