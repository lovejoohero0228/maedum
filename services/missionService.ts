// 04단계: 미션 로직 (AGENT.md §2, §4-4)
import { requestMission } from '@/lib/ai';
import type { ConflictOutputs, Couple, MissionItem } from '@/lib/types';

// 두 번째 ready 직후 호출 — 서버가 멱등 처리하므로 중복 호출 안전.
// force: 기존 미션을 버리고 새로 생성 (프롬프트 개선 후 재생성용)
export function generateMission(conflictId: string, force = false): Promise<void> {
  return requestMission(conflictId, force);
}

export function missionForMe(
  outputs: ConflictOutputs,
  couple: Couple,
  myUserId: string,
): MissionItem[] {
  const iAmA = couple.user_a_id === myUserId;
  return (iAmA ? outputs.mission_a : outputs.mission_b) ?? [];
}

export function missionForPartner(
  outputs: ConflictOutputs,
  couple: Couple,
  myUserId: string,
): MissionItem[] {
  const iAmA = couple.user_a_id === myUserId;
  return (iAmA ? outputs.mission_b : outputs.mission_a) ?? [];
}

// 미션 유형별 아이콘 (AGENT.md §7-4)
export const missionIcon: Record<MissionItem['type'], string> = {
  prevent: '🛡️',
  differently: '🔀',
  empathy: '💭',
  // 개편 전 레거시 유형
  habit: '🔄',
  acknowledge: '💡',
  action: '✋',
};
