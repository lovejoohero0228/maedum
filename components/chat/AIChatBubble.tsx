// AI 메시지 — 차분한 다크 텍스트 + 작은 엠버 도트 액센트 (EMBr 스타일)
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
      <View style={styles.marker} />
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
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.purpleMid,
    marginRight: 12,
    marginTop: 9,
  },
  bubbleWrap: { flex: 1 },
  text: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 26,
    fontFamily: fonts.body,
  },
});
