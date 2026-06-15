// =============================================
// 21天幸福關係練習系統 - TypeScript 型別定義
// =============================================

export type RelationshipType = 'couple' | 'parent_child' | 'workplace';
export type MbtiType = string; // e.g. 'INFP', 'ENTJ'
export type ContextType = 'morning' | 'realtime' | 'evening' | 'onboarding';
export type CompletionType = 'success' | 'partial' | 'failed';

export interface User {
  id: string;
  email: string;
  name: string | null;
  invite_code: string | null;
  nuwa_user_id: string | null;
  created_at: string;
  // v1.3.0 Phase 2 Migration 005: MBTI global 化
  mbti_self: MbtiType | null;                            // global ground truth、跨 mode + 跨 round
  mbti_confidence: 'low' | 'medium' | 'high';            // schema default 'medium'
  mbti_set_at: string | null;                            // 第一次設 MBTI 的時間（onboarding completion 訊號）
}

export interface Journey {
  id: string;
  user_id: string;
  // v1.3.0+: nullable — NULL = inherit users.mbti_self（推薦預設）；override 罕見場景才填
  mbti_self: MbtiType | null;
  mbti_partner: MbtiType | null;
  mbti_confidence: 'low' | 'medium' | 'high';
  partner_nickname: string;
  relationship_type: RelationshipType;
  goal_statement: string | null;
  initial_problem: string | null;
  start_date: string;
  current_day: number;
  is_active: boolean;
  total_points: number;
  // v2.1: 多輪練習支援
  round_number: number;         // 第幾輪（1, 2, 3...）
  round_label: string | null;   // 這輪的名稱 / 標籤（e.g. "和老婆第 1 輪"）
  created_at: string;
}

// v2.1: MBTI 氣質分組
export type Temperament = 'NF' | 'NT' | 'SJ' | 'SP';

// v2.1: MBTI 16 型檔案（對應 mbti_profiles 表）
export interface MbtiProfile {
  mbti_type: MbtiType;           // PK：'INFJ', 'ENFP' 等
  temperament: Temperament;      // 'NF' | 'NT' | 'SJ' | 'SP'
  core_tagline: string;          // 核心一句話
  blindspot: string;             // 盲點
  desire: string;                // 渴望
  landmine: string;              // 地雷
  unlock: string;                // 解鎖
  created_at: string;
  updated_at: string;
}

// v2.1: 盲點與技能編碼
export type BlindspotCode = 'B1' | 'B2' | 'B3' | 'B4' | 'B5';
export type SkillCode = 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6';

// v2.1: 盲點分類（對應 blindspot_taxonomy 表）
export interface BlindspotTaxonomy {
  code: BlindspotCode;           // PK：'B1' ~ 'B5'
  name: string;                  // 「猴子給香蕉」、「假性 NVC」等
  definition: string;            // 定義
  missing_skills: SkillCode[];   // 對應缺失的技能（S1~S6）
  typical_phrases: string | null;// 典型語句範例
  remediation: string | null;    // 補救建議
  created_at: string;
}

// v2.1: 盲點觸發紀錄（對應 blindspot_records 表）
export interface BlindspotRecord {
  id: string;
  journey_id: string;
  day_number: number;
  blindspot_code: BlindspotCode;
  context_type: ContextType;
  trigger_snippet: string | null; // User 說出的片段
  ai_feedback: string | null;     // AI 當下給的回饋
  detected_at: string;
}

export interface DailyRecord {
  id: string;
  journey_id: string;
  day_number: number;
  date: string;
  task_completed: boolean;
  completion_type: CompletionType | null;
  emotion_score: number | null;
  journal_text: string | null;
  points_earned: number;
  created_at: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface Conversation {
  id: string;
  journey_id: string;
  day_number: number;
  context_type: ContextType;
  messages: ChatMessage[];
  created_at: string;
}

export interface DailyMemory {
  id: string;
  journey_id: string;
  day_number: number;
  emotion_note: string | null;
  task_result: string | null;
  partner_obs: string | null;
  key_insight: string | null;
  follow_up: string | null;
  created_at: string;
}

export interface Achievement {
  id: string;
  journey_id: string;
  badge_id: string;
  badge_name: string;
  earned_at: string;
  points: number;
}

export interface CourseContent {
  id: string;
  day_number: number;
  theme: string;
  subtitle: string | null;
  course_unit: string | null;
  knowledge_point: string;
  today_task: string;
  evening_questions: string[];
  special_content: Record<string, unknown>;
}

// API 回應格式
export interface ApiResponse<T = unknown> {
  data: T | null;
  error: string | null;
  timestamp: string;
}

// Day 0 設定資料
export interface OnboardingData {
  mbti_self: MbtiType;
  mbti_partner?: MbtiType;
  mbti_confidence: 'low' | 'medium' | 'high';
  partner_nickname: string;
  relationship_type: RelationshipType;
  goal_statement?: string;
  initial_problem?: string;
  // v2.1: 多輪練習
  round_number?: number;         // 預設 1；第 N 輪時從前端傳入
  round_label?: string;          // 使用者自訂標籤（e.g. "和老婆第 1 輪"）
}

// 進度統計
export interface ProgressStats {
  current_day: number;
  total_days: number;
  completed_days: number;
  completion_rate: number;
  total_points: number;
  achievements: Achievement[];
  daily_records: DailyRecord[];
  journey: Journey;
}

// 今日資訊
export interface TodayInfo {
  day_number: number;
  course: CourseContent;
  record: DailyRecord | null;
  conversation: Conversation | null;
  memories: DailyMemory[];
}
