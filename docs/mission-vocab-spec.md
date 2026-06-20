# Mission vocab — "learn exactly what you're tested on" (data + integration spec)

Status: **data ready → app build pending**. This closes the syllabus→test loop the journey was missing:
today a mission's **"Learn the words"** step drills *12 random words from a broad category*
(`startSession(m.cats[0], "vocab", 12, …)`, app.jsx ~2653), which may barely overlap the words in that
mission's dialogue + questions. `MISSION_VOCAB` (now in `src/data.js`) gives each mission its **exact
scenario words**, so learn → listen → questions → build-sentence all use one coherent word set.

Lane note: the **data + this spec are the content lane**; the **learn-step change is `src/app.jsx`**
(single-writer). Additive and ignored until consumed — no behaviour changes until wired.

## 1. Data shape (shipped)
```
MISSION_VOCAB = { <missionId>: ["der Kaffee", "die Rechnung", …], … }   // src/data.js
```
- **All 58 missions covered** (576 word refs, ~10 each). Every word is a **real `V` card `de`** (validated),
  so the SRS engine tracks it exactly like any other card — progress, leeches, mastery all count.
- The words are drawn from each mission's dialogue + comprehension questions, so they are precisely what the
  "Listen" step plays and the questions test.
- `npm run validate` enforces: every key is a real `MISSIONS` id; every word resolves to a `V` card (a word
  that isn't in the deck is an **error**); warns on lists < 5 (pad from `cats`) or missions with no list.

## 2. Integration (app.jsx — the one change)
In `launchMissionStep(m, "learned")` (and the `"spoke"` speaking step), build the session from the mission's
exact words instead of its first category:
```
const want = MISSION_VOCAB[m.id];                       // array of `de` keys, or undefined
const cards = want
  ? Object.values(V).flat().filter(w => want.includes(w.de))   // the exact scenario cards
  : null;
if (cards && cards.length >= 5) {
  // drill exactly these (same vocab/speaking engine). Mirror the dialogue step, which already
  // sets the card list directly (setCards(dlgs)); or add an opts.cards path to startSession.
  startSessionWithCards(cards, step === "spoke" ? "speaking" : "vocab", { level: m.level });
} else {
  startSession(m.cats[0], step === "spoke" ? "speaking" : "vocab", 12, { level: m.level }); // fallback (today's behaviour)
}
```
- **Fallback is built in:** missions without a list (none today) or short lists fall back to `cats`, so this is
  safe to ship incrementally.
- **Ordering of the syllabus** is already right: Learn the words (MISSION_VOCAB) → Listen to the scene
  (`m.dialogues`, which use those words) → questions test them → Build the sentence (the mission-tagged
  `SENTENCES`, which produce them). One continuous word set end to end.
- **Nice-to-have:** the mission-detail "Learn the words" sub-label could read `{MISSION_VOCAB[m.id].length} key words`
  instead of the category list (app.jsx ~5797), so the learner sees the tight scope.

## 3. Verify
- `npm run validate` (every word in deck, every key a mission) + `npm test` (26/26).
- When wired: open a mission → "Learn the words" drills only that scene's words; the same words then appear in
  the dialogue, its questions, and the "Build the sentence" step. `scripts/shoot.mjs mission`.

## 4. Growing / maintaining (content lane)
Regenerate candidates anytime with `node scripts/mission-vocab.mjs` (finds the V words that actually appear in
each mission's scene); curate down to the key ~10. The validator guarantees the list can never reference a
word that isn't in the deck, so the learn→test guarantee can't silently break.
