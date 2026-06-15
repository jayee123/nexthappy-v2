// =============================================================
// v3.0 Phase 2 Task 5：Personality MBTI → axes mapping
// =============================================================
// 規格：docs/v2.1-course-spec.md v1.1.1 §1.16.3 / §1.16.6
//
// 用途：
//   Phase 2 起，AI Tutor 按 user 的 personality bias 動態調整教學風格
//   （T-lead vs F-lead 等）。此 helper 從 MBTI 4 字母簡單推導 personality
//   axes 初始值，供 user_state.detected_personality_axes 使用。
//
// Phase 2 簡化版：直接用 ±0.7 base bias（不 live-detect）
// Phase 2.5 將加 live-detect：從對話 pattern 動態調整這些 bias 值。
//
// 對應 supabase/migrations/004_v3.0_user_state.sql 內 SQL UPDATE 邏輯。
// =============================================================

/**
 * Personality axes — 4 維度浮動 bias，值域 -1.0 ~ +1.0
 *
 * 慣例（spec §1.16.3）：
 * - E_I: +1.0 = 極 E（外向）；-1.0 = 極 I（內向）
 * - S_N: +1.0 = 極 N（直覺）；-1.0 = 極 S（感官）
 * - T_F: +1.0 = 極 T（思維）；-1.0 = 極 F（情感）
 * - J_P: +1.0 = 極 J（判斷）；-1.0 = 極 P（感知）
 *
 * 0 = 中性 / 未知
 */
export interface PersonalityAxes {
  E_I: number;
  S_N: number;
  T_F: number;
  J_P: number;
}

const NEUTRAL_AXES: PersonalityAxes = {
  E_I: 0,
  S_N: 0,
  T_F: 0,
  J_P: 0,
};

const BASE_BIAS = 0.7; // Phase 2 base bias; Phase 2.5 live-detect 會動態調整

/**
 * 從 MBTI 4 字母推導 personality axes 初始值。
 *
 * @param mbti - 4 字母 MBTI 字串（例：'INTJ' / 'ENFP'）。大小寫不敏感。
 * @returns PersonalityAxes 物件
 *
 * 範例：
 *   mbtiToPersonalityAxes('ENTJ') →
 *     { E_I: +0.7, S_N: +0.7, T_F: +0.7, J_P: +0.7 }
 *   mbtiToPersonalityAxes('INTJ') →
 *     { E_I: -0.7, S_N: +0.7, T_F: +0.7, J_P: +0.7 }
 *   mbtiToPersonalityAxes('') →
 *     { E_I: 0, S_N: 0, T_F: 0, J_P: 0 }  // 中性
 */
export function mbtiToPersonalityAxes(mbti: string | null | undefined): PersonalityAxes {
  if (!mbti || mbti.length !== 4) {
    return { ...NEUTRAL_AXES };
  }

  const upper = mbti.toUpperCase();
  const [e_i, s_n, t_f, j_p] = upper.split('') as [string, string, string, string];

  return {
    E_I: e_i === 'E' ? BASE_BIAS : -BASE_BIAS,
    S_N: s_n === 'N' ? BASE_BIAS : -BASE_BIAS,
    T_F: t_f === 'T' ? BASE_BIAS : -BASE_BIAS,
    J_P: j_p === 'J' ? BASE_BIAS : -BASE_BIAS,
  };
}

/**
 * 從 personality axes 判斷 user 是 T-leading 還是 F-leading。
 * 用於 §1.16.4 Tailoring Matrix 風格選擇。
 *
 * @param axes - PersonalityAxes 物件
 * @returns 'T-leading' | 'F-leading' | 'neutral'
 *
 * 慣例：
 *   T_F > +0.3 → T-leading
 *   T_F < -0.3 → F-leading
 *   |T_F| <= 0.3 → neutral（採 F-leading 為 safe default，依 §1.16.2.A）
 */
export function getTfStyle(axes: PersonalityAxes): 'T-leading' | 'F-leading' | 'neutral' {
  if (axes.T_F > 0.3) return 'T-leading';
  if (axes.T_F < -0.3) return 'F-leading';
  return 'neutral';
}

/**
 * 給 prompt 用：把 personality axes 轉成簡短可讀的描述。
 * 例：'ENTJ: E+0.7 / N+0.7 / T+0.7 / J+0.7 (T-leading)'
 *
 * 用於 buildContext.ts 動態 branching（Phase 2 Task 3）注入 prompt 時使用。
 */
export function formatPersonalityAxes(axes: PersonalityAxes, mbti?: string | null): string {
  const sign = (v: number) => (v >= 0 ? `+${v.toFixed(1)}` : v.toFixed(1));
  const ei = axes.E_I >= 0 ? `E${sign(axes.E_I)}` : `I${sign(Math.abs(axes.E_I))}`;
  const sn = axes.S_N >= 0 ? `N${sign(axes.S_N)}` : `S${sign(Math.abs(axes.S_N))}`;
  const tf = axes.T_F >= 0 ? `T${sign(axes.T_F)}` : `F${sign(Math.abs(axes.T_F))}`;
  const jp = axes.J_P >= 0 ? `J${sign(axes.J_P)}` : `P${sign(Math.abs(axes.J_P))}`;
  const style = getTfStyle(axes);
  const mbtiPart = mbti ? `${mbti}: ` : '';
  return `${mbtiPart}${ei} / ${sn} / ${tf} / ${jp} (${style})`;
}
