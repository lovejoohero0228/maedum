// Edge Function 공용 헬퍼 — AI provider 추상화, Supabase 클라이언트, JSON 파싱, 푸시 알림
import OpenAI from "npm:openai";
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

// ── AI provider 선택 ──────────────────────────────────────────────
// AI_PROVIDER secret으로 OpenAI ↔ Anthropic(Claude)을 전환한다 (기본 openai).
// 크레딧이 있는 쪽으로 secret만 바꾸면 그 provider로 즉시 전환된다:
//   npx supabase secrets set AI_PROVIDER=anthropic
// 모델은 AI_MODEL_OPENAI / AI_MODEL_ANTHROPIC secret으로 덮어쓸 수 있다.
// 각 provider는 자기 키(OPENAI_API_KEY / ANTHROPIC_API_KEY)만 있으면 되고,
// 프롬프트(prompts/*.ts)는 provider-agnostic이라 그대로 쓴다.
export type AiProvider = "openai" | "anthropic";

export function aiProvider(): AiProvider {
  return Deno.env.get("AI_PROVIDER") === "anthropic" ? "anthropic" : "openai";
}

const DEFAULT_MODEL: Record<AiProvider, string> = {
  openai: "gpt-4o",
  anthropic: "claude-opus-4-8",
};

export function aiModel(): string {
  const provider = aiProvider();
  return (
    Deno.env.get(provider === "anthropic" ? "AI_MODEL_ANTHROPIC" : "AI_MODEL_OPENAI") ??
    DEFAULT_MODEL[provider]
  );
}

// 하위 호환용 상수 — 로그 표기에만 쓴다 (실제 모델은 aiModel()이 결정).
export const AI_MODEL = "provider-selected";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatResult {
  text: string;
  usage: { prompt: number; completion: number; total: number };
  model: string;
}

// provider-중립 채팅 호출. 시스템 프롬프트는 system으로 분리해서 넘긴다
// (OpenAI는 messages[0]에 role:system으로 합치고, Anthropic은 별도 system 파라미터로 보낸다).
// json=true면 OpenAI는 response_format:json_object를 켠다 (Anthropic은 프롬프트로 유도 —
// 우리 프롬프트가 이미 "JSON으로만 응답"을 지시하고 parseModelJson이 방어한다).
// messages는 system을 제외한 대화 배열(user/assistant 교대).
export async function chat(opts: {
  system: string;
  messages: ChatMessage[];
  maxTokens: number;
  json?: boolean;
}): Promise<ChatResult> {
  const model = aiModel();
  if (aiProvider() === "anthropic") {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
    const client = new Anthropic({ apiKey, maxRetries: 3, timeout: 60_000 });
    const res = await client.messages.create({
      model,
      max_tokens: opts.maxTokens,
      system: opts.system,
      messages: opts.messages.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
    });
    // 첫 text 블록을 꺼낸다 (thinking이 켜진 모델은 text가 첫 블록이 아닐 수 있음).
    const textBlock = res.content.find((b) => b.type === "text") as
      | { type: "text"; text: string }
      | undefined;
    return {
      text: (textBlock?.text ?? "").trim(),
      usage: {
        prompt: res.usage.input_tokens,
        completion: res.usage.output_tokens,
        total: res.usage.input_tokens + res.usage.output_tokens,
      },
      model,
    };
  }
  // OpenAI
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  const client = new OpenAI({ apiKey, maxRetries: 3, timeout: 45_000 });
  const res = await client.chat.completions.create({
    model,
    max_tokens: opts.maxTokens,
    ...(opts.json ? { response_format: { type: "json_object" as const } } : {}),
    messages: [
      { role: "system" as const, content: opts.system },
      ...opts.messages.map((m) => ({
        role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
        content: m.content,
      })),
    ],
  });
  const u = res.usage;
  return {
    text: (res.choices[0]?.message?.content ?? "").trim(),
    usage: {
      prompt: u?.prompt_tokens ?? 0,
      completion: u?.completion_tokens ?? 0,
      total: u?.total_tokens ?? (u?.prompt_tokens ?? 0) + (u?.completion_tokens ?? 0),
    },
    model,
  };
}

// chat() 결과의 토큰 사용량을 구조화 로그로 남긴다 (Supabase Function 로그에서
// "[usage]"로 grep 가능). label은 호출 지점(예: "ai-input:trigger_moment"),
// conflictId로 한 맺음의 총 사용량을 합산할 수 있다. 반환값(total)을 누적하면 맺음당 합계.
export function logUsage(label: string, conflictId: string | undefined, res: ChatResult): number {
  const { prompt, completion, total } = res.usage;
  console.log(
    `[usage] ${JSON.stringify({ label, conflict_id: conflictId ?? null, provider: aiProvider(), model: res.model, prompt, completion, total })}`,
  );
  return total;
}

// service_role 클라이언트 — RLS 우회 (conflict_outputs 쓰기 등 서버 전용 작업)
export function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

// 요청자의 JWT로 동작하는 클라이언트 — RLS 적용된 읽기/본인 확인용
export function userClient(req: Request) {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
  );
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// 에러를 사람이 읽을 문자열로 — OpenAI SDK의 APIError 같은 비-Error 객체를
// String()으로 감싸면 "[object Object]"가 되어 원인 파악이 불가능해진다.
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const m = (e as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
    try {
      return JSON.stringify(e);
    } catch {
      /* fallthrough */
    }
  }
  return String(e);
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// 모델 응답에서 JSON 오브젝트 추출 (```json 펜스/서두 텍스트 방어)
export function parseModelJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error(`model response is not JSON: ${text.slice(0, 200)}`);
  }
  return JSON.parse(candidate.slice(start, end + 1)) as T;
}

// Expo push — best effort (실패해도 플로우는 계속)
export async function sendPush(
  pushToken: string | null,
  title: string,
  body: string,
  data: Record<string, unknown> = {},
): Promise<void> {
  if (!pushToken) return;
  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: pushToken, title, body, data, sound: "default" }),
    });
  } catch (e) {
    console.error("push failed", e);
  }
}
