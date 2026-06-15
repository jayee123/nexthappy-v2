// 放置路徑：src/app/admin/topics/page.tsx
//
// 諮詢主題頁：聚合 Mode B 對話 + Top 50 keywords cloud
//
// 內容：
//   - 3 個 stats cards
//   - Top 50 keywords cloud（依 count 變大小）
//   - Topics list 表格（點 row 進對話詳情）

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Topic {
  topic_title: string;
  conversation_count: number;
  unique_user_count: number;
  total_messages: number;
  first_conv_id: string;
  first_user_email: string;
  first_user_name: string | null;
  first_at: string;
  last_at: string;
  archived_count: number;
}

interface Keyword {
  keyword: string;
  count: number;
}

interface TopicsData {
  total_conversations: number;
  total_unique_topics: number;
  topics: Topic[];
  top_keywords: Keyword[];
}

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  if (diffDays === 0) return `今天 ${hh}:${mm}`;
  if (diffDays === 1) return `昨天 ${hh}:${mm}`;
  if (diffDays <= 7) return `${diffDays} 天前`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function AdminTopicsPage() {
  const [data, setData] = useState<TopicsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/admin/topics');
        const json = await res.json();
        if (!res.ok || json.error) throw new Error(json.error || '查詢失敗');
        setData(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '查詢失敗');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <div className="p-6 lg:p-8 text-gray-400">載入中⋯</div>;

  if (error || !data) {
    return (
      <div className="p-6 lg:p-8">
        <h1 className="text-2xl font-bold text-gray-800">📁 諮詢主題</h1>
        <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          ⚠️ {error || '查詢失敗'}
        </div>
      </div>
    );
  }

  const { total_conversations, total_unique_topics, topics, top_keywords } = data;
  const maxKwCount = Math.max(1, ...top_keywords.map(k => k.count));

  // Keyword font size: smallest 0.85rem, biggest 1.6rem
  function kwFontSize(count: number): string {
    const ratio = count / maxKwCount;
    return `${(0.85 + ratio * 0.75).toFixed(2)}rem`;
  }

  // Keyword color tier
  function kwColorClass(count: number): string {
    const ratio = count / maxKwCount;
    if (ratio >= 0.7) return 'bg-purple-100 text-purple-800 border-purple-200';
    if (ratio >= 0.4) return 'bg-blue-50 text-blue-700 border-blue-200';
    return 'bg-gray-50 text-gray-600 border-gray-200';
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">📁 諮詢主題</h1>
        <p className="text-sm text-gray-500 mt-1">
          Mode B「我卡住、幫我拆」topics 聚合 + Top keywords 統計
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-xs text-gray-500 mb-1">總諮詢對話</div>
          <div className="text-2xl font-bold text-gray-800">{total_conversations}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-xs text-gray-500 mb-1">unique 主題數</div>
          <div className="text-2xl font-bold text-gray-800">{total_unique_topics}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-xs text-gray-500 mb-1">關鍵字種類</div>
          <div className="text-2xl font-bold text-gray-800">{top_keywords.length}</div>
          <div className="text-xs text-gray-400 mt-1">展示 Top {Math.min(50, top_keywords.length)}</div>
        </div>
      </div>

      {/* Top keywords cloud */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-5">
        <h2 className="text-sm font-medium text-gray-700 mb-1">
          🔥 Top {Math.min(50, top_keywords.length)} 關鍵字 — user 最常卡的問題
        </h2>
        <p className="text-xs text-gray-400 mb-3">
          自動從 topic_title 用「、」分隔抽取（紫色 = 高頻、藍色 = 中頻、灰色 = 低頻）
        </p>
        {top_keywords.length === 0 ? (
          <div className="text-center text-gray-400 py-6">尚無關鍵字</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {top_keywords.map(k => (
              <span
                key={k.keyword}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${kwColorClass(k.count)}`}
                style={{ fontSize: kwFontSize(k.count) }}
                title={`${k.keyword}: ${k.count} 次`}
              >
                {k.keyword}
                <span className="text-xs opacity-60 tabular-nums">×{k.count}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Topics list */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-5 pt-4 pb-2 border-b border-gray-200">
          <h2 className="text-sm font-medium text-gray-700">
            📋 諮詢主題列表（依最後活躍排序）
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">主題</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-32">最新 User</th>
                <th className="text-right px-3 py-3 font-medium text-gray-600 w-16">對話</th>
                <th className="text-right px-3 py-3 font-medium text-gray-600 w-16">User</th>
                <th className="text-right px-3 py-3 font-medium text-gray-600 w-16">訊息</th>
                <th className="text-left px-3 py-3 font-medium text-gray-600 w-24">最後活躍</th>
                <th className="text-right px-3 py-3 font-medium text-gray-600 w-16">動作</th>
              </tr>
            </thead>
            <tbody>
              {topics.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-12 text-center text-gray-400">尚無諮詢主題</td></tr>
              ) : (
                topics.map(t => (
                  <tr key={t.first_conv_id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
                    <td className="px-4 py-3 max-w-md">
                      <div className="text-gray-800 text-sm truncate" title={t.topic_title}>
                        {t.topic_title}
                      </div>
                      {t.archived_count > 0 && (
                        <div className="text-xs text-gray-400 mt-0.5">
                          含 {t.archived_count} 則已歸檔
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-700 text-sm">
                        {t.first_user_name || t.first_user_email.split('@')[0]}
                      </div>
                      <div className="text-xs text-gray-400 truncate" title={t.first_user_email}>
                        {t.first_user_email}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right text-gray-700 tabular-nums">
                      {t.conversation_count}
                    </td>
                    <td className="px-3 py-3 text-right text-gray-700 tabular-nums">
                      {t.unique_user_count}
                    </td>
                    <td className="px-3 py-3 text-right text-gray-600 tabular-nums">
                      {t.total_messages}
                    </td>
                    <td className="px-3 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {formatRelativeTime(t.last_at)}
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <Link
                        href={`/admin/conversations/${t.first_conv_id}`}
                        className="text-primary-600 hover:text-primary-700 text-xs font-medium"
                      >
                        最新 →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}