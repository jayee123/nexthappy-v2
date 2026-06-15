// 放置路徑：src/app/admin/page.tsx
//
// Week 5 Session 5B-2：Stats Dashboard
//
// 內容：
//   - Overview cards（8 個 KPI）
//   - 30 天 DAU bar chart
//   - 21 天 Funnel（Day 0-21 current_day 分佈）
//   - Mode A/B 使用比例（含訊息數）
//
// 設計哲學：不裝 chart lib、純 HTML/CSS bar（跟 Episode 4 mini markdown 同款選擇）

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface DailyActiveUser { date: string; count: number; }
interface DayDistribution { day: number; journey_count: number; active_count: number; }
interface ContextTypeStat {
  context_type: string;
  label: string;
  conversation_count: number;
  total_messages: number;
  avg_messages_per_conv: number;
  percentage: number;
}

interface StatsData {
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
  daily_active_users: DailyActiveUser[];
  day_distribution: DayDistribution[];
  context_type_stats: ContextTypeStat[];
}

function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/admin/stats');
        const json = await res.json();
        if (!res.ok || json.error) throw new Error(json.error || '查詢失敗');
        setStats(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '查詢失敗');
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return <div className="p-6 lg:p-8 text-gray-400">載入中⋯</div>;
  }

  if (error || !stats) {
    return (
      <div className="p-6 lg:p-8">
        <h1 className="text-2xl font-bold text-gray-800">📊 Dashboard</h1>
        <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          ⚠️ {error || '查詢失敗'}
        </div>
      </div>
    );
  }

  const { overview, daily_active_users, day_distribution, context_type_stats } = stats;

  // Dynamic scales
  const dauMax = Math.max(1, ...daily_active_users.map(d => d.count));
  const funnelMax = Math.max(1, ...day_distribution.map(d => d.journey_count));

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">📊 Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">後台首頁、總覽統計</p>
      </div>

      {/* Overview Cards - User stats */}
      <div className="mb-3">
        <div className="text-xs font-medium text-gray-500 mb-2">👥 用戶</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card label="總用戶數" value={overview.total_users} suffix="" sub={overview.suspended_users > 0 ? `含 ${overview.suspended_users} 停權` : ''} />
          <Card label="今日活躍" value={overview.active_users_today} suffix=" 人" />
          <Card label="本週活躍" value={overview.active_users_7d} suffix=" 人" />
          <Card label="月活躍" value={overview.active_users_30d} suffix=" 人" />
        </div>
      </div>

      {/* Overview Cards - Journey stats */}
      <div className="mb-6">
        <div className="text-xs font-medium text-gray-500 mb-2">🗺 Journey + 對話</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card label="進行中 Journey" value={overview.active_journeys} suffix="" sub={`共 ${overview.total_journeys} 筆`} />
          <Card
            label="⚠️ 卡關 Journey"
            value={overview.stuck_journeys}
            suffix=""
            valueClass={overview.stuck_journeys > 0 ? 'text-amber-600' : ''}
            sub={
              <Link href="/admin/journeys?filter=stuck" className="text-primary-600 hover:underline">查看 →</Link>
            }
          />
          <Card
            label="卡關率"
            value={overview.stuck_rate}
            suffix="%"
            valueClass={overview.stuck_rate > 30 ? 'text-amber-600' : ''}
          />
          <Card
            label="總對話"
            value={overview.total_conversations}
            suffix=""
            sub={`${overview.total_messages} 訊息`}
          />
        </div>
      </div>

      {/* 30-day DAU */}
      <Section title="📈 過去 30 天活躍用戶">
        <div className="flex items-end gap-1 h-32 mt-2">
          {daily_active_users.map(d => {
            const heightPx = d.count > 0 ? Math.max(12, (d.count / dauMax) * 110) : 3;
            return (
              <div
                key={d.date}
                className="flex-1 flex flex-col items-center justify-end group relative"
                title={`${d.date}: ${d.count} 人`}
              >
                <div
                  className={`w-full rounded-t transition-all ${
                    d.count > 0 ? 'bg-primary-400 group-hover:bg-primary-600' : 'bg-gray-100'
                  }`}
                  style={{ height: `${heightPx}px` }}
                />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>{daily_active_users[0] && formatShortDate(daily_active_users[0].date)}</span>
          <span>{daily_active_users[14] && formatShortDate(daily_active_users[14].date)}</span>
          <span>{daily_active_users[daily_active_users.length - 1] && formatShortDate(daily_active_users[daily_active_users.length - 1].date)} 今天</span>
        </div>
        <div className="text-xs text-gray-500 mt-3">
          Peak: {dauMax} 人 / 共 {daily_active_users.filter(d => d.count > 0).length} 個活躍日（30 天內）
        </div>
      </Section>

      {/* 21-day funnel */}
      <Section title="🗺 21 天 Funnel — current_day 分佈">
        <div className="flex items-end gap-1 h-40 mt-2">
          {day_distribution.map(d => {
            const heightPx = d.journey_count > 0 ? Math.max(16, (d.journey_count / funnelMax) * 130) : 4;
            const isOnboarding = d.day === 0;
            return (
              <div
                key={d.day}
                className="flex-1 flex flex-col items-center justify-end group relative"
                title={`Day ${d.day}: ${d.journey_count} journey (${d.active_count} active)`}
              >
                {d.journey_count > 0 && (
                  <div className="text-xs text-gray-700 font-medium mb-1">{d.journey_count}</div>
                )}
                <div
                  className={`w-full rounded-t transition-all ${
                    d.journey_count > 0
                      ? isOnboarding
                        ? 'bg-blue-300 group-hover:bg-blue-500'
                        : 'bg-green-300 group-hover:bg-green-500'
                      : 'bg-gray-100'
                  }`}
                  style={{ height: `${heightPx}px` }}
                />
                <div className="text-xs text-gray-500 mt-1 tabular-nums">{d.day}</div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 text-xs text-gray-500 mt-4">
          <span><span className="inline-block w-3 h-3 bg-blue-300 rounded mr-1 align-middle"></span>Day 0 onboarding</span>
          <span><span className="inline-block w-3 h-3 bg-green-300 rounded mr-1 align-middle"></span>練習中</span>
          <span><span className="inline-block w-3 h-3 bg-gray-100 rounded mr-1 align-middle"></span>無 user</span>
        </div>
      </Section>

      {/* Mode A/B ratio */}
      <Section title="💬 Mode 使用比例">
        <div className="space-y-3 mt-2">
          {context_type_stats.map(s => (
            <div key={s.context_type} className="flex items-center gap-3">
              <div className="w-32 sm:w-40 shrink-0 text-sm text-gray-700">{s.label}</div>
              <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden relative">
                <div
                  className={`h-full transition-all ${
                    s.context_type === 'consultant' ? 'bg-purple-400'
                    : s.context_type === 'morning' ? 'bg-orange-400'
                    : 'bg-indigo-400'
                  }`}
                  style={{ width: `${s.percentage}%` }}
                />
                <div className="absolute inset-0 flex items-center px-2 text-xs text-white font-medium">
                  {s.percentage}%
                </div>
              </div>
              <div className="text-xs text-gray-500 text-right w-48 shrink-0">
                {s.conversation_count} 對話 · {s.total_messages} 訊息 · avg {s.avg_messages_per_conv}
              </div>
            </div>
          ))}
        </div>
        <div className="text-xs text-gray-500 mt-3">
          💡 Mode A morning 平均訊息數最高、代表深度練習；Mode B consultant 對話數多但單次互動較短
        </div>
      </Section>
    </div>
  );
}

// === Helper components ===

function Card({
  label,
  value,
  suffix,
  sub,
  valueClass = '',
}: {
  label: string;
  value: number | string;
  suffix: string;
  sub?: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${valueClass || 'text-gray-800'}`}>
        {value}{suffix}
      </div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 lg:p-5 mb-5">
      <h2 className="text-sm font-medium text-gray-700">{title}</h2>
      {children}
    </div>
  );
}