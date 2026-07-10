// 색상 & 디자인 토큰 — EMBr(AI Period Tracker, Dribbble 27451793) 레퍼런스 기반
// 웜 크림 바탕 + 피치 그라데이션 워시 + 다크 브라운 세리프 + 화이트 소프트 카드 + 블랙 필 CTA
export const colors = {
  bg:          '#F6F1E8', // 웜 크림
  bgCard:      '#FFFFFF', // 소프트 카드
  ink:         '#2B1712', // 다크 웜 브라운 (헤드라인/블랙 필)
  ink2:        '#5F5148',
  ink3:        '#9A8D82', // 보조 텍스트
  line:        '#E8E0D2', // 헤어라인/칩 보더
  line2:       '#F0EADD',

  // 사용자 A — blue (뮤트 블루)
  blueTint:    '#E7EEF5',
  blueMid:     '#5B84AE',
  blueText:    '#3E6183',

  // 사용자 B — coral (엠버 테라코타)
  coralTint:   '#FAE8DE',
  coralMid:    '#D06942',
  coralText:   '#A34A28',

  // AI — 엠버 오렌지 (기존 purple 토큰 이름 유지)
  purpleTint:  '#FBEDDF',
  purpleMid:   '#E08A54',
  purpleText:  '#9C5527',

  // 성공/완료 — 올리브 탄 (기존 teal 토큰 이름 유지)
  tealTint:    '#EDE7D4',
  tealMid:     '#8A7F53',
  tealText:    '#6B6140',

  // 경고/재질문 — amber
  amberTint:   '#F7ECD7',
  amberText:   '#7A5A24',

  // 선택된 칩 — 웜 탄 (EMBr의 selected chip fill)
  chipSelected: '#E9DDC0',
} as const;

// 그라데이션 스톱 (expo-linear-gradient) — 화면 상단 워시와 AI 액센트 카드
export const gradients = {
  // 화면 상단의 은은한 피치 워시 → 크림으로 사라짐
  wash:   ['#F8E3C4', '#F6F1E8'] as const,
  // 핑크 워시 (편지/감정 화면)
  pink:   ['#F6D9D6', '#F6F1E8'] as const,
  // AI 액센트 카드 (Chat with EMBr 오렌지)
  ember:  ['#F2A868', '#E0703E'] as const,
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

// 공용 스타일 — EMBr 디자인 언어
export const ui = {
  // 좌측 정렬 대형 세리프 헤드라인 ("Tell us about your…" 스타일)
  statement: {
    fontFamily: fonts.displayMedium,
    fontSize: 25,
    lineHeight: 36,
    color: colors.ink,
    textAlign: 'left' as const,
  },
  // 헤드라인 아래 보조 설명 (좌측 정렬, 회갈색)
  statementSub: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 22,
    color: colors.ink3,
    textAlign: 'left' as const,
  },
  // 작은 보조 링크/캡션 (Skip 등)
  quietCta: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.ink2,
    textAlign: 'center' as const,
  },
  // 흰색 소프트 카드
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    padding: 20,
  },
  // 헤어라인 보더 칩 (미선택)
  pill: {
    backgroundColor: colors.bgCard,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  pillText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
    textAlign: 'center' as const,
  },
  // 선택된 칩 — 웜 탄 채움, 보더 없음
  pillSelected: {
    backgroundColor: colors.chipSelected,
    borderColor: colors.chipSelected,
  },
  // 주요 액션 — 풀폭 블랙 필 ("Continue")
  primaryPill: {
    backgroundColor: colors.ink,
    borderRadius: 100,
    paddingVertical: 16,
    paddingHorizontal: 28,
    alignSelf: 'stretch' as const,
  },
  primaryPillText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center' as const,
  },
  // 상단의 얇은 진행 바 (반투명 화이트 트랙 + 잉크 채움)
  progressTrack: {
    height: 4,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.65)',
    overflow: 'hidden' as const,
  },
  progressFill: {
    height: '100%' as const,
    borderRadius: 100,
    backgroundColor: colors.ink,
  },
} as const;
