/**
 * /welcome - 首次訪客導引頁（v1.5.x 改：移到 register 之前）
 *
 * 新流程：
 *   未登入訪客 → / → /welcome（6 頁 carousel）→ /auth/register 或 /auth/login
 *
 * 原因（Steve 6/15 觀察）：
 *   原本放在 register 之後、但 Page 5 教「怎麼開始使用」對已註冊用戶毫無意義。
 *   改放在 register 之前、Page 5 內容才能發揮作用（教用戶去 NUWA 註冊 + 去 LINE 群索取邀請碼）。
 *
 * #3a：/auth/register 已改成 302 到 NUWA 公版註冊頁，私版不再自行建帳號。
 *
 * 互動策略：
 * - 「開始使用」（Page 5 CTA） → /auth/register → NUWA 公版註冊
 * - 「已有帳號？登入」（Page 5 small link） → /auth/login（回訪老用戶）
 * - 「跳過 ✕」（右上）→ /auth/login（假設老用戶想登入、不想看完）
 *
 * localStorage 策略（MVP）：
 * - 記錄 has_seen_intro、給 Settings 回看判斷用
 * - 不同裝置會再看一次（可接受）
 */

'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import WelcomeCarousel from '@/components/WelcomeCarousel';
// helper 抽到 lib 因為 Next.js App Router 不允許 page.tsx export 自訂函式
import { markIntroSeen } from '@/lib/welcome';

function WelcomePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ?next=/some/path 控制看完後去哪
  // 預設 /auth/register（新訪客 = 未登入）
  // 從 Settings 回看時、傳 ?next=/settings 讓「開始使用」+「跳過」都回 Settings
  const explicitNext = searchParams.get('next');
  const nextPath = explicitNext || '/auth/register';
  const isRevisit = explicitNext !== null; // 有 ?next 代表是「帶 context 來的」、通常是登入後回看

  // 「開始使用」CTA 行為 → 走 nextPath
  const handleComplete = () => {
    markIntroSeen();
    router.push(nextPath);
  };

  // 「跳過 ✕」行為：
  // - 從 Settings 等地方回看（isRevisit）→ 回到 ?next 指定處
  // - 新訪客（沒 ?next）→ /auth/login（假設老用戶想登入、不想看完）
  const handleSkip = () => {
    markIntroSeen();
    router.push(isRevisit ? nextPath : '/auth/login');
  };

  // 「已有帳號？登入」連結（只在「新訪客」場景顯示、Settings 回看時隱藏）
  const handleLogin = () => {
    markIntroSeen();
    router.push('/auth/login');
  };

  return (
    <WelcomeCarousel
      onComplete={handleComplete}
      onSkip={handleSkip}
      onLogin={isRevisit ? undefined : handleLogin}
      showSkip={true}
      // 暫時用 Angel 版 cover.png（完整視覺）
      // Pearl 給文字版 PNG/HTML 後、替換 public/images/welcome/cover.png 即可（不用改 code）
      coverImageSrc="/images/welcome/cover.png"
    />
  );
}

export default function WelcomePage() {
  return (
    <Suspense fallback={null}>
      <WelcomePageInner />
    </Suspense>
  );
}
