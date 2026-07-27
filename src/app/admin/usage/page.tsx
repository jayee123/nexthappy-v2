// 放置路徑：src/app/admin/usage/page.tsx
//
// Phase 1A：admin 用量 / 成本 analytics 頁
//
// 內容：
//   - 上方 stats：總成本 / 總對話 / 平均 / unique users
//   - 每日 bar chart（pure CSS、不引 chart library）
//   - Top 10 cost spenders 表格

'use client';

import { useCallback, useEffect, useState } from 'react';

interface DailyData {
  day: string;
  cost: number;
  messages: number;
  tokens: number;
}

interface TopUser {
  user_id: string;
  email: string | null;
  name: string | null;
  plan: string | null;
  cost_twd: number;
  messages: number;
  tokens: number;
}

interface UsageData {
  days: number;
  since: string;
  total_cost_twd: number;
  total_messages: number;
  total_input_tokens: number;
  total_output_tokens: number;
  unique_users: number;
  avg_cost_per_message: number;
  daily_breakdown: DailyData[];
  top_users_by_cost: TopUser[];
}

export default function AdminUsagePage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/usage?days=${days}`);
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || '查詢失敗');
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '查詢失敗');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const maxDailyCost = data?.daily_breakdown
    ? Math.max(...data.daily_breakdown.map(d => d.cost), 1)
    : 1;

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-800">📈 用量 / 成本</h1>
        <p className="text-sm text-gray-500 mt-1">API 成本追蹤、cost vs revenue 平衡監控</p>
      </div>

      <div className="mb-4 bg-white border border-gray-200 rounded-lg p-3 flex items-center gap-3 flex-wrap">
        <span className="text-xs text-gray-500">統計期間：</span>
        {[7, 30, 90].map(d => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`px-3 py-1 text-xs rounded-md ${
              days === d ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            過去 {d} 天
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-8 text-center text-sm text-gray-400">
          載入中⋯
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          ⚠️ {error}
        </div>
      ) : !data ? (
        <div className="text-gray-400">無資料</div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <StatCard
              label="總 API 成本"
              value={`NT$ ${data.total_cost_twd.toFixed(2)}`}
              cls="bg-amber-50 border-amber-200 text-amber-800"
            />
            <StatCard
              label="總對話次數"
              value={data.total_messages.toLocaleString()}
              cls="bg-blue-50 border-blue-200 text-blue-800"
            />
            <StatCard
              label="平均成本 / 則"
              value={`NT$ ${data.avg_cost_per_message.toFixed(3)}`}
              cls="bg-green-50 border-green-200 text-green-800"
            />
            <StatCard
              label="活躍 user 數"
              value={data.unique_users.toLocaleString()}
              cls="bg-purple-50 border-purple-200 text-purple-800"
            />
          </div>

          {/* Daily chart */}
          <div className="bg-white border border-gray-200 rounded-lg p-5 mb-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">每日成本（NT$）</h2>
            {data.daily_breakdown.length === 0 ? (
              <div className="text-xs text-gray-400 py-4 text-center">期間內無資料</div>
            ) : (
              <div className="flex items-end gap-1 h-40">
                {data.daily_breakdown.map(d => {
                  const hPct = (d.cost / maxDailyCost) * 100;
                  return (
                    <div
                      key={d.day}
                      className="flex-1 flex flex-col items-center justify-end group relative"
                      title={`${d.day} · NT$ ${d.cost.toFixed(2)} · ${d.messages} 則`}
                    >
                      <div
                        className="w-full bg-primary-400 hover:bg-primary-500 rounded-t transition-colors"
                        style={{ height: `${Math.max(2, hPct)}%` }}
                      />
                      <div className="text-[9px] text-gray-400 mt-1 transform -rotate-45 origin-top-left translate-y-1">
                        {d.day.slice(5)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top users */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-700">Top 10 高成本 User</h2>
            </div>
            {data.top_users_by_cost.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">期間內無資料</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-gray-600 w-8">#</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">User</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600 w-24">方案</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600 w-28">對話數</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600 w-32">Tokens</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600 w-28">成本</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top_users_by_cost.map((u, i) => (
                    <tr key={u.user_id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-3 py-2">
                        <div className="text-gray-800 text-sm">{u.name || u.email?.split('@')[0] || '已刪除'}</div>
                        <div className="text-xs text-gray-400">{u.email || '—'}</div>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600">{u.plan || '—'}</td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums">{u.messages}</td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums text-gray-500">
                        {u.tokens.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums font-medium text-amber-700">
                        NT$ {u.cost_twd.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, cls }: { label: string; value: string; cls: string }) {
  return (
    <div className={`border rounded-lg p-3 ${cls}`}>
      <div className="text-xs opacity-70">{label}</div>
      <div className="text-xl font-bold mt-1 tabular-nums">{value}</div>
    </div>
  );
}
