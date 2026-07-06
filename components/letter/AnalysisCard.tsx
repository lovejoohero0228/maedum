// 중재자 분석 카드 — 3개 섹션(시점/온도/이해)을 공용 레이아웃으로 표시
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '@/constants/colors';

interface AnalysisCardProps {
  icon: string;    // 예: "🕐" "🌡" "🤝"
  title: string;   // 섹션 제목
  children: React.ReactNode;
}

export function AnalysisCard({ icon, title, children }: AnalysisCardProps) {
  return (
    <View style={styles.card}>
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
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    marginVertical: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  icon: { fontSize: 16 },
  title: {
    fontSize: 14,
    color: colors.purpleText,
    fontFamily: fonts.bodyMedium,
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.ink2,
    fontFamily: fonts.body,
    marginBottom: 4,
  },
});
