// 放置路徑：src/app/api/admin/usage/route.ts
//
// Phase 1A：admin 用量 / 成本 analytics
//
// GET /api/admin/usage
//   ?days=30  (預設 30、過去 N 天)
//
// 回傳：
//   - total_cost_twd（本期間總 API 成本）
//   - total_messages（總 AI 對話次數）
//   - daily_breakdown（每日 cost + messages）
//   - top_users_by_cost（最花錢的前 10 user）
//
// 用途：admin 看公司 API cost vs subscription revenue 是否平衡

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { supabaseAdmin } from '@/lib/supabase';
import type { ApiResponse } from '@/types';

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;

  try {
    const url = new URL(request.url);
    const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '30', 10), 1), 365);

    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceIso = since.toISOString();

    // 抓期間內所有 usage logs
    const { data: logs, error: logsError } = await supabaseAdmin
      .from('ai_usage_logs')
      .select('user_id, model, input_tokens, output_tokens, cost_twd, created_at')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false });

    if (logsError) {
      console.error('[GET /api/admin/usage] logs query failed:', logsError);
      return NextResponse.json<ApiResponse>(
        { data: null, error: '查詢失敗', timestamp: new Date().toISOString() },
        { status: 500 }
      );
    }

    const safeLogs = logs || [];

    // 總計
    let totalCost = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    safeLogs.forEach(l => {
      totalCost += Number(l.cost_twd || 0);
      totalInputTokens += l.input_tokens || 0;
      totalOutputTokens += l.output_tokens || 0;
    });

    // Daily breakdown
    const dailyMap = new Map<string, { cost: number; messages: number; tokens: number }>();
    safeLogs.forEach(l => {
      const day = l.created_at.slice(0, 10); // YYYY-MM-DD
      const cur = dailyMap.get(day) || { cost: 0, messages: 0, tokens: 0 };
      cur.cost += Number(l.cost_twd || 0);
      cur.messages += 1;
      cur.tokens += (l.input_tokens || 0) + (l.output_tokens || 0);
      dailyMap.set(day, cur);
    });
    const dailyBreakdown = Array.from(dailyMap.entries())
      .map(([day, data]) => ({ day, ...data }))
      .sort((a, b) => a.day.localeCompare(b.day));

    // Top users by cost
    const userMap = new Map<string, { cost: number; messages: number; tokens: number }>();
    safeLogs.forEach(l => {
      if (!l.user_id) return;
      const cur = userMap.get(l.user_id) || { cost: 0, messages: 0, tokens: 0 };
      cur.cost += Number(l.cost_twd || 0);
      cur.messages += 1;
      cur.tokens += (l.input_tokens || 0) + (l.output_tokens || 0);
      userMap.set(l.user_id, cur);
    });
    const topUserIds = Array.from(userMap.entries())
      .sort((a, b) => b[1].cost - a[1].cost)
      .slice(0, 10)
      .map(([id]) => id);

    // 抓這些 top users 的 email + plan
    let topUserInfos: Array<{
      user_id: string;
      email: string | null;
      name: string | null;
      plan: string | null;
      cost_twd: number;
      messages: number;
      tokens: number;
    }> = [];
    if (topUserIds.length > 0) {
      const { data: userInfos } = await supabaseAdmin
        .from('users')
        .select('id, email, name, current_plan')
        .in('id', topUserIds);

      const infoMap = new Map((userInfos || []).map(u => [u.id, u]));
      topUserInfos = topUserIds.map(uid => {
        const info = infoMap.get(uid);
        const data = userMap.get(uid)!;
        return {
          user_id: uid,
          email: info?.email ?? null,
          name: info?.name ?? null,
          plan: info?.current_plan ?? null,
          cost_twd: data.cost,
          messages: data.messages,
          tokens: data.tokens,
        };
      });
    }

    return NextResponse.json<ApiResponse>({
      data: {
        days,
        since: sinceIso,
        total_cost_twd: totalCost,
        total_messages: safeLogs.length,
        total_input_tokens: totalInputTokens,
        total_output_tokens: totalOutputTokens,
        unique_users: userMap.size,
        avg_cost_per_message: safeLogs.length > 0 ? totalCost / safeLogs.length : 0,
        daily_breakdown: dailyBreakdown,
        top_users_by_cost: topUserInfos,
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[GET /api/admin/usage] unexpected:', err);
    return NextResponse.json<ApiResponse>(
      { data: null, error: '伺服器錯誤', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
