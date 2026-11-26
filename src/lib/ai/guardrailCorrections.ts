// 放置路徑：src/lib/ai/guardrailCorrections.ts
//
// 讓人工在 /admin/guardrail-logs 標記的「誤判」真的回頭影響 AI 的判斷：
// chat/route.ts、consultant/route.ts 呼叫 api/guardrail-check.py 之前，
// 先用這支撈最近幾筆 verdict='false_positive' 的案例，當成 corrections
// 一起傳給分類器；guardrail-check.py 再把它們塞進 self_check_extraction
// 的 prompt 當 few-shot 糾正範例（見該檔案、nexthappy-config/actions.py）。
//
// api/guardrail-check.py 本身刻意不碰 DB（維持單純分類器，見該檔案開頭
// 的說明），所以撈資料這一步放在已經有 supabaseAdmin 的 TS 層做，
// 跟 guardrailLog.ts（寫入 log）是同一層、對稱的設計。
//
// 用記憶體快取（TTL）避免每則訊息都查一次 DB——corrections 的更新頻率
// 是「人工偶爾點一下」等級，不需要即時；快取沒命中時 fail-soft 回空陣列，
// 不讓查詢失敗擋住正常對話。

import { supabaseAdmin } from '@/lib/supabase';

export interface GuardrailCorrection {
  message: string;
  note: string | null;
  risk_tier: string;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CORRECTIONS = 5;

let cache: { data: GuardrailCorrection[]; expiresAt: number } | null = null;

export async function getRecentGuardrailCorrections(): Promise<GuardrailCorrection[]> {
  if (cache && cache.expiresAt > Date.now()) {
    return cache.data;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('guardrail_logs')
      .select('message, reviewer_note, risk_tier')
      .eq('verdict', 'false_positive')
      .order('created_at', { ascending: false })
      .limit(MAX_CORRECTIONS);

    if (error) {
      console.error('[guardrailCorrections] query failed:', error);
      return cache?.data ?? [];
    }

    const corrections: GuardrailCorrection[] = (data || []).map(r => ({
      message: r.message,
      note: r.reviewer_note,
      risk_tier: r.risk_tier,
    }));

    cache = { data: corrections, expiresAt: Date.now() + CACHE_TTL_MS };
    return corrections;
  } catch (err) {
    console.error('[guardrailCorrections] unexpected error:', err);
    return cache?.data ?? [];
  }
}
