import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { encrypt, getHongyangConfig, verifyCallbackChkValue } from '@/lib/payment/hongyang'
import { type PlanTier } from '@/lib/billing/plans'

export async function POST(request: NextRequest) {
  const config = getHongyangConfig()
  const formData = await request.formData()

  const web = formData.get('web') as string || ''
  const td = formData.get('Td') as string || ''
  const mn = formData.get('MN') as string || ''
  const errcode = formData.get('errcode') as string || ''
  const errmsg = decodeURIComponent(formData.get('errmsg') as string || '')
  const chkValue = formData.get('ChkValue') as string || ''
  const buysafeno = formData.get('buysafeno') as string || ''
  const tokenData = formData.get('tokenData') as string || ''
  const userId = formData.get('note1') as string || ''

  if (!verifyCallbackChkValue({
    web,
    password: config.password,
    mn,
    td,
    receivedChkValue: chkValue,
  })) {
    console.error('[webhook] ChkValue mismatch', { web, mn, td })
    return new Response('ChkValue mismatch', { status: 400 })
  }

  const idempotencyKey = `webhook_${td}_${buysafeno}`

  const { data: existing } = await supabaseAdmin
    .from('payment_transactions')
    .select('id, status')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()

  if (existing) {
    return respondByChannel(request, existing.status === 'success')
  }

  const { data: pendingTx } = await supabaseAdmin
    .from('payment_transactions')
    .select('id, user_id, plan_tier, amount')
    .eq('order_no', td)
    .eq('status', 'pending')
    .maybeSingle()

  if (pendingTx && String(pendingTx.amount) !== mn) {
    console.error('[webhook] amount mismatch', {
      expected: pendingTx.amount,
      received: mn,
      order: td,
    })
    return new Response('Amount mismatch', { status: 400 })
  }

  const isSuccess = errcode === '00'
  const resolvedUserId = pendingTx?.user_id || userId
  const resolvedTier = (pendingTx?.plan_tier || 'premium') as PlanTier

  if (pendingTx) {
    await supabaseAdmin
      .from('payment_transactions')
      .update({
        status: isSuccess ? 'success' : 'failed',
        esafe_no: buysafeno || null,
        errcode,
        errmsg,
        idempotency_key: idempotencyKey,
      })
      .eq('id', pendingTx.id)
  } else {
    await supabaseAdmin.from('payment_transactions').insert({
      user_id: resolvedUserId,
      plan_tier: resolvedTier,
      amount: parseInt(mn, 10) || 0,
      order_no: td,
      esafe_no: buysafeno || null,
      errcode,
      errmsg,
      status: isSuccess ? 'success' : 'failed',
      transaction_type: 'bind_card',
      idempotency_key: idempotencyKey,
    })
  }

  if (isSuccess && resolvedUserId) {
    const encryptedToken = tokenData
      ? encrypt(
          { tokenData, buysafeno, bindDate: new Date().toISOString() },
          config.encKey,
          config.encIv,
        )
      : null

    const now = new Date()
    const renewsAt = new Date(now)
    renewsAt.setMonth(renewsAt.getMonth() + 1)

    await supabaseAdmin
      .from('users')
      .update({
        current_plan: resolvedTier,
        payment_method_token: encryptedToken,
        subscription_started_at: now.toISOString(),
        subscription_renews_at: renewsAt.toISOString(),
        trial_started_at: null,
        cancelled_at: null,
        auto_renewal: true,
      })
      .eq('id', resolvedUserId)

    await supabaseAdmin.from('admin_audit_logs').insert({
      admin_user_id: null,
      action: 'payment.bind_card',
      target_type: 'user',
      target_id: resolvedUserId,
      changes: {
        after: {
          plan: resolvedTier,
          amount: mn,
          esafe_no: buysafeno,
          source: 'webhook',
        },
      },
      ip_address: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'webhook',
      user_agent: request.headers.get('user-agent') || 'esafe-callback',
    })

    console.log(`[webhook] bind_card success: user=${resolvedUserId} plan=${resolvedTier} amount=${mn}`)
  } else if (!isSuccess) {
    console.log(`[webhook] bind_card failed: order=${td} errcode=${errcode} errmsg=${errmsg}`)
  }

  return respondByChannel(request, isSuccess)
}

function respondByChannel(request: NextRequest, isSuccess: boolean): Response {
  const hasCookie = !!request.headers.get('cookie')

  if (hasCookie) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002'
    const status = isSuccess ? 'success' : 'failed'
    return NextResponse.redirect(
      new URL(`/settings/billing?payment=${status}`, appUrl),
    )
  }

  return new Response('OK')
}
