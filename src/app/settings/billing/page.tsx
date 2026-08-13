'use client';

/**
 * /settings/billing —— 我的方案（唯讀）
 *
 * 付費統一在公版（NUWA Market）。私版不再提供訂閱、升降級、綁卡、取消，
 * 方案真值由 src/lib/market/plan.ts 從公版 public.users.current_plan 讀回來。
 * 這頁只做兩件事：顯示目前方案與用量、把要調整方案的人送去公版。
 */

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { MARKET_SUBSCRIBE_URL } from '@/lib/market';

type PlanTier = 'trial' | 'basic' | 'advanced' | 'premium' | 'cancelled';

interface BillingMe {
  plan: PlanTier;
  plan_label: string;
  period_start: string;
  messages_used: number;
  messages_limit: number;
  messages_remaining: number;
  is_trial: boolean;
  trial_expires_at: string | null;
  enforcement_enabled: boolean;
  subscription_renews_at: string | null;
  cancelled_at: string | null;
}

interface PlanSpec {
  tier: string;
  label: string;
  tagline: string;
  monthly_messages: number;
  suitable_for: string;
  features: string[];
}

const USAGE_WARN_PCT = 70;
const USAGE_DANGER_PCT = 90;

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('zh-TW');
}

export default function BillingPageWrapper() {
  return (
    <Suspense fallback={<div className="p-6 lg:p-8 text-gray-400">載入中...</div>}>
      <BillingPage />
    </Suspense>
  );
}

function BillingPage() {
  const [me, setMe] = useState<BillingMe | null>(null);
  const [plans, setPlans] = useState<PlanSpec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [meRes, plansRes] = await Promise.all([
          fetch('/api/billing/me'),
          fetch('/api/billing/plans'),
        ]);

        if (!meRes.ok) throw new Error('無法載入訂閱資訊');

        const meJson = await meRes.json();
        const plansJson = plansRes.ok ? await plansRes.json() : { data: { plans: [] } };

        if (cancelled) return;
        setMe(meJson.data);
        setPlans(plansJson.data?.plans ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '載入失敗，請稍後再試');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <div className="p-6 lg:p-8 text-gray-400">載入中...</div>;
  }

  if (error || !me) {
    return <div className="p-6 lg:p-8 text-red-500">{error ?? '無法載入訂閱資訊'}</div>;
  }

  const usagePct =
    me.messages_limit > 0
      ? Math.min(100, Math.round((me.messages_used / me.messages_limit) * 100))
      : 0;
  const barColor =
    usagePct >= USAGE_DANGER_PCT
      ? 'bg-red-500'
      : usagePct >= USAGE_WARN_PCT
        ? 'bg-amber-500'
        : 'bg-primary-500';

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto">
      <Link href="/chat" className="text-sm text-gray-400 hover:text-gray-600">
        ← 回對話
      </Link>
      <h1 className="text-2xl font-bold text-gray-800 mt-3 mb-1">我的方案</h1>
      <p className="text-sm text-gray-500 mb-6">查看目前方案與本月對話額度</p>

      {/* 目前方案 */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 mb-4">
        <p className="text-xs text-gray-400">目前方案</p>
        <p className="text-xl font-bold text-gray-800 mt-0.5">{me.plan_label}</p>

        <div className="mt-4">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-gray-600">本月已用對話次數</span>
            <span className="tabular-nums text-gray-800">
              {me.messages_used} / {me.messages_limit}
              <span className="ml-2 text-xs text-gray-400">（剩 {me.messages_remaining}）</span>
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-gray-100">
            <div className={`h-full ${barColor}`} style={{ width: `${usagePct}%` }} />
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-xs text-gray-500">
          <div>
            <dt>計算週期</dt>
            <dd className="text-gray-700">{formatDate(me.period_start)} 起（每月重置）</dd>
          </div>
          {me.is_trial && me.trial_expires_at && (
            <div>
              <dt>試用到期</dt>
              <dd className="text-gray-700">{formatDate(me.trial_expires_at)}</dd>
            </div>
          )}
          {me.subscription_renews_at && (
            <div>
              <dt>續訂日</dt>
              <dd className="text-gray-700">{formatDate(me.subscription_renews_at)}</dd>
            </div>
          )}
        </dl>

        {!me.enforcement_enabled && (
          <p className="mt-4 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
            內測階段：暫不擋額度。
          </p>
        )}
      </section>

      {/* 去公版調整方案 */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 mb-6">
        <p className="text-sm font-medium text-gray-800">要升級、降級或取消訂閱？</p>
        <p className="mt-1 text-sm text-gray-500">
          方案與付款統一由 NUWA 平台管理，調整後這裡會同步更新。
        </p>
        <a
          href={MARKET_SUBSCRIBE_URL}
          className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-primary-600 px-4 py-3 text-sm font-medium text-white hover:bg-primary-700"
        >
          前往 NUWA 管理訂閱
        </a>
      </section>

      {/* 方案一覽（唯讀） */}
      {plans.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-800">方案一覽</h2>
          <div className="space-y-3">
            {plans.map((p) => {
              const isCurrent = p.tier === me.plan;
              return (
                <div
                  key={p.tier}
                  className={`rounded-2xl border bg-white p-4 ${
                    isCurrent ? 'border-primary-500' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-800">{p.label}</span>
                    {isCurrent && (
                      <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-medium text-primary-700">
                        目前方案
                      </span>
                    )}
                    <span className="ml-auto text-xs text-gray-500">
                      每月 {p.monthly_messages} 則
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">{p.tagline}</p>
                  <ul className="mt-2 space-y-1 text-xs text-gray-600">
                    {p.features.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
