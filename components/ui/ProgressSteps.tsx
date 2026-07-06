// 플로우 진행 단계 표시 (01 시작 → 02 입력 → 03 편지 → 04 미션)
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '@/constants/colors';

const STEPS = ['시작', '입력', '편지', '미션'];

interface ProgressStepsProps {
  current: number; // 1~4
}

export function ProgressSteps({ current }: ProgressStepsProps) {
  return (
    <View style={styles.row}>
      {STEPS.map((label, i) => {
        const stepNum = i + 1;
        const active = stepNum === current;
        const done = stepNum < current;
        return (
          <View key={label} style={styles.step}>
            <View
              style={[
                styles.dot,
                done && styles.dotDone,
                active && styles.dotActive,
              ]}
            >
              <Text style={[styles.dotText, (done || active) && styles.dotTextOn]}>
                {done ? '✓' : stepNum}
              </Text>
            </View>
            <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
            {i < STEPS.length - 1 ? <View style={styles.bar} /> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  step: { flexDirection: 'row', alignItems: 'center' },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.line2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: colors.tealMid },
  dotActive: { backgroundColor: colors.purpleMid },
  dotText: { fontSize: 11, color: colors.ink3, fontFamily: fonts.bodyMedium },
  dotTextOn: { color: '#fff' },
  label: {
    fontSize: 11,
    color: colors.ink3,
    marginLeft: 4,
    fontFamily: fonts.body,
  },
  labelActive: { color: colors.purpleText, fontFamily: fonts.bodyMedium },
  bar: {
    width: 16,
    height: 1,
    backgroundColor: colors.line,
    marginHorizontal: 6,
  },
});
