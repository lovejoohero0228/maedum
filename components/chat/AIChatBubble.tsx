// AI 메시지 — 배경 없는 잉크 세리프 텍스트, 세피아 ✦ 마커 (Find Your Faith 스타일)
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '@/constants/colors';
import { FlagBadge } from './FlagBadge';
import type { FlagType } from '@/lib/types';

interface AIChatBubbleProps {
  message: string;
  flag?: FlagType | null;
  flagText?: string | null;
}

export function AIChatBubble({ message, flag, flagText }: AIChatBubbleProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.marker}>✦</Text>
      <View style={styles.bubbleWrap}>
        {flag ? <FlagBadge flag={flag} text={flagText} /> : null}
        <Text style={styles.text}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 10,
    paddingRight: 40,
  },
  marker: {
    color: colors.purpleMid,
    fontSize: 13,
    marginRight: 10,
    marginTop: 5,
  },
  bubbleWrap: { flex: 1 },
  text: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 27,
    fontFamily: fonts.display,
  },
});
