'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

interface BillingMe {
  plan: 'trial' | 'basic' | 'advanced' | 'premium' | 'cancelled';
  plan_label: string;
  period_start: string;
  messages_used: number;
  messages_limit: number;
  messages_remaining: number;
  cost_twd_estimated: number;
  is_trial: boolean;
  trial_expires_at: string | null;
  enforcement_enabled: boolean;
}

interface PlanSpec {
  tier: string;
  label: string;
  tagline: string;
  monthly_messages: number;
  price_twd: number;
  suitable_for: string;
  features: string[];
}

export default function BillingPage() {
  const [me, setMe] = useState<BillingMe | null>(null);
  const [plans, setPlans] = useState<PlanSpec[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLockModal, setShowLockModal] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [meRes, plansRes] = await Promise.all([
        fetch('/api/billing/me'),
        fetch('/api/billing/plans'),
      ]);
      const meJson = await meRes.json();
      const plansJson = await plansRes.json();
      if (meJson.data) setMe(meJson.data);
      if (plansJson.data?.plans) setPlans(plansJson.data.plans);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'fetch failed';
      console.error('[billing page]', message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return <div className="p-6 lg:p-8 text-gray-400">載入中...</div>;
  }

  if (!me) {
    return <div className="p-6 lg:p-8 text-red-500">無法載入訂閱資訊</div>;
  }

  const usagePct = me.messages_limit > 0
    ? Math.min(100, Math.round((me.messages_used / me.messages_limit) * 100))
    : 0;

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      <Link href="/chat" className="text-sm text-primary-600 hover:underline">
        &larr; 回對話
      </Link>

      <h1 className="text-2xl font-bold text-gray-800 mt-3 mb-1">我的訂閱</h1>
      <p className="text-sm text-gray-500 mb-6">管理你的方案、查看本月對話額度</p>

      {!me.enforcement_enabled && (
        <div className="mb-5 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
          <strong>內測階段</strong>：所有 user 預設使用 Premium 方案、暫不擋額度、不收費。正式上市後啟動 7 天免費試用 + 訂閱計費。
        </div>
      )}

      {/* 當前方案 + 用量 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs text-gray-500 mb-0.5">當前方案</div>
            <div className="text-xl font-bold text-gray-800">
              {me.plan_label}
              {me.is_trial && (
                <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">試用中</span>
              )}
            </div>
          </div>
          {me.is_trial && me.trial_expires_at && (
            <div className="text-right">
              <div className="text-xs text-gray-500">試用到期</div>
              <div className="text-sm font-medium text-amber-700">
                {new Date(me.trial_expires_at).toLocaleDateString('zh-TW')}
              </div>
            </div>
          )}
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-gray-600 mb-1.5">
            <span>本月已用對話次數</span>
            <span className="font-medium">
              {me.messages_used} / {me.messages_limit}
              <span className="text-gray-400 ml-1">（剩 {me.messages_remaining}）</span>
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all ${
                usagePct >= 90 ? 'bg-red-500' :
                usagePct >= 70 ? 'bg-amber-500' :
                'bg-primary-500'
              }`}
              style={{ width: `${usagePct}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400">
            <span>計算週期：{me.period_start} &rarr; 月底（自動重置）</span>
            <span>累計成本（內部）：NT$ {me.cost_twd_estimated.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* 三方案 cards */}
      <h2 className="text-lg font-semibold text-gray-800 mb-3">請選擇訂閱方案</h2>
      <div className="flex flex-col gap-4">
        {plans.map(plan => {
          const isCurrent = plan.tier === me.plan;
          const isPremium = plan.tier === 'premium';
          return (
            <div
              key={plan.tier}
              className={`bg-white border-2 rounded-xl p-5 ${
                isCurrent ? 'border-primary-500' : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-3 h-3 rounded ${
                      plan.tier === 'basic' ? 'bg-emerald-400' :
                      plan.tier === 'advanced' ? 'bg-orange-400' :
                      'bg-purple-500'
                    }`} />
                    <h3 className="font-bold text-gray-800 text-lg">{plan.label}</h3>
                  </div>
                  <p className="text-xs text-gray-500">{plan.tagline}</p>
                </div>
                <div className="text-right shrink-0">
                  <div>
                    <span className="text-2xl font-bold text-gray-800">${plan.price_twd}</span>
                    <span className="text-xs text-gray-500 ml-1">NTD / 月</span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-gray-600 mb-3">
                <span className="text-gray-400">適合：</span>{plan.suitable_for}
              </p>

              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-gray-700 mb-4">
                {plan.features.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>

              {isCurrent ? (
                <button
                  disabled
                  className="w-full sm:w-auto sm:px-8 py-2 bg-gray-100 text-gray-500 rounded-lg text-sm font-medium cursor-not-allowed"
                >
                  目前使用方案
                </button>
              ) : (
                <button
                  onClick={() => setShowLockModal(plan.label)}
                  className={`w-full sm:w-auto sm:px-8 py-2 rounded-lg text-sm font-medium text-white transition-colors ${
                    isPremium ? 'bg-purple-600 hover:bg-purple-700' :
                    plan.tier === 'advanced' ? 'bg-orange-500 hover:bg-orange-600' :
                    'bg-emerald-500 hover:bg-emerald-600'
                  }`}
                >
                  選擇 {plan.label}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* 取消訂閱 */}
      <div className="mt-6 text-center">
        <button
          onClick={() => setShowLockModal('cancel')}
          className="text-xs text-gray-500 hover:text-gray-700 underline"
        >
          取消訂閱
        </button>
      </div>

      {/* 內測鎖定 modal */}
      {showLockModal && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setShowLockModal(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full p-6"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-gray-800 mb-2">
              金流串接中
            </h3>
            <p className="text-sm text-gray-700 mb-4 leading-relaxed">
              我們正在串接紅陽金流、預計近期上線。
              {showLockModal === 'cancel' ? (
                <>正式上市前、訂閱不會自動扣款、你也不用主動取消。</>
              ) : (
                <>正式上市前、所有 user 預設使用 Premium 方案。如有特殊需求請聯絡羽升團隊。</>
              )}
            </p>
            <button
              onClick={() => setShowLockModal(null)}
              className="w-full py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700"
            >
              我知道了
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
