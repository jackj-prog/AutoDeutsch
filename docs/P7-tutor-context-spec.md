# P7 (increment 1) — Context-aware AI Tutor

## Problem
The Tutor's system prompt (`TUTOR_SYSTEM`) is **static**: it hardcodes "about B1 level — an
electrical engineer relocating", which is now stale and impersonal. The journey transformation gave
every learner real data — a CEFR level, a relocation goal, a current mission/scenario, and a set of
weak words — but none of it reaches the Tutor. The chat feels generic.

## Goal
Make the Tutor know **who it's talking to**, using only data already in the app (no new inputs, no
extra network calls). Additive and low-risk — it changes the system prompt + starter chips, nothing
about the chat mechanics or BYO-key flow.

## What it injects (all already computed)
- **Level** — `deepStats.currentLevel` (pitch the German to it), replacing the hardcoded B1.
- **Goal / place** — `intakeAns.goal` + `intakeAns.country` from the placement intake (now rehydrated
  from `ad-placement-v1` on load, not just held in onboarding state).
- **Stage** — `capability.role.name` (Newcomer → Settling in → Resident → Local).
- **Current scenario** — `currentMission.cando` (the mission the journey nudges next) — the Tutor can
  offer to role-play it.
- **Weak words** — top few of `weakPreview` — woven in naturally when relevant.

## Changes
1. `intakeAns` init rehydrates from `ad-placement-v1.intake`.
2. `tutorContext` (memo): `{ level, goal, country, role, mission, weak[] }`.
3. `buildTutorSystem(ctx)`: personalized system prompt (keeps the original guidelines).
4. `sendTutor` uses `buildTutorSystem(tutorContext)` instead of the static `TUTOR_SYSTEM`.
5. Tutor starter chips become **data-driven**: role-play the current scenario; practise the weak
   words; plus one open prompt. Falls back to generic starters when there's no mission/weak data yet.

## Out of scope (later increments)
Tool-use / function calling, the Tutor launching drills, streaming responses, conversation memory
across sessions beyond the existing 40-message localStorage buffer.
