import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { PLANS, type PlanTier } from '@/lib/billing/plans'
import { DAILY_CHARGE_TWD, TEST_MAX_DAILY_CHARGES, nextChargeAt } from '@/lib/billing/subscription-cycle'
import {
  getSunpayConfig,
  requestSubsequentPayment,
  generateOrderNo,
  unpackToken,
  type StoredToken,
} from '@/lib/payment/sunpay'

const RETRY_DELAY_HOURS = [24, 48, 72]

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()

  const { data: dueUsers, error } = await supabaseAdmin
    .from('users')
    .select('id, name, email, current_plan, payment_method_token, subscription_renews_at, pending_downgrade_plan')
    .eq('auto_renewal', true)
    .lte('subscription_renews_at', now.toISOString())
    .neq('current_plan', 'trial')
    .neq('current_plan', 'cancelled')

  if (error) {
    console.error('[cron:charge-renewals] query error:', error)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  if (!dueUsers || dueUsers.length === 0) {
    return NextResponse.json({ charged: 0, failed: 0 })
  }

  const config = getSunpayConfig()
  let charged = 0
  let failed = 0

  for (const user of dueUsers) {
    const effectiveTier = (user.pending_downgrade_plan || user.current_plan) as PlanTier
    const plan = PLANS[effectiveTier]

    if (!user.payment_method_token) {
      console.log(`[cron:charge-renewals] skip: user=${user.id} no payment token`)
      failed++
      continue
    }

    const orderNo = generateOrderNo(user.id)

    let stored: StoredToken
    try {
      stored = unpackToken(user.payment_method_token, process.env.ENCRYPTION_KEY!)
    } catch (err) {
      console.error(`[cron:charge-renewals] unpack token failed: user=${user.id}`, err)
      failed++
      continue
    }

    // 測試用：扣滿 TEST_MAX_DAILY_CHARGES 次就停止續扣（不再扣款）
    const { count: prevRenewals } = await supabaseAdmin
      .from('payment_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('transaction_type', 'renewal')
      .eq('status', 'success')

    if ((prevRenewals ?? 0) >= TEST_MAX_DAILY_CHARGES) {
      await supabaseAdmin
        .from('users')
        .update({ auto_renewal: false, subscription_renews_at: null })
        .eq('id', user.id)
      console.log(`[cron:charge-renewals] user=${user.id} 已扣滿 ${TEST_MAX_DAILY_CHARGES} 次，停止續扣`)
      continue
    }

    const RENEWAL_AMOUNT = DAILY_CHARGE_TWD
    const result = await requestSubsequentPayment(config, {
      email: user.email,
      amount: RENEWAL_AMOUNT,
      orderInfo: `${plan.label} 每日扣款`,
      // 沿用綁卡時的消費者姓名/電話（續扣無支付頁可輸入），退回帳號名稱
      phone: stored.customerPhone || '0900000000',
      name: stored.customerName || user.name || 'User',
      saveCardToken: stored.saveCardToken,
      orderNo,
      tokenKey: stored.tokenKey,
    })

    const { data: tx } = await supabaseAdmin
      .from('payment_transactions')
      .insert({
        user_id: user.id,
        plan_tier: effectiveTier,
        amount: RENEWAL_AMOUNT,
        order_no: orderNo,
        esafe_no: null,
        errcode: result.code,
        errmsg: result.msg,
        status: result.success ? 'success' : 'failed',
        transaction_type: 'renewal',
        idempotency_key: `renewal_${user.id}_${orderNo}`,
      })
      .select('id')
      .single()

    if (result.success) {
      // 這次扣款後累計次數達上限即停止續扣（本次是第 prevRenewals+1 次）
      const reachedMax = (prevRenewals ?? 0) + 1 >= TEST_MAX_DAILY_CHARGES
      const nextRenewal = nextChargeAt(now) // 下次扣款隔 24h

      await supabaseAdmin
        .from('users')
        .update({
          current_plan: effectiveTier,
          subscription_renews_at: reachedMax ? null : nextRenewal.toISOString(),
          auto_renewal: reachedMax ? false : true,
          pending_downgrade_plan: null,
        })
        .eq('id', user.id)

      await supabaseAdmin.from('admin_audit_logs').insert({
        admin_user_id: null,
        action: 'cron.renewal_success',
        target_type: 'user',
        target_id: user.id,
        changes: {
          after: {
            plan: effectiveTier,
            amount: RENEWAL_AMOUNT,
            next_renewal: nextRenewal.toISOString(),
            source: 'cron',
          },
        },
        ip_address: 'cron',
        user_agent: 'vercel-cron',
      })

      console.log(`[cron:charge-renewals] success: user=${user.id} plan=${effectiveTier} amount=${RENEWAL_AMOUNT}`)
      charged++
    } else {
      const nextRetryAt = new Date(now)
      nextRetryAt.setHours(nextRetryAt.getHours() + RETRY_DELAY_HOURS[0])

      await supabaseAdmin.from('payment_retries').insert({
        user_id: user.id,
        original_transaction_id: tx?.id || null,
        retry_count: 0,
        max_retries: 3,
        next_retry_at: nextRetryAt.toISOString(),
        last_error: `${result.code}: ${result.msg}`,
      })

      console.log(`[cron:charge-renewals] failed: user=${user.id} code=${result.code} retry_at=${nextRetryAt.toISOString()}`)
      failed++
    }
  }

  return NextResponse.json({ charged, failed })
}
