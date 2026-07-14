'use client'

import { useEffect, useState, useCallback } from 'react'

interface Transaction {
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

interface TokenInfo {
  bound: boolean
  token_life: string | null
  bound_at: string | null
  token_key_masked: string | null
  customer_name: string | null
  customer_phone: string | null
}

interface SubUser {
  id: string
  email: string
  name: string | null
  current_plan: string
  subscription_started_at: string | null
  subscription_renews_at: string | null
  auto_renewal: boolean
  cancelled_at: string | null
  pending_downgrade_plan: string | null
  trial_started_at: string | null
  token_info: TokenInfo
  recent_transactions: Transaction[]
}

interface Counts {
  total: number
  trial: number
  active: number
  cancelled: number
}

type FilterType = 'all' | 'trial' | 'active' | 'cancelled'

const FILTERS: { value: FilterType; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'trial', label: '試用中' },
  { value: 'active', label: '訂閱中' },
  { value: 'cancelled', label: '已取消' },
]

const PLAN_LABELS: Record<string, string> = {
  trial: '試用',
  basic: 'Basic',
  advanced: 'Advanced',
  premium: 'Premium',
  cancelled: '已取消',
}

const PLAN_COLORS: Record<string, string> = {
  trial: 'bg-blue-100 text-blue-700',
  basic: 'bg-green-100 text-green-700',
  advanced: 'bg-purple-100 text-purple-700',
  premium: 'bg-amber-100 text-amber-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

const TX_TYPE_LABELS: Record<string, string> = {
  bind_card: '綁卡',
  renewal: '月扣',
  upgrade_diff: '升級差額',
  retry: '重試',
}

function formatDate(iso: string | null): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('zh-TW')
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('zh-TW', { hour12: false })
}

// token_life：YYYYMMDD → YYYY/MM/DD
function formatTokenLife(life: string | null): string {
  if (!life || life.length !== 8) return life || '-'
  return `${life.slice(0, 4)}/${life.slice(4, 6)}/${life.slice(6, 8)}`
}

export default function AdminSubscriptionsPage() {
  const [users, setUsers] = useState<SubUser[]>([])
  const [counts, setCounts] = useState<Counts>({ total: 0, trial: 0, active: 0, cancelled: 0 })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('all')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [expandedUser, setExpandedUser] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 400)
    return () => clearTimeout(t)
  }, [searchInput])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filter !== 'all') params.set('filter', filter)
    if (search) params.set('search', search)

    const res = await fetch(`/api/admin/subscriptions?${params}`)
    const json = await res.json()

    if (json.data) {
      setUsers(json.data.users)
      setCounts(json.data.counts)
    }
    setLoading(false)
  }, [filter, search])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <div className="p-6 max-w-6xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">💳 訂閱管理</h1>
      <p className="text-sm text-gray-500 mb-6">查看用戶訂閱狀態、付款紀錄與已綁定的 Token</p>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {FILTERS.map((f) => {
          const count = f.value === 'all' ? counts.total : counts[f.value as keyof Omit<Counts, 'total'>]
          return (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`p-4 rounded-xl border text-left transition-colors ${
                filter === f.value
                  ? 'border-primary-300 bg-primary-50'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <div className="text-xs text-gray-500">{f.label}</div>
              <div className="text-2xl font-bold text-gray-800 mt-1">{count}</div>
            </button>
          )
        })}
      </div>

      <div className="mb-4">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="搜尋 email 或姓名..."
          className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">載入中...</div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 text-gray-400">無符合條件的用戶</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">用戶</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">方案</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">下次扣款</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">自動續約</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Token</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">備註</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <>
                  <tr
                    key={u.id}
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                    onClick={() => setExpandedUser(expandedUser === u.id ? null : u.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{u.name || u.email.split('@')[0]}</div>
                      <div className="text-xs text-gray-400">{u.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${PLAN_COLORS[u.current_plan] || 'bg-gray-100'}`}>
                        {PLAN_LABELS[u.current_plan] || u.current_plan}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(u.subscription_renews_at)}</td>
                    <td className="px-4 py-3">
                      {u.auto_renewal ? (
                        <span className="text-green-600">✓ 是</span>
                      ) : (
                        <span className="text-gray-400">✗ 否</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {u.token_info?.bound ? (
                        <span className="text-green-600" title={u.token_info.token_key_masked || ''}>🔒 已綁定</span>
                      ) : (
                        <span className="text-gray-400">— 未綁</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {u.pending_downgrade_plan && `待降→${PLAN_LABELS[u.pending_downgrade_plan]}`}
                      {u.cancelled_at && `取消於 ${formatDate(u.cancelled_at)}`}
                    </td>
                  </tr>
                  {expandedUser === u.id && (
                    <tr key={`${u.id}-detail`}>
                      <td colSpan={6} className="px-4 py-4 bg-gray-50">
                        {/* Token 資料 */}
                        <div className="mb-4">
                          <div className="text-xs font-medium text-gray-500 mb-2">🔒 已儲存的 Token 資料</div>
                          {u.token_info?.bound ? (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-white rounded-lg border border-gray-200 p-3">
                              <div>
                                <div className="text-gray-400">Token Key（遮罩）</div>
                                <div className="font-mono text-gray-700">{u.token_info.token_key_masked || '-'}</div>
                              </div>
                              <div>
                                <div className="text-gray-400">綁定時間</div>
                                <div className="text-gray-700">{formatDateTime(u.token_info.bound_at)}</div>
                              </div>
                              <div>
                                <div className="text-gray-400">卡片/Token 到期</div>
                                <div className="text-gray-700">{formatTokenLife(u.token_info.token_life)}</div>
                              </div>
                              <div>
                                <div className="text-gray-400">續扣消費者姓名/電話</div>
                                <div className="text-gray-700">{u.token_info.customer_name || '(用帳號名)'} / {u.token_info.customer_phone || '(預設)'}</div>
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-gray-400">尚未綁定信用卡 Token</div>
                          )}
                        </div>

                        {/* 付款紀錄 */}
                        <div className="text-xs font-medium text-gray-500 mb-2">💳 付款紀錄（最近 10 筆）</div>
                        {u.recent_transactions.length > 0 ? (
                          <table className="w-full text-xs bg-white rounded-lg border border-gray-200">
                            <thead>
                              <tr className="text-gray-400 border-b border-gray-100">
                                <th className="text-left px-2 py-1.5">類型</th>
                                <th className="text-right px-2 py-1.5">金額</th>
                                <th className="text-left px-2 py-1.5">狀態</th>
                                <th className="text-left px-2 py-1.5">錯誤碼</th>
                                <th className="text-left px-2 py-1.5">紅陽交易編號</th>
                                <th className="text-left px-2 py-1.5">時間</th>
                              </tr>
                            </thead>
                            <tbody>
                              {u.recent_transactions.map((tx, i) => (
                                <tr key={i} className="border-t border-gray-50">
                                  <td className="px-2 py-1.5">{TX_TYPE_LABELS[tx.transaction_type] || tx.transaction_type}</td>
                                  <td className="px-2 py-1.5 text-right">NT${tx.amount}</td>
                                  <td className="px-2 py-1.5">
                                    <span className={tx.status === 'success' ? 'text-green-600' : tx.status === 'failed' ? 'text-red-500' : 'text-yellow-600'}>
                                      {tx.status}
                                    </span>
                                  </td>
                                  <td className="px-2 py-1.5 text-gray-500">{tx.errcode || '-'}</td>
                                  <td className="px-2 py-1.5 font-mono text-gray-500">{tx.esafe_no || '-'}</td>
                                  <td className="px-2 py-1.5 text-gray-400">{formatDateTime(tx.created_at)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div className="text-xs text-gray-400">無付款紀錄</div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
