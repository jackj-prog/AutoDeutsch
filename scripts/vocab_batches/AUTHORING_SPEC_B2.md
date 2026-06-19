# B2 vocab authoring spec (Aspekte neu B2) — addendum to AUTHORING_SPEC.md

FIRST read /home/user/AutoDeutsch/scripts/vocab_batches/AUTHORING_SPEC.md for the card
format, field rules, canonical category list, and quality bar. This addendum overrides where
noted, because the B2 source is different.

## Source format
Each candidate is `{"de": "...", "ctx": "..."}` extracted from the *Aspekte neu B2*
Kapitelwortschatz. There is **NO English** — you must TRANSLATE every word yourself.
The `ctx` field is the raw source line and is extremely useful: it carries
- the plural marker for nouns: `, -en` / `, -e` / `, -s` / `, "-e` (the `"` means an umlaut
  plural, e.g. `der Vertrag, "-e` → plural `die Verträge`); `(Sg.)` means no plural (omit `pl`).
- verb principal parts: `empfinden, empfand, hat empfunden` (headword is the infinitive).
- a real collocation or example in parentheses: `knüpfen (Kontakte knüpfen)`,
  `auswandern (nach + D.)`, `gestresst (von + D.)`. USE these to write a natural, idiomatic
  example sentence and an accurate gloss.

## Overrides
- `level`: default **"B2"** for all cards (this is a B2 textbook). Only drop to "B1" if the
  word is plainly more basic; never tag below B1 here.
- `diff`: default **"hard"**; use "medium" only for the more transparent/high-frequency items.
- `en`: author a correct, natural English gloss from your own knowledge + the ctx. For verbs
  use "to …". For separable/reflexive verbs note it where helpful (e.g. "sich einleben" =
  "to settle in"). Give the sense the ctx implies.
- `pl`: derive from the ctx plural marker when the noun is countable; apply umlaut for `"-`.
  Omit for `(Sg.)` and abstracts.
- `ex` / `exEn`: B2-appropriate, natural, 5–12 words; prefer building on the ctx collocation.
- FIX obvious source typos (e.g. `der Arbeitsvertag` → `der Arbeitsvertrag`,
  `das Landesgesetz` keep). Correct the article if the source is wrong.
- Re-categorise into the BEST canonical category (use ONLY keys verbatim from the spec's
  canonical list — do NOT invent categories like "History" or "Science"; map to
  "Abstract & Advanced", "Work & Study", "Body & Health", "Media & Communication", etc.).
- DROP per the base spec: bare function words, inflected fragments, proper nouns, and
  extraction artifacts (a `de` that is not actually a dictionary headword).

## Output
Write ONLY the JSON object (keyed by canonical category, arrays of cards) to the given output
path. No prose, no markdown fences in the file. Reply with one line: total cards + dropped count.
