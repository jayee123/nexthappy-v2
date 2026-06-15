import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { PLANS, type PlanTier } from '@/lib/billing/plans'
import { chargeToken, decrypt, generateOrderNo, getHongyangConfig } from '@/lib/payment/hongyang'

const RETRY_DELAY_HOURS = [24, 48, 72]

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()

  const { data: dueUsers, error } = await supabaseAdmin
    .from('users')
    .select('id, email, current_plan, payment_method_token, subscription_renews_at, pending_downgrade_plan')
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

  const config = getHongyangConfig()
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

    let tokenInfo: { tokenData: string; buysafeno: string }
    try {
      tokenInfo = decrypt(user.payment_method_token, config.encKey, config.encIv) as {
        tokenData: string
        buysafeno: string
      }
    } catch (err) {
      console.error(`[cron:charge-renewals] decrypt token failed: user=${user.id}`, err)
      failed++
      continue
    }

    const result = await chargeToken(config, {
      userId: user.id,
      paymentToken: tokenInfo.tokenData,
      verificationCode: tokenInfo.buysafeno,
      tokenExpiryDate: '',
      amount: plan.price_twd,
      orderNo,
      orderInfo: `${plan.label}:月續扣`,
    })

    const { data: tx } = await supabaseAdmin
      .from('payment_transactions')
      .insert({
        user_id: user.id,
        plan_tier: effectiveTier,
        amount: plan.price_twd,
        order_no: orderNo,
        esafe_no: result.esafeNo || null,
        errcode: result.errcode,
        errmsg: result.errmsg,
        status: result.success ? 'success' : 'failed',
        transaction_type: 'renewal',
        idempotency_key: `renewal_${user.id}_${orderNo}`,
      })
      .select('id')
      .single()

    if (result.success) {
      const nextRenewal = new Date(now)
      nextRenewal.setMonth(nextRenewal.getMonth() + 1)

      await supabaseAdmin
        .from('users')
        .update({
          current_plan: effectiveTier,
          subscription_renews_at: nextRenewal.toISOString(),
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
            amount: plan.price_twd,
            next_renewal: nextRenewal.toISOString(),
            source: 'cron',
          },
        },
        ip_address: 'cron',
        user_agent: 'vercel-cron',
      })

      console.log(`[cron:charge-renewals] success: user=${user.id} plan=${effectiveTier} amount=${plan.price_twd}`)
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
        last_error: `${result.errcode}: ${result.errmsg}`,
      })

      console.log(`[cron:charge-renewals] failed: user=${user.id} errcode=${result.errcode} retry_at=${nextRetryAt.toISOString()}`)
      failed++
    }
  }

  return NextResponse.json({ charged, failed })
}
