// 매듭이 — 중재 캐릭터 이미지 (원형 마스크)
// breathe: 대기/생성 화면용 은은한 숨쉬기 애니메이션
// variant: 장면별 표정/포즈 (기본 base — 다소곳이 앉은 매듭이)
import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

const SOURCES = {
  base: require('../../assets/images/maedeubi.png'),
  think: require('../../assets/images/maedeubi-think.png'), // 눈 감고 실을 매듭짓는 중
  letter: require('../../assets/images/maedeubi-letter.png'), // 편지를 머리 위로 든 모습
  question: require('../../assets/images/maedeubi-question.png'), // 갸웃 + 물음표
  celebrate: require('../../assets/images/maedeubi-celebrate.png'), // 만세 + 머리 리본
  comfort: require('../../assets/images/maedeubi-comfort.png'), // 실을 건네는 위로
  connect: require('../../assets/images/maedeubi-connect.png'), // 파랑·코랄 두 실을 하나로 잇는 키비주얼
} as const;

export type MaedeubiVariant = keyof typeof SOURCES;

interface MaedeubiProps {
  size?: number;
  breathe?: boolean;
  variant?: MaedeubiVariant;
}

export function Maedeubi({ size = 32, breathe = false, variant = 'base' }: MaedeubiProps) {
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
      source={SOURCES[variant]}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        transform: [{ scale }],
      }}
    />
  );
}
