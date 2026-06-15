'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(process.env.NODE_ENV === 'development' ? 'jeff@milkidea.com' : '');
  const [password, setPassword] = useState(process.env.NODE_ENV === 'development' ? 'test1234' : '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || '登入失敗');
        return;
      }

      // 檢查是否有旅程
      const journeyRes = await fetch('/api/journey/me');
      const journeyJson = await journeyRes.json();

      if (journeyJson.data?.journey) {
        router.push('/chat');
      } else {
        router.push('/onboarding');
      }
    } catch {
      setError('網路錯誤，請稍後再試');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="bg-primary-600 text-white px-6 pt-12 pb-8 text-center">
        <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
          <span className="text-3xl">🕊️</span>
        </div>
        <h1 className="text-xl font-bold">羽升幸福養成學苑</h1>
        <p className="text-primary-200 text-sm mt-1">21天幸福關係練習</p>
      </div>

      {/* Form */}
      <div className="flex-1 px-6 py-8">
        <h2 className="text-xl font-bold text-gray-800 mb-6">歡迎回來</h2>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="input-field"
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">密碼</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="input-field"
              required
              autoComplete="current-password"
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
            {loading ? '登入中...' : '登入'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            還沒有帳號？{' '}
            <Link href="/auth/register" className="text-primary-600 font-medium hover:underline">
              用邀請碼註冊
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
