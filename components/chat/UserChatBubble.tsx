// 사용자 메시지 — 크림 바탕 위의 화이트 소프트 버블 (EMBr 스타일), 사용자 색은 은은한 틴트로
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, userTheme, type UserColor } from '@/constants/colors';

interface UserChatBubbleProps {
  message: string;
  color: UserColor;
}

export function UserChatBubble({ message, color }: UserChatBubbleProps) {
  const theme = userTheme(color);
  return (
    <View style={styles.row}>
      <View style={[styles.bubble, { borderColor: theme.tint }]}>
        <Text style={styles.text}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginVertical: 8,
    paddingLeft: 48,
  },
  bubble: {
    backgroundColor: colors.bgCard,
    borderWidth: 1.5,
    borderRadius: 20,
    borderBottomRightRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 11,
    maxWidth: '100%',
  },
  text: {
    fontSize: 15,
    lineHeight: 23,
    color: colors.ink,
    fontFamily: fonts.body,
  },
});
