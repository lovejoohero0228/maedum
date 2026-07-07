// 홈 — 플로우 진입점 (AGENT.md §2)
// 커플 없음 → pair, 진행 중 갈등 → 상태에 맞는 화면 이어가기, 없으면 "맺음 시작"
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useConflictStore } from '@/store/conflictStore';
import { supabase } from '@/lib/supabase';
import { deleteConflict } from '@/services/conflictService';
import { showAlert, showConfirm } from '@/lib/alert';
import { Avatar } from '@/components/ui/Avatar';
import { colors, fonts } from '@/constants/colors';
import type { Conflict, ConflictStatus } from '@/lib/types';

// 상태 → 이어갈 화면 (AGENT.md §4 플로우)
function routeForStatus(status: ConflictStatus): string {
  switch (status) {
    case 'waiting_partner':
    case 'both_inputting':
      return '/(main)/conflict/input';
    case 'ai_processing':
      return '/(main)/conflict/waiting';
    case 'letters_delivered':
    case 'waiting_ready':
      return '/(main)/conflict/letter';
    case 'mission_unlocked':
      return '/(main)/conflict/mission';
    default:
      return '/(main)/home';
  }
}

const STATUS_LABEL: Record<ConflictStatus, string> = {
  waiting_partner: '상대를 기다리는 중',
  both_inputting: '속마음 입력 중',
  ai_processing: 'AI가 편지를 쓰는 중',
  letters_delivered: '편지 도착',
  waiting_ready: '대화 준비 중',
  mission_unlocked: '미션 진행 중',
  resolved: '완료',
};

export default function Home() {
  const session = useConflictStore((s) => s.session);
  const profile = useConflictStore((s) => s.profile);
  const couple = useConflictStore((s) => s.couple);
  const partner = useConflictStore((s) => s.partner);
  const conflict = useConflictStore((s) => s.conflict);
  const relationshipProfile = useConflictStore((s) => s.relationshipProfile);
  const setConflict = useConflictStore((s) => s.setConflict);
  const loadCouple = useConflictStore((s) => s.loadCouple);
  const myColor = useConflictStore((s) => s.myColor);
  const [deleting, setDeleting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadCouple();
    }, [loadCouple]),
  );

  // 상대가 갈등을 시작하면 실시간으로 감지 (01단계: B의 진입 경로)
  useEffect(() => {
    if (!couple) return;
    const channel = supabase
      .channel(`home-conflicts-${couple.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conflicts',
          filter: `couple_id=eq.${couple.id}`,
        },
        (payload) => setConflict(payload.new as Conflict),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [couple, setConflict]);

  const needsRelationshipSetup = !!couple && (!relationshipProfile || !relationshipProfile.is_complete);

  const onStart = () => router.push('/(main)/conflict/start');
  const onSetupRelationship = () => router.push('/(main)/relationship-profile');
  const onResume = () => {
    if (conflict) router.push(routeForStatus(conflict.status) as never);
  };

  const onDeleteConflict = async () => {
    if (!conflict || deleting) return;
    const ok = await showConfirm(
      '진행 중인 맺음을 삭제할까요?',
      '지금까지 입력한 내용이 모두 사라지고, 처음부터 다시 시작하게 돼요.',
      '삭제',
    );
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteConflict(conflict.id);
      setConflict(null);
    } catch (e) {
      showAlert('삭제 실패', String(e));
    } finally {
      setDeleting(false);
    }
  };

  const partnerStarted =
    conflict && session && conflict.initiator_id !== session.user.id
    && conflict.status === 'waiting_partner';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>맺음</Text>
        <Pressable onPress={() => router.push('/(main)/profile')}>
          {profile ? <Avatar name={profile.display_name} color={myColor()} size={34} /> : null}
        </Pressable>
      </View>

      {couple && partner ? (
        <View style={styles.coupleCard}>
          <View style={styles.coupleRow}>
            <Avatar name={profile?.display_name ?? ''} color={myColor()} size={44} />
            <Text style={styles.heart}>♥</Text>
            <Avatar
              name={partner.display_name}
              color={myColor() === 'blue' ? 'coral' : 'blue'}
              size={44}
            />
          </View>
          <Text style={styles.coupleNames}>
            {profile?.display_name} & {partner.display_name}
          </Text>
        </View>
      ) : (
        <Pressable style={styles.pairCard} onPress={() => router.push('/(main)/pair')}>
          <Text style={styles.pairText}>아직 상대와 연결되지 않았어요 → 연결하기</Text>
        </Pressable>
      )}

      {needsRelationshipSetup ? (
        <Pressable style={styles.setupCard} onPress={onSetupRelationship}>
          <Text style={styles.setupText}>
            관계 정보를 입력하면 더 정확한 질문을 받을 수 있어요 → 입력하기
          </Text>
        </Pressable>
      ) : null}

      {conflict && conflict.status !== 'resolved' ? (
        <View style={styles.resumeCard}>
          <Pressable onPress={onResume}>
            <Text style={styles.resumeLabel}>
              {partnerStarted
                ? `${partner?.display_name ?? '상대'}가 대화를 시작하고 싶어해요`
                : '진행 중인 맺음'}
            </Text>
            <Text style={styles.resumeStatus}>{STATUS_LABEL[conflict.status]}</Text>
            <Text style={styles.resumeCta}>이어가기 →</Text>
          </Pressable>
          <Pressable onPress={onDeleteConflict} disabled={deleting} hitSlop={8}>
            <Text style={styles.resumeDelete}>
              {deleting ? '삭제 중…' : '삭제하고 다시 시작'}
            </Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={[styles.startButton, (!couple || needsRelationshipSetup) && styles.startDisabled]}
          onPress={onStart}
          disabled={!couple || needsRelationshipSetup}
        >
          <Text style={styles.startIcon}>🕊</Text>
          <Text style={styles.startText}>맺음 시작</Text>
          <Text style={styles.startHint}>
            서운했던 마음, 정리해서 전해볼까요?
          </Text>
        </Pressable>
      )}

      <View style={styles.footerLinks}>
        <Pressable onPress={() => router.push('/(main)/history')}>
          <Text style={styles.footerLink}>지난 기록</Text>
        </Pressable>
        <Text style={styles.footerDot}>·</Text>
        <Pressable onPress={() => router.push('/(main)/profile')}>
          <Text style={styles.footerLink}>프로필</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 24, paddingTop: 64 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: { fontSize: 24, color: colors.ink, fontFamily: fonts.displayMedium },
  coupleCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    paddingVertical: 22,
    marginBottom: 16,
  },
  coupleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heart: { fontSize: 16, color: colors.coralMid },
  coupleNames: {
    marginTop: 10,
    fontSize: 14,
    color: colors.ink2,
    fontFamily: fonts.bodyMedium,
  },
  pairCard: {
    backgroundColor: colors.amberTint,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  pairText: { color: colors.amberText, fontSize: 13, fontFamily: fonts.body },
  setupCard: {
    backgroundColor: colors.purpleTint,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  setupText: { color: colors.purpleText, fontSize: 13, fontFamily: fonts.body },
  resumeCard: {
    backgroundColor: colors.purpleTint,
    borderRadius: 20,
    padding: 22,
    marginBottom: 16,
  },
  resumeLabel: { fontSize: 13, color: colors.purpleText, fontFamily: fonts.bodyMedium },
  resumeStatus: {
    fontSize: 20,
    color: colors.ink,
    marginTop: 6,
    fontFamily: fonts.displayMedium,
  },
  resumeCta: { fontSize: 13, color: colors.purpleText, marginTop: 12, fontFamily: fonts.body },
  resumeDelete: {
    fontSize: 12,
    color: colors.ink3,
    marginTop: 14,
    textDecorationLine: 'underline',
    fontFamily: fonts.body,
  },
  startButton: {
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    paddingVertical: 36,
    marginBottom: 16,
  },
  startDisabled: { opacity: 0.5 },
  startIcon: { fontSize: 34, marginBottom: 8 },
  startText: { fontSize: 20, color: colors.ink, fontFamily: fonts.displayMedium },
  startHint: { fontSize: 13, color: colors.ink3, marginTop: 6, fontFamily: fonts.body },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 'auto',
    marginBottom: 24,
  },
  footerLink: { fontSize: 13, color: colors.ink3, fontFamily: fonts.body },
  footerDot: { color: colors.ink3 },
});
