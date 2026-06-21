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

### H2 — Voice-first: speak the journey *(the biggest user-value leap; extends J4)*
Settling-in German is a **spoken** skill. The engine exists; it's just not where it matters most.
- **Speak your roleplay turn (J4):** wire the existing `SpeechRecognition` into the "Do it for real"
  chat — tap-to-talk, transcribe into the input, send. The roleplay becomes a real *spoken* conversation,
  not typing. iOS → keep the type fallback (already the no-ASR path elsewhere).
- **Spoken answers in Production** (optional, behind a mic toggle), reusing the Speaking-mode recogniser.
- **Unify the mic UX + iOS shadowing fallback** into one component so Speaking / roleplay / production
  behave identically; tidy TTS output (voice pick, rate) while there.
- *Risk: Med (browser ASR is inconsistent; iOS Safari has no SpeechRecognition). Every path needs the
  graceful type/shadow fallback. Deliver: you can hold the café/clerk conversation out loud.*

### H3 — The return loop: retention & re-engagement *(turn a one-time journey into a daily habit)*
A settling-in app is used over months; today there's no reason to come back tomorrow.
- **Re-engagement within PWA limits:** opt-in local reminders (Notification API + SW), honest about iOS
  web-push constraints. Daily-review reminder; a **J5 maintenance nudge** ("your café scenario is
  slipping"); streak-at-risk ping. No server — schedule what the platform allows, degrade gracefully.
- **Streak safety:** freeze/recovery polish so one missed day doesn't nuke momentum.
- **P3b — daily-goal reframe:** make the daily ring read as *journey upkeep*, not raw card count (ties to
  J5). Fold the generic Due/Weak cards into the maintenance frame.
- *Risk: Med (notification UX + platform limits; don't be naggy/permission-spammy). Deliver: a daily pull.*

### H4 — Depth & correctness *(make every mission rich and right)*
The journey frame is done; now fill it out. Mostly content lane — but I own correctness.
- **Finish multi-scene coverage:** the ~24 single-scene missions each get a 2nd dialogue (same pattern as
  the 6 already added; remember to wire the title into the mission's `dialogues`). Top open hand-off.
- **More build-sentences** on early A1/A2 missions (only ≥1 guaranteed today).
- **German + audio correctness audit:** spot-check dialogues/sentences for natural, correct German; check
  TTS pronunciation of tricky items. Additive `src/data.js`, validator-checked.
- *Risk: Low (additive). Deliver: no thin missions; trustworthy German.*

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
