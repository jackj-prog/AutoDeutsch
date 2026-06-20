# P2 — Can-do CEFR + capability Progress (implementation spec)

Status: **planning → build**. Source: Journey Transformation Plan in `ROADMAP.md`.
Goal: make the Progress screen lead with **what you can do**, not how much of the database you've
covered. Reuse the mission spine (P0) as the source of can-do statements. Keep the word-SRS/coverage
panels intact but demoted **"under the hood."** No SRS/mastery math changes.

## 1. Scope
**In (P2a — this build):**
- A **capability model** derived from completed missions (each mission's `cando` = a can-do you earn).
- A **"What you can do now"** lead section at the top of Progress: count + recent earned can-dos + the
  next can-do (tap → Scenarios).
- **Per-level can-do counts** on the existing level-roadmap rows (e.g. "3 / 10 can-dos").
- An **exam-readiness** row per level (telc/Goethe estimate from level vocab strength).
- Demote the database panels (Memory strength, All-time, Drill coverage, whole-journey words/pace)
  under a collapsible **"Under the hood"** header (default collapsed).

**Out (deferred):**
- Full level certificates + celebrations → P4 (we show a "Level complete" marker only).
- Daily-loop / goal changes → P3.
- Onboarding/placement → P5.
- Any change to `record()` / SRS / `deepStats` math (we only *read* it).

## 2. Capability model (new `useMemo`)
Derived from `missionProg` (P0) + `deepStats.levels`:
```
capability = {
  earned: MISSIONS.filter(m => missionProg[m.id]?.doneAt),         // can-dos achieved
  earnedCount,
  recent: earned sorted by doneAt desc (top 3),
  next: currentMission (first not-done),                            // already computed
  byLevel: { A1:{done,total}, A2:{…}, B1:{…}, B2:{…} },             // mission counts per CEFR level
  exam: { A1:pct, A2:pct, B1:pct, B2:pct },                         // = deepStats.levels[l].strong/total*100
}
```
Exam-readiness state per level: `ready` if pct ≥ 75 (and that level's missions done), `almost` if ≥ 40,
else `building`. Labelled as an **estimate** ("~", "on track") — it's a vocab-strength proxy, not a real
score.

## 3. Progress screen layout (top → bottom)
1. **Header** (unchanged): "Progress — Your journey to B2."
2. **NEW · What you can do now** (the lead):
   - Big number: `{earnedCount}` + "things you can do in German."
   - Up to 3 recent earned can-dos as ✓ chips ("Order at a café", "Register at the Bürgeramt").
   - "Next: {next.cando} →" → tap goes to the mission (or Scenarios).
   - Empty state (0 earned): "Complete your first scenario to earn your first real-world skill →".
3. **YOUR JOURNEY TO B2** (kept, augmented):
   - Each level row gains a small "{byLevel[l].done} / {total} can-dos" line and an **exam chip**
     (e.g. "telc A1 · ready" / "telc A2 · ~60%").
   - A **"Level complete"** marker when a level's vocab is fully strong (existing `done`).
4. **Under the hood ▸** (NEW collapsible, default collapsed): wraps the existing
   *Across-all-levels words + pace*, *Memory strength*, *All-time*, *Drill coverage* panels. A muted
   header "Under the hood — the data" toggles it.

## 4. State / wiring
- `const [showUnderHood, setShowUnderHood] = useState(false)`.
- `capability` useMemo after `deepStats` + `currentMission` (both already defined above the stats render).
- Tap targets reuse `openMission(id)` / `setScreen("scenarios")`.
- No new storage keys; capability is computed from `missionProg` (P0's `ad-mission-progress-v1`).

## 5. Files
- `src/app.jsx` only: add the `capability` memo + `showUnderHood` state; edit the `screen === "stats"`
  block to insert the capability lead, augment level rows, and wrap the data panels.

## 6. Verify
- `npm run validate` + `npm test` (26/26).
- `scripts/shoot.mjs stats` for both `first` (empty capability) and `daily` (some earned) personas; check
  the lead reads as capability, the data panels are collapsed, no overflow.
- Deploy + ROADMAP/CHANGELOG/AGENTS update.

## 7. Definition of done
A learner opening Progress first sees **"N things you can do in German"** with real-world can-dos and an
exam-readiness estimate per level — not a word-count percentage. The coverage data still exists, one tap
away under "Under the hood." Effort: **Med**. Risk: **Med** (restructures one screen; additive + collapsible
keeps it safe).
