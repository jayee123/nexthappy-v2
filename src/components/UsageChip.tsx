// 放置路徑：src/components/UsageChip.tsx
//
// Phase 1A：chat header 用量小 chip
// v1.5.x：對外顯示改「訂閱」（Pearl 設計、Steve 拍板拿掉 💎 只留純文字）、tooltip 保留「內測」實際狀態說明
//
// 顯示：
//   - 內測模式（enforcement_enabled=false）：「訂閱」amber chip、tooltip 說明實際內測狀態
//   - 正式模式：「剩 65 / 80」chip、顏色按用量比例（綠 / 黃 / 紅）
//   - Hover / 點擊 → 跳 /settings/billing

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
      .catch(() => { /* 失敗就不顯示、不影響 chat */ });
    return () => { cancelled = true; };
  }, []);

  if (!me) return null;

  // 內測模式（v1.5.x：對外顯示「💎 訂閱」、實際仍是內測、tooltip 說明）
  if (!me.enforcement_enabled) {
    return (
      <Link
        href="/settings/billing"
        className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-medium hover:bg-amber-100"
        title="目前為 Premium 內測、無用量限制（方案由 NUWA 平台管理，正式計費後 chip 會顯示實際用量）"
      >
        訂閱
      </Link>
    );
  }

  // 正式模式
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
