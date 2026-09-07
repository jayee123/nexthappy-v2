// 放置路徑：src/app/admin/invites/page.tsx
//
// Week 5 Session 5E：邀請碼管理頁
//
// 功能（2026-09 改唯讀：邀請碼一律由公版發放，見金流與試用架構定案 §01/§06）：
//   - 上方統計 cards（available / used / expired）
//   - 列表：篩選 + 搜尋 + 表格（code / status / used_by / dates）
//   - Copy 邀請碼 button、載入更多 cursor pagination
//   - 批次生成與停用已移除；對應 API（POST / PATCH）回 410

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
  // Actions（2026-09：邀請碼改由公版統一發放，本頁只剩唯讀 + 複製）
  // ─────────────────────────────────────────

  function copyCode(code: string) {
    navigator.clipboard
      .writeText(code)
      .then(() => {
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(c => (c === code ? null : c)), 1500);
      })
      .catch(() => alert('複製失敗、請手動選取'));
  }


  // ─────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-800">📨 邀請碼管理</h1>
        <p className="text-sm text-gray-500 mt-1">歷史邀請碼查閱（唯讀）—— 發放與停用請至公版後台</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard label="可用" value={counts.available} cls="bg-green-50 border-green-200 text-green-800" />
        <StatCard label="已使用" value={counts.used} cls="bg-gray-50 border-gray-200 text-gray-800" />
        <StatCard label="已過期" value={counts.expired} cls="bg-amber-50 border-amber-200 text-amber-800" />
        <StatCard label="總計" value={counts.total} cls="bg-blue-50 border-blue-200 text-blue-800" />
      </div>

      {/* 2026-09 起邀請碼改由公版統一發放（金流與試用架構定案 §01/§06）。
          本頁保留唯讀查詢：既有兩組已使用碼（Steve / 子奇）的紀錄仍在這裡。 */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-5 text-sm text-amber-800">
        📨 邀請碼已改由 <span className="font-semibold">公版後台</span> 統一發放（可限定 App、在點 App 時兌換）。
        本頁僅供查閱歷史紀錄，無法再生成或停用。
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
                      {/* 唯讀：停用請至公版後台 */}
                      <span className="text-gray-300 text-xs">—</span>
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
