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

// 04단계: 양쪽 ready 후 미션 페이퍼 생성 요청 (멱등)
export async function requestMission(conflictId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('ai-mission', {
    body: { conflict_id: conflictId },
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
