import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/requireAdmin'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request)
  if (error) return error

  const url = new URL(request.url)
  const period = url.searchParams.get('period') || 'current'

  const now = new Date()
  const periodStart = period === 'last'
    ? new Date(now.getFullYear(), now.getMonth() - 1, 1)
    : new Date(now.getFullYear(), now.getMonth(), 1)
  const periodEnd = period === 'last'
    ? new Date(now.getFullYear(), now.getMonth(), 1)
    : new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const periodStartStr = periodStart.toISOString().slice(0, 10)

  const { data: quotas, error: quotaError } = await supabaseAdmin
    .from('usage_quotas')
    .select('user_id, period_start, messages_count, tokens_input, tokens_output, cost_twd_estimated')
    .eq('period_start', periodStartStr)
    .order('messages_count', { ascending: false })
    .limit(100)

  if (quotaError) {
    return NextResponse.json({ data: null, error: quotaError.message }, { status: 500 })
  }

  const userIds = (quotas || []).map((q) => q.user_id)

  const { data: users } = userIds.length > 0
    ? await supabaseAdmin
        .from('users')
        .select('id, email, name, current_plan')
        .in('id', userIds)
    : { data: [] }

  const userMap = new Map<string, { email: string; name: string | null; current_plan: string }>()
  for (const u of users || []) {
    userMap.set(u.id, u)
  }

  const { data: dailyLogs } = await supabaseAdmin
    .from('ai_usage_logs')
    .select('created_at, input_tokens, output_tokens, cost_twd')
    .gte('created_at', periodStart.toISOString())
    .lt('created_at', periodEnd.toISOString())
    .order('created_at', { ascending: true })
    .limit(5000)

  const dailyAgg = new Map<string, { calls: number; tokens: number; cost: number }>()
  for (const log of dailyLogs || []) {
    const day = log.created_at.slice(0, 10)
    const existing = dailyAgg.get(day) || { calls: 0, tokens: 0, cost: 0 }
    dailyAgg.set(day, {
      calls: existing.calls + 1,
      tokens: existing.tokens + log.input_tokens + log.output_tokens,
      cost: existing.cost + Number(log.cost_twd),
    })
  }

  const dailyChart = Array.from(dailyAgg.entries())
    .map(([date, stats]) => ({ date, ...stats }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const totalMessages = (quotas || []).reduce((sum, q) => sum + q.messages_count, 0)
  const totalTokens = (quotas || []).reduce((sum, q) => sum + q.tokens_input + q.tokens_output, 0)
  const totalCost = (quotas || []).reduce((sum, q) => sum + Number(q.cost_twd_estimated), 0)
  const totalCalls = (dailyLogs || []).length

  const userUsage = (quotas || []).map((q) => {
    const u = userMap.get(q.user_id)
    return {
      user_id: q.user_id,
      email: u?.email || 'unknown',
      name: u?.name || null,
      current_plan: u?.current_plan || 'unknown',
      messages_count: q.messages_count,
      tokens_total: q.tokens_input + q.tokens_output,
      cost_twd: Number(q.cost_twd_estimated),
    }
  })

  return NextResponse.json({
    data: {
      period: periodStartStr,
      overview: {
        total_messages: totalMessages,
        total_tokens: totalTokens,
        total_cost_twd: Math.round(totalCost * 100) / 100,
        total_api_calls: totalCalls,
        active_users: userUsage.length,
      },
      daily_chart: dailyChart,
      user_usage: userUsage,
    },
    error: null,
  })
}
