# AutoDeutsch

**Learn the German you'll actually use** — an offline-first PWA for people **settling into life in a
German-speaking country**. The spine is a **journey**: 7 chapters × **58 real-life scenarios** (Anmeldung,
the doctor, your first day at work…) shown as a premium **map** (a centered timeline of stepping-stones).
Each mission teaches its exact words → plays them in a **scene** → tests them → has you **build the
sentences** → and finishes with **"Do it for real"**, a live AI **roleplay** where the tutor plays the
other party and you can *speak* your part.

Around that journey: SRS drills (recall/production/typed: article, plural, cloze, verb, imperative,
listening, confusion, exam), a **placement test**, a capability/CEFR **Progress** screen, an **AI Tutor**
(bring-your-own Anthropic key, context-aware), and a **Dictionary** of 5,782 words across 36 topics.
Spaced repetition, streaks (with freezes), daily goals, journey-aware reminders, 30-day trends.

**No backend, no account, no tracking** — everything lives in `localStorage` (with JSON export/import and a
daily on-device backup snapshot); the only network calls are the optional AI Tutor/roleplay, made directly
to Anthropic with your key. Installable to the home screen; works offline after first load.

## How it's put together

| File | Role |
|---|---|
| `src/data.js` | **All learning content** (vocabulary, cloze, verbs, sentences, dialogues, imperatives). Pure data — see the editing rules in its header. |
| `src/app.jsx` | The entire engine and UI (single React component tree, React 18 UMD). |
| `data.js`, `app.js`, `index.html` | The shipped build. `index.html` pins both scripts with SRI hashes, so **never edit these by hand** — run the build. |
| `service-worker.js` | Offline cache (network-first app shell). `CACHE_NAME` is auto-bumped by the build to a content hash. |

## Workflows

```bash
npm ci                # once: installs the pinned Babel used by the build (works offline after)
npm run validate      # checks src/data.js: schema, duplicate keys, sparse holes, levels
npm test              # engine unit tests (grading, SRS transitions, selection) against the built bundle
npm run build         # validates content, compiles src/app.jsx → app.js, copies data.js,
                      # and rewrites both SRI hashes in index.html
npm run check-sri     # verifies the shipped files match the hashes in index.html
```

**Editing content** is the common case: change `src/data.js`, then `npm run validate`
and `npm run build`, commit everything the build touched. Renaming a card's `de`
orphans saved progress unless you add a stable `id` — the rules are documented at the
top of `src/data.js`.

**Deploying**: run `npm run build` (compiles the engine, refreshes SRI, and auto-bumps the
service-worker `CACHE_NAME` to a content hash so devices roll forward cleanly), then merge to
`main` (GitHub Pages serves the repo). Bump `APP_VERSION` in `src/app.jsx` on meaningful
releases so you can confirm the running build in Settings.

CI runs validate + tests + the SRI check on every push.

## Visual audits (screenshots)

`scripts/shoot.mjs` renders the built bundle in headless Chromium and writes
PNGs to `screenshots/` — for design/UX review without a device. It loads the
real `data.js`/`app.js` but swaps the two CDN React tags for npm-vendored UMD
copies (the shipped `index.html` is untouched), so it works where cdnjs is
blocked. The browser tooling is kept **out** of `devDependencies` so `npm ci`
and CI stay lean — install it once per machine:

```bash
npm run shoot:setup                 # one-time: puppeteer-core + headless chromium + react UMD
npm run shoot                       # builds, then shoots screenshots/home.png
node scripts/shoot.mjs all          # home, library, stats, browse, tutor, drill
node scripts/shoot.mjs stats drill  # specific screens
```

Screenshots and the temp harness are git-ignored.

## Local preview

It's a static site — any web server works (SRI requires http, not `file://`):

```bash
python3 -m http.server 8099
# open http://localhost:8099
```
