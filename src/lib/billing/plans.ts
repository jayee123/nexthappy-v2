// 放置路徑：src/lib/billing/plans.ts
//
// Phase 1A：訂閱方案常數定義
//
// 4 個方案：trial（7 天試用、Premium 級別功能）/ basic / advanced / premium / cancelled
// 額度單位：「對話次數」（user 一輪 + AI 一輪 = 1 則）
// 訂價：TWD / 月（內部 billing 計算用、user 介面顯示時格式化）
//
// Token cost rate（Claude Sonnet 4.5、2025 年定價）給 admin / billing reconciliation 用
// USD → TWD 用 ~30 估算（admin 後台可調整）

export type PlanTier = 'trial' | 'basic' | 'advanced' | 'premium' | 'cancelled';

export interface PlanSpec {
  /** 方案 code（DB enum）*/
  tier: PlanTier;
  /** UI 顯示 label */
  label: string;
  /** 一句話定位 */
  tagline: string;
  /** 月對話額度上限（一則 = user + AI 一輪）*/
  monthly_messages: number;
  /** 月訂價（TWD、整數）*/
  price_twd: number;
  /** trial 才有的天數 */
  trial_days?: number;
  /** 適合人群 */
  suitable_for: string;
  /** 主要 features（給訂閱頁顯示） */
  features: string[];
}

// ============================================================
// 方案定義
// ============================================================

export const PLANS: Record<PlanTier, PlanSpec> = {
  trial: {
    tier: 'trial',
    label: '免費試用',
    tagline: '7 天嚐到 Premium 完整體驗',
    monthly_messages: 100,   // 7 天 cap、防濫用
    price_twd: 0,
    trial_days: 7,
    suitable_for: '首次接觸、想先體驗的人',
    features: [
      '✨ 7 天 Premium 級體驗',
      '🤝 Mode B 諮詢深度版完整使用',
      '🌱 21 天練習任意對話',
      '⚠️ 試用期最多 100 則對話',
    ],
  },
  basic: {
    tier: 'basic',
    label: 'Basic 啟動',
    tagline: '開啟你的幸福練習旅程',
    monthly_messages: 80,
    price_twd: 5, // 測試用統一價（實際扣款走 subscription-cycle）
    suitable_for: '剛開始接觸練習的人',
    features: [
      '🌱 開始進行基本練習與引導式對話',
      '💬 透過簡單情境、認識自己的反應模式',
      '✨ 建立「我可以練、我做得到」的信心感',
      '📊 每月最多 80 則對話',
    ],
  },
  advanced: {
    tier: 'advanced',
    label: 'Advanced 深化',
    tagline: '讓你的改變開始穩定發生',
    monthly_messages: 200,
    price_twd: 5, // 測試用統一價
    suitable_for: '已開始練習、希望更快理解與調整的人',
    features: [
      '🔄 可反覆演練同一種情境（關係、溝通、選擇）',
      '👁️ 開始看懂「為什麼我會這樣反應」',
      '✅ 從「試試看」進入「我知道怎麼做比較好」',
      '📊 每月最多 200 則對話',
    ],
  },
  premium: {
    tier: 'premium',
    label: 'Premium 整合',
    tagline: '真正用在你的人生裡',
    monthly_messages: 500,
    price_twd: 5, // 測試用統一價
    suitable_for: '有明確目標、想實際改變關係 / 狀態 / 人生方向的人',
    features: [
      '🏃 長時間陪伴式練習（不只單次對話）',
      '🔗 跨情境整合：關係 × 情緒 × 選擇 × 行動',
      '🎯 從「知道」進入「做到」、再到「做得穩」',
      '📊 每月最多 500 則對話',
    ],
  },
  cancelled: {
    tier: 'cancelled',
    label: '已取消',
    tagline: '訂閱已停用、可隨時重新訂閱',
    monthly_messages: 0,
    price_twd: 0,
    suitable_for: '已停用訂閱',
    features: [],
  },
};

/** 可訂閱的方案（不含 trial / cancelled、給訂閱頁列出）*/
export const PURCHASABLE_PLANS: PlanTier[] = ['basic', 'advanced', 'premium'];

// ============================================================
// Token 成本估算（admin / billing reconciliation 用）
// ============================================================

/** Claude Sonnet 4.5 定價（USD per million tokens、2025）*/
export const CLAUDE_SONNET_45_USD_PER_MTOK = {
  input: 3.0,
  output: 15.0,
};

/** USD → TWD 估算匯率（admin 可調、保守取 30）*/
export const USD_TO_TWD = 30;

/**
 * 估算單次 AI 呼叫的 TWD 成本
 * @param input_tokens Anthropic response.usage.input_tokens
 * @param output_tokens Anthropic response.usage.output_tokens
 */
export function estimateClaudeCallCostTwd(input_tokens: number, output_tokens: number): number {
  const input_usd = (input_tokens / 1_000_000) * CLAUDE_SONNET_45_USD_PER_MTOK.input;
  const output_usd = (output_tokens / 1_000_000) * CLAUDE_SONNET_45_USD_PER_MTOK.output;
  return (input_usd + output_usd) * USD_TO_TWD;
}

// ============================================================
// Helper：判斷 plan 是否在「有效訂閱狀態」
// ============================================================

/**
 * 該 user 是否目前處於可使用 AI 對話的訂閱狀態
 * （trial / basic / advanced / premium 都算、cancelled 不算）
 */
export function isPlanActive(tier: PlanTier): boolean {
  return tier !== 'cancelled';
}

/**
 * 給予該 tier 的月對話額度
 */
export function getMonthlyMessageQuota(tier: PlanTier): number {
  return PLANS[tier].monthly_messages;
}
