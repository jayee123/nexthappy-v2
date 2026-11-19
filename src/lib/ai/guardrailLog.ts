import { supabaseAdmin } from '@/lib/supabase';

// 中高風險 guardrail 對話記錄——寫進 happy.guardrail_logs
// （見 supabase/migrations/020_guardrail_logs.sql），供人工事後審查
// 誤判、回饋打磨 prompt。只記套話風險（extraction）軸，不含單純離題
// off_topic（離題只是體驗優化，不是商業 IP 防護的核心）。
//
// fail-soft：寫入失敗只記 log，不影響guardrail本身的放行/擋下判斷
// （guardrail 的判斷在呼叫 api/guardrail-check.py 時就已經決定了）。

type GuardrailRoute = 'chat' | 'consultant';

function riskTierFromOutcome(outcome: string): 'mid' | 'high' | null {
  if (outcome === 'extraction_high' || outcome === 'extraction_mid_escalated') return 'high';
  if (outcome.startsWith('extraction_mid')) return 'mid';
  return null;
}

export async function logGuardrailEventIfNeeded(params: {
  outcome: string;
  userId: string;
  sessionKey: string;
  route: GuardrailRoute;
  message: string;
  refusalText: string | null;
}): Promise<void> {
  const riskTier = riskTierFromOutcome(params.outcome);
  if (!riskTier) return; // off_topic／relevant 不記

  try {
    const { error } = await supabaseAdmin.from('guardrail_logs').insert({
      user_id: params.userId,
      session_key: params.sessionKey,
      route: params.route,
      message: params.message,
      outcome: params.outcome,
      risk_tier: riskTier,
      refusal_text: params.refusalText,
    });
    if (error) {
      console.error('[guardrailLog] insert failed:', error);
    }
  } catch (err) {
    console.error('[guardrailLog] insert threw:', err);
  }
}
