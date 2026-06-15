// 放置路徑：src/app/admin/invites/page.tsx
//
// Week 5 Session 5E：邀請碼管理頁
//
// 功能：
//   - 上方統計 cards（available / used / expired）
//   - 「批次生成」form（prefix + count + expires_in_days）
//   - 列表：篩選 + 搜尋 + 表格（code / status / used_by / dates / 動作）
//   - 動作：停用（available 狀態才可、設 expires_at = NOW）
//   - Copy 邀請碼 button
//   - 載入更多 cursor pagination

'use client';

import { useCallback, useEffect, useState } from 'react';

// ============================================================
// Types
// ============================================================

type InviteStatus = 'available' | 'used' | 'expired';

interface InviteListItem {
  code: string;
  status: InviteStatus;
  used_by_user_id: string | null;
  used_by_email: string | null;
  used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

interface InviteCounts {
  available: number;
  used: number;
  expired: number;
  total: number;
}

type StatusFilter = 'all' | InviteStatus;

const STATUS_META: Record<InviteStatus, { label: string; cls: string }> = {
  available: { label: '可用', cls: 'bg-green-50 text-green-700 border-green-200' },
  used: { label: '已使用', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
  expired: { label: '已過期', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
};

const EXPIRY_OPTIONS = [
  { value: 7, label: '7 天' },
  { value: 30, label: '30 天' },
  { value: 90, label: '90 天' },
  { value: 180, label: '6 個月' },
  { value: 365, label: '1 年' },
  { value: 0, label: '永不過期' },
];

// ============================================================
// Util
// ============================================================

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateOnly(iso: string | null): string {
  if (!iso) return '永不過期';
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

// ============================================================
// Main
// ============================================================

export default function AdminInvitesPage() {
  const [invites, setInvites] = useState<InviteListItem[]>([]);
  const [counts, setCounts] = useState<InviteCounts>({ available: 0, used: 0, expired: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  // Create form
  const [createPrefix, setCreatePrefix] = useState('INTERNAL-TEST');
  const [createCount, setCreateCount] = useState(10);
  const [createExpiresInDays, setCreateExpiresInDays] = useState(180);
  const [creating, setCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState<
    { type: 'success'; codes: string[] } | { type: 'error'; text: string } | null
  >(null);

  // Revoke
  const [revoking, setRevoking] = useState<string | null>(null);

  // Copy feedback
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim().toUpperCase()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchInvites = useCallback(
    async (cursor: string | null = null) => {
      if (cursor) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (statusFilter !== 'all') params.set('status', statusFilter);
        if (search) params.set('search', search);
        if (cursor) params.set('cursor', cursor);
        params.set('limit', '50');

        const res = await fetch(`/api/admin/invites?${params}`);
        const json = await res.json();
        if (!res.ok || json.error) throw new Error(json.error || '查詢失敗');

        if (cursor) {
          setInvites(prev => [...prev, ...json.data.invites]);
        } else {
          setInvites(json.data.invites);
          setCounts(json.data.counts);
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
    [statusFilter, search]
  );

  // 篩選變動時重抓
  useEffect(() => {
    fetchInvites(null);
  }, [fetchInvites]);

  // ─────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    setCreateMessage(null);
    try {
      const res = await fetch('/api/admin/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prefix: createPrefix,
          count: createCount,
          expires_in_days: createExpiresInDays === 0 ? null : createExpiresInDays,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || '生成失敗');

      setCreateMessage({ type: 'success', codes: json.data.codes });
      // 重新撈列表（不顯示 loading 因為已經有資料）
      fetchInvites(null);
    } catch (err) {
      setCreateMessage({ type: 'error', text: err instanceof Error ? err.message : '生成失敗' });
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(code: string) {
    if (revoking) return;
    if (!confirm(`確認停用邀請碼「${code}」？停用後該碼立即失效、無法用於註冊。`)) return;
    setRevoking(code);
    try {
      const res = await fetch(`/api/admin/invites/${encodeURIComponent(code)}`, {
        method: 'PATCH',
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || '停用失敗');
      fetchInvites(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : '停用失敗');
    } finally {
      setRevoking(null);
    }
  }

  function copyCode(code: string) {
    navigator.clipboard
      .writeText(code)
      .then(() => {
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(c => (c === code ? null : c)), 1500);
      })
      .catch(() => alert('複製失敗、請手動選取'));
  }

  function copyAllNewCodes() {
    if (!createMessage || createMessage.type !== 'success') return;
    navigator.clipboard
      .writeText(createMessage.codes.join('\n'))
      .then(() => {
        setCopiedCode('__all__');
        setTimeout(() => setCopiedCode(c => (c === '__all__' ? null : c)), 1500);
      })
      .catch(() => alert('複製失敗'));
  }

  // ─────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-800">📨 邀請碼管理</h1>
        <p className="text-sm text-gray-500 mt-1">批次生成邀請碼、追蹤使用狀態、撤銷未使用的碼</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard label="可用" value={counts.available} cls="bg-green-50 border-green-200 text-green-800" />
        <StatCard label="已使用" value={counts.used} cls="bg-gray-50 border-gray-200 text-gray-800" />
        <StatCard label="已過期" value={counts.expired} cls="bg-amber-50 border-amber-200 text-amber-800" />
        <StatCard label="總計" value={counts.total} cls="bg-blue-50 border-blue-200 text-blue-800" />
      </div>

      {/* Create form */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">➕ 批次生成邀請碼</h2>
        <form onSubmit={handleCreate} className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs text-gray-500 mb-1">Prefix（前綴）</label>
            <input
              type="text"
              value={createPrefix}
              onChange={e => setCreatePrefix(e.target.value)}
              disabled={creating}
              maxLength={30}
              placeholder="例：BETA-2026"
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-400 focus:border-primary-500 outline-none uppercase disabled:bg-gray-50"
            />
            <div className="text-xs text-gray-400 mt-0.5">英文字母 / 數字 / 橫線、3-30 字</div>
          </div>
          <div className="w-24">
            <label className="block text-xs text-gray-500 mb-1">數量</label>
            <input
              type="number"
              value={createCount}
              onChange={e => setCreateCount(parseInt(e.target.value, 10) || 1)}
              disabled={creating}
              min={1}
              max={100}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-400 focus:border-primary-500 outline-none disabled:bg-gray-50"
            />
            <div className="text-xs text-gray-400 mt-0.5">1-100</div>
          </div>
          <div className="w-32">
            <label className="block text-xs text-gray-500 mb-1">有效期</label>
            <select
              value={createExpiresInDays}
              onChange={e => setCreateExpiresInDays(parseInt(e.target.value, 10))}
              disabled={creating}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-400 focus:border-primary-500 outline-none bg-white disabled:bg-gray-50"
            >
              {EXPIRY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={creating || createPrefix.trim() === ''}
            className="px-4 py-1.5 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? '生成中⋯' : '生成'}
          </button>
        </form>

        {/* Create result */}
        {createMessage?.type === 'success' && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-green-800">
                ✅ 已生成 {createMessage.codes.length} 個邀請碼
              </div>
              <button
                onClick={copyAllNewCodes}
                className="text-xs px-2 py-1 bg-white border border-green-300 text-green-700 rounded hover:bg-green-50"
              >
                {copiedCode === '__all__' ? '✓ 已複製' : '📋 複製全部'}
              </button>
            </div>
            <div className="text-xs font-mono text-green-700 bg-white border border-green-200 rounded p-2 max-h-32 overflow-y-auto">
              {createMessage.codes.map(c => (
                <div key={c}>{c}</div>
              ))}
            </div>
            <p className="text-xs text-green-700 mt-2">
              💡 一個碼只能用一次、請私訊發給 tester（避免公開外流）
            </p>
          </div>
        )}
        {createMessage?.type === 'error' && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            ⚠️ {createMessage.text}
          </div>
        )}
      </div>

      {/* Filter + search */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4 flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 flex-wrap">
          <FilterButton active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
            全部 ({counts.total})
          </FilterButton>
          <FilterButton
            active={statusFilter === 'available'}
            onClick={() => setStatusFilter('available')}
          >
            可用 ({counts.available})
          </FilterButton>
          <FilterButton active={statusFilter === 'used'} onClick={() => setStatusFilter('used')}>
            已使用 ({counts.used})
          </FilterButton>
          <FilterButton
            active={statusFilter === 'expired'}
            onClick={() => setStatusFilter('expired')}
          >
            已過期 ({counts.expired})
          </FilterButton>
        </div>
        <div className="flex-1 min-w-[200px]">
          <input
            type="search"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="搜尋邀請碼（譬如 BETA-2026）"
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
        ) : invites.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">沒有符合條件的邀請碼</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-600">邀請碼</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600 w-24">狀態</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">使用者</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600 w-36">使用 / 過期時間</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600 w-36">建立時間</th>
                <th className="text-right px-3 py-2 font-medium text-gray-600 w-28">動作</th>
              </tr>
            </thead>
            <tbody>
              {invites.map(inv => {
                const meta = STATUS_META[inv.status];
                return (
                  <tr key={inv.code} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-sm text-gray-800">{inv.code}</code>
                        <button
                          onClick={() => copyCode(inv.code)}
                          className="text-[10px] px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded transition-colors"
                          title="複製"
                        >
                          {copiedCode === inv.code ? '✓' : '📋'}
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] border ${meta.cls}`}
                      >
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-700 text-xs">
                      {inv.used_by_email || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-500">
                      {inv.status === 'used' ? (
                        <span title={inv.used_at || ''}>使用：{formatTime(inv.used_at)}</span>
                      ) : (
                        <span title={inv.expires_at || ''}>過期：{formatDateOnly(inv.expires_at)}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-500">
                      {formatTime(inv.created_at)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {inv.status === 'available' ? (
                        <button
                          onClick={() => handleRevoke(inv.code)}
                          disabled={revoking === inv.code}
                          className="text-xs px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded disabled:opacity-50"
                        >
                          {revoking === inv.code ? '處理中⋯' : '停用'}
                        </button>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Load more */}
      {hasMore && !loading && (
        <div className="text-center mt-4">
          <button
            onClick={() => fetchInvites(nextCursor)}
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

// ============================================================
// Sub components
// ============================================================

function StatCard({
  label,
  value,
  cls,
}: {
  label: string;
  value: number;
  cls: string;
}) {
  return (
    <div className={`border rounded-lg p-3 ${cls}`}>
      <div className="text-xs opacity-70">{label}</div>
      <div className="text-2xl font-bold mt-1 tabular-nums">{value.toLocaleString()}</div>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-xs rounded-md transition-colors ${
        active ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {children}
    </button>
  );
}
