# AutoDeutsch — Roadmap

> Coordination surface for the AI agents working on AutoDeutsch. Migrated from
> `AutoDeutsch_Roadmap_Checklist.xlsx` on 2026-06-20. Pairs with `CHANGELOG.md`
> (chronological build log) and `AGENTS.md` (collaboration protocol + work claims).
>
> **Status key:** ✅ done · 🟡 in progress · ⬜ planned

## Strategic note

AI Tutor moved out of the immediate roadmap. It remains a strong future premium feature once AutoDeutsch launches publicly. Current priority should be progression, Home experience, session composition, guided learning, and production skills. Productizing the tutor makes more sense after the core product experience is polished and user demand is validated.

---

## 🧭 Journey Transformation Plan (north star)

From the Learning Journey Audit (2026-06-20). **Thesis:** the progression is a vocabulary-completion
meter in a CEFR costume — it measures database coverage, not real-world German ability. The deep dive
found the cure is already in the cupboard: the **87 dialogues are a complete, CEFR-laddered relocation
curriculum** (Arrival → Bureaucracy → Home → Money → Health → Work → Belonging), but they're buried as
the "Listening" tile in the Train tab. The transformation is mostly **"stop burying the journey you
already built"** — promote scenarios, name the can-dos, fill the A1 tier, and let *capability* (not card
counts) be what the user sees moving.

**North star:** _Today_ "Learn 5,782 German words, tracked by CEFR level." → _Should be_ "Go from landing
in Germany to living and working there — one real-world situation at a time, with the vocabulary handled
underneath." Positioning: **the German app for professionals relocating to the DACH region.**

**Sequencing principle:** promote-before-build; lowest-effort/highest-leverage first; keep the excellent
word-SRS intact *under the hood* and change what the user *sees* as progress. Phases are ordered to ship
the "journey" feeling early (P0) and de-risk the core daily-loop change (P3) after the spine exists.

| Phase | Move | Why it matters (root cause) | Effort | Risk | Status |
|---|---|---|---|---|---|
| **P0** | **Promote the 87 dialogues → Scenario/Mission spine.** First-class "Scenarios" surface; group into the relocation arc; name each with a can-do outcome ("You can register at the Bürgeramt"); surface a "current mission" on Home. | The richest journey asset is hidden under Train→Listening. Re-surfacing + re-framing existing, levelled content yields ~80% of the journey feel with **no new content**. Highest leverage, lowest effort. | Med | Low | ✅ **DONE v2026.06.20.04** (MVP) |
| **P1** | **Fill the A1 survival tier.** ~12 A1 micro-scenarios (café, bakery, directions, greetings, numbers) so day-one isn't pure wordlists. | Dialogues were A1:0 / A2:32 / B1:23 / B2:32 — the journey was upside-down. | Med | Low | ✅ **DONE v2026.06.20.05** |
| **P2** | **Can-do CEFR + capability Progress.** Each level = a checklist of "I can…" statements mapped to scenarios. Progress leads with **"What you can do now"** + exam-readiness (telc/Goethe); demote word-count % / SRS bars to an "under the hood" view. Add level certificates/checkpoints. Fix the demoralising math (negative pace, 5,782 denominator, 1,038-to-rank-up). | CEFR is currently a word-bucket label, not a can-do journey; Progress measures completion, not ability. Reframes the *meaning* of progress. | Med-High | Med | ⬜ |
| **P3** | **Daily loop = forward mission step.** Home leads with the current mission's next step; the review queue becomes the *secondary* habit anchor. Replace the cards/day goal with a mission-step (or minutes) goal; keep cards as a sub-metric. | The daily experience is debt-servicing ("23 due") + grinding cards, not advancing. Touches the core retention hook, so it ships *after* the spine exists. | Med | Med | ⬜ |
| **P4** | **Reward & milestone re-wire.** Capability rewards ("You can now handle the Bürgeramt"), role/identity progression (Newcomer→Resident→Local), DACH rites as named milestones (Anmeldung, Krankenversicherung, Steuer-ID, Mietkaution, GEZ), exam-readiness celebrations. Keep streaks as the habit layer, subordinate to capability. | Achievements are disconnected from real-world capability; rewards fire on counts, not competence. | Med | Low-Med | ⬜ |
| **P5** | **Narrative onboarding + placement + personalization.** Intake (which DACH country/city, moving for work?, timeline), a 2-min placement, then a *personalized roadmap* + the promise ("Here's your path to working in Berlin"). | Onboarding is a 3-field config that sets the "tool" frame; it never invokes the product's superpower (it's for *their* move). Sets the journey frame from second one. | Med-High | Med | ⬜ |
| **P6** | **Library → Curriculum; taxonomy → "Dictionary."** Re-present the main content surface as the sequenced mission map; keep the 36-category taxonomy + 5,782-row Browse as an explicitly-labelled reference, not the front door. | Library/Browse expose the raw database as the primary content surface; discovery is by word-category, not life-situation. | Med | Low-Med | ⬜ |
| **P7** | **Tutor as narrative guide (later).** The coach who walks you through the journey and role-plays each scenario — not a generic chatbot bolted on. | Owns narrative, purpose, momentum. Deferred per direction until the core journey exists and demand is validated. | High | Med | ⬜ |

**Quick wins extractable early (don't need the full phase):** ✅ the demoralising-math fixes (denominator + rank-up wall) shipped v2026.06.20.06; a single "current mission" card on Home can ship with
P0; exam-readiness signals are near-free given the telc-validated vocab.

**Challenged assumptions (audit verdicts):** vocabulary should be *fuel*, not the progression unit;
chapters should become *named, themed missions* (or go); CEFR should be *can-do + exam-readiness*, not a
word-bucket; Home should lead a *journey*, not expose features; Progress should measure *ability*, not
database completion.

> Full reasoning: see the Learning Journey Audit (Parts I & II) in the session log / `CHANGELOG.md`.

---

## Next-Up — post-audit priority

Order reflects what I learned actually building & auditing the app: friction-cuts and data-integrity rise; canvas/Browse polish falls (worst parts already done, and typed-mode 'void' is keyboard space); speaking stays the big learning bet; tutor last (per direction).

| # | Initiative | Status | Rationale | Effort | Risk |
|---|---|---|---|---|---|
|  | Configurator -> presets + Advanced  [DONE v2026.06.18.7] | ✅ | Biggest friction-per-effort: the 5-axis setup modal gates EVERY session start and is shared by Home/Library/Train launches, so one change has broad reach. Pure layout. | Low-Med | Low |
|  | Validate CEFR + ADD official words  [DONE v2026.06.19.05] | ✅ | Audit found only ~1,000 of 2,001 words had a real CEFR level. RESOLVED: re-tagged vs telc lists, added ~2,012 official A1-B1 words (deck 2,001->4,013), and filled all remaining cards -> 100% level coverage (A1 1038 / A2 1307 / B1 1249 / B2 419). | Med (data) | Low |
|  | ADD Aspekte neu B2 vocabulary  [DONE v2026.06.19.08] | ✅ | Source supplied by Jack (Aspekte neu B2 Kapitelwortschatz, 10 chapters, no English). DONE: all 10 chapters translated+categorised+exemplified via the wave pipeline; +1,785 B2 words (deck 4,013 -> 5,782). B2-level content 419 -> 2,167. QA sweep clean; 100% CEFR coverage held. | High (data) | Low-Med |
|  | PWA reminders / re-engagement  [DONE v2026.06.19.09] | ✅ | Shipped: opt-in Daily Reminder (Settings) — local notification at a chosen time, skips days the goal is met. Notification Triggers API where available (fires when closed), foreground-timer fallback. No backend. iOS reminds best while the app is opened periodically. | Med | Low-Med |
|  | Aspirational empty states  [DONE v2026.06.18.8] | ✅ | Quick first-week 'aha': a brand-new user's Stats is a wall of zeros. Low effort, contained. | Low | Low |
|  | Personalised weak-spot deck  [DONE v2026.06.18.9] | ✅ | Data already exists (per-card miss counts + the Weak queue). Turn it into a first-class 'drill your weak spots' deck. Real learning value, modest build. | Med | Low |
| 6 | Speaking production mode | ✅ | DONE v2026.06.20.02. New Speaking mode: EN→DE prompt, Web-Speech de-DE recognition matched against the target (feeds the production-mastery track), with a self-graded shadowing fallback where SpeechRecognition is absent (iOS). Surfaced in the home Practice row + topic setup. | High | Med |
|  | Finish session-canvas composition (MC/tap screens)  [DONE v2026.06.18.10] | ✅ | DOWNGRADED. Worst offenders (answered state, recall card) already composed, and typed-mode 'void' is keyboard territory. Remaining: port the Audio bottom-anchor to the article/verb-MC/sentence screens. | Med | Low |
|  | Curated Browse (grouping / sticky letters)  [DONE v2026.06.18.11] | ✅ | DOWNGRADED. Overflow fixed and search works, so the flat list is usable; curation is now polish, not a pain point. | Med | Low |
| 9 | Relocation scenario packs + reposition | ⬜ | Identity bet (the defensible niche). Content + copy heavy; sequence after the friction/retention wins land. | Med-High | Med |
| 10 | AI-graded writing | ⬜ | Pairs with the tutor; needs the hosted proxy. Real B2 'write to the Bürgeramt' value. | High | Med |
| 11 | AI Tutor productisation | ⬜ | Deferred per your direction — the premium-tier capstone, do last. Needs metered hosted proxy. | High | Med |
|  | Already shipped this session (for context): | ⬜ |  |  |  |
|  | Layered 'Strong' progress · Due-as-hero · one-verdict answered state · vocab-in-context · listening-first · faster chapters · grammar (modal/separable) fix · tap-driven icon animations + cog redesign · Library/Browse overflow + bottom-nav fixes · auto cache-bump deploys · configurator presets + Advanced. | 🟡 |  |  |  |

## Top 10 Overall

| # | Initiative | Status | Detail |
|---|---|---|---|
| 1 | Re-rank progress to a moving metric | ✅ | Layered 'Strong' metric — journey %, rank, chapters now advance on SRS box>=3 / 3-streak; Mastered * kept as deeper layer. |
| 2 | Reviews Due as Home hero action | ✅ | Gold 'Review N due' hero on Home when reviews are due; new-session CTA demoted to outline (single focal point). |
| 3 | Compose the session canvas / remove void | ✅ | SHIPPED v2026.06.18.10: composed the multiple-choice + tap screens (article / verb-MC / listening / sentence-builder) and every answered state — the prompt card + options now sit as one CENTERED group with balanced negative space instead of clustering at the top over a void. Typed-while-unanswered stays top-anchored (keyboard space). Card maxHeight:100%+overflowY guards the tall answered summaries. (Chose centred-group over pure bottom-anchor: keeps prompt and options together for read-then-answer scanning.) |
| 4 | Add production-output mode (writing/speaking) | 🟡 | Speaking shipped (v2026.06.20.02); AI-graded writing still pending. |
| 5 | Redesign answered state into one calm verdict | ✅ | One calm verdict block (SRS outcome + 5-dot mastery + quiet tutor link) replaces the 5-colour chip stack. |
| 6 | Replace Browse with curated discovery | ✅ | SHIPPED v2026.06.18.11: curated the word Browse — fixed the broken A-Z (der/die/das nouns were all clustering under D; they now file under the noun letter, e.g. der Abend under A) and added sticky A-Z section headers for rhythm and a sense of place. |
| 7 | Aspirational empty states | ✅ | Done v2026.06.18.8 — first-run Progress shows an aspirational preview (Journey roadmap + Your-progress-live panel + Start-your-first-session CTA) instead of all-zero panels. |
| 8 | CEFR validation and truthful B2 progress | ✅ | DONE v2026.06.19.08. A1-B1 re-validated vs official telc lists; +2,012 telc words then +1,785 Aspekte-neu B2 words (deck 2,001 -> 5,782); 100% explicit CEFR coverage (A1 1038 / A2 1307 / B1 1270 / B2 2167). |
| 9 | Reposition around relocating professionals | ⬜ |  |
| 10 | AI Tutor productization (future premium launch feature) | ⬜ |  |

## Top 10 UX

| # | Initiative | Status | Detail |
|---|---|---|---|
| 1 | One dominant Home action | ✅ | Single dominant gold action on Home (Due when due, else Production); other actions demoted. |
| 2 | Surface SRS Due queue as daily anchor | ✅ | SRS Due queue surfaced as the Home hero / daily anchor. |
| 3 | Configurator → presets + Advanced | ✅ | SHIPPED v2026.06.18.7: topic setup leads with 3 one-tap presets (Quick/Standard/Deep); full controls behind 'Advanced options'. Special drills keep focused controls. |
| 4 | Curated Browse experience | ✅ | SHIPPED v2026.06.18.11: curated the word Browse — fixed the broken A-Z (der/die/das nouns were all clustering under D; they now file under the noun letter, e.g. der Abend under A) and added sticky A-Z section headers for rhythm and a sense of place. |
| 5 | Compose session canvas | ✅ | Done v2026.06.18.10 — MC/tap + answered screens composed as a centred group (no top-cluster/void); typed-unanswered stays top-anchored for the keyboard. |
| 6 | Redesign answered metadata stack | ✅ | Answered metadata stack redesigned into one verdict block. |
| 7 | Remove redundant header eyebrows | ⬜ |  |
| 8 | Progressive disclosure in Progress/Stats | ⬜ |  |
| 9 | Unify naming and labels | ⬜ |  |
| 10 | Listening-first mode | ✅ | Listening-first dialogues: German hidden ('Tap to listen') until heard; Read-along toggle, persisted. |

## Top 10 Learning

| # | Initiative | Status | Detail |
|---|---|---|---|
| 1 | Layered mastery system | ✅ | Encountered -> Learning -> Strong -> Mastered; public progress advances on Strong. |
| 2 | Speaking production mode | ✅ | DONE v2026.06.20.02 — spoken EN→DE with recognition + shadowing fallback; counts toward production mastery. |
| 3 | AI-graded writing | ⬜ |  |
| 4 | Hand-author irregular/modal grammar rules | ✅ | verbRule now flags present-irregular (modals, sein, wissen) + separable verbs; 'wollen -> ich will' no longer mislabelled 'keeps its stem'. |
| 5 | Validate CEFR tags | ✅ | DONE v2026.06.19.08. A1-B1 re-validated vs telc lists; +2,012 telc + +1,785 Aspekte B2 words; 100% CEFR coverage; B2-level content 419 -> 2,167. |
| 6 | Vocabulary-in-context practice | ✅ | Example sentence shown by default in production answered state, target word highlighted (data already on all 2,001 cards). |
| 7 | Personalized weak-spot deck | ✅ | SHIPPED v2026.06.18.9: first-class Weak-spots deck on Home — promoted out of the cramped Today-s-work cell into its own card that previews the actual trouble words (most-missed first, e.g. der Kondensator / die Spannung) with a Drill-weak-spots CTA. Tap launches the existing Weak Areas session. Only shows when weak cards exist; secondary to the gold Due hero. |
| 8 | Listening-first comprehension | ✅ | Listening-first comprehension in the 87 dialogues. |
| 9 | Confusion-pair drilling | ⬜ |  |
| 10 | Exam-format practice | ⬜ |  |

## Top 10 Retention

| # | Initiative | Status | Detail |
|---|---|---|---|
| 1 | Moving progress metric | ✅ | Moving 'Strong' progress metric (was welded to 5-in-a-row mastery). |
| 2 | Reviews Due return trigger | ✅ | Reviews Due as the Home hero return-trigger. |
| 3 | PWA reminders/notifications | ✅ | Done v2026.06.19.09 — opt-in daily reminder: Settings toggle + time picker, gentle local notification that defends the streak and skips days the goal is already met. Notification Triggers API when available (fires while closed), foreground fallback otherwise; no backend. |
| 4 | Competence-based milestones | ⬜ |  |
| 5 | Adaptive daily plan | ⬜ |  |
| 6 | Weekly recap | ⬜ |  |
| 7 | Human progress language | 🟡 | Headline copy now 'learned'/'solid' instead of 'mastered'; competence-based phrasing ('you can now...') still to come. |
| 8 | Streak-freeze visibility | ⬜ |  |
| 9 | First-week aha sequence | ⬜ |  |
| 10 | Faster chapter progression | ✅ | Chapters fill on Strong, so a checkpoint / rank-up is reachable in days, not months. |

## Top 10 Visual

| # | Initiative | Status | Detail |
|---|---|---|---|
| 1 | Compose session canvas | ✅ | Done v2026.06.18.10 — MC/tap + answered screens composed as a centred group (no top-cluster/void); typed-unanswered stays top-anchored for the keyboard. |
| 2 | Screen-level focal point rule | 🟡 | Home now has one gold focal action; not yet a systematic per-screen rule. |
| 3 | Ration colour usage | 🟡 | Answered state reduced to one accent colour; app-wide colour rationing pending. |
| 4 | Redesign answered state | ✅ | Answered state redesigned into one calm verdict. |
| 5 | Aspirational empty states | ✅ | SHIPPED v2026.06.18.8: brand-new Progress is no longer a wall of zeros — the B2 Journey roadmap leads, then a YOUR PROGRESS, LIVE panel previews Accuracy / Recall speed / Memory strength / Day streak with a Start your first session CTA. Gated on ds.attempts===0 so populated stats are unchanged. |
| 6 | Improve Sentence Builder visual language | ⬜ |  |
| 7 | Improve Home hierarchy | ✅ | Home hierarchy: Due hero + demoted secondary CTAs; action now outranks the wordmark. |
| 8 | Tighten card spacing | 🟡 | Recall card balanced with an eyebrow; single-line vertical-centering still present elsewhere. |
| 9 | Remove duplicate progress indicators | ⬜ |  |
| 10 | Use Audio mode as composition benchmark | ⬜ |  |

## Top 10 Wow

| # | Initiative | Status | Detail |
|---|---|---|---|
| 1 | Speaking with pronunciation scoring | 🟡 | Speaking mode ships with speech-recognition matching (v2026.06.20.02); true phoneme-level pronunciation scoring is a later upgrade. |
| 2 | AI-graded writing feedback | ⬜ |  |
| 3 | Alive/composed session canvas | 🟡 | Session canvas partially composed (answered state, recall card, in-context example); full 'alive' canvas pending. |
| 4 | Relocation scenario packs | ⬜ |  |
| 5 | Goethe/telc exam mode | ⬜ |  |
| 6 | Adaptive coach-style daily plan | ⬜ |  |
| 7 | Competence unlocks | ⬜ |  |
| 8 | Enhanced mastery celebrations | ⬜ |  |
| 9 | Native-speed real-world audio | ⬜ |  |
| 10 | Shareable progress recap | ⬜ |  |

## New Ideas — backlog

| Idea | Category | Feasibility | Status | Notes |
|---|---|---|---|---|
| Settings cog rotates on tap to match the nav-tab icon animation; static icons (e.g. chip) pulse | Visual / Delight | Feasible now — quick win | ✅ | Icons are single-path SVGs. Cog: add a rotate keyframe fired on click (the nav tabs already use a scale 'ad-tab-pop'). Pulse = scale/opacity loop. Low risk, ~1 small change.  [SHIPPED v2026.06.18.4: cog spins on tap; static icons (chip etc.) animate; delegated WAAPI listener covers every icon button.] |
| Bespoke, in-character icon animations on interaction — every icon reacts like the active nav-tab icon (e.g. lightning bolt shoots down, house constructs, book opens & closes, hand closes, chip pulses) | Wow / Delight | Partial — feasible subset now; full morphs are high-effort | 🟡 | Feasible NOW on the existing single-path STROKE icons: stroke-dashoffset 'draw-on' (house 'constructs'), translate/fade (bolt 'shoots down'), rotate (cog), pulse (chip), pop. TRUE shape-morphs (a hand closing, a book opening/closing) can't be done on one static path — each needs redesigning as a multi-element / morphable SVG, or a Lottie-style asset (bigger design+eng project). Recommended path: ship cog + pulse + draw-on/pop first (covers most of the delight at low risk), tackle bespoke morphs icon-by-icon later.  [SHIPPED v2026.06.18.4 — feasible tier: spin/drop/build/swing/pulse/beat/pop mapped per icon, played on tap app-wide. REMAINING: true shape-morphs (hand closing, book opening) need per-icon SVG redesign.] |
