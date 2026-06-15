// 放置路徑：src/app/admin/course/[day]/page.tsx
//
// Week 5 Session 5A-1：課程內容詳情頁（read-only）
// Week 5 Session 5A-2：加 edit mode（編輯 theme / subtitle / knowledge_point / today_task / evening_questions）
//
// 顯示 day 完整資料：theme / subtitle / unit / knowledge_point / today_task /
// evening_questions（list） / special_content（JSON formatted）
//
// 編輯模式（5A-2 新加）：
//   - 點「✏️ 編輯」進入編輯模式、warning banner 提醒影響 live user
//   - knowledge_point / today_task 用 textarea（多行）
//   - evening_questions：array editor 含新增、刪除、上下排序
//   - 不可編輯：day_number / course_unit / special_content（schema 結構性）
//   - Save 寫 audit log（API 自動）

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface CourseContentDetail {
  id: string;
  day_number: number;
  theme: string;
  subtitle: string | null;
  course_unit: string | null;
  knowledge_point: string;
  today_task: string;
  evening_questions: string[] | null;
  special_content: Record<string, unknown> | null;
  created_at: string | null;
}

// 編輯模式的 form state（subset of detail、不含 day_number / course_unit / special_content / id）
interface EditableFields {
  theme: string;
  subtitle: string;
  knowledge_point: string;
  today_task: string;
  evening_questions: string[];
}

function toEditable(d: CourseContentDetail): EditableFields {
  return {
    theme: d.theme,
    subtitle: d.subtitle ?? '',
    knowledge_point: d.knowledge_point,
    today_task: d.today_task,
    evening_questions: d.evening_questions ?? [],
  };
}

export default function AdminCourseDetailPage() {
  const params = useParams();
  const dayStr = params.day as string;

  const [detail, setDetail] = useState<CourseContentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 編輯模式 state
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<EditableFields | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null); // success toast timestamp

  useEffect(() => {
    async function fetchDetail() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/course-content/${dayStr}`);
        const json = await res.json();
        if (!res.ok || json.error) throw new Error(json.error || '查詢失敗');
        setDetail(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '查詢失敗');
      } finally {
        setLoading(false);
      }
    }
    fetchDetail();
  }, [dayStr]);

  // 進編輯模式：copy detail → form
  function enterEditMode() {
    if (!detail) return;
    setForm(toEditable(detail));
    setEditMode(true);
    setSaveError(null);
  }

  // 取消編輯：丟掉 form changes
  function cancelEdit() {
    setForm(null);
    setEditMode(false);
    setSaveError(null);
  }

  // 儲存：PATCH /api/admin/course-content/[day]
  async function handleSave() {
    if (!form || !detail) return;
    setSaving(true);
    setSaveError(null);
    try {
      // 過濾空 evening_question（user 加了空白行沒填）
      const cleanedQuestions = form.evening_questions
        .map(q => q.trim())
        .filter(q => q.length > 0);

      const res = await fetch(`/api/admin/course-content/${dayStr}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          theme: form.theme,
          subtitle: form.subtitle.trim() === '' ? null : form.subtitle,
          knowledge_point: form.knowledge_point,
          today_task: form.today_task,
          evening_questions: cleanedQuestions.length > 0 ? cleanedQuestions : null,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || '儲存失敗');
      setDetail(json.data);
      setEditMode(false);
      setForm(null);
      const now = Date.now();
      setSavedAt(now);
      // 3 秒後清掉 success toast（若期間又存了新版、保留新的 timestamp）
      setTimeout(() => setSavedAt(prev => (prev === now ? null : prev)), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '儲存失敗');
    } finally {
      setSaving(false);
    }
  }

  // evening_questions array editor helpers
  function updateQuestion(idx: number, value: string) {
    if (!form) return;
    const next = [...form.evening_questions];
    next[idx] = value;
    setForm({ ...form, evening_questions: next });
  }
  function addQuestion() {
    if (!form) return;
    if (form.evening_questions.length >= 10) return;
    setForm({ ...form, evening_questions: [...form.evening_questions, ''] });
  }
  function removeQuestion(idx: number) {
    if (!form) return;
    const next = form.evening_questions.filter((_, i) => i !== idx);
    setForm({ ...form, evening_questions: next });
  }
  function moveQuestion(idx: number, direction: -1 | 1) {
    if (!form) return;
    const target = idx + direction;
    if (target < 0 || target >= form.evening_questions.length) return;
    const next = [...form.evening_questions];
    [next[idx], next[target]] = [next[target], next[idx]];
    setForm({ ...form, evening_questions: next });
  }

  if (loading) return <div className="p-6 lg:p-8 text-gray-400">載入中⋯</div>;

  if (error || !detail) {
    return (
      <div className="p-6 lg:p-8">
        <Link href="/admin/course" className="text-sm text-primary-600 hover:underline">
          ← 回課程列表
        </Link>
        <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          ⚠️ {error || '找不到此 day 內容'}
        </div>
      </div>
    );
  }

  const prevDay = detail.day_number > 0 ? detail.day_number - 1 : null;
  const nextDay = detail.day_number < 21 ? detail.day_number + 1 : null;

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      {/* Breadcrumb + day navigation */}
      <div className="flex items-center justify-between mb-4">
        <Link href="/admin/course" className="text-sm text-primary-600 hover:underline">
          ← 回課程列表
        </Link>
        <div className="flex gap-2">
          {prevDay !== null && (
            <Link
              href={`/admin/course/${prevDay}`}
              className={`text-xs px-2.5 py-1 rounded ${
                editMode
                  ? 'bg-gray-50 text-gray-300 pointer-events-none'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              ← Day {prevDay}
            </Link>
          )}
          {nextDay !== null && (
            <Link
              href={`/admin/course/${nextDay}`}
              className={`text-xs px-2.5 py-1 rounded ${
                editMode
                  ? 'bg-gray-50 text-gray-300 pointer-events-none'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              Day {nextDay} →
            </Link>
          )}
        </div>
      </div>

      {/* Title + edit toggle */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl font-bold text-gray-800">Day {detail.day_number}</span>
            {detail.course_unit && (
              <span className="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-0.5 rounded">
                {detail.course_unit}
              </span>
            )}
          </div>
          {!editMode && (
            <>
              <h1 className="text-xl font-semibold text-gray-800">{detail.theme}</h1>
              {detail.subtitle && (
                <p className="text-sm text-gray-500 mt-1">{detail.subtitle}</p>
              )}
            </>
          )}
        </div>
        <div className="shrink-0">
          {!editMode ? (
            <button
              onClick={enterEditMode}
              className="text-sm px-3 py-1.5 bg-primary-600 text-white rounded-md hover:bg-primary-700"
            >
              ✏️ 編輯
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={cancelEdit}
                disabled={saving}
                className="text-sm px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="text-sm px-3 py-1.5 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? '儲存中⋯' : '💾 儲存'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Success toast */}
      {savedAt && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
          ✅ 儲存成功、變更已立即生效。
        </div>
      )}

      {/* Save error */}
      {saveError && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          ⚠️ {saveError}
        </div>
      )}

      {/* Warning banner（編輯模式才顯示） */}
      {editMode && (
        <div className="mb-5 bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          <div className="font-semibold mb-1">⚠️ 修改 Day {detail.day_number} 內容會立刻影響所有正在練這天的 user</div>
          <ul className="text-xs space-y-0.5 ml-4 list-disc text-amber-700">
            <li>建議在低活躍時段操作（凌晨）</li>
            <li>改完通知 Steve 跑一次 sanity test</li>
            <li>所有變更會記錄到 audit log（管理員 / 時間 / 改了什麼）</li>
          </ul>
        </div>
      )}

      {/* 編輯模式：theme + subtitle 也要表單化（讀模式時跟 Title 一起顯示） */}
      {editMode && form && (
        <>
          <Section title="📌 Theme（主題、必填、≤100 字）">
            <input
              type="text"
              value={form.theme}
              onChange={(e) => setForm({ ...form, theme: e.target.value })}
              maxLength={100}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-400 focus:border-primary-500 outline-none"
              placeholder="例：Day 0 — 開始你的 21 天旅程"
            />
            <div className="text-xs text-gray-400 mt-1 text-right">
              {form.theme.length} / 100
            </div>
          </Section>

          <Section title="📌 Subtitle（副標題、可選、≤200 字）">
            <input
              type="text"
              value={form.subtitle}
              onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
              maxLength={200}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-400 focus:border-primary-500 outline-none"
              placeholder="例：心法預告 + 對象設定"
            />
            <div className="text-xs text-gray-400 mt-1 text-right">
              {form.subtitle.length} / 200
            </div>
          </Section>
        </>
      )}

      {/* Knowledge point */}
      <Section title="💡 核心心法（knowledge_point）" subtitle="user 看到的當日教學內容、AI 引用">
        {editMode && form ? (
          <>
            <textarea
              value={form.knowledge_point}
              onChange={(e) => setForm({ ...form, knowledge_point: e.target.value })}
              maxLength={10000}
              rows={12}
              className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-400 focus:border-primary-500 outline-none"
              placeholder="多行內容、支援 markdown"
            />
            <div className="text-xs text-gray-400 mt-1 text-right">
              {form.knowledge_point.length} / 10000
            </div>
          </>
        ) : (
          <div className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed">
            {detail.knowledge_point}
          </div>
        )}
      </Section>

      {/* Today task */}
      <Section title="🎯 今日任務（today_task）" subtitle="AI 在 morning 開場引用、user 練習目標">
        {editMode && form ? (
          <>
            <textarea
              value={form.today_task}
              onChange={(e) => setForm({ ...form, today_task: e.target.value })}
              maxLength={5000}
              rows={8}
              className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-400 focus:border-primary-500 outline-none"
              placeholder="多行內容、支援 markdown"
            />
            <div className="text-xs text-gray-400 mt-1 text-right">
              {form.today_task.length} / 5000
            </div>
          </>
        ) : (
          <div className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed">
            {detail.today_task}
          </div>
        )}
      </Section>

      {/* Evening questions */}
      <Section
        title="🌙 晚間回顧問題（evening_questions）"
        subtitle={
          editMode && form
            ? `${form.evening_questions.length} 題（最多 10 題、每題 ≤500 字）`
            : `${(detail.evening_questions || []).length} 題、AI 在 evening 引用`
        }
      >
        {editMode && form ? (
          <div className="space-y-2">
            {form.evening_questions.length === 0 ? (
              <div className="text-sm text-gray-400">尚無問題、點下方新增</div>
            ) : (
              form.evening_questions.map((q, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-gray-400 font-medium tabular-nums shrink-0 pt-2 w-6">{i + 1}.</span>
                  <textarea
                    value={q}
                    onChange={(e) => updateQuestion(i, e.target.value)}
                    maxLength={500}
                    rows={2}
                    className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-400 focus:border-primary-500 outline-none resize-none"
                    placeholder="輸入問題內容"
                  />
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => moveQuestion(i, -1)}
                      disabled={i === 0}
                      className="text-xs px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                      title="上移"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveQuestion(i, 1)}
                      disabled={i === form.evening_questions.length - 1}
                      className="text-xs px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                      title="下移"
                    >
                      ↓
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeQuestion(i)}
                    className="text-xs px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded shrink-0 self-start"
                    title="刪除"
                  >
                    🗑
                  </button>
                </div>
              ))
            )}
            <button
              type="button"
              onClick={addQuestion}
              disabled={form.evening_questions.length >= 10}
              className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md disabled:opacity-40 disabled:cursor-not-allowed"
            >
              + 加一題
            </button>
          </div>
        ) : detail.evening_questions && detail.evening_questions.length > 0 ? (
          <ol className="space-y-2 text-sm text-gray-800">
            {detail.evening_questions.map((q, i) => (
              <li key={i} className="flex gap-3">
                <span className="text-gray-400 font-medium tabular-nums shrink-0">{i + 1}.</span>
                <span>{q}</span>
              </li>
            ))}
          </ol>
        ) : (
          <div className="text-sm text-gray-400">尚無晚間問題</div>
        )}
      </Section>

      {/* Special content（不可編輯、僅讀） */}
      <Section title="⚙️ 特殊內容（special_content）" subtitle="JSONB 結構化資料、unit 識別與其他（不可編輯）">
        {detail.special_content ? (
          <pre className="text-xs bg-gray-50 p-3 rounded border border-gray-200 overflow-x-auto text-gray-700">
            {JSON.stringify(detail.special_content, null, 2)}
          </pre>
        ) : (
          <div className="text-sm text-gray-400">無特殊內容</div>
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 lg:p-5 mb-4">
      <h2 className="text-sm font-medium text-gray-700">{title}</h2>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5 mb-3">{subtitle}</p>}
      {!subtitle && <div className="mt-3"></div>}
      {children}
    </div>
  );
}
