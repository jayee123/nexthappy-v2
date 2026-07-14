import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSunpayConfig, parseCallback, packToken } from '@/lib/payment/sunpay'
import { type PlanTier } from '@/lib/billing/plans'

// SunPay 代碼授權 CallBack：紅陽以背景 POST {web, send_time, rsamsg, check_value}
// 到本網址。解密+驗簽後處理付款、儲存 token，回傳純文字 "success"。
export async function POST(request: NextRequest) {
  const config = getSunpayConfig()

  // callback 可能是 JSON 或 form-urlencoded，兩者都容錯
  const payload = await readPayload(request)
  if (!payload.rsamsg || !payload.check_value) {
    console.error('[callback] missing rsamsg/check_value', Object.keys(payload))
    return new Response('FAIL', { status: 400 })
  }

  if (payload.web && payload.web !== config.web) {
    console.error('[callback] merchant mismatch', { received: payload.web, expected: config.web })
    return new Response('FAIL', { status: 400 })
  }

  let parsed
  try {
    parsed = parseCallback(config, {
      web: payload.web,
      send_time: payload.send_time,
      rsamsg: payload.rsamsg,
      check_value: payload.check_value,
    })
  } catch (err) {
    console.error('[callback] decrypt failed:', err)
    return new Response('FAIL', { status: 400 })
  }

  if (!parsed.valid) {
    console.warn('[callback] check_value mismatch (non-blocking)', { td: parsed.body.td })
  }

  const b = parsed.body
  const td = b.td || ''
  const tradeNo = b.trade_no || ''
  const mn = b.mn || ''
  const idempotencyKey = `webhook_${td}_${tradeNo}`

  // idempotency：同一筆已處理過就直接回 success
  const { data: existing } = await supabaseAdmin
    .from('payment_transactions')
    .select('id, status')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()

  if (existing) {
    return new Response('success')
  }

  // 對應原始 pending 交易
  const { data: pendingTx } = await supabaseAdmin
    .from('payment_transactions')
    .select('id, user_id, plan_tier, amount')
    .eq('order_no', td)
    .eq('status', 'pending')
    .maybeSingle()

  if (pendingTx && String(pendingTx.amount) !== mn) {
    console.error('[callback] amount mismatch', { expected: pendingTx.amount, received: mn, td })
    return new Response('FAIL', { status: 400 })
  }

  const isSuccess = parsed.isSuccess // pay_result === '10'
  const resolvedUserId = pendingTx?.user_id
  const resolvedTier = (pendingTx?.plan_tier || 'basic') as PlanTier

  // 更新/建立交易紀錄
  if (pendingTx) {
    await supabaseAdmin
      .from('payment_transactions')
      .update({
        status: isSuccess ? 'success' : 'failed',
        esafe_no: tradeNo || null,
        errcode: b.pay_result || null,
        errmsg: isSuccess ? '交易成功' : `pay_result=${b.pay_result}`,
        idempotency_key: idempotencyKey,
      })
      .eq('id', pendingTx.id)
  } else {
    await supabaseAdmin.from('payment_transactions').insert({
      user_id: resolvedUserId || null,
      plan_tier: resolvedTier,
      amount: parseInt(mn, 10) || 0,
      order_no: td,
      esafe_no: tradeNo || null,
      errcode: b.pay_result || null,
      errmsg: isSuccess ? '交易成功' : `pay_result=${b.pay_result}`,
      status: isSuccess ? 'success' : 'failed',
      transaction_type: 'bind_card',
      idempotency_key: idempotencyKey,
    })
  }

  if (isSuccess && resolvedUserId) {
    // 儲存 token bundle：save_card_token(=user id) + token_key + token_life
    let packedToken: string | null = null
    if (b.token_key) {
      packedToken = packToken(
        {
          saveCardToken: resolvedUserId,
          tokenKey: b.token_key,
          tokenLife: b.token_life || '',
          boundAt: new Date().toISOString(),
        },
        process.env.ENCRYPTION_KEY!,
      )
    } else {
      console.warn('[callback] success but no token_key returned', { td })
    }

    const now = new Date()
    const renewsAt = new Date(now)
    renewsAt.setMonth(renewsAt.getMonth() + 1)

    const updates: Record<string, unknown> = {
      current_plan: resolvedTier,
      subscription_started_at: now.toISOString(),
      subscription_renews_at: renewsAt.toISOString(),
      trial_started_at: null,
      cancelled_at: null,
      auto_renewal: true,
    }
    if (packedToken) updates.payment_method_token = packedToken

    await supabaseAdmin.from('users').update(updates).eq('id', resolvedUserId)

    await supabaseAdmin.from('admin_audit_logs').insert({
      admin_user_id: null,
      action: 'payment.bind_card',
      target_type: 'user',
      target_id: resolvedUserId,
      changes: {
        after: {
          plan: resolvedTier,
          amount: mn,
          trade_no: tradeNo,
          token_saved: !!packedToken,
          source: 'sunpay_callback',
        },
      },
      ip_address: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'webhook',
      user_agent: request.headers.get('user-agent') || 'sunpay-callback',
    })

    console.log(
      `[callback] bind_card success: user=${resolvedUserId} plan=${resolvedTier} amount=${mn} token=${!!packedToken}`,
    )
  } else if (!isSuccess) {
    console.log(`[callback] bind_card failed: td=${td} pay_result=${b.pay_result}`)
  }

  // 紅陽要求回傳純文字 "success"（不可含 html/js）
  return new Response('success')
}

// 讀取 callback payload（容錯 JSON / form-urlencoded）
async function readPayload(
  request: NextRequest,
): Promise<{ web?: string; send_time?: string; rsamsg?: string; check_value?: string }> {
  const contentType = request.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return (await request.json()) as Record<string, string>
  }
  const form = await request.formData()
  return {
    web: (form.get('web') as string) || undefined,
    send_time: (form.get('send_time') as string) || undefined,
    rsamsg: (form.get('rsamsg') as string) || undefined,
    check_value: (form.get('check_value') as string) || undefined,
  }
}
