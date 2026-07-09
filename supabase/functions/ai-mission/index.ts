// 04단계: 미션 페이퍼 생성 (AGENT.md §4-4, §5-4)
// 트리거: 양쪽 모두 conflict_ready_states에 row 존재 → 두 번째 ready를 누른 클라이언트가 호출
// 요청: { conflict_id }
// → mission_a/b + convo_guide 생성 → conflict_outputs 갱신 → status 'mission_unlocked' → 푸시
import {
  openaiClient,
  adminClient,
  userClient,
  AI_MODEL,
  corsHeaders,
  json,
  parseModelJson,
  sendPush,
} from "../_shared/utils.ts";
import { MISSION_SYSTEM } from "../../../prompts/mission.ts";

interface MissionResult {
  mindset_a: string;
  mindset_b: string;
  mission_a: { text: string; type: "prevent" | "differently" | "empathy" }[];
  mission_b: { text: string; type: "prevent" | "differently" | "empathy" }[];
  convo_guide: {
    step: number;
    who: "a" | "b" | "both";
    title?: string | null;
    text: string;
    listener?: string | null;
  }[];
  convo_note: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { conflict_id, force } = await req.json();

    // 커플 멤버 본인 확인
    const supaUser = userClient(req);
    const { data: auth } = await supaUser.auth.getUser();
    if (!auth?.user) return json({ error: "unauthorized" }, 401);

    const admin = adminClient();

    // 양쪽 준비 확인
    const { data: readyRows } = await admin
      .from("conflict_ready_states")
      .select("user_id")
      .eq("conflict_id", conflict_id);
    if (!readyRows || readyRows.length < 2) {
      return json({ error: "both users must be ready" }, 400);
    }

    // 멱등: 이미 "새 형식" 미션이 있으면 그대로 반환.
    // mindset_a가 없는 레코드는 개편 전 형식이므로 통과시켜 새 형식으로 재생성한다.
    const { data: outputs } = await admin
      .from("conflict_outputs")
      .select("*")
      .eq("conflict_id", conflict_id)
      .single();
    if (!outputs) return json({ error: "outputs not found" }, 404);
    if (outputs.mission_a && outputs.mindset_a && !force) {
      return json({
        ok: true,
        already: true,
        mindset_a: outputs.mindset_a,
        mindset_b: outputs.mindset_b,
        mission_a: outputs.mission_a,
        mission_b: outputs.mission_b,
        convo_guide: outputs.convo_guide,
        convo_note: outputs.convo_note,
      });
    }

    const { data: conflict } = await admin
      .from("conflicts")
      .select("couple_id, initiator_id")
      .eq("id", conflict_id)
      .single();
    const { data: couple } = await admin
      .from("couples")
      .select("user_a_id, user_b_id")
      .eq("id", conflict!.couple_id)
      .single();
    const { data: inputs } = await admin
      .from("conflict_inputs")
      .select("*")
      .eq("conflict_id", conflict_id);
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, display_name, push_token")
      .in("id", [couple!.user_a_id, couple!.user_b_id]);

    const profileA = profiles!.find((p) => p.id === couple!.user_a_id)!;
    const profileB = profiles!.find((p) => p.id === couple!.user_b_id)!;
    const inputA = inputs!.find((i) => i.user_id === couple!.user_a_id)!;
    const inputB = inputs!.find((i) => i.user_id === couple!.user_b_id)!;
    const initiatorLabel = conflict!.initiator_id === couple!.user_a_id ? "a" : "b";

    const context = JSON.stringify(
      {
        A: { 이름: profileA.display_name, ...inputA },
        B: { 이름: profileB.display_name, ...inputB },
        initiator: initiatorLabel,
        // 실제로 서로에게 전달된 편지 — 미션/대화 가이드가 편지의 문장에 뿌리내리게 한다
        편지_A가_B에게: outputs.letter_a_to_b,
        편지_B가_A에게: outputs.letter_b_to_a,
        분석: {
          timing: outputs.analysis_timing,
          temperature: outputs.analysis_temperature,
          understanding: outputs.analysis_understanding,
        },
      },
      null,
      2,
    );

    const openai = openaiClient();
    const res = await openai.chat.completions.create({
      model: AI_MODEL,
      max_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: MISSION_SYSTEM.replace("{both_inputs_and_analysis}", context) },
        { role: "user", content: "화해 미션 페이퍼를 생성해주세요." },
      ],
    });

    const content = res.choices[0]?.message?.content;
    if (!content) throw new Error("no mission text");
    const mission = parseModelJson<Partial<MissionResult>>(content);
    // json_object 모드는 스키마 준수를 보장하지 않으므로 필수 필드 누락을 명시적으로 검증
    if (
      !Array.isArray(mission.mission_a) ||
      !Array.isArray(mission.mission_b) ||
      !Array.isArray(mission.convo_guide) ||
      typeof mission.mindset_a !== "string" ||
      typeof mission.mindset_b !== "string"
    ) {
      throw new Error(`mission response missing required fields: ${JSON.stringify(mission)}`);
    }

    const { error: updateError } = await admin
      .from("conflict_outputs")
      .update({
        mindset_a: mission.mindset_a,
        mindset_b: mission.mindset_b,
        mission_a: mission.mission_a,
        mission_b: mission.mission_b,
        convo_guide: mission.convo_guide,
        convo_note: mission.convo_note,
      })
      .eq("conflict_id", conflict_id);
    if (updateError) throw updateError;

    await admin
      .from("conflicts")
      .update({ status: "mission_unlocked" })
      .eq("id", conflict_id);

    await Promise.all([
      sendPush(profileA.push_token, "맺음", "미션 페이퍼가 열렸어요 ✉️", { conflict_id }),
      sendPush(profileB.push_token, "맺음", "미션 페이퍼가 열렸어요 ✉️", { conflict_id }),
    ]);

    return json({ ok: true, ...mission });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
