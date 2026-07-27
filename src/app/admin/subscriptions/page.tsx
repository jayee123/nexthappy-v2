// 放置路徑：src/app/admin/subscriptions/page.tsx
//
// Phase 1A：admin 訂閱管理頁
//
// 功能：
//   - 上方 stat cards：5 個方案各自人數
//   - 篩選 + 搜尋
//   - 表格：email / 方案 / 試用狀態 / 本月用量 / 成本 / 動作
//   - 動作：手動改方案（select + 套用）/ start trial / cancel / restore

'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';

type PlanTier = 'trial' | 'basic' | 'advanced' | 'premium' | 'cancelled';

interface SubscriptionItem {
  user_id: string;
  email: string;
  name: string | null;
  current_plan: PlanTier;
  plan_label: string;
  plan_monthly_messages: number;
  trial_started_at: string | null;
  trial_expires_at: string | null;
  subscription_started_at: string | null;
  subscription_renews_at: string | null;
  auto_renewal: boolean;
  cancelled_at: string | null;
  messages_used_this_month: number;
  messages_remaining: number;
  cost_twd_this_month: number;
  created_at: string;
  token_info: {
    bound: boolean;
    token_life: string | null;
    bound_at: string | null;
    token_key_masked: string | null;
    customer_name: string | null;
    customer_phone: string | null;
  };
  recent_transactions: {
    plan_tier: string;
    amount: number;
    status: string;
    transaction_type: string;
    errcode: string | null;
    esafe_no: string | null;
    created_at: string;
  }[];
}

const PLAN_META: Record<PlanTier, { label: string; cls: string }> = {
  trial: { label: '試用', cls: 'bg-green-50 text-green-700 border-green-200' },
  basic: { label: 'Basic', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  advanced: { label: 'Advanced', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  premium: { label: 'Premium', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  cancelled: { label: '已取消', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
};

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateOnly(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

export default function AdminSubscriptionsPage() {
  const [subs, setSubs] = useState<SubscriptionItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  // Filters
  const [planFilter, setPlanFilter] = useState<string>('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  // Action target
  const [updating, setUpdating] = useState<string | null>(null);

  // Token / 交易明細展開的 user
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchData = useCallback(
    async (cursor: string | null = null) => {
      if (cursor) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (planFilter) params.set('plan', planFilter);
        if (search) params.set('search', search);
        if (cursor) params.set('cursor', cursor);
        params.set('limit', '50');

        const res = await fetch(`/api/admin/subscriptions?${params}`);
        const json = await res.json();
        if (!res.ok || json.error) throw new Error(json.error || '查詢失敗');

        if (cursor) {
          setSubs(prev => [...prev, ...json.data.subscriptions]);
        } else {
          setSubs(json.data.subscriptions);
          setCounts(json.data.counts || {});
        }
        setHasMore(json.data.has_more);
        setNextCursor(json.data.next_cursor);
      } catch (err) {
        setError(err instanceof Error ? err.message : '查詢失敗');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [planFilter, search]
  );

  useEffect(() => {
    fetchData(null);
  }, [fetchData]);

  async function patchSubscription(userId: string, payload: Record<string, unknown>, label: string) {
    if (!confirm(`確認 ${label}？`)) return;
    setUpdating(userId);
    try {
      const res = await fetch(`/api/admin/subscriptions/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || '更新失敗');
      fetchData(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : '更新失敗');
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-800">💳 訂閱管理</h1>
        <p className="text-sm text-gray-500 mt-1">手動調整 user 方案、看用量與成本</p>
      </div>

      {/* Stat cards：每方案人數 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        {(['trial', 'basic', 'advanced', 'premium', 'cancelled'] as PlanTier[]).map(p => {
          const meta = PLAN_META[p];
          return (
            <div key={p} className={`border rounded-lg p-3 ${meta.cls}`}>
              <div className="text-xs opacity-70">{meta.label}</div>
              <div className="text-2xl font-bold mt-1 tabular-nums">{counts[p] ?? 0}</div>
            </div>
          );
        })}
      </div>

      {/* Filter + search */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">方案：</span>
          <select
            value={planFilter}
            onChange={e => setPlanFilter(e.target.value)}
            className="text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-400"
          >
            <option value="">全部</option>
            <option value="trial">試用</option>
            <option value="basic">Basic</option>
            <option value="advanced">Advanced</option>
            <option value="premium">Premium</option>
            <option value="cancelled">已取消</option>
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <input
            type="search"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="搜尋 email / name"
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-2 focus:ring-primary-400 outline-none"
          />
        </div>
      </div>

      {/* List */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">載入中⋯</div>
        ) : error ? (
          <div className="px-4 py-4 bg-red-50 text-red-700 text-sm">⚠️ {error}</div>
        ) : subs.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">沒有 user 符合條件</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">User</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600 w-28">方案</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600 w-32">試用 / 續訂</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600 w-32">本月用量</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600 w-24">成本</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600 w-24">Token</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600 w-48">動作</th>
                </tr>
              </thead>
              <tbody>
                {subs.map(s => {
                  const meta = PLAN_META[s.current_plan];
                  const usagePct = s.plan_monthly_messages > 0
                    ? Math.min(100, Math.round((s.messages_used_this_month / s.plan_monthly_messages) * 100))
                    : 0;
                  const tk = s.token_info;
                  const isExpanded = expandedUser === s.user_id;
                  return (
                    <Fragment key={s.user_id}>
                    <tr className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2.5">
                        <div className="text-gray-800 text-sm">{s.name || s.email.split('@')[0]}</div>
                        <div className="text-xs text-gray-400">{s.email}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] border ${meta.cls}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-600">
                        {s.current_plan === 'trial' && s.trial_expires_at ? (
                          <span title={s.trial_expires_at}>到期：{formatDateOnly(s.trial_expires_at)}</span>
                        ) : s.subscription_renews_at ? (
                          <span title={s.subscription_renews_at}>續訂：{formatDateOnly(s.subscription_renews_at)}</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs">
                        <div className="tabular-nums text-gray-700">
                          {s.messages_used_this_month} / {s.plan_monthly_messages}
                        </div>
                        <div className="mt-1 w-full bg-gray-100 rounded h-1 overflow-hidden">
                          <div
                            className={`h-full ${
                              usagePct >= 90 ? 'bg-red-500' :
                              usagePct >= 70 ? 'bg-amber-500' :
                              'bg-primary-500'
                            }`}
                            style={{ width: `${usagePct}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs tabular-nums text-gray-700">
                        NT$ {s.cost_twd_this_month.toFixed(2)}
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        <button
                          onClick={() => setExpandedUser(isExpanded ? null : s.user_id)}
                          className={`inline-flex items-center gap-1 ${tk.bound ? 'text-green-600' : 'text-gray-400'}`}
                          title={tk.token_key_masked || ''}
                        >
                          {tk.bound ? '🔒 已綁' : '— 未綁'}
                          <span className="text-gray-300">{isExpanded ? '▲' : '▼'}</span>
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs">
                        <div className="flex items-center justify-end gap-1 flex-wrap">
                          <select
                            value={s.current_plan}
                            onChange={e => {
                              const newPlan = e.target.value as PlanTier;
                              if (newPlan === s.current_plan) return;
                              patchSubscription(s.user_id, { current_plan: newPlan }, `改 ${meta.label} → ${PLAN_META[newPlan].label}`);
                            }}
                            disabled={updating === s.user_id}
                            className="text-xs px-1.5 py-0.5 border border-gray-200 rounded bg-white"
                          >
                            <option value="trial">試用</option>
                            <option value="basic">Basic</option>
                            <option value="advanced">Advanced</option>
                            <option value="premium">Premium</option>
                            <option value="cancelled">取消</option>
                          </select>
                          {!s.trial_started_at && s.current_plan !== 'cancelled' && (
                            <button
                              onClick={() => patchSubscription(s.user_id, { start_trial: true }, '啟動 7 天試用')}
                              disabled={updating === s.user_id}
                              className="px-2 py-0.5 bg-green-50 hover:bg-green-100 text-green-700 rounded disabled:opacity-50"
                              title="把該 user 設為 trial 並 trial_started_at = NOW"
                            >
                              啟動試用
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-gray-50">
                        <td colSpan={7} className="px-4 py-3">
                          {tk.bound ? (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-3">
                              <div><div className="text-gray-400">Token Key（遮罩）</div><div className="font-mono text-gray-700">{tk.token_key_masked || '—'}</div></div>
                              <div><div className="text-gray-400">綁定時間</div><div className="text-gray-700">{formatTime(tk.bound_at)}</div></div>
                              <div><div className="text-gray-400">卡片到期</div><div className="text-gray-700">{tk.token_life || '—'}</div></div>
                              <div><div className="text-gray-400">續扣姓名/電話</div><div className="text-gray-700">{tk.customer_name || '(帳號名)'} / {tk.customer_phone || '(預設)'}</div></div>
                            </div>
                          ) : (
                            <div className="text-xs text-gray-400 mb-2">尚未綁定信用卡 Token</div>
                          )}
                          <div className="text-xs font-medium text-gray-500 mb-1">💳 付款紀錄（最近 {s.recent_transactions.length} 筆）</div>
                          {s.recent_transactions.length > 0 ? (
                            <div className="overflow-x-auto">
                              <table className="w-full text-[11px] bg-white border border-gray-200 rounded">
                                <thead className="text-gray-400">
                                  <tr>
                                    <th className="text-left px-2 py-1">類型</th>
                                    <th className="text-right px-2 py-1">金額</th>
                                    <th className="text-left px-2 py-1">狀態</th>
                                    <th className="text-left px-2 py-1">錯誤碼</th>
                                    <th className="text-left px-2 py-1">紅陽編號</th>
                                    <th className="text-left px-2 py-1">時間</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {s.recent_transactions.map((tx, i) => (
                                    <tr key={i} className="border-t border-gray-100">
                                      <td className="px-2 py-1">{tx.transaction_type}</td>
                                      <td className="px-2 py-1 text-right tabular-nums">NT${tx.amount}</td>
                                      <td className={`px-2 py-1 ${tx.status === 'success' ? 'text-green-600' : tx.status === 'failed' ? 'text-red-500' : 'text-amber-600'}`}>{tx.status}</td>
                                      <td className="px-2 py-1 text-gray-500">{tx.errcode || '—'}</td>
                                      <td className="px-2 py-1 font-mono text-gray-500">{tx.esafe_no || '—'}</td>
                                      <td className="px-2 py-1 text-gray-400">{formatTime(tx.created_at)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="text-[11px] text-gray-400">無付款紀錄</div>
                          )}
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {hasMore && !loading && (
        <div className="text-center mt-4">
          <button
            onClick={() => fetchData(nextCursor)}
            disabled={loadingMore}
            className="text-sm px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md disabled:opacity-50"
          >
            {loadingMore ? '載入中⋯' : '載入更多'}
          </button>
        </div>
      )}
    </div>
  );
}
