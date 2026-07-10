// ⚠ / ✓ / ✦ 배지 (AGENT.md §7-2) — 채움 없는 조용한 텍스트 라벨
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '@/constants/colors';
import type { FlagType } from '@/lib/types';

const FLAG_STYLE: Record<FlagType, { icon: string; fg: string; defaultText: string }> = {
  warn: { icon: '⚠', fg: colors.amberText, defaultText: '좀 더 확인이 필요해요' },
  ok: { icon: '✓', fg: colors.tealText, defaultText: '좋아요, 이해됐어요' },
  purple: { icon: '•', fg: colors.purpleText, defaultText: '한 가지만 더' },
};

interface FlagBadgeProps {
  flag: FlagType;
  text?: string | null;
}

export function FlagBadge({ flag, text }: FlagBadgeProps) {
  const s = FLAG_STYLE[flag];
  return (
    <View style={styles.badge}>
      <Text style={[styles.text, { color: s.fg }]}>
        {s.icon} {text ?? s.defaultText}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  text: {
    fontSize: 12,
    fontFamily: fonts.bodyMedium,
  },
});
