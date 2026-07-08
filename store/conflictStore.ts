// Zustand 상태관리 (AGENT.md §2)
// 인증 세션 + 커플 + 현재 갈등 상태를 앱 전역에서 공유한다.
import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Conflict, ConflictOutputs, Couple, Profile, RelationshipProfile } from '@/lib/types';
import {
  getActiveConflict,
  getMyCouples,
  getOutputs,
  getPartnerProfile,
} from '@/services/conflictService';
import { getRelationshipProfile } from '@/services/relationshipProfileService';

interface ConflictStore {
  // 인증
  session: Session | null;
  profile: Profile | null;
  setSession: (session: Session | null) => void;
  loadProfile: () => Promise<void>;

  // 커플 (한 사람이 여러 명과 동시에 연결될 수 있음 — couples가 전체 목록,
  // couple/partner는 그중 현재 화면에서 선택된 "활성" 커플)
  couples: Couple[];
  partners: Record<string, Profile>;
  activeCoupleId: string | null;
  couple: Couple | null;
  partner: Profile | null;
  loadCouples: () => Promise<void>;
  selectCouple: (coupleId: string) => Promise<void>;

  // 관계 프로필 (본인 것만 — 파트너 비공개)
  relationshipProfile: RelationshipProfile | null;
  loadRelationshipProfile: () => Promise<void>;

  // 현재 갈등
  conflict: Conflict | null;
  outputs: ConflictOutputs | null;
  setConflict: (conflict: Conflict | null) => void;
  refreshConflict: () => Promise<void>;
  loadOutputs: () => Promise<void>;

  // 사용자 색상: A=blue, B=coral (AGENT.md §8)
  myColor: () => 'blue' | 'coral';

  reset: () => void;
}

export const useConflictStore = create<ConflictStore>((set, get) => ({
  session: null,
  profile: null,
  setSession: (session) => set({ session }),

  loadProfile: async () => {
    const userId = get().session?.user.id;
    if (!userId) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    set({ profile: data ?? null });
  },

  couples: [],
  partners: {},
  activeCoupleId: null,
  couple: null,
  partner: null,
  loadCouples: async () => {
    const userId = get().session?.user.id;
    if (!userId) return;
    const couples = await getMyCouples(userId);
    const partnerEntries = await Promise.all(
      couples.map(async (c) => [c.id, await getPartnerProfile(c, userId)] as const),
    );
    const partners: Record<string, Profile> = {};
    for (const [coupleId, partner] of partnerEntries) {
      if (partner) partners[coupleId] = partner;
    }
    set({ couples, partners });

    if (couples.length === 0) {
      set({ activeCoupleId: null, couple: null, partner: null, conflict: null, outputs: null });
      return;
    }

    // 이전에 선택했던 커플이 여전히 유효하면 유지, 아니면 첫 번째 커플로
    const prevActiveId = get().activeCoupleId;
    const stillValid = couples.some((c) => c.id === prevActiveId);
    await get().selectCouple(stillValid ? (prevActiveId as string) : couples[0].id);
  },

  selectCouple: async (coupleId: string) => {
    const couple = get().couples.find((c) => c.id === coupleId) ?? null;
    const partner = couple ? (get().partners[coupleId] ?? null) : null;
    set({ activeCoupleId: coupleId, couple, partner, conflict: null, outputs: null });
    if (!couple) return;
    const conflict = await getActiveConflict(couple.id);
    set({ conflict });
    await get().loadRelationshipProfile();
  },

  relationshipProfile: null,
  loadRelationshipProfile: async () => {
    const { couple, session } = get();
    const userId = session?.user.id;
    if (!couple || !userId) return;
    const relationshipProfile = await getRelationshipProfile(couple.id, userId);
    set({ relationshipProfile });
  },

  conflict: null,
  outputs: null,
  setConflict: (conflict) => set({ conflict }),

  refreshConflict: async () => {
    const current = get().conflict;
    if (!current) return;
    const { data } = await supabase
      .from('conflicts')
      .select('*')
      .eq('id', current.id)
      .maybeSingle();
    if (data) set({ conflict: data });
  },

  loadOutputs: async () => {
    const conflict = get().conflict;
    if (!conflict) return;
    const outputs = await getOutputs(conflict.id);
    set({ outputs });
  },

  myColor: () => {
    const { couple, session } = get();
    if (!couple || !session) return 'blue';
    return couple.user_a_id === session.user.id ? 'blue' : 'coral';
  },

  reset: () =>
    set({
      session: null,
      profile: null,
      couples: [],
      partners: {},
      activeCoupleId: null,
      couple: null,
      partner: null,
      relationshipProfile: null,
      conflict: null,
      outputs: null,
    }),
}));
