'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { ProgressStats, DailyRecord } from '@/types';
import { MARKET_BASE_URL } from '@/lib/market';

// v1.5.x: Pearl 三色橘漸層（跟 progress bar 一致）
const PEARL_GRADIENT = 'linear-gradient(135deg, #f7c399 0%, #e78b54 62%, #cf6e43 100%)';

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
          ? 'text-white shadow-md'
          : isCurrent
          ? 'bg-orange-100 text-orange-700 ring-2 ring-orange-400'
          : isPast && !isCompleted
          ? 'bg-red-50/40 text-red-400/70'
          : isFuture
          ? 'bg-gray-50 text-gray-300'
          : 'bg-gray-100 text-gray-400'
      }`}
      style={isCompleted ? { background: PEARL_GRADIENT } : undefined}
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
          <div className="w-10 h-10 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  // 尚未有旅程（還沒開始 21 天練習）→ 顯示空狀態，不要整頁空白
  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
        <div className="text-5xl mb-4">🌱</div>
        <h1 className="text-lg font-bold text-[#38261e] mb-2">還沒開始你的練習旅程</h1>
        <p className="text-sm text-gray-500 mb-6 max-w-xs">
          開始跟小羽對話，就會啟動你的 21 天練習，這裡會顯示每天的進度與成就。
        </p>
        <Link
          href="/chat"
          className="px-5 py-2.5 rounded-full text-white text-sm font-medium shadow-md"
          style={{ background: PEARL_GRADIENT }}
        >
          開始今日練習
        </Link>
      </div>
    );
  }

  const { journey, achievements, daily_records, completed_days, total_points, current_day } = stats;

  const recordMap = daily_records.reduce((acc, r) => {
    acc[r.day_number] = r;
    return acc;
  }, {} as Record<number, DailyRecord>);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="page-header flex items-center justify-between">
        <h1 className="font-bold text-[#38261e] text-base">我的進度</h1>
        <div className="flex gap-2">
          <Link href="/chat" className="text-xs text-orange-600 font-medium px-3 py-1 rounded-lg hover:bg-orange-50">
            返回今日
          </Link>
          <button
            onClick={async () => {
              // 清掉私版 session 後回到 NUWA（私版沒有自己的登入頁）
              await fetch('/api/auth/login', { method: 'DELETE' });
              window.location.href = MARKET_BASE_URL;
            }}
            className="text-xs text-gray-400 px-3 py-1 rounded-lg hover:bg-gray-100"
          >
            登出
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Progress Bar — Pearl 三色橘漸層 */}
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex justify-between text-sm text-gray-500 mb-2">
            <span>Day {current_day} / 21</span>
            <span className="font-medium text-orange-600">{stats.completion_rate}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${stats.completion_rate}%`,
                background: PEARL_GRADIENT,
              }}
            />
          </div>
        </div>

        {/* Journey Info — Pearl cream 底色 #fbfaf8 */}
        <div className="px-4 py-3 bg-[#fbfaf8] border-b border-gray-100 space-y-1">
          <p className="text-xs text-gray-500">關係類型：{
            journey.relationship_type === 'couple' ? '情侶' :
            journey.relationship_type === 'parent_child' ? '親子' : '職場'
          }</p>
          <p className="text-xs text-gray-500">對象：{journey.partner_nickname}</p>
          {journey.goal_statement && (
            <p className="text-xs text-gray-500">目標：{journey.goal_statement}</p>
          )}
          {/* v1.5.x 7/30（2026-08-22 從 v21 backport）：已完成的輪次要標明、避免用戶以為還在進行中
              —— /api/progress 現在會回傳「最新一輪」（可能已完成），沒有這行會誤導 */}
          {!journey.is_active && (
            <p className="pt-1 text-xs font-medium text-orange-600">
              🎉 這一輪已完成 — 想再練一輪？回聊天頁點上方「＋」
            </p>
          )}
        </div>

        {/* Stats — Pearl 暖色系（已完成/總積分 orange、徽章 amber） */}
        <div className="grid grid-cols-3 gap-3 px-4 py-4 border-b border-gray-100">
          <div className="text-center p-3 bg-orange-50 rounded-2xl">
            <p className="text-2xl font-bold text-orange-700">{completed_days}</p>
            <p className="text-xs text-gray-500 mt-1">已完成</p>
          </div>
          <div className="text-center p-3 bg-orange-50 rounded-2xl">
            <p className="text-2xl font-bold text-orange-600">{total_points}</p>
            <p className="text-xs text-gray-500 mt-1">總積分</p>
          </div>
          <div className="text-center p-3 bg-amber-50 rounded-2xl">
            <p className="text-2xl font-bold text-amber-700">{achievements.length}</p>
            <p className="text-xs text-gray-500 mt-1">徽章</p>
          </div>
        </div>

        {/* Achievements — v1.5.x：拿掉 conditional、無徽章顯示空狀態（Pearl 設計） */}
        <div className="px-4 py-4 border-b border-gray-100">
          <h2 className="font-bold text-[#38261e] mb-3">徽章</h2>
          {achievements.length > 0 ? (
            <div className="space-y-2">
              {achievements.map(a => (
                <div key={a.id} className="flex items-center justify-between bg-amber-50 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🏅</span>
                    <span className="text-sm font-medium text-amber-800">{a.badge_name}</span>
                  </div>
                  <span className="text-xs font-bold text-amber-700">+{a.points} 分</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-amber-50/50 border border-amber-100 rounded-xl px-4 py-6 text-center text-sm text-[#7d6f68]">
              還沒有徽章、繼續練習可獲得 ✨
            </div>
          )}
        </div>

        {/* 21-Day Calendar */}
        <div className="px-4 py-4">
          <h2 className="font-bold text-[#38261e] mb-3">21 天日曆</h2>
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
              <div className="w-3 h-3 rounded" style={{ background: PEARL_GRADIENT }} />
              <span>完成</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-orange-100 ring-2 ring-orange-400 rounded" />
              <span>今天</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-gray-50 rounded" />
              <span>未開始</span>
            </div>
          </div>
        </div>

        {/* Emotion Trend — v1.5.x：拿掉 conditional、無資料顯示空狀態（Pearl 設計）
            7/26 fix：bar 從 % height → pixel height（父容器無高度、% 沒基準、bar 消失）
            改用 pixel + min 4px 保證有極小可見度、chart 高度改 h-24 (96px) 給 bar 更充足空間 */}
        <div className="px-4 pb-4">
          <h2 className="font-bold text-[#38261e] mb-3">情緒趨勢</h2>
          {daily_records.filter(r => r.emotion_score).length > 0 ? (
            <div>
              <div className="flex items-end gap-1 h-24">
                {daily_records
                  .filter(r => r.emotion_score)
                  .sort((a, b) => a.day_number - b.day_number)
                  .map(r => {
                    const score = r.emotion_score || 5;
                    // score 1-10 → bar 高度 8-80px（min 8px 保證看得到、max 80 留 label 空間）
                    const barPx = Math.max(8, Math.round((score / 10) * 80));
                    return (
                      <div key={r.day_number} className="flex-1 flex flex-col items-center justify-end">
                        <div
                          className="w-full rounded-t bg-gradient-to-t from-orange-500 to-orange-300"
                          style={{ height: `${barPx}px` }}
                          title={`Day ${r.day_number}：心情 ${score}/10`}
                        />
                        <span className="text-[10px] text-gray-400 mt-1">{r.day_number}</span>
                      </div>
                    );
                  })}
              </div>
              <p className="text-[10px] text-gray-400 mt-2 text-center">
                心情分數 1-10、hover 看每天分數
              </p>
            </div>
          ) : (
            <div className="bg-orange-50/40 border border-orange-100 rounded-xl px-4 py-6 text-center text-sm text-[#7d6f68]">
              還沒有資料、練習幾天後會顯示 📈
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
