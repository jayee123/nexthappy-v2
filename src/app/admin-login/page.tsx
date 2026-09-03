// 放置路徑：src/app/admin-login/page.tsx
//
// 管理者專用登入頁，跟一般使用者的 NUWA 登入完全分開。
// 刻意放在 /admin-login（不是 /admin/login）—— /admin 底下的 layout.tsx
// 會做登入檢查，如果登入頁也放在 /admin 底下會被同一個檢查攔住、造成無限轉址。
//
// 這個專案用 React 18，用 react-dom 的 useFormState / useFormStatus
// （React 19 的 useActionState 在這裡不存在）。

'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { adminLogin } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-primary-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
    >
      {pending ? '登入中…' : '登入後台'}
    </button>
  );
}

export default function AdminLoginPage() {
  const [state, formAction] = useFormState(adminLogin, null);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-3xl mb-2">🛠</div>
          <h1 className="text-xl font-bold text-gray-800">後台管理登入</h1>
          <p className="text-sm text-gray-400 mt-1">羽升幸福養成學苑 · 僅供管理者使用</p>
        </div>

        <form action={formAction} className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Email</label>
            <input
              name="email"
              type="email"
              required
              autoFocus
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              placeholder="admin@example.com"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">密碼</label>
            <input
              name="password"
              type="password"
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              placeholder="••••••••"
            />
          </div>

          {state?.error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-600">
              {state.error}
            </div>
          )}

          <SubmitButton />
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          一般會員請從 NUWA 平台登入，這個頁面只給管理者用。
        </p>
      </div>
    </div>
  );
}
