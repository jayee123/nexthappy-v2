import { supabaseAdmin } from './supabase';

export const POINT_RULES = {
  DAILY_COMPLETE: 10,
  STREAK_3_DAYS: 20,    // 連續3天額外獎勵
  JOURNAL_COMPLETE: 5,
  AI_CONSULT: 3,
  WEEK1_MILESTONE: 50,
  WEEK2_MILESTONE: 50,
  DAY21_COMPLETE: 100,
} as const;

export const BADGES = {
  STREAK_3: { id: 'streak_3days', name: '堅持 3 天', points: 20 },
  WEEK1: { id: 'week1_observer', name: '關係觀察者', points: 50 },
  WEEK2: { id: 'week2_transformer', name: '語言轉換師', points: 50 },
  DAY21: { id: 'day21_practitioner', name: '幸福實踐者', points: 100 },
} as const;

// 新增積分
export async function addPoints(journeyId: string, points: number): Promise<void> {
  await supabaseAdmin.rpc('add_journey_points', { p_journey_id: journeyId, p_points: points });
}

// 解鎖徽章
export async function unlockBadge(
  journeyId: string,
  badgeId: string,
  badgeName: string,
  points: number
): Promise<boolean> {
  // 檢查是否已解鎖
  const { data: existing } = await supabaseAdmin
    .from('achievements')
    .select('id')
    .eq('journey_id', journeyId)
    .eq('badge_id', badgeId)
    .single();

  if (existing) return false; // 已解鎖，跳過

  await supabaseAdmin.from('achievements').insert({
    journey_id: journeyId,
    badge_id: badgeId,
    badge_name: badgeName,
    points,
  });

  await addPoints(journeyId, points);
  return true;
}

// 檢查並觸發里程碑
export async function checkMilestones(journeyId: string, dayNumber: number): Promise<string[]> {
  const unlockedBadges: string[] = [];

  if (dayNumber === 3) {
    const unlocked = await unlockBadge(journeyId, BADGES.STREAK_3.id, BADGES.STREAK_3.name, BADGES.STREAK_3.points);
    if (unlocked) unlockedBadges.push(BADGES.STREAK_3.name);
  }

  if (dayNumber === 7) {
    const unlocked = await unlockBadge(journeyId, BADGES.WEEK1.id, BADGES.WEEK1.name, BADGES.WEEK1.points);
    if (unlocked) unlockedBadges.push(BADGES.WEEK1.name);
  }

  if (dayNumber === 14) {
    const unlocked = await unlockBadge(journeyId, BADGES.WEEK2.id, BADGES.WEEK2.name, BADGES.WEEK2.points);
    if (unlocked) unlockedBadges.push(BADGES.WEEK2.name);
  }

  if (dayNumber === 21) {
    const unlocked = await unlockBadge(journeyId, BADGES.DAY21.id, BADGES.DAY21.name, BADGES.DAY21.points);
    if (unlocked) unlockedBadges.push(BADGES.DAY21.name);
  }

  return unlockedBadges;
}
