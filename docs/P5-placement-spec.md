# P5 — Narrative onboarding + 2-min placement (data + spec)

Status: **data ready → app build pending**. Source: Journey Transformation Plan (P5) in `ROADMAP.md`.
Goal: replace the 3-field config onboarding with a short narrative intake + a ~2-minute CEFR placement
that ends in a **personalized roadmap** ("Here's your path to working in Berlin"). This doc covers the
**data** (shipped in `src/data.js` as `PLACEMENT`) and the **scoring + wiring** the app should implement.

This is split by lane: the **content + data + scoring spec is the content lane** (this file + `PLACEMENT`);
the **intake/placement/roadmap UI is `src/app.jsx`** (single-writer — the app.jsx owner builds it). Nothing
here forces an app.jsx change until that phase is picked up.

## 1. Data shape (`PLACEMENT` in `src/data.js`)
```
PLACEMENT = {
  intake: [                       // narrative framing, asked before the test
    { id, q, opts:[…] },          // single-select; 'goal'/'reason' personalize the roadmap copy
    …                             // country · reason · timeline · goal
  ],
  items: [                        // graded placement questions, 4 per CEFR level, ascending
    { id, level:"A1"|"A2"|"B1"|"B2", skill:"vocab"|"grammar"|"reading", q, opts:[…], correctIdx },
    …                             // 16 items total
  ]
}
```
`npm run validate` enforces: unique ids, valid levels, `correctIdx` in range, ≥2 opts, and **warns** if a
level has < 3 items (placement reliability). Current bank: **16 items, 4 each A1–B2.**

## 2. Intake (narrative frame, not a test)
Four single-select questions set the journey frame from second one:
- `country` — Germany / Austria / Switzerland / Not sure yet → DACH targeting + copy ("…in Berlin/Vienna/Zürich").
- `reason` — A job / Study / Family or partner / Something else → which arc to foreground.
- `timeline` — already there / < 3 months / 3–12 months / exploring → urgency + pace.
- `goal` — Everyday survival / Working in German / Passing an exam / Settling in & making friends →
  the headline promise and the first mission arc (see §4).

Intake answers are **not scored**; they personalize copy + the starting arc. Persist under a new key
(suggest `ad-onboarding-v1`). All four should be skippable (default = neutral).

## 3. Placement scoring (recommended algorithm)
A fixed-form, ladder-scored test (simpler + more predictable than full CAT; 16 items ≈ 2 min):

1. Present items grouped by level, **A1 → B2**, in order.
2. Score per level: `passed(L) = correct(L) / total(L) ≥ 0.5` (≥ 2 of 4).
3. **Start level = the highest level L such that every level up to and including L is passed.**
   - Fail A1 → start `A1`. Pass A1, fail A2 → start `A2` (they're solid at A1, working into A2). Etc.
   - Pass all four → start `B2`.
   - Rule of thumb: the learner's working level is the **first level they did *not* pass** (floored at A1,
     capped at B2). This places them where there's still something to learn, not where they've maxed.
4. **Optional early stop** to keep it short: stop after the first level where they score 0–1 / 4; everything
   above is assumed unknown. (Keeps a strong-A1 / weak-A2 learner from slogging through B2 grammar.)

Edge cases: no answers → default `A1`. Ties/partial → prefer the **lower** level (under-place slightly; the
deck's `"auto"` level then climbs naturally via SRS — see the AGENTS.md invariant on `"auto"`).

## 4. Mapping the result → the journey
The placement output seeds three things the app already has:
- **Starting CEFR level** → sets the learner's level for the `"auto"` deck default (do **not** reintroduce a
  flat `"all"`; `filterPool` resolves `"auto"` to this level).
- **First mission / arc** → from `goal` + level: e.g. *Everyday survival* → Touchdown (A1 on-ramps now exist
  in every early arc); *Working in German* → The Job; *Passing an exam* → surface `EXAM` sets (see
  `practice-data-spec.md`); *Settling in* → Belonging. Pick the first not-done mission in that arc at/below
  the start level.
- **Roadmap copy** → "You're at ~{level}. Here's your path to {goal} in {city}." Then the mission spine (P0)
  *is* the roadmap; P5 just frames the entry.

## 5. App wiring (app.jsx lane — when picked up)
- New onboarding flow: intake (4 taps) → placement (16 MC, reuse the existing MC renderer + `EXAM`-style
  question shape `{q,opts,correctIdx}`) → result screen (level + personalized roadmap + "Start" CTA).
- Reuse `openMission(id)` / `setScreen("scenarios")` for the CTA. Store result + intake; gate the flow on
  first run (no `ds.attempts`), with a "retake placement" entry in Settings.
- No SRS/`record()` math changes — placement only **seeds the starting level**; it does not write card progress.

## 6. Verify
- `npm run validate` (PLACEMENT structure + per-level coverage) + `npm test` (26/26).
- When the UI lands: `scripts/shoot.mjs` a placement persona; check the flow reads as a guided intake, not a
  config modal, and the result names a level + a concrete first mission.

## 7. Definition of done
A brand-new user answers four framing questions, takes a ~2-minute placement, and lands on a **named level +
a personalized first mission** ("Start: Order at a café" / "Start: Handle a job interview") — the journey
frame is set before they see a single wordlist. Effort: **Med-High** (one new flow). Risk: **Med** (additive;
seeds level only, no SRS change). **Data + scoring spec: done (this file + `PLACEMENT`).**
