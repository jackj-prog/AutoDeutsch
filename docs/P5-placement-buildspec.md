# P5 — Placement flow: app.jsx build spec (hand-off)

**Audience:** the `src/app.jsx` owner. **Status:** data + scoring ready; UI unbuilt. This is the concrete
implementation hand-off so the flow can be built without re-deriving the design. Pairs with
`docs/P5-placement-spec.md` (the *what/why* + data shape + scoring) — this doc is the *how* in app.jsx.

> **Lane note.** Building this **requires `src/app.jsx`** (single-writer). Before starting, claim it
> `src/app.jsx (EXCLUSIVE)` in the AGENTS.md table and release it on push. The data
> (`PLACEMENT`), the validator, and both specs are already on `main` — no content-lane work is blocking.

## 1. Data already shipped (read-only inputs)
- `PLACEMENT.intake` — 4 single-select framing questions (`country` · `reason` · `timeline` · `goal`).
- `PLACEMENT.items` — 24 graded MC items, 6 per CEFR level, `{id, level, skill, q, opts, correctIdx}`.
- Reuse the **existing MC renderer** (same `{q,opts,correctIdx}` shape as dialogues/EXAM).

## 2. New screens / flow
First-run (no `ds.attempts`) routes into the flow instead of the current 3-field config:
1. **Intake** (`screen:"onboarding"` extension) — render `PLACEMENT.intake` as 4 tap-through cards. All
   skippable (default neutral). Persist answers.
2. **Placement** (`screen:"placement"`) — pick a balanced subset (suggest 8–12: 2–3 per level, drawn from the
   6/level pool so retakes vary), present **A1→B2 ascending**, MC, no per-question feedback (it's a test).
   - Optional early stop: after a level scored 0–1 correct, stop (assume higher levels unknown).
3. **Result** (`screen:"placementResult"`) — show the estimated level + the personalized roadmap line and a
   **Start** CTA into the first mission.

Re-entry: a **Settings** row labelled exactly **"Placement test"** (retake). *(The screenshot harness
`scripts/shoot.mjs placement` clicks Settings → "Placement test" — keep that label so it shoots automatically.)*

## 3. Scoring (implement per docs/P5-placement-spec.md §3)
Ladder rule: `passed(L) = correct(L)/asked(L) ≥ 0.5`; **start level = the first level not passed** (floored
A1, capped B2). No answers → `A1`. Ties → prefer the lower level (the deck's `"auto"` climbs anyway).

```
function placeLevel(answersByLevel) {            // {A1:{c,n}, …}
  const order = ["A1","A2","B1","B2"];
  for (const L of order) {
    const s = answersByLevel[L] || {c:0,n:0};
    if (!s.n || s.c / s.n < 0.5) return L;        // first level they can't carry
  }
  return "B2";
}
```

## 4. Mapping result → journey (drive existing systems)
- **Starting level** → seed the learner's CEFR level used by the `"auto"` deck default (do **not** set a flat
  `"all"`). This is the only state the placement writes that touches study.
- **First mission** → `goal` + level: *Everyday survival*→`touchdown`; *Working in German*→`job`;
  *Passing an exam*→surface `EXAM` (see `practice-data-spec.md`); *Settling in*→`belonging`. Pick the first
  not-done mission in that arc at/below the start level; CTA → `openMission(id)`.
- **Roadmap copy** → "You're at ~{level}. Here's your path to {goal} in {city}." Then the P0 mission spine
  *is* the roadmap.

## 5. State / storage
- New key `ad-onboarding-v1` → `{ intake:{country,reason,timeline,goal}, level, placedAt }`.
- Gate the first-run flow on `!localStorage["ad-onboarding-v1"] && ds.attempts === 0`.
- **No `record()` / SRS / mastery writes** — placement seeds the starting level only; it must not create card
  progress. (Same invariant P2 held.)

## 6. Acceptance / verify
- A brand-new user gets intake → ~2-min placement → a **named level + a concrete first mission**, not a config
  modal. Returning users can retake via Settings → "Placement test".
- `npm run validate` + `npm test` (26/26) still green; bump `APP_VERSION`.
- `node scripts/shoot.mjs placement` (Settings → "Placement test") + the first-run path at `SHOOT_WIDTH=320`
  for overflow. Effort: **Med-High** (one new flow, additive). Risk: **Med** (seeds level only).

## 7. Out of scope (later)
- Adaptive item selection (CAT) — the fixed ladder is enough at 24 items.
- Writing/speaking placement — needs the future AI-graded writing / speech scoring.
- Persisting per-skill (vocab/grammar/reading) sub-scores — `skill` is on every item if you later want a
  skill breakdown on the result screen.
