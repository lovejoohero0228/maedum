// 02단계: AI 재질문 로직 (AGENT.md §2, §4-2)
import { supabase } from '@/lib/supabase';
import { askInputGuide } from '@/lib/ai';
import { FIELD_ORDER } from '@/lib/types';
import type { ChatEntry, ConflictInput, FieldKey, GuideResponse } from '@/lib/types';

// 현재 항목의 첫 질문 요청
export function startField(conflictId: string, fieldKey: FieldKey): Promise<GuideResponse> {
  return askInputGuide(conflictId, fieldKey, null);
}

// 사용자 답변(선택지 or 자유 입력) 전송
export function answerField(
  conflictId: string,
  fieldKey: FieldKey,
  text: string,
  selections?: string[][] | null,
): Promise<GuideResponse> {
  return askInputGuide(conflictId, fieldKey, text, selections);
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

// 각 항목이 conflict_inputs에서 차지하는 컬럼 (ai-input의 columnsForField와 대칭)
const FIELD_COLUMNS: Record<FieldKey, string[]> = {
  trigger_moment: ['trigger_moment'],
  first_hurt_moment: ['first_hurt_moment'],
  context: ['context_tags', 'context_detail'],
  scales: ['conflict_scale', 'emotion_scale'],
  emotion_words: ['emotion_words'],
  request: ['request_raw', 'request_need', 'request_refined'],
  partner_intention: ['partner_intention'],
  partner_perspective: ['partner_perspective_words'],
  my_reflection: ['my_reflection'],
};

// fromField부터(포함) 끝까지 내 응답을 초기화한다 — 상대의 입력에는 손대지 않는다.
// 뒤 항목의 질문/선택지는 앞 항목의 답변을 근거로 생성되므로, 중간 항목만 바꾸고
// 뒤를 남겨두면 대화가 어긋난다. 그래서 되돌아간 지점 이후는 함께 지운다.
// 반환값: 잘라낸 뒤 남은 chat_log (화면 말풍선 복원용)
export async function restartFromField(
  conflictId: string,
  userId: string,
  fromField: FieldKey,
): Promise<ChatEntry[]> {
  // 편지 생성이 시작된 뒤에는 수정 불가
  const { data: conflict, error: conflictError } = await supabase
    .from('conflicts')
    .select('status')
    .eq('id', conflictId)
    .single();
  if (conflictError) throw conflictError;
  if (conflict.status !== 'waiting_partner' && conflict.status !== 'both_inputting') {
    throw new Error('이미 편지 작성이 시작돼 응답을 수정할 수 없어요.');
  }

  const input = await getMyInput(conflictId, userId);
  if (!input) return [];

  const fromIdx = FIELD_ORDER.indexOf(fromField);
  const keptLog = (input.chat_log ?? []).filter((e) => {
    const idx = FIELD_ORDER.indexOf(e.field as FieldKey);
    return idx !== -1 && idx < fromIdx;
  });

  const patch: Record<string, unknown> = {
    chat_log: keptLog,
    is_complete: false,
    completed_at: null,
  };
  for (const fieldKey of FIELD_ORDER.slice(fromIdx)) {
    for (const column of FIELD_COLUMNS[fieldKey]) patch[column] = null;
  }

  const { error } = await supabase.from('conflict_inputs').update(patch).eq('id', input.id);
  if (error) throw error;
  return keptLog;
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
