'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface BillingMe {
  plan: string;
  plan_label: string;
  messages_used: number;
  messages_limit: number;
  messages_remaining: number;
  is_trial: boolean;
  enforcement_enabled: boolean;
}

export default function UsageChip() {
  const [me, setMe] = useState<BillingMe | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/billing/me')
      .then(r => r.json())
      .then(j => {
        if (!cancelled && j.data) setMe(j.data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!me) return null;

  if (!me.enforcement_enabled) {
    return (
      <Link
        href="/settings/billing"
        className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-medium hover:bg-amber-100"
        title="內測階段：所有 user 預設 Premium、不擋額度"
      >
        內測
      </Link>
    );
  }

  const pct = me.messages_limit > 0
    ? Math.min(100, (me.messages_used / me.messages_limit) * 100)
    : 0;

  const colorCls = pct >= 90
    ? 'text-red-700 bg-red-50 border-red-200 hover:bg-red-100'
    : pct >= 70
    ? 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100'
    : 'text-green-700 bg-green-50 border-green-200 hover:bg-green-100';

  return (
    <Link
      href="/settings/billing"
      className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${colorCls}`}
      title={`${me.plan_label} · 本月剩 ${me.messages_remaining} 則`}
    >
      {me.messages_remaining}/{me.messages_limit}
      {me.is_trial && <span className="ml-0.5">試</span>}
    </Link>
  );
}
