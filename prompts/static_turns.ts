// 상황에 따라 달라지지 않는 고정 질문/보기 — AI 호출 없이 서버(ai-input)가 즉시 응답한다.
// 스케일처럼 매번 똑같은 질문을 AI로 생성하면 지연과 토큰만 낭비되므로 룰로 처리한다.
// 질문(staticFirstQuestion)과 답 추출(staticExtract)이 모두 룰이면 그 항목은 AI 0회로 끝난다.
// 클라이언트 의존성 없이 순수 TS로 유지할 것 (Deno Edge Function이 상대 경로로 임포트).

export interface StaticChoiceGroup {
  label: string;
  choices: string[];
  select: 'single' | 'multi';
  // 'scale'이면 클라이언트가 1~10 숫자 스케일 UI로 렌더링 (choices는 "N — 설명" 형태)
  kind: 'scale' | 'list';
  allow_none: boolean;
  allow_custom: boolean;
}

export interface StaticQuestion {
  message: string;
  choice_groups: StaticChoiceGroup[];
}

// 클라이언트(input.tsx)의 NONE_OF_ABOVE와 같은 문자열이어야 한다
export const NONE_CHOICE = '해당 없음';

const CONFLICT_SCALE_CHOICES = [
  '1 — 아주 사소한 일이었어요',
  '2 — 금방 지나갈 수 있는 일이었어요',
  '3 — 조금 신경 쓰였어요',
  '4 — 가볍지는 않았어요',
  '5 — 분명히 짚고 넘어가야 했어요',
  '6 — 꽤 큰 갈등이었어요',
  '7 — 꽤 심각했어요',
  '8 — 많이 심각했어요',
  '9 — 감당하기 버거울 만큼 컸어요',
  '10 — 관계가 흔들릴 만큼 컸어요',
];

const HURT_SCALE_CHOICES = [
  '1 — 거의 속상하지 않았어요',
  '2 — 살짝 마음에 걸렸어요',
  '3 — 조금 속상했어요',
  '4 — 마음이 좀 상했어요',
  '5 — 꽤 속상했어요',
  '6 — 한동안 마음에 남았어요',
  '7 — 많이 속상했어요',
  '8 — 마음이 많이 아팠어요',
  '9 — 생각할수록 힘들 만큼 아팠어요',
  '10 — 지금까지도 마음이 아파요',
];

// 레퍼런스 뱅크가 없는 커플용 폴백 감정 단어 (뱅크가 있으면 뱅크를 우선)
const DEFAULT_EMOTION_WORDS = [
  '서운함',
  '섭섭함',
  '소외감',
  '외로움',
  '화남',
  '짜증남',
  '억울함',
  '답답함',
  '불안함',
  '걱정됨',
  '민망함',
  '지침',
  '허탈함',
  '슬픔',
];

const MAX_EMOTION_CHOICES = 16;

// 고정 룰로 처리되는 항목의 첫 질문. 대상이 아니면 null → AI가 생성.
export function staticFirstQuestion(
  fieldKey: string,
  bank: { emotion_words?: Record<string, string[]> } | null,
): StaticQuestion | null {
  if (fieldKey !== 'feelings') return null;

  const bankWords =
    bank?.emotion_words && typeof bank.emotion_words === 'object'
      ? Object.values(bank.emotion_words).flat().filter((w) => typeof w === 'string' && w.trim())
      : [];
  const emotionChoices = (bankWords.length ? bankWords : DEFAULT_EMOTION_WORDS).slice(
    0,
    MAX_EMOTION_CHOICES,
  );

  return {
    message:
      '이제 그 순간 내 마음이 어땠는지 정리해볼게요. 깊이 고민하지 않아도 괜찮아요 — 숫자와 단어로 가볍게 골라주시면 돼요.',
    choice_groups: [
      {
        label: '이번 갈등이 얼마나 컸나요?',
        choices: CONFLICT_SCALE_CHOICES,
        select: 'single',
        kind: 'scale',
        allow_none: false,
        allow_custom: false,
      },
      {
        label: '내 마음은 얼마나 속상했나요?',
        choices: HURT_SCALE_CHOICES,
        select: 'single',
        kind: 'scale',
        allow_none: false,
        allow_custom: false,
      },
      {
        label: '그 순간 느꼈던 감정을 모두 골라주세요',
        choices: emotionChoices,
        select: 'multi',
        kind: 'list',
        allow_none: true,
        allow_custom: true,
      },
    ],
  };
}

// ── 혼합 턴: 항목의 일부 그룹만 고정 ──
// 질문 전체가 고정은 아니지만(맥락 의존 그룹이 남아 있음) 보기 문장이 상황과 무관하게 늘 같은
// 그룹들. 서버(ai-input)가 항목의 첫 질문에서 AI가 만든 그룹 뒤에 이 그룹들을 덧붙인다 —
// AI는 프롬프트(goal)에서 이 그룹들을 직접 만들지 말라고 지시받고, 맥락 의존 그룹만 생성한다.
// 완료 합성/재질문 판단은 AI에 남는다 (staticExtract 대상이 아님).

// 갈등이 터진 뒤의 반응 보기 — "나"/"상대" 그룹이 같은 문장을 공유한다 (라벨이 주어를 만든다)
const REACTION_CHOICES = [
  '대화로 풀어보려고 했어요',
  '말을 아끼고 침묵했어요',
  '자리를 피하거나 거리를 뒀어요',
  '감정이 그대로 터져버렸어요',
  '아무 일 없던 것처럼 행동했어요',
];

export function staticGroupsFor(fieldKey: string): StaticChoiceGroup[] {
  if (fieldKey !== 'hurt_context') return [];
  return [
    {
      label: '이런 일이 얼마나 반복됐나요?',
      choices: [
        '이번이 처음 있는 일이에요',
        '두세 번쯤 있었던 일이에요',
        '여러 번 반복돼온 일이에요',
        '오래전부터 쌓여온 일이에요',
      ],
      select: 'single',
      kind: 'list',
      allow_none: false,
      allow_custom: true,
    },
    {
      label: '갈등이 터진 뒤, 나는 어떻게 했나요?',
      choices: REACTION_CHOICES,
      select: 'multi',
      kind: 'list',
      allow_none: true,
      allow_custom: true,
    },
    {
      label: '상대는 어떻게 했나요?',
      choices: REACTION_CHOICES,
      select: 'multi',
      kind: 'list',
      allow_none: true,
      allow_custom: true,
    },
  ];
}

// 고정 질문에 대한 답(selections — 그룹 순서와 동일)을 룰로 extracted_value로 변환.
// 반환값은 ai-input의 columnsForField가 기대하는 JSON 문자열. 실패하면 null → AI 폴백.
export function staticExtract(
  fieldKey: string,
  selections: string[][] | null | undefined,
): string | null {
  if (fieldKey !== 'feelings' || !selections) return null;
  const num = (vals?: string[]): number | null => {
    const m = /^\s*(\d{1,2})/.exec(vals?.[0] ?? '');
    const n = m ? Number(m[1]) : NaN;
    return Number.isInteger(n) && n >= 1 && n <= 10 ? n : null;
  };
  const conflict = num(selections[0]);
  const emotion = num(selections[1]);
  if (conflict == null || emotion == null) return null;
  const words = (selections[2] ?? []).filter((v) => v && v !== NONE_CHOICE);
  return JSON.stringify({ conflict, emotion, words });
}

// 룰 추출로 항목이 완료됐을 때의 고정 마무리 멘트 (다음 항목의 질문 멘트가 전환을 이어받는다)
export const STATIC_COMPLETE_MESSAGE: Record<string, string> = {
  feelings: '마음의 크기를 이렇게 숫자와 단어로 남겨두는 것만으로도 정리가 한결 쉬워져요. 잘하고 계세요.',
};
