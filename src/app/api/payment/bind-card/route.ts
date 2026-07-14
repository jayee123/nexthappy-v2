import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { PLANS, PURCHASABLE_PLANS, type PlanTier } from '@/lib/billing/plans'
import { getSunpayConfig, requestFirstPayment, generateOrderNo } from '@/lib/payment/sunpay'

export async function POST(request: NextRequest) {
  try {
    return await handle(request)
  } catch (err) {
    // 任何未預期錯誤都回 JSON，避免前端拿到 HTML 500 導致 JSON parse error
    console.error('[bind-card] unhandled error:', err)
    return NextResponse.json(
      { error: `伺服器錯誤：${err instanceof Error ? err.message : String(err)}` },
      { status: 500 },
    )
  }
}

async function handle(request: NextRequest) {
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
  const config = getSunpayConfig()

  // 建立 pending 交易（callback 會用 order_no 對應回來）
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

  // SunPay 代碼首次付款 → 取得支付頁 URL（pay_code）
  const result = await requestFirstPayment(config, {
    email: user.email,
    amount: plan.price_twd,
    orderInfo: `${plan.label} 月訂閱`,
    saveCardToken: user.id, // 特店自訂卡片識別碼（後續扣款用同一組）
    phone: '0900000000', // TODO: 若 users 表有電話則帶入
    name: user.name || 'User',
    orderNo,
  })

  if (!result.success || !result.payCode) {
    console.error('[bind-card] SunPay first payment failed:', result.code, result.msg)
    await supabaseAdmin
      .from('payment_transactions')
      .update({ status: 'failed', errcode: result.code, errmsg: result.msg })
      .eq('id', tx.id)
    // 用 200 回傳（非 5xx），避免反向代理把 body 換成 HTML 錯誤頁
    return NextResponse.json({
      success: false,
      error: `金流請求失敗（${result.code}）：${result.msg}`,
    })
  }

  return NextResponse.json({
    success: true,
    payUrl: result.payCode, // 前端直接導向此 URL 輸入卡號
    transactionId: tx.id,
  })
}
