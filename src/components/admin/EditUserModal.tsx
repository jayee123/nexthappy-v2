// 放置路徑：src/components/admin/EditUserModal.tsx
//
// Week 2 Session 2C：編輯 user modal
//
// 用法（在詳情頁）：
//   <EditUserModal
//     user={user}
//     onClose={() => setShowEdit(false)}
//     onSaved={updatedUser => { ... refresh detail }}
//   />
//
// 可改欄位：name / mbti_self / mbti_confidence / is_admin
// 內部呼叫 PATCH /api/admin/users/[id]、寫 audit log

'use client';

import { useState } from 'react';

const MBTI_LIST = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP',
];

const CONFIDENCE_OPTIONS = [
  { value: 'low', label: '不太確定（憑感覺）' },
  { value: 'medium', label: '中等（測過但有疑問）' },
  { value: 'high', label: '很有把握（測過、行為符合）' },
];

interface EditableUser {
  id: string;
  email: string;
  name: string | null;
  mbti_self: string | null;
  mbti_confidence: string | null;
  is_admin: boolean;
}

interface Props {
  user: EditableUser;
  isSelfAdmin: boolean; // 是否是 admin 本人（防自鎖：不可把自己 is_admin 改成 false）
  onClose: () => void;
  onSaved: (updatedUser: EditableUser) => void;
}

export default function EditUserModal({ user, isSelfAdmin, onClose, onSaved }: Props) {
  const [name, setName] = useState(user.name || '');
  const [mbti, setMbti] = useState(user.mbti_self || '');
  const [confidence, setConfidence] = useState(user.mbti_confidence || 'medium');
  const [isAdmin, setIsAdmin] = useState(user.is_admin);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);

    try {
      // 只把有改動的欄位送過去
      const body: Record<string, unknown> = {};
      if (name.trim() !== (user.name || '')) body.name = name.trim();
      if (mbti !== (user.mbti_self || '')) body.mbti_self = mbti;
      if (confidence !== (user.mbti_confidence || '')) body.mbti_confidence = confidence;
      if (isAdmin !== user.is_admin) body.is_admin = isAdmin;

      if (Object.keys(body).length === 0) {
        setError('沒有任何修改');
        setSaving(false);
        return;
      }

      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || '儲存失敗');
      }
      onSaved(json.data.user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '儲存失敗');
    } finally {
      setSaving(false);
    }
  }

  const isDirty =
    name.trim() !== (user.name || '') ||
    mbti !== (user.mbti_self || '') ||
    confidence !== (user.mbti_confidence || '') ||
    isAdmin !== user.is_admin;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">編輯用戶</h2>
          <button
            onClick={onClose}
            disabled={saving}
            className="text-gray-400 hover:text-gray-600 text-xl w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 disabled:opacity-40"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Email (read-only) */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Email（不可修改）</label>
            <div className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">
              {user.email}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">暱稱</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="user 暱稱"
              maxLength={50}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>

          {/* MBTI */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">MBTI（4 字母）</label>
            <div className="grid grid-cols-4 gap-1.5">
              {MBTI_LIST.map(code => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setMbti(code)}
                  className={`py-1.5 text-xs rounded border transition-all font-mono ${
                    mbti === code
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-primary-300 hover:bg-primary-50'
                  }`}
                >
                  {code}
                </button>
              ))}
            </div>
          </div>

          {/* Confidence */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">MBTI 把握度</label>
            <div className="space-y-1.5">
              {CONFIDENCE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setConfidence(opt.value)}
                  className={`w-full text-left text-sm px-3 py-2 rounded border transition-all ${
                    confidence === opt.value
                      ? 'bg-primary-50 text-primary-700 border-primary-300 font-medium'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* is_admin */}
          <div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={isAdmin}
                onChange={e => setIsAdmin(e.target.checked)}
                disabled={isSelfAdmin && user.is_admin}
                className="w-4 h-4 accent-primary-600"
              />
              <span className="text-gray-700">設為後台管理員（is_admin = true）</span>
            </label>
            {isSelfAdmin && user.is_admin && (
              <p className="mt-1 ml-6 text-xs text-amber-600">⚠️ 不可降自己的 admin 權限（防自鎖）</p>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-1.5 text-sm border border-gray-200 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-40"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="px-4 py-1.5 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            {saving ? '儲存中⋯' : isDirty ? '儲存' : '無修改'}
          </button>
        </div>
      </div>
    </div>
  );
}