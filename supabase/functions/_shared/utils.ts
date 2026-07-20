// Edge Function 공용 헬퍼 — OpenAI/Supabase 클라이언트, JSON 파싱, 푸시 알림
import OpenAI from "npm:openai";
import { createClient } from "npm:@supabase/supabase-js@2";

// AI 제공자: OpenAI (원래 AGENT.md §1은 Anthropic Claude였으나 계정 크레딧 문제로 전환)
export const AI_MODEL = "gpt-4o";

export function openaiClient(): OpenAI {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  // 동시 접속 시 429(rate limit)가 그대로 사용자 실패로 노출되지 않도록
  // SDK 내장 지수 백오프 재시도 + 요청 타임아웃을 켠다.
  // Edge Function wall-clock 한도(150s) 안에서 재시도까지 끝나도록 잡은 값.
  return new OpenAI({ apiKey, maxRetries: 3, timeout: 45_000 });
}

// OpenAI 응답의 토큰 사용량을 구조화 로그로 남긴다 (Supabase Function 로그에서
// "[usage]"로 grep 가능). label은 호출 지점(예: "ai-input:trigger_moment"),
// conflictId로 한 맺음의 총 사용량을 합산할 수 있다.
// 반환값(total_tokens)을 호출부에서 누적하면 맺음당 합계도 낼 수 있다.
export function logUsage(
  label: string,
  conflictId: string | undefined,
  res: { usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null },
): number {
  const u = res.usage;
  const prompt = u?.prompt_tokens ?? 0;
  const completion = u?.completion_tokens ?? 0;
  const total = u?.total_tokens ?? prompt + completion;
  console.log(
    `[usage] ${JSON.stringify({ label, conflict_id: conflictId ?? null, model: AI_MODEL, prompt, completion, total })}`,
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
