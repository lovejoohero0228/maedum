// 매듭이(중재 캐릭터) 메시지 — 차분한 다크 텍스트 + 매듭이 얼굴 마커 (EMBr 스타일)
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '@/constants/colors';
import { Maedeubi } from '@/components/ui/Maedeubi';
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
      {/* 연속 말풍선에서는 첫 번째에만 얼굴을 보여주고 자리는 유지한다 */}
      <View style={styles.marker}>{showName ? <Maedeubi size={28} /> : null}</View>
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
    width: 28,
    marginRight: 10,
    marginTop: 2,
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
