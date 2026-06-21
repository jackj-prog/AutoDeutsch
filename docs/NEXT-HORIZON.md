# NEXT HORIZON — the plan after the journey (H1–H4)

**Status:** the **J1–J6 journey build-out is complete** (v.23–28; see `JOURNEY-ROADMAP.md`). The journey
is the flagship and the mission loop is whole (learn → listen → answer → build → roleplay → maintain).
This doc is the **next few sessions' plan**, set by the steering agent. Same discipline as J1–J6: each H
ships independently with a CHANGELOG entry, a HANDOFF update, a harness path, and the 320/390 + test gate.

Grounded in the code as of v.28: speech recognition **already exists** (Speaking drill only, with an iOS
shadowing self-grade fallback) but is **not** in the roleplay or production; there is **no** notification /
re-engagement system; `src/app.jsx` is ~6.65k lines; `src/data.js` ships ~1.2 MB eagerly via `<script>`.

---

## Recommended order: H1 → H2 → H3 → H4
Sharpen the base, then the biggest user-value bet (voice), then the return loop (retention), then depth.

### H1 — Stabilize & sharpen *(foundation; mostly invisible, high future-velocity)* — IN PROGRESS (v.29)
Six features shipped fast onto a 6.65k-line monolith. Pay it down before building more.
- **DONE (v.29):** ① **regression sweep** — 320px overflow clean across home/library/stats/browse/tutor/
  scenarios/mission/roleplay/journeypath/maintenance/progmax/arccomplete (the only "past-edge" hits are
  `aria-hidden` confetti inside `overflow:hidden`, no real scroll); first-run + daily home spot-checked,
  no J1–J6 regressions. ② **modularization kicked off + proven:** `PAL` → `src/lib/palette.js` (build
  concatenates lib first; validate + 26/26 + identical render). Pattern + TDZ rule recorded in
  `docs/MODULARIZATION-PLAN.md` §0b. ③ **perf assessed:** ~461 KB gzipped cold load (app 83 + data 378),
  GH-Pages-gzipped + SW-cached after first load = one-time cost; vocab `V` (964 KB raw) dominates and is
  needed at first interaction so can't be deferred; deferring drill-only data (DIALOGUES/CLOZE/VERBS/EXAM/
  CONFUSION) is a small, low-priority future win not worth the two-script/SRI/race complexity now.
- **DONE (v.30):** ④ **icon system** (`ICONS`/`SOLID_ICONS`/`Icon`/`IconBadge`/`ProgressIcon`/`ICO_*`/
  `playIconTap`, ~135 lines) → `src/components/icons.jsx` — validate + 26/26 + icons render everywhere;
  app.jsx 6655 → 6520. Surfaced + recorded the **alphabetical-sort ordering trap** for `src/lib/` files
  (`MODULARIZATION-PLAN.md` §0c) before it bites the next extraction.
- **NEXT (continue H1):** `src/lib/constants.js` with **only PAL-independent** constants (LEVELS /
  LEVEL_TITLES / CHAPTERS / SRS_INTERVALS / MASTERY_STREAK / STREAK_MILESTONES — leave `LEVEL_COLOR` in
  app.jsx, it reads PAL at module-load and would sort before palette.js). Then pause stateless Phase 1 and
  take Phase 2 (context + screens) as its own dedicated session (that's where behaviour risk lives).
- **Full regression sweep** with the visual-audit harness across every screen at 320 + 390, including the
  new journey flows (J1–J6: journeypath, arccomplete, roleplay, roleplaychat, maintenance). Fix anything
  the rapid streak introduced. Refresh `docs/VISUAL-AUDIT-*` to 100%.
- **Begin the verified modularization** (`docs/MODULARIZATION-PLAN.md` — build already concatenates
  `src/lib`/`src/components`/`src/screens`, byte-identical gate). Move out the safe, self-contained pieces
  first (icons, color/constants, pure helpers, data-shaping). Each split verified by an identical `app.js`.
- **Perf check:** measure cold load; `data.js` is ~1.2 MB eager. Consider splitting rarely-first-needed
  data (exam sets, confusion pairs, full dictionary) behind a lazy fetch so first paint is lighter.
- *Risk: Low-Med (refactor). Mitigated by the byte-identical build + the audit harness. Deliver: a clean,
  audited, faster, navigable base — also a gift to the agent who inherits the file.*

### H2 — Voice-first: speak the journey *(the biggest user-value leap; extends J4)* — IN PROGRESS (v.31)
Settling-in German is a **spoken** skill. The engine exists; it's just not where it matters most.
- **DONE (v.31) — speak your roleplay turn (J4):** wired the existing `SpeechRecognition` into the "Do it
  for real" chat. A gold **mic button** in the input row (its own recogniser — `rpListening`/`rpRecogRef`,
  de-DE, interim results stream live into the input so the learner reviews/edits before sending); red halo
  while listening; mic stops on send + on leaving the screen. iOS / no-ASR → mic hidden, placeholder reverts
  to type-only (graceful, same as Speaking mode). Verified via harness `roleplayvoice` (stubs
  `window.SpeechRecognition`); verdict path unaffected; 320px clean.
- **DONE (v.32) — two-way voice (hear the other person back):** a persisted **"Voice"** toggle in the
  roleplay header (default on) auto-plays the other person's German lines via TTS — opener + every reply —
  so it's a real spoken back-and-forth, not just spoken input. Starting the mic cancels any playing TTS (so
  it isn't recorded); TTS also stops on leaving the screen. Verified via `roleplayvoice`; 320px clean.
- **H2 essentially complete.** Deliberately **skipped "spoken Production answers"** — that already exists as
  the dedicated **Speaking** drill mode (English prompt → say the German, ASR-graded); adding it to Production
  would just duplicate it. **Deferred (small, low-value):** unify the three mic surfaces (Speaking / roleplay)
  into one `useSpeechInput` hook — fits the **modularization** lane (H1), not a user-facing item. TTS already
  has voice-pick + rate. *Net: you can now hold the café/clerk conversation entirely out loud.*

### H3 — The return loop: retention & re-engagement *(turn a one-time journey into a daily habit)* — ✅ DONE (v.33–34)
A settling-in app is used over months; today there's no reason to come back tomorrow.
- **PRE-EXISTING (found, not built):** the **machinery was already here and is solid** — opt-in **local
  reminders via Notification Triggers** (`showTrigger`/`TimestampTrigger`, server-less, schedules a week,
  foreground-timer fallback, reschedules on app open; the correct no-backend approach) AND a full
  **streak-freeze** system (banked freezes auto-absorb missed days, with a "streak saved" notice). So H3 is
  *connecting* these to the journey, not building re-engagement from scratch. **No backend = no true
  background push** beyond what Notification Triggers allow (Chromium); iOS stays best-effort-while-open.
- **DONE (v.33) — journey-aware re-engagement:** the reminder body is no longer generic. `reminderBodyRef`
  is kept fresh from live journey state and read at schedule time: **"{N} earned scenarios slipping — a few
  minutes keeps them sharp"** (the J5 maintenance nudge), else **"Continue your journey: {current mission}"**,
  else the generic line. Re-engagement now pulls you back to *the journey*, by name.
- **DONE (v.34) — P3b daily-goal reframe:** the home "Today" panel now reads as *journey upkeep* — a
  subtitle under the ring ("Keep your journey sharp — {N} scenarios need a refresh" / "A few minutes keeps
  your earned scenarios sharp") and the goal-reached caption flips to "✓ Journey kept sharp" when nothing's
  slipping. The card-count mechanic is untouched; only the framing now ties the daily loop to the journey.
- *Shipped. (Optional future: a streak-at-risk in-app banner late in the day; fold Due/Weak into the
  maintenance frame.) Deliver: the daily habit reads as keeping your journey alive, and the nudge names it.*

### H4 — Depth & correctness *(make every mission rich and right)* — ✅ DONE (v.35–36)
The journey frame is done; now fill it out. Mostly content lane — but I own correctness.
- **DONE (v.35) — multi-scene coverage complete:** the 24 single-scene missions each got a 2nd dialogue
  (DIALOGUES 128 → 152); **all 58 missions are now 2-scene**. Each new scene advances the scenario to a
  distinct beat (not a repeat), authored at the mission's level (B1/B2) + 2 questions, via the idempotent
  splice tool `scripts/h4-second-scenes.mjs`. Validate OK; 0 single-scene remain.
- **DONE (v.36) — early build-sentences + correctness pass:** the early A2/B1 missions (post, landlord,
  workhours, sim) brought from 1 → **3 build-sentences** each (SENTENCES 243 → 251, via
  `scripts/h4-build-sentences.mjs`; the validator caught a global-duplicate sentence — swapped it). Ran a
  structural correctness check over all 24 new dialogues (6–9 lines, de+en present, 3 opts, correctIdx in
  range — all clean) and authored the German at level with care.
- **Honest residue (ongoing content-lane, low-priority):** ~37 mid/late **B1/B2 missions still have a single
  build-sentence** (functional — the "Build" step is a bonus and works with one); a deeper *native-level*
  proofread of the new dialogues is worth a content-lane pass. Neither blocks anything.
- *Deliver: no thin missions (every mission 2-scene), early funnel has 3 buildable sentences, German
  validated.*

---

## Horizon status — ✅ COMPLETE (H1–H4, v.29–36)
- **H1** ✅ stabilize & sharpen — regression sweep, modularization started (`palette.js` + `icons.jsx`,
  app.jsx 6655→6520, ordering trap recorded), perf assessed.
- **H2** ✅ voice-first — speak the J4 roleplay (mic) **and** hear it back (auto-TTS toggle); two-way
  spoken conversation. (Production-voice intentionally skipped = the existing Speaking drill.)
- **H3** ✅ retention — journey-aware reminders + daily-loop reframed as journey upkeep. (Reminder +
  streak-freeze machinery pre-existed.)
- **H4** ✅ depth — all 58 missions multi-scene; early missions to 3 build-sentences; correctness pass.

**Open follow-ons for the returning agent** (none blocking; working through them post-horizon):
- ✅ **P7-deeper (v.37):** the Tutor now bridges chat → a drill on your weak words — a persistent
  "Practise my N weak words → {preview}" bar above the chat input launches the existing SRS weak-review,
  and the Tutor system prompt knows it can suggest tapping it.
- ⬜ finish `src/lib/constants.js` + Phase-2 screen modularization; unify the mic surfaces into one hook;
  build-sentences for the remaining B1/B2 missions; a native-level German proofread; Library→"Learn" rename;
  a11y recheck of the new screens.

---

## Parallel / anytime (small, independent)
- **Library → "Learn" tab rename** (noted in `docs/P6-curriculum-spec.md`).
- **P7 deeper:** the Tutor launches a drill on your weak words from chat (spec in `docs/P7-tutor-context-spec.md` §out-of-scope).
- **Accessibility re-check** after H1/H2 (mic controls, new journey screens) — re-run the AA pass from v.14.

## Guardrails (don't regress these)
- Never hand-edit generated files (app.js / built data.js / index.html SRI / service-worker cache).
- `auto` level default; deck is ~37% B2 — never flood beginners with a flat pool.
- Every card-layout change → run the long-content regression paths (`longword|longprompt|longcando`).
- Adding a dialogue does nothing unless its title is appended to the mission's `dialogues` array.
