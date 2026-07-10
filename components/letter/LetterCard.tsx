// 편지 — 종이 위의 편지처럼: 세리프 본문, 헤어라인 룰, 발신자 색은 작은 라벨로만
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, userTheme, type UserColor } from '@/constants/colors';

interface LetterCardProps {
  title: string;       // 예: "민준이의 속마음"
  body: string;        // 편지 본문
  senderColor: UserColor;
}

export function LetterCard({ title, body, senderColor }: LetterCardProps) {
  const theme = userTheme(senderColor);
  return (
    <View style={styles.sheet}>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      <View style={styles.rule} />
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.bgCard,
    borderRadius: 4,
    paddingVertical: 28,
    paddingHorizontal: 24,
    marginVertical: 10,
  },
  title: {
    fontSize: 12,
    letterSpacing: 2,
    fontFamily: fonts.bodyMedium,
    textAlign: 'center',
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.line,
    marginTop: 14,
    marginBottom: 20,
    alignSelf: 'center',
    width: 48,
  },
  body: {
    fontSize: 16,
    lineHeight: 30,
    color: colors.ink,
    fontFamily: fonts.display,
  },
});
