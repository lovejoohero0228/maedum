// 커플 단위 롤링 히스토리 요약 갱신
// 요청: { couple_id }
// 이 커플의 resolved 상태이면서 아직 요약에 통합되지 않은(history_merged_at IS NULL) 맺음들을
// 시간순으로 하나씩 기존 요약에 통합해 couples.history_summary를 갱신한다.
// - 맺음 마무리(resolve) 직후 클라이언트가 fire-and-forget으로 호출
// - 지난 기록 화면 진입 시에도 호출 (요약 도입 전의 기존 resolved 기록 소급 통합)
// - 통합할 것이 없으면 no-op — 반복 호출에 안전(멱등)
import {
  chat,
  adminClient,
  userClient,
  corsHeaders,
  json,
  errorMessage,
  logUsage,
} from "../_shared/utils.ts";
import { HISTORY_SUMMARY_SYSTEM } from "../../../prompts/history_summary.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { couple_id } = await req.json();

    // 본인이 이 커플의 멤버인지 확인 (RLS: couples는 멤버만 SELECT 가능)
    const supaUser = userClient(req);
    const { data: auth } = await supaUser.auth.getUser();
    if (!auth?.user) return json({ error: "unauthorized" }, 401);
    const { data: memberCheck } = await supaUser
      .from("couples")
      .select("id")
      .eq("id", couple_id)
      .maybeSingle();
    if (!memberCheck) return json({ error: "forbidden" }, 403);

    const admin = adminClient();

    const { data: pending } = await admin
      .from("conflicts")
      .select("id, title, created_at")
      .eq("couple_id", couple_id)
      .eq("status", "resolved")
      .is("history_merged_at", null)
      .order("created_at", { ascending: true });
    if (!pending || pending.length === 0) return json({ ok: true, merged: 0 });

    const { data: couple } = await admin
      .from("couples")
      .select("user_a_id, user_b_id, history_summary")
      .eq("id", couple_id)
      .single();
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, display_name")
      .in("id", [couple!.user_a_id, couple!.user_b_id]);
    const nameOf = (userId: string) =>
      profiles?.find((p) => p.id === userId)?.display_name ?? "상대";

    let summary: string = couple!.history_summary ?? "";
    let merged = 0;

    for (const conflict of pending) {
      const { data: inputs } = await admin
        .from("conflict_inputs")
        .select(
          "user_id, trigger_moment, context_tags, emotion_words, request_need, request_refined, my_reflection",
        )
        .eq("conflict_id", conflict.id);
      const { data: outputs } = await admin
        .from("conflict_outputs")
        .select("mission_a, mission_b, mindset_a, mindset_b")
        .eq("conflict_id", conflict.id)
        .maybeSingle();

      // 요약 재료가 아예 없는 기록(편지 생성 전에 마무리된 것)은 통합 없이 처리 표시만
      if (inputs && inputs.length > 0) {
        const record = JSON.stringify(
          {
            제목: conflict.title,
            날짜: conflict.created_at,
            입력: inputs.map((i) => ({ 이름: nameOf(i.user_id), ...i, user_id: undefined })),
            미션_A: outputs?.mission_a ?? null,
            미션_B: outputs?.mission_b ?? null,
            A이름: nameOf(couple!.user_a_id),
            B이름: nameOf(couple!.user_b_id),
          },
          null,
          2,
        );
        const system = HISTORY_SUMMARY_SYSTEM.replace(
          "{existing_summary}",
          summary || "(없음)",
        ).replace("{new_record}", record);
        const res = await chat({
          system,
          messages: [{ role: "user", content: "갱신된 누적 요약을 작성해주세요." }],
          maxTokens: 1024,
        });
        logUsage("ai-history", conflict.id, res);
        const text = res.text;
        if (!text) throw new Error("no summary text");
        summary = text;
        merged++;
      }

      const { error: markError } = await admin
        .from("conflicts")
        .update({ history_merged_at: new Date().toISOString() })
        .eq("id", conflict.id);
      if (markError) throw markError;
    }

    if (merged > 0) {
      const { error: updateError } = await admin
        .from("couples")
        .update({ history_summary: summary, history_updated_at: new Date().toISOString() })
        .eq("id", couple_id);
      if (updateError) throw updateError;
    }

    return json({ ok: true, merged });
  } catch (e) {
    console.error(e);
    return json({ error: errorMessage(e) }, 500);
  }
});
