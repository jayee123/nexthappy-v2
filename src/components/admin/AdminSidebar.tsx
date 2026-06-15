// 放置路徑：src/components/admin/AdminSidebar.tsx
//
// 後台 sidebar 導航元件、用於 /admin/layout.tsx
//
// 7 個 nav links：Dashboard / 用戶 / Journey / 對話 / 主題 / 課程 / 系統設定
// 自動 highlight 當前 active 頁、含 footer 顯示 admin email + 登出

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

interface AdminSidebarProps {
  adminEmail: string;
  adminName: string | null;
}

const NAV = [
  { href: '/admin', icon: '📊', label: 'Dashboard' },
  { href: '/admin/users', icon: '👥', label: '用戶管理' },
  { href: '/admin/journeys', icon: '🗺', label: 'Journey 管理' },
  { href: '/admin/conversations', icon: '💬', label: '對話歷史' },
  { href: '/admin/topics', icon: '📁', label: '諮詢主題' },
  { href: '/admin/course', icon: '📚', label: '課程內容' },
  { href: '/admin/invites', icon: '📨', label: '邀請碼管理' },
  { href: '/admin/subscriptions', icon: '💳', label: '訂閱管理' },
  { href: '/admin/usage', icon: '📈', label: '用量／成本' },
  { href: '/admin/spec', icon: '📜', label: '規格文件' },
  { href: '/admin/prompts', icon: '🤖', label: 'AI Prompt 程式碼' },
  { href: '/admin/settings', icon: '⚙️', label: '系統設定' },
];

export default function AdminSidebar({ adminEmail, adminName }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/login', { method: 'DELETE' });
    router.push('/auth/login');
  }

  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0">
      {/* Header */}
      <div className="px-4 py-4 border-b border-gray-200">
        <Link href="/admin" className="block">
          <h1 className="font-bold text-gray-800 text-base">🛠 後台管理</h1>
          <p className="text-xs text-gray-400 mt-0.5">羽升幸福養成學苑</p>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2">
        <ul>
          {NAV.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== '/admin' && pathname.startsWith(item.href));
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${
                    active
                      ? 'bg-primary-50 text-primary-700 font-medium border-r-2 border-primary-600'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-base">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-200 px-4 py-3 text-xs">
        <div className="text-gray-700 font-medium truncate" title={adminName || adminEmail}>
          {adminName || adminEmail.split('@')[0]}
        </div>
        <div className="text-gray-400 truncate" title={adminEmail}>
          {adminEmail}
        </div>
        <div className="mt-2 flex gap-2">
          <Link href="/chat" className="text-primary-600 hover:text-primary-700">
            ← 回前台
          </Link>
          <span className="text-gray-300">|</span>
          <button onClick={handleLogout} className="text-gray-500 hover:text-gray-700">
            登出
          </button>
        </div>
      </div>
    </aside>
  );
}