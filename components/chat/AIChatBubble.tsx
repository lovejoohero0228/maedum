// AI 메시지 버블 — purple 테마 (AGENT.md §8)
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
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>✦</Text>
      </View>
      <View style={styles.bubbleWrap}>
        {flag ? <FlagBadge flag={flag} text={flagText} /> : null}
        <View style={styles.bubble}>
          <Text style={styles.text}>{message}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 6,
    paddingRight: 48,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.purpleMid,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 2,
  },
  avatarText: { color: '#fff', fontSize: 14 },
  bubbleWrap: { flex: 1 },
  bubble: {
    backgroundColor: colors.purpleTint,
    borderRadius: 14,
    borderTopLeftRadius: 4,
    padding: 12,
  },
  text: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: fonts.body,
  },
});
