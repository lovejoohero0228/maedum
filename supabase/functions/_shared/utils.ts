// Edge Function 공용 헬퍼 — Anthropic/Supabase 클라이언트, JSON 파싱, 푸시 알림
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

// AGENT.md §1: 모델은 claude-sonnet-4-6
export const CLAUDE_MODEL = "claude-sonnet-4-6";

export function anthropicClient(): Anthropic {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  return new Anthropic({ apiKey });
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
