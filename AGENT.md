# AGENT.md — 맺음 (Maedum) 구현 스펙

> 이 문서는 Claude Code가 맺음 서비스를 처음부터 구현하기 위한 전체 컨텍스트 및 태스크 명세서입니다.
> 모든 설계 결정의 이유(why)까지 담았으므로, 구현 중 판단이 필요한 순간에 이 문서를 우선 참조하세요.

---

## 0. 서비스 한 줄 정의

**맺음**은 연인 간 갈등을 화해로 이어주는 AI 중재 앱이다.
표현이 서툰 커플이 각자의 속마음을 AI의 도움으로 정리하고, 정제된 형태로 상대에게 전달하며, 함께 화해 미션을 수행하도록 돕는다.

**핵심 철학:**
- AI는 중재자이지 판사가 아니다. 누가 잘못했는지 판단하지 않는다.
- 사과와 화해는 오직 두 사람이 직접 한다. AI는 그 준비를 도울 뿐이다.
- 날것의 감정을 "전달 가능한 언어"로 번역하는 것이 AI의 역할이다.

---

## 1. 기술 스택

```
Frontend:   React Native (Expo) — iOS/Android 동시 지원
Backend:    Node.js + Express (또는 Fastify)
Database:   Supabase (PostgreSQL + Realtime + Auth)
AI:         Anthropic Claude API (claude-sonnet-4-6)
Push:       Expo Notifications (FCM/APNs)
Storage:    Supabase Storage
```

**선택 이유:**
- Supabase Realtime: 두 사용자 간 상태 동기화(상대가 입력 완료했는지, 대화 준비됐는지)에 필수
- Expo: 빠른 프로토타이핑, OTA 업데이트, 네이티브 푸시 알림
- Claude API streaming: 입력 단계 AI 재질문을 실시간 채팅 UX로 구현

---

## 2. 디렉터리 구조

```
maedum/
├── app/                          # Expo Router 기반 앱
│   ├── (auth)/
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── (main)/
│   │   ├── home.tsx              # 홈 (플로우 진입점)
│   │   ├── conflict/
│   │   │   ├── start.tsx         # 갈등 시작 화면
│   │   │   ├── input.tsx         # 02단계: AI 재질문 입력
│   │   │   ├── waiting.tsx       # 상대 입력 대기
│   │   │   ├── letter.tsx        # 03단계: AI 우체통 + 분석
│   │   │   └── mission.tsx       # 04단계: 미션 페이퍼
│   │   ├── history.tsx           # 갈등 기록 목록
│   │   └── profile.tsx
│   └── _layout.tsx
├── components/
│   ├── chat/
│   │   ├── AIChatBubble.tsx
│   │   ├── UserChatBubble.tsx
│   │   ├── ChoiceSelector.tsx    # 선택지 버튼 그룹
│   │   └── FlagBadge.tsx         # ⚠ / ✓ / ✦ 배지
│   ├── letter/
│   │   ├── LetterCard.tsx
│   │   ├── IntensityBar.tsx
│   │   └── AnalysisCard.tsx
│   ├── mission/
│   │   ├── MissionPaper.tsx
│   │   └── ConvoGuide.tsx
│   └── ui/
│       ├── Avatar.tsx
│       ├── ProgressSteps.tsx
│       └── PhoneFrame.tsx
├── lib/
│   ├── supabase.ts               # Supabase 클라이언트
│   ├── anthropic.ts              # Claude API 래퍼
│   └── notifications.ts          # 푸시 알림
├── services/
│   ├── conflictService.ts        # 갈등 세션 CRUD
│   ├── aiInputService.ts         # 02단계 AI 재질문 로직
│   ├── aiLetterService.ts        # 03단계 편지 생성 로직
│   ├── aiAnalysisService.ts      # 03단계 중재자 분석 로직
│   └── missionService.ts         # 04단계 미션 생성 로직
├── prompts/
│   ├── input_guide.ts            # 02단계 시스템 프롬프트
│   ├── letter_refine.ts          # 03단계 편지 정제 프롬프트
│   ├── analysis.ts               # 03단계 분석 프롬프트
│   └── mission.ts                # 04단계 미션 생성 프롬프트
├── store/
│   └── conflictStore.ts          # Zustand 상태관리
├── supabase/
│   └── migrations/
│       └── 001_initial.sql
└── AGENT.md                      # 이 파일
```

---

## 3. 데이터 모델 (Supabase)

### 3-1. couples

```sql
CREATE TABLE couples (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id   UUID REFERENCES auth.users NOT NULL,
  user_b_id   UUID REFERENCES auth.users NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_a_id, user_b_id)
);
```

### 3-2. conflicts

```sql
CREATE TYPE conflict_status AS ENUM (
  'waiting_partner',   -- 한 명 시작, 상대 알림 대기
  'both_inputting',    -- 양쪽 입력 중
  'ai_processing',     -- AI 편지/분석 생성 중
  'letters_delivered', -- 편지 전달 완료
  'waiting_ready',     -- 한 명만 "대화 준비됨" 누름
  'mission_unlocked',  -- 양쪽 준비됨 → 미션 페이퍼 오픈
  'resolved'           -- 완료
);

CREATE TABLE conflicts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id    UUID REFERENCES couples NOT NULL,
  initiator_id UUID REFERENCES auth.users NOT NULL,
  status       conflict_status DEFAULT 'waiting_partner',
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);
```

### 3-3. conflict_inputs

```sql
-- 각 사용자의 구조화 입력 + AI 대화 누적 컨텍스트
CREATE TABLE conflict_inputs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conflict_id         UUID REFERENCES conflicts NOT NULL,
  user_id             UUID REFERENCES auth.users NOT NULL,

  -- 구조화 필드 (AI 재질문으로 정제된 최종값)
  trigger_moment      TEXT,           -- 발화 시점 (팩트 중심)
  first_hurt_moment   TEXT,           -- 최초로 기분 상한 순간
  context_tags        TEXT[],         -- ['누적', '피로', '반복패턴', ...]
  context_detail      TEXT,           -- 맥락 상세 설명
  conflict_scale      SMALLINT,       -- 1~10
  emotion_scale       SMALLINT,       -- 1~10
  request_raw         TEXT,           -- 최초 바라는 것 (모호한 원본)
  request_refined     TEXT,           -- 정제된 구체적 요청 (실제 멘트 포함)
  partner_intention   TEXT,           -- 상대 의도 인식 ('악의없음'/'모름'/'무관')
  my_reflection       TEXT,           -- 내가 반성하는 부분

  -- AI 재질문 대화 로그 (전체 context 보존)
  chat_log            JSONB DEFAULT '[]',

  -- 입력 완료 여부
  is_complete         BOOLEAN DEFAULT FALSE,
  completed_at        TIMESTAMPTZ,

  UNIQUE(conflict_id, user_id)
);
```

### 3-4. conflict_outputs

```sql
-- AI가 생성한 편지, 분석, 미션
CREATE TABLE conflict_outputs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conflict_id     UUID REFERENCES conflicts NOT NULL UNIQUE,

  -- 03단계: 편지 (각자 상대에게 전달되는 것)
  letter_a_to_b   TEXT,   -- user_a → user_b 편지
  letter_b_to_a   TEXT,   -- user_b → user_a 편지

  -- 03단계: 분석 (공개, 둘이 함께 보는 것)
  analysis_timing      TEXT,   -- 기분 상한 시점 차이 분석
  analysis_temperature TEXT,   -- 온도 차이 이유 분석
  analysis_understanding TEXT, -- 서로 이미 이해하는 부분

  -- 04단계: 미션 페이퍼
  mission_a       JSONB,  -- [{ text: "...", type: "habit"|"acknowledge"|"action" }]
  mission_b       JSONB,
  convo_guide     JSONB,  -- [{ step: 1, who: "a"|"b"|"both", text: "..." }]
  convo_note      TEXT,   -- 하단 주의사항

  created_at      TIMESTAMPTZ DEFAULT now()
);
```

### 3-5. conflict_ready_states

```sql
-- "대화 준비됐어요" 버튼 상태
CREATE TABLE conflict_ready_states (
  conflict_id UUID REFERENCES conflicts NOT NULL,
  user_id     UUID REFERENCES auth.users NOT NULL,
  ready_at    TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (conflict_id, user_id)
);
```

### RLS 정책 (필수)

```sql
-- 커플 멤버만 자신의 갈등 데이터에 접근 가능
-- conflict_inputs: 자신의 것만 읽기/쓰기. 상대 것은 conflict_outputs 생성 후 공개.
-- conflict_outputs: 커플 양쪽 모두 읽기 가능.
-- 상세 정책은 supabase/migrations/001_initial.sql에 구현.
```

---

## 4. 서비스 플로우 상세

### 4-1. 01단계: 갈등 시작

```
사용자 A가 "맺음 시작" 버튼 탭
  → conflicts 테이블에 row 생성 (status: 'waiting_partner')
  → 상대(B)에게 푸시 알림 발송: "지수가 대화를 시작하고 싶어해요"
  → A는 입력 화면으로 이동
  → B가 알림 탭 → 앱 진입 → 동일 conflict_id로 입력 화면 이동
  → B 진입 시 status → 'both_inputting'
```

### 4-2. 02단계: AI 재질문 입력

**UX 구조:** 채팅 형식. AI가 순서대로 질문 → 사용자 답변 (선택지 or 자유 입력) → AI 분석 후 재질문 or 다음 항목.

**입력 수집 순서:**
1. `trigger_moment` — 발화 시점 (팩트 중심으로 작성하도록 유도)
2. `first_hurt_moment` — 최초로 기분이 상한 순간
3. `context_tags` + `context_detail` — 속상한 원인 맥락
4. `conflict_scale` + `emotion_scale` — 갈등/속상함 크기 (비유 포함 1~10)
5. `request_refined` — 바라는 것 (모호 → 구체적 멘트까지)
6. `partner_intention` — 상대 의도 인식
7. `my_reflection` — 내가 반성하는 부분

**AI 재질문 트리거 (prompts/input_guide.ts에 명시):**

| 트리거 | 재질문 목적 |
|--------|------------|
| "항상", "맨날", "또" 등 패턴 주장 | 구체적 상황으로 바꾸기 |
| "일부러", "무시한 게 분명해" 등 의도 단정 | 가능성으로 전환 |
| 나의 감정 없이 상대 행동만 나열 | "그때 네 기분은 어땠어요?" |
| 누적인지 오늘 일인지 불명확 | 분리해서 확인 |
| 바라는 것이 막연함 ("말투 조심해줘") | 구체적 상황 + 실제 멘트까지 |
| 반성 없이 상대 잘못만 서술 | "혹시 네가 아쉬웠던 부분은?" |

**선택지 설계 원칙:**
- 선택지는 2~4개. 항상 마지막에 "직접 입력할게요 →" 옵션 포함.
- 선택지를 보고 "아, 이게 내가 원하는 거구나" 깨닫게 하는 것이 목적.
- 선택 후에도 AI가 추가 구체화 질문을 할 수 있음.

**입력 완료 조건:**
- 7개 항목 모두 수집 완료 시 `is_complete = TRUE`
- 상대도 완료 시 → `status: 'ai_processing'` → AI 편지/분석 생성 시작

### 4-3. 03단계: AI 우체통 + 분석 생성

**트리거:** 양쪽 모두 `is_complete = TRUE`

**생성 순서 (aiLetterService.ts + aiAnalysisService.ts):**

```
1. letter_a_to_b 생성: B의 입력을 컨텍스트로, A에게 전달할 내용을 정제
2. letter_b_to_a 생성: A의 입력을 컨텍스트로, B에게 전달할 내용을 정제
3. 분석 생성: 양쪽 입력을 모두 컨텍스트로 중재자 분석 생성
→ conflict_outputs에 저장
→ status: 'letters_delivered'
→ 양쪽에 푸시 알림
```

**편지 정제 원칙 (prompts/letter_refine.ts):**
- 사과 표현 절대 포함 금지 ("미안해", "잘못했어" 등)
- 상대를 이해하는 부분을 자연스럽게 포함 (입력에서 끌어냄)
- 말투: 친근한 반말 ("~야", "~거든", "~것 같아")
- 바라는 것은 구체적 멘트까지 포함 (정제된 request_refined 사용)
- 반성하는 부분은 편지 말미에 담담하게 (사과 아닌 인정으로)
- 구조: 발화시점 맥락 → 속상한 이유 → 상대 이해 표현 → 바라는 것 → 반성

**분석 생성 원칙 (prompts/analysis.ts):**
- 3개 섹션: 시점 차이 / 온도 차이 이유 / 서로 이해하는 부분
- 판단 없이 서술. "A가 잘못", "B가 더 예민" 등 표현 금지.
- 마지막은 반드시 "화해가 가능한 이유"로 마무리.
- 갈등 크기 수치 차이가 있으면 반드시 그 이유를 설명.

### 4-4. 04단계: 미션 페이퍼

**트리거:** 양쪽 모두 `conflict_ready_states`에 row 존재

**미션 생성 원칙 (prompts/mission.ts):**
- 각자 3개 내외의 구체적이고 실행 가능한 미션
- "~해야 한다" 아닌 "~하기" 형식 (과제가 아닌 제안)
- 미션 유형 3가지: `habit`(습관), `acknowledge`(인정), `action`(행동)

**대화 시작 방법 (convo_guide) 생성 원칙:**
- 갈등 온도 수치, 시점 분석 기반으로 누가 먼저 다가갈지 결정
- "먼저 다가가는 것 = 책임이 큰 것" 아님을 반드시 note에 명시
- 3단계: 먼저 시작하는 사람 → 받아주는 방법 → 이후는 두 사람의 차례

---

## 5. AI 프롬프트 설계

### 5-1. 02단계 입력 가이드 시스템 프롬프트

```typescript
// prompts/input_guide.ts

export const INPUT_GUIDE_SYSTEM = `
당신은 연인 간 갈등 해결을 돕는 중재자입니다.
사용자가 자신의 속마음을 솔직하고 구체적으로, 
그러나 상대방이 방어적으로 받아들이지 않도록 정리할 수 있게 도와주세요.

## 역할 규칙
- 판단하지 않는다. 사용자 편도, 상대방 편도 들지 않는다.
- 비난을 사실과 감정으로 분리하도록 유도한다.
- 모호한 요청은 반드시 구체적 상황 + 실제 말 한마디까지 끌어낸다.
- 재질문은 부드럽고 짧게. 심문처럼 느껴지면 안 된다.
- 한 번에 하나의 질문만 한다.

## 현재 수집 대상 항목
{current_field}

## 이전 대화 맥락
{chat_history}

## 재질문 트리거
다음 패턴이 감지되면 즉시 재질문:
- 패턴 주장: "항상", "맨날", "또", "늘"
- 의도 단정: "일부러", "분명히", "일부러 그랬잖아"
- 감정 없이 행동만 나열
- 모호한 요청 (구체적 행동/멘트 없음)

## 출력 형식
JSON으로만 응답:
{
  "type": "question" | "clarify" | "confirm" | "next",
  "flag": "warn" | "ok" | "purple" | null,
  "flag_text": "좀 더 확인이 필요해요" | "좋아요, 이해됐어요" | "한 가지만 더" | null,
  "message": "AI 메시지 텍스트",
  "choices": ["선택지1", "선택지2", ...] | null,
  "extracted_value": "이 턴에서 수집된 필드 값" | null,
  "field_complete": true | false
}
`;
```

### 5-2. 03단계 편지 정제 프롬프트

```typescript
// prompts/letter_refine.ts

export const LETTER_REFINE_SYSTEM = `
당신은 연인 간 감정 번역가입니다.
한 사람의 속마음 데이터를 받아, 상대방이 읽었을 때 
이해하고 화해하고 싶어지는 편지를 씁니다.

## 절대 금지
- 사과 표현: "미안해", "잘못했어", "용서해줘" 등 일체 금지
- 판단: "네가 틀렸어", "내가 맞아" 등 금지
- 과장: 실제 입력에 없는 감정 추가 금지

## 필수 포함
- 상대를 이해하는 부분 (입력에서 끌어낼 것. 없으면 partner_intention 활용)
- 속상함의 진짜 원인 (context_detail + context_tags 기반)
- 구체적 요청 (request_refined의 실제 멘트 포함)
- 반성하는 부분 (my_reflection, 담담하게, 편지 말미)

## 말투
- 친근한 반말 (야, 거든, 것 같아, 알아)
- 서두에 상대 이름 부르기: "[이름]아,"
- 길이: 200~350자 내외

## 입력 데이터
{input_data}
`;
```

### 5-3. 03단계 분석 프롬프트

```typescript
// prompts/analysis.ts

export const ANALYSIS_SYSTEM = `
당신은 커플 갈등 중재 전문가입니다.
두 사람의 입력 데이터를 모두 받아 갈등의 구조를 분석합니다.

## 출력 구조 (JSON)
{
  "timing": {
    "person_a": { "name": "", "when": "", "why": "" },
    "person_b": { "name": "", "when": "", "why": "" },
    "summary": "두 시점의 관계를 설명하는 1~2문장"
  },
  "temperature": {
    "scale_diff_explanation": "수치 차이가 나는 구체적 이유",
    "main_text": "전체 설명"
  },
  "understanding": {
    "a_understands_b": "A가 B를 이미 이해하고 있는 부분",
    "b_understands_a": "B가 A를 이미 이해하고 있는 부분",
    "bridge_text": "화해가 가능한 이유 — 반드시 희망적으로 마무리"
  }
}

## 금지
- 누가 더 잘못했는지 판단
- "A가 예민하다", "B가 과잉반응" 등 표현
- 어느 한쪽 편들기
`;
```

### 5-4. 04단계 미션 프롬프트

```typescript
// prompts/mission.ts

export const MISSION_SYSTEM = `
두 사람의 갈등 데이터와 분석 결과를 바탕으로 화해 미션 페이퍼를 생성합니다.

## 출력 구조 (JSON)
{
  "mission_a": [
    { "text": "미션 내용", "type": "habit" | "acknowledge" | "action" }
  ],
  "mission_b": [...],
  "convo_guide": [
    { "step": 1, "who": "a" | "b" | "both", "text": "..." },
    { "step": 2, ... },
    { "step": 3, ... }
  ],
  "convo_note": "면책 문구 — 먼저 다가가는 것이 책임의 크기가 아님을 설명"
}

## 미션 생성 원칙
- 각 3개 내외
- "~하기" 형식 (제안, 과제 아님)
- 구체적이고 즉시 실행 가능한 수준

## 대화 시작 순서 결정 기준
- emotion_scale이 더 낮은 쪽이 먼저 다가가도록 제안
- 동일하면 conflict 시작자(initiator)의 상대방이 먼저
- 단, 이유를 반드시 설명하고 "책임 크기 아님" 명시

## 입력 데이터
{both_inputs_and_analysis}
`;
```

---

## 6. Supabase Realtime 구독 포인트

```typescript
// 각 화면에서 구독해야 할 채널

// 02단계 waiting.tsx: 상대 입력 완료 감지
supabase
  .channel(`conflict-${conflictId}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'conflict_inputs',
    filter: `conflict_id=eq.${conflictId}`
  }, (payload) => {
    if (payload.new.is_complete) checkBothComplete();
  })

// 03단계 letter.tsx: AI 처리 완료 감지
supabase
  .channel(`conflict-status-${conflictId}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'conflicts',
    filter: `id=eq.${conflictId}`
  }, (payload) => {
    if (payload.new.status === 'letters_delivered') loadOutputs();
  })

// 04단계: 상대 ready 감지
supabase
  .channel(`ready-${conflictId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'conflict_ready_states',
    filter: `conflict_id=eq.${conflictId}`
  }, () => checkBothReady())
```

---

## 7. 컴포넌트 상세 스펙

### 7-1. ChoiceSelector

```tsx
interface ChoiceSelectorProps {
  choices: string[];
  selected: string | null;
  onSelect: (value: string) => void;
  allowDirectInput?: boolean;   // 마지막에 "직접 입력할게요 →" 추가
  color: 'blue' | 'coral';      // 사용자 색상 테마
}
```

### 7-2. FlagBadge

```tsx
type FlagType = 'warn' | 'ok' | 'purple';

// warn:   ⚠ 좀 더 확인이 필요해요  → amber 배경
// ok:     ✓ 좋아요, 이해됐어요     → teal 배경
// purple: ✦ 한 가지만 더           → purple 배경
```

### 7-3. IntensityBar

```tsx
interface IntensityBarProps {
  label: string;          // "이 갈등 크기" | "내 속상함"
  value: number;          // 1~10
  color: 'blue' | 'coral';
}
// value/10 * 100% 로 fill width 계산
```

### 7-4. MissionPaper

```tsx
// 두 컬럼 그리드. 각 컬럼은 미션 항목 리스트.
// mission.type에 따라 아이콘 다름:
//   habit → 🔄
//   acknowledge → 💡
//   action → ✋
```

---

## 8. 색상 & 디자인 토큰

```typescript
export const colors = {
  bg:          '#F7F5F2',
  bgCard:      '#FFFFFF',
  ink:         '#1A1917',
  ink2:        '#4A4845',
  ink3:        '#8A8784',
  line:        '#E4E2DD',
  line2:       '#F0EDE8',

  // 사용자 A (지수) — blue
  blueTint:    '#E6F1FB',
  blueMid:     '#3A7EC4',
  blueText:    '#185FA5',

  // 사용자 B (민준) — coral
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
};

// 폰트
// Display: 'NotoSerifKR' (weight: 300, 400, 500)
// Body:    'NotoSansKR'  (weight: 300, 400, 500)
```

---

## 9. 구현 우선순위 (MVP)

### Phase 1 — 코어 플로우 (필수)
- [ ] Supabase 스키마 마이그레이션
- [ ] 인증 (이메일/소셜 로그인)
- [ ] 커플 연결 (초대 코드 방식)
- [ ] 02단계: AI 재질문 입력 화면 (스트리밍)
- [ ] 03단계: 편지 생성 + 표시
- [ ] 03단계: 분석 생성 + 표시
- [ ] 04단계: 미션 페이퍼

### Phase 2 — 경험 완성
- [ ] 푸시 알림 (갈등 시작 알림, 편지 도착 알림, 상대 준비됨 알림)
- [ ] 갈등 기록 히스토리
- [ ] 갈등 크기 선택 UI (비유 포함 슬라이더)
- [ ] 애니메이션 (편지 전달 트랜지션 등)

### Phase 3 — 심화
- [ ] 우리 갈등 패턴 리포트 (누적 데이터 기반)
- [ ] 추가 질문 라운드 (편지 교환 후 AI 생성 질문)
- [ ] 온보딩 플로우

---

## 10. 환경 변수

```bash
# .env.local
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
ANTHROPIC_API_KEY=          # 서버사이드에서만 사용 (Supabase Edge Function)
EXPO_PUBLIC_APP_ENV=development
```

> **중요:** `ANTHROPIC_API_KEY`는 클라이언트에 절대 노출되면 안 됩니다.
> AI 호출은 모두 Supabase Edge Function을 통해 서버사이드에서 처리하세요.

---

## 11. Claude Code 작업 시작 지침

1. 이 파일을 먼저 끝까지 읽는다.
2. `supabase/migrations/001_initial.sql`부터 작성한다 (스키마가 모든 것의 기반).
3. 각 프롬프트 파일(`prompts/`)을 구현한 뒤 서비스 레이어를 작성한다.
4. UI는 Phase 1 플로우가 동작한 이후에 다듬는다.
5. 컴포넌트 분리는 중복이 생길 때 한다. 미리 추상화하지 않는다.
6. 판단이 필요한 순간 — 이 문서의 "핵심 철학" 섹션을 다시 읽는다.

```
핵심 철학 재확인:
- AI는 판사가 아니다
- 사과는 AI가 대신 쓰지 않는다
- 모호한 요청을 실행 가능한 한마디로 만드는 것이 이 앱의 핵심 가치다
```
