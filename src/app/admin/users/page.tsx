// 放置路徑：src/app/admin/users/page.tsx
//
// Week 2 Session 2A：用戶管理列表頁
//
// 功能：
//   - 表格列出所有 user（pagination 50 / page）
//   - Filter：全部 / 管理員 / 7 天活躍 / 已停權
//   - 搜尋 email + name（debounce 400ms）
//   - 「查看」link 跳 /admin/users/[id]（Week 2B 才建詳情頁、現在會 404）
//
// 對應 spec admin-dashboard-spec-v0.1.md §3.1

'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface UserListItem {
  id: string;
  email: string;
  name: string | null;
  mbti_self: string | null;
  is_admin: boolean;
  suspended_at: string | null;
  created_at: string;
  conversation_count: number;
  last_active: string | null;
  journey_current_day: number | null;
  journey_partner: string | null;
  journey_round: number | null;
}

type FilterType = 'none' | 'admin' | 'active' | 'suspended';

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: 'none', label: '全部' },
  { value: 'admin', label: '管理員' },
  { value: 'active', label: '7 天活躍' },
  { value: 'suspended', label: '已停權' },
];

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;
}

function relativeTime(iso: string | null): string {
  if (!iso) return '-';
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (day > 30) return formatDate(iso);
  if (day > 0) return `${day} 天前`;
  if (hr > 0) return `${hr} 小時前`;
  if (min > 0) return `${min} 分鐘前`;
  return '剛剛';
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter + search
  const [filter, setFilter] = useState<FilterType>('none');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState(''); // debounced

  // Pagination（cursor-based + stack 記錄歷史 cursor 給上一頁用）
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const [currentCursor, setCurrentCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset pagination when search or filter changes
  useEffect(() => {
    setCursorStack([]);
    setCurrentCursor(null);
  }, [search, filter]);

  // Fetch
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filter !== 'none') params.set('filter', filter);
      if (currentCursor) params.set('cursor', currentCursor);
      params.set('limit', '50');

      const res = await fetch(`/api/admin/users?${params}`);
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || '查詢失敗');
      }
      setUsers(json.data.users);
      setNextCursor(json.data.next_cursor);
      setHasMore(json.data.has_more);
    } catch (err) {
      setError(err instanceof Error ? err.message : '查詢失敗');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [search, filter, currentCursor]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  function goNext() {
    if (nextCursor) {
      setCursorStack([...cursorStack, currentCursor || '']);
      setCurrentCursor(nextCursor);
    }
  }

  function goPrev() {
    if (cursorStack.length > 0) {
      const newStack = [...cursorStack];
      const prev = newStack.pop()!;
      setCursorStack(newStack);
      setCurrentCursor(prev || null);
    }
  }

  const canGoPrev = cursorStack.length > 0;
  const canGoNext = hasMore;

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">👥 用戶管理</h1>
        <p className="text-sm text-gray-500 mt-1">查看 / 編輯所有 user、Mode A / B 使用狀況</p>
      </div>

      {/* Filter + Search bar */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4 flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 flex-wrap">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                filter === opt.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex-1">
          <input
            type="search"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="搜尋 email 或 name..."
            className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">MBTI</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">註冊</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">最後活躍</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">對話數</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">21 天</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">狀態</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">動作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400">載入中⋯</td></tr>
              ) : error ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-red-500">⚠️ {error}</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400">沒有 user 符合條件</td></tr>
              ) : (
                users.map(u => (
                  <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-800">{u.email}</td>
                    <td className="px-4 py-3 text-gray-600">{u.name || '-'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{u.mbti_self || '-'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{formatDate(u.created_at)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{relativeTime(u.last_active)}</td>
                    <td className="px-4 py-3 text-right text-gray-600 tabular-nums">{u.conversation_count}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {u.journey_current_day !== null ? `Day ${u.journey_current_day} / 21` : '-'}
                    </td>
                    <td className="px-4 py-3">
                      {u.suspended_at ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-red-50 text-red-700">停權</span>
                      ) : u.is_admin ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-primary-50 text-primary-700">Admin</span>
                      ) : (
                        <span className="text-xs text-gray-400">正常</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="text-primary-600 hover:text-primary-700 text-xs font-medium"
                      >
                        查看
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {(canGoPrev || canGoNext) && (
        <div className="mt-4 flex justify-between items-center">
          <div className="text-xs text-gray-500">
            {users.length > 0 && `顯示 ${users.length} 筆`}
          </div>
          <div className="flex gap-2">
            <button
              onClick={goPrev}
              disabled={!canGoPrev || loading}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← 上一頁
            </button>
            <button
              onClick={goNext}
              disabled={!canGoNext || loading}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              下一頁 →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}