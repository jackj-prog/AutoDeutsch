# P0 — Scenario / Mission spine (implementation spec)

Status: **planning** (no app code yet). Owner: TBD. Source: Journey Transformation Plan in
`ROADMAP.md`. Goal of P0: surface the relocation journey that **already exists** as 87 dialogues,
by grouping + naming them as missions and giving the user a single "current mission" to advance —
**without** building a new session engine or touching the word-SRS. Promote, don't rebuild.

## 1. Scope

**In:**
- A curated `MISSIONS` manifest (content) grouping existing dialogues + vocab categories into the
  relocation arc, each with a plain-language *can-do* title.
- A **Scenarios** screen: arc sections → mission cards with progress.
- A **mission detail** view with 2–3 steps that launch *existing* sessions (Learn words / Listen /
  Speak) + the existing comprehension check.
- A **"Current mission" card on Home**.
- Lightweight per-mission completion tracking in localStorage (independent of SRS).

**Out (deferred to later phases — do NOT do in P0):**
- Rewriting CEFR as can-do statements / capability Progress screen (P2).
- Changing the daily goal or the review-queue loop (P3).
- New reward/celebration types, DACH-rite milestones, identity progression (P4).
- Onboarding/placement/personalization (P5).
- Library → Curriculum restructure (P6). P0 *adds* a surface; it doesn't restructure Library.
- Any change to `record()` / SRS / mastery math.

**Non-goals:** no new content authoring except mission *metadata* (titles/grouping). The A1 scenario
gap is P1, not P0 — P0 ships with A2+ missions and simply shows A1 missions as "coming soon" or omits
the Touchdown arc's A1 entries.

## 2. Data model — `MISSIONS` manifest

Add to `src/data.js` (content lives with content). Keyed/curated, ordered. Dialogues are referenced
by **title** (their stable key — they have no id).

```js
// Ordered relocation arc. Each mission references existing dialogues (by title) + vocab categories.
const MISSION_ARCS = [
  { id: "touchdown",  title: "Touchdown",      sub: "Your first days",        icon: "plane" },
  { id: "paperwork",  title: "The Paperwork",  sub: "Anmeldung & offices",    icon: "file" },
  { id: "roof",       title: "A Roof",         sub: "Finding & keeping a flat", icon: "home" },
  { id: "money",      title: "Money & Connectivity", sub: "Bank, SIM, contracts", icon: "card" },
  { id: "health",     title: "Staying Well",   sub: "Doctor, pharmacy, sick notes", icon: "heart" },
  { id: "job",        title: "The Job",        sub: "Work in German",         icon: "briefcase" },
  { id: "belonging",  title: "Belonging",      sub: "Small talk & social",    icon: "users" },
];

const MISSIONS = [
  // id: stable, used as the localStorage progress key. cando: the user-facing outcome.
  // dialogues: existing DIALOGUES titles (level variants allowed). cats: vocab categories to drill.
  { id: "m_cafe",     arc: "touchdown", level: "A2", cando: "Order at a café or bakery",
    dialogues: ["Im Café bestellen", "Beim Bäcker", "At the café"], cats: ["Food & Drink", "Restaurant & Dining Out"] },
  { id: "m_directions", arc: "touchdown", level: "A2", cando: "Ask for and follow directions",
    dialogues: ["Nach dem Weg fragen", "Asking for directions"], cats: ["Travel & Directions"] },
  { id: "m_anmeldung", arc: "paperwork", level: "A2", cando: "Register your address at the Bürgeramt",
    dialogues: ["Registering at the Bürgeramt", "Registering at the city office"], cats: ["Admin & Bureaucracy"] },
  { id: "m_finanzamt", arc: "paperwork", level: "B2", cando: "Handle a call to the Finanzamt",
    dialogues: ["Anruf beim Finanzamt"], cats: ["Admin & Bureaucracy", "Banking & Finance"] },
  { id: "m_strom",     arc: "paperwork", level: "B2", cando: "Set up your electricity",
    dialogues: ["Strom anmelden"], cats: ["Admin & Bureaucracy", "Housing & Renting"] },
  { id: "m_ausländer", arc: "paperwork", level: "B2", cando: "Get through an appointment at the Ausländerbehörde",
    dialogues: ["Termin bei der Ausländerbehörde"], cats: ["Admin & Bureaucracy"] },
  { id: "m_rent",      arc: "roof", level: "A2", cando: "Rent a flat & view it",
    dialogues: ["Renting a flat", "Flat viewing"], cats: ["Housing & Renting"] },
  { id: "m_landlord",  arc: "roof", level: "A2", cando: "Report a problem to your landlord",
    dialogues: ["Reporting an issue to a landlord", "Calling the landlord"], cats: ["Housing & Renting"] },
  { id: "m_handover",  arc: "roof", level: "B2", cando: "Do a flat handover (Wohnungsübergabe)",
    dialogues: ["Wohnungsübergabe", "Umzugsunternehmen beauftragen"], cats: ["Housing & Renting"] },
  { id: "m_bank",      arc: "money", level: "B1", cando: "Open a bank account",
    dialogues: ["Kontoeröffnung bei der Bank", "Opening a bank account"], cats: ["Banking & Finance"] },
  { id: "m_sim",       arc: "money", level: "B1", cando: "Get a SIM & choose a phone plan",
    dialogues: ["Buying a SIM card", "Choosing a phone plan"], cats: ["Media & Communication", "Shopping & Money"] },
  { id: "m_doctor",    arc: "health", level: "A2", cando: "Make and attend a doctor's appointment",
    dialogues: ["Beim Arzt — Termin machen", "At the doctor's"], cats: ["Health & Doctor", "Body & Health"] },
  { id: "m_pharmacy",  arc: "health", level: "B1", cando: "Get what you need at the pharmacy",
    dialogues: ["In der Apotheke", "At the pharmacy"], cats: ["Health & Doctor"] },
  { id: "m_sick",      arc: "health", level: "B2", cando: "Call in sick to work",
    dialogues: ["Krankmeldung im Büro"], cats: ["Health & Doctor", "Work & Study"] },
  { id: "m_interview", arc: "job", level: "B1", cando: "Handle a job interview",
    dialogues: ["Job interview basics", "Job interview"], cats: ["Work & Study"] },
  { id: "m_firstday",  arc: "job", level: "B2", cando: "Survive your first day at work",
    dialogues: ["Onboarding: erster Arbeitstag", "Code-Review im Team"], cats: ["Work & Study", "Engineering Workplace"] },
  { id: "m_feedback",  arc: "job", level: "B2", cando: "Hold a feedback conversation with your boss",
    dialogues: ["Feedbackgespräch mit der Chefin", "Project status meeting"], cats: ["Work & Study"] },
  { id: "m_kaffeekueche", arc: "belonging", level: "B2", cando: "Make small talk in the office kitchen",
    dialogues: ["Smalltalk in der Kaffeeküche", "Networking at a conference"], cats: ["Small Talk & Social", "Character & Personality"] },
  // … full manifest authored as the first P0 task — ~25–30 missions covering all 87 dialogues.
];
```

Notes:
- **Reference by title is safe**: validator already enforces unique dialogue titles. A build-time check
  should assert every `dialogues[]` title and every `cats[]` category resolves (fail the build otherwise).
- Some dialogue titles above are placeholders to confirm at authoring time against the real list (e.g.
  "At the café" exists; pick the best 1–2 variants per mission, A2 first then B2).
- Missions carry a single `level` (the entry CEFR); level *variants* live in the `dialogues[]` list and
  are shown as "Beginner / Advanced" takes within the mission.

## 3. Surfaces

### 3a. Scenarios screen (`screen === "scenarios"`)
- Header "Your journey to living in Germany".
- For each arc (in order): a section header (arc title + sub + a thin progress bar `done/total`),
  then mission cards.
- **Mission card:** can-do title (e.g. "Register your address at the Bürgeramt"), a level chip (A2),
  and a status: ⬜ not started / 🟡 in progress / ✅ done. Locked styling optional (see §6 open Q).
- Tap → mission detail.
- Reachable from: the Home current-mission card ("See all"), and a Library entry ("Scenarios" /
  "Journey"). Bottom-nav placement is an open question (§6).

### 3b. Mission detail (`screen === "mission"`, `activeMission` state)
- **Header:** the can-do outcome as a promise — "After this you'll be able to: *register your address
  at the Bürgeramt*." Level chip. Arc breadcrumb.
- **Steps (each launches an existing session, then returns here):**
  1. **Learn the words** → `startSession(firstCat, "vocab", N, { level: mission.level })` scoped to the
     mission's `cats` (P0 may just launch the first category or an ad-hoc pooled list — see §4).
  2. **Listen to the scene** → open the existing `dialogues` screen for the mission's primary dialogue.
  3. **Say it** → a `speaking` session scoped to the mission's vocab (reuse the new Speaking mode).
  4. **(If the dialogue has questions)** Comprehension check → existing `listening` MCQ mode.
- A step shows ✓ once completed. When all available steps are ✓ (or the comprehension check is passed),
  the mission flips to **done** and a capability line appears: "✅ You can now register at the Bürgeramt."
  (Full capability rewards are P4; P0 just shows the line.)

### 3c. Home "Current mission" card
- Compute `currentMission` = first mission in manifest order that is **not done** and whose
  `level` ≤ the learner's `deepStats.currentLevel + 1` (don't show B2 missions to an A1 user; allow one
  level of stretch). Fallback: first not-done mission.
- Card: arc eyebrow ("The Paperwork"), the can-do title, a `step X of Y` chip, primary tap → mission
  detail. Place **above** the existing "reviews due" hero is the P3 decision; for P0, place it directly
  **below** the rank card and **above** the practice-mode grid (additive, doesn't displace the review hero).
- "See all scenarios →" link → Scenarios screen.

## 4. Reuse map (no new session engine)

| Mission step | Existing mechanism | Call |
|---|---|---|
| Learn words | vocab session, level-filtered | `startSession(cat, "vocab", n, { level })` — P0: launch the first `cat` (or a temporary merged pool keyed `__mission_<id>__`; simplest P0 = first cat). |
| Listen | the `dialogues` screen | set `activeDialogue` + `setScreen("dialogues")` (same path as line ~2585). |
| Say it | Speaking mode (just shipped) | `startSession(cat, "speaking", n, { level })`. |
| Comprehension | `listening` MCQ mode | `startSession("__listening__", "listening", n)` filtered to the mission's dialogue(s) — P0 may scope by passing the dialogue title(s). |

To return to mission detail after a session, set a `returnTo: { screen:"mission", id }` so `nextDrill`/
results "Done" routes back to the mission instead of Home (small addition to the results CTA).

## 5. Completion & progress (local, SRS-independent)

- localStorage key `ad-mission-progress-v1` → `{ [missionId]: { learned, listened, spoke, checked, doneAt } }`.
- A step sets its flag on completion (e.g. finishing a mission-launched session sets `learned`/`spoke`;
  opening+playing the dialogue sets `listened`; passing the comprehension MCQ sets `checked`).
- `done` = all *available* steps flagged (a mission with no comprehension questions needs only
  learn+listen+speak). Set `doneAt` timestamp; show the capability line.
- Arc progress = done missions / total in arc. **Never** touches `prog` / SRS — the underlying words keep
  flowing through the existing mastery system exactly as today.

## 6. Open decisions (need a call before build)

1. **Bottom-nav placement.** Add a 5th "Journey/Scenarios" tab (crowds nav to 5) **or** keep nav at 4 and
   reach Scenarios via the Home card + a Library entry? *Recommendation: Home card + Library entry for P0;
   revisit a dedicated tab in P6 when Library→Curriculum.*
2. **Locking/sequencing.** Hard-lock later missions until earlier ones are done (Duolingo-style
   anticipation) **or** soft (all visible, gentle "recommended next")? *Recommendation: soft for P0
   (visible, with a "Start here" marker on the current mission); hard-locking is a P3/P4 motivation lever.*
3. **Completion bar.** Is "all steps touched" enough, or must the comprehension MCQ be *passed*?
   *Recommendation: steps-touched for P0 (only ~50/87 dialogues have questions); tie completion to a
   passed check in P2 when can-do/capability formalises.*
4. **"Learn words" scope.** Launch the first category, or build a merged mission-vocab pool
   (`__mission_<id>__`)? *Recommendation: first category in P0 (zero new pooling code); merged pool is a
   fast-follow.*

## 7. Build order & estimate

1. Author the full `MISSIONS` + `MISSION_ARCS` manifest (~25–30 missions over all 87 dialogues) + a
   build-time resolver check. *(content, ~Med)*
2. Mission completion store + helpers (`ad-mission-progress-v1`, get/set, arc progress, currentMission).
   *(small)*
3. Scenarios screen (arc sections + mission cards). *(Med)*
4. Mission detail (steps that launch existing sessions + `returnTo` routing). *(Med)*
5. Home current-mission card + "See all". *(small)*
6. Add `plane/file/card/briefcase/users` icons if missing (single-path SVGs). *(small)*
7. Verify: `node scripts/shoot.mjs` for Home + a new `scenarios`/`mission` harness path; `npm run
   validate` (manifest resolver) + `npm test`. Deploy.

**Effort: Med (≈ the size of the Speaking build).** **Risk: Low** — purely additive surfaces over
existing content/engines; no SRS/mastery/daily-loop changes.

## 8. Definition of done (P0)
- A learner sees a **current mission** on Home, opens a **Scenarios** map of the relocation arc, completes
  a mission's steps using existing sessions, and gets a **"You can now ___"** line — all without the word
  "card count" appearing. The journey is *visible and advanceable* using only content already shipped.
