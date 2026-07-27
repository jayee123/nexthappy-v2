// 放置路徑：src/app/onboarding/page.tsx
// v1.3.2b: 共用 onboarding 砍到 2 步（trier-first funnel）
//   Step 1：認識小羽（welcome）
//   Step 2：你的 MBTI + 暱稱（optional）
//   → POST /api/onboarding/light → /chat
//
// 不再問：對方關係 / 對方暱稱 / 對方 MBTI / 目標 / 任務稱呼
// 這些移到 Mode A 獨立 onboarding（v1.3.2c、路徑 `/onboarding/practice`）

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

const MBTI_TYPES = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP',
];

type Confidence = 'low' | 'medium' | 'high';

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    mbti_self: '',
    mbti_confidence: 'medium' as Confidence,
    name: '',
  });

  function update<K extends keyof typeof form>(field: K, value: typeof form[K]) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  const steps = [
    {
      title: '認識小羽老師',
      subtitle: '你的 AI 關係教練',
      content: (
        <div className="text-center py-6">
          {/* v1.5.x: 小羽老師頭像（取代 🕊️）— 7/26 放大填滿圓框、不留白邊 */}
          <div className="w-28 h-28 bg-white rounded-full flex items-center justify-center mx-auto mb-4 overflow-hidden shadow-md border border-[#f6bf8e]/30">
            <Image
              src="/images/logo/avatar-xiaoyu.png"
              alt="小羽老師"
              width={112}
              height={112}
              priority
              className="w-full h-full object-cover"
            />
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-3">嗨！我是小羽老師</h3>
          <p className="text-gray-600 leading-relaxed">
            我會用 MBTI + 觀察、陪你看清你跟對方的差異、找到能說、能做、能改變的方式。
          </p>
          <div className="mt-4 bg-primary-50 rounded-2xl p-4 text-left space-y-2">
            <p className="text-sm text-primary-700">✓ 隨時來「我卡住了，幫我拆」找我聊困擾</p>
            <p className="text-sm text-primary-700">✓ 想深練、可開啟「21 天刻意練習」</p>
            <p className="text-sm text-primary-700">✓ 記住你的故事、持續陪伴</p>
          </div>
          <p className="text-gray-600 mt-6">先讓我認識你一下、可以嗎？</p>
        </div>
      ),
    },
    {
      title: '你的 MBTI',
      subtitle: '幫小羽更了解你（4 字母組合）',
      content: (
        <div className="py-4">
          <p className="text-sm text-gray-500 mb-3">選擇你的 MBTI 類型（不確定可以先猜一個、之後可調整）</p>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {MBTI_TYPES.map(type => (
              <button
                key={type}
                onClick={() => update('mbti_self', type)}
                className={`py-2 rounded-xl text-sm font-mono font-medium transition-all ${
                  form.mbti_self === type
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <div className="mt-3 flex gap-2 mb-6">
            {(['low', 'medium', 'high'] as const).map(conf => (
              <button
                key={conf}
                onClick={() => update('mbti_confidence', conf)}
                className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
                  form.mbti_confidence === conf
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-primary-50'
                }`}
              >
                {conf === 'low' ? '不太確定' : conf === 'medium' ? '大概是' : '很確定'}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
            <p className="text-sm font-semibold text-gray-800">你想小羽怎麼稱呼你？（可略過）</p>
            <input
              type="text"
              value={form.name}
              onChange={e => update('name', e.target.value)}
              placeholder="例如：阿明、Steve、媽媽"
              className="input-field"
              maxLength={40}
            />
          </div>

          <div className="mt-5 bg-primary-50 rounded-2xl p-4 text-sm text-gray-600 leading-relaxed">
            <p>
              ✨ 小羽用 <span className="font-semibold text-primary-700">MBTI 4 字母</span>（E/I、S/N、T/F、J/P）解讀你跟對方差異——
              <span className="font-semibold">先套字母 → 觀察反應 → 對上信任、對不上補充</span>。
            </p>
            <p className="mt-2 text-xs text-gray-500">不確定也沒關係、之後可以隨時調整。</p>
          </div>
        </div>
      ),
    },
  ];

  async function handleNext() {
    if (step < steps.length - 1) {
      setError('');
      setStep(s => s + 1);
      return;
    }

    // 最後一步、提交
    if (!form.mbti_self) {
      setError('請選擇你的 MBTI 類型');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/onboarding/light', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mbti_self: form.mbti_self,
          mbti_confidence: form.mbti_confidence,
          name: form.name || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error || '設定失敗、請再試一次');
        return;
      }

      // v1.5.x: 完成 light onboarding 後、預設進諮詢模式
      // 理由：新用戶帶卡點來、要立刻被接住（§0.6 Empowerment + §5.4 HOOK）
      // 諮詢模式對話中、AI 會 soft sell 引流到 21 天練習
      router.push('/chat?tab=consultant');
    } catch {
      setError('網路錯誤、請稍後再試');
    } finally {
      setLoading(false);
    }
  }

  const currentStep = steps[step];
  const isLastStep = step === steps.length - 1;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Progress Bar */}
      <div className="bg-white px-6 pt-6 pb-4">
        <div className="flex items-center gap-2 mb-4">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                i <= step ? 'bg-primary-500' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
        <h2 className="text-lg font-bold text-gray-800">{currentStep.title}</h2>
        <p className="text-sm text-gray-500">{currentStep.subtitle}</p>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 overflow-y-auto">
        {currentStep.content}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-6 mb-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="px-6 py-4 flex gap-3 border-t border-gray-100">
        {step > 0 && (
          <button
            onClick={() => { setStep(s => s - 1); setError(''); }}
            className="btn-secondary flex-1"
          >
            上一步
          </button>
        )}
        <button
          onClick={handleNext}
          className="btn-primary flex-1"
          disabled={loading}
        >
          {loading ? '儲存中...' : isLastStep ? '進入小羽 🚀' : '下一步'}
        </button>
      </div>
    </div>
  );
}
