// 홈 — 플로우 진입점 (AGENT.md §2)
// 커플 없음 → pair, 진행 중 갈등 → 상태에 맞는 화면 이어가기, 없으면 "맺음 시작"
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useConflictStore } from '@/store/conflictStore';
import { supabase } from '@/lib/supabase';
import { deleteConflict } from '@/services/conflictService';
import { getOngoingMissions, type OngoingMissionRecord } from '@/services/missionService';
import { showAlert, showConfirm } from '@/lib/alert';
import { MissionBoard } from '@/components/home/MissionBoard';
import { Avatar } from '@/components/ui/Avatar';
import { Maedeubi } from '@/components/ui/Maedeubi';
import { Wash } from '@/components/ui/Wash';
import { colors, fonts, gradients, ui } from '@/constants/colors';
import { parseHomeBackground } from '@/constants/homeBackgrounds';
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
  ai_processing: '매듭이가 편지를 쓰는 중',
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

  // 누적 장기(빅) 미션 — 미션이 생성된 맺음들의 노력 목록 (홈 상단 보드)
  const [ongoing, setOngoing] = useState<OngoingMissionRecord[]>([]);
  useFocusEffect(
    useCallback(() => {
      if (!couple) {
        setOngoing([]);
        return;
      }
      getOngoingMissions(couple.id)
        .then(setOngoing)
        .catch(() => {});
    }, [couple]),
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

  // 관계 설정에서 고른 홈 배경 (프리셋 그라데이션 또는 업로드 이미지) — 활성 커플 기준
  const homeBg = parseHomeBackground(relationshipProfile?.home_background);

  return (
    <View style={styles.container}>
      <Wash colors={homeBg.colors} imageUrl={homeBg.imageUrl} height={homeBg.imageUrl ? 300 : 260} />
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
                style={[styles.partnerChip, isActive && styles.partnerChipActive]}
                onPress={() => selectCouple(c.id)}
              >
                <Avatar name={p?.display_name ?? '?'} color="coral" size={24} />
                <Text
                  style={[styles.partnerChipName, isActive && styles.partnerChipNameActive]}
                  numberOfLines={1}
                >
                  {p?.display_name ?? '상대'}
                </Text>
              </Pressable>
            );
          })}
          <Pressable style={styles.addPartnerChip} onPress={() => router.push('/(main)/pair')}>
            <Text style={styles.addPartnerIcon}>+</Text>
          </Pressable>
        </ScrollView>
      ) : null}

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
      <View style={styles.headline}>
        {couple && partner ? (
          <>
            <View style={styles.headlineRow}>
              <View style={styles.headlineChar}>
                <Maedeubi size={56} />
              </View>
              <Text style={[ui.statement, styles.headlineText]}>
                서운했던 마음,{'\n'}정리해서 전해볼까요?
              </Text>
            </View>
            <View style={styles.coupleRow}>
              <Avatar name={profile?.display_name ?? ''} color={myColor()} size={24} />
              <Avatar
                name={partner.display_name}
                color={myColor() === 'blue' ? 'coral' : 'blue'}
                size={24}
              />
              <Text style={styles.coupleNames}>
                {profile?.display_name} & {partner.display_name}
              </Text>
            </View>
          </>
        ) : (
          <>
            <View style={styles.headlineRow}>
              <View style={styles.headlineChar}>
                <Maedeubi size={56} />
              </View>
              <Text style={[ui.statement, styles.headlineText]}>
                둘을 연결하는 것부터{'\n'}시작해볼까요?
              </Text>
            </View>
            <Text style={styles.headlineSub}>아직 상대와 연결되지 않았어요.</Text>
          </>
        )}
      </View>

      {couple && partner && session ? (
        <MissionBoard
          records={ongoing}
          myName={profile?.display_name ?? '나'}
          partnerName={partner.display_name}
          myIsA={couple.user_a_id === session.user.id}
          myColor={myColor()}
        />
      ) : null}

      {!couple ? (
        <Pressable style={styles.whiteCard} onPress={() => router.push('/(main)/pair')}>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>상대와 연결하기</Text>
            <Text style={styles.cardSub}>초대 코드로 두 사람을 이어요</Text>
          </View>
          <Text style={styles.cardArrow}>→</Text>
        </Pressable>
      ) : conflict && conflict.status !== 'resolved' ? (
        <>
          <Pressable onPress={onResume}>
            <LinearGradient
              colors={[...gradients.ember]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.emberCard}
            >
              <View style={styles.emberTopRow}>
                <View style={styles.emberBody}>
                  <Text style={styles.emberLabel}>
                    {partnerStarted
                      ? `${partner?.display_name ?? '상대'}가 대화를 시작하고 싶어해요`
                      : '진행 중인 맺음'}
                  </Text>
                  <View style={styles.emberRow}>
                    <Text style={styles.emberTitle}>{STATUS_LABEL[conflict.status]}</Text>
                    <Text style={styles.emberArrow}>→</Text>
                  </View>
                </View>
                <Maedeubi size={48} />
              </View>
            </LinearGradient>
          </Pressable>
          <Pressable onPress={onDeleteConflict} disabled={deleting} hitSlop={8}>
            <Text style={styles.resumeDelete}>
              {deleting ? '삭제 중…' : '삭제하고 다시 시작'}
            </Text>
          </Pressable>
        </>
      ) : needsRelationshipSetup ? (
        <Pressable style={styles.whiteCard} onPress={onSetupRelationship}>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>관계 정보 입력하기</Text>
            <Text style={styles.cardSub}>
              두 사람 이야기를 먼저 알려주면 더 정확한 질문을 받을 수 있어요
            </Text>
          </View>
          <Text style={styles.cardArrow}>→</Text>
        </Pressable>
      ) : (
        <Pressable onPress={onStart}>
          <LinearGradient
            colors={[...gradients.ember]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.emberCard}
          >
            <View style={styles.emberTopRow}>
              <View style={styles.emberBody}>
                <Text style={styles.emberTitle}>맺음 시작</Text>
                <Text style={styles.emberSub}>오늘, 하고 싶었던 이야기가 있나요?</Text>
              </View>
              <Maedeubi size={52} />
            </View>
            <View style={styles.emberFauxInput}>
              <Text style={styles.emberFauxInputText}>마음속 이야기를 들려주세요…</Text>
            </View>
          </LinearGradient>
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 24, paddingTop: 64 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: { fontSize: 24, color: colors.ink, fontFamily: fonts.displayMedium },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  addPartnerLink: { fontSize: 13, color: colors.ink2, fontFamily: fonts.bodyMedium },
  partnerScroll: { flexGrow: 0 },
  partnerScrollContent: { gap: 8, paddingRight: 4, paddingVertical: 2 },
  partnerChip: {
    ...ui.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  partnerChipActive: {
    ...ui.pillSelected,
  },
  partnerChipName: { fontSize: 13, color: colors.ink2, fontFamily: fonts.body, maxWidth: 96 },
  partnerChipNameActive: { color: colors.ink, fontFamily: fonts.bodyMedium },
  addPartnerChip: {
    width: 40,
    height: 40,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgCard,
  },
  addPartnerIcon: { fontSize: 18, color: colors.ink3 },
  body: { flex: 1, marginHorizontal: -24 },
  bodyContent: { flexGrow: 1, paddingHorizontal: 24 },
  headline: { marginTop: 32, marginBottom: 24 },
  headlineRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headlineChar: { marginTop: 2 },
  headlineText: { flex: 1 },
  headlineSub: { ...ui.statementSub, marginTop: 10 },
  coupleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  coupleNames: {
    marginLeft: 4,
    fontSize: 13,
    color: colors.ink3,
    fontFamily: fonts.bodyMedium,
  },
  whiteCard: {
    ...ui.card,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardBody: { flex: 1, marginRight: 12 },
  cardTitle: {
    fontSize: 19,
    lineHeight: 28,
    color: colors.ink,
    fontFamily: fonts.displayMedium,
  },
  cardSub: { ...ui.statementSub, marginTop: 6 },
  cardArrow: { fontSize: 20, color: colors.ink2 },
  emberCard: {
    borderRadius: 20,
    padding: 22,
  },
  emberTopRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  emberBody: { flex: 1 },
  emberLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    fontFamily: fonts.bodyMedium,
    marginBottom: 8,
  },
  emberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  emberTitle: {
    fontSize: 22,
    lineHeight: 32,
    color: '#FFFFFF',
    fontFamily: fonts.displayMedium,
  },
  emberArrow: { fontSize: 20, color: '#FFFFFF' },
  emberSub: {
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.9)',
    fontFamily: fonts.body,
    marginTop: 6,
  },
  emberFauxInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 100,
    paddingVertical: 13,
    paddingHorizontal: 18,
    marginTop: 16,
  },
  emberFauxInputText: { fontSize: 14, color: colors.ink3, fontFamily: fonts.body },
  resumeDelete: {
    fontSize: 12,
    color: colors.ink3,
    marginTop: 14,
    textAlign: 'center',
    textDecorationLine: 'underline',
    fontFamily: fonts.body,
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 'auto',
    paddingTop: 28,
    marginBottom: 28,
  },
  footerLink: { fontSize: 13, color: colors.ink3, fontFamily: fonts.body },
  footerDot: { color: colors.ink3 },
});
