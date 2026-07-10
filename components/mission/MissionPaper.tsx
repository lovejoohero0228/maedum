// 미션 페이퍼 (AGENT.md §7-4) — 화이트 소프트 카드 두 컬럼, 사용자 색 도트 (EMBr 스타일)
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, ui, userTheme, type UserColor } from '@/constants/colors';
import type { MissionItem } from '@/lib/types';

interface MissionColumnProps {
  name: string;
  color: UserColor;
  missions: MissionItem[];
}

function MissionColumn({ name, color, missions }: MissionColumnProps) {
  const theme = userTheme(color);
  return (
    <View style={styles.column}>
      <Text style={[styles.columnTitle, { color: theme.text }]}>{name}의 미션</Text>
      {missions.map((m, i) => (
        <View key={i} style={styles.item}>
          <View style={[styles.itemDot, { backgroundColor: theme.mid }]} />
          <Text style={styles.itemText}>{m.text}</Text>
        </View>
      ))}
    </View>
  );
}

interface MissionPaperProps {
  nameA: string;
  nameB: string;
  colorA: UserColor;
  colorB: UserColor;
  missionsA: MissionItem[];
  missionsB: MissionItem[];
}

export function MissionPaper({
  nameA,
  nameB,
  colorA,
  colorB,
  missionsA,
  missionsB,
}: MissionPaperProps) {
  return (
    <View style={styles.grid}>
      <MissionColumn name={nameA} color={colorA} missions={missionsA} />
      <MissionColumn name={nameB} color={colorB} missions={missionsB} />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: 12, marginVertical: 10 },
  column: {
    ...ui.card,
    flex: 1,
    padding: 16,
  },
  columnTitle: {
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    marginBottom: 12,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 12,
  },
  itemDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
  },
  itemText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 21,
    color: colors.ink,
    fontFamily: fonts.body,
  },
});
