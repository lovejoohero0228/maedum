# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project State

**맺음 (Maedum)** — an AI mediation app that helps couples resolve conflicts. Phase 1 (core flow) is implemented as an Expo SDK 57 app with a Supabase backend.

- `AGENT.md` — the authoritative implementation spec (Korean). It contains the complete data model, service flow, AI prompt designs, component specs, and design tokens. When AGENT.md and this file disagree, AGENT.md wins.
- `prototype/` — UI mockup images for each screen (home, input, letter, mission).

## Commands

```bash
npm run typecheck        # tsc --noEmit (excludes supabase/functions — those are Deno)
npm start                # expo start (dev server)
npm run android|ios|web  # platform-specific dev
npx expo export --platform web   # bundle smoke test

# Backend (Supabase CLI is a devDependency — use npx)
npx supabase db push                          # apply supabase/migrations/
npx supabase functions serve                  # run edge functions locally (needs Deno)
npx supabase functions deploy ai-input ai-letters ai-mission
npx supabase secrets set OPENAI_API_KEY=sk-...
```

Env setup: copy `.env.example` → `.env.local` and fill in the Supabase URL/anon key. `OPENAI_API_KEY` lives only in Edge Function secrets, never in the client.

## Supabase Project

- **Project ref**: `vkjcevzbheurqnpeuavs`
- **URL**: `https://vkjcevzbheurqnpeuavs.supabase.co`
- **Publishable (anon) key**: `sb_publishable_Rmo1-y4uBpuDimtAmkgdDQ_XG2Ji6rw`

These two values are also in `.env.local` (gitignored) — recorded here too since this file persists across sessions. This key is safe to keep in a committed file: Supabase's "publishable" key is designed for client exposure and is gated entirely by the RLS policies in `supabase/migrations/001_initial.sql`, unlike the database password or the "secret"/service-role key.

**Never add the database password, the service-role/secret key, or `OPENAI_API_KEY` to this file** — CLAUDE.md is committed to git. Those go in `.env.local` (gitignored, client env only — and note `OPENAI_API_KEY` doesn't belong there either, only in Edge Function secrets) or `supabase secrets set` (server-side, encrypted, Edge Functions only).

## Core Philosophy (from AGENT.md — governs all implementation decisions)

- AI is a mediator, not a judge — it never decides who is at fault.
- Apologies and reconciliation happen only between the two people; AI-generated letters must **never contain apology phrases** ("미안해", "잘못했어").
- The app's core value is translating vague raw emotion into concrete, deliverable language (specific requests down to the actual sentence to say).

## Tech Stack

- **Frontend**: React Native (Expo, Expo Router) — screens under `app/`, state via Zustand
- **Backend**: Supabase (PostgreSQL + Realtime + Auth + Storage + Edge Functions)
- **AI**: OpenAI API (`gpt-4o`) — called **server-side only** via Supabase Edge Functions; `OPENAI_API_KEY` must never reach the client. AGENT.md §1 originally specified Anthropic Claude (`claude-sonnet-4-6`); switched to OpenAI because the Anthropic account ran out of credits mid-build. The system prompts in `prompts/` are provider-agnostic and didn't need to change — only the Edge Function client code (`supabase/functions/_shared/utils.ts` + the three function `index.ts` files) and `lib/ai.ts`'s doc comment. Switch back by reverting those files if Anthropic credits are restored.
- **Push**: Expo Notifications

## Architecture Overview

The app is a 4-stage flow between two paired users (a couple), synchronized via Supabase Realtime:

1. **Start** — one user initiates a conflict session; partner is notified (status: `waiting_partner` → `both_inputting`)
2. **AI-guided input** — chat-style Socratic questioning collects 9 structured fields per user (`trigger_moment`, `first_hurt_moment`, context, scales, `emotion_words`, request — raw/need/refined, `partner_intention`, `partner_perspective_words`, `my_reflection`). The field sequence deliberately follows established conflict-analysis frameworks (spelled out in `prompts/input_guide.ts` §"갈등을 이해하는 틀"): NVC's 관찰→감정→욕구→요청 ordering, Positions-vs-Interests (`request_need` captures the interest behind the raw ask), Ladder of Inference (fact/interpretation separation during fact collection), and repeat-pattern + conflict-response-style capture in context. The AI re-questions on trigger patterns (e.g. "항상/맨날" pattern claims, intent assumptions, interpretation-stated-as-fact, vague requests, requests lacking a stated need) and returns a strict JSON envelope (`type`/`flag`/`message`/`choice_groups`/`extracted_value`/`field_complete`)
3. **Letters + analysis** — when both inputs complete (status → `ai_processing`), AI generates a refined letter per direction plus a neutral 3-part analysis (timing diff / temperature diff / mutual understanding), stored in `conflict_outputs` (status → `letters_delivered`)
4. **Mission paper** — unlocked when both users mark ready (`conflict_ready_states`); AI generates ~3 missions per person (`habit`/`acknowledge`/`action` types) and a 3-step conversation guide

Key mechanics:
- The `conflicts.status` enum drives the whole state machine; screens subscribe to Realtime `postgres_changes` on `conflict_inputs`, `conflicts`, and `conflict_ready_states` to react to the partner's progress (subscription snippets in AGENT.md §6).
- RLS: each user can read/write only their own `conflict_inputs`; the partner's content becomes visible only through `conflict_outputs` (writes to outputs are service_role/Edge-Function only).
- System prompts live in `prompts/` as plain TS constants — imported by the Deno Edge Functions via relative paths (`../../../prompts/*.ts`). Keep them dependency-free.
- All AI calls happen in `supabase/functions/` (Deno): `ai-input` (stage-02 chat requestioning, returns the JSON envelope and persists extracted fields into `conflict_inputs` columns), `ai-letters` (both letters + analysis in parallel, service_role-only, triggered by `ai-input` when both inputs complete), `ai-mission` (mission paper, idempotent, called by the client whose ready press makes two). Model: `gpt-4o` via `openai.chat.completions.create` with `response_format: {type: "json_object"}` wherever the prompt expects JSON (not used for the plain-text letter generation calls).
- Client AI access goes through `lib/ai.ts`, a thin wrapper over `supabase.functions.invoke` — there is no client-side AI SDK of any kind.
- `store/conflictStore.ts` (Zustand) holds session/profile/couple/conflict/outputs; user A renders blue, user B coral (`myColor()`).
- Couple pairing uses invite codes: `couple_invites` table + `accept_couple_invite()` SECURITY DEFINER function (not in AGENT.md — added for Phase 1 "커플 연결").

## Known deviations from AGENT.md

- **AI provider is OpenAI (`gpt-4o`), not Anthropic Claude.** See Tech Stack above for why and how to revert.
- Stage-02 responses are non-streaming: the AI returns a whole JSON envelope, so partial streaming has nothing useful to render.
- `waiting.tsx`/`mission.tsx` add a polling fallback next to Realtime subscriptions.
- Edge Functions were verified live against the deployed project (see below), not via `supabase functions serve` — Deno isn't installed on this machine.

## Verified live (2026-07-06)

Full backend verified end-to-end against the real Supabase project with temporary test accounts (`mailer_autoconfirm` was temporarily enabled for this, then reverted to `false` — real users must confirm their email again): signup → profile auto-creation trigger → invite-code pairing (`accept_couple_invite`) → conflict start/join → full 7-field `ai-input` conversation for both users, including its re-questioning behavior firing correctly (asked for a direct quote on a vague trigger_moment answer, asked for feelings when only actions were listed, asked for a second concrete example on a vague context claim — all per the trigger rules in `prompts/input_guide.ts`) → automatic `ai-letters` trigger on both-complete → both letters verified in-tone, correct length (~300 chars), zero apology phrases, correct structure → analysis verified non-judgmental with a hopeful closing → both `conflict_ready_states` → `ai-mission` → mission paper + 3-step convo guide + convo_note all verified well-formed and on-spec.

**Bug found and fixed during this test:** OpenAI's `response_format: {type: "json_object"}` guarantees valid JSON but not schema conformance — unlike Claude, gpt-4o would sometimes omit required keys entirely (`ai-input` dropped `extracted_value`/`field_complete` on one turn) or echo a schema field's *description* as its literal *value* (`ai-mission`'s `convo_note` came back as the placeholder text "면책 문구 — 먼저 다가가는 것이 책임의 크기가 아님을 설명" verbatim on one run). Fixed by: (1) defaulting missing `GuideEnvelope` keys in `ai-input` to safe values (`field_complete: false`, etc. — a missing key legitimately means "not done yet"), (2) explicit runtime validation in `ai-letters`/`ai-mission` that throws (retryable 500) if a required section/array is missing, and (3) rewording the JSON schema examples in `prompts/mission.ts` and `prompts/analysis.ts` to explicitly say the bracketed/quoted text is a description of what to write, not literal output to copy. If migrating back to Claude, these hardening changes are safe to keep (Claude is less prone to this but not immune) — only the client construction in `_shared/utils.ts` and the three function bodies would need to revert.

## Conventions

- User A theme is blue, user B is coral, AI is purple, success is teal, warnings amber — exact hex tokens in AGENT.md §8
- Fonts: NotoSerifKR (display) / NotoSansKR (body)
- Letters use friendly 반말 tone, 200–350 chars, fixed structure (context → hurt reason → understanding → request → reflection)
- Analysis and mission outputs are structured JSON with schemas fixed in AGENT.md §5

## Environment

Windows 11 with Git Bash. Expected env vars (`.env.local`): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_APP_ENV`. `OPENAI_API_KEY` is Edge Function secret only — never in `.env.local`.
