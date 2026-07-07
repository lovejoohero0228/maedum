// 관계 프로필 CRUD (supabase/migrations/004_relationship_profile.sql)
import { supabase } from '@/lib/supabase';
import type { RelationshipProfile } from '@/lib/types';

export async function getRelationshipProfile(
  coupleId: string,
  userId: string,
): Promise<RelationshipProfile | null> {
  const { data, error } = await supabase
    .from('relationship_profiles')
    .select('*')
    .eq('couple_id', coupleId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export interface RelationshipProfileInput {
  couple_id: string;
  user_id: string;
  relationship_type: RelationshipProfile['relationship_type'];
  relationship_duration_months: number | null;
  my_personality_tags: string[];
  partner_personality_tags: string[];
  frequent_conflict_topics: string[];
  is_complete: boolean;
}

export async function upsertRelationshipProfile(
  payload: RelationshipProfileInput,
): Promise<RelationshipProfile> {
  const { data, error } = await supabase
    .from('relationship_profiles')
    .upsert(payload, { onConflict: 'couple_id,user_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}
