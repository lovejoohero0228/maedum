// 04단계: 미션 로직 (AGENT.md §2, §4-4)
import { requestMission } from '@/lib/ai';
import { supabase } from '@/lib/supabase';
import type { ConflictOutputs, Couple, MissionItem, SmallMissionItem } from '@/lib/types';

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

// 커플의 누적 장기(빅) 미션 — 미션이 생성된 맺음들의 mission_a/b/both를 최신순으로.
// 홈 상단 미션 보드와 "자세히 보기" 페이지에서 사용.
export interface OngoingMissionRecord {
  conflictId: string;
  title: string | null;
  summary: string | null;
  createdAt: string;
  missionA: MissionItem[];
  missionB: MissionItem[];
  missionBoth: SmallMissionItem[];
}

export async function getOngoingMissions(coupleId: string): Promise<OngoingMissionRecord[]> {
  const { data, error } = await supabase
    .from('conflicts')
    .select('id, title, summary, created_at, conflict_outputs(mission_a, mission_b, mission_both)')
    .eq('couple_id', coupleId)
    .in('status', ['mission_unlocked', 'resolved'])
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? [])
    .map((row) => {
      // conflict_outputs는 conflict당 1행(UNIQUE)이지만 역방향 조인이라 배열로 올 수 있다
      const raw = row.conflict_outputs as unknown;
      const o = (Array.isArray(raw) ? raw[0] : raw) as {
        mission_a: MissionItem[] | null;
        mission_b: MissionItem[] | null;
        mission_both: SmallMissionItem[] | null;
      } | null;
      return {
        conflictId: row.id as string,
        title: (row.title as string | null) ?? null,
        summary: (row.summary as string | null) ?? null,
        createdAt: row.created_at as string,
        missionA: o?.mission_a ?? [],
        missionB: o?.mission_b ?? [],
        missionBoth: o?.mission_both ?? [],
      };
    })
    .filter((r) => r.missionA.length || r.missionB.length || r.missionBoth.length);
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
