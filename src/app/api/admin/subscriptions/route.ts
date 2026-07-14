import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/requireAdmin'
import { supabaseAdmin } from '@/lib/supabase'
import { unpackToken } from '@/lib/payment/sunpay'

// 遮罩 token_key：只露頭尾 4 碼，中間打星號（後台驗證用，不外洩完整 token）
function maskToken(tokenKey: string): string {
  if (tokenKey.length <= 8) return '****'
  return `${tokenKey.slice(0, 4)}****${tokenKey.slice(-4)}`
}

interface TokenInfo {
  bound: boolean
  token_life: string | null // 卡片/token 到期 YYYYMMDD
  bound_at: string | null // 綁定時間 ISO
  token_key_masked: string | null
  customer_name: string | null // 續扣沿用的消費者姓名
  customer_phone: string | null // 續扣沿用的消費者電話
}

// 從加密的 payment_method_token 解出可安全顯示的 metadata
function buildTokenInfo(packed: string | null): TokenInfo {
  const empty = { bound: false, token_life: null, bound_at: null, token_key_masked: null, customer_name: null, customer_phone: null }
  if (!packed) return empty
  try {
    const t = unpackToken(packed, process.env.ENCRYPTION_KEY!)
    return {
      bound: true,
      token_life: t.tokenLife || null,
      bound_at: t.boundAt || null,
      token_key_masked: t.tokenKey ? maskToken(t.tokenKey) : null,
      customer_name: t.customerName || null,
      customer_phone: t.customerPhone || null,
    }
  } catch {
    return { ...empty, bound: true, token_key_masked: '(解密失敗)' }
  }
}

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request)
  if (error) return error

  const url = new URL(request.url)
  const filter = url.searchParams.get('filter') || 'all'
  const search = url.searchParams.get('search') || ''

  let query = supabaseAdmin
    .from('users')
    .select(
      'id, email, name, current_plan, subscription_started_at, subscription_renews_at, auto_renewal, cancelled_at, pending_downgrade_plan, trial_started_at, payment_method_token',
    )
    .order('created_at', { ascending: false })
    .limit(100)

  if (filter === 'trial') query = query.eq('current_plan', 'trial')
  else if (filter === 'active') query = query.in('current_plan', ['basic', 'advanced', 'premium'])
  else if (filter === 'cancelled') query = query.eq('current_plan', 'cancelled')

  if (search) {
    query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%`)
  }

  const { data: users, error: queryError } = await query

  if (queryError) {
    return NextResponse.json({ data: null, error: queryError.message }, { status: 500 })
  }

  const userIds = (users || []).map((u) => u.id)

  interface TxRow {
    user_id: string
    plan_tier: string
    amount: number
    status: string
    transaction_type: string
    errcode: string | null
    errmsg: string | null
    esafe_no: string | null
    order_no: string | null
    created_at: string
  }

  const { data: recentTxRaw } = userIds.length > 0
    ? await supabaseAdmin
        .from('payment_transactions')
        .select('user_id, plan_tier, amount, status, transaction_type, errcode, errmsg, esafe_no, order_no, created_at')
        .in('user_id', userIds)
        .order('created_at', { ascending: false })
        .limit(500)
    : { data: [] as TxRow[] }

  const recentTx = (recentTxRaw || []) as TxRow[]
  const txByUser = new Map<string, TxRow[]>()
  for (const tx of recentTx) {
    const list = txByUser.get(tx.user_id) || []
    list.push(tx)
    txByUser.set(tx.user_id, list)
  }

  const result = (users || []).map((u) => {
    // 不把加密的 payment_method_token 送到前端，只回傳解出的安全 metadata
    const { payment_method_token, ...rest } = u
    return {
      ...rest,
      token_info: buildTokenInfo(payment_method_token),
      recent_transactions: (txByUser.get(u.id) || []).slice(0, 10),
    }
  })

  const counts = {
    total: result.length,
    trial: result.filter((u) => u.current_plan === 'trial').length,
    active: result.filter((u) => ['basic', 'advanced', 'premium'].includes(u.current_plan)).length,
    cancelled: result.filter((u) => u.current_plan === 'cancelled').length,
  }

  return NextResponse.json({ data: { users: result, counts }, error: null })
}
