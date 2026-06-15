// 放置路徑：src/app/page.tsx
// v1.3.2b: trier-first routing gate
//   - 沒登入 → /auth/login
//   - 沒 user.mbti_self → /onboarding（共用 onboarding 2 步）
//   - 有 user.mbti_self → /chat（即使沒 journey 也能進、Mode B 走 lite path）

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

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
        <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">🕊️</span>
        </div>
        <p className="text-gray-400 text-sm">載入中...</p>
      </div>
    </div>
  );
}
