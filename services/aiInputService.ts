// 02단계: AI 재질문 로직 (AGENT.md §2, §4-2)
import { supabase } from '@/lib/supabase';
import { askInputGuide } from '@/lib/ai';
import type { ConflictInput, FieldKey, GuideResponse } from '@/lib/types';

// 현재 항목의 첫 질문 요청
export function startField(conflictId: string, fieldKey: FieldKey): Promise<GuideResponse> {
  return askInputGuide(conflictId, fieldKey, null);
}

// 사용자 답변(선택지 or 자유 입력) 전송
export function answerField(
  conflictId: string,
  fieldKey: FieldKey,
  text: string,
): Promise<GuideResponse> {
  return askInputGuide(conflictId, fieldKey, text);
}

export async function getMyInput(
  conflictId: string,
  userId: string,
): Promise<ConflictInput | null> {
  const { data, error } = await supabase
    .from('conflict_inputs')
    .select('*')
    .eq('conflict_id', conflictId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// 상대 입력 완료 여부 (outputs 생성 전에는 RLS로 본인 것만 보이므로 개수로 판단 불가 —
// 자신의 row + 완료 이벤트 구독으로 확인. 여기서는 전체 완료 수를 세는 대신
// conflicts.status가 ai_processing 이상인지로 판단한다)
export async function isPartnerComplete(conflictId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('conflicts')
    .select('status')
    .eq('id', conflictId)
    .single();
  if (error) throw error;
  return data.status !== 'waiting_partner' && data.status !== 'both_inputting';
}
