// 放置路徑：src/app/admin/conversations/page.tsx
//
// Week 4 Session 4A：對話歷史列表頁
//
// 功能：
//   - 過濾：context_type (全部/晨間/晚間/諮詢)、user 搜尋、Day 篩選
//   - cursor pagination
//   - 表格：類型 / Day / User / 主題 / 訊息數 / 預覽 / 時間 / 查看
//   - Mode B 諮詢 row 用淡紫底色區分

'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface ConversationListItem {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string | null;
  journey_id: string | null;
  day_number: number;
  context_type: string | null;
  topic_title: string | null;
  message_count: number;
  first_user_message_preview: string;
  created_at: string;
  archived_at: string | null;
}

type ContextFilter = 'all' | 'morning' | 'evening' | 'consultant';

const CONTEXT_FILTERS: { value: ContextFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'morning', label: '🌅 晨間練習' },
  { value: 'evening', label: '🌙 晚間回顧' },
  { value: 'consultant', label: '💬 Mode B 諮詢' },
];

const CONTEXT_BADGE: Record<string, { label: string; cls: string }> = {
  morning: { label: '晨', cls: 'bg-orange-50 text-orange-700' },
  evening: { label: '晚', cls: 'bg-indigo-50 text-indigo-700' },
  consultant: { label: '諮', cls: 'bg-purple-50 text-purple-700' },
};

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  if (diffDays === 0) return `今天 ${hh}:${mm}`;
  if (diffDays === 1) return `昨天 ${hh}:${mm}`;
  if (diffDays <= 7) return `${diffDays} 天前`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function AdminConversationsPage() {
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [contextFilter, setContextFilter] = useState<ContextFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [dayFilter, setDayFilter] = useState<string>('');

  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const [currentCursor, setCurrentCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setCursorStack([]);
    setCurrentCursor(null);
  }, [search, contextFilter, dayFilter]);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (contextFilter !== 'all') params.set('context_type', contextFilter);
      if (dayFilter !== '') params.set('day_number', dayFilter);
      if (currentCursor) params.set('cursor', currentCursor);
      params.set('limit', '50');

      const res = await fetch(`/api/admin/conversations?${params}`);
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || '查詢失敗');
      }
      setConversations(json.data.conversations);
      setNextCursor(json.data.next_cursor);
      setHasMore(json.data.has_more);
    } catch (err) {
      setError(err instanceof Error ? err.message : '查詢失敗');
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [search, contextFilter, dayFilter, currentCursor]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">💬 對話歷史</h1>
        <p className="text-sm text-gray-500 mt-1">
          查看所有 user 與 AI 的對話、debug AI 品質、找盲點模式
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex gap-1 flex-wrap">
            {CONTEXT_FILTERS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setContextFilter(opt.value)}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  contextFilter === opt.value
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
          <span className="text-xs text-gray-500">Day：</span>
          <select
            value={dayFilter}
            onChange={e => setDayFilter(e.target.value)}
            className="px-2 py-1 text-xs border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-primary-400"
          >
            <option value="">全部</option>
            <option value="0">Day 0 (onboarding)</option>
            {Array.from({ length: 21 }, (_, i) => i + 1).map(n => (
              <option key={n} value={String(n)}>Day {n}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-3 py-3 font-medium text-gray-600 w-14">類型</th>
                <th className="text-left px-3 py-3 font-medium text-gray-600 w-16">Day</th>
                <th className="text-left px-3 py-3 font-medium text-gray-600">User</th>
                <th className="text-left px-3 py-3 font-medium text-gray-600">主題 / 預覽</th>
                <th className="text-right px-3 py-3 font-medium text-gray-600 w-16">訊息</th>
                <th className="text-left px-3 py-3 font-medium text-gray-600 w-28">時間</th>
                <th className="text-right px-3 py-3 font-medium text-gray-600 w-16">動作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-3 py-12 text-center text-gray-400">載入中⋯</td></tr>
              ) : error ? (
                <tr><td colSpan={7} className="px-3 py-12 text-center text-red-500">⚠️ {error}</td></tr>
              ) : conversations.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-12 text-center text-gray-400">沒有對話符合條件</td></tr>
              ) : (
                conversations.map(c => {
                  const badge = c.context_type ? CONTEXT_BADGE[c.context_type] : null;
                  const isConsultant = c.context_type === 'consultant';
                  return (
                    <tr
                      key={c.id}
                      className={`border-b border-gray-100 hover:bg-gray-50 ${
                        isConsultant ? 'bg-purple-50/30' : ''
                      }`}
                    >
                      <td className="px-3 py-3">
                        {badge ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${badge.cls}`}>
                            {badge.label}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-gray-700 tabular-nums whitespace-nowrap">
                        Day {c.day_number}
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-gray-800 text-sm">{c.user_name || c.user_email.split('@')[0]}</div>
                        <div className="text-xs text-gray-400">{c.user_email}</div>
                      </td>
                      <td className="px-3 py-3 max-w-md">
                        {c.topic_title && (
                          <div className="text-gray-700 text-sm truncate" title={c.topic_title}>
                            {c.topic_title}
                          </div>
                        )}
                        <div
                          className="text-xs text-gray-400 truncate"
                          title={c.first_user_message_preview}
                        >
                          {c.first_user_message_preview || '(無預覽)'}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right text-gray-600 tabular-nums">
                        {c.message_count}
                      </td>
                      <td className="px-3 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {formatRelativeTime(c.created_at)}
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <Link
                          href={`/admin/conversations/${c.id}`}
                          className="text-primary-600 hover:text-primary-700 text-xs font-medium"
                        >
                          查看
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {(canGoPrev || canGoNext) && (
        <div className="mt-4 flex justify-between items-center">
          <div className="text-xs text-gray-500">
            {conversations.length > 0 && `顯示 ${conversations.length} 筆`}
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