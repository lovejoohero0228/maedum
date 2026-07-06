// 03단계: 편지 로직 (AGENT.md §2, §4-3)
// 편지 생성 자체는 서버(ai-letters Edge Function)가 수행한다.
// 클라이언트는 완성된 편지를 읽고, 내 화면에 맞는 방향을 골라준다.
import type { ConflictOutputs, Couple } from '@/lib/types';

// 내가 받은 편지 (상대가 나에게 쓴 것)
export function letterForMe(
  outputs: ConflictOutputs,
  couple: Couple,
  myUserId: string,
): string | null {
  const iAmA = couple.user_a_id === myUserId;
  return iAmA ? outputs.letter_b_to_a : outputs.letter_a_to_b;
}

// 내가 보낸 편지 (내 입력이 정제된 것)
export function letterFromMe(
  outputs: ConflictOutputs,
  couple: Couple,
  myUserId: string,
): string | null {
  const iAmA = couple.user_a_id === myUserId;
  return iAmA ? outputs.letter_a_to_b : outputs.letter_b_to_a;
}
