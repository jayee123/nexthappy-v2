import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { PLANS, PURCHASABLE_PLANS, type PlanTier } from '@/lib/billing/plans'
import {
  getHongyangConfig,
  buildBindingFormParams,
  generateOrderNo,
} from '@/lib/payment/hongyang'

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: '請先登入' }, { status: 401 })
  }

  const body = await request.json()
  const targetTier = body.tier as PlanTier

  if (!targetTier || !PURCHASABLE_PLANS.includes(targetTier)) {
    return NextResponse.json(
      { error: '無效的方案，請選擇 basic / advanced / premium' },
      { status: 400 },
    )
  }

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, name, email, current_plan')
    .eq('id', session.userId)
    .single()

  if (!user) {
    return NextResponse.json({ error: '找不到使用者' }, { status: 404 })
  }

  const plan = PLANS[targetTier]
  const config = getHongyangConfig()

  const { data: tx, error: txError } = await supabaseAdmin
    .from('payment_transactions')
    .insert({
      user_id: user.id,
      plan_tier: targetTier,
      amount: plan.price_twd,
      order_no: '__pending__',
      status: 'pending',
      transaction_type: 'bind_card',
      idempotency_key: `bind_${user.id}_${Date.now()}`,
    })
    .select('id')
    .single()

  if (txError || !tx) {
    console.error('[bind-card] insert tx failed:', txError)
    return NextResponse.json({ error: '建立交易失敗' }, { status: 500 })
  }

  const orderNo = generateOrderNo(tx.id)

  await supabaseAdmin
    .from('payment_transactions')
    .update({ order_no: orderNo })
    .eq('id', tx.id)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002'
  const callbackUrl = `${appUrl}/api/payment/callback`

  const formParams = buildBindingFormParams(config, {
    amount: plan.price_twd,
    orderNo,
    orderInfo: `${plan.label}:月訂閱`,
    userName: user.name || 'User',
    userPhone: '',
    userEmail: user.email,
    userId: user.id,
    callbackUrl,
  })

  return NextResponse.json({
    success: true,
    action: config.bindUrl,
    params: formParams,
    transactionId: tx.id,
  })
}
