import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/requireAdmin'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request)
  if (error) return error

  const url = new URL(request.url)
  const filter = url.searchParams.get('filter') || 'all'
  const search = url.searchParams.get('search') || ''

  let query = supabaseAdmin
    .from('users')
    .select('id, email, name, current_plan, subscription_started_at, subscription_renews_at, auto_renewal, cancelled_at, pending_downgrade_plan, trial_started_at')
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

  const { data: recentTx } = userIds.length > 0
    ? await supabaseAdmin
        .from('payment_transactions')
        .select('user_id, plan_tier, amount, status, transaction_type, created_at')
        .in('user_id', userIds)
        .order('created_at', { ascending: false })
        .limit(500)
    : { data: [] }

  const txByUser = new Map<string, typeof recentTx>()
  for (const tx of recentTx || []) {
    const list = txByUser.get(tx.user_id) || []
    list.push(tx)
    txByUser.set(tx.user_id, list)
  }

  const result = (users || []).map((u) => ({
    ...u,
    recent_transactions: (txByUser.get(u.id) || []).slice(0, 5),
  }))

  const counts = {
    total: result.length,
    trial: result.filter((u) => u.current_plan === 'trial').length,
    active: result.filter((u) => ['basic', 'advanced', 'premium'].includes(u.current_plan)).length,
    cancelled: result.filter((u) => u.current_plan === 'cancelled').length,
  }

  return NextResponse.json({ data: { users: result, counts }, error: null })
}
