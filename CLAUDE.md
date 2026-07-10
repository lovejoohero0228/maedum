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
2. **AI-guided input** — chat-style Socratic questioning collects 6 logical sections per user, each mapping to one or more `conflict_inputs` columns (mapping in `ai-input`'s `columnsForField`): `trigger_moment` (상황), `hurt_context` (→ first_hurt_moment + context_tags/detail), `feelings` (→ conflict/emotion scales + emotion_words), `request` (→ raw/need/refined), `partner_mind` (→ partner_intention + partner_perspective_words), `my_reflection`. The field sequence deliberately follows established conflict-analysis frameworks (spelled out in `prompts/input_guide.ts` §"갈등을 이해하는 틀"): NVC's 관찰→감정→욕구→요청 ordering, Positions-vs-Interests (`request_need` captures the interest behind the raw ask), Ladder of Inference (fact/interpretation separation during fact collection), and repeat-pattern + conflict-response-style capture in context. The AI re-questions on trigger patterns (e.g. "항상/맨날" pattern claims, intent assumptions, interpretation-stated-as-fact, vague requests, requests lacking a stated need) and returns a strict JSON envelope (`type`/`flag`/`message`/`choice_groups`/`extracted_value`/`field_complete`)
3. **Letters + analysis** — when both inputs complete (status → `ai_processing`), AI generates a refined letter per direction plus a neutral 3-part analysis (timing diff / temperature diff / mutual understanding), stored in `conflict_outputs` (status → `letters_delivered`)
4. **Mission paper** — unlocked when both users mark ready (`conflict_ready_states`); AI generates ~3 missions per person (`habit`/`acknowledge`/`action` types) and a 3-step conversation guide

Key mechanics:
- The `conflicts.status` enum drives the whole state machine; screens subscribe to Realtime `postgres_changes` on `conflict_inputs`, `conflicts`, and `conflict_ready_states` to react to the partner's progress (subscription snippets in AGENT.md §6).
- RLS: each user can read/write only their own `conflict_inputs`; the partner's content becomes visible only through `conflict_outputs` (writes to outputs are service_role/Edge-Function only).
- System prompts live in `prompts/` as plain TS constants — imported by the Deno Edge Functions via relative paths (`../../../prompts/*.ts`). Keep them dependency-free.
- **Static (no-AI) turns**: questions whose content never depends on the situation are served by fixed rules in `prompts/static_turns.ts` — currently the entire `feelings` field (two 1–10 scales + emotion words from the reference bank), including rule-based answer extraction, so that field costs zero AI calls. The AI-side goal text in `input_guide.ts` stays as a fallback for when rule extraction fails.
- **Hybrid turns (partial-static groups)**: `staticGroupsFor(fieldKey)` returns fixed groups the server appends to the AI's first-turn envelope — currently `hurt_context` (반복 여부 single-select + 나의 반응/상대의 반응), so the AI only generates the contextual first_hurt group (or none, when trigger_moment already covered it) and its goal text forbids recreating the fixed groups (with a dedup safety net in `generateEnvelope`). Completion synthesis/re-questioning stays with the AI. Note: the reference bank's `context_tags` candidates are no longer consumed by `hurt_context` (tags are synthesized from the fixed-group answers).
- **Choice-group metadata**: `choice_groups` entries carry `select: 'single'|'multi'`, `kind: 'scale'|'list'`, `allow_none`, `allow_custom` (defaulted in `ai-input`'s `normalizeEnvelope`; the AI is only taught `select`). The client renders `kind: 'scale'` with `components/chat/ScaleSelector.tsx` (numeric 1–10, single-select, no 해당 없음/직접 입력), honors single-select, and only appends "해당 없음"/직접 입력 when allowed.
- **Next-question piggyback**: when a field completes, `ai-input` generates the next field's first question inside the same response (`next_question`) — and if that next field is already fully covered by earlier conversation, it saves the 0-turn completion and keeps chaining (`skipped` carries those completion messages). The client (`input.tsx` `handleResponse`) applies these without extra round trips and falls back to `startField` when `next_question` is absent.
- All AI calls happen in `supabase/functions/` (Deno): `ai-input` (stage-02 chat requestioning, returns the JSON envelope and persists extracted fields into `conflict_inputs` columns), `ai-letters` (both letters + analysis in parallel, service_role-only, triggered by `ai-input` when both inputs complete), `ai-mission` (mission paper, idempotent, called by the client whose ready press makes two). Model: `gpt-4o` via `openai.chat.completions.create` with `response_format: {type: "json_object"}` wherever the prompt expects JSON (not used for the plain-text letter generation calls).
- Client AI access goes through `lib/ai.ts`, a thin wrapper over `supabase.functions.invoke` — there is no client-side AI SDK of any kind.
- **Cross-conflict memory is a couple-level rolling summary** (`couples.history_summary`, ≤500 chars): the `ai-history` function folds each resolved conflict into an update-rewritten summary (`conflicts.history_merged_at` marks merged rows; idempotent, backfills chronologically). It's the ONLY past-conflict context the AI ever sees — raw past conflicts are never passed, so context stays bounded regardless of how many conflicts accumulate. Fed to ai-input (relationship context), ai-letters (analysis call), and ai-mission. Triggered fire-and-forget on resolve (mission.tsx) and on opening the history screen.
- `store/conflictStore.ts` (Zustand) holds session/profile/couple/conflict/outputs; user A renders blue, user B coral (`myColor()`).
- Couple pairing uses invite codes: `couple_invites` table + `accept_couple_invite()` SECURITY DEFINER function (not in AGENT.md — added for Phase 1 "커플 연결").
- **Small missions** (migration 013, not in AGENT.md): `ai-mission` now also generates `small_mission_a/b` (exactly 2 per person — "오늘 바로, 5분 안에" one-message/one-tiny-action tier, prompt rules in `prompts/mission.ts`) alongside the existing 3 big missions. Stored as new `conflict_outputs` columns; rendered as a tinted "오늘 바로" block at the top of each `MissionPaper` column with big missions under "천천히 이어가기". Idempotency and the client's `missionReady` both require `small_mission_a`, so pre-013 mission records auto-regenerate on view (same pattern as the mindset re-format).
- **Mediator character "매듭이"** (not in AGENT.md): the AI mediator is personified as 매듭이, a ball-of-yarn character that ties two loose threads (= the app name 맺음). All user-facing copy says 매듭이 instead of "AI" (chat typing indicator, start/waiting/letter/mission screens, `ai_processing` status label, analysis section title "매듭이가 정리한 우리 이야기"), `AIChatBubble` shows a small 매듭이 name label on the first bubble of each assistant run (`showName` prop; the amber marker dot is the placeholder for the future character image), and `prompts/input_guide.ts` tells the model its name/persona (introduce sparingly, don't repeat every turn). Character art lives at `assets/images/maedeubi*.png` (512px squares, cream bg that blends with `colors.bg`; source art `매듭이*.png` at repo root, untracked) rendered via `components/ui/Maedeubi.tsx` (circular mask, optional `breathe` scale-pulse animation, and a `variant` prop — base/think/letter/question/celebrate/comfort — mapped per scene: question→chat bubbles, think→typing + all generation waits, letter→letter loading, comfort→waiting-for-partner + convo-guide note, celebrate→mission paper title, connect (tying the blue/coral user-color threads, the brand key visual)→login hero + home headline + pair screen) — used in chat bubbles (28px marker), typing indicator, start/login heroes, waiting/mission/relationship-profile loading states, and the analysis section titles in letter/record. Letters remain in the partner's voice — never 매듭이's.
- **Home mission board + per-conflict summary** (migration 014, not in AGENT.md): `conflicts.summary` (≤3-sentence neutral recap, generated by `ai-letters` in the same analysis call as `title` — both non-fatal if the model omits them) and `conflict_outputs.mission_both` (1–2 "둘이 함께" missions, generated/validated/persisted by `ai-mission` like the other arrays; also rendered as a full-width card in `MissionPaper` and included in `missionReady`/idempotency so pre-014 records regenerate). Home shows a `components/home/MissionBoard.tsx` section ("우리가 이어가는 노력") between the headline and the CTA — my/partner big missions side-by-side in user colors + 둘이 함께 below, aggregated newest-first (3 per person / 2 both) via `getOngoingMissions(coupleId)` in `services/missionService.ts` (joins `conflicts` in status mission_unlocked/resolved with their outputs). "자세히 보기" → `app/(main)/missions.tsx`, grouped per 맺음 with date/title/summary and a link into the full record screen. home.tsx body is now a ScrollView to fit the board. `profiles` gained `personality_tags TEXT[]`, `character_key` (preset key from `constants/characters.ts` — emoji animal "내 캐릭터"), `onboarded_at`. `app/(main)/profile-setup.tsx` is a 3-step flow (이름 → 성격 태그(reuses `PERSONALITY_TAGS`) → 캐릭터); the `(main)/_layout` guard redirects any session whose loaded profile has `onboarded_at IS NULL` there (no backfill — existing users pass through it once). Also reachable as an editor from profile.tsx (me-card is now pressable, shows character emoji + tags). Distinct from the per-couple `relationship_profiles.my_personality_tags`.
- **Social login (Kakao/Google)** (not in AGENT.md): `lib/socialAuth.ts` + `components/auth/SocialLoginButtons.tsx` on login/register. Supabase client now uses `flowType: 'pkce'` and `detectSessionInUrl` only on web. Native flow: `signInWithOAuth({skipBrowserRedirect: true})` → `expo-web-browser` auth session → deep link `maedum://auth-callback` → `exchangeCodeForSession`. `handle_new_user()` trigger now falls back to `full_name`/`name` metadata for the initial display_name. **Requires one-time Supabase dashboard setup** (Authentication → Providers): enable Kakao (REST API key + Client Secret from developers.kakao.com, redirect `https://vkjcevzbheurqnpeuavs.supabase.co/auth/v1/callback`) and Google (OAuth client from Google Cloud Console, same callback), and add `maedum://auth-callback` to Authentication → URL Configuration → Redirect URLs. Until then the buttons will error with "provider is not enabled".
- **Partner nickname & home background** (migration 012, not in AGENT.md): the relationship-profile flow is 6 steps — step 2 collects 내 이름 (saved back to `profiles.display_name`) + `relationship_profiles.partner_nickname`, step 6 picks `relationship_profiles.home_background` (`preset:<key>` from `constants/homeBackgrounds.ts` or `url:<public URL>` uploaded via expo-image-picker to the public `backgrounds` storage bucket, per-user-folder write RLS). `ai-letters` opens each letter with the sender's nickname for the receiver (fallback: receiver's display_name); home.tsx renders the active couple's background in the top `Wash` area (custom gradient stops or cover image with cream fade).

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
