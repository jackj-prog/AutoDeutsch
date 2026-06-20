# AutoDeutsch — Full visual-state audit (2026-06-20)

Systematic capture-and-review of **every reachable screen and state**, driven through the real
built bundle by `scripts/shoot.mjs` (puppeteer). Goal: a complete visual picture of the app.
Captures live in `screenshots/audit/` (prefixes `b5-` drills, `b6-` feedback/results, `b7-`
structure). This complements the static `docs/APP-AUDIT-2026-06-20.md` (code-level review) with
a live, screenshot-backed sweep of the running app.

## Coverage: ~85% (52 of ~61 distinct states)

### ✅ Captured & verified clean
**Core navigation** — Home (first / daily / advanced), Library, Browse, Progress (first / daily /
advanced), Settings (full), Train tab, AI Tutor (no-key empty state), Setup modal, Onboarding/intake.

**Journey** — Scenarios list, Mission detail, Placement intake → question → result (P5), 320px sweep.

**Sessions** — Recall front, Recall revealed, Production front, Speaking, Audio review, Weak Areas,
Article drill, Plural drill, Grammar Cloze, Verb Trainer (Präsens + Konjunktiv I), Imperative,
Sentence Builder, Listening (chat dialogue), Confusion pairs, Exam practice (setup + run).

**Feedback states** — Production answered-wrong, answered-correct, capitalisation nudge, ß nudge,
drill answered-wrong (grammar note), drill reveal-answer, drill correct (green bloom).

**Results & celebrations** — Results (failed-session, repeat list), Results-win (Perfect! + confetti
+ 100% ring), Daily-goal-reached toast, Streak-milestone toast, Streak-freeze-used toast.

### ⬜ Remaining (≈15%) — need extra seeding/inputs, deferred to next pass
- **Mission-complete celebration** — requires driving a mission to completion (mission progress seed).
- **Role-up / rank-up celebration** — requires crossing a capability-role threshold.
- **Skill-unlocked celebration** — requires the unlock trigger.
- **High-capability Progress** — the `advanced` persona seeds practice *volume* but deliberately not
  real mastery, so role stays "Newcomer / 1%". A dedicated mastery+mission seed is needed to show the
  upper-journey Progress and the role ladder populated.
- **Mastery-crossing burst** — the in-session ★ burst overlay (b6-mastery caught the settled correct
  state, not the burst frame).
- **Tutor active chat** — needs a live Anthropic key (not available in the harness).
- **Dictation session** — reachable only via per-topic Advanced options; no top-level entry.

## Findings

### 🔴 Defect — Train-tab grammar tiles discard the drill mode
The Train-tab **Articles** / **Plural Forms** tiles open the setup with `setupCat="__all__"`, which
the setup treats as a **library** category: it shows the vocab presets (Quick·Speak·Standard·Deep),
and these call `startSession` with **vocab** modes — silently discarding the `article`/`plural` mode.
The mode-respecting **Start session** button is hidden behind **"Advanced options"**. So a user who
taps *Articles → Quick* gets a DE→EN recall session, **not** an article drill. (`src/app.jsx`
~3892–3911 preset block vs ~4099–4101 Start-session, gated by `!setupIsLibrary || showAdvanced`.)
*Fix direction:* for grammar-drill tiles, either start the drill in one tap (skip the library
presets) or make the presets carry the drill mode. The drills themselves render perfectly once
reached (`b5-article`, `b5-plural`).

### 🟡 Vertical rhythm differs by drill type (confirms static audit §1.2)
MC-style drills (Article, Verb/Konjunktiv) anchor the prompt card to the **lower** third with a large
dead band above; typed drills (Cloze, Plural, Imperative) and Sentence Builder anchor differently
(top vs low). The placement looks unintentional — the big void above the Article/Verb cards is the
most noticeable. Worth one consistent vertical anchor across all session types.

### 🟢 Content nits (content lane)
- First Plural-drill word surfaced **"die Beschimpfung" (insult/abuse)** — tonally off for a
  settling-in app. (Deck-wide tone, not a render bug.)
- Konjunktiv I gloss rendered with **doubled parens**: "(to transfer (money))".
- Primary results button reads **"Weiter"** (German) on an otherwise-English results screen — likely
  intentional immersion, but mixed with English "Go again — All Categories" / "Back to home".

### ✅ Verified NON-issues (don't chase)
- **Results "89% ACCURACY" with "✓9 ✗0"** — a CountUp animation mid-frame; settles at **100%**
  (`acc = round(correct/total*100)`). Harness now waits for the ring to settle.
- All dynamic counts (5,782 words · 122 dialogues · 92 verbs) render live and correct.

## Harness fixes made this pass (scripts/shoot.mjs)
- `traindrill` / `drillbloom`: reveal the hidden **Start session** under "Advanced options" when the
  `__all__` setup shows library presets (otherwise the Article/Plural drills can't be reached).
- `results`: start via the home **Production practice** hero (Custom-session route hits the same
  buried-Start-session trap); loop bumped 24→40 to finish the full review queue.
- `resultswin` / `recall`: start via the **Quick** preset, then drive the swipe card by **focusing it
  first** (its `tabIndex`/keydown only fire when focused) — ArrowRight = "got it", ArrowLeft = reveal.
  Added a 1.5s settle so the accuracy ring finishes counting up.
- New `weakspots` path (home Weak-spots card → one-tap weak-words session).
