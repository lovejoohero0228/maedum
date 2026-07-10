// 미션 페이퍼 (AGENT.md §7-4) — 틴트 박스 대신 사용자 색 상단 룰이 있는 두 컬럼
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, userTheme, type UserColor } from '@/constants/colors';
import type { MissionItem } from '@/lib/types';

// 컬러 이모지 대신 잉크 톤 모노크롬 글리프 (Find Your Faith 그래머)
const missionGlyph: Record<MissionItem['type'], string> = {
  prevent: '✧',
  differently: '❖',
  empathy: '☙',
  habit: '◦',
  acknowledge: '✦',
  action: '➔',
};

interface MissionColumnProps {
  name: string;
  color: UserColor;
  missions: MissionItem[];
}

function MissionColumn({ name, color, missions }: MissionColumnProps) {
  const theme = userTheme(color);
  return (
    <View style={[styles.column, { borderTopColor: theme.mid }]}>
      <Text style={[styles.columnTitle, { color: theme.text }]}>{name}의 미션</Text>
      {missions.map((m, i) => (
        <View key={i} style={styles.item}>
          <Text style={styles.itemIcon}>{missionGlyph[m.type] ?? '✦'}</Text>
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
  grid: { flexDirection: 'row', gap: 20, marginVertical: 10 },
  column: {
    flex: 1,
    borderTopWidth: 2,
    paddingTop: 12,
  },
  columnTitle: {
    fontSize: 13,
    letterSpacing: 1,
    fontFamily: fonts.bodyMedium,
    marginBottom: 12,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    marginBottom: 12,
  },
  itemIcon: { fontSize: 13, marginTop: 2, color: colors.ink2 },
  itemText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 21,
    color: colors.ink,
    fontFamily: fonts.body,
  },
});
