// 상대 입력 대기 (AGENT.md §6 — conflict_inputs UPDATE + conflicts UPDATE 구독)
// 내 입력 완료 후: 상대 완료 → ai_processing → letters_delivered 를 실시간 감지
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useConflictStore } from '@/store/conflictStore';
import { ProgressSteps } from '@/components/ui/ProgressSteps';
import { colors, fonts } from '@/constants/colors';
import type { Conflict } from '@/lib/types';

export default function Waiting() {
  const conflict = useConflictStore((s) => s.conflict);
  const partner = useConflictStore((s) => s.partner);
  const setConflict = useConflictStore((s) => s.setConflict);
  const refreshConflict = useConflictStore((s) => s.refreshConflict);

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

  return (
    <View style={styles.container}>
      <ProgressSteps current={isProcessing ? 3 : 2} />
      <View style={styles.body}>
        <ActivityIndicator size="large" color={colors.purpleMid} />
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: 56 },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 19,
    color: colors.ink,
    textAlign: 'center',
    marginTop: 24,
    fontFamily: fonts.displayMedium,
  },
  desc: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.ink3,
    textAlign: 'center',
    marginTop: 12,
    fontFamily: fonts.body,
  },
});
