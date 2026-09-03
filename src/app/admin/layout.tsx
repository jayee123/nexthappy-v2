// 放置路徑：src/app/admin/layout.tsx
//
// 後台共用 layout：
// 1. Server-side auth gate：未登入 → redirect /auth/login、非 admin → 顯示權限說明
// 2. 渲染 sidebar + main content area

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import AdminSidebar from '@/components/admin/AdminSidebar';
import NoAdminAccess from '@/components/admin/NoAdminAccess';
import { MARKET_FIELD_BG_VAR, MARKET_FIELD_FG_VAR } from '@/lib/admin/marketField';
import { getMarketFieldColors } from '@/lib/admin/marketField.server';

export const metadata = {
  title: '後台管理 | 羽升幸福養成學苑',
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 1. 檢查登入
  // 管理者走獨立登入頁（/admin-login），不經過 NUWA SSO 那套一般會員流程
  const session = await getSession();
  if (!session) {
    redirect('/admin-login');
  }

  // 2. 查 is_admin
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, email, name, is_admin')
    .eq('id', session.userId)
    .single();

  if (!user?.is_admin) {
    // 非 admin：不再靜默 redirect('/chat')。
    // 那會讓使用者莫名其妙跑到聊天室、不知道發生什麼事，也不知道下一步該做什麼
    // ——「公版管理者」與「私版管理者」是兩套獨立權限，很容易踩到。
    // 說明頁不能放在 /admin 底下（會被這個 layout 再攔一次、無限轉址），
    // 因此直接在這裡渲染。
    return <NoAdminAccess email={user?.email ?? null} />;
  }

  // 3. 公版欄位的標示配色（管理員可在 /admin/settings 改）
  //    在這裡讀、以 CSS 變數往下傳，底下的 client component 就不必自己打 API，
  //    也不會先閃一次預設色再變。讀失敗時 getMarketFieldColors() 已退回預設值。
  const marketColors = await getMarketFieldColors();

  return (
    <div
      className="fixed inset-0 flex bg-gray-50 z-10"
      style={
        {
          [MARKET_FIELD_BG_VAR]: marketColors.bg,
          [MARKET_FIELD_FG_VAR]: marketColors.fg,
        } as React.CSSProperties
      }
    >
      <AdminSidebar adminEmail={user.email} adminName={user.name} />
      <main className="flex-1 min-w-0 overflow-auto">{children}</main>
    </div>
  );
}