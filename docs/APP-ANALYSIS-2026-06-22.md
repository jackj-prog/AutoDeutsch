# App analysis — 2026-06-22 (handoff read-me)

> **Who this is for:** the AI taking over AutoDeutsch. This is a plain-language map of the app
> *as it actually is in the code today* (not how the docs wish it were) plus a ranked findings
> list. Read `HANDOFF.md` first for "where we are"; read this for "what you're inheriting."
> Every number below was measured from the repo at build `2026.06.20.50`, not estimated.

---

## Deep audit results (2026-06-22) — what was actually exercised

This isn't just a metrics pass. The following were run/inspected at runtime and data level; **no bugs
were found.** Recorded so you don't have to repeat it:

- **Data referential integrity (cross-dataset):** wrote a probe against the real datasets —
  **all clean.** 58 mission ids unique · every `mission.arc` ∈ `MISSION_ARCS` · all 58 missions have a
  `MISSION_VOCAB` entry and no orphan keys · **153/153 `mission.dialogues` refs resolve** by title ·
  **576/576 `MISSION_VOCAB` words exist in the dictionary `V`** (so the "learn the exact words" step
  always has cards) · all 94 mission-tagged `SENTENCES` point at real missions. The validator covers
  schema; this covered the *links between* datasets.
- **25 dialogues intentionally have no `questions`** (simple A1 listen-only scenes). Handled correctly —
  the comprehension mode filters to `d.questions && d.questions.length` (app.jsx:2971), so they're
  silently excluded, never an empty quiz. *(The one nit this audit surfaced — the user-facing count at
  app.jsx:4367 filtered on truthy `d.questions` while the runtime uses `d.questions && d.questions.length`
  — was hardened in build `2026.06.23.01` so the two can never diverge.)*
- **Visual audit:** rendered the built bundle headless and reviewed home, the journey map, mission
  detail, and roleplay. The VJ6 centered timeline renders premium (central spine, alternating named
  cards, chapter accents, no text/trail overlap); mission detail carries the accent chapter chip;
  roleplay shows speech bubbles + the Passed/▲improve verdict. Nothing broken.
- **Crash-safety / persistence:** every `localStorage` read is individually try/catch-guarded; the
  main progress blob has a **backup-restore fallback** (`gfc-v7` → `gfc-v7-backup`), and the new-day
  streak logic spends Streak Freezes for missed days without double-spending (app.jsx:1327–1401). Solid.
- **AI failure posture:** both Anthropic `fetch` calls are offline-guarded and translate 401/429 +
  network errors into plain-English messages, with `finally` cleanup (app.jsx:1970–2009, 2013+). Solid.

**Bottom line: the green status is real, not superficial.** The risk in this repo is *structural*
(the monolith, §2A) and *operational* (the `gfc-*` storage trap, §2B) — not latent bugs.

---

## TL;DR (60 seconds)

- **It's healthy.** Tree clean, `validate` OK, **26/26 tests**, build reproduces byte-for-byte.
  Zero `TODO`/`FIXME`, zero stray `console.log`, zero `dangerouslySetInnerHTML`. This is a
  well-kept codebase, not a rescue job.
- **The one structural smell:** the whole app is **one React component**. `App()` runs from
  line 986 to the end of the file (~**5,730 lines**, ~85% of `src/app.jsx`), holding **158**
  `useState`/`useRef` and **32** `useEffect`. It works, but it's the thing that will slow you down.
- **The one trap to respect:** localStorage keys come in **two prefixes** — 15 legacy `gfc-*`
  (the app used to be "GermanFlashCards") and 36 new `ad-*`. The user's real progress lives under
  the **`gfc-*`** keys. **Renaming them = wiping every existing user.** Don't "tidy" them.
- **Content is solid and balanced:** 58 missions across 7 arcs (7–10 each), 5,782 dictionary words.
  Vocab skews hard to B2 (see §4) — which is exactly why the engine defaults to `auto`, not `all`.

---

## 1. What the app physically is

| Thing | Reality |
|---|---|
| `src/app.jsx` | **6,717 lines.** The entire engine + UI. One `App()` component is ~85% of it. |
| `src/data.js` | **9,300 lines / 1.3 MB.** All content. 12 exported datasets: `V, CLOZE, VERBS, SENTENCES, DIALOGUES, IMPERATIVES, MISSION_ARCS, MISSIONS, CONFUSIONS, EXAM, PLACEMENT, MISSION_VOCAB`. |
| `src/lib/palette.js`, `src/components/icons.jsx` | The only extracted modules so far. Build concatenates `lib/ → components/ → screens/` **before** `app.jsx` into one IIFE scope (no import/export). |
| Built bundle | `app.js` = 362 KB raw / **87 KB gzipped** (fine). `data.js` = 1.3 MB (large but cached offline). |
| Tests | `tests/engine.test.mjs`, **26 passing**, run against the *built* bundle. |
| Build | `node build-static.mjs` — deterministic; a clean rebuild leaves `git status` empty. |

**Mental model:** there is no framework, router, or bundler. Babel-standalone compiles the JSX in
the browser. Everything is in scope of one closure. That's why "just add an `import`" doesn't exist
here, and why the file is one giant component.

---

## 2. Findings, ranked

### 🟡 A. `App()` is a 5,700-line monolith *(biggest maintainability risk, not a bug)*
158 state hooks and 32 effects in one function. Consequences you'll feel:
- Hard to reason about which `useEffect` touches which state; easy to introduce a re-render loop.
- Any two agents editing it collide instantly (hence the "single-writer" rule in `AGENTS.md`).
- **Mitigation already started:** `palette.js` + `icons.jsx` extracted; `docs/MODULARIZATION-PLAN.md`
  has the path. **Next safe extraction is `constants.js`** — but mind the *ordering trap*: files
  load alphabetically, so a `constants.js` that reads `PAL` at module-load would crash (c < p).
  Pull only self-contained constants. This is low-urgency; don't let it block feature work.

### 🟡 B. Two localStorage prefixes — `gfc-*` (legacy) vs `ad-*` (new)
The rename from GermanFlashCards → AutoDeutsch was never carried into storage keys. Live user data
(`gfc-v7`, `gfc-stats-v7`, `gfc-known-v7`, `gfc-daily-v7`, `gfc-ai-key`, …) is under `gfc-*`.
- **Do NOT migrate/rename these casually** — there's no server, so the key *is* the user's account.
  A rename strands everyone's streak, SRS history, and settings.
- If you ever do unify them, it must be a **read-old-write-new migration with a fallback**, shipped
  once, exactly like the existing `ad-level-mig-v1` flag. Treat it as a feature, not a cleanup.

### 🟢 C. AI Tutor / roleplay — security & failure posture is sound
- 2 `fetch()` calls, both to `api.anthropic.com`, **BYO key in `localStorage["gfc-ai-key"]`**, sent
  direct from the browser. No backend ever sees the key. Calls are `navigator.onLine`-guarded.
- Key-in-localStorage is the standard BYO-key tradeoff; it's only exposable via XSS, and the app has
  **no `innerHTML` injection, no third-party scripts** (React/Babel are SRI-pinned). Acceptable.
- `100` try/catch blocks — failures are handled, not thrown at the user.

### 🟢 D. Content health
- **Missions: 58, well balanced** — touchdown 10, paperwork 10, money 8, health 8, belonging 8,
  job 7, roof 7. No thin arc.
- **Vocab skews B2:** A1 1,132 · A2 1,521 · B1 1,540 · **B2 2,383**. This is *why* `filterPool`
  defaults to `auto` (resolved to the learner's CEFR level). **Never reintroduce an `all` default** —
  it buries beginners in B2. (Already an invariant in `AGENTS.md`; reaffirming because the skew is real.)
- Validator covers schema, duplicate keys, mission-refs, level holes → `OK — no errors`.

### 🟢 E. Code hygiene — clean
0 `TODO`/`FIXME`/`HACK`, 0 real `console.*` (the 2 hits are the literal text "console.anthropic.com"
in UI copy), 0 `dangerouslySetInnerHTML`, 66 `aria-*`/`role=` usages, modals focus-trapped. WCAG-AA
work already landed (see CHANGELOG `2026.06.20.14`).

---

## 3. If I were you, what I'd do next (suggestions, not orders)

Pick by user steer; none of this is blocking. In rough value order:

1. **Leave the monolith alone unless a feature forces a touch.** Modularization is real debt but
   low ROI right now and high collision risk. Only continue it (`constants.js` next) if you get a
   "make this maintainable" steer or you're about to add a big screen anyway.
2. **Content depth > new systems.** The machinery (journey, SRS, drills, placement, Tutor, roleplay)
   is all built. The cheapest wins are *more curated content*: more build-the-sentence items (B1/B2),
   a native-German proofread pass on dialogues, more scenes in any arc. This lane is collision-free
   (it's `src/data.js` only) and has standing deploy permission.
3. **The open hand-offs in `HANDOFF.md`** are the vetted backlog — arc-complete fanfare, mic-unify,
   the "Library → Learn" rename (needs a user steer because it's user-facing naming).
4. **Don't re-litigate the journey visuals.** VJ6 (centered timeline) settled the names-vs-clean
   debate the user already weighed in on. Change it only on an explicit new steer.

---

## 4. Things that will bite you if you forget them

- **Never hand-edit `app.js` / `data.js` / `index.html` / `service-worker.js`** — they're build
  products. Edit `src/`, run `node build-static.mjs`. SRI mismatch = blank screen.
- **No `overflow-x:hidden` on html/body** — it breaks the fixed bottom nav. Overflow is killed at
  source with `minmax(0,1fr)` + `minWidth:0` + ellipsis. (Comment lives in `index.html`.)
- **Build order is alphabetical** within `lib/`, `components/`, `screens/`. New cross-file refs can
  TDZ-crash. Test the build, don't assume.
- **`scripts/h4-*.mjs` are spent one-shots** — idempotent, already applied; re-running is a no-op,
  not a redo.
- **Bump `APP_VERSION`** (`src/app.jsx`, format `YYYY.MM.DD.NN`) on every meaningful deploy so the
  running build is verifiable in Settings.

---

*Measured at build `2026.06.20.50`. Re-run the numbers if the file has grown — the method is just
`wc -l`, `grep -c`, and `npm run validate`.*
