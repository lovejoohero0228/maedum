// 매듭이(중재 캐릭터) 메시지 — 차분한 다크 텍스트 + 작은 엠버 도트 액센트 (EMBr 스타일)
// 도트는 매듭이 캐릭터 이미지가 준비되면 교체될 자리
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '@/constants/colors';
import { FlagBadge } from './FlagBadge';
import type { FlagType } from '@/lib/types';

interface AIChatBubbleProps {
  message: string;
  flag?: FlagType | null;
  flagText?: string | null;
  // 연속된 매듭이 말풍선 중 첫 번째에만 이름표를 붙일 때 사용
  showName?: boolean;
}

export function AIChatBubble({ message, flag, flagText, showName = true }: AIChatBubbleProps) {
  return (
    <View style={styles.row}>
      <View style={styles.marker} />
      <View style={styles.bubbleWrap}>
        {showName ? <Text style={styles.name}>매듭이</Text> : null}
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
  name: {
    fontSize: 11,
    color: colors.purpleText,
    fontFamily: fonts.bodyMedium,
    marginBottom: 3,
  },
  text: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 26,
    fontFamily: fonts.body,
  },
});
