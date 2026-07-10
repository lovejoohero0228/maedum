// 화면 상단의 그라데이션 워시 — EMBr 레퍼런스의 피치/핑크 글로우
// 스크린 최상단에 절대 배치되어 콘텐츠 뒤로 은은하게 깔린다.
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients } from '@/constants/colors';

interface WashProps {
  variant?: keyof typeof gradients; // 'wash' | 'pink' | 'ember'
  height?: number;
}

export function Wash({ variant = 'wash', height = 260 }: WashProps) {
  return (
    <LinearGradient
      colors={[...gradients[variant]]}
      style={[styles.wash, { height }]}
      pointerEvents="none"
    />
  );
}

const styles = StyleSheet.create({
  wash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});
