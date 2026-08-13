import { describe, test, expect } from 'vitest';
import { mapMarketPlanToTier } from '../plan';
import { PLANS } from '@/lib/billing/plans';

// 公版 current_plan 是私版方案的唯一真值來源。對應錯了，用戶會拿到錯誤額度，
// 所以這層映射必須有測試守著。

describe('mapMarketPlanToTier', () => {
  test('公版 free 對到私版 trial（私版沒有 free 層級）', () => {
    expect(mapMarketPlanToTier('free')).toBe('trial');
  });

  test('同名方案直接對應', () => {
    expect(mapMarketPlanToTier('basic')).toBe('basic');
    expect(mapMarketPlanToTier('advanced')).toBe('advanced');
    expect(mapMarketPlanToTier('premium')).toBe('premium');
    expect(mapMarketPlanToTier('cancelled')).toBe('cancelled');
  });

  test('認不得的方案回 null，讓呼叫端 fallback 到本地值', () => {
    expect(mapMarketPlanToTier('enterprise')).toBeNull();
    expect(mapMarketPlanToTier('')).toBeNull();
    expect(mapMarketPlanToTier(null)).toBeNull();
    expect(mapMarketPlanToTier(undefined)).toBeNull();
  });

  test('每個對應結果都是 PLANS 裡真實存在的方案', () => {
    for (const marketPlan of ['free', 'basic', 'advanced', 'premium', 'cancelled']) {
      const tier = mapMarketPlanToTier(marketPlan);
      expect(tier, `${marketPlan} 應對得到方案`).not.toBeNull();
      expect(PLANS[tier!], `${tier} 應存在於 PLANS`).toBeDefined();
    }
  });
});

describe('方案額度與公版對齊', () => {
  // 公版 public.plans 的 monthly_dialog_count：basic 50 / advanced 100 / premium 200
  test.each([
    ['basic', 50],
    ['advanced', 100],
    ['premium', 200],
  ] as const)('%s 每月額度應為 %i 則', (tier, expected) => {
    expect(PLANS[tier].monthly_messages).toBe(expected);
  });
});
