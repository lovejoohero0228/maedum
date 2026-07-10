// 홈 — 플로우 진입점 (AGENT.md §2)
// 커플 없음 → pair, 진행 중 갈등 → 상태에 맞는 화면 이어가기, 없으면 "맺음 시작"
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useConflictStore } from '@/store/conflictStore';
import { supabase } from '@/lib/supabase';
import { deleteConflict } from '@/services/conflictService';
import { showAlert, showConfirm } from '@/lib/alert';
import { Avatar } from '@/components/ui/Avatar';
import { colors, fonts, ui } from '@/constants/colors';
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
  const couples = useConflictStore((s) => s.couples);
  const partners = useConflictStore((s) => s.partners);
  const activeCoupleId = useConflictStore((s) => s.activeCoupleId);
  const couple = useConflictStore((s) => s.couple);
  const partner = useConflictStore((s) => s.partner);
  const conflict = useConflictStore((s) => s.conflict);
  const relationshipProfile = useConflictStore((s) => s.relationshipProfile);
  const setConflict = useConflictStore((s) => s.setConflict);
  const loadCouples = useConflictStore((s) => s.loadCouples);
  const selectCouple = useConflictStore((s) => s.selectCouple);
  const myColor = useConflictStore((s) => s.myColor);
  const [deleting, setDeleting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadCouples().catch((e) => console.error('loadCouples failed', e));
    }, [loadCouples]),
  );

  // 연결된 모든 상대에 대해, 그중 누구든 갈등을 시작하면 실시간으로 감지
  // (01단계: B의 진입 경로) — 현재 활성 커플의 것이면 바로 반영,
  // 다른 커플의 것이면 목록을 새로고침해 배지/상태가 갱신되게 한다.
  useEffect(() => {
    if (couples.length === 0) return;
    const channels = couples.map((c) =>
      supabase
        .channel(`home-conflicts-${c.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'conflicts',
            filter: `couple_id=eq.${c.id}`,
          },
          (payload) => {
            const newConflict = payload.new as Conflict;
            if (c.id === activeCoupleId) setConflict(newConflict);
            else loadCouples();
          },
        )
        .subscribe(),
    );
    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [couples, activeCoupleId, setConflict, loadCouples]);

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
        <View style={styles.headerRight}>
          <Pressable onPress={() => router.push('/(main)/pair')} hitSlop={8}>
            <Text style={styles.addPartnerLink}>＋ 상대 추가</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/(main)/profile')}>
            {profile ? <Avatar name={profile.display_name} color={myColor()} size={34} /> : null}
          </Pressable>
        </View>
      </View>

      {couples.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.partnerScroll}
          contentContainerStyle={styles.partnerScrollContent}
        >
          {couples.map((c) => {
            const p = partners[c.id];
            const isActive = c.id === activeCoupleId;
            return (
              <Pressable
                key={c.id}
                style={[styles.partnerChip, !isActive && styles.partnerChipInactive]}
                onPress={() => selectCouple(c.id)}
              >
                <Avatar name={p?.display_name ?? '?'} color="coral" size={32} />
                <Text
                  style={[styles.partnerChipName, isActive && styles.partnerChipNameActive]}
                  numberOfLines={1}
                >
                  {p?.display_name ?? '상대'}
                </Text>
                <View style={[styles.partnerChipMark, isActive && styles.partnerChipMarkActive]} />
              </Pressable>
            );
          })}
          <Pressable style={styles.addPartnerChip} onPress={() => router.push('/(main)/pair')}>
            <Text style={styles.addPartnerIcon}>+</Text>
          </Pressable>
        </ScrollView>
      ) : null}

      <View style={styles.centerArea}>
        {couple && partner ? (
          <View style={styles.coupleBlock}>
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
          <Pressable style={styles.coupleBlock} onPress={() => router.push('/(main)/pair')}>
            <Text style={ui.statementSub}>아직 상대와 연결되지 않았어요.</Text>
            <Text style={styles.quietLink}>연결하기</Text>
          </Pressable>
        )}

        {conflict && conflict.status !== 'resolved' ? (
          <View style={styles.focal}>
            <Pressable onPress={onResume} style={styles.focalPress}>
              <Text style={ui.statementSub}>
                {partnerStarted
                  ? `${partner?.display_name ?? '상대'}가 대화를 시작하고 싶어해요`
                  : '진행 중인 맺음'}
              </Text>
              <Text style={styles.focalStatement}>{STATUS_LABEL[conflict.status]}</Text>
              <Text style={styles.quietLink}>이어가기</Text>
            </Pressable>
            <Pressable onPress={onDeleteConflict} disabled={deleting} hitSlop={8}>
              <Text style={styles.resumeDelete}>
                {deleting ? '삭제 중…' : '삭제하고 다시 시작'}
              </Text>
            </Pressable>
          </View>
        ) : needsRelationshipSetup ? (
          <Pressable style={styles.focal} onPress={onSetupRelationship}>
            <Text style={styles.startIcon}>📝</Text>
            <Text style={styles.focalStatement}>관계 정보 입력하기</Text>
            <Text style={ui.statementSub}>
              두 사람 이야기를 먼저 알려주면{'\n'}더 정확한 질문을 받을 수 있어요
            </Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.focal, !couple && styles.startDisabled]}
            onPress={onStart}
            disabled={!couple}
          >
            <Text style={styles.startIcon}>🕊</Text>
            <Text style={styles.focalStatement}>서운했던 마음,{'\n'}정리해서 전해볼까요?</Text>
            <Text style={styles.startCta}>탭하여 맺음 시작</Text>
          </Pressable>
        )}
      </View>

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
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  addPartnerLink: { fontSize: 13, color: colors.ink3, fontFamily: fonts.bodyMedium },
  partnerScroll: { flexGrow: 0 },
  partnerScrollContent: { gap: 10, paddingRight: 4 },
  partnerChip: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 4,
    width: 68,
  },
  partnerChipInactive: { opacity: 0.45 },
  partnerChipName: { fontSize: 11, color: colors.ink3, fontFamily: fonts.body },
  partnerChipNameActive: { color: colors.ink, fontFamily: fonts.bodyMedium },
  partnerChipMark: { width: 24, height: 1.5, backgroundColor: 'transparent', marginTop: 2 },
  partnerChipMarkActive: { backgroundColor: colors.ink },
  addPartnerChip: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPartnerIcon: { fontSize: 22, color: colors.ink3 },
  centerArea: { flex: 1, justifyContent: 'center' },
  coupleBlock: { alignItems: 'center', marginBottom: 56, gap: 4 },
  coupleRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heart: { fontSize: 15, color: colors.coralMid },
  coupleNames: {
    marginTop: 12,
    fontSize: 14,
    color: colors.ink2,
    fontFamily: fonts.bodyMedium,
  },
  quietLink: {
    ...ui.quietCta,
    marginTop: 14,
  },
  focal: { alignItems: 'center', paddingHorizontal: 12 },
  focalPress: { alignItems: 'center' },
  focalStatement: {
    ...ui.statement,
    marginTop: 10,
    marginBottom: 8,
  },
  startDisabled: { opacity: 0.4 },
  startIcon: { fontSize: 36, marginBottom: 14 },
  startCta: {
    ...ui.quietCta,
    marginTop: 18,
  },
  resumeDelete: {
    fontSize: 12,
    color: colors.ink3,
    marginTop: 20,
    textDecorationLine: 'underline',
    fontFamily: fonts.body,
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  footerLink: { fontSize: 13, color: colors.ink3, fontFamily: fonts.body },
  footerDot: { color: colors.ink3 },
});
