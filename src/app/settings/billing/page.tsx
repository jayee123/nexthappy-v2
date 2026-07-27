'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

type PlanTier = 'trial' | 'basic' | 'advanced' | 'premium' | 'cancelled';

interface BillingMe {
  plan: PlanTier;
  plan_label: string;
  period_start: string;
  messages_used: number;
  messages_limit: number;
  messages_remaining: number;
  cost_twd_estimated: number;
  is_trial: boolean;
  trial_expires_at: string | null;
  enforcement_enabled: boolean;
  has_payment_method: boolean;
  auto_renewal: boolean;
  pending_downgrade_plan: PlanTier | null;
  subscription_renews_at: string | null;
  cancelled_at: string | null;
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

const TIER_RANK: Record<string, number> = {
  cancelled: 0, trial: 1, basic: 2, advanced: 3, premium: 4,
};

type ModalState =
  | { type: 'confirm'; tier: PlanTier; action: 'subscribe' | 'upgrade' | 'downgrade' }
  | { type: 'retention' }
  | null;

export default function BillingPageWrapper() {
  return (
    <Suspense fallback={<div className="p-6 lg:p-8 text-gray-400">載入中...</div>}>
      <BillingPage />
    </Suspense>
  );
}

function BillingPage() {
  const searchParams = useSearchParams();
  const [me, setMe] = useState<BillingMe | null>(null);
  const [plans, setPlans] = useState<PlanSpec[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

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

  useEffect(() => {
    const payment = searchParams.get('payment');
    if (payment === 'success') {
      setToast({ type: 'success', msg: '付款成功！方案已啟用。' });
    } else if (payment === 'failed') {
      setToast({ type: 'error', msg: '付款失敗，請稍後再試或聯絡客服。' });
    }
  }, [searchParams]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(t);
  }, [toast]);

  const getActionForTier = (tier: string): 'subscribe' | 'upgrade' | 'downgrade' | 'same' => {
    if (!me) return 'subscribe';
    if (tier === me.plan) return 'same';
    const currentRank = TIER_RANK[me.plan] ?? 0;
    const targetRank = TIER_RANK[tier] ?? 0;
    if (currentRank <= 1) return 'subscribe';
    return targetRank > currentRank ? 'upgrade' : 'downgrade';
  };

  const handleBindCard = async (tier: PlanTier) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/payment/bind-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.payUrl) {
        setToast({ type: 'error', msg: data.error || '建立交易失敗' });
        return;
      }
      // 新版 SunPay：直接導向紅陽付款頁（pay_code）輸入卡號
      window.location.href = data.payUrl;
    } catch {
      setToast({ type: 'error', msg: '網路錯誤，請重試' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckout = async (action: string, targetTier?: PlanTier) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/payment/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, targetTier }),
      });
      const data = await res.json();

      if (data.needsBindCard && targetTier) {
        await handleBindCard(targetTier);
        return;
      }

      if (data.success) {
        setToast({ type: 'success', msg: data.message });
        setModal(null);
        await fetchData();
      } else {
        setToast({ type: 'error', msg: data.message || data.error || '操作失敗' });
      }
    } catch {
      setToast({ type: 'error', msg: '網路錯誤，請重試' });
    } finally {
      setActionLoading(false);
    }
  };

  const handlePlanClick = (tier: PlanTier) => {
    if (!me) return;
    const action = getActionForTier(tier);
    if (action === 'same') return;
    setModal({ type: 'confirm', tier: tier as PlanTier, action });
  };

  const confirmAction = async () => {
    if (!modal || modal.type !== 'confirm') return;
    const { tier, action } = modal;

    if (action === 'subscribe' && !me?.has_payment_method) {
      setModal(null);
      await handleBindCard(tier);
    } else {
      await handleCheckout(action, tier);
    }
  };

  const handleCancelClick = () => {
    setModal({ type: 'retention' });
  };

  const confirmCancel = async () => {
    setModal(null);
    await handleCheckout('cancel');
  };

  if (loading) {
    return <div className="p-6 lg:p-8 text-gray-400">載入中...</div>;
  }

  if (!me) {
    return <div className="p-6 lg:p-8 text-red-500">無法載入訂閱資訊</div>;
  }

  const usagePct = me.messages_limit > 0
    ? Math.min(100, Math.round((me.messages_used / me.messages_limit) * 100))
    : 0;

  const getPlanColor = (tier: string) => {
    if (tier === 'basic') return 'bg-emerald-400';
    if (tier === 'advanced') return 'bg-orange-400';
    return 'bg-purple-500';
  };

  const getBtnStyle = (tier: string) => {
    if (tier === 'premium') return 'bg-purple-600 hover:bg-purple-700';
    if (tier === 'advanced') return 'bg-orange-500 hover:bg-orange-600';
    return 'bg-emerald-500 hover:bg-emerald-600';
  };

  const getButtonLabel = (tier: string): string => {
    const action = getActionForTier(tier);
    if (action === 'subscribe') return '選擇方案';
    if (action === 'upgrade') return '升級方案';
    if (action === 'downgrade') return '降級方案';
    return '目前使用方案';
  };

  const matchingPlan = (tier: string) => plans.find(p => p.tier === tier);

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      <Link href="/chat" className="text-sm text-primary-600 hover:underline">
        &larr; 回對話
      </Link>

      <h1 className="text-2xl font-bold text-gray-800 mt-3 mb-1">我的訂閱</h1>
      <p className="text-sm text-gray-500 mb-6">管理你的方案、查看本月對話額度</p>

      {/* Toast */}
      {toast && (
        <div className={`mb-5 rounded-lg p-3 text-sm border ${
          toast.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {toast.msg}
        </div>
      )}

      {!me.enforcement_enabled && (
        <div className="mb-5 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
          <strong>內測階段</strong>：所有 user 預設使用 Premium 方案、暫不擋額度、不收費。正式上市後啟動 7 天免費試用 + 訂閱計費。
        </div>
      )}

      {/* 降級預約提示 */}
      {me.pending_downgrade_plan && (
        <div className="mb-5 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
          已預約降級至 <strong>{matchingPlan(me.pending_downgrade_plan)?.label || me.pending_downgrade_plan}</strong>，
          將於 {me.subscription_renews_at
            ? new Date(me.subscription_renews_at).toLocaleDateString('zh-TW')
            : '下月'} 生效。
        </div>
      )}

      {/* 取消後有效期提示 */}
      {me.cancelled_at && me.subscription_renews_at && (
        <div className="mb-5 bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-700">
          訂閱已取消，服務有效至 <strong>{new Date(me.subscription_renews_at).toLocaleDateString('zh-TW')}</strong>。
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
              {me.auto_renewal && !me.cancelled_at && me.plan !== 'trial' && me.plan !== 'cancelled' && (
                <span className="ml-2 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">自動續訂</span>
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
          {!me.is_trial && me.subscription_renews_at && !me.cancelled_at && (
            <div className="text-right">
              <div className="text-xs text-gray-500">下次扣款</div>
              <div className="text-sm font-medium text-gray-700">
                {new Date(me.subscription_renews_at).toLocaleDateString('zh-TW')}
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
          const isPending = plan.tier === me.pending_downgrade_plan;
          return (
            <div
              key={plan.tier}
              className={`bg-white border-2 rounded-xl p-5 ${
                isCurrent ? 'border-primary-500' :
                isPending ? 'border-cyan-400' :
                'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-3 h-3 rounded ${getPlanColor(plan.tier)}`} />
                    <h3 className="font-bold text-gray-800 text-lg">{plan.label}</h3>
                    {isPending && (
                      <span className="text-xs bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded">下期生效</span>
                    )}
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
              ) : isPending ? (
                <button
                  disabled
                  className="w-full sm:w-auto sm:px-8 py-2 bg-cyan-50 text-cyan-600 border border-cyan-300 rounded-lg text-sm font-medium cursor-not-allowed"
                >
                  下階段所選方案
                </button>
              ) : (
                <button
                  disabled={actionLoading}
                  onClick={() => handlePlanClick(plan.tier as PlanTier)}
                  className={`w-full sm:w-auto sm:px-8 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 ${getBtnStyle(plan.tier)}`}
                >
                  {actionLoading ? '處理中...' : getButtonLabel(plan.tier)}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* 取消訂閱 */}
      {me.plan !== 'cancelled' && me.plan !== 'trial' && !me.cancelled_at && (
        <div className="mt-6 text-center">
          <button
            onClick={handleCancelClick}
            disabled={actionLoading}
            className="text-xs text-gray-500 hover:text-gray-700 underline disabled:opacity-50"
          >
            取消訂閱
          </button>
        </div>
      )}

      {/* 確認 modal */}
      {modal?.type === 'confirm' && (() => {
        const targetPlan = matchingPlan(modal.tier);
        if (!targetPlan) return null;
        const isUpgrade = modal.action === 'upgrade';
        const isDowngrade = modal.action === 'downgrade';
        return (
          <div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
            onClick={() => !actionLoading && setModal(null)}
          >
            <div
              className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-gray-800 mb-3">
                {modal.action === 'subscribe' ? '確認訂閱' :
                 isUpgrade ? '確認升級方案' : '確認降級方案'}
              </h3>

              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-3 h-3 rounded ${getPlanColor(modal.tier)}`} />
                  <span className="font-bold">{targetPlan.label}</span>
                </div>
                <p className="text-xs text-gray-500">{targetPlan.suitable_for}</p>
              </div>

              {isUpgrade && (
                <div className="bg-orange-50 border-l-4 border-orange-400 p-3 mb-4 text-sm text-gray-700">
                  <p className="font-medium mb-1">升級說明</p>
                  <ul className="text-xs space-y-1 text-gray-600">
                    <li>試用期升級不收差額，立即切換方案</li>
                    <li>升級立即生效，您將獲得新方案的完整權限</li>
                    <li>維持每日自動扣款，續扣日不變</li>
                  </ul>
                </div>
              )}

              {isDowngrade && (
                <div className="bg-purple-50 border-l-4 border-purple-400 p-3 mb-4 text-sm text-gray-700">
                  <p className="font-medium mb-1">降級說明</p>
                  <ul className="text-xs space-y-1 text-gray-600">
                    <li>本期方案不變，降級於下個計費週期生效</li>
                    <li>本期已繳費用無法退還</li>
                    <li>下個月起自動依新方案價格 NT${targetPlan.price_twd} 扣款</li>
                  </ul>
                </div>
              )}

              {modal.action === 'subscribe' && !me.has_payment_method && (
                <div className="bg-blue-50 border-l-4 border-blue-400 p-3 mb-4 text-sm text-gray-700">
                  <p className="font-medium mb-1">首次訂閱（試用）</p>
                  <ul className="text-xs space-y-1 text-gray-600">
                    <li>您將被導向安全的紅陽金流頁面綁定信用卡</li>
                    <li>綁卡僅收取 NT$1 驗證，方案立即啟用</li>
                    <li>隔天起每日自動扣款 NT$5</li>
                  </ul>
                </div>
              )}

              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => setModal(null)}
                  disabled={actionLoading}
                  className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50"
                >
                  再考慮一下
                </button>
                <button
                  onClick={confirmAction}
                  disabled={actionLoading}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-bold text-white disabled:opacity-50 ${
                    isUpgrade ? 'bg-orange-500 hover:bg-orange-600' :
                    isDowngrade ? 'bg-purple-600 hover:bg-purple-700' :
                    'bg-primary-600 hover:bg-primary-700'
                  }`}
                >
                  {actionLoading ? '處理中...' :
                   modal.action === 'subscribe' ? (me.has_payment_method ? '確認啟用' : '前往綁卡') :
                   isUpgrade ? '確認升級' : '確認預約變更'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 取消挽留 modal */}
      {modal?.type === 'retention' && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => !actionLoading && setModal(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-purple-50 to-orange-50 p-6 text-center border-b">
              <h3 className="text-xl font-bold text-purple-700">我們很遺憾看到您想要取消</h3>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 text-center mb-4">
                AI Chatbot 是協助您在課後持續練習、內化知識的重要夥伴。在您決定離開之前：
              </p>
              <div className="bg-pink-50 border border-purple-200 rounded-lg p-4 mb-4">
                <h4 className="font-bold text-purple-700 text-sm mb-2">保留您的專屬教練，您可以：</h4>
                <ul className="text-xs text-gray-700 space-y-1.5">
                  <li><strong>持續情境演練：</strong>透過 AI 模擬真實對話，鞏固所學。</li>
                  <li><strong>24H 隨時解惑：</strong>隨時針對課程內容進行問答。</li>
                  <li><strong>鎖定學習歷程：</strong>取消後無法使用過去的對話記錄複習。</li>
                </ul>
              </div>
              <div className="bg-gray-50 border-l-4 border-gray-300 p-3 text-xs text-gray-600 mb-4">
                取消後，服務維持至本期計費週期結束。下期起不再扣款、亦無法繼續使用 AI 服務。
              </div>
            </div>
            <div className="p-6 pt-0 space-y-3">
              <button
                onClick={() => setModal(null)}
                className="w-full py-3 bg-purple-600 text-white rounded-full text-sm font-bold hover:bg-purple-700"
              >
                我改變主意了，保留我的訂閱
              </button>
              <button
                onClick={confirmCancel}
                disabled={actionLoading}
                className="w-full py-3 bg-transparent text-gray-500 border-2 border-gray-200 rounded-full text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                {actionLoading ? '處理中...' : '我已了解權益，仍要取消訂閱'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
