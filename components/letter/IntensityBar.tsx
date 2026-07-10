// 갈등/속상함 크기 바 (AGENT.md §7-3) — value/10 * 100% fill, 얇은 헤어라인 트랙
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, userTheme, type UserColor } from '@/constants/colors';

interface IntensityBarProps {
  label: string; // "이 갈등 크기" | "내 속상함"
  value: number; // 1~10
  color: UserColor;
}

export function IntensityBar({ label, value, color }: IntensityBarProps) {
  const theme = userTheme(color);
  const pct = Math.max(0, Math.min(10, value)) * 10;
  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.value, { color: theme.text }]}>{value}/10</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: theme.mid }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginVertical: 8 },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: { fontSize: 13, color: colors.ink2, fontFamily: fonts.body },
  value: { fontSize: 13, fontFamily: fonts.bodyMedium },
  track: {
    height: 6,
    borderRadius: 100,
    backgroundColor: colors.line2,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 100 },
});
