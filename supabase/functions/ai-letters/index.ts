// 03단계: AI 우체통 + 분석 생성 (AGENT.md §4-3, §5-2, §5-3)
// 트리거: 양쪽 모두 is_complete → ai-input이 service_role로 호출
// 요청: { conflict_id }
// 1. letter_a_to_b: A의 입력으로 B가 읽을 편지 정제
// 2. letter_b_to_a: B의 입력으로 A가 읽을 편지 정제
// 3. 분석: 양쪽 입력 모두로 중재자 분석
// → conflict_outputs 저장 → status 'letters_delivered' → 양쪽 푸시
import {
  openaiClient,
  adminClient,
  AI_MODEL,
  corsHeaders,
  json,
  parseModelJson,
  sendPush,
} from "../_shared/utils.ts";
import { LETTER_REFINE_SYSTEM } from "../../../prompts/letter_refine.ts";
import { ANALYSIS_SYSTEM } from "../../../prompts/analysis.ts";

interface InputRow {
  user_id: string;
  trigger_moment: string | null;
  first_hurt_moment: string | null;
  context_tags: string[] | null;
  context_detail: string | null;
  conflict_scale: number | null;
  emotion_scale: number | null;
  request_raw: string | null;
  request_refined: string | null;
  partner_intention: string | null;
  my_reflection: string | null;
}

function inputSummary(row: InputRow, name: string, partnerName: string): string {
  return JSON.stringify(
    {
      작성자: name,
      상대: partnerName,
      trigger_moment: row.trigger_moment,
      first_hurt_moment: row.first_hurt_moment,
      context_tags: row.context_tags,
      context_detail: row.context_detail,
      conflict_scale: row.conflict_scale,
      emotion_scale: row.emotion_scale,
      request_raw: row.request_raw,
      request_refined: row.request_refined,
      partner_intention: row.partner_intention,
      my_reflection: row.my_reflection,
    },
    null,
    2,
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // service_role 전용 (ai-input 내부 호출)
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)) {
      return json({ error: "forbidden" }, 403);
    }

    const { conflict_id } = await req.json();
    const admin = adminClient();

    // 이미 생성됐으면 멱등 반환
    const { data: existing } = await admin
      .from("conflict_outputs")
      .select("id")
      .eq("conflict_id", conflict_id)
      .maybeSingle();
    if (existing) return json({ ok: true, already: true });

    const { data: conflict } = await admin
      .from("conflicts")
      .select("id, couple_id")
      .eq("id", conflict_id)
      .single();
    if (!conflict) return json({ error: "conflict not found" }, 404);

    const { data: couple } = await admin
      .from("couples")
      .select("user_a_id, user_b_id")
      .eq("id", conflict.couple_id)
      .single();
    if (!couple) return json({ error: "couple not found" }, 404);

    const { data: inputs } = await admin
      .from("conflict_inputs")
      .select("*")
      .eq("conflict_id", conflict_id)
      .eq("is_complete", true);
    if (!inputs || inputs.length < 2) return json({ error: "inputs incomplete" }, 400);

    const inputA = inputs.find((i) => i.user_id === couple.user_a_id) as InputRow;
    const inputB = inputs.find((i) => i.user_id === couple.user_b_id) as InputRow;
    if (!inputA || !inputB) return json({ error: "inputs missing for couple" }, 400);

    const { data: profiles } = await admin
      .from("profiles")
      .select("id, display_name, push_token")
      .in("id", [couple.user_a_id, couple.user_b_id]);
    const profileA = profiles!.find((p) => p.id === couple.user_a_id)!;
    const profileB = profiles!.find((p) => p.id === couple.user_b_id)!;

    const openai = openaiClient();

    // 편지: 발신자 입력 → 수신자가 읽는 텍스트 (AGENT.md 스키마 주석: letter_a_to_b = A→B)
    async function refineLetter(senderInput: InputRow, senderName: string, receiverName: string) {
      const system = LETTER_REFINE_SYSTEM.replace(
        "{input_data}",
        inputSummary(senderInput, senderName, receiverName),
      );
      const res = await openai.chat.completions.create({
        model: AI_MODEL,
        max_tokens: 2048,
        messages: [
          { role: "system", content: system },
          { role: "user", content: `${receiverName}에게 전달할 편지를 작성해주세요.` },
        ],
      });
      const text = res.choices[0]?.message?.content;
      if (!text) throw new Error("no letter text");
      return text.trim();
    }

    // 분석: 양쪽 입력 → JSON 3섹션
    async function generateAnalysis() {
      const both = `## A (${profileA.display_name})\n${inputSummary(inputA, profileA.display_name, profileB.display_name)}\n\n## B (${profileB.display_name})\n${inputSummary(inputB, profileB.display_name, profileA.display_name)}`;
      const system = ANALYSIS_SYSTEM.replace("{both_inputs}", both);
      const res = await openai.chat.completions.create({
        model: AI_MODEL,
        max_tokens: 4096,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: "두 사람의 갈등 구조를 분석해주세요." },
        ],
      });
      const content = res.choices[0]?.message?.content;
      if (!content) throw new Error("no analysis text");
      const parsed = parseModelJson<{
        timing?: unknown;
        temperature?: unknown;
        understanding?: unknown;
      }>(content);
      // json_object 모드는 스키마 준수를 보장하지 않으므로 필수 섹션 누락을 명시적으로 검증
      if (!parsed.timing || !parsed.temperature || !parsed.understanding) {
        throw new Error(`analysis missing required section(s): ${JSON.stringify(parsed)}`);
      }
      return parsed as { timing: unknown; temperature: unknown; understanding: unknown };
    }

    // 세 호출은 서로 독립 — 병렬 실행
    const [letterAtoB, letterBtoA, analysis] = await Promise.all([
      refineLetter(inputA, profileA.display_name, profileB.display_name),
      refineLetter(inputB, profileB.display_name, profileA.display_name),
      generateAnalysis(),
    ]);

    const { error: insertError } = await admin.from("conflict_outputs").insert({
      conflict_id,
      letter_a_to_b: letterAtoB,
      letter_b_to_a: letterBtoA,
      analysis_timing: JSON.stringify(analysis.timing),
      analysis_temperature: JSON.stringify(analysis.temperature),
      analysis_understanding: JSON.stringify(analysis.understanding),
    });
    if (insertError) throw insertError;

    await admin
      .from("conflicts")
      .update({ status: "letters_delivered" })
      .eq("id", conflict_id);

    await Promise.all([
      sendPush(profileA.push_token, "맺음", "편지가 도착했어요 💌", { conflict_id }),
      sendPush(profileB.push_token, "맺음", "편지가 도착했어요 💌", { conflict_id }),
    ]);

    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
