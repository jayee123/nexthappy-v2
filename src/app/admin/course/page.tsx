// 放置路徑：src/app/admin/course/page.tsx
//
// Week 5 Session 5A-1：課程內容列表（read-only）
//
// 內容：
//   - 22 day（Day 0-21）一欄式表格、依 day_number 排序
//   - 視覺分組：intro / W1 / W2 / 升維期
//   - 顯示 theme + subtitle + unit + knowledge / task 預覽
//   - 點 row 進詳情頁

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface CourseContentListItem {
  id: string;
  day_number: number;
  theme: string;
  subtitle: string | null;
  course_unit: string | null;
  knowledge_point_preview: string;
  today_task_preview: string;
  evening_questions_count: number;
  has_special_content: boolean;
  created_at: string | null;
}

interface ListResponse {
  course_days: CourseContentListItem[];
  total: number;
}

function unitGroup(unit: string | null): { label: string; cls: string } {
  if (!unit) return { label: '—', cls: 'bg-gray-50 text-gray-500' };
  if (unit === 'intro') return { label: '🌱 Intro', cls: 'bg-gray-100 text-gray-600' };
  if (unit.startsWith('W1.')) return { label: 'W1 看見對方', cls: 'bg-orange-50 text-orange-700' };
  if (unit.startsWith('W2.')) return { label: 'W2 看見自己', cls: 'bg-blue-50 text-blue-700' };
  if (unit === 'graduation') return { label: '🎓 畢業', cls: 'bg-purple-50 text-purple-700' };
  return { label: 'W3 升維', cls: 'bg-green-50 text-green-700' };
}

export default function AdminCoursePage() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/admin/course-content');
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
        <h1 className="text-2xl font-bold text-gray-800">📚 課程內容</h1>
        <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          ⚠️ {error || '查詢失敗'}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">📚 課程內容</h1>
        <p className="text-sm text-gray-500 mt-1">
          21 天課程內容（{data.total} 筆 Day 0-21）
          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700">
            目前 read-only、編輯功能 Session 5A-2 推出
          </span>
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-3 py-3 font-medium text-gray-600 w-14">Day</th>
                <th className="text-left px-3 py-3 font-medium text-gray-600 w-32">Unit</th>
                <th className="text-left px-3 py-3 font-medium text-gray-600">主題 / 副標</th>
                <th className="text-left px-3 py-3 font-medium text-gray-600">心法預覽</th>
                <th className="text-left px-3 py-3 font-medium text-gray-600">今日任務預覽</th>
                <th className="text-center px-3 py-3 font-medium text-gray-600 w-14">晚問</th>
                <th className="text-center px-3 py-3 font-medium text-gray-600 w-14">特殊</th>
                <th className="text-right px-3 py-3 font-medium text-gray-600 w-16">動作</th>
              </tr>
            </thead>
            <tbody>
              {data.course_days.map(d => {
                const group = unitGroup(d.course_unit);
                return (
                  <tr key={d.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
                    <td className="px-3 py-3 text-gray-800 font-semibold tabular-nums">
                      Day {d.day_number}
                    </td>
                    <td className="px-3 py-3">
                      <div className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${group.cls}`}>
                        {group.label}
                      </div>
                      {d.course_unit && d.course_unit !== 'intro' && (
                        <div className="text-xs text-gray-400 mt-0.5 font-mono">{d.course_unit}</div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-gray-800 font-medium">{d.theme}</div>
                      {d.subtitle && (
                        <div className="text-xs text-gray-500 mt-0.5 truncate max-w-xs" title={d.subtitle}>
                          {d.subtitle}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 max-w-xs">
                      <div className="text-xs text-gray-600 line-clamp-2" title={d.knowledge_point_preview}>
                        {d.knowledge_point_preview}{d.knowledge_point_preview.length >= 80 ? '⋯' : ''}
                      </div>
                    </td>
                    <td className="px-3 py-3 max-w-xs">
                      <div className="text-xs text-gray-600 line-clamp-2" title={d.today_task_preview}>
                        {d.today_task_preview}{d.today_task_preview.length >= 80 ? '⋯' : ''}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center text-gray-600 tabular-nums">
                      {d.evening_questions_count > 0 ? d.evening_questions_count : '—'}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {d.has_special_content ? (
                        <span className="text-green-600">✓</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <Link
                        href={`/admin/course/${d.day_number}`}
                        className="text-primary-600 hover:text-primary-700 text-xs font-medium"
                      >
                        查看
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}