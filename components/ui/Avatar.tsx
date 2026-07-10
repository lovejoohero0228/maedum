// 이름 이니셜 아바타 — 사용자 색 틴트 배경 + 잉크 톤 이니셜, 헤어라인 링
import { StyleSheet, Text, View } from 'react-native';
import { fonts, userTheme, type UserColor } from '@/constants/colors';

interface AvatarProps {
  name: string;
  color: UserColor;
  size?: number;
}

export function Avatar({ name, color, size = 36 }: AvatarProps) {
  const theme = userTheme(color);
  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.tint,
          borderColor: theme.mid,
        },
      ]}
    >
      <Text style={[styles.initial, { fontSize: size * 0.4, color: theme.text }]}>
        {name.slice(0, 1)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  initial: { fontFamily: fonts.displayMedium },
});
