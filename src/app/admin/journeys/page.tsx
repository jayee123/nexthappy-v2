// 放置路徑：src/app/admin/journeys/page.tsx
//
// Week 3 Session 3A：Journey 列表頁
//
// 功能：
//   - 表格列出所有 21 天 journey
//   - Filter：全部 / 進行中 / 已完成 / 卡關 7 天 / 關係類型
//   - 搜尋 user email + name（debounce 400ms）
//   - 卡關 user 紅標籤 + amber 背景提醒
//
// 對應 spec admin-dashboard-spec-v0.1.md §3.2

'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface JourneyListItem {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string | null;
  user_mbti_self: string | null;
  round_number: number | null;
  round_label: string | null;
  partner_nickname: string | null;
  mbti_partner: string | null;
  relationship_type: string;
  current_day: number;
  is_active: boolean;
  created_at: string;
  latest_conversation_at: string | null;
  completed_days_count: number;
  days_since_last_activity: number | null;
  is_stuck: boolean;
}

type FilterType = 'all' | 'active' | 'inactive' | 'stuck';

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'active', label: '進行中' },
  { value: 'stuck', label: '⚠️ 卡關 7 天' },
  { value: 'inactive', label: '已結束' },
];

const RELATIONSHIP_OPTIONS = [
  { value: '', label: '所有關係' },
  { value: 'couple', label: '伴侶' },
  { value: 'parent_child', label: '親子' },
  { value: 'workplace', label: '職場' },
];

const RELATIONSHIP_LABEL: Record<string, string> = {
  couple: '伴侶',
  parent_child: '親子',
  workplace: '職場',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;
}

function formatLastActivity(iso: string | null, daysSince: number | null): string {
  if (!iso || daysSince === null) return '尚無';
  if (daysSince === 0) return '今天';
  if (daysSince === 1) return '昨天';
  if (daysSince <= 30) return `${daysSince} 天前`;
  return formatDate(iso);
}

export default function AdminJourneysPage() {
  const [journeys, setJourneys] = useState<JourneyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filter, setFilter] = useState<FilterType>('all');
  const [relationship, setRelationship] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  // Pagination
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const [currentCursor, setCurrentCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset pagination on filter / search change
  useEffect(() => {
    setCursorStack([]);
    setCurrentCursor(null);
  }, [search, filter, relationship]);

  const fetchJourneys = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filter !== 'all') params.set('filter', filter);
      if (relationship) params.set('relationship', relationship);
      if (currentCursor) params.set('cursor', currentCursor);
      params.set('limit', '50');

      const res = await fetch(`/api/admin/journeys?${params}`);
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || '查詢失敗');
      }
      setJourneys(json.data.journeys);
      setNextCursor(json.data.next_cursor);
      setHasMore(json.data.has_more);
    } catch (err) {
      setError(err instanceof Error ? err.message : '查詢失敗');
      setJourneys([]);
    } finally {
      setLoading(false);
    }
  }, [search, filter, relationship, currentCursor]);

  useEffect(() => {
    fetchJourneys();
  }, [fetchJourneys]);

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
  const stuckCount = journeys.filter(j => j.is_stuck).length;

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">🗺 Journey 管理</h1>
        <p className="text-sm text-gray-500 mt-1">
          查看 21 天練習 journey、找出 stuck 的 user
          {stuckCount > 0 && (
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs bg-amber-50 text-amber-700">
              ⚠️ 這頁有 {stuckCount} 個卡關
            </span>
          )}
        </p>
      </div>

      {/* Filter + Search bar */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
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
              placeholder="搜尋 user email 或 name..."
              className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-xs text-gray-500">關係：</span>
          {RELATIONSHIP_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setRelationship(opt.value)}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                relationship === opt.value
                  ? 'bg-primary-50 text-primary-700 border border-primary-300'
                  : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">User</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Round</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">對方</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">關係</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">進度</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">完成天</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">狀態</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">最後活躍</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">動作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400">載入中⋯</td></tr>
              ) : error ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-red-500">⚠️ {error}</td></tr>
              ) : journeys.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400">沒有 journey 符合條件</td></tr>
              ) : (
                journeys.map(j => (
                  <tr
                    key={j.id}
                    className={`border-b border-gray-100 hover:bg-gray-50 ${
                      j.is_stuck ? 'bg-amber-50/30' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="text-gray-800">{j.user_name || j.user_email.split('@')[0]}</div>
                      <div className="text-xs text-gray-400">{j.user_email}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      第 {j.round_number || '?'} 輪
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {j.partner_nickname || '—'}
                      {j.mbti_partner && (
                        <span className="ml-1 text-xs text-gray-400 font-mono">({j.mbti_partner})</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {RELATIONSHIP_LABEL[j.relationship_type] || j.relationship_type}
                    </td>
                    <td className="px-4 py-3 text-gray-700 tabular-nums whitespace-nowrap">
                      Day {j.current_day} / 21
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 tabular-nums">
                      {j.completed_days_count}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {j.is_stuck ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-700">
                          ⚠️ 卡關
                        </span>
                      ) : j.is_active ? (
                        <span className="text-xs text-green-700">進行中</span>
                      ) : (
                        <span className="text-xs text-gray-400">已結束</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {formatLastActivity(j.latest_conversation_at, j.days_since_last_activity)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Link
                        href={`/admin/journeys/${j.id}`}
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
            {journeys.length > 0 && `顯示 ${journeys.length} 筆`}
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