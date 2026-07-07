// 관계 프로필 기반 개인화 레퍼런스 뱅크 생성
// 트리거: 관계 프로필 설정/수정 화면에서 완료 시 클라이언트가 호출
// 요청: { profile_id } — 호출자 본인 소유의 relationship_profiles.id
// → OpenAI로 reference_bank 생성 → relationship_profiles 갱신
import {
  openaiClient,
  adminClient,
  userClient,
  AI_MODEL,
  corsHeaders,
  json,
  parseModelJson,
} from "../_shared/utils.ts";
import { REFERENCE_BANK_SYSTEM } from "../../../prompts/reference_bank.ts";

interface ReferenceBank {
  trigger_categories: string[];
  context_tags: string[];
  emotion_words: Record<string, string[]>;
  partner_perspective_words: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { profile_id } = await req.json();

    const supaUser = userClient(req);
    const { data: auth } = await supaUser.auth.getUser();
    if (!auth?.user) return json({ error: "unauthorized" }, 401);

    const admin = adminClient();

    const { data: profile } = await admin
      .from("relationship_profiles")
      .select("*")
      .eq("id", profile_id)
      .single();
    if (!profile) return json({ error: "profile not found" }, 404);
    if (profile.user_id !== auth.user.id) return json({ error: "forbidden" }, 403);

    const context = JSON.stringify(
      {
        관계유형: profile.relationship_type,
        사귄기간_개월: profile.relationship_duration_months,
        내_성격: profile.my_personality_tags,
        내가_보는_상대_성격: profile.partner_personality_tags,
        자주_부딪히는_주제: profile.frequent_conflict_topics,
      },
      null,
      2,
    );

    const openai = openaiClient();
    const res = await openai.chat.completions.create({
      model: AI_MODEL,
      max_tokens: 2048,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: REFERENCE_BANK_SYSTEM.replace("{relationship_context}", context) },
        { role: "user", content: "레퍼런스 뱅크를 생성해주세요." },
      ],
    });

    const content = res.choices[0]?.message?.content;
    if (!content) throw new Error("no reference bank text");
    const bank = parseModelJson<Partial<ReferenceBank>>(content);
    if (
      !Array.isArray(bank.trigger_categories) ||
      !Array.isArray(bank.context_tags) ||
      typeof bank.emotion_words !== "object" ||
      bank.emotion_words === null ||
      !Array.isArray(bank.partner_perspective_words)
    ) {
      throw new Error(`reference bank response missing required fields: ${JSON.stringify(bank)}`);
    }

    const { error: updateError } = await admin
      .from("relationship_profiles")
      .update({ reference_bank: bank, reference_bank_generated_at: new Date().toISOString() })
      .eq("id", profile_id);
    if (updateError) throw updateError;

    return json({ ok: true, reference_bank: bank });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
