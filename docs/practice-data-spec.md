# Practice data — confusion pairs & exam-format sets (data + spec)

Status: **data ready → app build pending**. Two new content datasets in `src/data.js`, each ready to wire
into a focused practice mode when the app.jsx owner picks it up. Both reuse the existing multiple-choice
question shape (`{q, opts, correctIdx}`) so the current MC renderer can show them with little new UI.
`npm run validate` checks both (structure, levels, gap-count, ranges).

Lane note: the **data + this spec are the content lane**; the **drill/exam screens are `src/app.jsx`**
(single-writer). No app.jsx change is required until those modes are scheduled.

---

## A. `CONFUSIONS` — confusion-pair drill (Top-10 Learning #9)
Commonly-confused German word pairs (kennen/wissen, legen/liegen, seit/seid, wenn/als, mieten/vermieten,
leben/wohnen, …). **20 pairs**, 4 practice items each.

**Harness entry label** (pin when building): Train tab → **"Confusion pairs"** → "Start session"
(`scripts/shoot.mjs confusion` expects these).

### Shape
```
CONFUSIONS = [
  {
    id, level:"A1".."B2",
    a:{ de, en },                 // the two confusable words
    b:{ de, en },
    rule,                         // one-line "how to choose" (shown as the teaching note)
    items:[
      { q,                        // gapped sentence, contains "___"
        correct:"a"|"b",          // which word fits
        answer,                   // the surface form that fills the gap (e.g. "kenne", "weiß")
        en,                       // English of the full sentence
        why }                     // one-line justification (e.g. "a place as object → kennen")
    ]
  }
]
```

### Intended drill UX
1. Show the pair (`a.de` / `b.de`) + `rule` as a short teaching card (once per pair, or on demand).
2. For each item: show `q` with the gap and the **two base forms as the two options** (`a.de`, `b.de`).
3. On answer: reveal `answer` filled into the sentence, the `en` translation, and `why`.
4. Grade like any MC; optionally feed misses into the existing Weak queue (the pair `id` as the key) so a
   confused pair resurfaces. Group entry by level (`"auto"` resolves to the learner's level).

### Why this shape
Binary choice + a one-line `why` is the whole pedagogical point (contrast, then justify). Keeping `answer`
separate from `correct` lets the UI show the *inflected* surface form ("Weißt", "zum") while the option the
learner taps stays the clean base word.

---

## B. `EXAM` — exam-format practice (telc/Goethe style)
Short exam-style sets across A1/A2/B1/B2 in two formats. **12 sets** (3 per level), each with 2–4 questions.

**Harness entry label** (pin when building): Train tab → **"Exam practice"** (`scripts/shoot.mjs exam`
expects this).

### Shape
```
EXAM = [
  {
    id, level, skill,             // skill = display label ("Leseverstehen" / "Sprachbausteine")
    format:"leseverstehen"|"sprachbausteine",
    title,
    passage,                      // the reading text, or the gapped text with numbered (1)…(n) gaps
    passageEn?,                   // English (leseverstehen sets carry it for a "show translation" toggle)
    questions:[ { q, opts:[…], correctIdx, why? } ]
  }
]
```
- **`leseverstehen`** — read `passage`, answer comprehension MC. `q` is the question.
- **`sprachbausteine`** — `passage` has numbered gaps `(1)…(n)`; each question is one gap (`q:"Lücke (1)"`),
  `opts` are the candidate fillers, `why` gives the grammar reason. The validator warns if the gap count in
  the passage ≠ the number of questions.

### Intended exam UX
1. Show `title` + `passage` (for `sprachbausteine`, render the gaps inline/numbered).
2. Step through `questions` with the existing MC renderer; for leseverstehen keep the passage visible.
3. Offer the `passageEn` toggle (leseverstehen) and show `why` (sprachbausteine) on reveal.
4. Score as a set → a simple "X / N correct" exam result; tie into the per-level **exam-readiness** chip the
   Progress screen already shows (P2) as a real (not proxy) data point when available.

### Growing the bank
Add sets by appending to `EXAM`; keep ~2+ per level and both formats. Future formats (Hörverstehen with the
existing TTS, Schreiben with the future AI-graded writing) can extend the `format` enum + validator.

---

## Verify (both)
- `npm run validate` — structure, unique ids, valid levels, `correctIdx` ranges, sprachbausteine gap-count.
- `npm test` (26/26) unaffected (additive globals).
- When a mode lands: `scripts/shoot.mjs` the new screen at `SHOOT_WIDTH=320` to confirm no overflow (passages
  wrap; options use the existing `minmax(0,1fr)` grid).
