// 편지 — 워시 위에 놓이는 화이트 소프트 카드, 세리프 본문 (EMBr 스타일)
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, ui, userTheme, type UserColor } from '@/constants/colors';

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
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    ...ui.card,
    paddingVertical: 26,
    paddingHorizontal: 24,
    marginVertical: 10,
  },
  title: {
    fontSize: 13,
    fontFamily: fonts.bodyMedium,
    marginBottom: 14,
  },
  body: {
    fontSize: 16,
    lineHeight: 30,
    color: colors.ink,
    fontFamily: fonts.display,
  },
});
