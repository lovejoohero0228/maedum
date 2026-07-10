// 미션 페이퍼 (AGENT.md §7-4) — 화이트 소프트 카드 두 컬럼, 사용자 색 도트 (EMBr 스타일)
// 013 이후: "오늘 바로" 작은 미션 티어 + "천천히 이어가기" 빅 미션 티어
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, ui, userTheme, type UserColor } from '@/constants/colors';
import type { MissionItem, SmallMissionItem } from '@/lib/types';

interface MissionColumnProps {
  name: string;
  color: UserColor;
  missions: MissionItem[];
  smallMissions: SmallMissionItem[];
}

function MissionColumn({ name, color, missions, smallMissions }: MissionColumnProps) {
  const theme = userTheme(color);
  return (
    <View style={styles.column}>
      <Text style={[styles.columnTitle, { color: theme.text }]}>{name}의 미션</Text>

      {smallMissions.length > 0 ? (
        <View style={[styles.smallBlock, { backgroundColor: theme.tint }]}>
          <Text style={[styles.tierLabel, { color: theme.text }]}>오늘 바로</Text>
          {smallMissions.map((m, i) => (
            <View key={i} style={styles.item}>
              <View style={[styles.itemDot, { backgroundColor: theme.mid }]} />
              <Text style={styles.itemText}>{m.text}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {smallMissions.length > 0 && missions.length > 0 ? (
        <Text style={styles.tierLabelQuiet}>천천히 이어가기</Text>
      ) : null}
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
  smallMissionsA?: SmallMissionItem[];
  smallMissionsB?: SmallMissionItem[];
  missionsBoth?: SmallMissionItem[];
}

export function MissionPaper({
  nameA,
  nameB,
  colorA,
  colorB,
  missionsA,
  missionsB,
  smallMissionsA = [],
  smallMissionsB = [],
  missionsBoth = [],
}: MissionPaperProps) {
  return (
    <View>
      <View style={styles.grid}>
        <MissionColumn name={nameA} color={colorA} missions={missionsA} smallMissions={smallMissionsA} />
        <MissionColumn name={nameB} color={colorB} missions={missionsB} smallMissions={smallMissionsB} />
      </View>
      {missionsBoth.length > 0 ? (
        <View style={styles.bothCard}>
          <Text style={styles.bothTitle}>둘이 함께</Text>
          {missionsBoth.map((m, i) => (
            <View key={i} style={styles.item}>
              <View style={[styles.itemDot, { backgroundColor: colors.tealMid }]} />
              <Text style={styles.itemText}>{m.text}</Text>
            </View>
          ))}
        </View>
      ) : null}
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
  smallBlock: {
    borderRadius: 14,
    padding: 12,
    paddingBottom: 2,
    marginBottom: 14,
  },
  tierLabel: {
    fontSize: 11,
    fontFamily: fonts.bodyMedium,
    marginBottom: 10,
  },
  tierLabelQuiet: {
    fontSize: 11,
    fontFamily: fonts.bodyMedium,
    color: colors.ink3,
    marginBottom: 10,
  },
  bothCard: {
    ...ui.card,
    padding: 16,
    marginBottom: 10,
  },
  bothTitle: {
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    color: colors.tealText,
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
