// 중재자 분석 — 박스 대신 헤어라인 디바이더로 나뉘는 섹션, 세리프 제목
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '@/constants/colors';

interface AnalysisCardProps {
  icon: string;    // 모노크롬 글리프 — 예: "◷" "△" "✦"
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
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    paddingTop: 18,
    paddingBottom: 10,
    marginVertical: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  icon: { fontSize: 13, color: colors.ink2 },
  title: {
    fontSize: 16,
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
