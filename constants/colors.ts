// 색상 & 디자인 토큰 (AGENT.md §8)
export const colors = {
  bg:          '#F7F5F2',
  bgCard:      '#FFFFFF',
  ink:         '#1A1917',
  ink2:        '#4A4845',
  ink3:        '#8A8784',
  line:        '#E4E2DD',
  line2:       '#F0EDE8',

  // 사용자 A — blue
  blueTint:    '#E6F1FB',
  blueMid:     '#3A7EC4',
  blueText:    '#185FA5',

  // 사용자 B — coral
  coralTint:   '#FAECE7',
  coralMid:    '#C9583A',
  coralText:   '#993C1D',

  // AI — purple
  purpleTint:  '#EEEDFE',
  purpleMid:   '#6B5FD4',
  purpleText:  '#3C3489',

  // 성공/완료 — teal
  tealTint:    '#E1F5EE',
  tealMid:     '#1E9070',
  tealText:    '#0F6E56',

  // 경고/재질문 — amber
  amberTint:   '#FEF7EA',
  amberText:   '#633806',
} as const;

export type UserColor = 'blue' | 'coral';

export const userTheme = (color: UserColor) => ({
  tint: color === 'blue' ? colors.blueTint : colors.coralTint,
  mid: color === 'blue' ? colors.blueMid : colors.coralMid,
  text: color === 'blue' ? colors.blueText : colors.coralText,
});

// 폰트 패밀리 (app/_layout.tsx에서 로드)
export const fonts = {
  display: 'NotoSerifKR_400Regular',
  displayLight: 'NotoSerifKR_300Light',
  displayMedium: 'NotoSerifKR_500Medium',
  body: 'NotoSansKR_400Regular',
  bodyLight: 'NotoSansKR_300Light',
  bodyMedium: 'NotoSansKR_500Medium',
} as const;
