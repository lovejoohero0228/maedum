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
