# Modularization plan — splitting `src/app.jsx` for parallel two-agent work

**Goal:** let two agents each take a *big app-feature task* at the same time without colliding. Today
`src/app.jsx` is one ~5,900-line file, so it's a **single-writer** resource — only one agent can hold it.
Splitting it into per-owner module files makes ownership **file-level**, so two agents can churn different
screens/engines in parallel. (This is also the #1 maintainability item from `docs/APP-AUDIT-2026-06-20.md`.)

## 0. Build support — DONE (no behaviour change)
`build-static.mjs` now concatenates, in this order, **before** `src/app.jsx`, any `*.js`/`*.jsx` in:
`src/lib/` → `src/components/` → `src/screens/` (sorted within each dir). It's one compilation unit / one
IIFE scope, so files **share globals exactly like the single file did — no ES `import`/`export` needed**.
Verified: with none of those dirs present the compiled `app.js` is **byte-identical** to before; a file
dropped into `src/lib/` is compiled in; removing it restores the identical output. So the pipeline is ready
**now** and the split can land incrementally, one file at a time, each independently shippable.

## 0b. PROVEN (v.29, H1 step 1) — `src/lib/palette.js`
First real extraction landed: `const PAL` (the palette) moved out of `app.jsx` into `src/lib/palette.js`.
The build concatenated it (lib is first), `npm run validate` + 26/26 tests passed, and the home/scenarios/
stats screenshots render **identically** (colours + icons intact). The pipeline works for a real extraction.
**Correction to §0's wording:** "byte-identical" describes the build *plumbing* being inert when the dirs
are empty — an actual extraction **reorders source, so `app.js` bytes change**. Verify each extraction by
**validate + 26/26 + a visual sweep** (the app white-screens or loses styling/icons if a scope/order ref
breaks), not by diffing `app.js`. The TDZ rule that makes this safe: components/data referenced only at
*render* time (not module-load) can live in a file concatenated after their consumers; pure data/constants
referenced at module-load must be concatenated **before** their consumers (lib → components → screens → app).

## 1. Scope rules (because it's one shared scope)
- **No duplicate top-level names across files.** Everything concatenates into one scope, so two files
  can't both declare `const A = …`. Keep the existing module-scope names unique (they already are).
- **Order matters for `const`/arrow definitions; function declarations hoist.** The build order is
  lib → components → screens → app. A screen that references a helper is fine (helper is earlier). `App`
  (in `app.jsx`, last) may reference screen components defined earlier. Keep cross-file refs pointing
  "backwards" in that order, or use `function Foo(){}` declarations (hoisted) for anything referenced earlier.
- **No new runtime deps, no bundler.** Still Babel-standalone over the concatenated source. SRI + SW-cache
  mechanics are unchanged (still one `app.js` output).

## 2. Target structure (grounded in current line ranges)
Pure, stateless layers extract trivially (no React state crosses the boundary):

| New file | Pulls from app.jsx | Contents |
|---|---|---|
| `src/lib/constants.js` | ~118–680 | `LEVELS`, `LEVEL_TITLES`, `LEVEL_COLOR`, `CHAPTERS`, `SRS_INTERVALS`, `MASTERY_STREAK`, `STREAK_MILESTONES`, palette, `APP_VERSION` |
| `src/lib/srs.js` | 35–60, grading | `nextBox`, `normalizeEntry`, `checkMatch`, `within1Edit`, box/leech/due helpers |
| `src/lib/rules.js` | gender/plural/verb | grammar-rule helpers + the example highlighter |
| `src/lib/audio.js` | 225–540 | `speak`/TTS, `playSfx`, `SPEECH_REC_CTOR` + recognition helpers |
| `src/components/primitives.jsx` | ~810–1064 | `Icon`, `IconBadge`, `Btn`, `ProgBar`, `CountUp`, `Confetti`, `GrammarNote`, `RootErrorBoundary` |

Stateful screens move once a context exists (Phase 2):

| New file | app.jsx screen block | 
|---|---|
| `src/screens/home.jsx` | `screen === "home"` (4160) |
| `src/screens/session.jsx` | `cards` (5088) + `drill` (5222) + `sentence` (5455) + `results` (5740) |
| `src/screens/journey.jsx` | `scenarios` (5486) + `mission` (5528) + `dialogues` (5564) |
| `src/screens/progress.jsx` | `stats` (4797) |
| `src/screens/library.jsx` | `library` (4583) + `browse` (4725) |
| `src/screens/train.jsx` | `train` (4517) + `audio` (5628) |
| `src/screens/settings.jsx` | settings modal + `onboarding` + `tutor` (4677) |

`src/app.jsx` shrinks to: state, effects, handlers, derived memos, the **AppContext provider**, and a thin
`screen → component` router.

## 3. Migration sequence (each step ships independently; validate+test+build+shoot each)
**Phase 1 — stateless extractions (low-risk, immediate parallel-enabler).** Move the five `src/lib` +
`src/components` files out of app.jsx with **zero logic change** (cut/paste, fix nothing). No state threads
through them, so the build's shared scope makes this purely mechanical. After Phase 1, ~1,000 lines live in
files a *second* agent can own (the "engine + primitives" lane) while the first owns `App`. This alone
unblocks one extra parallel surface with almost no risk.

**Phase 2 — Context + screens (incremental).** Introduce one `AppContext` (or a few slices:
`SessionContext`, `ProgressContext`) in `app.jsx` exposing `{ state, setters, handlers, derived }`. Then move
screens out **one per commit**, each rewritten from "inline block closing over App's locals" to
"`function HomeScreen(){ const ctx = useContext(AppContext); … }`". One screen per PR keeps every step
reviewable and revertable. Order by independence: journey → progress → library → train → session → home.

**Guardrail:** do Phase 1 fully before Phase 2 (the context refactor is where behaviour risk lives; keep it
separate from the no-risk cut/paste).

## 4. Ownership & the parallel-epic model (see AGENTS.md)
Once split, each big task = a vertical epic with a **non-overlapping file footprint**, recorded in the
module-ownership map in AGENTS.md. Example simultaneous epics:
- Agent A: **"P6 Library→Curriculum"** → owns `src/screens/library.jsx` (+ `journey.jsx`).
- Agent B: **"P3b daily-loop reframe"** → owns `src/screens/home.jsx` + `src/lib/srs.js`.
- (Plus the content/data/tooling lane as always.)
They only touch `src/app.jsx` (the shared router/provider) for the brief moment they register a new screen —
keep that to a one-line edit, claimed via the deploy-lock, or have one agent own `app.jsx` as "the shell."

## 5. Who executes this
Phase 1 + 2 edit `src/app.jsx`, so the **app.jsx owner** runs them (or whichever agent is handed `app.jsx`
exclusively for the refactor as a dedicated epic). The build support (§0), this plan, and the protocol update
are already done in the content/tooling/docs lane. Recommended kickoff: assign the split as one agent's next
big task (claim `src/app.jsx (EXCLUSIVE)`), pair it with a content/data epic for the other — then from the
*following* round on, both can run app-feature epics in parallel.
