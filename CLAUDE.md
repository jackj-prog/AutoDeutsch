# CLAUDE.md — start here

You are taking over **AutoDeutsch**, an offline-first German-learning PWA. This file loads
automatically; it's your front door. Read it, then open the docs it points to.

## Read these, in order
1. **`HANDOFF.md`** — the single "where are we" doc: current build, what shipped, what's in flight,
   open hand-offs, gotchas. **Always read first.**
2. **`docs/APP-ANALYSIS-2026-06-22.md`** — a measured, plain-language map of the codebase as it
   actually is (structure, traps, content balance, what to do next).
3. `ROADMAP.md` (status) → `CHANGELOG.md` (what shipped, newest at top) → `AGENTS.md` (protocol).

## The 30-second mental model
- **Two source files matter:** `src/app.jsx` (the whole engine + UI — one big React component,
  ~6.7k lines) and `src/data.js` (all learning content). Everything else is generated or tooling.
- **No bundler, no router, no `import`/`export`.** Babel compiles JSX in the browser; the build
  concatenates `src/lib/ → src/components/ → src/screens/ → src/app.jsx` into one scope.
- **`app.js`, the built `data.js`, `index.html`, `service-worker.js` are BUILD PRODUCTS.**
  Never hand-edit them. Edit `src/`, then run the build.

## The deploy flow (every change)
```bash
npm run validate        # must print "OK — no errors"
npm test                # must be 26/26
# bump APP_VERSION in src/app.jsx (format YYYY.MM.DD.NN) on meaningful changes
node build-static.mjs   # compiles app.jsx→app.js, copies data.js, refreshes SRI, bumps SW cache
git fetch origin main && git rebase origin/main
git push origin HEAD:main
```
A clean rebuild leaves `git status` empty — that's how you know the build matches source.

## Three things that will bite you if you forget
1. **User data lives under legacy `gfc-*` localStorage keys** (the app used to be "GermanFlashCards").
   There's no server — the key *is* the account. **Renaming `gfc-*` keys wipes every user.** Don't.
2. **No `overflow-x:hidden` on html/body** — it breaks the fixed bottom nav. Overflow is killed at
   source with `minmax(0,1fr)` + `minWidth:0` + ellipsis.
3. **Bump `APP_VERSION`** so the running build is verifiable in Settings, and **bump the SW cache**
   (the build does this automatically) or installed PWAs won't update.

## Recording discipline (non-negotiable)
Assume the next agent has zero memory. Every ship → a `CHANGELOG.md` entry (newest at top); every
state change → a `HANDOFF.md` edit, **in the same commit**. No silent changes.

Current live build: **`2026.06.23.01`** · tree clean · validate OK · 26/26. You're driving now.
