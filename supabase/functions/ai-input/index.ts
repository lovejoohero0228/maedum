// 02단계: AI 재질문 입력 (AGENT.md §4-2, §5-1)
// 요청: { conflict_id, field_key, user_text | null, selections? }
//   - user_text가 null이면 해당 항목의 첫 질문을 생성
//   - selections: 클라이언트가 choice_groups에서 실제로 고른 값들 (그룹 순서와 동일한 배열의 배열).
//     자유 입력 답변이면 undefined/null — user_text는 그 경우에도 항상 사람이 읽을 합쳐진 텍스트다.
// 응답: INPUT_GUIDE_SYSTEM의 JSON 봉투 + { next_field, all_complete, next_question, skipped }
//   - next_question: field_complete 턴에 다음 항목의 첫 질문을 같은 응답에 실어 보낸다
//     (클라이언트 왕복 1회 절약 — 생성 실패 시 null이고 클라이언트가 startField로 폴백)
//   - skipped: 다음 항목이 이미 대화로 커버돼 0턴 완료된 경우 그 항목들의 완료 멘트
//
// 고정 룰 턴(prompts/static_turns.ts): 상황과 무관하게 항상 같은 질문(예: feelings의
// 스케일+감정 단어)은 AI를 호출하지 않고 즉시 응답하며, 그 답도 룰로 추출한다 — 토큰 0, 지연 0.
//
// 필드가 완료되면 extracted_value를 컬럼에 저장하고,
// 모든 항목(INPUT_FIELDS)이 끝나면 is_complete=TRUE. 상대도 완료면 status='ai_processing'
// 후 ai-letters를 백그라운드 호출한다.
// 호출자의 relationship_profiles(있다면)를 조회해 개인화된 선택지 생성에 참고시킨다.
import {
  chat,
  adminClient,
  userClient,
  corsHeaders,
  json,
  parseModelJson,
  errorMessage,
  logUsage,
} from "../_shared/utils.ts";
import { INPUT_GUIDE_SYSTEM, INPUT_FIELDS } from "../../../prompts/input_guide.ts";
import type { InputField } from "../../../prompts/input_guide.ts";
import {
  staticFirstQuestion,
  staticGroupsFor,
  staticExtract,
  STATIC_COMPLETE_MESSAGE,
} from "../../../prompts/static_turns.ts";

interface ChoiceGroup {
  label: string;
  choices: string[];
  // 'single'이면 하나만 고르는 그룹 (의도 인식, 반복 여부, 스케일 등). 기본 'multi'.
  select: "single" | "multi";
  // 'scale'이면 클라이언트가 숫자 스케일 UI로 렌더링 — 고정 룰 턴 전용, AI는 만들지 않는다
  kind: "scale" | "list";
  allow_none: boolean;
  allow_custom: boolean;
}

interface GuideEnvelope {
  type: "question" | "clarify" | "confirm" | "next";
  flag: "warn" | "ok" | "purple" | null;
  flag_text: string | null;
  message: string;
  choice_groups: ChoiceGroup[] | null;
  extracted_value: string | null;
  field_complete: boolean;
}

interface ChatEntry {
  role: "user" | "assistant";
  field: string;
  content: string;
  choice_groups?: ChoiceGroup[] | null;
  selections?: string[][] | null;
}

// json_object 응답을 GuideEnvelope로 정규화 (누락 키는 "아직 완료 안 됨" 쪽으로 기본값)
function normalizeEnvelope(content: string): GuideEnvelope {
  const raw = parseModelJson<Partial<GuideEnvelope>>(content);
  const rawGroups = Array.isArray(raw.choice_groups) ? raw.choice_groups : null;
  return {
    type: raw.type ?? "clarify",
    flag: raw.flag ?? null,
    flag_text: raw.flag_text ?? null,
    message: raw.message ?? "",
    choice_groups: rawGroups
      ? rawGroups
          .map((g) => ({
            label: g?.label ?? "",
            choices: Array.isArray(g?.choices) ? g.choices : [],
            select: g?.select === "single" ? ("single" as const) : ("multi" as const),
            kind: g?.kind === "scale" ? ("scale" as const) : ("list" as const),
            allow_none: g?.allow_none !== false,
            allow_custom: g?.allow_custom !== false,
          }))
          .filter((g) => g.choices.length > 0)
      : null,
    extracted_value: raw.extracted_value ?? null,
    field_complete: raw.field_complete ?? false,
  };
}

// 고정 룰 항목의 첫 질문 — 대상이 아니면 null (prompts/static_turns.ts)
function staticEnvelopeFor(
  fieldKey: string,
  bank: Record<string, unknown> | null,
): GuideEnvelope | null {
  const q = staticFirstQuestion(
    fieldKey,
    bank as { emotion_words?: Record<string, string[]> } | null,
  );
  if (!q) return null;
  return {
    type: "question",
    flag: null,
    flag_text: null,
    message: q.message,
    choice_groups: q.choice_groups,
    extracted_value: null,
    field_complete: false,
  };
}

// 선택지 없는 자유서술 질문이 허용되는 필드 (input_guide의 자유서술 예외 목록과 동일해야 함)
// trigger_moment/hurt_context: "정확히 어떤 말/행동이었는지"
// request: 상대가 실제로 해줄 말/행동 한마디, my_reflection: 반성에 내 말로 살 붙이기
const FREE_TEXT_EXEMPT_FIELDS = new Set([
  "trigger_moment",
  "hurt_context",
  "request",
  "my_reflection",
]);

// 보기 생성 여부를 프롬프트에게만 맡기지 않는 룰 기반 검증.
// 위반 사유 문자열을 반환하면 AI를 재호출한다 (null이면 통과).
// - field_complete 턴: extracted_value가 반드시 있어야 한다 (없으면 클라이언트가
//   저장 안 된 채 다음 항목으로 넘어가는 유령 진행이 생긴다).
// - 질문 턴: choice_groups가 반드시 있어야 한다. 자유서술 턴은 FREE_TEXT_EXEMPT_FIELDS에서만,
//   그 필드에서 이미 선택지 질문이 오간 뒤에, 필드당 한 번만.
// 한 항목에서 허용하는 최대 질문 턴 수 — 이걸 넘기면 더 묻지 말고 완료를 요구한다
// (첫 질문 1턴 + 재질문/자유서술 후속 1턴. 사용자 제출 횟수 최소화가 최우선)
const MAX_QUESTION_TURNS_PER_FIELD = 2;

// request의 extracted_value에서 refined가 실제로 채워져 있는지 확인
function requestRefined(extractedValue: string): boolean {
  try {
    const parsed = JSON.parse(extractedValue) as { refined?: unknown };
    return typeof parsed.refined === "string" && parsed.refined.trim().length > 0;
  } catch {
    return false;
  }
}

function envelopeViolation(
  envelope: GuideEnvelope,
  fieldKey: string,
  chatLog: ChatEntry[],
): string | null {
  // gpt-4o가 message 키를 통째로 누락하는 사례가 실제로 관측됨 — 빈 말풍선은
  // 사용자에게 "AI가 뭘 물었는지 알 수 없는" 데드엔드라 반드시 반려한다.
  if (!envelope.message.trim()) {
    return "message가 비어 있음 — 사용자에게 보일 공감/질문 문장을 반드시 채워야 함";
  }
  if (envelope.field_complete) {
    if (!envelope.extracted_value) return "field_complete인데 extracted_value가 비어 있음";
    // request는 refined(구체적 요청)까지 받아야 완료다 — 욕구 선택만 받고 refined: null로
    // 조기 완료되면 편지에 실을 실제 요청이 통째로 사라진다 (2차 라이브 테스트에서 관측)
    if (fieldKey === "request" && !requestRefined(envelope.extracted_value)) {
      return (
        "request의 extracted_value에 refined(구체적 상황 + 상대가 실제로 할 수 있는 말/행동)가 " +
        "비어 있음 — 아직 구체적 요청을 받지 못했다면 field_complete: false로 두고, 선택지 없이 " +
        "자유서술로 그 한마디를 물어야 함"
      );
    }
    return null;
  }
  const fieldTurns = chatLog.filter((e) => e.field === fieldKey && e.role === "assistant");

  // 질문이 늘어지는 것 자체를 차단 — 사용자가 이미 여러 번 답했는데 계속 되묻는 루프 방지
  if (fieldTurns.length >= MAX_QUESTION_TURNS_PER_FIELD) {
    return (
      `이 항목에서 이미 질문을 ${fieldTurns.length}턴 했음 — 더 묻지 말고 지금까지 받은 답을 종합해 ` +
      "extracted_value를 채우고 field_complete: true로 응답해야 함"
    );
  }

  if (envelope.choice_groups?.length) {
    // 같은 항목에서 이미 제시한 선택지를 절반 이상 재사용한 그룹 = 같은 질문의 반복
    const normalize = (s: string) => s.replace(/\s+/g, "");
    const prior = new Set(
      fieldTurns
        .flatMap((e) => e.choice_groups ?? [])
        .flatMap((g) => g.choices)
        .map(normalize),
    );
    if (prior.size) {
      for (const g of envelope.choice_groups) {
        const dup = g.choices.filter((c) => prior.has(normalize(c))).length;
        if (g.choices.length > 0 && dup >= Math.ceil(g.choices.length / 2)) {
          return (
            `"${g.label}" 그룹 선택지의 절반 이상이 이 항목에서 이미 제시했던 것과 중복 — ` +
            "같은 질문을 표현만 바꿔 반복하지 말고, 이미 받은 답으로 field_complete 처리하거나 " +
            "정말 아직 안 나온 새로운 정보만 물어야 함"
          );
        }
      }
    }
    return null;
  }
  if (!FREE_TEXT_EXEMPT_FIELDS.has(fieldKey)) {
    return "질문 턴에 choice_groups가 없음 (이 필드는 자유서술 예외 대상이 아님)";
  }
  if (fieldTurns.length === 0) {
    return "필드의 첫 질문은 반드시 choice_groups를 포함해야 함";
  }
  if (fieldTurns.some((e) => !e.choice_groups || e.choice_groups.length === 0)) {
    return "선택지 없는 자유서술 턴은 필드당 한 번만 허용됨";
  }
  return null;
}

// 레퍼런스 뱅크 중 현재 필드와 직접 대응되는 후보만 뽑아 프롬프트에 명시적으로 박아준다.
// (relationship_context 전체를 통째로 주는 것만으로는 모델이 현재 필드와 무관한 정보에 묻혀
//  범용 예시 문구를 그대로 재사용하는 경향이 있었음 — 필드별 후보를 별도 섹션으로 분리)
function fieldChoiceBank(fieldKey: string, bank: Record<string, unknown> | null): string {
  if (!bank) return "(레퍼런스 뱅크 없음 — 아래 선택지 설계 원칙의 예시를 참고해 새로 만들 것)";
  switch (fieldKey) {
    case "trigger_moment":
      return Array.isArray(bank.trigger_categories) ? bank.trigger_categories.join(", ") : "(없음)";
    case "hurt_context":
      // 반복 여부/반응 그룹은 서버 고정(static_turns) — AI 몫은 first_hurt 그룹뿐이라 뱅크 불필요
      return (
        "(이 항목의 반복 여부/나의 반응/상대의 반응 그룹은 서버가 고정 보기로 자동으로 붙임 — " +
        "first_hurt 그룹만, 필요할 때만, trigger_moment 답변 기준 상대적 시점으로 자유 구성)"
      );
    case "feelings": {
      const words = bank.emotion_words;
      if (!words || typeof words !== "object") return "(없음)";
      return `(감정 단어 그룹 전용 후보) ${Object.values(words as Record<string, string[]>).flat().join(", ")}`;
    }
    case "request":
      // 욕구 확인 턴에서 쓸 후보 — refined 멘트 자체는 뱅크 대상이 아님
      return Array.isArray(bank.need_words)
        ? `(욕구 확인 그룹 전용 후보 — 상황/멘트 그룹에는 적용하지 말 것) ${bank.need_words.join(", ")}`
        : "(없음)";
    case "partner_mind":
      return Array.isArray(bank.partner_perspective_words)
        ? `(상대 기분 헤아리기 그룹 전용 후보) ${bank.partner_perspective_words.join(", ")}`
        : "(없음)";
    default:
      return "(이 항목은 레퍼런스 뱅크 대상이 아님 — 대화 맥락에서 자유롭게 구성)";
  }
}

// 이미 완료된 항목을 chat_log 원본이 아니라 최종 확정값 한 줄로 요약 (컨텍스트 오염 방지)
function summarizeCompletedField(fieldKey: string, input: Record<string, unknown>): string | null {
  switch (fieldKey) {
    case "trigger_moment":
      return (input.trigger_moment as string | null) ?? null;
    case "hurt_context": {
      const firstHurt = input.first_hurt_moment as string | null;
      const detail = input.context_detail as string | null;
      if (!firstHurt && !detail) return null;
      const tags = (input.context_tags as string[] | null) ?? [];
      const contextPart = detail ? (tags.length ? `${tags.join(", ")} — ${detail}` : detail) : null;
      return [firstHurt, contextPart].filter(Boolean).join(" / ");
    }
    case "feelings": {
      const conflict = input.conflict_scale as number | null;
      const emotion = input.emotion_scale as number | null;
      const words = input.emotion_words as string[] | null;
      if (conflict == null && !words?.length) return null;
      const scalePart = conflict != null ? `갈등 ${conflict}, 속상함 ${emotion}` : null;
      return [scalePart, words?.length ? words.join(", ") : null].filter(Boolean).join(" / ");
    }
    case "request": {
      const refined = input.request_refined as string | null;
      if (!refined) return null;
      const raw = input.request_raw as string | null;
      const need = input.request_need as string | null;
      const base = raw ? `${raw} → ${refined}` : refined;
      return need ? `${base} (욕구: ${need})` : base;
    }
    case "partner_mind": {
      const intention = input.partner_intention as string | null;
      const words = input.partner_perspective_words as string[] | null;
      if (!intention && !words?.length) return null;
      return [intention, words?.length ? words.join(", ") : null].filter(Boolean).join(" / ");
    }
    case "my_reflection":
      return (input.my_reflection as string | null) ?? null;
    default:
      return null;
  }
}

// extracted_value → conflict_inputs 컬럼 매핑
function columnsForField(fieldKey: string, value: string): Record<string, unknown> {
  switch (fieldKey) {
    case "hurt_context": {
      const parsed = JSON.parse(value) as { first_hurt: string; tags?: string[]; detail: string };
      return {
        first_hurt_moment: parsed.first_hurt,
        context_tags: parsed.tags ?? [],
        context_detail: parsed.detail,
      };
    }
    case "feelings": {
      const parsed = JSON.parse(value) as { conflict: number; emotion: number; words?: string[] };
      if (parsed.conflict == null || parsed.emotion == null) {
        throw new Error(`bad feelings value: ${value}`);
      }
      return {
        conflict_scale: Number(parsed.conflict),
        emotion_scale: Number(parsed.emotion),
        emotion_words: parsed.words ?? [],
      };
    }
    case "request": {
      const parsed = JSON.parse(value) as { raw: string; need?: string; refined: string };
      return {
        request_raw: parsed.raw,
        request_need: parsed.need ?? null,
        request_refined: parsed.refined,
      };
    }
    case "partner_mind": {
      const parsed = JSON.parse(value) as { intention: string; words?: string[] };
      return {
        partner_intention: parsed.intention,
        partner_perspective_words: parsed.words ?? [],
      };
    }
    default:
      return { [fieldKey]: value };
  }
}

interface GenContext {
  chatLog: ChatEntry[];
  input: Record<string, unknown>;
  relationshipContext: string;
  referenceBank: Record<string, unknown> | null;
  conflictId?: string;
}

// 한 필드에 대한 AI 턴 생성 (시스템 프롬프트 조립 + 검증 재시도 루프).
// 완료된 항목은 원본 대화(재질문 시도, 요약 멘트 등 포함)를 통째로 넘기지 않고 최종 확정값만
// 깔끔하게 요약해 넘긴다 — 진행 중이거나 중단된 채 반쯤 답한 기록이 그대로 컨텍스트에 남아
// 다른 항목의 질문을 오염시키는 것을 막고, 완결된 사실만 재사용 대상이 되게 한다.
// appendGroups: 혼합 턴용 서버 고정 그룹(static_turns.staticGroupsFor) — 항목의 첫 질문에만
// 전달되며, AI가 만든 그룹 뒤에 덧붙인 상태로 검증한다 (AI가 그룹을 아예 안 만들어도
// 고정 그룹이 질문이 되므로 "질문 턴에 choice_groups 없음" 위반이 되지 않는다).
async function generateEnvelope(
  field: InputField,
  userText: string | null,
  ctx: GenContext,
  appendGroups: ChoiceGroup[] = [],
): Promise<GuideEnvelope> {
  const { chatLog, input, relationshipContext, referenceBank } = ctx;

  const completedSummary = INPUT_FIELDS.filter((f) => f.key !== field.key)
    .map((f) => {
      const value = summarizeCompletedField(f.key, input);
      return value ? `- ${f.label}: ${value}` : null;
    })
    .filter((line): line is string => !!line)
    .join("\n");
  // 이전 항목들에서 사용자가 직접 타이핑한 자유서술 답변은 원문 그대로 별도 블록으로 넘긴다 —
  // 확정값 요약만으로는 장문 답변에 녹아 있던 다른 항목의 단서(감정, 의도 인식, 바라는 것 등)가
  // 사라져서, 다음 항목에서 이미 들은 이야기를 처음 듣는 것처럼 다시 묻게 되기 때문.
  const freeTextAnswers = chatLog
    .filter(
      (e) =>
        e.role === "user" &&
        e.field !== field.key &&
        (!e.selections || e.selections.length === 0),
    )
    .map((e) => {
      const label = INPUT_FIELDS.find((f) => f.key === e.field)?.label ?? e.field;
      return `- ("${label}" 항목에서) ${e.content}`;
    })
    .join("\n");
  const currentFieldTurns = chatLog
    .filter((e) => e.field === field.key)
    .map((e) => `${e.role === "user" ? "사용자" : "AI"}: ${e.content}`)
    .join("\n");
  const history =
    `${completedSummary ? `[이전에 완료된 항목들 — 최종 확정값]\n${completedSummary}\n\n` : ""}` +
    `${freeTextAnswers ? `[이전 항목들에서 사용자가 직접 쓴 자유서술 답변 원문 — 힌트 소스]\n${freeTextAnswers}\n\n` : ""}` +
    `[이번 항목("${field.label}") 진행 중인 대화]\n${currentFieldTurns || "(아직 없음)"}`;
  const system = INPUT_GUIDE_SYSTEM
    .replace("{current_field}", `${field.label} (${field.key}) — ${field.goal}`)
    .replace("{relationship_context}", relationshipContext)
    .replace("{field_choice_bank}", fieldChoiceBank(field.key, referenceBank))
    .replace("{chat_history}", history || "(아직 없음)");

  const userMessage = userText ?? `(항목 시작) "${field.label}" 항목의 첫 질문을 해주세요.`;

  // 채팅 재질문은 지연이 중요 — json_object 응답 형식으로 파싱 비용 최소화.
  // json_object 모드는 유효한 JSON만 보장할 뿐 스키마/규칙 준수는 보장하지 않으므로,
  // 룰 기반 검증(envelopeViolation)에 걸리면 위반 사유를 붙여 재생성을 요구한다.
  const baseMessages: { role: "user" | "assistant"; content: string }[] = [
    { role: "user", content: userMessage },
  ];
  // 재시도는 1회로 제한 — 시도마다 사용자 대기 시간이 통째로 늘어난다
  const MAX_GUIDE_ATTEMPTS = 2;
  let envelope!: GuideEnvelope;
  let lastContent = "";
  let lastViolation: string | null = null;
  for (let attempt = 0; attempt < MAX_GUIDE_ATTEMPTS; attempt++) {
    const messages =
      attempt === 0
        ? baseMessages
        : [
            ...baseMessages,
            { role: "assistant" as const, content: lastContent },
            {
              role: "user" as const,
              content:
                `(자동 검증 실패 — 방금 응답은 규칙 위반: ${lastViolation}) ` +
                "같은 취지의 message와 질문은 유지하되, 규칙을 지킨 완전한 JSON으로 다시 응답하세요. " +
                "field_complete가 false인 질문 턴에는 반드시 choice_groups(주제별 1~4개 그룹, " +
                "각 그룹에 이 상황에 맞는 구체적 선택지 문장들)를 포함해야 하고, " +
                "field_complete가 true라면 extracted_value를 반드시 채워야 합니다.",
            },
          ];
    const response = await chat({ system, messages, maxTokens: 1024, json: true });
    logUsage(`ai-input:${field.key}`, ctx.conflictId, response);
    const content = response.text;
    if (!content) throw new Error("no content in response");
    lastContent = content;
    envelope = normalizeEnvelope(content);
    if (appendGroups.length && !envelope.field_complete) {
      // AI가 지시를 어기고 고정 그룹과 같은 내용의 그룹을 만든 경우 AI 쪽을 버린다
      // (문장이 절반 이상 겹치면 같은 질문으로 간주 — 표현만 다른 중복은 프롬프트가 막는다)
      const norm = (s: string) => s.replace(/\s+/g, "");
      const staticChoices = new Set(appendGroups.flatMap((g) => g.choices).map(norm));
      const aiGroups = (envelope.choice_groups ?? []).filter((g) => {
        const dup = g.choices.filter((c) => staticChoices.has(norm(c))).length;
        return dup < Math.ceil(g.choices.length / 2);
      });
      envelope = { ...envelope, choice_groups: [...aiGroups, ...appendGroups] };
    }
    lastViolation = envelopeViolation(envelope, field.key, chatLog);
    if (!lastViolation) break;
    console.warn(
      `guide envelope invalid (attempt ${attempt + 1}/${MAX_GUIDE_ATTEMPTS}, field ${field.key}): ${lastViolation}`,
    );
  }
  // 재시도까지 전부 실패한 경우의 안전판:
  // - 값 없는 field_complete는 저장 없이 다음 항목으로 넘어가는 유령 진행을 만들므로 강제로 되돌린다.
  // - choice_groups 없는 질문은 클라이언트가 자유입력 폴백을 띄우므로 그대로 내보낸다 (500보다 낫다).
  if (envelope.field_complete && !envelope.extracted_value) {
    envelope.field_complete = false;
  }
  // request가 재시도 후에도 refined 없이 완료로 남았으면 완료를 되돌리고,
  // 자유서술로 구체적 요청 한마디를 직접 묻는다 (request는 자유서술 허용 필드).
  if (
    envelope.field_complete &&
    field.key === "request" &&
    !requestRefined(envelope.extracted_value!)
  ) {
    envelope.field_complete = false;
    envelope.extracted_value = null;
    envelope.choice_groups = null;
    envelope.type = "clarify";
    envelope.message =
      "그 마음이 실제로 채워지는 모습을 조금 더 구체적으로 듣고 싶어요. " +
      "상대가 어떤 말이나 행동을 해주면 좋을까요? 실제로 해줬으면 하는 한마디여도 좋아요.";
  }
  // 완료 턴에 "좀 더 확인이 필요해요"(warn)가 붙어 나가는 의미 불일치 정리
  if (envelope.field_complete && envelope.flag === "warn") {
    envelope.flag = "ok";
    envelope.flag_text = "좋아요, 이해됐어요";
  }
  // 재시도까지 message가 계속 비면 고정 문구로라도 채운다 — 빈 말풍선은 데드엔드이고
  // chat_log에 영구 저장되므로 500보다도, 빈 문자열보다도 폴백 문구가 낫다.
  if (!envelope.message.trim()) {
    envelope.message = envelope.field_complete
      ? "잘 정리됐어요. 다음 이야기로 넘어가볼게요."
      : "방금 이야기를 조금만 더 자세히 들려줄 수 있을까요?";
  }
  return envelope;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { conflict_id, field_key, user_text, selections } = await req.json();

    const supaUser = userClient(req);
    const { data: auth } = await supaUser.auth.getUser();
    if (!auth?.user) return json({ error: "unauthorized" }, 401);
    const userId = auth.user.id;

    const field = INPUT_FIELDS.find((f) => f.key === field_key);
    if (!field) return json({ error: `unknown field: ${field_key}` }, 400);

    const admin = adminClient();

    // 본인 input row 확보 (없으면 생성)
    let { data: input } = await admin
      .from("conflict_inputs")
      .select("*")
      .eq("conflict_id", conflict_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!input) {
      const { data: created, error } = await admin
        .from("conflict_inputs")
        .insert({ conflict_id, user_id: userId })
        .select()
        .single();
      if (error) throw error;
      input = created;
    }

    const chatLog: ChatEntry[] = (input.chat_log as ChatEntry[]) ?? [];

    // 관계 프로필 + AI 생성 레퍼런스 뱅크 조회 (없으면 빈 컨텍스트로 폴백)
    const { data: conflict } = await admin
      .from("conflicts")
      .select("couple_id")
      .eq("id", conflict_id)
      .single();
    const { data: relationshipProfile } = conflict
      ? await admin
          .from("relationship_profiles")
          .select("*")
          .eq("couple_id", conflict.couple_id)
          .eq("user_id", userId)
          .maybeSingle()
      : { data: null };
    // 커플 단위 롤링 히스토리 요약 (지난 맺음들의 패턴 — 크기 고정)
    const { data: coupleRow } = conflict
      ? await admin
          .from("couples")
          .select("history_summary")
          .eq("id", conflict.couple_id)
          .maybeSingle()
      : { data: null };

    const relationshipContext = JSON.stringify(
      {
        ...(relationshipProfile
          ? {
              관계유형: relationshipProfile.relationship_type,
              사귄기간_개월: relationshipProfile.relationship_duration_months,
              내_성격: relationshipProfile.my_personality_tags,
              내가_보는_상대_성격: relationshipProfile.partner_personality_tags,
              자주_부딪히는_주제: relationshipProfile.frequent_conflict_topics,
              레퍼런스_뱅크: relationshipProfile.reference_bank,
            }
          : { 관계프로필: "(없음)" }),
        지난_맺음_누적요약: coupleRow?.history_summary ?? "(아직 없음)",
      },
      null,
      2,
    );

    const referenceBank = (relationshipProfile?.reference_bank ?? null) as
      | Record<string, unknown>
      | null;
    const genCtx: GenContext = { chatLog, input, relationshipContext, referenceBank, conflictId: conflict_id };

    // ── 고정 룰 턴: AI 호출 없이 즉시 처리 (질문/추출 모두 룰이면 이 항목은 토큰 0) ──
    const hasFieldTurns = chatLog.some((e) => e.field === field_key && e.role === "assistant");
    const isFirstQuestion = !user_text && !hasFieldTurns;
    let envelope: GuideEnvelope | null = null;
    if (isFirstQuestion) {
      // 항목 첫 질문 — 이 항목의 대화가 아직 없을 때만 (재진입/폴백 재생성은 AI에 맡긴다)
      envelope = staticEnvelopeFor(field_key, referenceBank);
    } else if (user_text) {
      // 직전 질문이 고정 룰 턴(스케일 그룹 포함)이었을 때만 룰 추출을 시도 — AI가 낸 질문의
      // 답을 스케일로 오해 파싱하는 것을 막는다. 실패하면 AI 폴백.
      const lastAssistant = [...chatLog]
        .reverse()
        .find((e) => e.role === "assistant" && e.field === field_key);
      if (lastAssistant?.choice_groups?.some((g) => g.kind === "scale")) {
        const value = staticExtract(
          field_key,
          Array.isArray(selections) ? (selections as string[][]) : null,
        );
        if (value) {
          envelope = {
            type: "next",
            flag: "ok",
            flag_text: "좋아요, 이해됐어요",
            message: STATIC_COMPLETE_MESSAGE[field_key] ?? "",
            choice_groups: null,
            extracted_value: value,
            field_complete: true,
          };
        }
      }
    }
    if (!envelope) {
      // 혼합 턴: 첫 질문이면 서버 고정 그룹(있다면)을 AI 그룹 뒤에 덧붙인다
      envelope = await generateEnvelope(
        field,
        user_text ?? null,
        genCtx,
        isFirstQuestion ? staticGroupsFor(field_key) : [],
      );
    }

    // 대화 로그 누적
    // choice_groups/selections는 새로고침 후 선택지+강조 상태를 복원하기 위한 메타데이터
    if (user_text) {
      chatLog.push({
        role: "user",
        field: field_key,
        content: user_text,
        selections: Array.isArray(selections) ? selections : null,
      });
    }
    chatLog.push({
      role: "assistant",
      field: field_key,
      content: envelope.message,
      choice_groups: envelope.choice_groups,
    });

    // 필드 완료 → 컬럼 값 수집 (DB 반영은 마지막에 한 번)
    const savedColumns: Record<string, unknown> = {};
    if (envelope.field_complete && envelope.extracted_value) {
      Object.assign(savedColumns, columnsForField(field_key, envelope.extracted_value));
    }

    // ── 다음 항목 첫 질문 피기백 ──
    // field_complete면 다음 항목의 첫 질문을 같은 응답에 실어 보내 클라이언트 왕복을 없앤다.
    // 다음 항목이 고정 룰이면 즉시, 아니면 AI 1회. 다음 항목이 이미 대화로 커버돼 0턴 완료되면
    // (프롬프트가 권장하는 최선의 결과) 그 값을 저장하고 그다음 항목으로 계속 간다.
    let curIdx = INPUT_FIELDS.findIndex((f) => f.key === field_key);
    let nextQuestion: (GuideEnvelope & { field: string }) | null = null;
    const skipped: { field: string; message: string }[] = [];
    if (envelope.field_complete) {
      try {
        while (curIdx < INPUT_FIELDS.length - 1) {
          const nextDef = INPUT_FIELDS[curIdx + 1];
          // 피기백은 항상 다음 항목의 "첫 질문"이므로 혼합 턴 고정 그룹도 함께 붙인다
          const nq =
            staticEnvelopeFor(nextDef.key, referenceBank) ??
            (await generateEnvelope(
              nextDef,
              null,
              { ...genCtx, input: { ...input, ...savedColumns } },
              staticGroupsFor(nextDef.key),
            ));
          if (nq.field_complete && nq.extracted_value) {
            // 0턴 완료 — 값 저장이 성공해야만 로그에 남긴다 (실패 시 로그 오염 방지)
            Object.assign(savedColumns, columnsForField(nextDef.key, nq.extracted_value));
            chatLog.push({
              role: "assistant",
              field: nextDef.key,
              content: nq.message,
              choice_groups: null,
            });
            skipped.push({ field: nextDef.key, message: nq.message });
            curIdx += 1;
            continue;
          }
          chatLog.push({
            role: "assistant",
            field: nextDef.key,
            content: nq.message,
            choice_groups: nq.choice_groups,
          });
          nextQuestion = { ...nq, field: nextDef.key };
          break;
        }
      } catch (e) {
        // 피기백 실패는 이번 턴 응답을 막지 않는다 — 클라이언트가 startField로 폴백
        console.error("next-question piggyback failed", e);
      }
    }

    // 마지막 항목까지 완료됐는지 (직접 완료 or 0턴 완료 체인으로 도달)
    const lastKey = INPUT_FIELDS[INPUT_FIELDS.length - 1].key;
    const allComplete =
      (envelope.field_complete && field_key === lastKey) ||
      skipped.some((s) => s.field === lastKey);

    const patch: Record<string, unknown> = { chat_log: chatLog, ...savedColumns };
    if (allComplete) {
      patch.is_complete = true;
      patch.completed_at = new Date().toISOString();
    }

    const { error: updateError } = await admin
      .from("conflict_inputs")
      .update(patch)
      .eq("id", input.id);
    if (updateError) throw updateError;

    // 양쪽 모두 완료 확인 → ai_processing 전환 + 편지 생성 트리거
    if (allComplete) {
      const { data: inputs } = await admin
        .from("conflict_inputs")
        .select("user_id, is_complete")
        .eq("conflict_id", conflict_id);

      const bothComplete = (inputs ?? []).filter((i) => i.is_complete).length >= 2;
      if (bothComplete) {
        await admin
          .from("conflicts")
          .update({ status: "ai_processing" })
          .eq("id", conflict_id);

        // 편지/분석 생성은 오래 걸리므로 백그라운드로
        const lettersCall = fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-letters`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({ conflict_id }),
          },
        ).catch((e) => console.error("ai-letters trigger failed", e));

        // @ts-ignore EdgeRuntime은 Supabase Edge 환경 전역
        if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(lettersCall);
      }
    }

    // 다음 항목 안내 — 피기백이 실패했더라도 next_field는 알려줘서 클라이언트가 폴백하게 한다
    const nextField =
      envelope.field_complete && !allComplete && curIdx < INPUT_FIELDS.length - 1
        ? INPUT_FIELDS[curIdx + 1].key
        : null;

    return json({
      ...envelope,
      next_field: nextField,
      all_complete: allComplete,
      next_question: nextQuestion,
      skipped,
    });
  } catch (e) {
    console.error(e);
    return json({ error: errorMessage(e) }, 500);
  }
});
