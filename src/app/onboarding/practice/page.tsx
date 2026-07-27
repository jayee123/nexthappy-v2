// 放置路徑：src/app/onboarding/practice/page.tsx
// v1.3.2b: Mode A「21 天刻意練習」獨立 onboarding（4 步）
//   Step 1：對象關係 + 對方暱稱
//   Step 2：對方的 MBTI + confidence
//   Step 3：21 天目標 + 最近卡點
//   Step 4：給這輪取個名字（可略過）
//   → POST /api/journey/setup → /chat
//
// 用戶 user.mbti_self 已在共用 onboarding（/onboarding）確認、這裡讀取後直接帶入 POST 不重填

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { RelationshipType } from '@/types';

const MBTI_TYPES = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP',
];

const RELATIONSHIP_OPTIONS = [
  { value: 'couple', label: '情侶 / 伴侶', emoji: '💑' },
  { value: 'parent_child', label: '親子關係', emoji: '👨‍👧' },
  { value: 'workplace', label: '職場夥伴', emoji: '🤝' },
];

type Confidence = 'low' | 'medium' | 'high';

export default function PracticeOnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userMbtiSelf, setUserMbtiSelf] = useState<string | null>(null);

  const [form, setForm] = useState({
    relationship_type: '' as RelationshipType,
    partner_nickname: '',
    mbti_partner: '',
    mbti_confidence: 'medium' as Confidence,
    goal_statement: '',
    initial_problem: '',
    round_label: '',
  });

  function update<K extends keyof typeof form>(field: K, value: typeof form[K]) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  // 載入 user.mbti_self 確認共用 onboarding 已完成、否則導回 /onboarding
  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch('/api/user/me');
        if (res.status === 401) { router.push('/auth/login'); return; }
        const json = await res.json();
        const user = json.data?.user;
        if (!user?.mbti_self) {
          router.push('/onboarding'); // 還沒設 MBTI、先去做共用 onboarding
          return;
        }
        setUserMbtiSelf(user.mbti_self);
      } catch {
        router.push('/auth/login');
      }
    }
    loadUser();
  }, [router]);

  const steps = [
    {
      title: '你想練哪段關係？',
      subtitle: '21 天會針對「這一段」深度練習',
      content: (
        <div className="py-4 space-y-3">
          {RELATIONSHIP_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => update('relationship_type', opt.value as RelationshipType)}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${
                form.relationship_type === opt.value
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-100 bg-white hover:border-gray-200'
              }`}
            >
              <span className="text-3xl">{opt.emoji}</span>
              <span className="font-medium text-gray-800">{opt.label}</span>
            </button>
          ))}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              對方的暱稱（怎麼稱呼他？）
            </label>
            <input
              type="text"
              value={form.partner_nickname}
              onChange={e => update('partner_nickname', e.target.value)}
              placeholder="例如：小明、媽媽、老王"
              className="input-field"
            />
          </div>
        </div>
      ),
    },
    {
      title: '對方的 MBTI',
      subtitle: '不確定也沒關係、之後可調整',
      content: (
        <div className="py-4">
          <p className="text-sm text-gray-500 mb-3">
            對方（{form.partner_nickname || '對方'}）的 MBTI 類型
          </p>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {MBTI_TYPES.map(type => (
              <button
                key={type}
                onClick={() => update('mbti_partner', type)}
                className={`py-2 rounded-xl text-sm font-mono font-medium transition-all ${
                  form.mbti_partner === type
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
          <div className="flex gap-2 mb-4">
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
          <p className="text-xs text-gray-400">
            你的 MBTI：{userMbtiSelf || '⋯'}（已在共用 onboarding 設定、跨輪共用）
          </p>
        </div>
      ),
    },
    {
      title: '這輪的目標',
      subtitle: '告訴小羽你想改變什麼',
      content: (
        <div className="py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              21 天後、你希望你們的關係有什麼不同？
            </label>
            <textarea
              value={form.goal_statement}
              onChange={e => update('goal_statement', e.target.value)}
              placeholder="例如：希望我們可以更坦誠地說出感受、不再用冷戰解決問題..."
              className="input-field resize-none h-24"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              說一個最近最困擾你的互動情境
            </label>
            <textarea
              value={form.initial_problem}
              onChange={e => update('initial_problem', e.target.value)}
              placeholder="例如：每次我想說什麼、他都說「隨便」、讓我很無力..."
              className="input-field resize-none h-24"
            />
          </div>
        </div>
      ),
    },
    {
      title: '幫這輪取個名字',
      subtitle: '方便之後回顧多輪練習（可略過）',
      content: (
        <div className="py-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
            <input
              type="text"
              value={form.round_label}
              onChange={e => update('round_label', e.target.value)}
              placeholder="例如：跟老婆第 1 輪 / 跟爸爸和解"
              className="input-field"
              maxLength={40}
            />
            <p className="text-xs text-gray-500">
              之後你可能會對不同關係 / 不同階段開啟多輪練習、幫這輪取個名字方便回顧。
            </p>
          </div>
          <div className="mt-5 bg-primary-50 rounded-2xl p-4 text-sm text-gray-600 leading-relaxed">
            <p>
              ✨ 確認後、小羽會立刻為你準備 <span className="font-semibold text-primary-700">Day 1 的任務</span>、
              開始 21 天刻意練習。
            </p>
          </div>
        </div>
      ),
    },
  ];

  async function handleNext() {
    if (step < steps.length - 1) {
      // 驗證
      if (step === 0 && (!form.relationship_type || !form.partner_nickname)) {
        setError('請選擇關係類型並填入對方的暱稱');
        return;
      }
      if (step === 1 && !form.mbti_partner) {
        setError('請選擇對方的 MBTI 類型');
        return;
      }
      setError('');
      setStep(s => s + 1);
      return;
    }

    // 最後一步、提交
    if (!userMbtiSelf) {
      setError('找不到你的 MBTI 設定、請回到共用 onboarding');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/journey/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mbti_self: userMbtiSelf,
          mbti_partner: form.mbti_partner,
          mbti_confidence: form.mbti_confidence,
          partner_nickname: form.partner_nickname,
          relationship_type: form.relationship_type,
          goal_statement: form.goal_statement || null,
          initial_problem: form.initial_problem || null,
          round_label: form.round_label || null,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error || '設定失敗、請再試一次');
        return;
      }

      router.push('/chat');
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
        {step > 0 ? (
          <button
            onClick={() => { setStep(s => s - 1); setError(''); }}
            className="btn-secondary flex-1"
          >
            上一步
          </button>
        ) : (
          <button
            onClick={() => router.push('/chat')}
            className="btn-secondary flex-1"
          >
            取消
          </button>
        )}
        <button
          onClick={handleNext}
          className="btn-primary flex-1"
          disabled={loading}
        >
          {loading ? '建立中...' : isLastStep ? '開始 Day 1 🚀' : '下一步'}
        </button>
      </div>
    </div>
  );
}
