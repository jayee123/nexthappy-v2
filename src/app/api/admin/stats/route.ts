// 放置路徑：src/app/api/admin/stats/route.ts
//
// Week 5 Session 5B-1：Stats API
//
// 聚合多 metric、單一 endpoint 一次回傳：
//   - Overview cards（總數 / active / stuck）
//   - 30 天 DAU 時間軸
//   - 21 天 funnel（current_day 分佈）
//   - Mode A/B 比例（含訊息數）

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { supabaseAdmin } from '@/lib/supabase';
import type { ApiResponse } from '@/types';

interface MessageItem { role: string; content: string; }

interface StatsResponse {
  overview: {
    total_users: number;
    suspended_users: number;
    active_users_today: number;
    active_users_7d: number;
    active_users_30d: number;
    total_journeys: number;
    active_journeys: number;
    stuck_journeys: number;
    stuck_rate: number;
    total_conversations: number;
    total_messages: number;
  };
  daily_active_users: { date: string; count: number; }[];
  day_distribution: { day: number; journey_count: number; active_count: number; }[];
  context_type_stats: {
    context_type: string;
    label: string;
    conversation_count: number;
    total_messages: number;
    avg_messages_per_conv: number;
    percentage: number;
  }[];
}

const CONTEXT_LABEL: Record<string, string> = {
  morning: '🌅 晨間練習',
  evening: '🌙 晚間回顧',
  consultant: '💬 Mode B 諮詢',
};

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;

  try {
    // Parallel fetch
    const [usersR, journeysR, conversationsR] = await Promise.all([
      supabaseAdmin.from('users').select('id, suspended_at'),
      supabaseAdmin.from('journeys').select('id, current_day, is_active'),
      supabaseAdmin
        .from('conversations')
        .select('id, user_id, journey_id, day_number, context_type, created_at, messages'),
    ]);

    if (usersR.error) throw usersR.error;
    if (journeysR.error) throw journeysR.error;
    if (conversationsR.error) throw conversationsR.error;

    const users = usersR.data || [];
    const journeys = journeysR.data || [];
    const conversations = conversationsR.data || [];

    const now = Date.now();
    const day = 86400000;

    // === Overview ===
    const total_users = users.length;
    const suspended_users = users.filter(u => u.suspended_at).length;

    // active users by recent activity
    const userLastActive = new Map<string, number>();
    for (const c of conversations) {
      const t = new Date(c.created_at).getTime();
      const cur = userLastActive.get(c.user_id) || 0;
      if (t > cur) userLastActive.set(c.user_id, t);
    }
    let active_users_today = 0;
    let active_users_7d = 0;
    let active_users_30d = 0;
    for (const t of userLastActive.values()) {
      const ageDays = (now - t) / day;
      if (ageDays < 1) active_users_today++;
      if (ageDays < 7) active_users_7d++;
      if (ageDays < 30) active_users_30d++;
    }

    // journey stats
    const total_journeys = journeys.length;
    const active_journeys = journeys.filter(j => j.is_active).length;

    // stuck = is_active && last conv > 7 days ago
    const journeyLastConv = new Map<string, number>();
    for (const c of conversations) {
      if (!c.journey_id) continue;
      const t = new Date(c.created_at).getTime();
      const cur = journeyLastConv.get(c.journey_id) || 0;
      if (t > cur) journeyLastConv.set(c.journey_id, t);
    }
    let stuck_journeys = 0;
    for (const j of journeys) {
      if (!j.is_active) continue;
      const last = journeyLastConv.get(j.id);
      if (last === undefined) continue; // no conversation yet, not stuck
      const ageDays = (now - last) / day;
      if (ageDays > 7) stuck_journeys++;
    }
    const stuck_rate = active_journeys > 0
      ? Math.round((stuck_journeys / active_journeys) * 1000) / 10
      : 0;

    // conversation stats
    const total_conversations = conversations.length;
    let total_messages = 0;
    for (const c of conversations) {
      const msgs = (c.messages as MessageItem[]) || [];
      total_messages += msgs.length;
    }

    // === Daily active users（30 days） ===
    const dauMap = new Map<string, Set<string>>(); // date → set of user_ids
    for (let i = 0; i < 30; i++) {
      const d = new Date(now - i * day);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      dauMap.set(dateStr, new Set());
    }
    for (const c of conversations) {
      const t = new Date(c.created_at).getTime();
      const ageDays = (now - t) / day;
      if (ageDays >= 30 || ageDays < 0) continue;
      const d = new Date(c.created_at);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const s = dauMap.get(dateStr);
      if (s) s.add(c.user_id);
    }
    const daily_active_users = Array.from(dauMap.entries())
      .map(([date, set]) => ({ date, count: set.size }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // === Day distribution（0-21） ===
    const dayCountMap = new Map<number, { total: number; active: number }>();
    for (let d = 0; d <= 21; d++) {
      dayCountMap.set(d, { total: 0, active: 0 });
    }
    for (const j of journeys) {
      const d = j.current_day;
      if (d < 0 || d > 21) continue;
      const bucket = dayCountMap.get(d)!;
      bucket.total++;
      if (j.is_active) bucket.active++;
    }
    const day_distribution = Array.from(dayCountMap.entries())
      .map(([d, v]) => ({ day: d, journey_count: v.total, active_count: v.active }))
      .sort((a, b) => a.day - b.day);

    // === Context type stats ===
    const ctxMap = new Map<string, { conv_count: number; msg_count: number }>();
    for (const c of conversations) {
      if (!c.context_type) continue;
      const msgs = (c.messages as MessageItem[]) || [];
      const cur = ctxMap.get(c.context_type) || { conv_count: 0, msg_count: 0 };
      cur.conv_count++;
      cur.msg_count += msgs.length;
      ctxMap.set(c.context_type, cur);
    }
    const totalCtxConv = Array.from(ctxMap.values()).reduce((s, v) => s + v.conv_count, 0);
    const context_type_stats = Array.from(ctxMap.entries())
      .map(([ctx, v]) => ({
        context_type: ctx,
        label: CONTEXT_LABEL[ctx] || ctx,
        conversation_count: v.conv_count,
        total_messages: v.msg_count,
        avg_messages_per_conv: v.conv_count > 0
          ? Math.round((v.msg_count / v.conv_count) * 10) / 10
          : 0,
        percentage: totalCtxConv > 0
          ? Math.round((v.conv_count / totalCtxConv) * 1000) / 10
          : 0,
      }))
      .sort((a, b) => b.conversation_count - a.conversation_count);

    const stats: StatsResponse = {
      overview: {
        total_users,
        suspended_users,
        active_users_today,
        active_users_7d,
        active_users_30d,
        total_journeys,
        active_journeys,
        stuck_journeys,
        stuck_rate,
        total_conversations,
        total_messages,
      },
      daily_active_users,
      day_distribution,
      context_type_stats,
    };

    return NextResponse.json<ApiResponse>({
      data: stats,
      error: null,
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    console.error('Stats API error:', err);
    return NextResponse.json<ApiResponse>({
      data: null,
      error: err instanceof Error ? err.message : '查詢失敗',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}