# AutoDeutsch

Offline-first German learning PWA. ~1,200 vocabulary cards across 25 categories plus
grammar cloze, verb conjugation, sentence building, imperatives, listening dialogues,
and a hands-free audio mode — with Leitner spaced repetition, streaks, daily goals,
and 30-day trends. No backend: progress lives in `localStorage` (with JSON
export/import and a daily on-device backup snapshot).

## How it's put together

| File | Role |
|---|---|
| `src/data.js` | **All learning content** (vocabulary, cloze, verbs, sentences, dialogues, imperatives). Pure data — see the editing rules in its header. |
| `src/app.jsx` | The entire engine and UI (single React component tree, React 18 UMD). |
| `data.js`, `app.js`, `index.html` | The shipped build. `index.html` pins both scripts with SRI hashes, so **never edit these by hand** — run the build. |
| `service-worker.js` | Offline cache (network-first app shell). Bump `CACHE_NAME` when deploying. |

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

**Deploying**: merge to `main` (GitHub Pages serves the repo). On meaningful releases,
bump `CACHE_NAME` in `service-worker.js` and `APP_VERSION` in `src/app.jsx` so devices
roll forward cleanly and you can confirm the running build in Settings.

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
