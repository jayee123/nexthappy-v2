'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '', invite_code: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (form.password.length < 8) {
      setError('密碼至少需要 8 個字元');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || '註冊失敗');
        return;
      }

      // v1.5.x: 註冊成功 → 直接進 /onboarding（light: MBTI + 暱稱）
      // /welcome 5 頁導引已在 register 之前看過（root / → /welcome → /auth/register）
      // 註冊後不用再看一次、直接進 onboarding 設定即可
      router.push('/onboarding');
    } catch {
      setError('網路錯誤，請稍後再試');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <div className="bg-pearl-gradient-soft text-white px-6 pt-12 pb-8 text-center">
        {/* v1.5.x: Pearl Logo（火焰鳳凰）取代 🕊️ dove emoji */}
        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-3 overflow-hidden shadow-md">
          <Image
            src="/images/logo/logo-icon.png"
            alt="羽升幸福養成學苑"
            width={56}
            height={56}
            priority
            className="object-contain"
          />
        </div>
        <h1 className="text-xl font-bold">開始你的幸福旅程</h1>
        <p className="text-primary-200 text-sm mt-1">輸入邀請碼，加入21天練習</p>
      </div>

      <div className="flex-1 px-6 py-8">
        <h2 className="text-xl font-bold text-gray-800 mb-6">建立帳號</h2>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">邀請碼</label>
            <input
              type="text"
              value={form.invite_code}
              onChange={e => update('invite_code', e.target.value.toUpperCase())}
              placeholder="輸入你的邀請碼"
              className="input-field font-mono tracking-wider"
              required
            />
            <p className="text-xs text-gray-400 mt-1">沒有邀請碼？請聯絡羽升團隊取得</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">你的名字</label>
            <input
              type="text"
              value={form.name}
              onChange={e => update('name', e.target.value)}
              placeholder="請輸入你的名字"
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={e => update('email', e.target.value)}
              placeholder="your@email.com"
              className="input-field"
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">設定密碼</label>
            <input
              type="password"
              value={form.password}
              onChange={e => update('password', e.target.value)}
              placeholder="至少 8 個字元"
              className="input-field"
              required
              autoComplete="new-password"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={loading}
          >
            {loading ? '建立中...' : '建立帳號，開始練習'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            已有帳號？{' '}
            <Link href="/auth/login" className="text-primary-600 font-medium hover:underline">
              直接登入
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
