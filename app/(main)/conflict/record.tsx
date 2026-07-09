// 지난 기록 상세 열람 (읽기 전용) — 편지 양방향 → 분석 → 마음가짐 → 미션 → 대화 가이드
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useConflictStore } from '@/store/conflictStore';
import { getOutputs } from '@/services/conflictService';
import { letterForMe, letterFromMe } from '@/services/aiLetterService';
import { parseAnalysis } from '@/services/aiAnalysisService';
import { LetterCard } from '@/components/letter/LetterCard';
import { AnalysisCard, AnalysisText } from '@/components/letter/AnalysisCard';
import { MissionPaper } from '@/components/mission/MissionPaper';
import { ConvoGuide } from '@/components/mission/ConvoGuide';
import { colors, fonts, userTheme, type UserColor } from '@/constants/colors';
import type { ConflictOutputs } from '@/lib/types';

export default function Record() {
  const { id, title, date } = useLocalSearchParams<{ id: string; title?: string; date?: string }>();
  const session = useConflictStore((s) => s.session);
  const couple = useConflictStore((s) => s.couple);
  const profile = useConflictStore((s) => s.profile);
  const partner = useConflictStore((s) => s.partner);
  const myColor = useConflictStore((s) => s.myColor);

  const [outputs, setOutputs] = useState<ConflictOutputs | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getOutputs(id)
      .then(setOutputs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const header = (
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} hitSlop={8}>
        <Text style={styles.back}>←</Text>
      </Pressable>
      <View style={styles.headerCenter}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title || '지난 맺음'}
        </Text>
        {date ? <Text style={styles.headerDate}>{date}</Text> : null}
      </View>
      <View style={{ width: 24 }} />
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.purpleMid} />
        </View>
      </View>
    );
  }

  if (!outputs || !couple || !session) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.center}>
          <Text style={styles.empty}>
            이 기록에는 아직 열람할 결과물이 없어요.{'\n'}
            (편지가 만들어지기 전에 마무리된 기록이에요)
          </Text>
        </View>
      </View>
    );
  }

  const iAmA = couple.user_a_id === session.user.id;
  const myName = profile?.display_name ?? '나';
  const partnerName = partner?.display_name ?? '상대';
  const nameA = iAmA ? myName : partnerName;
  const nameB = iAmA ? partnerName : myName;
  const partnerColor = myColor() === 'blue' ? 'coral' : 'blue';

  const receivedLetter = letterForMe(outputs, couple, session.user.id);
  const sentLetter = letterFromMe(outputs, couple, session.user.id);
  const analysis = parseAnalysis(outputs);
  const allMindsets: { name: string; text: string | null; color: UserColor }[] = [
    { name: myName, text: iAmA ? outputs.mindset_a : outputs.mindset_b, color: myColor() },
    { name: partnerName, text: iAmA ? outputs.mindset_b : outputs.mindset_a, color: partnerColor },
  ];
  const mindsets = allMindsets.filter((m) => !!m.text);

  return (
    <View style={styles.container}>
      {header}
      <ScrollView contentContainerStyle={styles.scroll}>
        {receivedLetter ? (
          <>
            <Text style={styles.sectionTitle}>💌 {partnerName}의 편지</Text>
            <LetterCard
              title={`${partnerName}의 편지`}
              body={receivedLetter}
              senderColor={partnerColor}
            />
          </>
        ) : null}

        {sentLetter ? (
          <>
            <Text style={styles.sectionTitle}>✉️ 내가 보낸 편지</Text>
            <LetterCard
              title={`내가 ${partnerName}에게 보낸 편지`}
              body={sentLetter}
              senderColor={myColor()}
            />
          </>
        ) : null}

        <Text style={styles.sectionTitle}>🔍 함께 본 분석</Text>

        {analysis.timing?.person_a && analysis.timing?.person_b ? (
          <AnalysisCard icon="🕐" title="마음이 상한 시점이 달라요">
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
          <AnalysisCard icon="🌡" title="온도가 달랐던 이유">
            <AnalysisText>{analysis.temperature.scale_diff_explanation}</AnalysisText>
            <AnalysisText>{analysis.temperature.main_text}</AnalysisText>
          </AnalysisCard>
        ) : null}

        {analysis.understanding ? (
          <AnalysisCard icon="🤝" title="이미 서로 이해하고 있어요">
            <AnalysisText>{analysis.understanding.a_understands_b}</AnalysisText>
            <AnalysisText>{analysis.understanding.b_understands_a}</AnalysisText>
            <AnalysisText>{analysis.understanding.bridge_text}</AnalysisText>
          </AnalysisCard>
        ) : null}

        {mindsets.length ? (
          <>
            <Text style={styles.sectionTitle}>🧭 대화 전 마음가짐</Text>
            <View style={styles.mindsetCard}>
              {mindsets.map((m, i) => (
                <View
                  key={i}
                  style={[styles.mindsetItem, { backgroundColor: userTheme(m.color).tint }]}
                >
                  <Text style={[styles.mindsetName, { color: userTheme(m.color).text }]}>
                    {m.name}
                  </Text>
                  <Text style={styles.mindsetText}>{m.text}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {outputs.mission_a?.length || outputs.mission_b?.length ? (
          <>
            <Text style={styles.sectionTitle}>✉️ 미션 페이퍼</Text>
            <MissionPaper
              nameA={nameA}
              nameB={nameB}
              colorA="blue"
              colorB="coral"
              missionsA={outputs.mission_a ?? []}
              missionsB={outputs.mission_b ?? []}
            />
          </>
        ) : null}

        {outputs.convo_guide?.length ? (
          <ConvoGuide
            steps={outputs.convo_guide}
            note={outputs.convo_note}
            nameA={nameA}
            nameB={nameB}
            colorA="blue"
            colorB="coral"
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: 56 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 8,
    gap: 12,
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  back: { fontSize: 22, color: colors.ink2 },
  headerTitle: { fontSize: 17, color: colors.ink, fontFamily: fonts.displayMedium },
  headerDate: { fontSize: 11, color: colors.ink3, marginTop: 2, fontFamily: fonts.body },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  empty: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 22,
    color: colors.ink3,
    fontFamily: fonts.body,
  },
  scroll: { padding: 20, paddingBottom: 40 },
  sectionTitle: {
    fontSize: 16,
    color: colors.ink,
    fontFamily: fonts.displayMedium,
    marginTop: 16,
    marginBottom: 6,
  },
  mindsetCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
  },
  mindsetItem: { borderRadius: 12, padding: 12, marginBottom: 8 },
  mindsetName: { fontSize: 12, fontFamily: fonts.bodyMedium, marginBottom: 4 },
  mindsetText: { fontSize: 14, lineHeight: 21, color: colors.ink2, fontFamily: fonts.body },
});
