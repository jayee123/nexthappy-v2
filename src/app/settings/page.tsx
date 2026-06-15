// 放置路徑：src/app/settings/page.tsx
//
// v1.3.8 新增：user 個人設定頁、可改 MBTI / 暱稱 / confidence
//
// 對應 spec v1.3.8 hotfix #8 — user 在 21 天練習中或 Mode B 諮詢中
// 發現 onboarding 時設的 MBTI 不對、可來這裡更新（不用 reset 重來）
//
// UX flow：
//   - GET /api/user/me 載入現況
//   - user 改 MBTI 4 字母 dropdown + 暱稱 input + confidence slider
//   - PATCH /api/user/me 儲存
//   - 儲存成功跳回 /chat 或顯示成功訊息

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const MBTI_LIST = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP',
];

const CONFIDENCE_LABEL: Record<string, string> = {
  low: '不太確定（憑感覺）',
  medium: '中等（測過但有疑問）',
  high: '很有把握（測過、行為符合）',
};

interface User {
  id: string;
  email: string;
  name: string | null;
  mbti_self: string | null;
  mbti_confidence: 'low' | 'medium' | 'high' | null;
  mbti_set_at: string | null;
}

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [mbti, setMbti] = useState('');
  const [confidence, setConfidence] = useState<'low' | 'medium' | 'high'>('medium');
  const [name, setName] = useState('');

  // Save state
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/user/me');
        if (res.status === 401) { router.push('/auth/login'); return; }
        const json = await res.json();
        if (!res.ok || !json.data?.user) {
          setError(json.error || '載入失敗');
          return;
        }
        const u: User = json.data.user;
        setUser(u);
        setMbti(u.mbti_self || '');
        setConfidence(u.mbti_confidence || 'medium');
        setName(u.name || '');
      } catch (err) {
        console.error('[settings/load]', err);
        setError('載入失敗');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, string> = {};
      if (mbti && mbti !== user?.mbti_self) body.mbti_self = mbti;
      if (confidence !== user?.mbti_confidence) body.mbti_confidence = confidence;
      if (name && name !== user?.name) body.name = name;

      if (Object.keys(body).length === 0) {
        setError('沒有任何修改');
        setSaving(false);
        return;
      }

      const res = await fetch('/api/user/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.data?.user) {
        setError(json.error || '儲存失敗');
        return;
      }
      setUser(json.data.user);
      setSavedAt(new Date());
    } catch (err) {
      console.error('[settings/save]', err);
      setError('儲存失敗、請稍後再試');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        載入中⋯
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-500">
        {error || '找不到使用者資料'}
      </div>
    );
  }

  const isDirty =
    (mbti && mbti !== user.mbti_self) ||
    confidence !== user.mbti_confidence ||
    (name && name !== user.name);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <Link href="/chat" className="text-gray-500 text-sm hover:text-gray-700 flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          返回
        </Link>
        <h1 className="font-bold text-gray-800 text-base">個人資料</h1>
        <div className="w-10" />{/* spacer */}
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Email（read-only）*/}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Email（不可修改）</label>
          <div className="text-sm text-gray-700 bg-gray-100 rounded-lg px-3 py-2.5">
            {user.email}
          </div>
        </div>

        {/* 暱稱 */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">你的暱稱</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="想讓小羽怎麼稱呼你？"
            maxLength={20}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
        </div>

        {/* MBTI */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">
            你的 MBTI <span className="text-primary-600">（4 字母組合）</span>
          </label>
          <div className="grid grid-cols-4 gap-2">
            {MBTI_LIST.map(code => (
              <button
                key={code}
                onClick={() => setMbti(code)}
                className={`py-2 text-sm rounded-lg border transition-all font-mono ${
                  mbti === code
                    ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-primary-300 hover:bg-primary-50'
                }`}
              >
                {code}
              </button>
            ))}
          </div>
          {user.mbti_set_at && (
            <p className="text-xs text-gray-400 mt-2">
              上次更新：{new Date(user.mbti_set_at).toLocaleDateString('zh-TW')}
            </p>
          )}
        </div>

        {/* Confidence */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">你對這個 MBTI 的把握程度</label>
          <div className="space-y-2">
            {(['low', 'medium', 'high'] as const).map(level => (
              <button
                key={level}
                onClick={() => setConfidence(level)}
                className={`w-full text-left text-sm px-3 py-2.5 rounded-lg border transition-all ${
                  confidence === level
                    ? 'bg-primary-50 text-primary-700 border-primary-300 font-medium'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {CONFIDENCE_LABEL[level]}
              </button>
            ))}
          </div>
        </div>

        {/* Save button + status */}
        <div className="pt-2">
          <button
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="w-full bg-primary-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-primary-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? '儲存中⋯' : isDirty ? '儲存修改' : '沒有修改'}
          </button>
          {savedAt && !error && (
            <p className="text-xs text-green-600 text-center mt-2">
              ✅ 已儲存（{savedAt.toLocaleTimeString('zh-TW')}）— 下次對話小羽會用新資料
            </p>
          )}
          {error && (
            <p className="text-xs text-red-500 text-center mt-2">⚠️ {error}</p>
          )}
        </div>

        {/* Hint */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700 leading-relaxed">
          提醒：若你在 21 天練習或諮詢中發現原本設的 MBTI 不太符合自己、可以隨時來這裡更新。小羽下次對話會自動用新值、不需要重新開始。
        </div>

        {/* Links */}
        <div className="flex flex-col gap-2 pt-2">
          <Link
            href="/welcome?next=/settings"
            className="text-sm text-primary-600 hover:underline text-center"
          >
            回看使用說明
          </Link>
          <Link
            href="/settings/billing"
            className="text-sm text-primary-600 hover:underline text-center"
          >
            訂閱方案管理
          </Link>
        </div>
      </div>
    </div>
  );
}
