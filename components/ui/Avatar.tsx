// 프로필 아바타 — 사용자 색 틴트의 소프트 원 안에 캐릭터 이모지(온보딩에서 고른 동물),
// 캐릭터가 없으면 이름 이니셜 폴백 (EMBr 스타일, 링 없음)
import { StyleSheet, Text, View } from 'react-native';
import { fonts, userTheme, type UserColor } from '@/constants/colors';
import { characterByKey } from '@/constants/characters';

interface AvatarProps {
  name: string;
  color: UserColor;
  size?: number;
  characterKey?: string | null;
}

export function Avatar({ name, color, size = 36, characterKey }: AvatarProps) {
  const theme = userTheme(color);
  const character = characterByKey(characterKey);
  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.tint,
        },
      ]}
    >
      {character ? (
        <Text style={{ fontSize: size * 0.55, lineHeight: size * 0.7 }}>{character.emoji}</Text>
      ) : (
        <Text style={[styles.initial, { fontSize: size * 0.4, color: theme.text }]}>
          {name.slice(0, 1)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { fontFamily: fonts.bodyMedium },
});
