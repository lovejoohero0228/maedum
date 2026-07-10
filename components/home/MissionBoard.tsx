// 홈 상단 장기 미션 보드 — 맺음마다 쌓이는 "천천히 이어가기" 빅 미션을 항상 보여준다.
// 좌우: 각자 노력할 것(사용자 색), 하단: 둘이 함께 노력할 것. "자세히 보기" → /(main)/missions
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Maedeubi } from '@/components/ui/Maedeubi';
import { colors, fonts, ui, userTheme, type UserColor } from '@/constants/colors';
import type { OngoingMissionRecord } from '@/services/missionService';

// 홈에서는 최신 미션 위주로 컴팩트하게 (전체는 자세히 보기에서)
const MAX_PER_PERSON = 3;
const MAX_BOTH = 2;

interface MissionBoardProps {
  records: OngoingMissionRecord[]; // 최신순
  myName: string;
  partnerName: string;
  myIsA: boolean;
  myColor: UserColor;
}

export function MissionBoard({ records, myName, partnerName, myIsA, myColor }: MissionBoardProps) {
  if (records.length === 0) return null;

  const mine = records.flatMap((r) => (myIsA ? r.missionA : r.missionB)).slice(0, MAX_PER_PERSON);
  const partners = records
    .flatMap((r) => (myIsA ? r.missionB : r.missionA))
    .slice(0, MAX_PER_PERSON);
  const both = records.flatMap((r) => r.missionBoth).slice(0, MAX_BOTH);
  if (!mine.length && !partners.length && !both.length) return null;

  const partnerColor: UserColor = myColor === 'blue' ? 'coral' : 'blue';

  const column = (name: string, color: UserColor, items: { text: string }[]) => {
    const theme = userTheme(color);
    return (
      <View style={styles.column}>
        <Text style={[styles.columnTitle, { color: theme.text }]}>{name}가 노력할 것</Text>
        {items.length ? (
          items.map((m, i) => (
            <View key={i} style={styles.item}>
              <View style={[styles.dot, { backgroundColor: theme.mid }]} />
              <Text style={styles.itemText} numberOfLines={3}>
                {m.text}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>아직 없어요</Text>
        )}
      </View>
    );
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Maedeubi size={20} />
          <Text style={styles.sectionTitle}>우리가 이어가는 노력</Text>
        </View>
        <Pressable onPress={() => router.push('/(main)/missions')} hitSlop={8}>
          <Text style={styles.detailLink}>자세히 보기 →</Text>
        </Pressable>
      </View>
      <View style={styles.grid}>
        {column(myName, myColor, mine)}
        {column(partnerName, partnerColor, partners)}
      </View>
      {both.length ? (
        <View style={styles.bothCard}>
          <Text style={styles.bothTitle}>둘이 함께</Text>
          {both.map((m, i) => (
            <View key={i} style={styles.item}>
              <View style={[styles.dot, { backgroundColor: colors.tealMid }]} />
              <Text style={styles.itemText} numberOfLines={3}>
                {m.text}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 24 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sectionTitle: {
    fontSize: 15,
    color: colors.ink,
    fontFamily: fonts.displayMedium,
  },
  detailLink: { fontSize: 12, color: colors.ink3, fontFamily: fonts.bodyMedium },
  grid: { flexDirection: 'row', gap: 10 },
  column: {
    ...ui.card,
    flex: 1,
    padding: 14,
  },
  columnTitle: { fontSize: 12, fontFamily: fonts.bodyMedium, marginBottom: 10 },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginBottom: 9 },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 7 },
  itemText: { flex: 1, fontSize: 12, lineHeight: 18, color: colors.ink, fontFamily: fonts.body },
  emptyText: { fontSize: 12, color: colors.ink3, fontFamily: fonts.body },
  bothCard: {
    ...ui.card,
    padding: 14,
    marginTop: 10,
  },
  bothTitle: { fontSize: 12, fontFamily: fonts.bodyMedium, color: colors.tealText, marginBottom: 10 },
});
