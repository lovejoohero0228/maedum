// 지난 기록 상세 열람 (읽기 전용) — 받은 편지 / 보낸 편지 / 분석 / 미션 4개 탭
import { useEffect, useRef, useState } from 'react';
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
import { generateMission } from '@/services/missionService';
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
  const [tab, setTab] = useState<'received' | 'sent' | 'analysis' | 'mission'>('received');
  const [regenerating, setRegenerating] = useState(false);
  const regenRequestedRef = useRef(false);

  useEffect(() => {
    if (!id) return;
    getOutputs(id)
      .then(setOutputs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  // 개편 전 형식(마음가짐 없음)의 미션이 남아 있으면 새 형식으로 조용히 재생성해 교체한다
  useEffect(() => {
    if (!id || !outputs || regenRequestedRef.current) return;
    if (outputs.mission_a && !outputs.mindset_a) {
      regenRequestedRef.current = true;
      setRegenerating(true);
      generateMission(id, true)
        .then(() => getOutputs(id))
        .then((fresh) => {
          if (fresh) setOutputs(fresh);
        })
        .catch(() => {})
        .finally(() => setRegenerating(false));
    }
  }, [id, outputs]);

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
          <ActivityIndicator size="small" color={colors.ink3} />
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

  const tabs = [
    { key: 'received', label: '받은 편지' },
    { key: 'sent', label: '보낸 편지' },
    { key: 'analysis', label: '분석' },
    { key: 'mission', label: '미션' },
  ] as const;

  return (
    <View style={styles.container}>
      {header}
      <View style={styles.tabs}>
        {tabs.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => setTab(t.key)}
            style={[styles.tab, tab === t.key && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        {tab === 'received' ? (
          receivedLetter ? (
            <>
              <Text style={styles.sectionTitle}>{partnerName}의 편지</Text>
              <LetterCard
                title={`${partnerName}의 편지`}
                body={receivedLetter}
                senderColor={partnerColor}
              />
            </>
          ) : (
            <Text style={styles.tabEmpty}>받은 편지가 없어요.</Text>
          )
        ) : null}

        {tab === 'sent' ? (
          sentLetter ? (
            <>
              <Text style={styles.sectionTitle}>내가 보낸 편지</Text>
              <LetterCard
                title={`내가 ${partnerName}에게 보낸 편지`}
                body={sentLetter}
                senderColor={myColor()}
              />
            </>
          ) : (
            <Text style={styles.tabEmpty}>보낸 편지가 없어요.</Text>
          )
        ) : null}

        {tab === 'analysis' ? (
          <>
            <Text style={styles.sectionTitle}>함께 본 분석</Text>

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

            {!analysis.timing && !analysis.temperature && !analysis.understanding ? (
              <Text style={styles.tabEmpty}>분석 기록이 없어요.</Text>
            ) : null}
          </>
        ) : null}

        {tab === 'mission' ? (
          regenerating ? (
            <View style={styles.regenBox}>
              <ActivityIndicator size="small" color={colors.ink3} />
              <Text style={styles.tabEmpty}>미션 페이퍼를 새 버전으로 다시 만드는 중…</Text>
            </View>
          ) : (
          <>
            {mindsets.length ? (
              <>
                <Text style={styles.sectionTitle}>대화 전 마음가짐</Text>
                <View style={styles.mindsetCard}>
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
              </>
            ) : null}

            {outputs.mission_a?.length || outputs.mission_b?.length ? (
              <>
                <Text style={styles.sectionTitle}>미션 페이퍼</Text>
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

            {!mindsets.length && !outputs.mission_a?.length && !outputs.convo_guide?.length ? (
              <Text style={styles.tabEmpty}>미션 페이퍼가 만들어지기 전의 기록이에요.</Text>
            ) : null}
          </>
          )
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
    paddingHorizontal: 24,
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
  scroll: { padding: 24, paddingBottom: 48 },
  tabs: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 28,
    marginHorizontal: 24,
    marginTop: 6,
  },
  tab: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
    alignItems: 'center',
  },
  tabActive: { borderBottomColor: colors.ink },
  tabText: { fontSize: 13, color: colors.ink3, fontFamily: fonts.bodyMedium },
  tabTextActive: { color: colors.ink },
  tabEmpty: {
    textAlign: 'center',
    fontSize: 13,
    color: colors.ink3,
    marginTop: 40,
    fontFamily: fonts.body,
  },
  regenBox: { alignItems: 'center', gap: 4, marginTop: 20 },
  sectionTitle: {
    fontSize: 18,
    color: colors.ink,
    fontFamily: fonts.displayMedium,
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 10,
  },
  mindsetCard: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 14,
  },
  mindsetItem: { borderLeftWidth: 2, paddingLeft: 14, paddingVertical: 2, marginBottom: 14 },
  mindsetName: {
    fontSize: 12,
    fontFamily: fonts.bodyMedium,
    letterSpacing: 2,
    marginBottom: 4,
  },
  mindsetText: { fontSize: 14, lineHeight: 21, color: colors.ink2, fontFamily: fonts.body },
});
