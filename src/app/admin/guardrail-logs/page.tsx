// 放置路徑：src/app/admin/guardrail-logs/page.tsx
//
// 防護記錄後台頁：讀 happy.guardrail_logs（見 020_guardrail_logs.sql），
// 給人工事後審查套話風險 mid／high 的對話是不是誤判、留備註，
// 回饋給 nexthappy-config/actions.py 打磨 guardrail prompt 用。
//
// 功能：
//   - 過濾：風險等級 (全部/mid/high)、管道 (全部/chat/consultant)、審查狀態 (全部/待審查/已審查)
//   - cursor pagination
//   - 點一列展開看完整訊息 + 回覆內容，標記已審查 + 留備註

'use client';

import { useEffect, useState, useCallback } from 'react';

interface GuardrailLogItem {
  id: string;
  created_at: string;
  user_id: string | null;
  user_email: string | null;
  user_name: string | null;
  session_key: string;
  route: string;
  message: string;
  outcome: string;
  risk_tier: string;
  refusal_text: string | null;
  reviewed: boolean;
  reviewer_note: string | null;
  verdict: 'correct' | 'false_positive' | null;
}

type RiskFilter = 'all' | 'mid' | 'high';
type RouteFilter = 'all' | 'chat' | 'consultant';
type ReviewedFilter = 'all' | 'false' | 'true';

const RISK_BADGE: Record<string, { label: string; cls: string }> = {
  mid: { label: '中風險', cls: 'bg-amber-50 text-amber-700' },
  high: { label: '高風險', cls: 'bg-red-50 text-red-700' },
};

const ROUTE_BADGE: Record<string, { label: string; cls: string }> = {
  chat: { label: '晨晚間', cls: 'bg-orange-50 text-orange-700' },
  consultant: { label: 'Mode B 諮詢', cls: 'bg-purple-50 text-purple-700' },
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
  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
}

export default function AdminGuardrailLogsPage() {
  const [logs, setLogs] = useState<GuardrailLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreviewedCount, setUnreviewedCount] = useState(0);

  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');
  const [routeFilter, setRouteFilter] = useState<RouteFilter>('all');
  const [reviewedFilter, setReviewedFilter] = useState<ReviewedFilter>('false');

  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const [currentCursor, setCurrentCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    setCursorStack([]);
    setCurrentCursor(null);
  }, [riskFilter, routeFilter, reviewedFilter]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (riskFilter !== 'all') params.set('risk_tier', riskFilter);
      if (routeFilter !== 'all') params.set('route', routeFilter);
      if (reviewedFilter !== 'all') params.set('reviewed', reviewedFilter);
      if (currentCursor) params.set('cursor', currentCursor);
      params.set('limit', '50');

      const res = await fetch(`/api/admin/guardrail-logs?${params}`);
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || '查詢失敗');
      }
      setLogs(json.data.logs);
      setNextCursor(json.data.next_cursor);
      setHasMore(json.data.has_more);
      setUnreviewedCount(json.data.unreviewed_count);
    } catch (err) {
      setError(err instanceof Error ? err.message : '查詢失敗');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [riskFilter, routeFilter, reviewedFilter, currentCursor]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

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

  function toggleExpand(log: GuardrailLogItem) {
    if (expandedId === log.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(log.id);
    setNoteDrafts(prev => ({ ...prev, [log.id]: prev[log.id] ?? log.reviewer_note ?? '' }));
  }

  async function saveReview(
    log: GuardrailLogItem,
    changes: { reviewed?: boolean; verdict?: 'correct' | 'false_positive' | null }
  ) {
    const reviewed = changes.reviewed ?? log.reviewed;
    setSavingId(log.id);
    try {
      const res = await fetch(`/api/admin/guardrail-logs/${log.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewed,
          reviewer_note: noteDrafts[log.id] ?? log.reviewer_note ?? '',
          ...(changes.verdict !== undefined ? { verdict: changes.verdict } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || '更新失敗');
      }
      setLogs(prev => prev.map(l => (l.id === log.id ? json.data.log : l)));
      if (!log.reviewed && reviewed) {
        setUnreviewedCount(c => Math.max(0, c - 1));
      } else if (log.reviewed && !reviewed) {
        setUnreviewedCount(c => c + 1);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '更新失敗');
    } finally {
      setSavingId(null);
    }
  }

  const canGoPrev = cursorStack.length > 0;
  const canGoNext = hasMore;

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">🛡 防護記錄</h1>
          <p className="text-sm text-gray-500 mt-1">
            套話風險（extraction）mid／high 的對話記錄，審查是否誤判、回饋打磨 guardrail prompt
          </p>
        </div>
        {unreviewedCount > 0 && (
          <div className="px-3 py-1.5 rounded-md bg-amber-50 text-amber-700 text-sm font-medium">
            ⏳ {unreviewedCount} 筆待審查
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4 flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="flex gap-1 flex-wrap">
          {([
            { value: 'all', label: '全部風險' },
            { value: 'mid', label: '中風險' },
            { value: 'high', label: '高風險' },
          ] as { value: RiskFilter; label: string }[]).map(opt => (
            <button
              key={opt.value}
              onClick={() => setRiskFilter(opt.value)}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                riskFilter === opt.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 flex-wrap">
          {([
            { value: 'all', label: '全部管道' },
            { value: 'chat', label: '晨晚間' },
            { value: 'consultant', label: 'Mode B 諮詢' },
          ] as { value: RouteFilter; label: string }[]).map(opt => (
            <button
              key={opt.value}
              onClick={() => setRouteFilter(opt.value)}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                routeFilter === opt.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 flex-wrap">
          {([
            { value: 'false', label: '待審查' },
            { value: 'true', label: '已審查' },
            { value: 'all', label: '全部' },
          ] as { value: ReviewedFilter; label: string }[]).map(opt => (
            <button
              key={opt.value}
              onClick={() => setReviewedFilter(opt.value)}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                reviewedFilter === opt.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="px-3 py-12 text-center text-gray-400">載入中⋯</div>
        ) : error ? (
          <div className="px-3 py-12 text-center text-red-500">⚠️ {error}</div>
        ) : logs.length === 0 ? (
          <div className="px-3 py-12 text-center text-gray-400">沒有記錄符合條件</div>
        ) : (
          <ul>
            {logs.map(log => {
              const riskBadge = RISK_BADGE[log.risk_tier];
              const routeBadge = ROUTE_BADGE[log.route];
              const isExpanded = expandedId === log.id;
              return (
                <li key={log.id} className="border-b border-gray-100 last:border-b-0">
                  <button
                    onClick={() => toggleExpand(log)}
                    className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50"
                  >
                    <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs ${riskBadge?.cls ?? ''}`}>
                      {riskBadge?.label ?? log.risk_tier}
                    </span>
                    <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs ${routeBadge?.cls ?? ''}`}>
                      {routeBadge?.label ?? log.route}
                    </span>
                    <span className="flex-1 min-w-0 truncate text-sm text-gray-700" title={log.message}>
                      {log.message}
                    </span>
                    <span className="shrink-0 text-xs text-gray-400 whitespace-nowrap">
                      {log.user_name || log.user_email?.split('@')[0] || '未知使用者'}
                    </span>
                    <span className="shrink-0 text-xs text-gray-400 whitespace-nowrap">
                      {formatRelativeTime(log.created_at)}
                    </span>
                    <span
                      className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs ${
                        log.reviewed ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {log.reviewed ? '已審查' : '待審查'}
                    </span>
                    {log.verdict === 'false_positive' && (
                      <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700">
                        🔁 已回饋 AI
                      </span>
                    )}
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 bg-gray-50/60 flex flex-col gap-3">
                      <div>
                        <div className="text-xs font-medium text-gray-500 mb-1">使用者訊息原文</div>
                        <div className="text-sm text-gray-800 whitespace-pre-wrap bg-white border border-gray-200 rounded-md p-3">
                          {log.message}
                        </div>
                      </div>
                      {log.refusal_text && (
                        <div>
                          <div className="text-xs font-medium text-gray-500 mb-1">實際回覆給使用者的內容</div>
                          <div className="text-sm text-gray-800 whitespace-pre-wrap bg-white border border-gray-200 rounded-md p-3">
                            {log.refusal_text}
                          </div>
                        </div>
                      )}
                      <div className="text-xs text-gray-400">
                        outcome：{log.outcome} ・ session_key：{log.session_key}
                        {log.user_email && <> ・ {log.user_email}</>}
                      </div>
                      <div>
                        <div className="text-xs font-medium text-gray-500 mb-1">審查備註</div>
                        <textarea
                          value={noteDrafts[log.id] ?? ''}
                          onChange={e => setNoteDrafts(prev => ({ ...prev, [log.id]: e.target.value }))}
                          placeholder="例如：誤判，使用者只是想問媽媽的心理 / 判斷正確，確實在套話"
                          rows={2}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-400"
                        />
                      </div>

                      <div>
                        <div className="text-xs font-medium text-gray-500 mb-1">
                          審查結論——標「這是誤判」會真的回頭影響 AI 之後的判斷
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveReview(log, { reviewed: true, verdict: 'correct' })}
                            disabled={savingId === log.id}
                            className={`px-3 py-1.5 text-sm rounded-md disabled:opacity-50 ${
                              log.verdict === 'correct'
                                ? 'bg-green-600 text-white'
                                : 'border border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            ✅ 判斷正確
                          </button>
                          <button
                            onClick={() => saveReview(log, { reviewed: true, verdict: 'false_positive' })}
                            disabled={savingId === log.id}
                            className={`px-3 py-1.5 text-sm rounded-md disabled:opacity-50 ${
                              log.verdict === 'false_positive'
                                ? 'bg-blue-600 text-white'
                                : 'border border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            ⚠️ 這是誤判
                          </button>
                          {log.verdict && (
                            <button
                              onClick={() => saveReview(log, { verdict: null })}
                              disabled={savingId === log.id}
                              className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-600"
                            >
                              清除結論
                            </button>
                          )}
                        </div>
                        {log.verdict === 'false_positive' && (
                          <p className="text-xs text-blue-600 mt-1.5">
                            這句話會被挑進 AI 分類 prompt 的糾正範例（最多保留最近 5 筆），幾分鐘內生效。
                          </p>
                        )}
                      </div>

                      <div className="flex gap-2">
                        {!log.reviewed ? (
                          <button
                            onClick={() => saveReview(log, { reviewed: true })}
                            disabled={savingId === log.id}
                            className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                          >
                            {savingId === log.id ? '儲存中⋯' : '✓ 標記已審查'}
                          </button>
                        ) : (
                          <button
                            onClick={() => saveReview(log, { reviewed: false })}
                            disabled={savingId === log.id}
                            className="px-3 py-1.5 text-sm border border-gray-200 rounded-md hover:bg-gray-100 disabled:opacity-50"
                          >
                            {savingId === log.id ? '儲存中⋯' : '退回待審查'}
                          </button>
                        )}
                        <button
                          onClick={() => saveReview(log, {})}
                          disabled={savingId === log.id}
                          className="px-3 py-1.5 text-sm border border-gray-200 rounded-md hover:bg-gray-100 disabled:opacity-50"
                        >
                          只存備註
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Pagination */}
      {(canGoPrev || canGoNext) && (
        <div className="mt-4 flex justify-between items-center">
          <div className="text-xs text-gray-500">
            {logs.length > 0 && `顯示 ${logs.length} 筆`}
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
