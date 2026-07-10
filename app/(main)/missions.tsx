// 장기 미션 자세히 보기 — 맺음 기록별로 어떤 이야기에서 나온 노력인지 요약과 함께 보여준다
// (홈 상단 미션 보드의 "자세히 보기" 진입)
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useConflictStore } from '@/store/conflictStore';
import { getOngoingMissions, type OngoingMissionRecord } from '@/services/missionService';
import { Wash } from '@/components/ui/Wash';
import { colors, fonts, ui, userTheme } from '@/constants/colors';

export default function Missions() {
  const session = useConflictStore((s) => s.session);
  const couple = useConflictStore((s) => s.couple);
  const profile = useConflictStore((s) => s.profile);
  const partner = useConflictStore((s) => s.partner);
  const myColor = useConflictStore((s) => s.myColor);
  const [records, setRecords] = useState<OngoingMissionRecord[]>([]);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!couple) return;
      getOngoingMissions(couple.id)
        .then(setRecords)
        .catch(() => {})
        .finally(() => setLoaded(true));
    }, [couple]),
  );

  const iAmA = !!couple && !!session && couple.user_a_id === session.user.id;
  const myName = profile?.display_name ?? '나';
  const partnerName = partner?.display_name ?? '상대';
  const myTheme = userTheme(myColor());
  const partnerTheme = userTheme(myColor() === 'blue' ? 'coral' : 'blue');

  const personBlock = (
    name: string,
    theme: ReturnType<typeof userTheme>,
    items: { text: string }[],
  ) =>
    items.length ? (
      <View style={styles.personBlock}>
        <Text style={[styles.personName, { color: theme.text }]}>{name}가 노력할 것</Text>
        {items.map((m, i) => (
          <View key={i} style={styles.item}>
            <View style={[styles.dot, { backgroundColor: theme.mid }]} />
            <Text style={styles.itemText}>{m.text}</Text>
          </View>
        ))}
      </View>
    ) : null;

  return (
    <View style={styles.container}>
      <Wash />
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.back}>←</Text>
        </Pressable>
      </View>
      <Text style={ui.statement}>우리가 이어가는 노력</Text>
      <Text style={styles.sub}>
        맺음을 마칠 때마다 여기에 쌓여요. 과제가 아니라, 서로를 위한 제안이에요.
      </Text>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {loaded && records.length === 0 ? (
          <Text style={styles.empty}>
            아직 이어가는 노력이 없어요.{'\n'}첫 맺음을 마치면 여기에 쌓이기 시작해요.
          </Text>
        ) : null}

        {records.map((r) => {
          const dateText = new Date(r.createdAt).toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });
          return (
            <View key={r.conflictId} style={styles.recordCard}>
              <Pressable
                style={styles.recordHeader}
                onPress={() =>
                  router.push({
                    pathname: '/(main)/conflict/record',
                    params: { id: r.conflictId, title: r.title ?? '', date: dateText },
                  })
                }
              >
                <View style={styles.recordHeaderBody}>
                  <Text style={styles.recordTitle}>{r.title ?? '이날의 맺음'}</Text>
                  <Text style={styles.recordDate}>{dateText}</Text>
                </View>
                <Text style={styles.recordArrow}>→</Text>
              </Pressable>

              {r.summary ? (
                <Text style={styles.summary}>{r.summary}</Text>
              ) : (
                <Text style={styles.summaryEmpty}>
                  이 맺음에는 요약이 없어요. 기록에서 전체 내용을 볼 수 있어요.
                </Text>
              )}

              {personBlock(myName, myTheme, iAmA ? r.missionA : r.missionB)}
              {personBlock(partnerName, partnerTheme, iAmA ? r.missionB : r.missionA)}
              {r.missionBoth.length ? (
                <View style={styles.personBlock}>
                  <Text style={[styles.personName, { color: colors.tealText }]}>둘이 함께</Text>
                  {r.missionBoth.map((m, i) => (
                    <View key={i} style={styles.item}>
                      <View style={[styles.dot, { backgroundColor: colors.tealMid }]} />
                      <Text style={styles.itemText}>{m.text}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: 64, paddingHorizontal: 24 },
  nav: { marginBottom: 20 },
  back: { fontSize: 22, color: colors.ink2 },
  sub: { ...ui.statementSub, marginTop: 8, marginBottom: 20 },
  scroll: { paddingBottom: 48 },
  empty: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.ink3,
    fontFamily: fonts.body,
    textAlign: 'center',
    marginTop: 48,
  },
  recordCard: {
    ...ui.card,
    marginBottom: 14,
  },
  recordHeader: { flexDirection: 'row', alignItems: 'center' },
  recordHeaderBody: { flex: 1 },
  recordTitle: { fontSize: 16, color: colors.ink, fontFamily: fonts.displayMedium },
  recordDate: { fontSize: 12, color: colors.ink3, marginTop: 2, fontFamily: fonts.body },
  recordArrow: { fontSize: 16, color: colors.ink3 },
  summary: {
    fontSize: 13,
    lineHeight: 21,
    color: colors.ink2,
    fontFamily: fonts.body,
    marginTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line2,
  },
  summaryEmpty: {
    fontSize: 12,
    lineHeight: 19,
    color: colors.ink3,
    fontFamily: fonts.body,
    marginTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line2,
  },
  personBlock: { marginTop: 14 },
  personName: { fontSize: 12, fontFamily: fonts.bodyMedium, marginBottom: 8 },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 8 },
  itemText: { flex: 1, fontSize: 13, lineHeight: 21, color: colors.ink, fontFamily: fonts.body },
});
