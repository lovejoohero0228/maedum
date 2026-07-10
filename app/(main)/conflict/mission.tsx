// 04단계: 미션 페이퍼 (AGENT.md §4-4)
// 미션 생성이 끝날 때까지 대기 → 두 컬럼 미션 + 대화 가이드 표시 → 완료
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { showAlert, showConfirm } from '@/lib/alert';
import { useConflictStore } from '@/store/conflictStore';
import { resolveConflict } from '@/services/conflictService';
import { generateMission } from '@/services/missionService';
import { requestHistoryUpdate } from '@/lib/ai';
import { MissionPaper } from '@/components/mission/MissionPaper';
import { ConvoGuide } from '@/components/mission/ConvoGuide';
import { ProgressSteps } from '@/components/ui/ProgressSteps';
import { Wash } from '@/components/ui/Wash';
import { colors, fonts, ui, userTheme } from '@/constants/colors';

export default function Mission() {
  const session = useConflictStore((s) => s.session);
  const conflict = useConflictStore((s) => s.conflict);
  const couple = useConflictStore((s) => s.couple);
  const profile = useConflictStore((s) => s.profile);
  const partner = useConflictStore((s) => s.partner);
  const outputs = useConflictStore((s) => s.outputs);
  const loadOutputs = useConflictStore((s) => s.loadOutputs);
  const setConflict = useConflictStore((s) => s.setConflict);
  const [busy, setBusy] = useState(false);
  const regenRequestedRef = useRef(false);

  // 개편 전 형식(마음가짐 없음)은 준비 안 된 것으로 취급 — 아래 effect가 재생성을 요청한다
  const missionReady = !!outputs?.mission_a && !!outputs?.mindset_a;

  // 미션이 아직 없거나 개편 전 형식이면 생성/재생성 요청 (서버가 새 형식에 한해 멱등 처리)
  useEffect(() => {
    if (!conflict || !outputs || missionReady || regenRequestedRef.current) return;
    regenRequestedRef.current = true;
    generateMission(conflict.id).catch(() => {});
  }, [conflict, outputs, missionReady]);

  // 미션 생성 완료 감지 — mission_unlocked 상태 변화 구독 + 폴링
  useEffect(() => {
    if (!conflict) return;
    loadOutputs();

    const channel = supabase
      .channel(`mission-${conflict.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conflicts',
          filter: `id=eq.${conflict.id}`,
        },
        (payload) => {
          setConflict(payload.new as never);
          loadOutputs();
        },
      )
      .subscribe();

    const poll = setInterval(loadOutputs, 5000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [conflict, loadOutputs, setConflict]);

  const [regenerating, setRegenerating] = useState(false);

  // 프롬프트/데이터가 개선된 뒤 현재 미션을 새로 뽑아보고 싶을 때
  const onRegenerate = async () => {
    if (!conflict || regenerating) return;
    const ok = await showConfirm(
      '미션 페이퍼를 다시 만들까요?',
      '지금 미션은 사라지고, 두 사람의 문답과 편지를 바탕으로 새로 생성돼요.',
      '다시 만들기',
    );
    if (!ok) return;
    setRegenerating(true);
    try {
      await generateMission(conflict.id, true);
      await loadOutputs();
    } catch (e) {
      showAlert('오류', String(e));
    } finally {
      setRegenerating(false);
    }
  };

  const onResolve = async () => {
    if (!conflict || busy) return;
    setBusy(true);
    try {
      await resolveConflict(conflict.id);
      // 이번 맺음을 커플 히스토리 요약에 통합 (백그라운드 — 실패해도 다음 기회에 소급됨)
      requestHistoryUpdate(conflict.couple_id).catch(() => {});
      setConflict(null);
      router.replace('/(main)/home');
    } catch (e) {
      showAlert('오류', String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!missionReady || !outputs || !couple || !session) {
    return (
      <View style={[styles.container, styles.loading]}>
        <Wash />
        <View style={styles.progressHeader}>
          <ProgressSteps current={4} />
        </View>
        <View style={styles.loadingBody}>
          <LinearGradient colors={['#F8E3C4', '#F6D9D6']} style={styles.loadingOrb} />
          <Text style={styles.loadingText}>미션 페이퍼를 준비하고 있어요…</Text>
          <ActivityIndicator size="small" color={colors.ink3} style={styles.loadingSpinner} />
        </View>
      </View>
    );
  }

  const iAmA = couple.user_a_id === session.user.id;
  const nameA = iAmA ? (profile?.display_name ?? 'A') : (partner?.display_name ?? 'A');
  const nameB = iAmA ? (partner?.display_name ?? 'B') : (profile?.display_name ?? 'B');
  // 내 마음가짐을 먼저 보여준다
  const mindsets = [
    { name: iAmA ? nameA : nameB, text: iAmA ? outputs.mindset_a : outputs.mindset_b, color: iAmA ? 'blue' : 'coral' } as const,
    { name: iAmA ? nameB : nameA, text: iAmA ? outputs.mindset_b : outputs.mindset_a, color: iAmA ? 'coral' : 'blue' } as const,
  ].filter((m) => !!m.text);

  return (
    <View style={styles.container}>
      <Wash />
      <View style={styles.progressHeader}>
        <ProgressSteps current={4} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>우리의 미션 페이퍼</Text>
        <Text style={styles.hint}>
          과제가 아니라 제안이에요. 할 수 있는 것부터, 천천히.
        </Text>

        {mindsets.length ? (
          <View style={styles.mindsetCard}>
            <Text style={styles.mindsetTitle}>대화 전, 마음에 새겨요</Text>
            {mindsets.map((m, i) => (
              <View
                key={i}
                style={[styles.mindsetItem, { borderLeftColor: userTheme(m.color).mid }]}
              >
                <Text style={[styles.mindsetName, { color: userTheme(m.color).text }]}>
                  {m.name}
                </Text>
                <Text style={styles.mindsetText}>{m.text}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <MissionPaper
          nameA={nameA}
          nameB={nameB}
          colorA="blue"
          colorB="coral"
          missionsA={outputs.mission_a ?? []}
          missionsB={outputs.mission_b ?? []}
        />

        {outputs.convo_guide ? (
          <ConvoGuide
            steps={outputs.convo_guide}
            note={outputs.convo_note}
            nameA={nameA}
            nameB={nameB}
            colorA="blue"
            colorB="coral"
          />
        ) : null}

        <Pressable
          style={[styles.doneButton, busy && styles.doneDisabled]}
          onPress={onResolve}
          disabled={busy}
        >
          <Text style={styles.doneText}>이번 맺음 마무리하기</Text>
        </Pressable>
        <Text style={styles.doneHint}>
          마무리해도 기록에서 다시 볼 수 있어요.
        </Text>
        <Pressable onPress={onRegenerate} disabled={regenerating} style={styles.regenButton}>
          <Text style={styles.regenText}>
            {regenerating ? '미션을 다시 만드는 중…' : '↺ 미션 다시 만들기'}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: 48 },
  progressHeader: { paddingHorizontal: 24 },
  loading: {},
  loadingBody: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  loadingOrb: { width: 88, height: 88, borderRadius: 44, marginBottom: 28 },
  loadingText: { ...ui.statementSub, textAlign: 'center' },
  loadingSpinner: { marginTop: 28, opacity: 0.7 },
  scroll: { padding: 24, paddingBottom: 48 },
  title: {
    ...ui.statement,
    marginTop: 12,
  },
  hint: {
    ...ui.statementSub,
    marginTop: 6,
    marginBottom: 24,
  },
  mindsetCard: {
    ...ui.card,
    marginVertical: 8,
  },
  mindsetTitle: {
    fontSize: 17,
    color: colors.ink,
    fontFamily: fonts.displayMedium,
    marginBottom: 14,
  },
  mindsetItem: { borderLeftWidth: 2, paddingLeft: 14, paddingVertical: 2, marginBottom: 14 },
  mindsetName: {
    fontSize: 12,
    fontFamily: fonts.bodyMedium,
    marginBottom: 4,
  },
  mindsetText: { fontSize: 14, lineHeight: 21, color: colors.ink2, fontFamily: fonts.body },
  doneButton: {
    ...ui.primaryPill,
    alignItems: 'center',
    marginTop: 28,
  },
  doneDisabled: { opacity: 0.55 },
  doneText: { ...ui.primaryPillText },
  doneHint: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.ink3,
    marginTop: 12,
    fontFamily: fonts.body,
  },
  regenButton: { alignItems: 'center', marginTop: 18, padding: 8 },
  regenText: {
    fontSize: 12,
    color: colors.ink3,
    fontFamily: fonts.bodyMedium,
    textDecorationLine: 'underline',
  },
});
