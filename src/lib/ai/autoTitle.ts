// 放置路徑：src/lib/ai/autoTitle.ts
// v1.3.3a 新增：諮詢主題 auto-titling
// 用 GPT-4o mini（fast + cheap）從 user 第一句訊息生成 5-15 字主題標題
//
// 對應：Migration 006 conversations.topic_title 欄位
//       docs/architecture-phase-2-proposal.md §3.4 auto-titling 機制
//
// 使用：
//   import { generateTopicTitle } from '@/lib/ai/autoTitle';
//   const title = await generateTopicTitle(userFirstMessage);
//   // → e.g. "兒子玩手機、成績掉、絕食"

import { callOpenAIChat } from '@/lib/ai/openai';

const MAX_TITLE_LENGTH = 20;
const MAX_INPUT_LENGTH = 500;

/** 模型判斷「這句話沒有可下標的內容」時要回的字串 */
const NO_TOPIC_TOKEN = 'NONE';

/**
 * 模型「在解釋而不是在下標」的跡象。
 *
 * 為什麼需要這道檢查：模型被要求「給一個標題」時，即使輸入沒有內容
 * （例如只有「你好」），它也傾向擠出一句話交差 —— 而那句話會被原封不動
 * 寫進 topic_title。正式站上就出現過主題叫「無法判斷諮詢主題」。
 * NO_TOPIC_TOKEN 給了模型正確的出口，**這裡只是第二道網、不是主要機制**。
 *
 * 所以樣式要窄：寧可漏掉一句模型的廢話（下一句訊息還會再試），
 * 也不要誤殺一個合法標題（那會讓那個主題永遠沒有名字，而且每則訊息
 * 都白呼叫一次 Haiku）。第一版寫成 /無法/、/不能/、/對不起/ 這種單字比對，
 * 在這個產品裡等於把最典型的諮詢主題全擋掉 —— Jeff review 時抓到的。
 */
const NOT_A_TITLE_PATTERNS = [
  // 模型在對我們說話，而不是在下標
  /^(很抱歉|抱歉|對不起|sorry)/i,

  // 明確在講「這個下標任務做不到」。
  // ⚠️ 「無法」「不能」後面**必須接動作**才算 —— 不可以只比對那兩個字。
  //    這是一個關係諮詢產品，「無法」「不能」「對不起」正是使用者每天在講的話：
  //      「無法跟婆婆溝通」「他說我不能出門」「他從不說對不起」
  //    都是完全合法、而且很典型的諮詢主題標題。
  /(無法|不能|難以|沒辦法)(判斷|確定|提供|生成|產生|給出|下標)/,
  /(沒有|缺乏)\s*(足夠的?)?(內容|資訊|訊息|上下文|脈絡)/,
  /請(提供|給我|告訴我|補充)/,
  /需要更多(的)?(資訊|訊息|內容|脈絡|上下文)/,

  // 一個「諮詢主題」的標題不會提到「標題」這兩個字
  /標題/,
];

/**
 * 簡體字偵測用的字元集。
 *
 * 只用來「判斷有沒有飄成簡體」，不做轉換 —— 所以不需要完整對照表，
 * 收常見的簡化字即可：任何一句 5 字以上的簡體中文，幾乎一定命中其中之一。
 * 正式站出現過的「术后不听医嘱、丈夫四处奔波、妻子无法劝阻」就命中 7 個。
 *
 * ⚠️ 只放「簡體才有、繁體不會用」的字。
 *
 * 繁體也合法的字**絕對不能收** —— 收了會把正常標題誤判成簡體、白重試一次，
 * 嚴重時還會讓那個主題拿不到名字。第一版就誤收了這幾個，測試才抓出來：
 *
 *     里（鄰里、公里）  谷（山谷）  斗（北斗、一斗米）
 *     划（划船、划算）  淀（沉淀）
 *
 * 其他常見的陷阱字（本來就沒收，別加進來）：
 *     后（皇后） 面（面孔） 松（松樹） 系（系統） 制（制度） 表（表格）
 *     干（干預） 台（台灣） 云（人云亦云） 丑（丑角） 几（茶几） 才（才能）
 *     只（只有） 向（方向） 范（范姓） 准（准許） 折（折疊） 板（木板）
 *     布（布料） 采（采風） 蒙（蒙古） 咸（咸豐）
 *
 * 判準：**這個字在繁體文章裡會不會單獨出現？會的話就不能收。**
 */
const SIMPLIFIED_CHARS = new Set(
  ('们这那说对时会来过还没开关学实发经问题应该让从见觉认为无医术处边进运选长门间风马体传动务办华单卖听员团园图国众乐习书买贵质责'
 + '爱儿电话网语记讲谈论议边远达迁适遗邻释银错镇顺须顾飞饭馆骂验亿优伤侧俭债倾偿兰兴养兽军农冲决况减凉凤凭击别剧劝助势匀卫却'
 + '厂厅历压厌县参双变叙号叹吓吗听启呜响哑唤嘱困围圆圣场坏块坚坛垒垦堕塑墙壮声壳备复够头夹夺奋奖妆妇妈娱婴孙宁宝宠审宪宾寝寻导'
 + '寿将尔尘尝层属屡岁岂岗岛岭峡崭巩币帅师帐帘帜带帮广庄庆库庙庞废异弃张弥弯归当录彻径御忆忧怀态怜总恋恳恶恼悦悬惊惧惨惩惫惭愤'
 + '愿懒戏战户扑执扩扫扬扰抚抛抢护报拟拢拣担拥择挂挚挠挡挣挤挥损捡换据捣掳掷摄摆摇摊撑数斋断旧旷昼显晋晒晓晕暂杀杂权条杨极构'
 + '枢枣枪柜标栈栋栏树样档桥桨桩梦检楼榄欢欧歼残殴毁毕毙气汇汉汤沟沥沦沧泞泪泼泽洁洒浅浆浇济浏浑浓测浦涂涌涛涨涩渐渗温湾湿溃'
 + '滚满滤滨滩潜潮灭灯灵灾炉点烟热焕爷牵犹狮独狱猪献玛环现玺琼瑶璎瓒瓯电畅畴疗痉痒痴瘫皱盏盐监盘卢眍眦睁瞒矫码砖础硕确碍礼祸祷禄'
 + '离种积称稳穷窃窜窝竞笔笋筑筛简箧类粮糁纠红纡纣约级纪纫纬纭纯纰纱纲纳纵纶纷纸纹纺纽线练组绅细织终绊绋绍绎经绑绒结绕绘给绚络绝'
 + '统绞绢绣绥绦继绩绪续绳维绵绷绸综绽绿缀缄缅缆缇缈缉缎缓缔缕编缘缚缜缝缠缤缩缪缭缰缴罚罢罗羁羟翘耻聂职联聋肃肠肤肮肿胀胁胧脉脏'
 + '脑脓脸腊腭腻膑臜舆舰舱艰艳节芜苇苏苹茎荆荐荡莱莲获萝营萧蓝蓟蔷薮虏虑虾蚁蚂蚕蛊蜡蝇蝈螀衅补袄装裆裢褛觅规觉觊觎触誉计订讣认讥'
 + '诀证诂诃评诅识诈诉诊词译试诗诚诛话诞诟诠诡询该详诧诫诬语误诱诲说诵请诸诺读课谁调谅谈谊谋谍谎谐谓谚谜谢谣谨谪谬谭谱谴豮贝贞'
 + '负贡财责贤败货质贩贪贫购贮贯贱贴贵贷贸费贺贻贼贾赁赂赃资赅赆赈赊赋赌赎赏赐赔赖赘赚赛赜赝赞赠赡赢赣赵赶趋趸跃跄跞践跶跷跸跹跻'
 + '踊踬蹒蹰躏躜车轧轨轩轫转轭轮软轰轱轳轴轵轶轷轸轹轺轻轼载轾轿辄辅辆辇辈辉辊辋辍辎辏辐辑输辔辕辖辗辘辙辚辞辩辫边辽达迁过迈运还'
 + '这进远违连迟迩迳适选逊递逦逻遗遥邓邝邬邮邹邺邻郁郏郐郑郓郦郧郸酝酱释鉴韦韧韩顶顷项顺须顽顾顿颁颂预颅领颇颈颉颊颍颐频颓颔颖'
 + '颗题颚颛颜额颞颟颠颡颢颤颥颦颧风飏飐飑飒飓飔飕飗飘飙飚飞饥饧饨饩饪饫饬饭饮饯饰饱饲饳饴饵饶饷饺饼饽饿馀馁馂馄馅馆馇馈馊馋馍馏'
 + '馒馓馔马驭驮驯驰驱驳驴驵驶驷驸驹驺驻驼驽驾驿骀骁骂骄骅骆骇骈骊骋验骏骐骑骒骓骕骖骗骘骚骛骜骝骞骟骠骡骢骣骤骥骧髅髋髌鬓魇魉鱼'
 + '鲁鲜鲤鲨鲸鳄鳖鸟鸡鸣鸥鸦鸭鸯鸳鸽鸾鸿鹃鹅鹉鹏鹤鹦鹧鹰鹿麦麸黄黉黑黾鼋鼍齐齿龄龙龚龟').split('')
);

/** 這串裡有沒有簡體字？（只偵測、不轉換） */
export function hasSimplifiedChars(text: string): boolean {
  return Array.from(text).some((ch) => SIMPLIFIED_CHARS.has(ch));
}

/**
 * 模型回的這串是「在推託」而不是「一個標題」嗎？
 *
 * 匯出是為了讓測試釘住它 —— 這支的風險不在漏抓（下一句還會再試），
 * 而在誤殺（那個主題永遠沒有名字，而且每則訊息都白呼叫一次 Haiku）。
 */
export function looksLikeRefusal(text: string): boolean {
  return NOT_A_TITLE_PATTERNS.some((re) => re.test(text));
}

/** 呼叫模型並清理輸出。回 null = 沒有可用的文字。 */
async function askForTitle(trimmed: string, correction?: string): Promise<string | null> {
  const text = await callOpenAIChat({
    model: 'gpt-4o-mini',
    maxTokens: 30,
    messages: [
      {
        role: 'user',
        content: `以下是 user 諮詢的第一句訊息、請用 5-15 個字幫這個諮詢主題下一個短標題。

要求：
- **一律使用繁體中文（台灣用語）。絕對不要輸出簡體字。**
- 直接給標題文字、不要加標點符號 / 引號 / 解釋
- 5-15 字、聚焦最關鍵的「對象 + 行為 / 卡點」
- **若這句訊息沒有具體的諮詢內容（例如只是打招呼、只有一兩個字、看不出在談什麼），
  只輸出 NONE 這四個字母、不要解釋、不要自己造一個標題。**
- 範例：
   input「你好」→ output「NONE」
   input「在嗎」→ output「NONE」
   input「我兒子每天玩手機⋯成績掉⋯絕食」→ output「兒子玩手機、成績掉、絕食」
   input「我老婆 3 天不講話」→ output「老婆冷戰、不肯講話」
   input「主管 micromanage」→ output「主管不信任、micromanage」

User 訊息：
${trimmed}
${correction ?? ''}
標題：`,
      },
    ],
  });

  if (!text) return null;

  // 清理：去引號、去換行、去前後空白
  const title = text.trim()
    .replace(/^["「『'`]+|["」』'`]+$/g, '')
    .replace(/[\n\r]+/g, ' ')
    .replace(/^標題[：:\s]*/, '') // 去掉模型可能殘留的「標題：」前綴
    .trim();

  return title || null;
}

/** 判斷 + 兩道檢查（推託 / 簡體）+ 必要時重試一次。 */
async function generateTitleInner(trimmed: string): Promise<string | null> {
    let title = await askForTitle(trimmed);
    if (!title) return null;

    // 模型給的出口
    if (title.toUpperCase() === NO_TOPIC_TOKEN) return null;

    // 第二道網：模型仍然在解釋而不是在下標
    if (looksLikeRefusal(title)) {
      console.warn('[autoTitle] 模型回的不像標題，視為無法判斷:', title);
      return null;
    }

    // ── 繁體檢查 ──────────────────────────────────────────
    // prompt 已經明確要求繁體，但短輸出仍可能飄成簡體 ——
    // 正式站出現過「术后不听医嘱、丈夫四处奔波、妻子无法劝阻」，
    // 而使用者輸入的原文全是繁體，是模型自己轉的。
    // 飄了就用更明確的指令重試一次；再飄就放棄（回 null），
    // 下一則訊息還會再試 —— 寧可沒有標題，也不要把簡體寫進 DB。
    if (hasSimplifiedChars(title)) {
      console.warn('[autoTitle] 輸出含簡體字，重試一次:', title);
      const retried = await askForTitle(
        trimmed,
        '\n⚠️ 提醒：上一次你輸出了簡體字。請務必只用繁體中文（台灣用語）。',
      );
      if (!retried || retried.toUpperCase() === NO_TOPIC_TOKEN || looksLikeRefusal(retried)) {
        return null;
      }
      if (hasSimplifiedChars(retried)) {
        console.error('[autoTitle] 重試後仍是簡體，放棄下標:', retried);
        return null;
      }
      title = retried;
    }

    return title.length > MAX_TITLE_LENGTH ? title.slice(0, MAX_TITLE_LENGTH) : title;
}

/**
 * 從 user 的諮詢訊息生成 5-15 字的短主題標題
 *
 * @param userMessage 要據以下標的 user 訊息
 * @returns 5-20 字的**繁體中文**標題；無法判斷或失敗時回 null
 *
 * 回 null 而不是回一個假標題，是為了讓呼叫端「不要寫入 topic_title」——
 * 欄位維持 NULL，前端 fallback 顯示「新主題」，而且下一句訊息還能再試一次。
 * 若在這裡回 '新主題'，那個值會被當成真的標題寫進 DB，就再也沒有第二次機會了。
 *
 * 範例：
 *   input：「我兒子每天玩手機好幾個小時、成績掉到倒數⋯」
 *   output：「兒子玩手機、成績掉、絕食」
 *
 *   input：「我老婆已經 3 天不跟我講話⋯」
 *   output：「老婆冷戰、不肯講話」
 */
export async function generateTopicTitle(userMessage: string): Promise<string | null> {
  const trimmed = (userMessage || '').slice(0, MAX_INPUT_LENGTH).trim();
  if (!trimmed) return null;
  try {
    return await generateTitleInner(trimmed);
  } catch (err) {
    console.error('[autoTitle] generation failed:', err);
    return null;
  }
}
