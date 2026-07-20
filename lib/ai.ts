// AI Edge Function 래퍼 (AGENT.md §2)
//
// 중요: AI 제공자의 API 키는 클라이언트에 절대 노출되지 않는다 (AGENT.md §10).
// 모든 AI 호출은 Supabase Edge Function(ai-input / ai-letters / ai-mission)을 통해
// 서버사이드에서 처리되며, 이 파일은 그 호출 래퍼다. (현재 서버는 OpenAI 사용 — CLAUDE.md 참고)
import { supabase } from './supabase';
import type { GuideResponse, FieldKey, ReferenceBank } from './types';

// 02단계: AI 재질문 한 턴. user_text가 null이면 해당 항목 첫 질문.
// selections: choice_groups에서 실제로 고른 값들(그룹 순서와 동일한 배열의 배열) — 직접 입력이면 생략.
export async function askInputGuide(
  conflictId: string,
  fieldKey: FieldKey,
  userText: string | null,
  selections?: string[][] | null,
): Promise<GuideResponse> {
  const { data, error } = await supabase.functions.invoke('ai-input', {
    body: { conflict_id: conflictId, field_key: fieldKey, user_text: userText, selections: selections ?? null },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as GuideResponse;
}

// 03단계: 편지 생성 재시도 — 자동 트리거(ai-input→ai-letters)가 실패해 ai_processing에
// 갇혔을 때 waiting 화면에서 호출한다. 멱등(이미 생성돼 있으면 서버가 no-op).
export async function requestLetters(conflictId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('ai-letters', {
    body: { conflict_id: conflictId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

// 04단계: 양쪽 ready 후 미션 페이퍼 생성 요청 (멱등, force면 기존 미션을 버리고 재생성)
export async function requestMission(conflictId: string, force = false): Promise<void> {
  const { data, error } = await supabase.functions.invoke('ai-mission', {
    body: { conflict_id: conflictId, force },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

// 커플 롤링 히스토리 요약 갱신 — resolved됐지만 아직 통합 안 된 맺음들을 요약에 합친다.
// 통합할 것이 없으면 서버가 no-op이라 반복 호출에 안전. fire-and-forget으로 쓴다.
export async function requestHistoryUpdate(coupleId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('ai-history', {
    body: { couple_id: coupleId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

// 관계 프로필 설정/수정 완료 시 개인화 레퍼런스 뱅크 생성 요청
export async function requestReferenceBank(profileId: string): Promise<ReferenceBank> {
  const { data, error } = await supabase.functions.invoke('ai-reference-bank', {
    body: { profile_id: profileId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.reference_bank as ReferenceBank;
}
