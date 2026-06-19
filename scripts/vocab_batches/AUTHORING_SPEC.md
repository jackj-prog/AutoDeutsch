# Vocab card authoring spec (AutoDeutsch)

You are authoring German vocabulary flash-cards for an A1–B1 learner app. You will be
given a JSON file of CANDIDATE words extracted from the official telc "Einfach gut!"
Wortschatzlisten. The candidate `en_hint`, `level`, and `pl_hint` are NOISY machine
extractions — you MUST verify and correct them. Output must match existing card quality.

## Output format
Return a single JSON object keyed by CANONICAL category name, each value an array of cards:
```json
{
  "Food & Drink": [
    {"de":"der Apfelsaft","en":"apple juice","pl":"die Apfelsäfte","ex":"Ich trinke gern Apfelsaft zum Frühstück.","exEn":"I like to drink apple juice for breakfast.","diff":"easy","level":"A1"}
  ]
}
```

## Field rules
- `de`: the headword. Nouns MUST include the correct definite article (der/die/das) lowercased: `"die Birne"`. Verbs are the infinitive: `"planen"`. Adjectives/adverbs bare: `"frisch"`.
- `en`: a natural, correct English gloss. FIX wrong hints. Examples of fixes:
  - der Becher = cup/beaker (NOT "container"); die Dose = can/tin (NOT "jar");
    ordnen = to arrange/organise (NOT "to order"); streichen = to paint/spread (NOT just "to paint");
    gern = gladly (NOT "very much"); gleich = same / right away; die Paprika = (bell) pepper.
  - If a word has two common senses, give the most relevant: `"to open (an account)"`.
- `pl`: plural form WITH article `"die Birnen"`, ONLY for countable nouns that have a normal plural.
  Omit `pl` entirely for: verbs, adjectives, adverbs, uncountables (das Wasser, das Olivenöl,
  das Mehl), and abstracts with no plural. Do not invent plurals.
- `ex`: a natural German example sentence using the headword, A1–B1 appropriate, 4–10 words.
- `exEn`: a faithful English translation of `ex`.
- `diff`: "easy" (concrete A1 everyday), "medium" (A2 / less frequent), "hard" (B1 / abstract).
- `level`: "A1" | "A2" | "B1". Correct the hint if obviously wrong (a B1 abstract noun tagged A1).
- `hint` (optional): add ONLY when genuinely useful — a memory aid, false-friend warning, or
  usage note. Keep it short. Omit otherwise.

## CRITICAL: re-categorise and drop junk
The candidates are bucketed by a noisy heuristic. For EACH word decide the BEST canonical
category from this list (place the card under that key, NOT necessarily the file's bucket):

Greetings & Basics, Numbers & Time, Family & People, Food & Drink, Around the House,
Body & Health, Colours & Descriptions, Common Verbs, Weather & Nature, Travel & Directions,
Shopping & Money, Emotions & Opinions, Everyday Actions, Work & Study, Connectors & Structure,
Abstract & Advanced, Media & Communication, Sport & Leisure, Technology & Digital,
Admin & Bureaucracy, Housing & Renting, Banking & Finance, Driving & Traffic, Cooking & Kitchen,
Idioms & Slang, Electrical Engineering, Maths & Statistics, Engineering Workplace,
Health & Doctor, Clothing & Style, Nature & Outdoors, Small Talk & Social,
Restaurant & Dining Out, Opinions & Argument, Emails & Phone, Character & Personality.

DROP (do not output) a candidate if it is:
- a bare grammatical/function word that makes a poor flash-card: pure pronouns (sie, wie),
  inflected forms of other words (besten, meisten = forms of gut/viel), separable particles
  on their own (herein, dran), or extraction artifacts (der Briefteil "part of letter").
- a near-duplicate of an obvious existing basic word.
Keep genuine content words (nouns, verbs, adjectives, useful adverbs, prepositions like `pro`, `per`).

## Quality bar (existing cards)
```
{de:"das Wasser",en:"water",ex:"Kann ich ein Glas Wasser haben?",exEn:"Can I have a glass of water?",diff:"easy",level:"A1"}
{de:"die Arbeit",en:"work / job",pl:"die Arbeiten",ex:"Ich gehe zur Arbeit.",exEn:"I'm going to work.",diff:"easy",level:"A1"}
{de:"eröffnen",en:"to open (an account)",ex:"Sie hat letzte Woche ein Konto eröffnet.",exEn:"She opened an account last week.",diff:"medium",level:"A2"}
```

Write ONLY the JSON object to the output path you are given. No prose, no markdown fences in the file.
