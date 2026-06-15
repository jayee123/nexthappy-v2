import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const TRIAL_DAYS = 7

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - TRIAL_DAYS)

  const { data: expiredTrials, error } = await supabaseAdmin
    .from('users')
    .select('id, email, trial_started_at')
    .eq('current_plan', 'trial')
    .lt('trial_started_at', cutoff.toISOString())

  if (error) {
    console.error('[cron:expire-trials] query error:', error)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  if (!expiredTrials || expiredTrials.length === 0) {
    return NextResponse.json({ expired: 0 })
  }

  const ids = expiredTrials.map((u) => u.id)

  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update({
      current_plan: 'cancelled',
      auto_renewal: false,
      cancelled_at: new Date().toISOString(),
    })
    .in('id', ids)

  if (updateError) {
    console.error('[cron:expire-trials] update error:', updateError)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  for (const user of expiredTrials) {
    console.log(`[cron:expire-trials] expired: user=${user.id} email=${user.email} trial_started=${user.trial_started_at}`)
  }

  await supabaseAdmin.from('admin_audit_logs').insert(
    expiredTrials.map((u) => ({
      admin_user_id: null,
      action: 'cron.expire_trial',
      target_type: 'user',
      target_id: u.id,
      changes: { after: { plan: 'cancelled', source: 'cron' } },
      ip_address: 'cron',
      user_agent: 'vercel-cron',
    })),
  )

  return NextResponse.json({ expired: ids.length })
}
