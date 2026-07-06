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

# Backend (requires Supabase CLI, not installed by default on this machine)
supabase db push                          # apply supabase/migrations/
supabase functions serve                  # run edge functions locally (needs Deno)
supabase functions deploy ai-input ai-letters ai-mission
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

Env setup: copy `.env.example` → `.env.local` and fill in the Supabase URL/anon key. `ANTHROPIC_API_KEY` lives only in Edge Function secrets, never in the client.

## Core Philosophy (from AGENT.md — governs all implementation decisions)

- AI is a mediator, not a judge — it never decides who is at fault.
- Apologies and reconciliation happen only between the two people; AI-generated letters must **never contain apology phrases** ("미안해", "잘못했어").
- The app's core value is translating vague raw emotion into concrete, deliverable language (specific requests down to the actual sentence to say).

## Tech Stack (planned)

- **Frontend**: React Native (Expo, Expo Router) — screens under `app/`, state via Zustand
- **Backend**: Supabase (PostgreSQL + Realtime + Auth + Storage + Edge Functions)
- **AI**: Anthropic Claude API — called **server-side only** via Supabase Edge Functions; `ANTHROPIC_API_KEY` must never reach the client
- **Push**: Expo Notifications

## Architecture Overview

The app is a 4-stage flow between two paired users (a couple), synchronized via Supabase Realtime:

1. **Start** — one user initiates a conflict session; partner is notified (status: `waiting_partner` → `both_inputting`)
2. **AI-guided input** — chat-style Socratic questioning collects 7 structured fields per user (`trigger_moment`, `first_hurt_moment`, context, scales, `request_refined`, `partner_intention`, `my_reflection`). The AI re-questions on trigger patterns (e.g. "항상/맨날" pattern claims, intent assumptions, vague requests) and returns a strict JSON envelope (`type`/`flag`/`message`/`choices`/`extracted_value`/`field_complete`)
3. **Letters + analysis** — when both inputs complete (status → `ai_processing`), AI generates a refined letter per direction plus a neutral 3-part analysis (timing diff / temperature diff / mutual understanding), stored in `conflict_outputs` (status → `letters_delivered`)
4. **Mission paper** — unlocked when both users mark ready (`conflict_ready_states`); AI generates ~3 missions per person (`habit`/`acknowledge`/`action` types) and a 3-step conversation guide

Key mechanics:
- The `conflicts.status` enum drives the whole state machine; screens subscribe to Realtime `postgres_changes` on `conflict_inputs`, `conflicts`, and `conflict_ready_states` to react to the partner's progress (subscription snippets in AGENT.md §6).
- RLS: each user can read/write only their own `conflict_inputs`; the partner's content becomes visible only through `conflict_outputs` (writes to outputs are service_role/Edge-Function only).
- System prompts live in `prompts/` as plain TS constants — imported by the Deno Edge Functions via relative paths (`../../../prompts/*.ts`). Keep them dependency-free.
- All Claude API calls happen in `supabase/functions/` (Deno): `ai-input` (stage-02 chat requestioning, returns the JSON envelope and persists extracted fields into `conflict_inputs` columns), `ai-letters` (both letters + analysis in parallel, service_role-only, triggered by `ai-input` when both inputs complete), `ai-mission` (mission paper, idempotent, called by the client whose ready press makes two). Model: `claude-sonnet-4-6`; thinking disabled for the chat loop (latency), adaptive for generation.
- Client AI access goes through `lib/anthropic.ts`, a thin wrapper over `supabase.functions.invoke` — there is no client-side Anthropic SDK.
- `store/conflictStore.ts` (Zustand) holds session/profile/couple/conflict/outputs; user A renders blue, user B coral (`myColor()`).
- Couple pairing uses invite codes: `couple_invites` table + `accept_couple_invite()` SECURITY DEFINER function (not in AGENT.md — added for Phase 1 "커플 연결").

## Known deviations from AGENT.md

- Stage-02 responses are non-streaming: the AI returns a whole JSON envelope, so partial streaming has nothing useful to render.
- `waiting.tsx`/`mission.tsx` add a polling fallback next to Realtime subscriptions.
- Edge Functions are unverified locally (no Deno/Supabase CLI on this machine); verify with `supabase functions serve` before first deploy.

## Conventions

- User A theme is blue, user B is coral, AI is purple, success is teal, warnings amber — exact hex tokens in AGENT.md §8
- Fonts: NotoSerifKR (display) / NotoSansKR (body)
- Letters use friendly 반말 tone, 200–350 chars, fixed structure (context → hurt reason → understanding → request → reflection)
- Analysis and mission outputs are structured JSON with schemas fixed in AGENT.md §5

## Environment

Windows 11 with Git Bash. Expected env vars (`.env.local`): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY` (Edge Functions only), `EXPO_PUBLIC_APP_ENV`.
