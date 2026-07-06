// 02단계: AI 재질문 입력 (AGENT.md §4-2, §5-1)
// 요청: { conflict_id, field_key, user_text | null }
//   - user_text가 null이면 해당 항목의 첫 질문을 생성
// 응답: INPUT_GUIDE_SYSTEM의 JSON 봉투 + { next_field, all_complete }
//
// 필드가 완료되면 extracted_value를 컬럼에 저장하고,
// 7개 항목이 모두 끝나면 is_complete=TRUE. 상대도 완료면 status='ai_processing'
// 후 ai-letters를 백그라운드 호출한다.
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

interface GuideEnvelope {
  type: "question" | "clarify" | "confirm" | "next";
  flag: "warn" | "ok" | "purple" | null;
  flag_text: string | null;
  message: string;
  choices: string[] | null;
  extracted_value: string | null;
  field_complete: boolean;
}

interface ChatEntry {
  role: "user" | "assistant";
  field: string;
  content: string;
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
      const parsed = JSON.parse(value) as { raw: string; refined: string };
      return { request_raw: parsed.raw, request_refined: parsed.refined };
    }
    default:
      return { [fieldKey]: value };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { conflict_id, field_key, user_text } = await req.json();

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

    // 시스템 프롬프트 조립
    const history = chatLog
      .map((e) => `[${e.field}] ${e.role === "user" ? "사용자" : "AI"}: ${e.content}`)
      .join("\n");
    const system = INPUT_GUIDE_SYSTEM
      .replace("{current_field}", `${field.label} (${field.key}) — ${field.goal}`)
      .replace("{chat_history}", history || "(아직 없음)");

    const userMessage = user_text
      ? user_text
      : `(항목 시작) "${field.label}" 항목의 첫 질문을 해주세요.`;

    // 채팅 재질문은 지연이 중요 — json_object 응답 형식으로 파싱 비용 최소화
    const openai = openaiClient();
    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      max_tokens: 1024,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMessage },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("no content in response");
    // json_object 모드는 유효한 JSON만 보장할 뿐 스키마 준수는 보장하지 않는다
    // (OpenAI가 종종 extracted_value/field_complete 같은 키를 통째로 생략함).
    // 누락된 키는 "아직 완료 안 됨" 쪽으로 안전하게 기본값 처리한다.
    const raw = parseModelJson<Partial<GuideEnvelope>>(content);
    const envelope: GuideEnvelope = {
      type: raw.type ?? "clarify",
      flag: raw.flag ?? null,
      flag_text: raw.flag_text ?? null,
      message: raw.message ?? "",
      choices: raw.choices ?? null,
      extracted_value: raw.extracted_value ?? null,
      field_complete: raw.field_complete ?? false,
    };

    // 대화 로그 누적
    if (user_text) chatLog.push({ role: "user", field: field_key, content: user_text });
    chatLog.push({ role: "assistant", field: field_key, content: envelope.message });

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
