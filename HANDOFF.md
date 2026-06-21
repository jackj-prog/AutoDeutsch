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
- **Live build: `2026.06.20.x`** (see `APP_VERSION` in `src/app.jsx` and the top of `CHANGELOG.md` for
  the exact number; bump it every app deploy). Deploys to GitHub Pages from `main`.
- The app is a single React file `src/app.jsx` (~6k lines, Babel-standalone, no JSX build step) + content
  in `src/data.js`. `node build-static.mjs` compiles app.jsx→app.js, copies data.js, refreshes index.html
  SRI hashes, and bumps the service-worker cache. **Never hand-edit app.js / built data.js / SRI / cache.**
- Content totals (last validate): 5,782 vocab · 229 cloze · 92 verbs · 243 sentences · **128 dialogues** ·
  87 imperatives · 58 missions · 40 confusion-pairs · 24 exam-sets · 40 placement-items · 58 mission-vocab.

## What the app is (one paragraph)
A German trainer for people **settling in a German-speaking country**. The spine is a **journey**: 7
mission arcs (Touchdown → … → Belonging) × 58 missions, each a real-life scenario. A mission teaches its
**exact words** (MISSION_VOCAB) → plays them in a **scene** (dialogues) → tests them in **questions** →
produces them as **sentences** (build-the-sentence bonus). Around that: SRS recall/production/typed
drills (article/plural/cloze/verb/imperative/listening/confusion/exam), a **placement test** (P5), a
**capability/CEFR** Progress screen, an **AI Tutor** (BYO-key, now context-aware), and a **Library** that
opens on the curriculum with the 36-category taxonomy demoted to a "Dictionary" reference.

## Recently shipped this solo stretch (newest first — full detail in CHANGELOG)
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
- **Nothing half-built right now.** The repo is clean at the latest commit. (If you pause mid-task, record
  it HERE with the file + line + what's left.)

## Open hand-offs & next candidates (pick from here)
- **Content depth (no app change):** the early A1/A2 missions a beginner hits first could use 2–3
  build-sentences each (only ≥1 guaranteed today). More second-scenes for any remaining single-dialogue
  missions. Both are additive `src/data.js` + validator-checked.
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
