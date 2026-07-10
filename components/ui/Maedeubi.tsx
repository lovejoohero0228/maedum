// 매듭이 — 중재 캐릭터 이미지 (원형 마스크)
// breathe: 대기/생성 화면용 은은한 숨쉬기 애니메이션
import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

const source = require('../../assets/images/maedeubi.png');

interface MaedeubiProps {
  size?: number;
  breathe?: boolean;
}

export function Maedeubi({ size = 32, breathe = false }: MaedeubiProps) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!breathe) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.06,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breathe, scale]);

  return (
    <Animated.Image
      source={source}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        transform: [{ scale }],
      }}
    />
  );
}
