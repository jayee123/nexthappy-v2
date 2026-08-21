'use client';

// 放置路徑：src/components/admin/NoAdminAccess.tsx
//
// 私版後台的「權限不足」說明畫面。
//
// 為什麼不是 redirect：
//   原本 admin/layout 對非管理員直接 redirect('/chat')，使用者只會看到
//   自己莫名其妙跑到聊天室，不知道發生什麼事，也不知道該怎麼辦。
//   說明頁若放在 /admin 底下又會被同一個 layout 再攔一次、形成無限轉址，
//   所以改成由 layout 直接渲染這個元件。

import { useCallback, useState } from 'react';
import { MARKET_BASE_URL } from '@/lib/market';

export default function NoAdminAccess({ email }: { email?: string | null }) {
  const [loggingOut, setLoggingOut] = useState(false);

  // 與 Sidebar 同一套：先清私版自己發的 happy_session，再回公版。
  // 只跳回公版不會結束私版 session，下次點後台還是同一個帳號。
  const handleSwitchAccount = useCallback(async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/login', { method: 'DELETE' });
    } catch {
      /* 清 cookie 失敗仍導向公版，至少讓使用者能重新登入 */
    }
    window.location.href = `${MARKET_BASE_URL}/login`;
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="text-3xl">🔒</div>

        <h1 className="mt-4 text-xl font-semibold text-gray-900">
          這個帳號沒有後台權限
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          課程後台僅開放給管理者使用。
          {email && (
            <>
              <br />
              目前登入的是 <span className="font-mono text-gray-800">{email}</span>。
            </>
          )}
        </p>

        <p className="mt-3 text-sm leading-relaxed text-gray-500">
          請改用具有管理權限的帳號登入。若你認為這是設定問題，請聯繫系統管理者。
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={handleSwitchAccount}
            disabled={loggingOut}
            className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-700 disabled:opacity-50"
          >
            {loggingOut ? '登出中…' : '改用其他帳號登入'}
          </button>

          <a
            href="/chat"
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-center text-sm text-gray-700 transition hover:bg-gray-50"
          >
            回到幸福關係
          </a>
        </div>
      </div>
    </div>
  );
}
