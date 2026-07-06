// 사용자 메시지 버블 — 사용자 색상(blue/coral) 테마
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
    marginVertical: 6,
    paddingLeft: 48,
  },
  bubble: {
    borderRadius: 14,
    borderTopRightRadius: 4,
    padding: 12,
    maxWidth: '100%',
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: fonts.body,
  },
});
