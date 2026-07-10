// 사용자 메시지 — 사용자 색상(blue/coral)의 낮은 채도 틴트 시트
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
      <View style={[styles.bubble, { backgroundColor: theme.tint }]}>
        <Text style={[styles.text, { color: colors.ink }]}>{message}</Text>
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
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 11,
    maxWidth: '100%',
  },
  text: {
    fontSize: 15,
    lineHeight: 23,
    fontFamily: fonts.body,
  },
});
