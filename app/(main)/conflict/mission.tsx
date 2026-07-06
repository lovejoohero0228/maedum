// 04단계: 미션 페이퍼 (AGENT.md §4-4)
// 미션 생성이 끝날 때까지 대기 → 두 컬럼 미션 + 대화 가이드 표시 → 완료
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { showAlert } from '@/lib/alert';
import { useConflictStore } from '@/store/conflictStore';
import { resolveConflict } from '@/services/conflictService';
import { MissionPaper } from '@/components/mission/MissionPaper';
import { ConvoGuide } from '@/components/mission/ConvoGuide';
import { ProgressSteps } from '@/components/ui/ProgressSteps';
import { colors, fonts } from '@/constants/colors';

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

  const missionReady = !!outputs?.mission_a;

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

  const onResolve = async () => {
    if (!conflict || busy) return;
    setBusy(true);
    try {
      await resolveConflict(conflict.id);
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
        <ProgressSteps current={4} />
        <View style={styles.loadingBody}>
          <ActivityIndicator size="large" color={colors.purpleMid} />
          <Text style={styles.loadingText}>미션 페이퍼를 준비하고 있어요…</Text>
        </View>
      </View>
    );
  }

  const iAmA = couple.user_a_id === session.user.id;
  const nameA = iAmA ? (profile?.display_name ?? 'A') : (partner?.display_name ?? 'A');
  const nameB = iAmA ? (partner?.display_name ?? 'B') : (profile?.display_name ?? 'B');

  return (
    <View style={styles.container}>
      <ProgressSteps current={4} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>✉️ 우리의 미션 페이퍼</Text>
        <Text style={styles.hint}>
          과제가 아니라 제안이에요. 할 수 있는 것부터, 천천히.
        </Text>

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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: 48 },
  loading: {},
  loadingBody: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: colors.ink3,
    fontFamily: fonts.body,
  },
  scroll: { padding: 20, paddingBottom: 40 },
  title: {
    fontSize: 20,
    color: colors.ink,
    fontFamily: fonts.displayMedium,
    marginTop: 8,
  },
  hint: {
    fontSize: 13,
    color: colors.ink3,
    marginTop: 4,
    marginBottom: 12,
    fontFamily: fonts.body,
  },
  doneButton: {
    backgroundColor: colors.tealMid,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  doneDisabled: { opacity: 0.55 },
  doneText: { color: '#fff', fontSize: 15, fontFamily: fonts.bodyMedium },
  doneHint: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.ink3,
    marginTop: 10,
    fontFamily: fonts.body,
  },
});
