import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { PLANS, PURCHASABLE_PLANS, type PlanTier } from '@/lib/billing/plans'
import { getHongyangConfig, chargeToken, decrypt, generateOrderNo } from '@/lib/payment/hongyang'

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
    return handleSubscribeOrUpgradeFromTrial(request, user, targetTier)
  }

  if (action === 'upgrade') {
    if (currentPlan === 'trial') {
      return handleSubscribeOrUpgradeFromTrial(request, user, targetTier)
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

async function handleSubscribeOrUpgradeFromTrial(
  request: NextRequest,
  user: { id: string; payment_method_token: string | null; current_plan: string },
  targetTier: PlanTier,
) {
  if (!user.payment_method_token) {
    return NextResponse.json({
      success: false,
      needsBindCard: true,
      message: '請先綁定信用卡',
      tier: targetTier,
    })
  }

  const config = getHongyangConfig()
  const plan = PLANS[targetTier]
  const orderNo = generateOrderNo(user.id)

  const tokenInfo = decrypt(
    user.payment_method_token,
    config.encKey,
    config.encIv,
  ) as { tokenData: string; buysafeno: string }

  const result = await chargeToken(config, {
    userId: user.id,
    paymentToken: tokenInfo.tokenData,
    verificationCode: tokenInfo.buysafeno,
    tokenExpiryDate: '',
    amount: plan.price_twd,
    orderNo,
    orderInfo: `${plan.label}:月訂閱`,
  })

  await supabaseAdmin.from('payment_transactions').insert({
    user_id: user.id,
    plan_tier: targetTier,
    amount: plan.price_twd,
    order_no: orderNo,
    esafe_no: result.esafeNo || null,
    errcode: result.errcode,
    errmsg: result.errmsg,
    status: result.success ? 'success' : 'failed',
    transaction_type: user.current_plan === 'trial' ? 'bind_card' : 'renewal',
    idempotency_key: `subscribe_${user.id}_${orderNo}`,
  })

  if (!result.success) {
    return NextResponse.json({
      success: false,
      message: `扣款失敗：${result.errmsg}`,
      errcode: result.errcode,
    })
  }

  const now = new Date()
  const renewsAt = new Date(now)
  renewsAt.setMonth(renewsAt.getMonth() + 1)

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

  const auditAction = user.current_plan === 'trial'
    ? 'subscription.upgrade_from_trial'
    : 'subscription.resubscribe'

  await supabaseAdmin.from('admin_audit_logs').insert({
    admin_user_id: null,
    action: auditAction,
    target_type: 'user',
    target_id: user.id,
    changes: {
      before: { plan: user.current_plan },
      after: { plan: targetTier, amount: plan.price_twd, source: 'user' },
    },
    ip_address: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
    user_agent: request.headers.get('user-agent') || 'unknown',
  })

  console.log(`[checkout] subscribe success: user=${user.id} plan=${targetTier}`)

  return NextResponse.json({
    success: true,
    message: `訂閱 ${plan.label} 成功！下次扣款日：${renewsAt.toLocaleDateString('zh-TW')}`,
    plan: targetTier,
    renewsAt: renewsAt.toISOString(),
  })
}

async function handleUpgrade(
  request: NextRequest,
  user: { id: string; current_plan: string; payment_method_token: string | null; subscription_renews_at: string | null },
  targetTier: PlanTier,
) {
  if (!user.payment_method_token) {
    return NextResponse.json({
      success: false,
      needsBindCard: true,
      message: '請先綁定信用卡',
      tier: targetTier,
    })
  }

  const currentPlan = user.current_plan as PlanTier
  const oldPrice = PLANS[currentPlan].price_twd
  const newPrice = PLANS[targetTier].price_twd

  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const renewDate = user.subscription_renews_at ? new Date(user.subscription_renews_at) : now
  const remainingDays = Math.max(0, Math.ceil((renewDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))

  const diffAmount = Math.round((newPrice - oldPrice) / daysInMonth * remainingDays)

  if (diffAmount <= 0) {
    await supabaseAdmin
      .from('users')
      .update({ current_plan: targetTier, pending_downgrade_plan: null })
      .eq('id', user.id)

    return NextResponse.json({
      success: true,
      message: `已升級至 ${PLANS[targetTier].label}，下月起扣新價格`,
      chargedAmount: 0,
    })
  }

  const config = getHongyangConfig()
  const orderNo = generateOrderNo(user.id)

  const tokenInfo = decrypt(
    user.payment_method_token,
    config.encKey,
    config.encIv,
  ) as { tokenData: string; buysafeno: string }

  const result = await chargeToken(config, {
    userId: user.id,
    paymentToken: tokenInfo.tokenData,
    verificationCode: tokenInfo.buysafeno,
    tokenExpiryDate: '',
    amount: diffAmount,
    orderNo,
    orderInfo: `升級差額 ${PLANS[currentPlan].label}→${PLANS[targetTier].label}`,
  })

  await supabaseAdmin.from('payment_transactions').insert({
    user_id: user.id,
    plan_tier: targetTier,
    amount: diffAmount,
    order_no: orderNo,
    esafe_no: result.esafeNo || null,
    errcode: result.errcode,
    errmsg: result.errmsg,
    status: result.success ? 'success' : 'failed',
    transaction_type: 'upgrade_diff',
    idempotency_key: `upgrade_${user.id}_${orderNo}`,
    metadata: { from: currentPlan, to: targetTier, remainingDays, daysInMonth },
  })

  if (!result.success) {
    return NextResponse.json({
      success: false,
      message: `差額扣款失敗：${result.errmsg}`,
    })
  }

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
      after: { plan: targetTier, diff_amount: diffAmount, source: 'user' },
    },
    ip_address: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
    user_agent: request.headers.get('user-agent') || 'unknown',
  })

  console.log(`[checkout] upgrade: user=${user.id} ${currentPlan}→${targetTier} diff=$${diffAmount}`)

  return NextResponse.json({
    success: true,
    message: `已升級至 ${PLANS[targetTier].label}，收取差額 NT$${diffAmount}`,
    chargedAmount: diffAmount,
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
    : '下月 1 號'

  console.log(`[checkout] downgrade pending: user=${user.id} ${user.current_plan}→${targetTier} effective=${effectiveDate}`)

  return NextResponse.json({
    success: true,
    message: `降級將在 ${effectiveDate} 生效，本月方案不變`,
    pendingPlan: targetTier,
    effectiveDate,
  })
}
