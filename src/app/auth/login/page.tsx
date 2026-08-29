/**
 * /auth/login —— 私版沒有自己的登入。
 *
 * 帳號真值在公版（NUWA），進來的唯一路徑是公版「App 服務」→ /sso。
 * middleware 已把沒帶 ?error 的請求直接導向公版登入頁，所以這個頁面
 * 只會在「SSO 失敗」時被看到：讓用戶知道發生什麼事，而不是被彈回公版卻不明所以。
 */

import Link from 'next/link';
import Image from 'next/image';
import { MARKET_LOGIN_URL } from '@/lib/market';

const SSO_ERROR_MESSAGES: Record<string, string> = {
  sso_no_token: '這個連結沒有帶登入資訊，請從 NUWA 重新進入。',
  sso_not_configured: '登入設定尚未完成，請聯繫客服。',
  sso_invalid: '登入連結已失效或無法驗證，請從 NUWA 重新進入。',
  sso_wrong_app: '這個登入連結不屬於本 App，請從 NUWA 重新進入。',
  sso_create_failed: '建立帳號時發生問題，請稍後再試或聯繫客服。',
  sso_suspended: '這個帳號已被停權，如有疑問請聯繫客服。',
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const message =
    (searchParams.error && SSO_ERROR_MESSAGES[searchParams.error]) ??
    '請從 NUWA 平台進入本 App。';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-sm text-center">
        <Image
          src="/images/logo/avatar-xiaoyu.png"
          alt="小羽老師"
          width={64}
          height={64}
          className="mx-auto rounded-full border border-primary-100"
        />

        <h1 className="mt-4 text-xl font-bold text-gray-800">無法登入</h1>
        <p className="mt-2 text-sm text-gray-500 leading-relaxed">{message}</p>

        <a
          href={MARKET_LOGIN_URL}
          className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-primary-600 px-4 py-3 text-sm font-medium text-white hover:bg-primary-700"
        >
          前往 NUWA 登入
        </a>

        <p className="mt-4 text-xs text-gray-400">
          登入後在 NUWA 點「App 服務 → 幸福關係」即可回到這裡。
        </p>

        <Link href="/welcome" className="mt-6 inline-block text-xs text-gray-400 hover:text-gray-600">
          先看看這個 App 在做什麼
        </Link>
      </div>
    </div>
  );
}
