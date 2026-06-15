// 放置路徑：src/app/admin/journeys/[id]/page.tsx
//
// Week 3 Session 3B：Journey 詳情頁
//
// 內容：
//   - Breadcrumb 回到列表
//   - Overview card：user / partner / MBTI 對 / 進度 / 狀態
//   - Day 0-21 視覺 timeline：有資料 highlight、stuck 紅
//   - Day breakdown table：每天訊息數 + 首末時間
//   - 連結到 user 完整資料

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface DayBreakdown {
  day_number: number;
  message_count: number;
  first_at: string;
  last_at: string;
}

interface JourneyDetail {
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
  stats: {
    total_conversations: number;
    completed_days: number[];
    days_since_last_activity: number | null;
    latest_conversation_at: string | null;
    is_stuck: boolean;
  };
  day_breakdown: DayBreakdown[];
}

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

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const date = `${d.getMonth() + 1}/${d.getDate()}`;
  const time = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  return `${date} ${time}`;
}

export default function AdminJourneyDetailPage() {
  const params = useParams();
  const journeyId = params.id as string;

  const [detail, setDetail] = useState<JourneyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDetail() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/journeys/${journeyId}`);
        const json = await res.json();
        if (!res.ok || json.error) {
          throw new Error(json.error || '查詢失敗');
        }
        setDetail(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '查詢失敗');
      } finally {
        setLoading(false);
      }
    }
    fetchDetail();
  }, [journeyId]);

  if (loading) {
    return <div className="p-6 lg:p-8 text-gray-400">載入中⋯</div>;
  }

  if (error || !detail) {
    return (
      <div className="p-6 lg:p-8">
        <Link href="/admin/journeys" className="text-sm text-primary-600 hover:underline">
          ← 回 Journey 列表
        </Link>
        <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          ⚠️ {error || '找不到此 journey'}
        </div>
      </div>
    );
  }

  const completedSet = new Set(detail.stats.completed_days);
  const breakdownMap = new Map(detail.day_breakdown.map(d => [d.day_number, d]));
  const progressPercent = Math.round((detail.current_day / 21) * 100);

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      {/* Breadcrumb */}
      <Link href="/admin/journeys" className="text-sm text-primary-600 hover:underline">
        ← 回 Journey 列表
      </Link>

      {/* Title */}
      <div className="mt-4 mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            {detail.user_name || detail.user_email.split('@')[0]} 的 Journey
          </h1>
          <p className="text-sm text-gray-500 mt-1">{detail.user_email}</p>
        </div>
        <Link
          href={`/admin/users/${detail.user_id}`}
          className="text-sm px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md"
        >
          查看用戶完整資料 →
        </Link>
      </div>

      {/* Overview Card */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <div className="text-xs text-gray-400 mb-1">關係</div>
            <div className="text-gray-800">
              {RELATIONSHIP_LABEL[detail.relationship_type] || detail.relationship_type}
              <span className="text-xs text-gray-400 ml-2">第 {detail.round_number || '?'} 輪</span>
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1">用戶 MBTI</div>
            <div className="text-gray-800 font-mono">
              {detail.user_mbti_self || '—'}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1">對方</div>
            <div className="text-gray-800">
              {detail.partner_nickname || '—'}
              {detail.mbti_partner && (
                <span className="text-xs text-gray-400 font-mono ml-2">({detail.mbti_partner})</span>
              )}
            </div>
          </div>
        </div>

        {detail.round_label && (
          <div className="mb-4">
            <div className="text-xs text-gray-400 mb-1">本輪目標</div>
            <div className="text-gray-700 text-sm">{detail.round_label}</div>
          </div>
        )}

        {/* Progress bar */}
        <div className="mb-2">
          <div className="flex justify-between items-center mb-1">
            <div className="text-sm text-gray-600">
              進度：Day {detail.current_day} / 21
              <span className="text-xs text-gray-400 ml-2">
                ({progressPercent}%)
              </span>
            </div>
            <div className="text-xs text-gray-500">
              開始：{formatDate(detail.created_at)}
            </div>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                detail.stats.is_stuck ? 'bg-amber-400' : 'bg-primary-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Status row */}
        <div className="flex flex-wrap gap-3 items-center mt-3 text-sm">
          {detail.stats.is_stuck ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-700">
              ⚠️ 卡關 {detail.stats.days_since_last_activity} 天
            </span>
          ) : detail.is_active ? (
            <span className="text-xs text-green-700">進行中</span>
          ) : (
            <span className="text-xs text-gray-400">已結束</span>
          )}
          <span className="text-xs text-gray-500">
            最後活躍：{detail.stats.latest_conversation_at
              ? `${detail.stats.days_since_last_activity} 天前 (${formatDate(detail.stats.latest_conversation_at)})`
              : '尚無'}
          </span>
          <span className="text-xs text-gray-500">
            完成天數：{detail.stats.completed_days.length} / 21
          </span>
          <span className="text-xs text-gray-500">
            總對話：{detail.stats.total_conversations} 筆
          </span>
        </div>
      </div>

      {/* Day Timeline (Day 0-21 visual) */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-5">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Day 進度視覺</h2>
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 22 }, (_, i) => i).map(day => {
            const hasData = breakdownMap.has(day);
            const isCompleted = completedSet.has(day);
            const isCurrent = day === detail.current_day;
            const isOnboarding = day === 0;
            return (
              <div
                key={day}
                className={`w-8 h-8 rounded text-xs font-mono flex items-center justify-center border ${
                  isCurrent
                    ? 'bg-primary-500 text-white border-primary-600 font-bold'
                    : isOnboarding && hasData
                    ? 'bg-blue-50 text-blue-600 border-blue-200'
                    : isCompleted
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : 'bg-gray-50 text-gray-300 border-gray-200'
                }`}
                title={
                  isOnboarding
                    ? `Day 0 (onboarding) · ${breakdownMap.get(0)?.message_count || 0} 訊息`
                    : hasData
                    ? `Day ${day} · ${breakdownMap.get(day)?.message_count} 訊息`
                    : `Day ${day} · 未練習`
                }
              >
                {day}
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex gap-4 text-xs text-gray-500">
          <span><span className="inline-block w-3 h-3 bg-blue-50 border border-blue-200 rounded mr-1 align-middle"></span>Day 0 onboarding</span>
          <span><span className="inline-block w-3 h-3 bg-green-50 border border-green-200 rounded mr-1 align-middle"></span>已完成</span>
          <span><span className="inline-block w-3 h-3 bg-primary-500 rounded mr-1 align-middle"></span>當前 Day</span>
          <span><span className="inline-block w-3 h-3 bg-gray-50 border border-gray-200 rounded mr-1 align-middle"></span>未練習</span>
        </div>
      </div>

      {/* Day Breakdown Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <h2 className="px-5 pt-4 pb-2 text-sm font-medium text-gray-700">Day 對話明細</h2>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-y border-gray-200">
            <tr>
              <th className="text-left px-5 py-2 font-medium text-gray-600">Day</th>
              <th className="text-right px-5 py-2 font-medium text-gray-600">訊息數</th>
              <th className="text-left px-5 py-2 font-medium text-gray-600">首次</th>
              <th className="text-left px-5 py-2 font-medium text-gray-600">末次</th>
            </tr>
          </thead>
          <tbody>
            {detail.day_breakdown.length === 0 ? (
              <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-400">尚無對話資料</td></tr>
            ) : (
              detail.day_breakdown.map(d => (
                <tr key={d.day_number} className="border-b border-gray-100 last:border-b-0">
                  <td className="px-5 py-2 text-gray-800">
                    Day {d.day_number}
                    {d.day_number === 0 && (
                      <span className="ml-2 text-xs text-blue-600">(onboarding)</span>
                    )}
                  </td>
                  <td className="px-5 py-2 text-right text-gray-600 tabular-nums">
                    {d.message_count}
                  </td>
                  <td className="px-5 py-2 text-gray-500 text-xs">
                    {formatDateTime(d.first_at)}
                  </td>
                  <td className="px-5 py-2 text-gray-500 text-xs">
                    {formatDateTime(d.last_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Future actions placeholder */}
      <div className="mt-6 text-xs text-gray-400 text-center">
        💬 完整對話內容將於 Week 4「對話歷史」頁顯示
      </div>
    </div>
  );
}