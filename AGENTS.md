# AGENTS.md — AI collaboration guide for AutoDeutsch

Two AI agents work on this repo. This file is how they stay out of each other's way.
It replaces the old `AutoDeutsch_Roadmap_Checklist.xlsx` as the coordination surface,
together with `ROADMAP.md` (plans + status) and `CHANGELOG.md` (what shipped).

## Why text, not a spreadsheet
The `.xlsx` was binary: git couldn't diff or merge it, so concurrent edits clobbered
each other and nothing was reviewable in a commit. These three Markdown files are
diffable, greppable, and merge cleanly — especially the append-only logs below.

## Source of truth
- **`ROADMAP.md`** — prioritized initiatives + status (✅ done · 🟡 in progress · ⬜ planned).
- **`CHANGELOG.md`** — chronological build/work log. **Append newest entries at the top**
  of the relevant section; treat it as append-only so two agents adding different lines
  merge without conflict.
- **`AGENTS.md`** (this file) — protocol + the **Active work claims** table below.
- The `.xlsx` is **deprecated**; kept one transition then removed. Do not update it.

## Working in parallel — conflict-free protocol (read this first)
Two agents push to `main`, and the app is a single ~5,600-line `src/app.jsx`. To avoid
clobbering each other, follow these rules **every time**:

1. **Ownership lanes — split by file, not by region.**
   - `src/app.jsx` is a **single-writer resource.** Only one agent edits it at a time.
     Claim it exclusively in the table below (Area = `src/app.jsx (EXCLUSIVE)`) before you
     touch it; release it (mark the claim ✅) the moment you've pushed. If the other agent
     holds an open app.jsx claim, **do not edit app.jsx** — pick content/tooling work instead.
   - The other lane = **everything else in parallel**: `src/data.js` content (new dialogues,
     missions, vocab — additive), `scripts/`, `docs/` specs, tests, the screenshot harness.
     These rarely collide.
   - Rule of thumb: one agent does the **app.jsx UI/logic phase**; the other does
     **content + tooling + planning** at the same time.
2. **Claim before you touch.** One append-only row per task in the table below; mark it ✅
   when shipped. Scan open claims first; if your work overlaps an open one, choose something else.
3. **Sync right before you build & push.** `git fetch origin main && git rebase origin/main`
   immediately before `npm run build`, then push. Keep the build→push window to minutes.
4. **Never hand-merge generated files.** `app.js`, the built `data.js`, `index.html` (SRI),
   and `service-worker.js` (CACHE_NAME) are products of `npm run build`. On a rebase/merge
   conflict in any of them, take *either* side then **re-run `npm run build`** and continue —
   never resolve SRI hashes or the cache name by hand.
5. **Deploy lock.** Before you build+push, add/flip a row in the claims table to
   `🔴 DEPLOYING <build>`; push; set it back to ✅. If you see another agent's `🔴 DEPLOYING`,
   wait until it clears before you push.
6. **Small, frequent commits; append-only logs.** Add `CHANGELOG.md` entries at the *top* of
   the run-log; never rewrite another agent's lines.

## Active work claims
Before starting anything non-trivial, **add a row** here (one line, append-only). When you
finish, mark it Done in the same row. If you see another agent's open claim that overlaps
your files/area, pick something else or coordinate via a CHANGELOG note.

| Agent | Area / files | Task | Started | Status |
|---|---|---|---|---|
| Claude (Opus) | src/app.jsx (level focus), docs | Auto-chip fix + spreadsheet→Markdown migration | 2026-06-20 | ✅ done |
| Claude (Opus) | src/app.jsx (session modes, render, grading) | Speaking production mode (Web Speech recognition + shadowing fallback) | 2026-06-20 | ✅ done |
| Claude (Opus) | src/data.js (MISSIONS), src/app.jsx (scenarios/mission screens, Home card), validator | P0 — Scenario/Mission spine (per docs/P0-scenarios-spec.md) | 2026-06-20 | ✅ done |
| Claude (Opus) | src/data.js (DIALOGUES, MISSIONS) | P1 — A1 survival tier (12 A1 dialogues; Touchdown missions → A1) | 2026-06-20 | ✅ done |
| Claude (Opus) | src/app.jsx (stats/Progress screen) | P2 — can-do CEFR + capability Progress (per docs/P2-capability-spec.md) | 2026-06-20 | ✅ done |
| Claude (Opus) | src/app.jsx | P4a — capability rewards (mission-complete celebration) + identity/role progression | 2026-06-20 | ✅ done (app.jsx released) |
| Claude (Opus) | src/app.jsx | P3a — Home forward-momentum (mission next-step + status chip; goal engine untouched) | 2026-06-20 | ✅ done (app.jsx released) |
| Claude (Opus) | src/app.jsx | Fix: Scenarios screen horizontal overflow (mission-card grid blow-out) | 2026-06-20 | ✅ done (app.jsx released) |
| Claude (Opus) — content lane | src/data.js (DIALOGUES, MISSIONS), scripts/validate-data.mjs | DACH-rite scenarios (Krankenversicherung, Rundfunkbeitrag/GEZ, Mietkaution, Steuer-ID/Lohnsteuer) + validator entry-level check — feeds P4 milestones | 2026-06-20 | ✅ done (deployed → main 81b6463) |
| Claude (Opus) — content lane | src/data.js (A1 dialogues+missions, CONFUSIONS, EXAM, PLACEMENT), scripts/validate-data.mjs, docs/ | A1 on-ramps for all arcs + confusion-pair, exam-format & P5 placement datasets (+ validator + specs) | 2026-06-20 | ✅ done (deployed → main 32b8fcc) |
| Claude (Opus) — content lane | src/data.js (EXAM/CONFUSIONS/PLACEMENT deeper + 4 dialogues+missions), scripts/shoot.mjs, docs/ | Deepen practice datasets + more relocation scenes + harness paths + P5 build-spec hand-off | 2026-06-20 | ✅ done (build 7a9692b8; on branch claude/optimistic-dijkstra-kritfz, awaiting merge→main) |
| _(available to claim)_ — app.jsx owner | src/app.jsx (EXCLUSIVE) | **P5 placement flow** — data + scoring + build spec ready (`docs/P5-placement-buildspec.md`); also wireable: confusion-pair drill & exam mode (`docs/practice-data-spec.md`). Content lane is unblocked. | — | ⬜ ready to build |

## Build & deploy workflow (do this for every change)
1. Edit `src/app.jsx` (app logic) and/or `src/data.js` (content). These are the sources.
2. `npm run validate` — must print `OK — no errors`.
3. `npm test` — must be `# pass 26 / # fail 0`.
4. Bump `APP_VERSION` in `src/app.jsx` (format `YYYY.MM.DD.NN`) so the build is verifiable
   in Settings → App Updates.
5. `npm run build` — compiles app.jsx→app.js, copies data.js, refreshes SRI hashes in
   index.html, and auto-bumps the service-worker `CACHE_NAME` from a content hash.
6. `git fetch origin main` (check you're not behind the other agent), then commit and push
   to `main`. Deploys to GitHub Pages.
7. Log it: update `ROADMAP.md` status and add a `CHANGELOG.md` entry.

## Invariants — don't regress these
- **Service-worker cache must change every deploy.** `build-static.mjs` does this from a
  content hash; never hand-edit `CACHE_NAME` to a static value.
- **index.html pins app.js + data.js with SRI hashes.** Always ship a fresh build so the
  hashes match; a stale pair = blank screen.
- **No `overflow-x:hidden` on html/body.** It turns body into a scroll container and breaks
  the fixed bottom nav (dead gap). Overflow is prevented at source: grids use
  `minmax(0,1fr)` + `minWidth:0` + ellipsis. (See the NOTE comment in index.html.)
- **Deck spans A1–B2 (5,782 words, ~37% B2).** Session level defaults to `"auto"`
  (resolved to the learner's current CEFR level in `filterPool`). Don't reintroduce a flat
  `"all"` default — it swamps beginners with B2.
- **Content shape** (`src/data.js`, `V`): one card per line,
  `{de,en,pl?,ex,exEn,diff,level,hint?}`; nouns carry their article; `level` ∈ A1/A2/B1/B2.
  `npm run validate` enforces structure + flags duplicate card keys.

## Handy
- Visual check: `node scripts/shoot.mjs home library browse stats settings` (puppeteer;
  `SHOOT_PERSONA=first|daily|advanced`, `SHOOT_WIDTH=320` for overflow). Writes `screenshots/`.
- Vocab batches: author JSON keyed by canonical category, merge with
  `node scripts/merge_vocab.mjs <file>` (see `scripts/vocab_batches/AUTHORING_SPEC.md`).
