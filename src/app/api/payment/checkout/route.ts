import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { PLANS, PURCHASABLE_PLANS, type PlanTier } from '@/lib/billing/plans'
import { nextChargeAt } from '@/lib/billing/subscription-cycle'

// 訂閱變更端點：subscribe / upgrade / downgrade / cancel
//
// ★ 試用測試模式（客戶指定）：每日定額 $5 token 扣款、與方案級別無關。
//   - subscribe：沒 token → 導向 $1 綁卡（bind-card 首次付款）；已有 token → 直接重新啟用（不扣款）
//   - upgrade：免費即時切換方案（不收差額，每日 $5 不變）
//   - downgrade：預約至下個扣款週期生效（本期不變、不扣款）
//   - cancel：停用自動續約，服務到期日前有效
//
// 舊的 esafe hongyang 扣款/解密已全數移除，token 走新的 SunPay 系統（bind-card / callback / cron）。

type CheckoutAction = 'subscribe' | 'upgrade' | 'downgrade' | 'cancel'

const VALID_ACTIONS: CheckoutAction[] = ['subscribe', 'upgrade', 'downgrade', 'cancel']

const TIER_RANK: Record<PlanTier, number> = {
  cancelled: 0,
  trial: 1,
  basic: 2,
  advanced: 3,
  premium: 4,
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: '請先登入' }, { status: 401 })
  }

  const body = await request.json()
  const action = body.action as CheckoutAction
  const targetTier = body.targetTier as PlanTier | undefined

  if (!VALID_ACTIONS.includes(action)) {
    return NextResponse.json({ error: '無效操作' }, { status: 400 })
  }

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, current_plan, payment_method_token, subscription_renews_at, auto_renewal, trial_started_at')
    .eq('id', session.userId)
    .single()

  if (!user) {
    return NextResponse.json({ error: '找不到使用者' }, { status: 404 })
  }

  const currentPlan = user.current_plan as PlanTier

  if (action === 'cancel') {
    return handleCancel(request, user)
  }

  if (!targetTier || !PURCHASABLE_PLANS.includes(targetTier)) {
    return NextResponse.json({ error: '請選擇 basic / advanced / premium' }, { status: 400 })
  }

  if (targetTier === currentPlan) {
    return NextResponse.json({ error: '已是此方案' }, { status: 400 })
  }

  if (action === 'subscribe') {
    if (currentPlan !== 'cancelled' && currentPlan !== 'trial') {
      return NextResponse.json({ error: '已有訂閱，請用升級/降級' }, { status: 400 })
    }
    return handleActivate(request, user, targetTier)
  }

  if (action === 'upgrade') {
    if (currentPlan === 'trial') {
      return handleActivate(request, user, targetTier)
    }
    if (TIER_RANK[targetTier] <= TIER_RANK[currentPlan]) {
      return NextResponse.json({ error: '目標方案不高於目前方案' }, { status: 400 })
    }
    return handleUpgrade(request, user, targetTier)
  }

  if (action === 'downgrade') {
    if (currentPlan === 'trial' || currentPlan === 'cancelled') {
      return NextResponse.json({ error: '目前方案無法降級' }, { status: 400 })
    }
    if (TIER_RANK[targetTier] >= TIER_RANK[currentPlan]) {
      return NextResponse.json({ error: '目標方案不低於目前方案' }, { status: 400 })
    }
    return handleDowngrade(user, targetTier)
  }

  return NextResponse.json({ error: '未知操作' }, { status: 400 })
}

async function handleCancel(
  request: NextRequest,
  user: { id: string; subscription_renews_at: string | null },
) {
  const now = new Date()

  await supabaseAdmin
    .from('users')
    .update({
      auto_renewal: false,
      cancelled_at: now.toISOString(),
      pending_downgrade_plan: null,
    })
    .eq('id', user.id)

  await supabaseAdmin.from('admin_audit_logs').insert({
    admin_user_id: null,
    action: 'subscription.cancel',
    target_type: 'user',
    target_id: user.id,
    changes: { after: { cancelled_at: now.toISOString(), source: 'user' } },
    ip_address: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
    user_agent: request.headers.get('user-agent') || 'unknown',
  })

  const expiresAt = user.subscription_renews_at || now.toISOString()
  console.log(`[checkout] cancel: user=${user.id} expires=${expiresAt}`)

  return NextResponse.json({
    success: true,
    message: `訂閱已取消，服務有效至 ${new Date(expiresAt).toLocaleDateString('zh-TW')}`,
    expiresAt,
  })
}

// 首次訂閱 / 從 trial / 取消後重訂：沒 token 就導向綁卡；有 token 直接啟用（試用模式不即時扣款）
async function handleActivate(
  request: NextRequest,
  user: { id: string; payment_method_token: string | null; current_plan: string },
  targetTier: PlanTier,
) {
  if (!user.payment_method_token) {
    // 交由前端 handleBindCard → bind-card 首次付款（$1 綁卡）
    return NextResponse.json({
      success: false,
      needsBindCard: true,
      message: '請先綁定信用卡',
      tier: targetTier,
    })
  }

  const plan = PLANS[targetTier]
  const now = new Date()
  const renewsAt = nextChargeAt(now) // 試用模式：隔 24h 起每天 token 扣款

  await supabaseAdmin
    .from('users')
    .update({
      current_plan: targetTier,
      subscription_started_at: now.toISOString(),
      subscription_renews_at: renewsAt.toISOString(),
      trial_started_at: null,
      cancelled_at: null,
      auto_renewal: true,
      pending_downgrade_plan: null,
    })
    .eq('id', user.id)

  await supabaseAdmin.from('admin_audit_logs').insert({
    admin_user_id: null,
    action: 'subscription.activate',
    target_type: 'user',
    target_id: user.id,
    changes: {
      before: { plan: user.current_plan },
      after: { plan: targetTier, next_charge: renewsAt.toISOString(), source: 'user' },
    },
    ip_address: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
    user_agent: request.headers.get('user-agent') || 'unknown',
  })

  console.log(`[checkout] activate: user=${user.id} plan=${targetTier} (已有 token，未即時扣款)`)

  return NextResponse.json({
    success: true,
    message: `已啟用 ${plan.label}，下次扣款日：${renewsAt.toLocaleDateString('zh-TW')}`,
    plan: targetTier,
    renewsAt: renewsAt.toISOString(),
  })
}

// 升級：試用模式免費即時切換（不收差額，每日 $5 不變，續扣日不變）
async function handleUpgrade(
  request: NextRequest,
  user: { id: string; current_plan: string; payment_method_token: string | null },
  targetTier: PlanTier,
) {
  const currentPlan = user.current_plan as PlanTier

  await supabaseAdmin
    .from('users')
    .update({ current_plan: targetTier, pending_downgrade_plan: null })
    .eq('id', user.id)

  await supabaseAdmin.from('admin_audit_logs').insert({
    admin_user_id: null,
    action: 'subscription.upgrade',
    target_type: 'user',
    target_id: user.id,
    changes: {
      before: { plan: currentPlan },
      after: { plan: targetTier, diff_amount: 0, mode: 'trial_free_switch', source: 'user' },
    },
    ip_address: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
    user_agent: request.headers.get('user-agent') || 'unknown',
  })

  console.log(`[checkout] upgrade: user=${user.id} ${currentPlan}→${targetTier} (試用模式免費切換)`)

  return NextResponse.json({
    success: true,
    message: `已升級至 ${PLANS[targetTier].label}（試用期不收差額，每日扣款不變）`,
    chargedAmount: 0,
  })
}

async function handleDowngrade(
  user: { id: string; current_plan: string; subscription_renews_at: string | null },
  targetTier: PlanTier,
) {
  await supabaseAdmin
    .from('users')
    .update({ pending_downgrade_plan: targetTier })
    .eq('id', user.id)

  const effectiveDate = user.subscription_renews_at
    ? new Date(user.subscription_renews_at).toLocaleDateString('zh-TW')
    : '下個扣款週期'

  console.log(`[checkout] downgrade pending: user=${user.id} ${user.current_plan}→${targetTier} effective=${effectiveDate}`)

  return NextResponse.json({
    success: true,
    message: `降級將在 ${effectiveDate} 生效，本期方案不變`,
    pendingPlan: targetTier,
    effectiveDate,
  })
}
