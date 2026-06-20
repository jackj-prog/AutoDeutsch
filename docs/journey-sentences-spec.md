# Journey-linked sentence builders — data + integration spec

Status: **data ready → app build pending**. The sentence-builder content (`SENTENCES` in `src/data.js`) now
carries an optional **`mission`** tag so the journey can offer a per-mission **"Build the sentence"** step —
the learner constructs the exact utterances they'd say in that scenario, reinforcing word order on top of the
mission's vocab + dialogue + speaking steps.

Lane note: the **data + this spec are the content lane**; the **mission-step UI is `src/app.jsx`**
(single-writer). No app.jsx change is required until this is scheduled. Nothing here changes existing
behaviour — the tag is additive and ignored until consumed.

## 1. Data shape (already shipped)
```
SENTENCES = [
  { correct:[…words…], en, rule, level,   // unchanged — general sentence-builder items
    mission? },                            // NEW optional: a MISSIONS id this sentence belongs to
  …
]
```
- **33 mission-tagged sentences across 29 missions**, all 7 arcs (touchdown 6 · paperwork 6 · roof 5 ·
  money 5 · health 4 · job 3 · belonging 4). Each is a realistic utterance from that scenario
  (e.g. `cash` → "Ich möchte Geld abheben"; `krankenkasse` → "Ich möchte mich versichern";
  `givenotice` → "Ich möchte die Wohnung kündigen").
- `npm run validate` enforces: if `mission` is present it **must resolve** to a real `MISSIONS` id.
- Untagged sentences are unchanged and still feed the general Sentence-Builder drill; tagged ones appear in
  **both** the general drill and their mission.

## 2. Integration (app.jsx — recommended)
Add a fourth, **conditional** step to the mission detail screen (`screen === "mission"`, ~app.jsx:5532),
shown only when the mission has tagged sentences:
```
const missionSentences = SENTENCES.filter(s => s.mission === m.id);
// add to the steps array only if missionSentences.length:
{ key:"built", label:"Build the sentence", sub:`${missionSentences.length} sentence${…}`, icon:"blocks" }
```
- **Launch:** `launchMissionStep(m, "built")` → set `cards = missionSentences`, `setScreen("sentence")`
  (the existing sentence-builder screen already renders from `cards`), and set `missionReturnRef` so it
  returns to the mission. Credit `missionStepDone(m.id, "built")` on completion (same pattern as the other steps).
- **Mission completion:** keep the **existing 3 steps** as the completion bar and treat "Build the sentence"
  as a **bonus** step (so missions without tagged sentences still complete normally). If you'd rather count
  it, gate it on `missionSentences.length > 0`.
- **Ordering:** place it after "Say it out loud" (produce → recall → speak → build is a sensible difficulty
  ramp), or wherever fits the step UX.

## 3. Verify
- `npm run validate` (mission-tag resolution) + `npm test` (26/26).
- When wired: a mission with tagged sentences shows the extra step; tapping it opens the sentence builder
  pre-loaded with that mission's sentences and returns to the mission on Done. `scripts/shoot.mjs mission`.

## 4. Growing coverage (content lane)
More missions can be covered by adding tagged `SENTENCES` (1–3 per mission). Current coverage is the 29
highest-value missions; the remaining ~29 (mostly B2 "advanced situations") can be filled on demand.
