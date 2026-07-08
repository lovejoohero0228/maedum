// 공용 도메인 타입 — supabase/migrations/001_initial.sql 스키마와 1:1

export type ConflictStatus =
  | 'waiting_partner'
  | 'both_inputting'
  | 'ai_processing'
  | 'letters_delivered'
  | 'waiting_ready'
  | 'mission_unlocked'
  | 'resolved';

export interface Profile {
  id: string;
  display_name: string;
  push_token: string | null;
}

export interface Couple {
  id: string;
  user_a_id: string;
  user_b_id: string;
}

export interface Conflict {
  id: string;
  couple_id: string;
  initiator_id: string;
  status: ConflictStatus;
  created_at: string;
  updated_at: string;
}

export interface ChatEntry {
  role: 'user' | 'assistant';
  field: string;
  content: string;
  // assistant 엔트리에만 채워짐 — 새로고침 후 선택지+강조 상태를 복원하기 위한 메타데이터
  choices?: string[] | null;
  multi_select?: boolean;
}

export interface ConflictInput {
  id: string;
  conflict_id: string;
  user_id: string;
  trigger_moment: string | null;
  first_hurt_moment: string | null;
  context_tags: string[] | null;
  context_detail: string | null;
  conflict_scale: number | null;
  emotion_scale: number | null;
  emotion_words: string[] | null;
  request_raw: string | null;
  request_refined: string | null;
  partner_intention: string | null;
  partner_perspective_words: string[] | null;
  my_reflection: string | null;
  chat_log: ChatEntry[];
  is_complete: boolean;
  completed_at: string | null;
}

// 관계 프로필 (supabase/migrations/004_relationship_profile.sql)
export type RelationshipType = '연인' | '부부' | '썸' | '친구' | '자매' | '형제' | '기타';

export interface ReferenceBank {
  trigger_categories: string[];
  context_tags: string[];
  emotion_words: Record<string, string[]>;
  partner_perspective_words: string[];
}

export interface RelationshipProfile {
  id: string;
  couple_id: string;
  user_id: string;
  relationship_type: RelationshipType;
  relationship_duration_months: number | null;
  my_personality_tags: string[];
  partner_personality_tags: string[];
  frequent_conflict_topics: string[];
  reference_bank: ReferenceBank | null;
  reference_bank_generated_at: string | null;
  is_complete: boolean;
  created_at: string;
  updated_at: string;
}

export type MissionType = 'habit' | 'acknowledge' | 'action';

export interface MissionItem {
  text: string;
  type: MissionType;
}

export interface ConvoStep {
  step: number;
  who: 'a' | 'b' | 'both';
  text: string;
}

export interface AnalysisTiming {
  person_a: { name: string; when: string; why: string };
  person_b: { name: string; when: string; why: string };
  summary: string;
}

export interface AnalysisTemperature {
  scale_diff_explanation: string;
  main_text: string;
}

export interface AnalysisUnderstanding {
  a_understands_b: string;
  b_understands_a: string;
  bridge_text: string;
}

export interface ConflictOutputs {
  id: string;
  conflict_id: string;
  letter_a_to_b: string | null;
  letter_b_to_a: string | null;
  analysis_timing: string | null;        // JSON 문자열 (AnalysisTiming)
  analysis_temperature: string | null;   // JSON 문자열 (AnalysisTemperature)
  analysis_understanding: string | null; // JSON 문자열 (AnalysisUnderstanding)
  mission_a: MissionItem[] | null;
  mission_b: MissionItem[] | null;
  convo_guide: ConvoStep[] | null;
  convo_note: string | null;
}

// ai-input Edge Function의 응답 봉투 (prompts/input_guide.ts 출력 형식)
export type FlagType = 'warn' | 'ok' | 'purple';

export interface GuideResponse {
  type: 'question' | 'clarify' | 'confirm' | 'next';
  flag: FlagType | null;
  flag_text: string | null;
  message: string;
  choices: string[] | null;
  multi_select?: boolean;
  extracted_value: string | null;
  field_complete: boolean;
  next_field: string | null;
  all_complete: boolean;
}

// 02단계 수집 항목 순서 (AGENT.md §4-2) — prompts/input_guide.ts와 동일 키
export const FIELD_ORDER = [
  'trigger_moment',
  'first_hurt_moment',
  'context',
  'scales',
  'emotion_words',
  'request',
  'partner_intention',
  'partner_perspective',
  'my_reflection',
] as const;

export type FieldKey = (typeof FIELD_ORDER)[number];
