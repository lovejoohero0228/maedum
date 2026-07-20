// 04단계: 미션 페이퍼 생성 (AGENT.md §4-4, §5-4)
// 트리거: 양쪽 모두 conflict_ready_states에 row 존재 → 두 번째 ready를 누른 클라이언트가 호출
// 요청: { conflict_id }
// → mission_a/b + convo_guide 생성 → conflict_outputs 갱신 → status 'mission_unlocked' → 푸시
import {
  chat,
  cacheableSystem,
  adminClient,
  userClient,
  corsHeaders,
  json,
  parseModelJson,
  errorMessage,
  logUsage,
  sendPush,
} from "../_shared/utils.ts";
import { MISSION_SYSTEM } from "../../../prompts/mission.ts";

interface MissionResult {
  mindset_a: string;
  mindset_b: string;
  mission_a: { text: string; type: "prevent" | "differently" | "empathy" }[];
  mission_b: { text: string; type: "prevent" | "differently" | "empathy" }[];
  small_mission_a: { text: string }[];
  small_mission_b: { text: string }[];
  mission_both: { text: string }[];
  convo_guide: {
    step: number;
    who: "a" | "b" | "both";
    title?: string | null;
    text: string;
    listener?: string | null;
  }[];
  convo_note: string;
}

// json_object 모드는 스키마 준수를 보장하지 않으므로 룰 기반으로 검증한다.
// 위반 사유 문자열을 반환하면 피드백을 붙여 1회 재생성한다 (null이면 통과).
function missionViolation(mission: MissionResult, contextNorm: string): string | null {
  if (mission.mission_a.length !== 3 || mission.mission_b.length !== 3) {
    return "mission_a/mission_b는 각각 정확히 3개(prevent/differently/empathy 1개씩)여야 함";
  }
  if (mission.small_mission_a.length !== 2 || mission.small_mission_b.length !== 2) {
    return "small_mission_a/small_mission_b는 각각 정확히 2개여야 함";
  }
  if (mission.mission_both.length < 1 || mission.mission_both.length > 2) {
    return "mission_both는 1~2개여야 함";
  }
  if (mission.convo_guide.length !== 4) {
    return "convo_guide는 정확히 4단계여야 함";
  }
  // 허위 인용 검증: 미션/마인드셋 문장 안에서 따옴표로 인용된 말은 반드시
  // 입력 데이터(문답·편지·분석)에 실제로 등장해야 한다. (프롬프트 예시를 그대로
  // 베껴 "하지도 않은 말"을 인용하는 사례가 실제로 관측됨)
  const norm = (s: string) => s.replace(/\s+/g, "");
  const texts = [
    mission.mindset_a,
    mission.mindset_b,
    ...mission.mission_a.map((m) => m.text),
    ...mission.mission_b.map((m) => m.text),
    ...mission.small_mission_a.map((m) => m.text),
    ...mission.small_mission_b.map((m) => m.text),
    ...mission.mission_both.map((m) => m.text),
    ...mission.convo_guide.flatMap((s) => [s.text, s.listener ?? ""]),
    mission.convo_note,
  ];
  for (const t of texts) {
    for (const match of t.matchAll(/['‘"“]([^'’"”]{4,60})['’"”]/g)) {
      const quoted = norm(match[1]);
      // 4자 미만/조사 차이 수준의 짧은 인용은 오탐이 많아 건너뛴다
      if (quoted.length >= 4 && !contextNorm.includes(quoted)) {
        return (
          `인용문 "${match[1]}"이 입력 데이터에 존재하지 않음 — 두 사람이 실제로 한 말만 ` +
          "따옴표로 인용할 수 있음. 실제 문장이 없으면 인용 형식 없이 행동/상황을 지칭할 것"
        );
      }
    }
  }
  // 작은 미션은 "오늘 바로 할 말/행동" 제안이지 대사 스크립트가 아니다.
  // 완성된 대사를 따옴표로 지정하거나 사과를 대신 써주는 것을 금지한다
  // (사과는 두 사람이 직접 나눌 몫 — AGENT.md 핵심 철학).
  const smallTexts = [...mission.small_mission_a, ...mission.small_mission_b].map((m) => m.text);
  for (const t of smallTexts) {
    if (/['‘"“][^'’"”]{2,}['’"”]/.test(t)) {
      return (
        "작은 미션에 따옴표로 완성된 대사를 지정하지 말 것 — 무슨 마음을 전할지만 안내하고 " +
        "실제 문장은 본인이 쓰게 남긴다"
      );
    }
    if (/(미안|사과|잘못|용서)/.test(t)) {
      return (
        "작은 미션이 사과를 유도하고 있음 — 사과는 두 사람이 직접 만나 나눌 몫이므로 " +
        "작은 미션은 사과가 아니라 마음을 여는 말/행동으로 구성할 것"
      );
    }
  }
  return null;
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
    // mindset_a나 small_mission_a가 없는 레코드는 개편 전 형식이므로 통과시켜 새 형식으로 재생성한다.
    const { data: outputs } = await admin
      .from("conflict_outputs")
      .select("*")
      .eq("conflict_id", conflict_id)
      .single();
    if (!outputs) return json({ error: "outputs not found" }, 404);
    if (
      outputs.mission_a &&
      outputs.mindset_a &&
      outputs.small_mission_a &&
      outputs.mission_both &&
      !force
    ) {
      return json({
        ok: true,
        already: true,
        mindset_a: outputs.mindset_a,
        mindset_b: outputs.mindset_b,
        mission_a: outputs.mission_a,
        mission_b: outputs.mission_b,
        small_mission_a: outputs.small_mission_a,
        small_mission_b: outputs.small_mission_b,
        mission_both: outputs.mission_both,
        convo_guide: outputs.convo_guide,
        convo_note: outputs.convo_note,
      });
    }

    const { data: conflict } = await admin
      .from("conflicts")
      .select("couple_id, initiator_id, status")
      .eq("id", conflict_id)
      .single();
    // 이미 미션이 있었던 경우(구형식 갱신/강제 재생성) — 상태를 되돌리거나 푸시를 또 보내지 않는다
    const isRegeneration = !!outputs.mission_a;
    const { data: couple } = await admin
      .from("couples")
      .select("user_a_id, user_b_id, history_summary")
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
        지난_맺음_누적요약: couple!.history_summary ?? "(아직 없음)",
        분석: {
          timing: outputs.analysis_timing,
          temperature: outputs.analysis_temperature,
          understanding: outputs.analysis_understanding,
        },
      },
      null,
      2,
    );

    const { systemStable: missionStable, system: missionContext } = cacheableSystem(
      MISSION_SYSTEM,
      "{both_inputs_and_analysis}",
      context,
    );
    const baseMessages: { role: "user" | "assistant"; content: string }[] = [
      { role: "user", content: "화해 미션 페이퍼를 생성해주세요." },
    ];
    const contextNorm = context.replace(/\s+/g, "");
    const MAX_MISSION_ATTEMPTS = 2;
    let mission!: MissionResult;
    let lastContent = "";
    let lastViolation: string | null = null;
    for (let attempt = 0; attempt < MAX_MISSION_ATTEMPTS; attempt++) {
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
                  "같은 내용을 유지하되 위반만 고친 완전한 JSON으로 다시 응답하세요.",
              },
            ];
      const res = await chat({
        systemStable: missionStable,
        system: missionContext,
        messages,
        maxTokens: 4096,
        json: true,
        tier: "quality",
      });
      logUsage("ai-mission", conflict_id, res);
      const content = res.text;
      if (!content) {
        throw new Error(
          `no mission text (stop_reason=${res.stopReason}, completion_tokens=${res.usage.completion})`,
        );
      }
      lastContent = content;
      const parsed = parseModelJson<Partial<MissionResult>>(content);
      // json_object 모드는 스키마 준수를 보장하지 않으므로 필수 필드 누락을 명시적으로 검증
      if (
        !Array.isArray(parsed.mission_a) ||
        !Array.isArray(parsed.mission_b) ||
        !Array.isArray(parsed.small_mission_a) ||
        !Array.isArray(parsed.small_mission_b) ||
        !Array.isArray(parsed.mission_both) ||
        !Array.isArray(parsed.convo_guide) ||
        typeof parsed.mindset_a !== "string" ||
        typeof parsed.mindset_b !== "string"
      ) {
        throw new Error(`mission response missing required fields: ${JSON.stringify(parsed)}`);
      }
      mission = parsed as MissionResult;
      lastViolation = missionViolation(mission, contextNorm);
      if (!lastViolation) break;
      console.warn(
        `mission invalid (attempt ${attempt + 1}/${MAX_MISSION_ATTEMPTS}): ${lastViolation}`,
      );
    }
    // 재시도 후에도 위반이 남으면 미션 전달 자체를 막기보다 로그만 남기고 통과시킨다
    // (개수/인용 위반은 무한 로딩보다 낫다 — 클라이언트에 재생성 경로가 있다)
    if (lastViolation) console.error(`mission delivered with violation: ${lastViolation}`);

    const { error: updateError } = await admin
      .from("conflict_outputs")
      .update({
        mindset_a: mission.mindset_a,
        mindset_b: mission.mindset_b,
        mission_a: mission.mission_a,
        mission_b: mission.mission_b,
        small_mission_a: mission.small_mission_a,
        small_mission_b: mission.small_mission_b,
        mission_both: mission.mission_both,
        convo_guide: mission.convo_guide,
        convo_note: mission.convo_note,
      })
      .eq("conflict_id", conflict_id);
    if (updateError) throw updateError;

    // resolved(마무리된) 갈등의 미션을 재생성한 경우 상태를 되살리면 안 된다
    if (conflict!.status !== "resolved" && conflict!.status !== "mission_unlocked") {
      await admin
        .from("conflicts")
        .update({ status: "mission_unlocked" })
        .eq("id", conflict_id);
    }

    if (!isRegeneration) {
      await Promise.all([
        sendPush(profileA.push_token, "맺음", "미션 페이퍼가 열렸어요 ✉️", { conflict_id }),
        sendPush(profileB.push_token, "맺음", "미션 페이퍼가 열렸어요 ✉️", { conflict_id }),
      ]);
    }

    return json({ ok: true, ...mission });
  } catch (e) {
    console.error(e);
    return json({ error: errorMessage(e) }, 500);
  }
});
