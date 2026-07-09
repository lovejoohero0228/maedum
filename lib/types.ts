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
  title: string | null; // 주제 요약 제목 — ai-letters가 분석과 함께 생성 (구 레코드는 null)
  created_at: string;
  updated_at: string;
}

// 한 턴에 여러 주제(시점/장소/구체적 말 등)를 동시에 물을 때, 주제별로 묶인 선택지 세트.
// 기본은 복수 선택 + "해당 없음" + 그룹별 직접 입력 — 메타데이터로 그룹별 오버라이드 가능.
export interface ChoiceGroup {
  label: string;
  choices: string[];
  // 'single'이면 하나만 고르는 그룹 (의도 인식, 반복 여부, 스케일 등). 생략 시 'multi'.
  select?: 'single' | 'multi';
  // 'scale'이면 1~10 숫자 스케일 UI로 렌더링 (choices는 "N — 설명" 형태, 서버 고정 룰 전용)
  kind?: 'scale' | 'list';
  // false면 "해당 없음" 보기를 붙이지 않는다 (생략 시 true)
  allow_none?: boolean;
  // false면 그룹별 직접 입력을 숨긴다 (생략 시 true)
  allow_custom?: boolean;
}

export interface ChatEntry {
  role: 'user' | 'assistant';
  field: string;
  content: string;
  // assistant 엔트리: 이 턴에서 제시한 선택지 그룹들 (없으면 자유서술형 질문)
  choice_groups?: ChoiceGroup[] | null;
  // user 엔트리: 선택지에서 답한 경우, choice_groups와 같은 순서로 각 그룹에서 고른 값들
  // (직접 입력한 자유서술 답변이면 null)
  selections?: string[][] | null;
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
  request_need: string | null;
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
  // 007 이후 생성된 뱅크에만 존재 — "바라는 것" 뒤의 욕구/이해관계 보기
  need_words?: string[];
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

// prevent(재발 방지 습관) / differently(다음엔 다르게) / empathy(이해해볼 상대 속마음)
// — habit/acknowledge/action은 개편 전에 생성된 레거시 레코드용
export type MissionType =
  | 'prevent'
  | 'differently'
  | 'empathy'
  | 'habit'
  | 'acknowledge'
  | 'action';

export interface MissionItem {
  text: string;
  type: MissionType;
}

export interface ConvoStep {
  step: number;
  who: 'a' | 'b' | 'both';
  // title/listener는 개편 후 생성분에만 존재 (단계 이름 / 그때 상대가 들어줄 자세)
  title?: string | null;
  text: string;
  listener?: string | null;
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
  mindset_a: string | null;
  mindset_b: string | null;
  mission_a: MissionItem[] | null;
  mission_b: MissionItem[] | null;
  convo_guide: ConvoStep[] | null;
  convo_note: string | null;
}

// ai-input Edge Function의 응답 봉투 (prompts/input_guide.ts 출력 형식)
export type FlagType = 'warn' | 'ok' | 'purple';

export interface GuideEnvelope {
  type: 'question' | 'clarify' | 'confirm' | 'next';
  flag: FlagType | null;
  flag_text: string | null;
  message: string;
  choice_groups: ChoiceGroup[] | null;
  extracted_value: string | null;
  field_complete: boolean;
}

export interface GuideResponse extends GuideEnvelope {
  next_field: string | null;
  all_complete: boolean;
  // field_complete 시 서버가 다음 항목의 첫 질문을 같은 응답에 실어 보낸다 (왕복/대기 1회 절약).
  // null이면(생성 실패 등) 클라이언트가 startField로 폴백한다.
  next_question?: (GuideEnvelope & { field: string }) | null;
  // 다음 항목이 이미 대화로 커버돼 질문 없이 0턴 완료된 경우, 그 항목들의 완료 멘트
  skipped?: { field: string; message: string }[];
}

// 02단계 수집 항목 순서 — prompts/input_guide.ts와 동일 키.
// 논리 단위 6개 섹션으로 통합: 각 섹션이 여러 DB 컬럼에 대응할 수 있다 (매핑은 ai-input).
export const FIELD_ORDER = [
  'trigger_moment', // → trigger_moment
  'hurt_context', // → first_hurt_moment + context_tags + context_detail
  'feelings', // → conflict_scale + emotion_scale + emotion_words
  'partner_mind', // → partner_intention + partner_perspective_words
  'request', // → request_raw + request_need + request_refined
  'my_reflection', // → my_reflection
] as const;

export type FieldKey = (typeof FIELD_ORDER)[number];

// 항목 네비게이터/재시작 UI용 짧은 라벨 (prompts/input_guide.ts의 label과 동일 의미)
export const FIELD_LABELS: Record<FieldKey, string> = {
  trigger_moment: '상황',
  hurt_context: '갈등 발생 순간',
  feelings: '내 마음',
  request: '바라는 것',
  partner_mind: '상대 마음',
  my_reflection: '나의 반성',
};
