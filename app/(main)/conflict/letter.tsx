// 03단계: AI 우체통 + 분석 (AGENT.md §4-3)
// 내가 받은 편지 + 중재자 분석 3섹션 + "대화 준비됐어요" 버튼
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
import { letterForMe, letterFromMe } from '@/services/aiLetterService';
import { parseAnalysis } from '@/services/aiAnalysisService';
import { markReady } from '@/services/conflictService';
import { generateMission } from '@/services/missionService';
import { getMyInput } from '@/services/aiInputService';
import { LetterCard } from '@/components/letter/LetterCard';
import { IntensityBar } from '@/components/letter/IntensityBar';
import { AnalysisCard, AnalysisText } from '@/components/letter/AnalysisCard';
import { ProgressSteps } from '@/components/ui/ProgressSteps';
import { colors, fonts, ui } from '@/constants/colors';

export default function Letter() {
  const session = useConflictStore((s) => s.session);
  const conflict = useConflictStore((s) => s.conflict);
  const couple = useConflictStore((s) => s.couple);
  const partner = useConflictStore((s) => s.partner);
  const outputs = useConflictStore((s) => s.outputs);
  const loadOutputs = useConflictStore((s) => s.loadOutputs);
  const myColor = useConflictStore((s) => s.myColor);

  const [myScales, setMyScales] = useState<{ conflict: number; emotion: number } | null>(null);
  const [iAmReady, setIAmReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [letterTab, setLetterTab] = useState<'received' | 'sent'>('received');

  // 편지/분석 로드 — 단발 호출이 실패하거나(네트워크/일시 오류) 생성 직후 타이밍이 어긋나면
  // 영원히 로딩에 갇히므로, outputs가 도착할 때까지 짧은 간격으로 재시도한다.
  useEffect(() => {
    const tick = () => loadOutputs().catch(() => {});
    tick();
    const timer = setInterval(() => {
      if (useConflictStore.getState().outputs) {
        clearInterval(timer);
        return;
      }
      tick();
    }, 2500);
    return () => clearInterval(timer);
  }, [loadOutputs]);

  // 내 갈등 크기 수치 (IntensityBar용)
  useEffect(() => {
    if (!conflict || !session) return;
    getMyInput(conflict.id, session.user.id).then((input) => {
      if (input?.conflict_scale != null && input?.emotion_scale != null) {
        setMyScales({ conflict: input.conflict_scale, emotion: input.emotion_scale });
      }
    });
  }, [conflict, session]);

  // 내 ready 여부 복원 + 상대 ready 실시간 감지 (AGENT.md §6)
  useEffect(() => {
    if (!conflict || !session) return;

    supabase
      .from('conflict_ready_states')
      .select('user_id')
      .eq('conflict_id', conflict.id)
      .then(({ data }) => {
        const mine = data?.some((r) => r.user_id === session.user.id);
        if (mine) setIAmReady(true);
        if ((data?.length ?? 0) >= 2) goMission();
      });

    const channel = supabase
      .channel(`ready-${conflict.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conflict_ready_states',
          filter: `conflict_id=eq.${conflict.id}`,
        },
        async () => {
          const { data } = await supabase
            .from('conflict_ready_states')
            .select('user_id')
            .eq('conflict_id', conflict.id);
          if ((data?.length ?? 0) >= 2) goMission();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conflict, session]);

  const goMission = () => {
    if (conflict) generateMission(conflict.id).catch(() => {});
    router.replace('/(main)/conflict/mission');
  };

  const onReady = async () => {
    if (!conflict || !session || busy) return;
    setBusy(true);
    try {
      const count = await markReady(conflict.id, session.user.id);
      setIAmReady(true);
      if (count >= 2) goMission();
    } catch (e) {
      showAlert('오류', String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!outputs || !couple || !session) {
    return (
      <View style={[styles.container, styles.loading]}>
        <Text style={styles.loadingMark}>❦</Text>
        <Text style={styles.loadingText}>편지를 불러오는 중…</Text>
        <ActivityIndicator size="small" color={colors.ink3} style={styles.loadingSpinner} />
      </View>
    );
  }

  const receivedLetter = letterForMe(outputs, couple, session.user.id);
  const sentLetter = letterFromMe(outputs, couple, session.user.id);
  const analysis = parseAnalysis(outputs);
  const partnerColor = myColor() === 'blue' ? 'coral' : 'blue';
  const partnerName = partner?.display_name ?? '상대';

  return (
    <View style={styles.container}>
      <ProgressSteps current={3} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.letterTabs}>
          <Pressable
            onPress={() => setLetterTab('received')}
            style={[styles.letterTab, letterTab === 'received' && styles.letterTabActive]}
          >
            <Text
              style={[
                styles.letterTabText,
                letterTab === 'received' && styles.letterTabTextActive,
              ]}
            >
              받은 편지
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setLetterTab('sent')}
            style={[styles.letterTab, letterTab === 'sent' && styles.letterTabActive]}
          >
            <Text
              style={[styles.letterTabText, letterTab === 'sent' && styles.letterTabTextActive]}
            >
              내가 보낸 편지
            </Text>
          </Pressable>
        </View>

        {letterTab === 'received' ? (
          <>
            <Text style={styles.sectionTitle}>{partnerName}의 속마음</Text>
            <Text style={styles.sectionHint}>
              AI가 {partnerName}의 이야기를 당신이 이해할 수 있는 말로 정리했어요.
            </Text>
            {receivedLetter ? (
              <LetterCard
                title={`${partnerName}의 편지`}
                body={receivedLetter}
                senderColor={partnerColor}
              />
            ) : null}
          </>
        ) : (
          <>
            <Text style={styles.sectionTitle}>내가 전한 속마음</Text>
            <Text style={styles.sectionHint}>
              내가 정리한 이야기가 {partnerName}에게 이렇게 전해졌어요.
            </Text>
            {sentLetter ? (
              <LetterCard
                title={`내가 ${partnerName}에게 보낸 편지`}
                body={sentLetter}
                senderColor={myColor()}
              />
            ) : null}
          </>
        )}

        {myScales ? (
          <View style={styles.scalesCard}>
            <Text style={styles.scalesTitle}>내가 느낀 크기</Text>
            <IntensityBar label="이 갈등 크기" value={myScales.conflict} color={myColor()} />
            <IntensityBar label="내 속상함" value={myScales.emotion} color={myColor()} />
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>함께 보는 분석</Text>

        {/* 내부 필드까지 확인하고 렌더 — AI 응답의 스키마 드리프트로 person_a 등이 빠져 있으면
            undefined 접근으로 화면 전체가 죽어(흰 화면) 버리므로 카드 단위로 건너뛴다 */}
        {analysis.timing?.person_a && analysis.timing?.person_b ? (
          <AnalysisCard icon="◷" title="마음이 상한 시점이 달라요">
            <AnalysisText>
              {analysis.timing.person_a.name}: {analysis.timing.person_a.when} —{' '}
              {analysis.timing.person_a.why}
            </AnalysisText>
            <AnalysisText>
              {analysis.timing.person_b.name}: {analysis.timing.person_b.when} —{' '}
              {analysis.timing.person_b.why}
            </AnalysisText>
            <AnalysisText>{analysis.timing.summary}</AnalysisText>
          </AnalysisCard>
        ) : null}

        {analysis.temperature ? (
          <AnalysisCard icon="△" title="온도가 달랐던 이유">
            <AnalysisText>{analysis.temperature.scale_diff_explanation}</AnalysisText>
            <AnalysisText>{analysis.temperature.main_text}</AnalysisText>
          </AnalysisCard>
        ) : null}

        {analysis.understanding ? (
          <AnalysisCard icon="✦" title="이미 서로 이해하고 있어요">
            <AnalysisText>{analysis.understanding.a_understands_b}</AnalysisText>
            <AnalysisText>{analysis.understanding.b_understands_a}</AnalysisText>
            <AnalysisText>{analysis.understanding.bridge_text}</AnalysisText>
          </AnalysisCard>
        ) : null}

        <Pressable
          style={[styles.readyButton, (iAmReady || busy) && styles.readyDisabled]}
          onPress={onReady}
          disabled={iAmReady || busy}
        >
          <Text style={styles.readyText}>
            {iAmReady ? `${partnerName}를 기다리는 중…` : '대화 준비됐어요'}
          </Text>
        </Pressable>
        {iAmReady ? (
          <Text style={styles.readyHint}>
            {partnerName}도 준비되면 미션 페이퍼가 열려요.
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: 48 },
  loading: { alignItems: 'center', justifyContent: 'center' },
  loadingMark: { fontSize: 28, marginBottom: 24, color: colors.ink2, fontFamily: fonts.display },
  loadingText: { ...ui.statementSub },
  loadingSpinner: { marginTop: 28, opacity: 0.7 },
  letterTabs: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 28,
    marginBottom: 8,
  },
  letterTab: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  letterTabActive: { borderBottomColor: colors.ink },
  letterTabText: { fontSize: 13, color: colors.ink3, fontFamily: fonts.bodyMedium },
  letterTabTextActive: { color: colors.ink },
  scroll: { padding: 24, paddingBottom: 48 },
  sectionTitle: {
    fontSize: 19,
    color: colors.ink,
    fontFamily: fonts.displayMedium,
    textAlign: 'center',
    marginTop: 28,
    marginBottom: 6,
  },
  sectionHint: {
    ...ui.statementSub,
    fontSize: 12,
    lineHeight: 19,
    marginBottom: 12,
  },
  scalesCard: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 18,
    paddingBottom: 6,
    marginTop: 20,
  },
  scalesTitle: {
    fontSize: 13,
    color: colors.ink2,
    fontFamily: fonts.bodyMedium,
    textAlign: 'center',
    marginBottom: 10,
  },
  readyButton: {
    ...ui.primaryPill,
    alignItems: 'center',
    marginTop: 32,
  },
  readyDisabled: { opacity: 0.55 },
  readyText: { ...ui.primaryPillText },
  readyHint: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.ink3,
    marginTop: 12,
    fontFamily: fonts.body,
  },
});
