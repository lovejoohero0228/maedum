// 02단계: AI 재질문 입력 (AGENT.md §4-2, §5-1)
// 요청: { conflict_id, field_key, user_text | null, selections? }
//   - user_text가 null이면 해당 항목의 첫 질문을 생성
//   - selections: 클라이언트가 choice_groups에서 실제로 고른 값들 (그룹 순서와 동일한 배열의 배열).
//     자유 입력 답변이면 undefined/null — user_text는 그 경우에도 항상 사람이 읽을 합쳐진 텍스트다.
// 응답: INPUT_GUIDE_SYSTEM의 JSON 봉투 + { next_field, all_complete }
//
// 필드가 완료되면 extracted_value를 컬럼에 저장하고,
// 모든 항목(INPUT_FIELDS)이 끝나면 is_complete=TRUE. 상대도 완료면 status='ai_processing'
// 후 ai-letters를 백그라운드 호출한다.
// 호출자의 relationship_profiles(있다면)를 조회해 개인화된 선택지 생성에 참고시킨다.
import {
  openaiClient,
  adminClient,
  userClient,
  AI_MODEL,
  corsHeaders,
  json,
  parseModelJson,
} from "../_shared/utils.ts";
import { INPUT_GUIDE_SYSTEM, INPUT_FIELDS } from "../../../prompts/input_guide.ts";

interface ChoiceGroup {
  label: string;
  choices: string[];
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
          }))
          .filter((g) => g.choices.length > 0)
      : null,
    extracted_value: raw.extracted_value ?? null,
    field_complete: raw.field_complete ?? false,
  };
}

// 선택지 없는 자유서술 질문이 허용되는 필드 (input_guide의 두 예외가 모두 여기 속함)
const FREE_TEXT_EXEMPT_FIELDS = new Set(["trigger_moment", "first_hurt_moment"]);

// 보기 생성 여부를 프롬프트에게만 맡기지 않는 룰 기반 검증.
// 위반 사유 문자열을 반환하면 AI를 재호출한다 (null이면 통과).
// - field_complete 턴: extracted_value가 반드시 있어야 한다 (없으면 클라이언트가
//   저장 안 된 채 다음 항목으로 넘어가는 유령 진행이 생긴다).
// - 질문 턴: choice_groups가 반드시 있어야 한다. 자유서술 턴은 trigger_moment/
//   first_hurt_moment에서만, 그 필드에서 이미 선택지 질문이 오간 뒤에, 필드당 한 번만.
function envelopeViolation(
  envelope: GuideEnvelope,
  fieldKey: string,
  chatLog: ChatEntry[],
): string | null {
  if (envelope.field_complete) {
    return envelope.extracted_value ? null : "field_complete인데 extracted_value가 비어 있음";
  }
  if (envelope.choice_groups?.length) return null;
  if (!FREE_TEXT_EXEMPT_FIELDS.has(fieldKey)) {
    return "질문 턴에 choice_groups가 없음 (이 필드는 자유서술 예외 대상이 아님)";
  }
  const fieldTurns = chatLog.filter((e) => e.field === fieldKey && e.role === "assistant");
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
    case "context":
      return Array.isArray(bank.context_tags) ? bank.context_tags.join(", ") : "(없음)";
    case "emotion_words": {
      const words = bank.emotion_words;
      if (!words || typeof words !== "object") return "(없음)";
      return Object.values(words as Record<string, string[]>).flat().join(", ");
    }
    case "request":
      // 욕구 확인 턴에서 쓸 후보 — refined 멘트 자체는 뱅크 대상이 아님
      return Array.isArray(bank.need_words)
        ? `(욕구 확인 그룹 전용 후보 — 상황/멘트 그룹에는 적용하지 말 것) ${bank.need_words.join(", ")}`
        : "(없음)";
    case "partner_perspective":
      return Array.isArray(bank.partner_perspective_words)
        ? bank.partner_perspective_words.join(", ")
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
    case "first_hurt_moment":
      return (input.first_hurt_moment as string | null) ?? null;
    case "context": {
      const detail = input.context_detail as string | null;
      if (!detail) return null;
      const tags = (input.context_tags as string[] | null) ?? [];
      return tags.length ? `${tags.join(", ")} — ${detail}` : detail;
    }
    case "scales": {
      const conflict = input.conflict_scale as number | null;
      const emotion = input.emotion_scale as number | null;
      return conflict != null && emotion != null ? `갈등 ${conflict}, 속상함 ${emotion}` : null;
    }
    case "emotion_words": {
      const words = input.emotion_words as string[] | null;
      return words?.length ? words.join(", ") : null;
    }
    case "request": {
      const refined = input.request_refined as string | null;
      if (!refined) return null;
      const raw = input.request_raw as string | null;
      const need = input.request_need as string | null;
      const base = raw ? `${raw} → ${refined}` : refined;
      return need ? `${base} (욕구: ${need})` : base;
    }
    case "partner_intention":
      return (input.partner_intention as string | null) ?? null;
    case "partner_perspective": {
      const words = input.partner_perspective_words as string[] | null;
      return words?.length ? words.join(", ") : null;
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
    case "context": {
      const parsed = JSON.parse(value) as { tags: string[]; detail: string };
      return { context_tags: parsed.tags, context_detail: parsed.detail };
    }
    case "scales": {
      const m = value.match(/conflict\s*:\s*(\d+)\s*,\s*emotion\s*:\s*(\d+)/i);
      if (!m) throw new Error(`bad scales value: ${value}`);
      return { conflict_scale: Number(m[1]), emotion_scale: Number(m[2]) };
    }
    case "request": {
      const parsed = JSON.parse(value) as { raw: string; need?: string; refined: string };
      return {
        request_raw: parsed.raw,
        request_need: parsed.need ?? null,
        request_refined: parsed.refined,
      };
    }
    case "emotion_words":
      return { emotion_words: JSON.parse(value) as string[] };
    case "partner_perspective":
      return { partner_perspective_words: JSON.parse(value) as string[] };
    default:
      return { [fieldKey]: value };
  }
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

    const relationshipContext = relationshipProfile
      ? JSON.stringify(
          {
            관계유형: relationshipProfile.relationship_type,
            사귄기간_개월: relationshipProfile.relationship_duration_months,
            내_성격: relationshipProfile.my_personality_tags,
            내가_보는_상대_성격: relationshipProfile.partner_personality_tags,
            자주_부딪히는_주제: relationshipProfile.frequent_conflict_topics,
            레퍼런스_뱅크: relationshipProfile.reference_bank,
          },
          null,
          2,
        )
      : "(관계 프로필 없음)";

    // 시스템 프롬프트 조립
    // 완료된 항목은 원본 대화(재질문 시도, 요약 멘트 등 포함)를 통째로 넘기지 않고 최종 확정값만
    // 깔끔하게 요약해 넘긴다 — 진행 중이거나 중단된 채 반쯤 답한 기록이 그대로 컨텍스트에 남아
    // 다른 항목의 질문을 오염시키는 것을 막고, 완결된 사실만 재사용 대상이 되게 한다.
    const completedSummary = INPUT_FIELDS.filter((f) => f.key !== field_key)
      .map((f) => {
        const value = summarizeCompletedField(f.key, input);
        return value ? `- ${f.label}: ${value}` : null;
      })
      .filter((line): line is string => !!line)
      .join("\n");
    const currentFieldTurns = chatLog
      .filter((e) => e.field === field_key)
      .map((e) => `${e.role === "user" ? "사용자" : "AI"}: ${e.content}`)
      .join("\n");
    const history = `${completedSummary ? `[이전에 완료된 항목들]\n${completedSummary}\n\n` : ""}[이번 항목("${field.label}") 진행 중인 대화]\n${currentFieldTurns || "(아직 없음)"}`;
    const system = INPUT_GUIDE_SYSTEM
      .replace("{current_field}", `${field.label} (${field.key}) — ${field.goal}`)
      .replace("{relationship_context}", relationshipContext)
      .replace(
        "{field_choice_bank}",
        fieldChoiceBank(field_key, relationshipProfile?.reference_bank ?? null),
      )
      .replace("{chat_history}", history || "(아직 없음)");

    const userMessage = user_text
      ? user_text
      : `(항목 시작) "${field.label}" 항목의 첫 질문을 해주세요.`;

    // 채팅 재질문은 지연이 중요 — json_object 응답 형식으로 파싱 비용 최소화.
    // json_object 모드는 유효한 JSON만 보장할 뿐 스키마/규칙 준수는 보장하지 않으므로,
    // 룰 기반 검증(envelopeViolation)에 걸리면 위반 사유를 붙여 재생성을 요구한다.
    const openai = openaiClient();
    const baseMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: system },
      { role: "user", content: userMessage },
    ];
    const MAX_GUIDE_ATTEMPTS = 3;
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
      const response = await openai.chat.completions.create({
        model: AI_MODEL,
        max_tokens: 1024,
        response_format: { type: "json_object" },
        messages,
      });
      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error("no content in response");
      lastContent = content;
      envelope = normalizeEnvelope(content);
      lastViolation = envelopeViolation(envelope, field_key, chatLog);
      if (!lastViolation) break;
      console.warn(
        `guide envelope invalid (attempt ${attempt + 1}/${MAX_GUIDE_ATTEMPTS}, field ${field_key}): ${lastViolation}`,
      );
    }
    // 재시도까지 전부 실패한 경우의 안전판:
    // - 값 없는 field_complete는 저장 없이 다음 항목으로 넘어가는 유령 진행을 만들므로 강제로 되돌린다.
    // - choice_groups 없는 질문은 클라이언트가 자유입력 폴백을 띄우므로 그대로 내보낸다 (500보다 낫다).
    if (envelope.field_complete && !envelope.extracted_value) {
      envelope.field_complete = false;
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

    const patch: Record<string, unknown> = { chat_log: chatLog };

    // 필드 완료 → 값 저장
    let allComplete = false;
    if (envelope.field_complete && envelope.extracted_value) {
      Object.assign(patch, columnsForField(field_key, envelope.extracted_value));

      const isLastField = INPUT_FIELDS[INPUT_FIELDS.length - 1].key === field_key;
      if (isLastField) {
        patch.is_complete = true;
        patch.completed_at = new Date().toISOString();
        allComplete = true;
      }
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

    // 다음 항목 안내
    const idx = INPUT_FIELDS.findIndex((f) => f.key === field_key);
    const nextField =
      envelope.field_complete && idx < INPUT_FIELDS.length - 1
        ? INPUT_FIELDS[idx + 1].key
        : null;

    return json({ ...envelope, next_field: nextField, all_complete: allComplete });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
