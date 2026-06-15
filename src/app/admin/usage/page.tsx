'use client'

import { useEffect, useState } from 'react'

interface DailyData {
  date: string
  calls: number
  tokens: number
  cost: number
}

interface UserUsage {
  user_id: string
  email: string
  name: string | null
  current_plan: string
  messages_count: number
  tokens_total: number
  cost_twd: number
}

interface UsageData {
  period: string
  overview: {
    total_messages: number
    total_tokens: number
    total_cost_twd: number
    total_api_calls: number
    active_users: number
  }
  daily_chart: DailyData[]
  user_usage: UserUsage[]
}

const PLAN_LABELS: Record<string, string> = {
  trial: '試用',
  basic: 'Basic',
  advanced: 'Advanced',
  premium: 'Premium',
  cancelled: '已取消',
}

function formatShortDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export default function AdminUsagePage() {
  const [data, setData] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'current' | 'last'>('current')

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      const res = await fetch(`/api/admin/usage?period=${period}`)
      const json = await res.json()
      if (json.data) setData(json.data)
      setLoading(false)
    }
    fetchData()
  }, [period])

  if (loading) {
    return <div className="p-6 text-gray-400">載入中...</div>
  }

  if (!data) {
    return <div className="p-6 text-gray-400">無資料</div>
  }

  const maxCost = Math.max(...data.daily_chart.map((d) => d.cost), 1)

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">📈 用量／成本</h1>
          <p className="text-sm text-gray-500 mt-1">AI API 使用量與成本統計</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPeriod('current')}
            className={`px-3 py-1.5 text-sm rounded-lg border ${
              period === 'current' ? 'bg-primary-50 border-primary-300 text-primary-700' : 'bg-white border-gray-200 text-gray-600'
            }`}
          >
            本月
          </button>
          <button
            onClick={() => setPeriod('last')}
            className={`px-3 py-1.5 text-sm rounded-lg border ${
              period === 'last' ? 'bg-primary-50 border-primary-300 text-primary-700' : 'bg-white border-gray-200 text-gray-600'
            }`}
          >
            上月
          </button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4 mb-8">
        <div className="p-4 bg-white rounded-xl border border-gray-200">
          <div className="text-xs text-gray-500">對話次數</div>
          <div className="text-2xl font-bold text-gray-800 mt-1">{data.overview.total_messages}</div>
        </div>
        <div className="p-4 bg-white rounded-xl border border-gray-200">
          <div className="text-xs text-gray-500">API 呼叫次數</div>
          <div className="text-2xl font-bold text-gray-800 mt-1">{data.overview.total_api_calls}</div>
        </div>
        <div className="p-4 bg-white rounded-xl border border-gray-200">
          <div className="text-xs text-gray-500">總 Tokens</div>
          <div className="text-2xl font-bold text-gray-800 mt-1">{formatTokens(data.overview.total_tokens)}</div>
        </div>
        <div className="p-4 bg-white rounded-xl border border-gray-200">
          <div className="text-xs text-gray-500">估計成本 (TWD)</div>
          <div className="text-2xl font-bold text-red-600 mt-1">${data.overview.total_cost_twd.toFixed(2)}</div>
        </div>
        <div className="p-4 bg-white rounded-xl border border-gray-200">
          <div className="text-xs text-gray-500">活躍用戶</div>
          <div className="text-2xl font-bold text-gray-800 mt-1">{data.overview.active_users}</div>
        </div>
      </div>

      {data.daily_chart.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-8">
          <h2 className="text-sm font-medium text-gray-700 mb-4">每日 API 成本 (TWD)</h2>
          <div className="flex items-end gap-1" style={{ height: 160 }}>
            {data.daily_chart.map((d) => {
              const h = Math.max((d.cost / maxCost) * 140, 2)
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center">
                  <div className="text-xs text-gray-400 mb-1">${d.cost.toFixed(1)}</div>
                  <div
                    className="w-full bg-primary-400 rounded-t"
                    style={{ height: h }}
                    title={`${d.date}: $${d.cost.toFixed(2)} / ${d.calls} calls / ${formatTokens(d.tokens)} tokens`}
                  />
                  <div className="text-xs text-gray-400 mt-1">{formatShortDate(d.date)}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-medium text-gray-700">用戶用量排行</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-600">#</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">用戶</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">方案</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">對話數</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Tokens</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">成本 (TWD)</th>
            </tr>
          </thead>
          <tbody>
            {data.user_usage.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">本月尚無用量</td>
              </tr>
            ) : (
              data.user_usage.map((u, i) => (
                <tr key={u.user_id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{u.name || u.email.split('@')[0]}</div>
                    <div className="text-xs text-gray-400">{u.email}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{PLAN_LABELS[u.current_plan] || u.current_plan}</td>
                  <td className="px-4 py-3 text-right text-gray-800">{u.messages_count}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{formatTokens(u.tokens_total)}</td>
                  <td className="px-4 py-3 text-right text-red-600">${u.cost_twd.toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
