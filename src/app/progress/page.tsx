'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { ProgressStats, DailyRecord } from '@/types';

function DayCell({ dayNum, record, current }: {
  dayNum: number;
  record?: DailyRecord;
  current: number;
}) {
  const isCompleted = record?.task_completed;
  const isCurrent = dayNum === current;
  const isPast = dayNum < current;
  const isFuture = dayNum > current;

  return (
    <div
      className={`aspect-square rounded-xl flex items-center justify-center text-sm font-medium transition-all ${
        isCompleted
          ? 'bg-primary-600 text-white shadow-md'
          : isCurrent
          ? 'bg-primary-100 text-primary-700 ring-2 ring-primary-400'
          : isPast && !isCompleted
          ? 'bg-red-50 text-red-400'
          : isFuture
          ? 'bg-gray-50 text-gray-300'
          : 'bg-gray-100 text-gray-400'
      }`}
    >
      {dayNum}
    </div>
  );
}

export default function ProgressPage() {
  const router = useRouter();
  const [stats, setStats] = useState<ProgressStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProgress() {
      try {
        const res = await fetch('/api/progress');
        if (res.status === 401) { router.push('/auth/login'); return; }

        const json = await res.json();
        if (json.data?.stats) {
          setStats(json.data.stats);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadProgress();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const { journey, achievements, daily_records, completed_days, total_points, current_day } = stats;

  const recordMap = daily_records.reduce((acc, r) => {
    acc[r.day_number] = r;
    return acc;
  }, {} as Record<number, DailyRecord>);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="page-header flex items-center justify-between">
        <h1 className="font-bold text-gray-800 text-base">我的進度</h1>
        <div className="flex gap-2">
          <Link href="/chat" className="text-xs text-primary-600 font-medium px-3 py-1 rounded-lg hover:bg-primary-50">
            返回今日
          </Link>
          <button
            onClick={async () => {
              await fetch('/api/auth/login', { method: 'DELETE' });
              router.push('/auth/login');
            }}
            className="text-xs text-gray-400 px-3 py-1 rounded-lg hover:bg-gray-100"
          >
            登出
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Progress Bar */}
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex justify-between text-sm text-gray-500 mb-2">
            <span>Day {current_day} / 21</span>
            <span className="font-medium text-primary-600">{stats.completion_rate}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-600 rounded-full transition-all duration-500"
              style={{ width: `${stats.completion_rate}%` }}
            />
          </div>
        </div>

        {/* Journey Info */}
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 space-y-1">
          <p className="text-xs text-gray-500">關係類型：{
            journey.relationship_type === 'couple' ? '情侶' :
            journey.relationship_type === 'parent_child' ? '親子' : '職場'
          }</p>
          <p className="text-xs text-gray-500">對象：{journey.partner_nickname}</p>
          {journey.goal_statement && (
            <p className="text-xs text-gray-500">目標：{journey.goal_statement}</p>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 px-4 py-4 border-b border-gray-100">
          <div className="text-center p-3 bg-primary-50 rounded-2xl">
            <p className="text-2xl font-bold text-primary-700">{completed_days}</p>
            <p className="text-xs text-gray-500 mt-1">已完成</p>
          </div>
          <div className="text-center p-3 bg-orange-50 rounded-2xl">
            <p className="text-2xl font-bold text-orange-600">{total_points}</p>
            <p className="text-xs text-gray-500 mt-1">總積分</p>
          </div>
          <div className="text-center p-3 bg-yellow-50 rounded-2xl">
            <p className="text-2xl font-bold text-yellow-600">{achievements.length}</p>
            <p className="text-xs text-gray-500 mt-1">徽章</p>
          </div>
        </div>

        {/* Achievements */}
        {achievements.length > 0 && (
          <div className="px-4 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-700 mb-3">徽章</h2>
            <div className="space-y-2">
              {achievements.map(a => (
                <div key={a.id} className="flex items-center justify-between bg-yellow-50 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🏅</span>
                    <span className="text-sm font-medium text-yellow-800">{a.badge_name}</span>
                  </div>
                  <span className="text-xs font-bold text-yellow-600">+{a.points} 分</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 21-Day Calendar */}
        <div className="px-4 py-4">
          <h2 className="font-bold text-gray-700 mb-3">21 天日曆</h2>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 21 }, (_, i) => i + 1).map(day => (
              <DayCell
                key={day}
                dayNum={day}
                record={recordMap[day]}
                current={current_day}
              />
            ))}
          </div>

          {/* Legend */}
          <div className="mt-4 flex gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-primary-600 rounded" />
              <span>完成</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-primary-100 ring-2 ring-primary-400 rounded" />
              <span>今天</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-gray-50 rounded" />
              <span>未開始</span>
            </div>
          </div>
        </div>

        {/* Emotion Trend */}
        {daily_records.filter(r => r.emotion_score).length > 0 && (
          <div className="px-4 pb-4">
            <h2 className="font-bold text-gray-700 mb-3">情緒趨勢</h2>
            <div className="flex items-end gap-1 h-20">
              {daily_records.filter(r => r.emotion_score).map(r => (
                <div key={r.day_number} className="flex-1 flex flex-col items-center">
                  <div
                    className="w-full bg-primary-400 rounded-t"
                    style={{ height: `${((r.emotion_score || 5) / 10) * 100}%` }}
                  />
                  <span className="text-xs text-gray-400 mt-1">{r.day_number}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
