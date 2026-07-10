// 상대 입력 대기 (AGENT.md §6 — conflict_inputs UPDATE + conflicts UPDATE 구독)
// 내 입력 완료 후: 상대 완료 → ai_processing → letters_delivered 를 실시간 감지
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useConflictStore } from '@/store/conflictStore';
import { showAlert, showConfirm } from '@/lib/alert';
import { restartFromField } from '@/services/aiInputService';
import { ProgressSteps } from '@/components/ui/ProgressSteps';
import { Wash } from '@/components/ui/Wash';
import { colors, ui } from '@/constants/colors';
import { FIELD_ORDER, type Conflict } from '@/lib/types';

export default function Waiting() {
  const conflict = useConflictStore((s) => s.conflict);
  const session = useConflictStore((s) => s.session);
  const partner = useConflictStore((s) => s.partner);
  const setConflict = useConflictStore((s) => s.setConflict);
  const refreshConflict = useConflictStore((s) => s.refreshConflict);
  const [restarting, setRestarting] = useState(false);

  useEffect(() => {
    if (!conflict) return;

    // 이미 편지가 나왔으면 바로 이동
    if (conflict.status === 'letters_delivered' || conflict.status === 'waiting_ready') {
      router.replace('/(main)/conflict/letter');
      return;
    }

    // conflicts 상태 변화 구독 (AGENT.md §6)
    const channel = supabase
      .channel(`conflict-status-${conflict.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conflicts',
          filter: `id=eq.${conflict.id}`,
        },
        (payload) => {
          const updated = payload.new as Conflict;
          setConflict(updated);
          if (updated.status === 'letters_delivered') {
            router.replace('/(main)/conflict/letter');
          }
        },
      )
      .subscribe();

    // realtime 누락 대비 폴링 (30초 간격)
    const poll = setInterval(refreshConflict, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [conflict, setConflict, refreshConflict]);

  const isProcessing = conflict?.status === 'ai_processing';

  // 아직 상대가 입력 중일 때만 — 내 응답을 초기화하고 입력 화면으로 되돌아간다.
  // 상대의 응답에는 영향이 없다. (편지 생성이 시작되면 서비스 단에서 거부된다)
  const onRestart = async () => {
    if (!conflict || !session || restarting) return;
    const ok = await showConfirm(
      '내 응답을 처음부터 다시 작성할까요?',
      '내가 답한 내용이 모두 초기화돼요. 상대의 응답에는 영향이 없어요.',
      '다시 작성',
    );
    if (!ok) return;
    setRestarting(true);
    try {
      await restartFromField(conflict.id, session.user.id, FIELD_ORDER[0]);
      router.replace('/(main)/conflict/input');
    } catch (e) {
      showAlert('오류', String(e));
      setRestarting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Wash />
      <View style={styles.progressWrap}>
        <ProgressSteps current={isProcessing ? 3 : 2} />
      </View>
      <View style={styles.body}>
        <LinearGradient
          colors={isProcessing ? ['#F2A868', '#F6D9D6'] : ['#F6D9D6', '#F8E3C4']}
          style={styles.orb}
        />
        <Text style={styles.title}>
          {isProcessing
            ? 'AI가 두 사람의 편지를 쓰고 있어요'
            : `${partner?.display_name ?? '상대'}의 마음을 기다리는 중`}
        </Text>
        <Text style={styles.desc}>
          {isProcessing
            ? '날것의 감정을 전달 가능한 언어로 바꾸는 중이에요.\n잠시만 기다려주세요.'
            : '상대도 지금 속마음을 정리하고 있어요.\n둘 다 완료되면 편지가 도착해요.'}
        </Text>
        <ActivityIndicator size="small" color={colors.ink3} style={styles.spinner} />
        {!isProcessing ? (
          <Pressable onPress={onRestart} disabled={restarting} style={styles.restartButton}>
            <Text style={styles.restartText}>
              {restarting ? '초기화 중…' : '내 응답 다시 작성하기'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: 56 },
  progressWrap: { paddingHorizontal: 24 },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  orb: {
    width: 88,
    height: 88,
    borderRadius: 44,
    marginBottom: 28,
  },
  title: {
    ...ui.statement,
    fontSize: 20,
    lineHeight: 31,
    textAlign: 'center',
  },
  desc: {
    ...ui.statementSub,
    textAlign: 'center',
    marginTop: 14,
  },
  spinner: { marginTop: 30, opacity: 0.7 },
  restartButton: {
    ...ui.pill,
    marginTop: 34,
  },
  restartText: { ...ui.pillText, fontSize: 13, color: colors.ink2 },
});
