// 放置路徑：src/app/page.tsx
// v1.5.x: 加入 /welcome 5 頁導引作為首次訪客入口
//   - 沒登入 → /welcome（5 頁產品介紹、Page 5 教邀請碼+CTA → /auth/register）
//   - 沒 user.mbti_self → /onboarding（共用 onboarding 2 步）
//   - 有 user.mbti_self → /chat（即使沒 journey 也能進、Mode B 走 lite path）
//
// v1.3.2b（前版）：沒登入直接 /auth/login（已被 v1.5.x 取代）

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch('/api/user/me');

        if (res.status === 401) {
          router.replace('/welcome');
          return;
        }

        const json = await res.json();
        const user = json.data?.user;

        if (!user) {
          router.replace('/welcome');
          return;
        }

        // v1.3.2b trier-first gate：以 user.mbti_self 為判斷依據
        if (!user.mbti_self) {
          router.replace('/onboarding');
        } else {
          router.replace('/chat');
        }
      } catch {
        router.replace('/welcome');
      }
    }

    checkStatus();
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        {/* v1.5.x: Loading 也用 Pearl Logo */}
        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 overflow-hidden shadow-md border border-[#f6bf8e]/30 animate-pulse">
          <Image
            src="/images/logo/logo-icon.png"
            alt="羽升幸福養成學苑"
            width={56}
            height={56}
            priority
            className="object-contain"
          />
        </div>
        <p className="text-gray-400 text-sm">載入中...</p>
      </div>
    </div>
  );
}
