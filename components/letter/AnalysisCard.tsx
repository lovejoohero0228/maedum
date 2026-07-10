// 중재자 분석 — 화이트 소프트 카드 섹션, 좌측 정렬 세리프 제목 (EMBr 스타일)
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, ui } from '@/constants/colors';

interface AnalysisCardProps {
  icon: string;    // 작은 뮤트 글리프 — 예: "◷" "△" "✦"
  title: string;   // 섹션 제목
  children: React.ReactNode;
}

export function AnalysisCard({ icon, title, children }: AnalysisCardProps) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.icon}>{icon}</Text>
        <Text style={styles.title}>{title}</Text>
      </View>
      <View>{children}</View>
    </View>
  );
}

export function AnalysisText({ children }: { children: React.ReactNode }) {
  return <Text style={styles.body}>{children}</Text>;
}

const styles = StyleSheet.create({
  section: {
    ...ui.card,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  icon: { fontSize: 13, color: colors.ink3 },
  title: {
    fontSize: 17,
    color: colors.ink,
    fontFamily: fonts.displayMedium,
  },
  body: {
    fontSize: 14,
    lineHeight: 23,
    color: colors.ink2,
    fontFamily: fonts.body,
    marginBottom: 6,
  },
});
