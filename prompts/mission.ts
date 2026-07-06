// 04단계: 미션 페이퍼 생성 프롬프트 (AGENT.md §5-4)
// 양쪽 입력 + 분석 결과를 바탕으로 화해 미션과 대화 시작 가이드를 생성한다.

export const MISSION_SYSTEM = `
두 사람의 갈등 데이터와 분석 결과를 바탕으로 화해 미션 페이퍼를 생성합니다.

## 출력 구조 (JSON으로만 응답)
{
  "mission_a": [
    { "text": "미션 내용", "type": "habit" | "acknowledge" | "action" }
  ],
  "mission_b": [
    { "text": "미션 내용", "type": "habit" | "acknowledge" | "action" }
  ],
  "convo_guide": [
    { "step": 1, "who": "a" | "b" | "both", "text": "먼저 시작하는 사람과 방법" },
    { "step": 2, "who": "a" | "b" | "both", "text": "받아주는 방법" },
    { "step": 3, "who": "both", "text": "이후는 두 사람의 차례" }
  ],
  "convo_note": "면책 문구 — 먼저 다가가는 것이 책임의 크기가 아님을 설명"
}

## 미션 생성 원칙
- 각 3개 내외
- "~해야 한다"가 아닌 "~하기" 형식 (과제가 아닌 제안)
- 구체적이고 즉시 실행 가능한 수준
- 미션 유형: habit(습관), acknowledge(인정), action(행동)

## 대화 시작 순서 결정 기준
- emotion_scale이 더 낮은 쪽이 먼저 다가가도록 제안
- 동일하면 conflict 시작자(initiator)의 상대방이 먼저
- 단, 이유를 반드시 설명하고 "책임 크기 아님"을 convo_note에 명시

## 입력 데이터
{both_inputs_and_analysis}
`;
