// 갈등 세션 CRUD + 커플 연결 (AGENT.md §2, §4-1)
import { supabase } from '@/lib/supabase';
import type { Conflict, ConflictOutputs, Couple, Profile } from '@/lib/types';

// ── 커플 연결 (초대 코드 방식, Phase 1) ─────────────────────

export async function getMyCouple(userId: string): Promise<Couple | null> {
  const { data, error } = await supabase
    .from('couples')
    .select('*')
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createInviteCode(userId: string): Promise<string> {
  // 6자리 영숫자 코드
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  const { error } = await supabase
    .from('couple_invites')
    .upsert({ code, inviter_id: userId }, { onConflict: 'inviter_id' });
  if (error) throw error;
  return code;
}

export async function acceptInviteCode(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('accept_couple_invite', {
    invite_code: code.trim().toUpperCase(),
  });
  if (error) throw error;
  return data as string; // couple_id
}

export async function getPartnerProfile(
  couple: Couple,
  myUserId: string,
): Promise<Profile | null> {
  const partnerId = couple.user_a_id === myUserId ? couple.user_b_id : couple.user_a_id;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', partnerId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ── 갈등 세션 ────────────────────────────────────────────────

// 01단계: 맺음 시작 → conflicts row 생성 (status: waiting_partner)
export async function startConflict(coupleId: string, userId: string): Promise<Conflict> {
  const { data, error } = await supabase
    .from('conflicts')
    .insert({ couple_id: coupleId, initiator_id: userId, status: 'waiting_partner' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// 진행 중(미해결) 갈등 조회
export async function getActiveConflict(coupleId: string): Promise<Conflict | null> {
  const { data, error } = await supabase
    .from('conflicts')
    .select('*')
    .eq('couple_id', coupleId)
    .neq('status', 'resolved')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getConflict(conflictId: string): Promise<Conflict | null> {
  const { data, error } = await supabase
    .from('conflicts')
    .select('*')
    .eq('id', conflictId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// 상대(B)가 알림 탭으로 진입 → both_inputting 전환 (AGENT.md §4-1)
export async function joinConflict(conflictId: string): Promise<void> {
  const { error } = await supabase
    .from('conflicts')
    .update({ status: 'both_inputting' })
    .eq('id', conflictId)
    .eq('status', 'waiting_partner');
  if (error) throw error;
}

export async function getOutputs(conflictId: string): Promise<ConflictOutputs | null> {
  const { data, error } = await supabase
    .from('conflict_outputs')
    .select('*')
    .eq('conflict_id', conflictId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// "대화 준비됐어요" — ready row 생성, 첫 번째면 status → waiting_ready
export async function markReady(conflictId: string, userId: string): Promise<number> {
  const { error } = await supabase
    .from('conflict_ready_states')
    .upsert({ conflict_id: conflictId, user_id: userId });
  if (error) throw error;

  const { data: rows, error: countError } = await supabase
    .from('conflict_ready_states')
    .select('user_id')
    .eq('conflict_id', conflictId);
  if (countError) throw countError;

  const count = rows?.length ?? 0;
  if (count === 1) {
    await supabase
      .from('conflicts')
      .update({ status: 'waiting_ready' })
      .eq('id', conflictId);
  }
  return count;
}

export async function resolveConflict(conflictId: string): Promise<void> {
  const { error } = await supabase
    .from('conflicts')
    .update({ status: 'resolved' })
    .eq('id', conflictId);
  if (error) throw error;
}

// 갈등 기록 히스토리 (Phase 2)
export async function listConflicts(coupleId: string): Promise<Conflict[]> {
  const { data, error } = await supabase
    .from('conflicts')
    .select('*')
    .eq('couple_id', coupleId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
