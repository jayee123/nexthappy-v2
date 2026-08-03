// 放置路徑：src/app/page.tsx
// App 入口流程：
//   - 沒登入 → /welcome（產品導引 → 註冊/登入）
//   - 已登入・第一次（localStorage 沒 has_seen_intro）→ 強制跑 /welcome，看完直接進 App
//   - 已登入・回訪（已看過導引）→ 顯示兩顆按鈕：「導覽」/「直接開始」
//   - App 主入口：沒 mbti_self → /onboarding；有 → /chat
//
// 「第一次都要跑導覽、第二次給導覽/直接開始兩個選擇」— 用 localStorage has_seen_intro 判斷（不同裝置會再看一次，可接受）。

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { hasSeenIntro } from '@/lib/welcome';

export default function HomePage() {
  const router = useRouter();
  // 回訪已登入用戶 → 顯示「導覽 / 直接開始」；appPath = 「直接開始」要去的地方
  const [chooser, setChooser] = useState<{ appPath: string } | null>(null);

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

        // 已登入用戶的 App 主入口（trier-first gate：以 mbti_self 判斷）
        const appPath = user.mbti_self ? '/chat' : '/onboarding';

        if (!hasSeenIntro()) {
          // 第一次進來 → 強制跑導覽，看完直接進 App
          router.replace('/welcome?next=' + encodeURIComponent(appPath));
        } else {
          // 回訪 → 顯示兩顆按鈕
          setChooser({ appPath });
        }
      } catch {
        router.replace('/welcome');
      }
    }

    checkStatus();
  }, [router]);

  // 回訪：導覽 / 直接開始
  if (chooser) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#fdf8f3] px-6">
        <div className="w-full max-w-sm text-center">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-5 overflow-hidden shadow-md border border-[#f6bf8e]/30">
            <Image
              src="/images/logo/logo-icon.png"
              alt="羽升幸福養成學苑"
              width={72}
              height={72}
              priority
              className="object-contain"
            />
          </div>
          <h1 className="text-xl font-semibold text-gray-800">歡迎回來</h1>
          <p className="mt-2 text-sm text-gray-500">要先看一次導覽，還是直接開始？</p>

          <div className="mt-8 space-y-3">
            <button
              onClick={() => router.push(chooser.appPath)}
              className="w-full rounded-xl bg-[#f6bf8e] py-3 text-base font-medium text-white shadow-sm transition hover:opacity-90"
            >
              直接開始
            </button>
            <button
              onClick={() => router.push('/welcome?next=' + encodeURIComponent(chooser.appPath))}
              className="w-full rounded-xl border border-[#f6bf8e]/60 bg-white py-3 text-base font-medium text-[#c98a4b] transition hover:bg-[#f6bf8e]/10"
            >
              看導覽
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 轉導中的 loading
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
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
