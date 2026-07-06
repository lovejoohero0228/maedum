// 편지 카드 — 세리프 본문, 발신자 색상 테두리
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
    <View style={[styles.card, { borderColor: theme.mid }]}>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: 18,
    marginVertical: 8,
  },
  title: {
    fontSize: 13,
    fontFamily: fonts.bodyMedium,
    marginBottom: 10,
  },
  body: {
    fontSize: 15,
    lineHeight: 26,
    color: colors.ink,
    fontFamily: fonts.display,
  },
});
