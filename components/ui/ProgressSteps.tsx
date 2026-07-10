// 플로우 진행 표시 (01 시작 → 02 입력 → 03 편지 → 04 미션)
// 상단 얇은 진행 바 + 현재 단계의 작은 라벨 (EMBr 스타일)
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, ui } from '@/constants/colors';

const STEPS = ['시작', '입력', '편지', '미션'];

interface ProgressStepsProps {
  current: number; // 1~4
}

export function ProgressSteps({ current }: ProgressStepsProps) {
  const step = Math.max(1, Math.min(STEPS.length, current));
  const pct = (step / STEPS.length) * 100;
  return (
    <View style={styles.wrap}>
      <View style={ui.progressTrack}>
        <View style={[ui.progressFill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.label}>{STEPS[step - 1]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: 10,
    gap: 8,
  },
  label: {
    fontSize: 12,
    color: colors.ink3,
    textAlign: 'center',
    fontFamily: fonts.body,
  },
});
