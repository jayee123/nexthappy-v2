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

  const { data: pendingRetries, error } = await supabaseAdmin
    .from('payment_retries')
    .select('id, user_id, retry_count, max_retries, original_transaction_id')
    .eq('resolved', false)
    .lte('next_retry_at', now.toISOString())
    .order('next_retry_at', { ascending: true })
    .limit(50)

  if (error) {
    console.error('[cron:retry-failed] query error:', error)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  if (!pendingRetries || pendingRetries.length === 0) {
    return NextResponse.json({ retried: 0, succeeded: 0, exhausted: 0 })
  }

  const config = getHongyangConfig()
  let succeeded = 0
  let exhausted = 0

  for (const retry of pendingRetries) {
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, current_plan, payment_method_token, subscription_renews_at')
      .eq('id', retry.user_id)
      .single()

    if (!user || !user.payment_method_token) {
      await supabaseAdmin
        .from('payment_retries')
        .update({ resolved: true, last_error: 'no_payment_token', updated_at: now.toISOString() })
        .eq('id', retry.id)
      exhausted++
      continue
    }

    const tier = user.current_plan as PlanTier
    const plan = PLANS[tier]

    if (tier === 'cancelled' || tier === 'trial') {
      await supabaseAdmin
        .from('payment_retries')
        .update({ resolved: true, last_error: 'plan_no_longer_active', updated_at: now.toISOString() })
        .eq('id', retry.id)
      continue
    }

    let tokenInfo: { tokenData: string; buysafeno: string }
    try {
      tokenInfo = decrypt(user.payment_method_token, config.encKey, config.encIv) as {
        tokenData: string
        buysafeno: string
      }
    } catch {
      await supabaseAdmin
        .from('payment_retries')
        .update({ resolved: true, last_error: 'decrypt_failed', updated_at: now.toISOString() })
        .eq('id', retry.id)
      exhausted++
      continue
    }

    const orderNo = generateOrderNo(user.id)

    const result = await chargeToken(config, {
      userId: user.id,
      paymentToken: tokenInfo.tokenData,
      verificationCode: tokenInfo.buysafeno,
      tokenExpiryDate: '',
      amount: plan.price_twd,
      orderNo,
      orderInfo: `${plan.label}:重試扣款 #${retry.retry_count + 1}`,
    })

    await supabaseAdmin.from('payment_transactions').insert({
      user_id: user.id,
      plan_tier: tier,
      amount: plan.price_twd,
      order_no: orderNo,
      esafe_no: result.esafeNo || null,
      errcode: result.errcode,
      errmsg: result.errmsg,
      status: result.success ? 'success' : 'failed',
      transaction_type: 'retry',
      idempotency_key: `retry_${retry.id}_${retry.retry_count + 1}`,
    })

    if (result.success) {
      const nextRenewal = new Date(now)
      nextRenewal.setMonth(nextRenewal.getMonth() + 1)

      await supabaseAdmin
        .from('payment_retries')
        .update({ resolved: true, updated_at: now.toISOString() })
        .eq('id', retry.id)

      await supabaseAdmin
        .from('users')
        .update({
          subscription_renews_at: nextRenewal.toISOString(),
        })
        .eq('id', user.id)

      console.log(`[cron:retry-failed] success: user=${user.id} retry#${retry.retry_count + 1}`)
      succeeded++
    } else {
      const newCount = retry.retry_count + 1

      if (newCount >= retry.max_retries) {
        await supabaseAdmin
          .from('payment_retries')
          .update({
            resolved: true,
            retry_count: newCount,
            last_error: `${result.errcode}: ${result.errmsg}`,
            updated_at: now.toISOString(),
          })
          .eq('id', retry.id)

        await supabaseAdmin
          .from('users')
          .update({
            current_plan: 'cancelled',
            auto_renewal: false,
            cancelled_at: now.toISOString(),
          })
          .eq('id', user.id)

        await supabaseAdmin.from('admin_audit_logs').insert({
          admin_user_id: null,
          action: 'cron.payment_exhausted',
          target_type: 'user',
          target_id: user.id,
          changes: {
            after: {
              plan: 'cancelled',
              retries: newCount,
              last_error: result.errmsg,
              source: 'cron',
            },
          },
          ip_address: 'cron',
          user_agent: 'vercel-cron',
        })

        console.log(`[cron:retry-failed] exhausted: user=${user.id} cancelled after ${newCount} retries`)
        exhausted++
      } else {
        const delayHours = RETRY_DELAY_HOURS[Math.min(newCount, RETRY_DELAY_HOURS.length - 1)]
        const nextRetryAt = new Date(now)
        nextRetryAt.setHours(nextRetryAt.getHours() + delayHours)

        await supabaseAdmin
          .from('payment_retries')
          .update({
            retry_count: newCount,
            next_retry_at: nextRetryAt.toISOString(),
            last_error: `${result.errcode}: ${result.errmsg}`,
            updated_at: now.toISOString(),
          })
          .eq('id', retry.id)

        console.log(`[cron:retry-failed] retry#${newCount} failed: user=${user.id} next=${nextRetryAt.toISOString()}`)
      }
    }
  }

  return NextResponse.json({
    retried: pendingRetries.length,
    succeeded,
    exhausted,
  })
}
