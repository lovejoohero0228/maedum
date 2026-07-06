// Zustand 상태관리 (AGENT.md §2)
// 인증 세션 + 커플 + 현재 갈등 상태를 앱 전역에서 공유한다.
import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Conflict, ConflictOutputs, Couple, Profile } from '@/lib/types';
import {
  getActiveConflict,
  getMyCouple,
  getOutputs,
  getPartnerProfile,
} from '@/services/conflictService';

interface ConflictStore {
  // 인증
  session: Session | null;
  profile: Profile | null;
  setSession: (session: Session | null) => void;
  loadProfile: () => Promise<void>;

  // 커플
  couple: Couple | null;
  partner: Profile | null;
  loadCouple: () => Promise<void>;

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

  couple: null,
  partner: null,
  loadCouple: async () => {
    const userId = get().session?.user.id;
    if (!userId) return;
    const couple = await getMyCouple(userId);
    set({ couple });
    if (couple) {
      const partner = await getPartnerProfile(couple, userId);
      set({ partner });
      const conflict = await getActiveConflict(couple.id);
      set({ conflict });
    }
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
      couple: null,
      partner: null,
      conflict: null,
      outputs: null,
    }),
}));
