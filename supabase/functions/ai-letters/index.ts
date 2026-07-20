// 03단계: AI 우체통 + 분석 생성 (AGENT.md §4-3, §5-2, §5-3)
// 트리거: 양쪽 모두 is_complete → ai-input이 service_role로 호출
// 요청: { conflict_id }
// 1. letter_a_to_b: A의 입력으로 B가 읽을 편지 정제
// 2. letter_b_to_a: B의 입력으로 A가 읽을 편지 정제
// 3. 분석: 양쪽 입력 모두로 중재자 분석
// → conflict_outputs 저장 → status 'letters_delivered' → 양쪽 푸시
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
  emotion_words: string[] | null;
  partner_perspective_words: string[] | null;
  request_raw: string | null;
  request_need: string | null;
  request_refined: string | null;
  partner_intention: string | null;
  my_reflection: string | null;
}

function inputSummary(row: InputRow, name: string, partnerName: string): string {
  return JSON.stringify(
    {
      작성자: name,
      "상대 호칭": partnerName,
      trigger_moment: row.trigger_moment,
      first_hurt_moment: row.first_hurt_moment,
      context_tags: row.context_tags,
      context_detail: row.context_detail,
      conflict_scale: row.conflict_scale,
      emotion_scale: row.emotion_scale,
      emotion_words: row.emotion_words,
      partner_perspective_words: row.partner_perspective_words,
      request_raw: row.request_raw,
      request_need: row.request_need,
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
    const { conflict_id } = await req.json();
    const admin = adminClient();

    const { data: conflict } = await admin
      .from("conflicts")
      .select("id, couple_id")
      .eq("id", conflict_id)
      .single();
    if (!conflict) return json({ error: "conflict not found" }, 404);

    const { data: couple } = await admin
      .from("couples")
      .select("user_a_id, user_b_id, history_summary")
      .eq("id", conflict.couple_id)
      .single();
    if (!couple) return json({ error: "couple not found" }, 404);

    // 호출 권한: service_role(ai-input 내부 호출) 또는 이 커플의 당사자.
    // 당사자 호출을 허용하는 이유 — 자동 트리거가 실패해 ai_processing에 갇혔을 때
    // waiting 화면의 "다시 시도"가 이 함수를 멱등 재호출할 수 있어야 한다.
    const authHeader = req.headers.get("Authorization") ?? "";
    const isService = authHeader.includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    if (!isService) {
      const { data: auth } = await userClient(req).auth.getUser();
      const uid = auth?.user?.id;
      if (!uid || (uid !== couple.user_a_id && uid !== couple.user_b_id)) {
        return json({ error: "forbidden" }, 403);
      }
      // 당사자 재시도는 양쪽 입력이 모두 완료된 뒤에만 의미가 있다
    }

    // 이미 생성됐으면 멱등 반환
    const { data: existing } = await admin
      .from("conflict_outputs")
      .select("id")
      .eq("conflict_id", conflict_id)
      .maybeSingle();
    if (existing) return json({ ok: true, already: true });

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

    // 발신자가 상대를 부르는 별칭 (관계 프로필) — 편지 서두 호칭에 사용, 없으면 상대 이름
    const { data: rps } = await admin
      .from("relationship_profiles")
      .select("user_id, partner_nickname")
      .eq("couple_id", conflict.couple_id);
    const nicknameBy = (userId: string) =>
      rps?.find((r) => r.user_id === userId)?.partner_nickname?.trim() || null;
    const callBtoA = nicknameBy(couple.user_a_id) ?? profileB.display_name; // A가 B를 부르는 호칭
    const callAtoB = nicknameBy(couple.user_b_id) ?? profileA.display_name; // B가 A를 부르는 호칭

    // 편지: 발신자 입력 → 수신자가 읽는 텍스트 (AGENT.md 스키마 주석: letter_a_to_b = A→B)
    async function refineLetter(senderInput: InputRow, senderName: string, receiverName: string) {
      const { systemStable, system } = cacheableSystem(
        LETTER_REFINE_SYSTEM,
        "{input_data}",
        inputSummary(senderInput, senderName, receiverName),
      );
      const res = await chat({
        systemStable,
        system,
        messages: [{ role: "user", content: "상대에게 전달할 편지를 작성해주세요." }],
        maxTokens: 2048,
        tier: "quality",
      });
      logUsage(`ai-letters:letter:${senderName}`, conflict_id, res);
      const text = res.text;
      if (!text) throw new Error("no letter text");
      return text.trim();
    }

    // 분석: 양쪽 입력 → JSON 3섹션
    async function generateAnalysis() {
      const historySection = couple.history_summary
        ? `\n\n## 지난 맺음 누적 요약 (반복 패턴 참고용)\n${couple.history_summary}`
        : "";
      const both = `## A (${profileA.display_name})\n${inputSummary(inputA, profileA.display_name, profileB.display_name)}\n\n## B (${profileB.display_name})\n${inputSummary(inputB, profileB.display_name, profileA.display_name)}${historySection}`;
      const { systemStable, system } = cacheableSystem(ANALYSIS_SYSTEM, "{both_inputs}", both);
      const res = await chat({
        systemStable,
        system,
        messages: [{ role: "user", content: "두 사람의 갈등 구조를 분석해주세요." }],
        maxTokens: 4096,
        json: true,
        tier: "quality",
      });
      logUsage("ai-letters:analysis", conflict_id, res);
      const content = res.text;
      if (!content) throw new Error("no analysis text");
      const parsed = parseModelJson<{
        title?: unknown;
        summary?: unknown;
        timing?: unknown;
        temperature?: unknown;
        understanding?: unknown;
      }>(content);
      // json_object 모드는 스키마 준수를 보장하지 않으므로 필수 섹션 누락을 명시적으로 검증
      // (title/summary는 목록 표시용 부가 정보라 누락돼도 실패시키지 않는다)
      if (!parsed.timing || !parsed.temperature || !parsed.understanding) {
        throw new Error(`analysis missing required section(s): ${JSON.stringify(parsed)}`);
      }
      return parsed as {
        title?: unknown;
        summary?: unknown;
        timing: unknown;
        temperature: unknown;
        understanding: unknown;
      };
    }

    // 세 호출은 서로 독립 — 병렬 실행
    const [letterAtoB, letterBtoA, analysis] = await Promise.all([
      refineLetter(inputA, profileA.display_name, callBtoA),
      refineLetter(inputB, profileB.display_name, callAtoB),
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
      .update({
        status: "letters_delivered",
        title: typeof analysis.title === "string" && analysis.title.trim() ? analysis.title.trim() : null,
        summary:
          typeof analysis.summary === "string" && analysis.summary.trim()
            ? analysis.summary.trim()
            : null,
      })
      .eq("id", conflict_id);

    await Promise.all([
      sendPush(profileA.push_token, "맺음", "편지가 도착했어요 💌", { conflict_id }),
      sendPush(profileB.push_token, "맺음", "편지가 도착했어요 💌", { conflict_id }),
    ]);

    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ error: errorMessage(e) }, 500);
  }
});
