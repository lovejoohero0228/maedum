// 가입 온보딩에서 고르는 "내 캐릭터" 프리셋 — profiles.character_key에 key가 저장된다
// 따뜻하고 관계 지향적인 동물들로 구성 (톤: 우습지 않게, 다정하게)
export interface CharacterPreset {
  key: string;
  emoji: string;
  label: string;
  // 선택 화면에서 보여줄 한 줄 성격 힌트
  hint: string;
}

export const CHARACTER_PRESETS: CharacterPreset[] = [
  { key: 'otter', emoji: '🦦', label: '수달', hint: '떠내려가지 않게 손을 꼭 잡아요' },
  { key: 'rabbit', emoji: '🐰', label: '토끼', hint: '작은 변화도 금방 알아차려요' },
  { key: 'cat', emoji: '🐈', label: '고양이', hint: '조용하지만 곁을 내어줘요' },
  { key: 'dog', emoji: '🐕', label: '강아지', hint: '마음을 숨기지 못해요' },
  { key: 'bear', emoji: '🐻', label: '곰', hint: '느리지만 한결같아요' },
  { key: 'fox', emoji: '🦊', label: '여우', hint: '말로 마음을 풀어내요' },
  { key: 'penguin', emoji: '🐧', label: '펭귄', hint: '추울수록 곁에 붙어 있어요' },
  { key: 'hedgehog', emoji: '🦔', label: '고슴도치', hint: '가시 안쪽은 누구보다 말랑해요' },
  { key: 'owl', emoji: '🦉', label: '부엉이', hint: '밤늦게까지 이야기를 들어줘요' },
];

export const characterByKey = (key: string | null | undefined): CharacterPreset | null =>
  CHARACTER_PRESETS.find((c) => c.key === key) ?? null;
