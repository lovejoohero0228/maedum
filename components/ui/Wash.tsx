// 화면 상단의 그라데이션 워시 — EMBr 레퍼런스의 피치/핑크 글로우
// 스크린 최상단에 절대 배치되어 콘텐츠 뒤로 은은하게 깔린다.
// 커스텀 그라데이션(colors) 또는 이미지(imageUrl, 하단이 크림으로 페이드)도 지원 — 홈 배경 선택에 사용.
import { ImageBackground, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors as tokens, gradients } from '@/constants/colors';

interface WashProps {
  variant?: keyof typeof gradients; // 'wash' | 'pink' | 'ember'
  height?: number;
  colors?: readonly [string, string]; // 프리셋 그라데이션 오버라이드 (variant보다 우선)
  imageUrl?: string;                  // 커스텀 배경 이미지 (colors보다 우선)
}

export function Wash({ variant = 'wash', height = 260, colors, imageUrl }: WashProps) {
  if (imageUrl) {
    return (
      <View style={[styles.wash, { height }]} pointerEvents="none">
        <ImageBackground source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover">
          {/* 하단을 크림으로 페이드시켜 콘텐츠와 자연스럽게 이어붙인다 */}
          <LinearGradient
            colors={['rgba(246,241,232,0.15)', tokens.bg]}
            style={StyleSheet.absoluteFill}
          />
        </ImageBackground>
      </View>
    );
  }
  const stops = colors ?? gradients[variant];
  return (
    <LinearGradient
      colors={[stops[0], stops[1]]}
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
    overflow: 'hidden',
  },
});
