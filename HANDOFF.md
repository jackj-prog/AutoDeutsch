# HANDOFF — resume here

**This is the single "where are we" doc. If you're an agent returning to this repo, read this first,
then `ROADMAP.md` (what's planned/done) → `CHANGELOG.md` (what shipped, newest at top) → `AGENTS.md`
(protocol + claims).** Keep this file current: whenever you change the state of the world (ship a
feature/fix, start or pause something, hand work off), update the relevant section below in the same
commit. It should never be more than one session stale.

---

## Operating mode (read this)
- **2026-06-20 → ~2026-06-27: single agent (Claude, app.jsx owner) is driving BOTH lanes** (app +
  content/tooling/docs). The second agent is away this week, then **takes over full operation**.
- Because it returns to drive everything, the bar for recording is: *anyone could resume from these
  docs alone.* No silent changes. Every ship = a CHANGELOG entry; every state change = a HANDOFF edit.
- The parallel-work protocol in `AGENTS.md` still stands for when two agents overlap again. While solo,
  the deploy-lock/claims dance is a formality, but **keep logging** as if handing off — because you are.

## Current deployed state
- **Live build: `2026.06.20.35`** (see `APP_VERSION` in `src/app.jsx` and the top of `CHANGELOG.md` for
  the exact number; bump it every app deploy). Deploys to GitHub Pages from `main`.
- The app is a single React file `src/app.jsx` (~6k lines, Babel-standalone, no JSX build step) + content
  in `src/data.js`. `node build-static.mjs` compiles app.jsx→app.js, copies data.js, refreshes index.html
  SRI hashes, and bumps the service-worker cache. **Never hand-edit app.js / built data.js / SRI / cache.**
- Content totals (last validate): 5,782 vocab · 229 cloze · 92 verbs · 243 sentences · **152 dialogues** ·
  87 imperatives · 58 missions · 40 confusion-pairs · 24 exam-sets · 40 placement-items · 58 mission-vocab. (All 58 missions are now multi-scene.)

## What the app is (one paragraph)
A German trainer for people **settling in a German-speaking country**. The spine is a **journey**: 7
mission arcs (Touchdown → … → Belonging) × 58 missions, each a real-life scenario. A mission teaches its
**exact words** (MISSION_VOCAB) → plays them in a **scene** (dialogues) → tests them in **questions** →
produces them as **sentences** (build-the-sentence bonus). Around that: SRS recall/production/typed
drills (article/plural/cloze/verb/imperative/listening/confusion/exam), a **placement test** (P5), a
**capability/CEFR** Progress screen, an **AI Tutor** (BYO-key, now context-aware), and a **Library** that
opens on the curriculum with the 36-category taxonomy demoted to a "Dictionary" reference.

## Recently shipped this solo stretch (newest first — full detail in CHANGELOG)
- **v.35** H4 (content depth): **every mission is now multi-scene** — the 24 single-scene missions each got a
  2nd dialogue (DIALOGUES 128→152), each advancing the scenario to a new beat, authored at B1/B2 + 2 questions.
  Idempotent splice tool `scripts/h4-second-scenes.mjs`. Validate OK; all 58 missions multi-scene. (H4's main
  remaining items: a few more early-mission build-sentences + a German correctness audit.)
- **v.34** H3 step 2 / **P3b — H3 COMPLETE**: home "Today" panel reframed as **journey upkeep** (subtitle
  "Keep your journey sharp — {N} scenarios need a refresh" / "A few minutes keeps your earned scenarios
  sharp"; goal-reached caption → "✓ Journey kept sharp"). Card-count mechanic untouched. Retention horizon
  done (journey-aware reminders v.33 + daily-goal reframe v.34; reminders + streak-freeze pre-existed).
- **v.33** H3 step 1 (retention): **journey-aware reminders** — the daily-reminder body now names the slipping
  earned scenarios ("{N} scenarios slipping…") / current mission, via `reminderBodyRef`. The retention
  *machinery* (Notification-Triggers reminders + streak-freeze) already existed; this connects it to the
  journey. No backend → no true background push beyond Notification Triggers (Chromium).
- **v.32** H2 step 2 (voice): **two-way spoken roleplay** — a persisted "Voice" toggle (default on) auto-plays
  the other person's German lines (opener + replies); mic cancels TTS so it isn't recorded; TTS stops on leave.
  **H2 essentially complete** (you can hold the scenario out loud). Skipped Production-voice (= the existing
  Speaking drill); mic-unify deferred to the modularization lane.
- **v.31** H2 step 1 (voice): the **J4 roleplay can now be spoken** — a mic button in the input row wires the
  existing `SpeechRecognition` (de-DE) into the chat (own recogniser `rpListening`/`rpRecogRef`; interim
  transcript → input → review → send; mic stops on send/leave). iOS/no-ASR → mic hidden, type-only (graceful).
- **v.30** H1 step 2 (modularization): icon system (~135 lines) → `src/components/icons.jsx`; app.jsx
  6655→6520. Recorded the **alphabetical-sort ordering trap** for `src/lib/` files (`MODULARIZATION-PLAN.md`
  §0c). Next: `src/lib/constants.js` with PAL-independent constants only.
- **v.29** H1 step 1 (stabilize & sharpen — see `docs/NEXT-HORIZON.md`): regression sweep (320px clean
  across all J1–J6 flows); **modularization kicked off** — `PAL` → `src/lib/palette.js`, proven (build
  concatenates `src/lib`→`src/components`→`src/screens` before `app.jsx`; validate + 26/26 + identical
  render; pattern in `MODULARIZATION-PLAN.md` §0b); perf assessed (~461 KB gz, SW-cached, no split needed).
  Next: icon system → `src/components/icons.jsx`.
- **v.28** J6 (personalization + arc narrative): Scenarios spotlights the learner's **goal arc**
  ("🎯 Your goal points at {Arc}" + a "YOUR GOAL" chip; `Working in German`→Job, `Settling in`→Belonging;
  soft — path order untouched). New **`intro`** field on all 7 `MISSION_ARCS` opens each expanded chapter
  as a story beat. **Completes the J1–J6 journey build-out** (app side). Remaining: multi-scene content
  depth for ~24 single-scene missions = additive content-lane job. Harness: `journeypath` seeds a goal.
- **v.27** J5 (unify progression + daily-maintains-journey): one spine — role = headline, **scenarios
  completed = the journey** (primary metric), **CEFR = language-level sub-metric** (Progress panel 2
  renamed; Home CEFR card gets a "Language level" eyebrow; panel 1 gains a "{done}/58 scenarios" bar).
  New `journeyMaintenance` (completed missions whose scene words went due) → green **"Keep your journey
  sharp"** Home card naming the slipping scenarios → `startJourneyRefresh` drills those exact words.
  Harness: `maintenance`. (J1–J5 done; **J6 = content depth/personalization, largely content-lane**.)
- **v.26** J4 (mission roleplay climax): every mission ends with **"Do it for real"** — a live roleplay
  where the **Tutor becomes the other party** (café server, clerk…), stays in German/in character,
  then on Finish returns a **verdict** (Passed/Almost/Keep practising + went-well/to-improve). Credits a
  bonus `roleplayed` step (doesn't gate the 3-step completion). **No-key fallback** = scripted self-check
  (real phrases to rehearse + self-rate). Own chat state (`rpMsgs`/`rpVerdict`), own roleplay system
  prompt (`buildRoleplaySystem`), reuses the BYOK Anthropic path. Harness: `roleplay`, `roleplaychat`
  (mocked endpoint). (J1/J3/J2/J4 done; **J5 next** = unify progression + daily-maintains-journey.)
- **v.25** J2 (journey as a felt path): the **Scenarios** screen is now a **map you walk** — an overview
  header (role + {done}/58 + progress bar), arcs as **foldable chapters** (only the active arc open by
  default; completed/future collapse to a summary row), the active arc tagged **"YOU ARE HERE"**, and
  missions on a **connected vertical trail** (green node dots fill as you complete; current = gold
  pulsing node). New `arcOpen` fold state. Harness: `journeypath` (`journeyMid` seed). (J1/J3/J2 done.)
- **v.24** J3 (arc-as-chapter): finishing an arc's last mission fires a **full-screen "CHAPTER
  COMPLETE"** celebration — green arc badge, "{Arc} complete", a one-line **payoff** (new field on
  all 7 `MISSION_ARCS`), and a "Next chapter →" hint. New `arcCeleb` state + arc-complete detection
  in `markMissionStep`, queued through `celebQueueRef` (lands on Home behind any rank-up). Scenarios
  arc header now shows green + payoff + "✓ Complete" when the arc is done. Harness: `arccomplete`.
  (J1 and J3 done; J2/J4/J5/J6 next per `docs/JOURNEY-ROADMAP.md`.)
- **v.23** J1 (journey build-out): Home is now **journey-first** — the gold "Continue your journey →
  {mission}" hero leads Home; SRS review + custom-session CTAs demoted to calm cards. Full journey
  plan in `docs/JOURNEY-ROADMAP.md` (J1 done; J2–J6 next: arc-as-chapter, felt path + map, roleplay
  climax, unify progression, personalization/content depth).
- **v.22** Seamless journey playthrough: finishing a mission step returns to the mission ("Continue
  mission →"), not Home. Results screen is mission-aware via `missionReturnRef` + `returnToMission`
  (which trims dead session/results frames from the back-stack).
- **v.21** Back-navigation now follows history (a real back-stack), instead of every Back button
  hard-coding Home/scenarios — being "three clicks deep" and pressing Back returns to the previous
  screen, not Home. (`goBack`/`goRoot` near the `screen` state in app.jsx.)
- **Content**: +6 second dialogue scenes for single-scene B1 missions (krankenkasse, dentist, rundfunk,
  kaution, schufa, neighbours) — richer "Listen" step (now 2 dialogues each), wired into each mission's
  `dialogues`. *(This was the work the other agent had in flight when it ran out of credits — it was never
  committed, so I rebuilt it from the pasted content and integrated + validated it.)*
- **v.20** Fixed long German words clipping off the card (`fitWordSize` + overflow-wrap) + a longest-content
  regression pass (`shoot.mjs longword|longprompt|longcando`).
- **v.19** Wired the content lane's two hand-offs: MISSION_VOCAB learn-step + "Build the sentence" bonus step.
- **v.18** P6: Library → Curriculum (journey front door; taxonomy → "Dictionary").
- **v.17** P7-inc-1: context-aware AI Tutor (prompt + starters built from the learner's live data).
- **v.16** answer-reveal colour semantics (correct answer = green).
- **v.15** PWA/installability (font in <head>, manifest id/scope/lang/maskable).
- **v.14** a11y + correctness (WCAG-AA red text + CEFR rows, modal focus-trap/Escape, UTC date off-by-one,
  verb cap 30→92, empty-pool guard).
- **v.13** Articles/Plural tiles drill the right mode; 320px typed-drill submit-button overflow.

## In flight / partially done
- **Nothing half-built right now.** The repo is clean at the latest commit. The **J1–J6 journey
  build-out is complete on the app side** (v.23–28; full plan + status in `docs/JOURNEY-ROADMAP.md`).
  (If you pause mid-task, record it HERE with the file + line + what's left.)

## Open hand-offs & next candidates (pick from here)
- **▶ THE PLAN — `docs/NEXT-HORIZON.md`** (set by the steering agent after J1–J6): **H1** stabilize &
  sharpen (regression sweep + begin modularization + perf) → **H2** voice-first (speak the J4 roleplay /
  production; unify mic UX) → **H3** retention (re-engagement/notifications within PWA limits, streak
  safety, P3b) → **H4** depth & correctness. Start at H1 unless told otherwise.
- **★ Journey content depth (content lane, no app change) — the main remaining journey item:** finish
  **multi-scene coverage** for the ~24 single-scene missions (each gets a 2nd dialogue so the "Listen"
  step is 2 scenes — same pattern as the 6 already added; append the title to the mission's `dialogues`
  array or it won't wire). Plus 2–3 build-sentences on early A1/A2 missions (only ≥1 guaranteed today).
  All additive `src/data.js` + validator-checked. The app already renders whatever's there.
- **ROADMAP open items:** P3b (daily-goal reframe). P7 deeper (Tutor launches a drill on your weak words
  from chat) — spec in `docs/P7-tutor-context-spec.md` §out-of-scope. Library tab rename ("Library"→"Learn")
  noted in `docs/P6-curriculum-spec.md`.
- **Maintainability:** `src/app.jsx` is large; `docs/MODULARIZATION-PLAN.md` has a verified, byte-identical
  split path (build already concatenates `src/lib/`,`src/components/`,`src/screens/`).

## Gotchas / lessons (don't relearn these the hard way)
- **Audit blind spot, now fixed:** the visual audit only ever drove *short* words, so a fixed-font
  long-word clip reached a user. **Content-length extremes (longest word/gloss/can-do/category) belong in
  the audit set alongside the 320px width sweep.** Regression paths exist (`shoot.mjs longword|longprompt|
  longcando`); use them after any card-layout change.
- **Two screens are tested as `mission.dialogues` titles** — adding a dialogue does nothing for a mission's
  Listen step unless you ALSO append its title to that mission's `dialogues` array. Validator catches a
  bad title but NOT a missing wire.
- **Parallel rebase dance:** when both agents push `main`, rebase, take *either* side on generated files
  (app.js/data.js/index.html/service-worker.js), then **re-run `npm run build`** and push. Keep both
  CHANGELOG entries on a log conflict.
- **`auto` level default**, never flat `all`; deck spans A1–B2 (~37% B2) — a flat pool swamps beginners.

## Quick reference
```
npm run validate     # must print "OK — no errors"
npm test             # must be 26/26
# bump APP_VERSION in src/app.jsx, then:
node build-static.mjs
git fetch origin main && git rebase origin/main
git push origin HEAD:main            # deploys (GitHub Pages)
node scripts/shoot.mjs <screen ...>  # visual check → screenshots/  (SHOOT_PERSONA, SHOOT_WIDTH=320)
```
