// 화면 공통 프레임 — 배경/여백/최대폭 (웹 미리보기 시 폰 프레임 역할)
import { Platform, StyleSheet, View } from 'react-native';
import { colors } from '@/constants/colors';

interface PhoneFrameProps {
  children: React.ReactNode;
}

export function PhoneFrame({ children }: PhoneFrameProps) {
  return (
    <View style={styles.outer}>
      <View style={styles.inner}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
  },
  inner: {
    flex: 1,
    width: '100%',
    // 웹에서는 폰 폭으로 제한해 프로토타입처럼 보이게
    ...(Platform.OS === 'web' ? { maxWidth: 430 } : null),
  },
});
