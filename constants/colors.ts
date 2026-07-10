// 색상 & 디자인 토큰 — Find Your Faith 레퍼런스 기반 파치먼트/잉크 디자인 언어
// 따뜻한 양피지 배경 + 먹색 세리프 타이포 + 낮은 채도의 포인트 컬러
export const colors = {
  bg:          '#E7DFC8', // 양피지
  bgCard:      '#F1EAD7', // 배경보다 아주 살짝 밝은 면 (카드 최소화, 필요할 때만)
  ink:         '#211D14', // 먹색 (웜 블랙)
  ink2:        '#5C5546',
  ink3:        '#8E8571', // 보조 텍스트 / 조용한 CTA
  line:        '#D3C9AC',
  line2:       '#DDD4B9',

  // 사용자 A — blue (잉크 블루, 저채도)
  blueTint:    '#DCE1DC',
  blueMid:     '#44607A',
  blueText:    '#31485E',

  // 사용자 B — coral (테라코타, 저채도)
  coralTint:   '#E8DCC6',
  coralMid:    '#A55C39',
  coralText:   '#7E4527',

  // AI — 세피아 (기존 purple 토큰 이름 유지)
  purpleTint:  '#E0D8C0',
  purpleMid:   '#7A6C4F',
  purpleText:  '#564A31',

  // 성공/완료 — 세이지 (기존 teal 토큰 이름 유지)
  tealTint:    '#DFE0CA',
  tealMid:     '#5F7355',
  tealText:    '#46573E',

  // 경고/재질문 — amber
  amberTint:   '#EDE2C0',
  amberText:   '#654A17',
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

// 공용 타이포/컴포넌트 스타일 — Find Your Faith 디자인 언어
// 화면들이 일관되게 쓰는 반복 패턴을 토큰화한다.
export const ui = {
  // 화면 중앙의 세리프 헤드라인 (질문/선언문)
  statement: {
    fontFamily: fonts.displayMedium,
    fontSize: 22,
    lineHeight: 34,
    color: colors.ink,
    textAlign: 'center' as const,
  },
  // 헤드라인 아래 보조 설명
  statementSub: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 22,
    color: colors.ink3,
    textAlign: 'center' as const,
  },
  // 하단의 조용한 레터스페이스 CTA ("탭하여 계속" 스타일)
  quietCta: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    letterSpacing: 3,
    color: colors.ink3,
    textAlign: 'center' as const,
  },
  // 밝은 알약형 보조 버튼 (레퍼런스의 Skip/Go back 필)
  pill: {
    backgroundColor: colors.bgCard,
    borderRadius: 100,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  pillText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.ink,
    textAlign: 'center' as const,
  },
  // 주요 액션 — 먹색 알약
  primaryPill: {
    backgroundColor: colors.ink,
    borderRadius: 100,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  primaryPillText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.bg,
    textAlign: 'center' as const,
  },
  // 상단의 얇은 진행 바 트랙/채움
  progressTrack: {
    height: 5,
    borderRadius: 100,
    backgroundColor: colors.line2,
    overflow: 'hidden' as const,
  },
  progressFill: {
    height: '100%' as const,
    borderRadius: 100,
    backgroundColor: colors.ink,
  },
} as const;
