const { useState, useEffect, useCallback, useRef, useMemo } = React;

// Content (V, CLOZE, VERBS, SENTENCES, DIALOGUES, IMPERATIVES) lives in src/data.js,
// shipped as data.js and loaded before this script — see the editing rules there.

// ── HELPERS ──
// Compact sparse category arrays once up front. The source data contains blank
// entries between category additions; methods like `.find()` do visit those
// slots and can crash on `w.de` unless we normalize here.
const compactWordList = (list) => (Array.isArray(list) ? list.filter(w => w && typeof w === "object" && typeof w.de === "string") : []);
Object.keys(V).forEach(cat => {
  V[cat] = compactWordList(V[cat]);
});

const sh = a => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = 0 | Math.random() * (i + 1); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const PRONS = ["ich","du","er/sie/es","wir","ihr","sie/Sie"];
const PK = {ich:"ich",du:"du","er/sie/es":"er",wir:"wir",ihr:"ihr","sie/Sie":"sie"};
const CATS = Object.keys(V);
const MASTERY_STREAK = 5;
// Day-streak values worth celebrating (a milestone day feels special, not routine).
const STREAK_MILESTONES = new Set([3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 250, 300, 365, 500, 730, 1000]);
// Streak Freeze: a banked buffer that absorbs a missed day so the streak survives.
// One is earned every 7 streak-days; new users start with one as a safety net.
const MAX_FREEZES = 2;

// SRS interval schedule — days after lastReviewed until a card is due again.
// Box 0 = seen-but-not-learned (review daily until it graduates); box 5 = 30-day review.
const SRS_INTERVALS = [1, 2, 4, 7, 14, 30];
const SRS_DAY_MS = 86400000;

// Leitner box transition for a single answer. Wrong always demotes one box. Correct only
// promotes when the review happened on/after the card's due time — answering the same card
// again minutes later (repeat round, cramming) carries no evidence of longer-term retention
// and must not inflate the interval.
function nextBox(prevBox, correct, lastReviewed, now) {
  const box = Math.max(0, Math.min(5, Math.floor(prevBox || 0)));
  if (!correct) return Math.max(0, box - 1);
  if (lastReviewed && now < lastReviewed + SRS_INTERVALS[box] * SRS_DAY_MS) return box;
  return Math.min(5, box + 1);
}

// Normalize a progress entry to {stats, srs} schema.
// Accepts new shape, old flat {box, fails, hits, avgMs, n, ts}, or undefined.
function normalizeEntry(p) {
  const baseStats = { attempts: 0, correct: 0, incorrect: 0, lastSeen: null, avgTime: 0, timedAttempts: 0, currentStreak: 0, productionStreak: 0, masteredAt: null };
  if (!p) return { stats: baseStats, srs: { box: 0 } };
  if (p.stats && p.srs) {
    const correct = p.stats.correct || 0;
    const timedAttempts = p.stats.timedAttempts ?? (p.stats.avgTime ? correct : 0);
    return {
      stats: { ...baseStats, ...p.stats, timedAttempts },
      srs: { box: p.srs.box || 0, lastReviewed: p.srs.lastReviewed },
    };
  }
  return {
    stats: { ...baseStats, attempts: p.n || 0, correct: p.hits || 0, incorrect: p.fails || 0, lastSeen: p.ts, avgTime: p.avgMs || 0, timedAttempts: p.hits || 0 },
    srs: { box: p.box || 0, lastReviewed: p.ts },
  };
}

const isMasteredEntry = (entry) => normalizeEntry(entry).stats.productionStreak >= MASTERY_STREAK;

// Layered mastery. A word climbs Encountered → Learning → Strong → Mastered. The PUBLIC
// progress narrative (journey %, CEFR rank, chapters) advances on STRONG — a genuine
// "you reliably know this" signal: its SRS card survived a 7-day+ gap (box ≥ 3) OR you
// produced it correctly three times running. That moves in days, so an engaged learner
// sees real progress instead of a stuck 0%. MASTERED (5 production-correct in a row) stays
// the rigorous completionist ★ layer on top, untouched. Strength uses the best evidence
// across a word's recall + production entries.
const STRONG_BOX = 3;       // SRS box 3 = a 7-day interval already survived
const STRONG_PSTREAK = 3;   // …or three production-correct answers in a row
function wordStrength(vEntry, pEntry) {
  const v = normalizeEntry(vEntry), p = normalizeEntry(pEntry);
  const attempts = v.stats.attempts + p.stats.attempts;
  const bestBox = Math.max(v.srs.box || 0, p.srs.box || 0);
  const pStreak = p.stats.productionStreak || 0;
  const mastered = pStreak >= MASTERY_STREAK || !!p.stats.masteredAt;
  const strong = mastered || bestBox >= STRONG_BOX || pStreak >= STRONG_PSTREAK;
  return { attempts, seen: attempts > 0, strong, mastered };
}

// Deterministic id from any card shape. An explicit `id` (see src/data.js editing
// rules) wins, so content strings can be corrected without orphaning progress.
const cardId = (card) => card.id || card._id || card.de || card.q || card.a || (card.article && card.noun ? `${card.article} ${card.noun}` : null) || (card.verb ? `${card.verb}-${card.pron}-${card.tense}` : null) || (card.correct && card.correct.join(" ")) || "unknown";

const MODE_SUMMARY_LABELS = {
  vocab: "recognition",
  production: "production",
  speaking: "spoken",
  dictation: "dictation",
  article: "articles",
  plural: "plurals",
  cloze: "cloze",
  verb: "verbs",
  sentence: "sentences",
  imperativ: "imperative",
  listening: "listening",
  audio: "audio",
};
const modeSummaryLabel = (mode) => MODE_SUMMARY_LABELS[mode] || mode;

// The home hero launches the learner's preferred acquisition mode (set in onboarding,
// then tracked as they use the app). Only these whole-library modes are eligible; any
// other setup mode (articles/plurals/etc.) falls back to production.
const HERO_MODES = {
  production: { sup: "Build mastery", title: "Production practice", icon: "keyboard" },
  vocab: { sup: "Quick recall", title: "Recognition practice", icon: "layers" },
  dictation: { sup: "Train your ear", title: "Dictation practice", icon: "volume" },
  speaking: { sup: "Speak it", title: "Speaking practice", icon: "mic" },
  audio: { sup: "Hands-free", title: "Audio review", icon: "headphones" },
};
const formatModeBreakdown = (byMode) => Object.entries(byMode).map(([m, arr]) => `${arr.length} ${modeSummaryLabel(m)}`).join(" · ");

// CEFR level of a vocab card. New content sets `level` explicitly; older cards derive a
// v1 heuristic from difficulty so every card is filterable by level (A1/A2/B1).
const LEVEL_FROM_DIFF = { easy: "A1", medium: "A2", hard: "B1" };
const cardLevel = (w) => w.level || LEVEL_FROM_DIFF[w.diff] || "A2";
const LEVELS = ["A1", "A2", "B1", "B2"];
// P4 identity/role progression — driven by real-world can-dos earned (completed missions),
// not card counts. Settling into Germany is the narrative, not "you processed N rows".
const ROLES = [
  { min: 0,  name: "Newcomer",    icon: "plane", sub: "Just landed" },
  { min: 3,  name: "Settling in", icon: "home",  sub: "Finding your feet" },
  { min: 8,  name: "Resident",    icon: "users", sub: "Living the daily life" },
  { min: 18, name: "Local",       icon: "map",   sub: "At home in Germany" },
];
const roleFor = (n) => ROLES.reduce((acc, r) => (n >= r.min ? r : acc), ROLES[0]);
// P5 placement: ladder rule — start at the first CEFR level the learner can't carry (≥50% correct).
const placeLevel = (sc) => { for (const L of LEVELS) { const s = sc[L] || { c: 0, n: 0 }; if (!s.n || s.c / s.n < 0.5) return L; } return "B2"; };
// Difficulty bands for the Sentence Builder + Grammar Cloze (friendlier than exact CEFR levels).
const LVL_BANDS = { easy: ["A1", "A2"], core: ["B1"], hard: ["B2"] };
const inBand = (item, band) => band === "all" || (LVL_BANDS[band] || []).includes(item.level);

// ── AI Tutor (bring-your-own-key) ──
const AI_MODELS = [
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6 — balanced (default)" },
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5 — fastest & cheapest" },
  { id: "claude-opus-4-8", label: "Opus 4.8 — highest quality" },
];
const TUTOR_SYSTEM = `You are a warm, patient German tutor inside a vocabulary app. Your learner is an English speaker at about B1 level — an electrical engineer relocating to a German-speaking country for work, so technical/workplace topics are welcome.

Guidelines:
- Reply mostly in clear, B1-level German. Keep replies short: 2–4 sentences unless asked for more.
- When the learner makes a mistake, gently restate it correctly and add a brief English note in parentheses explaining the rule.
- If they write in English, or ask for a grammar explanation, answer clearly in English.
- End most replies with a natural follow-up question to keep the conversation going.
- Be encouraging and concrete. Never invent vocabulary that isn't standard German.`;
const tutorStarters = [
  "Stell mir eine einfache Frage auf Deutsch.",
  "Lass uns über meinen Arbeitstag sprechen.",
  "Erkläre den Unterschied zwischen 'wissen' und 'kennen'.",
  "Gib mir 5 B2-Sätze mit 'der Wirkungsgrad'.",
];

// "Mark as known" identity for a vocab word — mode-agnostic (knowing "Hallo" suppresses it
// in both recall and production). Kept separate from progress keys, which are per-mode.
const knownKey = (cat, de) => `${cat}::${de}`;

// Flat list of every vocab card tagged with its category — used by the word browser.
const allVocab = () => Object.entries(V).flatMap(([c, ws]) => ws.map(w => ({ ...w, _cat: c })));

// Nouns whose dictionary form is plural-only (die Eltern, die Unterlagen, …) —
// excluded from der/die/das practice, which would otherwise teach the plural
// article as if it were the noun's gender.
const PLURAL_ONLY_NOUNS = new Set(["Eltern","Haare","Pilze","Leute","Geschwister","Möbel","Lebensmittel","Ferien","Nachrichten","Daten","Kopfhörer","Unterlagen","Nebenkosten","Schulden","Zinsen","Ausgaben","Raten","Schmerzen","Schuhe","Handschuhe","Socken","Nudeln","Schwiegereltern","Überstunden","Kenntnisse","Beschwerden","Zahnschmerzen","Bauchschmerzen","Kopfschmerzen","Allergiehinweise"]);

function getNouns() {
  const n = [];
  Object.entries(V).forEach(([c, ws]) => { ws.forEach(w => { if (!w?.de) return; const m = w.de.match(/^(der|die|das) (.+)$/); if (m && !PLURAL_ONLY_NOUNS.has(m[2])) n.push({ article: m[1], noun: m[2], en: w.en, cat: c, ex: w.ex, exEn: w.exEn }); }); });
  return n;
}

// Nouns that carry a plural form (`pl` on the vocab card) — pool for the Plural drill.
// Card shape mirrors article cards but keeps `de` = "artikel Nomen" for stable progress keys.
function getPluralNouns() {
  const n = [];
  Object.entries(V).forEach(([c, ws]) => { ws.forEach(w => { if (!w?.de || !w.pl) return; const m = w.de.match(/^(der|die|das) (.+)$/); if (m && !PLURAL_ONLY_NOUNS.has(m[2])) n.push({ de: w.de, article: m[1], noun: m[2], en: w.en, pl: w.pl, cat: c, ex: w.ex, exEn: w.exEn }); }); });
  return n;
}

// Plural grading: the plural article is always "die", so accept the answer with or without it.
const stripPluralArticle = (s) => s.replace(/^die\s+/i, "").trim();
const checkPlural = (input, target) => checkMatch(stripPluralArticle(input), stripPluralArticle(target));

function makeVerbQ(tense = "present", pick) {
  const vb = pick || VERBS[0 | Math.random() * VERBS.length];
  const pron = PRONS[0 | Math.random() * PRONS.length];
  const key = PK[pron];
  if (tense === "perfekt") {
    const parts = vb.pf.split(" ");
    const auxF = parts[0] === "ist" ? "sein" : "haben";
    const auxV = VERBS.find(v => v.v === auxF);
    const correctAux = auxV ? auxV.pr[key] : parts[0];
    const pp = parts[1];
    return { verb: vb.v, en: vb.en, pron, correct: `${correctAux} ${pp}`, tense: "Perfekt", hint: `${vb.v} → ${vb.aux} + ${pp}` };
  }
  if (tense === "praeteritum") {
    // ich and er share the same Präteritum form, so we can vary the pronoun freely.
    const p = Math.random() < 0.5 ? "ich" : "er";
    return { verb: vb.v, en: vb.en, pron: p, correct: vb.pt, tense: "Präteritum", hint: `${vb.v} → ${vb.pt}` };
  }
  if (tense === "konjunktiv1") {
    // Konjunktiv I lives in the 3rd person singular (indirect speech): "Er sagt, sie sei…".
    const p = Math.random() < 0.5 ? "er" : "sie";
    return { verb: vb.v, en: vb.en, pron: p, correct: vb.ki, tense: "Konjunktiv I", hint: `indirect speech — „…, ${p} ${vb.ki} …" (reported)` };
  }
  if (tense === "konjunktiv2") {
    // ich/er share the KII form too. `kj2` may carry "/" alternatives (synthetic form
    // and würde + Infinitiv) — checkMatch accepts any of them.
    const p = Math.random() < 0.5 ? "ich" : "er";
    const forms = vb.kj2.split("/").map(s => s.trim());
    const hint = forms[0].startsWith("würde") && forms[0] !== "würde"
      ? "regular: würde + Infinitiv"
      : `irregular Konjunktiv II${forms[1] ? ` — "${forms[1]}" also accepted` : ""}`;
    return { verb: vb.v, en: vb.en, pron: p, correct: vb.kj2, tense: "Konjunktiv II", hint };
  }
  const correct = vb.pr[key];
  const allF = [...new Set(Object.values(vb.pr))].filter(f => f !== correct);
  const wrongs = sh(allF).slice(0, 3); while (wrongs.length < 3) wrongs.push(correct + "e");
  const opts = sh([correct, ...wrongs]);
  return { verb: vb.v, en: vb.en, pron, correct, opts, correctIdx: opts.indexOf(correct), tense: "Präsens", hint: `${pron} → ${correct}` };
}

// Preferred German voice, persisted across sessions. Empty string = automatic
// (first de-* voice). Module scope so every speak call site picks it up.
let TTS_VOICE = "";
try { TTS_VOICE = localStorage.getItem("gfc-voice") || ""; } catch (e) {}
function setTtsVoice(name) { TTS_VOICE = name; try { localStorage.setItem("gfc-voice", name); } catch (e) {} }

// Unified speech helper. Returns a Promise that resolves when the utterance ends
// (or immediately if Speech Synthesis is unavailable / text is empty). All three
// TTS call sites in the app flow through this.
function speakWith(text, lang = "de-DE", rate = 0.85) {
  return new Promise(resolve => {
    if (!window.speechSynthesis || !text) { resolve(); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = rate;
    const voices = window.speechSynthesis.getVoices();
    const chosen = TTS_VOICE ? voices.find(v => v.name === TTS_VOICE) : null;
    const pref = chosen || voices.find(v => v.lang.startsWith(lang.slice(0, 2)));
    if (pref) u.voice = pref;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

// Fire-and-forget wrapper used by tap-to-speak buttons (UI doesn't await).
function speak(text) { speakWith(text); }

function normalize(s) { return s.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9 ]/g, "").trim(); }

// Case-preserving normaliser (umlaut-folded, punctuation-stripped) — used to detect a
// capitalisation-only mismatch. German capitalises every noun (and only nouns
// mid-sentence), so an answer that's right except for case is worth flagging, not
// silently accepting (normalize() lowercases, hiding the error entirely).
function normCase(s) { return s.replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/Ä/g, "Ae").replace(/Ö/g, "Oe").replace(/Ü/g, "Ue").replace(/ß/g, "ss").replace(/[^a-zA-Z0-9 ]/g, "").trim(); }

// ß-preserving normaliser (lowercased, umlaut-folded, ß kept) — used to detect a ß-vs-ss
// mismatch. Post-1996: ß after a long vowel/diphthong (Straße, Fuß), ss after a short
// vowel (Fluss, dass). normalize() folds ß→ss, so it can't see the difference.
function normEszett(s) { return s.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/[^a-zß0-9 ]/g, "").trim(); }

// True "within one edit" check — handles single insertion, deletion, or substitution.
// The previous position-compare version failed on insertions because a single inserted
// character cascaded into N mismatches.
function within1Edit(a, b) {
  if (a === b) return true;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  // Find first divergence
  let i = 0;
  while (i < la && i < lb && a[i] === b[i]) i++;
  // Same length → substitution: skip one char in each, rest must match
  if (la === lb) return a.slice(i + 1) === b.slice(i + 1);
  // Different length → insertion/deletion: skip one char in the longer, rest must match
  const longer = la > lb ? a : b;
  const shorter = la > lb ? b : a;
  return longer.slice(i + 1) === shorter.slice(i);
}

// Returns "exact" | "capital" (right word, wrong capitalisation) | "close" (one typo) |
// "wrong". "capital" is graded correct but flagged so the learner fixes their Groß-/
// Kleinschreibung — the orthographic skill that defines written German.
function checkMatch(input, target) {
  const ni = normalize(input);
  // Grade a word-level match: capitalisation first (the bigger skill), then ß-vs-ss.
  const grade = (p) => normCase(input) !== normCase(p) ? "capital"
    : normEszett(input) !== normEszett(p) ? "eszett" : "exact";
  if (ni === normalize(target)) return grade(target);
  const parts = target.split("/").map(s => s.trim());
  for (const p of parts) if (normalize(p) === ni) return grade(p);
  // Typo tolerance ("close") only for longer answers. For short words a single edit
  // usually yields a *different* valid word (neun↔neue, rot↔rat, Tee↔See), which must
  // NOT be graded correct — so require an exact match at <5 chars. Checked per slash
  // alternative so a typo in one option ("niemal" for "niemals") still counts as close.
  for (const p of parts) { const np = normalize(p); if (np.length >= 5 && within1Edit(ni, np)) return "close"; }
  return "wrong";
}

// Common German strong-verb + modal stem alternates. Used by the example highlighter
// so "nehmen" matches "nimm", "sprechen" matches "sprich", etc. Not exhaustive — covers
// the high-frequency A1/A2 verbs that appear in example sentences.
const STEM_ALTS = {
  nehmen: ["nehm", "nimm", "nahm", "nomm"],
  sprechen: ["sprech", "sprich", "sprach", "sproch"],
  sehen: ["seh", "sieh", "sah"],
  lesen: ["les", "lies", "las"],
  essen: ["ess", "iss", "aß", "gess"],
  geben: ["geb", "gib", "gab"],
  treffen: ["treff", "triff", "traf"],
  helfen: ["helf", "hilf", "half"],
  werfen: ["werf", "wirf", "warf"],
  vergessen: ["vergess", "vergiss", "vergaß"],
  empfehlen: ["empfehl", "empfiehl", "empfahl"],
  fahren: ["fahr", "fähr", "fuhr"],
  laufen: ["lauf", "läuf", "lief"],
  tragen: ["trag", "träg", "trug"],
  schlafen: ["schlaf", "schläf", "schlief"],
  waschen: ["wasch", "wäsch", "wusch"],
  müssen: ["müss", "muss"],
  können: ["könn", "kann"],
  dürfen: ["dürf", "darf"],
  wollen: ["woll", "will"],
  mögen: ["mög", "mag", "möcht"],
  wissen: ["wiss", "weiß", "wuss"],
  werden: ["werd", "wird", "wurde", "word"],
  haben: ["hab", "hat", "hatt"],
  sein: ["sei", "bin", "bist", "ist", "sind", "seid", "war"],
  kommen: ["komm", "kam"],
  gehen: ["geh", "ging", "gang"],
  finden: ["find", "fand", "fund"],
  denken: ["denk", "dach", "dacht"],
  bringen: ["bring", "brach", "bracht"],
  schreiben: ["schreib", "schrieb"],
  bleiben: ["bleib", "blieb"],
  sterben: ["sterb", "stirb", "starb", "storb"],
  anziehen: ["anzieh", "zieh", "zog"],
  aufstehen: ["aufsteh", "steh", "stand"],
  anrufen: ["anruf", "ruf", "rief"],
};
// The returned pattern is NOT escaped for regex metacharacters beyond those present in
// German words (assumed safe). Used only for vocab where inputs are controlled.
function buildUmlautTolerant(term) {
  const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Single pass, so a replacement is never re-processed by a later rule (the old
  // sequential version turned "ä" into nested groups via the "ae" rule).
  const MAP = { "ä": "(?:ä|ae)", "ö": "(?:ö|oe)", "ü": "(?:ü|ue)", "ß": "(?:ß|ss)", "ae": "(?:ae|ä)", "oe": "(?:oe|ö)", "ue": "(?:ue|ü)", "ss": "(?:ss|ß)" };
  return escape(term).replace(/ä|ö|ü|ß|ae|oe|ue|ss/gi, m => MAP[m.toLowerCase()] || m);
}

// Word-character tail that includes German letters — bare \w* stops at ä/ö/ü/ß,
// cutting highlights short (e.g. "Universit" matched but "…ät" left plain).
const DE_WORD_TAIL = "[\\wäöüßÄÖÜ]*";

// Highlighter for the example-sentence panel. Given a German target (card.de) and an
// example string, return [{text, hl}, ...] parts where `hl=true` denotes highlighted.
//   - Strips leading article from the target to get the core phrase.
//   - Tries the full phrase first (exact match, case + umlaut insensitive, all occurrences).
//   - Falls back to matching each content word (3+ chars, not stopwords).
//   - Single-word matches use a stem+suffix pattern so "fahren" catches "fährt", "gefahren".
//   - Stopwords (sich/dich/der/zu/etc.) are never highlighted.
function highlightExample(ex, de) {
  if (!ex) return [];
  if (!de) return [{ text: ex, hl: false }];

  const stripped = de.replace(/^(der|die|das)\s+/i, "").trim();
  const STOPWORDS = /^(sich|dich|mich|dir|mir|euch|uns|zu|an|auf|mit|von|aus|bei|in|im|am|der|die|das|den|dem|des|ein|eine|einen|einer|einem|eines)$/i;

  const words = stripped.split(/\s+/)
    .map(w => w.replace(/[.,!?;:]+$/, ""))
    .filter(w => w.length >= 3 && !STOPWORDS.test(w));

  // Build ordered patterns (phrase before individual words so phrase wins when present)
  const patterns = [];
  if (stripped.split(/\s+/).length > 1 && stripped.length >= 4) {
    patterns.push(buildUmlautTolerant(stripped));
  }
  for (const w of words) {
    // If we know this word's strong-verb stems, add all of them
    const lc = w.toLowerCase();
    const alts = STEM_ALTS[lc];
    if (alts) {
      for (const a of alts) patterns.push("\\b" + buildUmlautTolerant(a) + DE_WORD_TAIL);
    } else {
      // Generic stem: first 4 chars + any word-char tail
      const stemLen = Math.min(w.length, 4);
      const stem = w.slice(0, stemLen);
      patterns.push("\\b" + buildUmlautTolerant(stem) + DE_WORD_TAIL);
    }
  }
  if (patterns.length === 0) return [{ text: ex, hl: false }];

  const combined = new RegExp("(" + patterns.join("|") + ")", "gi");
  const parts = [];
  let lastIndex = 0;
  let m;
  while ((m = combined.exec(ex)) !== null) {
    if (m[0].length === 0) { combined.lastIndex++; continue; }
    if (m.index > lastIndex) parts.push({ text: ex.slice(lastIndex, m.index), hl: false });
    parts.push({ text: m[0], hl: true });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < ex.length) parts.push({ text: ex.slice(lastIndex), hl: false });
  return parts;
}

// ── NEW: Automaticity label ──
function speedLabel(ms) {
  if (ms < 8000) return { text: "Automatic", color: "#4ADE80" };
  if (ms < 15000) return { text: "Building recall", color: "#FBBF24" };
  return { text: "Needs work", color: "#DD0000" };
}

// ── Difficulty-weighted + performance-aware selection ──
// Soft boost for struggling cards using existing stats. Does NOT duplicate leech detection
// (leeches are incorrect>=4 AND box<3 — handled separately by weak-area flow).
// Max boost is 1.8x, so no card can dominate a session.
function perfMultiplier(entry) {
  if (!entry) return 1;
  const n = normalizeEntry(entry);
  const { attempts, correct, incorrect, avgTime, timedAttempts } = n.stats;
  if (attempts < 2) return 1; // too little data to trust
  let mult = 1;
  // High incorrect count
  if (incorrect >= 3) mult += 0.4;
  else if (incorrect >= 2) mult += 0.2;
  // Low accuracy ratio
  const acc = correct / attempts;
  if (acc < 0.5) mult += 0.3;
  else if (acc < 0.7) mult += 0.15;
  // Slow response
  if (timedAttempts >= 2 && avgTime > 15000) mult += 0.2;
  else if (timedAttempts >= 2 && avgTime > 10000) mult += 0.1;
  return Math.min(mult, 1.8);
}

// Session-difficulty selector. Selection-order only — does NOT affect SRS or scoring.
// mixed: current behaviour (uses perfMultiplier as-is)
// easy: boosts higher-box / faster / more-accurate cards (revision-style)
// hard: amplifies perfMultiplier boost + adds box-level boost (drills weak stuff)
function sessionMultiplier(entry, diffMode) {
  if (diffMode === "mixed" || !diffMode) return perfMultiplier(entry);
  if (!entry) return 1;
  const n = normalizeEntry(entry);
  const { attempts, correct, incorrect, avgTime } = n.stats;
  const box = n.srs.box || 0;
  if (attempts < 2 && diffMode === "easy") return 0.7; // un-tested cards slightly less likely in easy mode
  if (attempts < 2) return 1;
  if (diffMode === "easy") {
    // Prioritise higher box (mastered), fast, accurate
    let mult = 1;
    if (box >= 4) mult += 0.6;
    else if (box >= 3) mult += 0.4;
    else if (box >= 2) mult += 0.2;
    else if (box <= 1) mult -= 0.4;
    const acc = correct / attempts;
    if (acc >= 0.85) mult += 0.2;
    if (avgTime > 0 && avgTime < 8000) mult += 0.15;
    return Math.max(0.3, Math.min(mult, 2.0));
  }
  // hard
  let mult = perfMultiplier(entry);
  // Amplify existing performance boost further
  if (incorrect >= 3) mult += 0.3;
  if (box <= 1) mult += 0.4;
  else if (box <= 2) mult += 0.2;
  // Leech-like cards (independent of weak-area flow): 4+ incorrect AND box < 3
  if (incorrect >= 4 && box < 3) mult += 0.5;
  if (avgTime > 15000) mult += 0.1;
  return Math.min(mult, 2.5);
}

// Partition a session pool into due / not-yet-due and pre-select up to half the session
// from the due set. Ordinary practice then services the SRS queue automatically instead
// of leaving reviews to the Due button alone; the other half stays fresh material.
function seedDueFirst(pool, count, isDue) {
  const due = [], rest = [];
  pool.forEach(c => (isDue(c) ? due : rest).push(c));
  const seeded = sh(due).slice(0, Math.min(due.length, Math.ceil(count / 2)));
  return { seeded, rest };
}

function weightedSelect(pool, count, getMultiplier) {
  const weighted = [];
  pool.forEach(c => {
    const baseW = c.diff === "hard" ? 3 : c.diff === "medium" ? 2 : 1;
    const m = getMultiplier ? getMultiplier(c) : 1;
    const w = Math.max(1, Math.round(baseW * m));
    for (let i = 0; i < w; i++) weighted.push(c);
  });
  const picked = new Set();
  const result = [];
  const shuffled = sh(weighted);
  for (const c of shuffled) {
    const id = c.id || c.de || c.q || JSON.stringify(c.correct);
    if (!picked.has(id)) { picked.add(id); result.push(c); }
    if (result.length >= count) break;
  }
  return result;
}

// ── NEW: today key for streak tracking ──
function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ── Daily reminder (local notifications, no backend) ──
// A gentle "time to study" notification at the user's chosen time. Uses the Notification
// Triggers API where available (Chromium) so it fires even when the app is closed —
// scheduled several days ahead and re-armed whenever the app is opened. Falls back to a
// foreground timer (fires only while a tab is open) elsewhere; iOS has no Triggers API,
// so there the reminder only lands if the app was left open. Purely additive + opt-in.
// Web Speech recognition (Speaking mode). Chromium/desktop/Android support it; iOS Safari
// does not, so the UI falls back to a self-assessed "shadowing" flow when this is null.
const SPEECH_REC_CTOR = (typeof window !== "undefined") && (window.SpeechRecognition || window.webkitSpeechRecognition) || null;

const REMINDER_TAG = "ad-daily-reminder";
const REMINDER_TITLE = "Zeit für Deutsch! 🇩🇪";
const REMINDER_BODY = "Your daily review is waiting — a few cards keeps your streak alive.";
// Future timestamps for HH:MM across the next `days` days (today included if still ahead).
function reminderTimes(hhmm, days) {
  const [h, m] = (hhmm || "19:00").split(":").map(Number);
  const now = Date.now();
  const out = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(); d.setHours(h, m, 0, 0); d.setDate(d.getDate() + i);
    if (d.getTime() > now) out.push(d.getTime());
  }
  return out;
}
function triggersSupported() {
  return typeof Notification !== "undefined" && "showTrigger" in Notification.prototype
    && typeof window !== "undefined" && typeof window.TimestampTrigger === "function";
}
async function clearScheduledReminders(reg) {
  try {
    if (!reg) return;
    const ns = await reg.getNotifications({ includeTriggered: true });
    ns.forEach(n => { if (n.tag && n.tag.indexOf(REMINDER_TAG) === 0) n.close(); });
  } catch (e) {}
}

// ── Color palette (module scope so hoisted components can reference) ──
const PAL = {
  A: "#FFCC00", AD: "#CC9900", BG: "#0A0A0A", S: "#111111", SH: "#1A1A1A", B: "#2A2A2A",
  G: "#4ADE80", R: "#DD0000", T: "#F0EDE5", TD: "#97938B", BL: "#60A5FA", CARD: "#151515",
};
// CEFR level identity — title + accent — shared by the home rank card, the Stats roadmap,
// and the rank-up celebration so the progression reads as one system.
const LEVEL_TITLES = { A1: "Beginner", A2: "Elementary", B1: "Intermediate", B2: "Upper Intermediate" };
const LEVEL_COLOR = { A1: PAL.G, A2: PAL.BL, B1: PAL.A, B2: PAL.R };
const CHAPTERS = 5; // each CEFR level is divided into this many chapters (checkpoint milestones)
// ── German gender patterns ───────────────────────────────────────────────────
// Turns the article drill (and any noun reveal) from rote guessing into learning the
// ~80% of gender that's predictable from the noun's ending. We always compare against the
// real article, so we never assert a wrong gender — a mismatch becomes an "exception" lesson.
// Only high-reliability suffixes are listed; the two broad ones (-er, -e) are hedged.
const GENDER_NAME = { der: "masculine", die: "feminine", das: "neuter" };
const GENDER_RULES = [
  { s: "-chen", g: "das", re: /chen$/ }, { s: "-lein", g: "das", re: /lein$/ },
  { s: "-ung", g: "die", re: /ung$/ }, { s: "-heit / -keit", g: "die", re: /(heit|keit)$/ },
  { s: "-schaft", g: "die", re: /schaft$/ }, { s: "-tät", g: "die", re: /t[äa]t$/ },
  { s: "-tion / -sion", g: "die", re: /(tion|sion)$/ }, { s: "-ik", g: "die", re: /ik$/ },
  { s: "-ur", g: "die", re: /ur$/ }, { s: "-enz / -anz", g: "die", re: /(enz|anz)$/ },
  { s: "-ie", g: "die", re: /ie$/ }, { s: "-ismus", g: "der", re: /ismus$/ },
  { s: "-ling", g: "der", re: /ling$/ }, { s: "-ant", g: "der", re: /ant$/ },
  { s: "-ist", g: "der", re: /ist$/ }, { s: "-or", g: "der", re: /or$/ },
  { s: "-ment / -tum", g: "das", re: /(ment|tum)$/ }, { s: "-um", g: "das", re: /um$/ },
  { s: "-ma", g: "das", re: /ma$/ },
  { s: "-er", g: "der", re: /er$/, hedge: true }, { s: "-e", g: "die", re: /e$/, hedge: true },
];
function genderRule(noun, article) {
  if (!noun || !GENDER_NAME[article]) return null;
  const n = noun.toLowerCase().replace(/[^a-zäöüß]/g, "");
  for (const r of GENDER_RULES) {
    if (r.re.test(n)) {
      if (r.g === article) return { text: `Nouns ending in ${r.s} are ${r.hedge ? "usually " : ""}${GENDER_NAME[r.g]} → ${article}.`, kind: "rule" };
      return { text: `${r.s} nouns are usually ${GENDER_NAME[r.g]}, but ${noun} is ${article} — a common exception worth memorising.`, kind: "exception" };
    }
  }
  return { text: `No reliable ending rule here — learn it as a unit: ${article} ${noun}.`, kind: "tip" };
}
// Plural patterns — derived from the actual singular→plural transformation, so it's always
// accurate. Teaches the five German plural classes (+ umlaut).
function pluralRule(sg, pl) {
  if (!sg || !pl) return null;
  const s = String(sg).replace(/^(der|die|das)\s+/i, "").trim();
  const p = String(pl).replace(/^(die|der|das)\s+/i, "").trim();
  const deU = x => x.toLowerCase().replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u");
  const cnt = x => (x.toLowerCase().match(/[äöü]/g) || []).length;
  const umlaut = cnt(p) > cnt(s);
  const u = umlaut ? ", plus an umlaut (a→ä, o→ö, u→ü)" : "";
  let suffix = null;
  if (p.length >= s.length && deU(p).slice(0, deU(s).length) === deU(s)) suffix = p.slice(s.length);
  if (deU(p) === deU(s)) return { kind: "rule", text: `Plural unchanged${umlaut ? " except for an umlaut" : ""} — typical of nouns ending in -er, -en or -el.` };
  if (suffix === "nen") return { kind: "rule", text: "Adds -nen — feminine nouns ending in -in." };
  if (suffix === "n" || suffix === "en") return { kind: "rule", text: `Adds -${suffix}${u} — the most common plural, especially feminine nouns and nouns ending in -e.` };
  if (suffix === "e") return { kind: "rule", text: `Adds -e${u} — common for masculine and neuter nouns.` };
  if (suffix === "er") return { kind: "rule", text: `Adds -er${u} — common for neuter nouns and a few masculine ones.` };
  if (suffix === "s") return { kind: "rule", text: "Adds -s — usually loanwords or words ending in a vowel." };
  return { kind: "tip", text: `Plural: ${p}${umlaut ? " (note the umlaut)" : ""} — learn this form with the word.` };
}
// Verb patterns — weak (regular) vs strong (ablaut) vs present-irregular, plus the Perfekt
// auxiliary. The Präteritum alone is NOT enough to classify a verb: the modals (and sein)
// keep a regular -te past yet change their stem in the PRESENT — "wollen → ich will",
// "sein → ich bin". The old check looked only at the past and so labelled "wollen" a
// "Regular (weak) verb — keeps its stem" on the very screen that had just drilled "ich will".
// We now also compare the present ich-form's stem to the infinitive stem (data already in
// VERBS[].pr) and surface the present irregularity first.
function verbRule(vb) {
  if (!vb || !vb.v) return null;
  const stem = vb.v.replace(/e?n$/, "");
  const weakPast = vb.pt === stem + "te" || vb.pt === stem + "ete";
  const aux = vb.aux === "sein" ? "sein (motion / change of state)" : "haben";
  const part = String(vb.pf || "").split(" ").pop();
  const ichForm = (vb.pr && vb.pr.ich) ? vb.pr.ich : "";
  // A separable verb's prefix detaches in the present ("ich kaufe ein"), so the ich-form
  // carries a space. Flag that first — it's the salient pattern, not a stem irregularity.
  if (/\s/.test(ichForm.trim())) return { kind: "exception", text: `Separable verb — the prefix splits off and moves to the end in the present (ich ${ichForm}). Präteritum ${vb.pt}, Perfekt ${part}, with ${aux}.` };
  // ich-form minus its -e ending; for a regular/strong verb this equals the infinitive stem
  // (ich mache→mach, ich fahre→fahr). For modals & sein it doesn't (ich will, ich bin), so the
  // Präteritum alone (wollte = woll+te) would wrongly read as "regular, keeps its stem".
  const ichStem = ichForm.replace(/e$/, "");
  const presentChanges = ichStem && ichStem !== stem;
  if (presentChanges) return { kind: "exception", text: `Irregular present — the stem changes (ich ${ichForm})${weakPast ? `, even though the past is the regular -te form (${vb.pt})` : ` (${vb.v} → ${vb.pt} → ${part})`}. Perfekt with ${aux}. Best learned by heart.` };
  if (weakPast) return { kind: "rule", text: `Regular (weak) verb — keeps its stem, just adds endings (Präteritum ${vb.pt}). Perfekt with ${aux}.` };
  return { kind: "exception", text: `Strong verb — the stem vowel changes: ${vb.v} → ${vb.pt} → ${part}. Perfekt with ${aux}. Best learned by heart.` };
}
// Shared renderer so gender / plural / verb explanations read as one consistent "why" system.
const GrammarNote = ({ note }) => {
  if (!note) return null;
  const c = note.kind === "exception" ? PAL.A : note.kind === "tip" ? PAL.BL : PAL.G;
  const label = note.kind === "exception" ? "Watch out" : note.kind === "tip" ? "Tip" : "Why";
  return (
    <div style={{ marginTop: 11, padding: "9px 12px", background: "#0A0A0A66", borderRadius: 10, borderLeft: `3px solid ${c}`, fontSize: 11.5, color: PAL.TD, lineHeight: 1.5, textAlign: "left", maxWidth: 320, marginLeft: "auto", marginRight: "auto" }}>
      <span style={{ color: c, fontWeight: 800 }}>{label}</span>{"  "}{note.text}
    </div>
  );
};
// Flame "heat" by count — used for both the day streak and the in-session combo. As the
// number climbs the flame shifts from brand gold toward fiery orange, grows, glows, and
// flickers, so being on a roll/streak looks like it. Returns { color, glow, boost, anim }.
const flameHeat = (n) => {
  if (n >= 30) return { color: "#FF6A12", glow: 14, boost: 5, anim: "ad-flame-roar" };
  if (n >= 14) return { color: "#FF8A1E", glow: 11, boost: 4, anim: "ad-flame-flicker" };
  if (n >= 7)  return { color: "#FFA826", glow: 8,  boost: 2, anim: "ad-flame-flicker" };
  if (n >= 3)  return { color: "#FFCC00", glow: 5,  boost: 1, anim: null };
  if (n >= 1)  return { color: "#FFCC00", glow: 0,  boost: 0, anim: null };
  return { color: PAL.TD, glow: 0, boost: 0, anim: null };
};
// A flame at its current heat: glowing, slightly grown, flickering at high tiers.
const HotFlame = ({ n, size }) => {
  const h = flameHeat(n);
  return (
    <span className={h.anim || undefined} style={{ display: "inline-flex", filter: h.glow ? `drop-shadow(0 0 ${h.glow}px ${h.color}cc)` : "none" }}>
      <Icon name="flame" size={size + h.boost} style={{ color: h.color }} />
    </span>
  );
};
// Calmer, more premium surface tokens: hairline borders + soft elevation instead of hard grey boxes.
const HAIR = "rgba(255,255,255,0.06)";
const ELEV = "0 8px 30px -14px rgba(0,0,0,0.8)";
// Atmosphere: a warm glow behind the app top + lit-from-above panel surfaces.
const APP_BG = "radial-gradient(125% 48% at 50% -6%, rgba(255,200,40,0.10) 0%, rgba(255,200,40,0.02) 28%, #090909 60%)";
const HERO_GRAD = "linear-gradient(155deg, #2A210B 0%, #1A160E 42%, #100F0C 100%)";
const PANEL_GRAD = "linear-gradient(180deg, #1D1D1D 0%, #141414 100%)";
// One neutral gradient for every study card (recall / production / dictation / all drills /
// sentence / audio), so the focal surface is consistent across modes. The German tricolour
// shows through the thin top accent bar each card carries, not the background.
const CARD_GRAD = "linear-gradient(160deg, #161616 0%, #0E0E0E 100%)";
const CARD_ACCENT = `linear-gradient(90deg, #1A1A1A 33%, ${PAL.R} 33% 66%, ${PAL.A} 66%)`;

// Visible in Settings → App Updates. Bump whenever you deploy a meaningful change
// so you can confirm at a glance which build is running on the device.
const APP_VERSION = "2026.06.20.15";

// ── Sound cues ───────────────────────────────────────────────────────────────
// Synthesized with Web Audio — no asset files, so it stays fully offline with zero
// deps. A silent trainer feels cheap next to Duolingo/Memrise; these subtle cues
// complete the multi-sensory reward already carried by the bloom, confetti & haptics.
// Optional via a Settings toggle (default on); the context is created lazily on the
// first answer tap so it never trips the browser autoplay policy.
const SFX_KEY = "ad-sfx-v1";
let __sfxOn = (() => { try { return localStorage.getItem(SFX_KEY) !== "0"; } catch (e) { return true; } })();
const sfxEnabled = () => __sfxOn;
const setSfxEnabled = (v) => { __sfxOn = !!v; try { localStorage.setItem(SFX_KEY, v ? "1" : "0"); } catch (e) {} };
let __actx = null;
function __audioCtx() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!__actx) __actx = new AC();
    if (__actx.state === "suspended") __actx.resume().catch(() => {});
    return __actx;
  } catch (e) { return null; }
}
function __blip(ctx, freq, startAt, dur, peak, type) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type || "sine"; o.frequency.value = freq;
  o.connect(g); g.connect(ctx.destination);
  const t = ctx.currentTime + startAt;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t); o.stop(t + dur + 0.03);
}
const SFX = {
  correct: (c) => { __blip(c, 660, 0, 0.13, 0.15); __blip(c, 988, 0.06, 0.17, 0.12); },                 // E5 → B5, bright lift
  wrong: (c) => { __blip(c, 196, 0, 0.2, 0.1, "triangle"); __blip(c, 146, 0.04, 0.22, 0.09, "triangle"); }, // soft, low, non-punitive
  win: (c) => { [523, 659, 784, 1047].forEach((f, i) => __blip(c, f, i * 0.085, 0.26, 0.12)); },         // C-E-G-C major arpeggio
  combo: (c, t) => { const f = 784 * Math.pow(1.18, t || 0); __blip(c, f, 0, 0.09, 0.09); __blip(c, f * 1.5, 0.05, 0.12, 0.07); }, // rising sparkle — pitches up as the streak deepens
};
function playSfx(name, arg) {
  if (!__sfxOn) return;
  const ctx = __audioCtx(); if (!ctx) return;
  try { (SFX[name] || (() => {}))(ctx, arg); } catch (e) {}
}

// 100dvh tracks the *visible* viewport on mobile (no jump when the URL bar collapses);
// fall back to 100vh where dvh is unsupported (pre-2022 browsers).
const DVH = (typeof CSS !== "undefined" && CSS.supports && CSS.supports("height: 100dvh")) ? "100dvh" : "100vh";

// True on devices with a hardware pointer (desktop / iPad-with-trackpad) — gates the
// keyboard-shortcut hints, which would be noise on touch phones.
const HAS_FINE_POINTER = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

// Home-library grouping: 36 categories as a flat grid is a wall of scroll. The Library
// renders these themed, collapsible groups instead. Categories missing from this map
// fall into a trailing "More" group, so new content can never disappear from the UI.
const LIB_GROUPS = [
  { name: "Everyday Life", cats: ["Greetings & Basics", "Numbers & Time", "Family & People", "Food & Drink", "Around the House", "Body & Health", "Colours & Descriptions", "Common Verbs", "Everyday Actions", "Clothing & Style", "Cooking & Kitchen"] },
  { name: "Out & About", cats: ["Travel & Directions", "Shopping & Money", "Driving & Traffic", "Weather & Nature", "Nature & Outdoors", "Restaurant & Dining Out", "Sport & Leisure"] },
  { name: "Work & Engineering", cats: ["Work & Study", "Engineering Workplace", "Electrical Engineering", "Maths & Statistics", "Technology & Digital"] },
  { name: "Life Admin", cats: ["Admin & Bureaucracy", "Housing & Renting", "Banking & Finance", "Health & Doctor", "Emails & Phone"] },
  { name: "Language & Society", cats: ["Connectors & Structure", "Abstract & Advanced", "Media & Communication", "Emotions & Opinions", "Opinions & Argument", "Small Talk & Social", "Character & Personality", "Idioms & Slang"] },
];

const ICONS = {
  settings: "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  play: "M8 5v14l11-7-11-7Z",
  pause: "M8 5h3v14H8V5Zm5 0h3v14h-3V5Z",
  skipBack: "M19 5v14l-9-7 9-7ZM5 5v14",
  skipForward: "M5 5v14l9-7-9-7ZM19 5v14",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  arrowLeft: "M19 12H5M11 6l-6 6 6 6",
  refresh: "M20 6v5h-5M4 18v-5h5M18.5 9a7 7 0 0 0-12-2.5L4 9m16 6-2.5 2.5A7 7 0 0 1 5.5 15",
  book: "M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2V4Zm20 0h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7V4Z",
  layers: "M12 3 3 8l9 5 9-5-9-5Zm-7 9 7 4 7-4M5 16l7 4 7-4",
  headphones: "M4 13a8 8 0 0 1 16 0v5a2 2 0 0 1-2 2h-2v-7h4M4 13h4v7H6a2 2 0 0 1-2-2v-5Z",
  keyboard: "M4 7h16v10H4V7Zm3 3h.01M10 10h.01M13 10h.01M16 10h.01M7 14h10",
  target: "M12 3v3M12 18v3M3 12h3M18 12h3M7.5 7.5l2.1 2.1M14.4 14.4l2.1 2.1M16.5 7.5l-2.1 2.1M9.6 14.4l-2.1 2.1M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
  calendar: "M7 3v3M17 3v3M4 8h16M5 5h14v16H5V5Z",
  clock: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 4v4l3 2",
  chart: "M3 3v18h18M8 17v-6m4.5 6V7m4.5 10v-3.5",
  check: "M20 6 9 17l-5-5",
  shield: "M12 3 5 6v5c0 4.5 2.8 8 7 10 4.2-2 7-5.5 7-10V6l-7-3Z",
  wifi: "M5 10a10 10 0 0 1 14 0M8 13a6 6 0 0 1 8 0M11 16a2 2 0 0 1 2 0M12 19h.01",
  save: "M5 4h12l2 2v14H5V4Zm3 0v6h8V4M8 20v-6h8v6",
  upload: "M12 16V4M7 9l5-5 5 5M5 20h14",
  download: "M12 4v12M7 11l5 5 5-5M5 20h14",
  volume: "M4 10v4h4l5 4V6l-5 4H4Zm13-2a5 5 0 0 1 0 8M19 5a9 9 0 0 1 0 14",
  mic: "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3ZM19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 23h8",
  plane: "M17.8 19.2 16 11l3.5-3.5c1.5-1.5 2-3.5 1.5-4.5-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.6c-.2.4-.1.9.3 1.2L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 4.3c.3.4.8.5 1.2.3l.6-.3c.4-.2.6-.6.5-1.1Z",
  card: "M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7ZM2 10h20",
  home: "m3 10 9-7 9 7v10a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2V10Z",
  users: "M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm12.5 10v-2a4 4 0 0 0-3-3.85M16 3.15a4 4 0 0 1 0 7.7",
  heart: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z",
  hand: "M7 11V6a2 2 0 0 1 4 0v5M11 10V5a2 2 0 0 1 4 0v6M15 11V7a2 2 0 0 1 4 0v5c0 5-3 8-7 8h-1a6 6 0 0 1-6-6v-3a2 2 0 0 1 4 0v2",
  utensils: "M6 3v8M4 3v5a2 2 0 0 0 4 0V3M6 11v10M15 3v18M18 3v7a3 3 0 0 1-3 3",
  sofa: "M5 12V9a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3M4 12h16v6H4v-6Zm2 6v2m12-2v2",
  medical: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 5v8M8 12h8",
  smile: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16ZM9 10h.01M15 10h.01M8.5 14a5 5 0 0 0 7 0",
  megaphone: "M4 10v4h4l9 4V6l-9 4H4Zm4 4v5M17 9a4 4 0 0 1 0 6",
  cart: "M2.5 3h2l2.7 12.4a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L21.5 7H6M9 20.5h.01M18 20.5h.01",
  grid: "M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z",
  alert: "M12 3 2 21h20L12 3Zm0 6v5m0 3h.01",
  calendarCheck: "M7 3v3M17 3v3M4 8h16M5 5h14v16H5V5Zm4 10 2 2 4-5",
  palette: "M12 4a8 8 0 0 0 0 16h1.5a2 2 0 0 0 1.4-3.4l-.3-.3a1 1 0 0 1 .7-1.7H17a5 5 0 0 0 0-10H12ZM7.5 11h.01M9.5 8h.01M13 7.5h.01",
  bolt: "M13 2 4 14h7l-1 8 9-12h-7l1-8Z",
  cloud: "M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11-2A5 5 0 0 0 7 18Z",
  map: "M9 18 4 20V6l5-2 6 2 5-2v14l-5 2-6-2Zm0 0V4m6 16V6",
  briefcase: "M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Zm0 4h18",
  message: "M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.6 0-3.1-.4-4.4-1.2L3 20l1.2-5.1A8.5 8.5 0 1 1 21 11.5Z",
  chip: "M8 8h8v8H8V8Zm-4 3h4M4 15h4M16 11h4M16 15h4M11 4v4M15 4v4M11 16v4M15 16v4",
  trophy: "M8 4h8v3a4 4 0 0 1-8 0V4Zm0 1H5a3 3 0 0 0 3 5M16 5h3a3 3 0 0 1-3 5M12 11v5M9 20h6M10 16h4",
  link: "M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1",
  // Solid fire: a strong filled flame with an inner-flame cutout — reads as a real
  // flame at streak size, unlike the previous thin outline.
  flame: "M12.96 2.29a.75.75 0 0 0-1.07-.14A9.74 9.74 0 0 0 8.35 8.33 7.55 7.55 0 0 1 6.65 6.6a.75.75 0 0 0-1.16-.08A9 9 0 1 0 15.68 4.53a7.46 7.46 0 0 1-2.72-2.24ZM15.75 14.25a3.75 3.75 0 1 1-7.31-1.17c.63.46 1.35.8 2.13 1a5.99 5.99 0 0 1 1.93-3.55 3.75 3.75 0 0 1 3.25 3.72Z",
  chevron: "M6 9l6 6 6-6",
  // ── Category icons (added so every Library category gets a distinct, literal glyph) ──
  car: "M5 11l1.6-4.8A2 2 0 0 1 8.5 5h7a2 2 0 0 1 1.9 1.2L20 11M4 11h16a1 1 0 0 1 1 1v4h-3M7 16H3v-4a1 1 0 0 1 1-1M7 16h10M6 16a2 2 0 1 0 4 0 2 2 0 0 0-4 0Zm8 0a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z",
  leaf: "M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10ZM2 21c0-3 1.85-5.36 5.08-6C9.5 14.5 12 13 13 12",
  pot: "M4 11h16v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-5ZM2 11h20M9 7c.7-1 .2-2-.3-3M15 7c.7-1 .2-2-.3-3",
  wrench: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9l-3.8 3.8Z",
  scale: "M12 3v18M7 21h10M3 7h4c2 0 4-1 5-2 1 1 3 2 5 2h4M5 7l-3 7c.9.7 1.9 1 3 1s2.1-.3 3-1L5 7Zm14 0-3 7c.9.7 1.9 1 3 1s2.1-.3 3-1l-3-7Z",
  quote: "M9 7H5a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2l-1 4M21 7h-4a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2l-1 4",
  user: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  bank: "M12 3 4 7h16L12 3ZM4 10v9M8 10v9M12 10v9M16 10v9M20 10v9M3 21h18M3 10h18",
  shirt: "M16 3l4.4 1.5a2 2 0 0 1 1.3 2.2l-.6 3.5a1 1 0 0 1-1 .8H18v9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-9H4.9a1 1 0 0 1-1-.8l-.6-3.5a2 2 0 0 1 1.3-2.2L8 3a4 4 0 0 0 8 0Z",
  key: "M7 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM10 10h10M16 10v3M20 10v3",
  mail: "M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM22 7l-10 7L2 7",
  file: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5ZM14 3v5h5M9 13h6M9 17h6",
  wine: "M8 22h8M12 14v8M7 3h10l-.7 5.2a4.3 4.3 0 0 1-8.6 0L7 3Z",
  flake: "M12 2v20M3.34 7l17.32 10M3.34 17l17.32-10M12 2l-2.5 2.5M12 2l2.5 2.5M12 22l-2.5-2.5M12 22l2.5-2.5M3.34 7l.4 3.4M3.34 7l3.4-.4M20.66 17l-.4-3.4M20.66 17l-3.4.4M20.66 7l-3.4-.4M20.66 7l-.4 3.4M3.34 17l3.4.4M3.34 17l.4-3.4",
};

// Glyph icons that read better as solid silhouettes than hollow outlines. Everything
// else stays line-art (stroke 2) for a consistent, principled icon system.
const SOLID_ICONS = new Set(["flame", "play", "pause"]);
const Icon = React.memo(({ name, size = 18, stroke = 2, style }) => {
  const solid = SOLID_ICONS.has(name);
  return (
    <svg data-ico={name} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" style={{ display: "block", flexShrink: 0, transformBox: "fill-box", transformOrigin: "center", ...style }}>
      <path d={ICONS[name] || ICONS.book} fill={solid ? "currentColor" : "none"} stroke={solid ? "none" : "currentColor"} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" fillRule="evenodd" clipRule="evenodd" />
    </svg>
  );
});

const IconBadge = React.memo(({ name, color = PAL.A, bg, size = 32 }) => (
  <span style={{ width: size, height: size, borderRadius: Math.round(size * 0.34), display: "inline-flex", alignItems: "center", justifyContent: "center", color, background: bg || `linear-gradient(180deg, ${color}1F 0%, ${color}08 100%)`, border: `1px solid ${color}26`, boxShadow: `inset 0 1px 0 ${color}14`, flexShrink: 0 }}>
    <Icon name={name} size={Math.max(15, size - 15)} />
  </span>
));

// Progress nav icon — three ascending bars. When the tab is active they rise from the
// baseline in sequence (keyed remount replays it), signifying progress/growth.
const ProgressIcon = React.memo(({ size = 21, color = PAL.TD, active }) => {
  const bars = [{ x: 4, h: 7 }, { x: 10, h: 12 }, { x: 16, h: 17 }];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ display: "block" }}>
      {bars.map((b, i) => (
        <rect key={(active ? "a" : "s") + i} x={b.x} y={21 - b.h} width="4" height={b.h} rx="1.4" fill={color}
          className={active ? "ad-bar-rise" : undefined}
          style={active ? { transformBox: "fill-box", transformOrigin: "bottom", animationDelay: `${i * 0.12}s` } : undefined} />
      ))}
    </svg>
  );
});

// ── Tap-driven icon micro-animations ──────────────────────────────────────────
// Every icon-bearing button springs to life in-character when tapped — the energy the
// Progress bars already have, extended app-wide. A single delegated listener (see the App
// effect) runs the matching Web-Animations keyframe on the tapped icon's <svg>, so no call
// site needs wiring and a React re-render mid-click can't cut the animation short (it lives
// on the DOM node, not on a className). Single-path stroke icons can't truly morph, so the
// vocabulary is transform-based: spin / drop / build / swing / pulse / beat, default pop.
const ICO_ANIM = {
  settings: "spin", refresh: "spin",
  bolt: "drop",
  home: "build", chart: "build", bank: "build", briefcase: "build", chip: "build",
  book: "swing", key: "swing", hand: "swing", file: "swing", mail: "swing",
  volume: "pulse", headphones: "pulse", mic: "pulse", megaphone: "pulse", message: "pulse", bell: "pulse",
  heart: "beat", flame: "beat", trophy: "beat", flake: "beat",
};
const ICO_KEYFRAMES = {
  spin:  [{ transform: "rotate(0deg)" }, { transform: "rotate(180deg)" }],
  drop:  [{ transform: "translateY(-3px)", opacity: 0.5 }, { transform: "translateY(2px)", opacity: 1 }, { transform: "translateY(0)" }],
  build: [{ transform: "translateY(3px) scale(0.8)", opacity: 0.3 }, { transform: "translateY(0) scale(1)", opacity: 1 }],
  swing: [{ transform: "rotate(0deg)" }, { transform: "rotate(-16deg)" }, { transform: "rotate(11deg)" }, { transform: "rotate(0deg)" }],
  pulse: [{ transform: "scale(1)" }, { transform: "scale(1.18)" }, { transform: "scale(1)" }],
  beat:  [{ transform: "scale(1)" }, { transform: "scale(1.26)" }, { transform: "scale(0.94)" }, { transform: "scale(1)" }],
  pop:   [{ transform: "scale(1)" }, { transform: "scale(1.28)" }, { transform: "scale(1)" }],
};
const ICO_TIMING = { spin: 500, drop: 430, build: 420, swing: 540, pulse: 360, beat: 440, pop: 340 };
const ICO_EASE = { spin: "cubic-bezier(.34,1.18,.4,1)", swing: "cubic-bezier(.36,.07,.19,.97)", pop: "cubic-bezier(.2,.7,.3,1.3)", beat: "ease-out", pulse: "ease-out", drop: "cubic-bezier(.3,1.5,.5,1)", build: "cubic-bezier(.2,.8,.3,1.1)" };
function playIconTap(svg) {
  if (!svg || typeof svg.animate !== "function") return;
  const type = ICO_ANIM[svg.getAttribute("data-ico")] || "pop";
  try { if (svg.__ico) svg.__ico.cancel(); } catch (e) {}
  try { svg.__ico = svg.animate(ICO_KEYFRAMES[type], { duration: ICO_TIMING[type], easing: ICO_EASE[type] || "ease-out" }); } catch (e) {}
}

// One-tap session presets for a topic — collapse the multi-axis configurator into three
// sensible starting shapes (mode · difficulty · length). The full controls stay one tap away
// under "Advanced". `len` is capped to the topic's available card count at use.
const SESSION_PRESETS = [
  { key: "quick",    label: "Quick",    tag: "Recall",  mode: "vocab",      diff: "mixed", len: 10, icon: "layers" },
  { key: "speak",    label: "Speak",    tag: "Aloud",   mode: "speaking",   diff: "mixed", len: 12, icon: "mic" },
  { key: "standard", label: "Standard", tag: "Produce", mode: "production", diff: "mixed", len: 15, icon: "keyboard" },
  { key: "deep",     label: "Deep",     tag: "Hard",    mode: "production", diff: "hard",  len: 20, icon: "bolt" },
];


class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error && error.message ? error.message : "Unexpected render error"
    };
  }

  componentDidCatch(error, info) {
    try {
      localStorage.setItem("ad-last-error-v1", JSON.stringify({
        at: new Date().toISOString(),
        message: error && error.message ? error.message : String(error),
        stack: error && error.stack ? error.stack : "",
        componentStack: info && info.componentStack ? info.componentStack : ""
      }));
    } catch (e) {}
  }

  restartApp = ({ clearSession = false } = {}) => {
    try {
      localStorage.removeItem("ad-last-error-v1");
      if (clearSession) localStorage.removeItem("gfc-last-v7");
    } catch (e) {}
    const url = new URL(window.location.href);
    url.searchParams.set("recover", String(Date.now()));
    window.location.replace(url.toString());
  };

  reloadApp = () => {
    this.restartApp();
  };

  resetSessionAndReload = () => {
    this.restartApp({ clearSession: true });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{ minHeight: DVH, background: PAL.BG, color: PAL.T, padding: "40px 24px 24px", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Montserrat',sans-serif" }}>
        <div style={{ width: "100%", maxWidth: 360, background: "linear-gradient(180deg, #171717 0%, #101010 100%)", border: `1px solid ${PAL.B}`, borderRadius: 16, padding: "24px 22px", textAlign: "center", boxShadow: "0 20px 50px rgba(0,0,0,0.35)" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <IconBadge name="refresh" size={38} color={PAL.A} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>App recovered</div>
          <div style={{ color: PAL.TD, fontSize: 13, lineHeight: 1.5, marginBottom: 18 }}>
            AutoDeutsch hit an unexpected error and stopped the current screen. Your saved progress is still on this device.
          </div>
          <button
            type="button"
            onClick={this.reloadApp}
            style={{ width: "100%", height: 48, borderRadius: 12, border: "none", background: PAL.A, color: PAL.BG, fontFamily: "inherit", fontWeight: 800, fontSize: 15, cursor: "pointer", marginBottom: 10 }}>
            Reload app
          </button>
          <button
            type="button"
            onClick={this.resetSessionAndReload}
            style={{ width: "100%", height: 46, borderRadius: 12, border: `1px solid ${PAL.B}`, background: "#161616", color: PAL.T, fontFamily: "inherit", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            Reset current session
          </button>
          {this.state.message && <div style={{ marginTop: 14, fontSize: 11, color: PAL.TD, wordBreak: "break-word" }}>
            {this.state.message}
          </div>}
        </div>
      </div>
    );
  }
}

const Btn = React.memo(({ children, bg, color, border, onClick, style: s, ariaLabel }) => (
  <button type="button" aria-label={ariaLabel} onClick={onClick} style={{ padding: "16px", borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: "pointer", border: border || "none", background: bg || PAL.SH, color: color || PAL.T, width: "100%", letterSpacing: 0.3, ...s }}>{children}</button>
));

const SpeakBtn = React.memo(({ text }) => (
  <button type="button" aria-label={`Hear ${text}`} onClick={() => speak(text)} style={{ background: "#FFCC0012", border: `1px solid ${PAL.A}44`, borderRadius: 10, padding: "7px 14px", color: PAL.A, fontSize: 12, cursor: "pointer", marginTop: 8, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}>
    <Icon name="volume" size={14} /> Hören
  </button>
));

const ProgBar = React.memo(({ pct, color }) => (
  <div style={{ height: 5, background: "rgba(255,255,255,0.07)", borderRadius: 999, marginBottom: 18, overflow: "hidden" }}>
    <div style={{
      height: "100%",
      width: `${pct}%`,
      background: color === PAL.R
        ? `linear-gradient(90deg, ${PAL.R}99, ${PAL.R})`
        : `linear-gradient(90deg, ${PAL.AD}, ${PAL.A})`,
      borderRadius: 999,
      boxShadow: color === PAL.R ? `0 0 10px ${PAL.R}66` : `0 0 10px ${PAL.A}50`,
      transition: "width 0.35s ease-out"
    }} />
  </div>
));

// ── MAIN APP ──
// Animated count-up number — eases from `from` (default 0) to `value` on mount and whenever
// value changes. Honors prefers-reduced-motion. Renders a number, or format(n) if provided.
function CountUp({ value, duration = 700, from = 0, format }) {
  const [d, setD] = useState(from);
  const prev = useRef(from);
  useEffect(() => {
    const a = prev.current, b = value; prev.current = value;
    const reduce = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || typeof b !== "number" || typeof a !== "number" || a === b) { setD(b); return; }
    let raf, t0;
    const ease = p => 1 - Math.pow(1 - p, 3);
    const step = t => { if (!t0) t0 = t; const p = Math.min(1, (t - t0) / duration); setD(a + (b - a) * ease(p)); if (p < 1) raf = requestAnimationFrame(step); else setD(b); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  const shown = typeof d === "number" ? Math.round(d) : d;
  return format ? format(shown) : shown;
}

// Tap-to-insert German special characters, pinned above a text input. Uses pointerdown +
// preventDefault so the input keeps focus — the character lands at the caret, keyboard stays up.
function UmlautBar({ onInsert }) {
  const keys = ["ä", "ö", "ü", "ß", "Ä", "Ö", "Ü"];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
      {keys.map(k => (
        <button key={k} type="button" className="ad-uk" aria-label={`Insert ${k}`}
          onPointerDown={e => { e.preventDefault(); onInsert(k); }}
          style={{ flex: "1 1 0", minWidth: 34, padding: "9px 0", borderRadius: 9, background: PAL.SH, border: `1px solid ${PAL.B}`, color: PAL.A, fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "transform .08s ease, background .15s ease, border-color .15s ease" }}>
          {k}
        </button>
      ))}
    </div>
  );
}

// Brand-coloured confetti burst (German-flag gold/red/white + success green) for the
// celebration peaks. Pure CSS particles, no library; honours reduced-motion. Particles
// explode from the centre and arc down via per-particle CSS custom properties.
const CONFETTI_COLORS = ["#FFCC00", "#DD0000", "#F0EDE5", "#4ADE80", "#FFD93B"];
function Confetti({ count = 46, top = "40%" }) {
  const reduce = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pieces = useMemo(() => Array.from({ length: count }, (_, i) => {
    const angle = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 170;
    return {
      tx: Math.cos(angle) * dist,
      ty: Math.sin(angle) * dist + 70 + Math.random() * 170, // gravity drift down
      rot: Math.random() * 720 - 360,
      size: 5 + Math.random() * 6,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      delay: Math.random() * 0.12,
      dur: 1.1 + Math.random() * 0.8,
      round: Math.random() > 0.55,
      left: 50 + (Math.random() * 26 - 13),
    };
  }), [count]);
  if (reduce) return null;
  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {pieces.map((p, i) => (
        <span key={i} style={{
          position: "absolute", left: `${p.left}%`, top,
          width: p.size, height: p.round ? p.size : p.size * 0.5,
          background: p.color, borderRadius: p.round ? "50%" : 1.5,
          "--tx": `${p.tx}px`, "--ty": `${p.ty}px`, "--rot": `${p.rot}deg`,
          animation: `ad-confetti ${p.dur}s ${p.delay}s cubic-bezier(.15,.7,.4,1) forwards`,
          willChange: "transform, opacity",
        }} />
      ))}
    </div>
  );
}

function App() {
  const [screen, setScreen] = useState("home");
  const screenRef = useRef("home");
  screenRef.current = screen; // current screen, readable synchronously from callbacks/timers
  // Milestone celebrations (streak / goal / chapter / rank-up) are held in this queue while
  // the player is in a session and only played once they're back on the calm home screen, so
  // nothing interrupts active play. Drained serially by the flush effect below.
  const celebQueueRef = useRef([]);
  const [mode, setMode] = useState("vocab");
  const [cards, setCards] = useState([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [flyOff, setFlyOff] = useState(false); // amplifies the card's exit into a "fly away" on advance (non-flip cards)
  const [answered, setAnswered] = useState(false);
  const [stats, setStats] = useState({ c: 0, w: 0 });
  const [failed, setFailed] = useState([]);
  const [failedNames, setFailedNames] = useState([]);
  const [rpt, setRpt] = useState(0);
  const [prog, setProg] = useState({});
  const [known, setKnown] = useState(() => new Set());   // vocab words the user marked as known (knownKey)
  // Level focus (all | A1 | A2 | B1 | B2) — a sticky preference, surfaced on home so the
  // learner can aim sessions at their CEFR level (e.g. B2) without digging into the modal.
  // "auto" (the default) follows the learner's current CEFR level so sessions stay
  // level-appropriate and advance A1→A2→B1→B2 as each band is mastered — important now
  // the deck spans A1–B2 (a flat "all" pool would swamp a beginner with B2 words).
  const [setupLevel, setSetupLevel] = useState(() => {
    try {
      let v = localStorage.getItem("ad-level-v1");
      // One-time migration: the old default was the flat "all" pool (the selector lived
      // behind Advanced, so most "all" values are the default, not a deliberate choice).
      // Convert legacy "all"/unset to "auto" once; explicit bands (A1…B2) are kept.
      if (!localStorage.getItem("ad-level-mig-v1")) {
        if (!v || v === "all") v = "auto";
        localStorage.setItem("ad-level-v1", v);
        localStorage.setItem("ad-level-mig-v1", "1");
      }
      return v || "auto";
    } catch (e) { return "auto"; }
  });
  const setSessLevel = useCallback((lvl) => { setSetupLevel(lvl); try { localStorage.setItem("ad-level-v1", lvl); } catch (e) {} }, []);
  const [clozeTopic, setClozeTopic] = useState("all");      // grammar cloze focus: all | adjektiv | praeteritum | konjunktiv
  const [diffBand, setDiffBand] = useState("all");          // sentence/cloze difficulty band: all | easy | core | hard
  const [browseQuery, setBrowseQuery] = useState("");     // word-browser search text
  const [browseFilter, setBrowseFilter] = useState("all"); // word-browser: "all" | "known" | "mastered"
  // Which home-library groups are expanded. Persisted so the layout feels stable;
  // undefined = default (first group open, rest collapsed).
  const [openGroups, setOpenGroups] = useState(() => { try { return JSON.parse(localStorage.getItem("ad-lib-groups-v1") || "{}") || {}; } catch (e) { return {}; } });
  const toggleGroup = (g) => setOpenGroups(prev => {
    const next = { ...prev, [g]: !(prev[g] ?? (g === LIB_GROUPS[0].name)) };
    try { localStorage.setItem("ad-lib-groups-v1", JSON.stringify(next)); } catch (e) {}
    return next;
  });
  // AI Tutor (bring-your-own Anthropic key; everything stays on-device, calls go direct to Anthropic)
  const [aiKey, setAiKey] = useState(() => { try { return localStorage.getItem("gfc-ai-key") || ""; } catch (e) { return ""; } });
  const [aiModel, setAiModel] = useState(() => { try { return localStorage.getItem("gfc-ai-model") || "claude-sonnet-4-6"; } catch (e) { return "claude-sonnet-4-6"; } });
  const [tutorMsgs, setTutorMsgs] = useState(() => { try { return JSON.parse(localStorage.getItem("gfc-tutor-msgs") || "[]"); } catch (e) { return []; } });
  const [tutorInput, setTutorInput] = useState("");
  const [tutorBusy, setTutorBusy] = useState(false);
  const [tutorError, setTutorError] = useState("");
  const [showEx, setShowEx] = useState(false);
  const [showHint, setShowHint] = useState(false); // NEW: mnemonic hint toggle
  const [vis, setVis] = useState(true);
  const [feedback, setFeedback] = useState(null); // "correct" | "wrong" | null — drives answer-feedback animation
  const [showSetup, setShowSetup] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false); // setup modal: full controls collapsed behind presets
  const [setupCat, setSetupCat] = useState(null);
  // Preferred mode persists across reloads: seeded from the onboarding choice, then
  // updated as the learner picks modes, so the hero CTA always reflects their default.
  const [setupMode, setSetupMode] = useState(() => {
    try {
      const saved = localStorage.getItem("ad-mode-v1");
      if (saved) return saved;
      // No stored mode → honour the onboarding choice if any, else default to production
      // (the app's core mastery mode — unchanged behaviour for existing users).
      return JSON.parse(localStorage.getItem("ad-onboarding-pref-v1") || "{}").preferredMode || "production";
    } catch (e) { return "production"; }
  });
  useEffect(() => { try { localStorage.setItem("ad-mode-v1", setupMode); } catch (e) {} }, [setupMode]);
  const [sessLen, setSessLen] = useState(15);
  const [category, setCategory] = useState("");
  const [input, setInput] = useState("");
  const [inputResult, setInputResult] = useState(null);
  const [bloom, setBloom] = useState(0); // counter; bumps on a correct typed answer to retrigger the green bloom
  const [sel, setSel] = useState(null);
  const [tStart, setTStart] = useState(0);
  const [lastElapsed, setLastElapsed] = useState(0); // NEW: for automaticity display
  const [revealElapsed, setRevealElapsed] = useState(0);
  const [lastBoxMove, setLastBoxMove] = useState(null); // {from, to} SRS box move of the last answer
  const [combo, setCombo] = useState(0); // consecutive correct answers this session (momentum signal)
  const sessionGains = useRef({ mastered: 0, learned: 0 }); // real SRS progress earned this session → shown on results
  // Sentence building
  const [sbPool, setSbPool] = useState([]);
  const [sbPicked, setSbPicked] = useState([]);
  const [sbCorrect, setSbCorrect] = useState(false);
  const [sbChecked, setSbChecked] = useState(false);
  // Verb tense
  const [verbTense, setVerbTense] = useState("present");
  // Imperativ persons (multi-select: which forms to drill)
  const [impPersons, setImpPersons] = useState({ du: true, ihr: true, sie: true });
  // Listening mode: "listen" (tap-to-reveal) or "questions" (comprehension MCQ)
  const [listenMode, setListenMode] = useState("listen");
  // Session difficulty: "mixed" (default), "easy", "hard" — influences card selection order only
  const [sessDiff, setSessDiff] = useState("mixed");
  // Auto-advance after exact-correct answers (1s). Persisted; default on.
  const [autoAdvance, setAutoAdvance] = useState(() => { try { return localStorage.getItem("gfc-autoadv-v1") !== "0"; } catch (e) { return true; } });
  const toggleAutoAdvance = () => setAutoAdvance(v => { const n = !v; try { localStorage.setItem("gfc-autoadv-v1", n ? "1" : "0"); } catch (e) {} return n; });
  // Sound effects (synthesized cues on correct/wrong/celebrate). Default on.
  const [sfxOn, setSfxOn] = useState(() => sfxEnabled());
  const toggleSfx = () => setSfxOn(v => { const n = !v; setSfxEnabled(n); if (n) playSfx("correct"); return n; });
  // Daily reminder (opt-in local notification). Persisted; permission gated.
  const [reminderOn, setReminderOn] = useState(() => { try { return localStorage.getItem("ad-reminder-on-v1") === "1"; } catch (e) { return false; } });
  const [reminderTime, setReminderTime] = useState(() => { try { return localStorage.getItem("ad-reminder-time-v1") || "19:00"; } catch (e) { return "19:00"; } });
  const [notifPerm, setNotifPerm] = useState(() => (typeof Notification !== "undefined" ? Notification.permission : "unsupported"));
  const reminderTimerRef = useRef(null);
  const dailyRef = useRef(null); // latest {count, goal, date} read inside the fire callback
  // Audio mode state
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioPauseLen, setAudioPauseLen] = useState(3500); // ms between utterances
  const [audioEnFirst, setAudioEnFirst] = useState(false); // EN→DE order instead of DE→EN
  const [audioIncludeExample, setAudioIncludeExample] = useState(false);
  // German TTS voice picker ("" = auto). Voices load async via voiceschanged.
  const [voiceName, setVoiceName] = useState(TTS_VOICE);
  const [deVoices, setDeVoices] = useState([]);
  useEffect(() => {
    if (!window.speechSynthesis) return;
    const load = () => {
      const seen = new Set();
      setDeVoices(window.speechSynthesis.getVoices()
        .filter(v => v.lang && v.lang.toLowerCase().startsWith("de"))
        .filter(v => !seen.has(v.name) && seen.add(v.name)));
    };
    load();
    try {
      window.speechSynthesis.addEventListener("voiceschanged", load);
      return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
    } catch (e) {}
  }, []);
  // NEW: Dialogue state
  const [dlgIdx, setDlgIdx] = useState(0);
  const [dlgRevealed, setDlgRevealed] = useState({});
  // P0 mission spine: per-mission step progress (SRS-independent) + the mission being viewed.
  const [missionProg, setMissionProg] = useState(() => { try { return JSON.parse(localStorage.getItem("ad-mission-progress-v1") || "{}"); } catch (e) { return {}; } });
  const [activeMission, setActiveMission] = useState(null); // mission id when on the mission-detail screen
  const missionReturnRef = useRef(null); // {id, step} so a mission-launched session credits the step on results
  // Listening-first (default on): the German line stays hidden until you've heard it, so a
  // dialogue trains the ear instead of being read along. Toggle to "Read along" for the old
  // always-visible behaviour; persisted across sessions.
  const [dlgListenFirst, setDlgListenFirst] = useState(() => { try { return localStorage.getItem("gfc-dlg-listen-v1") !== "0"; } catch (e) { return true; } });
  const toggleDlgListen = () => setDlgListenFirst(v => { const n = !v; try { localStorage.setItem("gfc-dlg-listen-v1", n ? "1" : "0"); } catch (e) {} return n; });
  // Token guards the sequential play-all loop: bumping it (nav/replay) stops the old loop.
  const dlgPlayRef = useRef(0);
  const dlgStopPlay = () => { dlgPlayRef.current++; try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {} };
  const playDialogue = async (lines) => {
    const tok = ++dlgPlayRef.current;
    for (let i = 0; i < lines.length; i++) {
      if (dlgPlayRef.current !== tok) return;
      await speakWith(lines[i].de);
      if (dlgPlayRef.current !== tok) return;
      // Reveal each line only after it has been heard — keeps "Play all" listening-first.
      setDlgRevealed(r => (r[i] ? r : { ...r, [i]: true }));
      await new Promise(r => setTimeout(r, 500));
    }
  };
  // NEW: Streak + daily stats
  const [dailyStats, setDailyStats] = useState({ date: todayKey(), count: 0, streak: 0 });
  // Banked Streak Freezes (0–MAX). New users get one as a safety net; one is earned every
  // 7 streak-days. A freeze auto-absorbs a missed day so the streak isn't lost.
  const [freezes, setFreezes] = useState(() => {
    try { const v = parseInt(localStorage.getItem("gfc-freezes-v1"), 10); return Number.isFinite(v) ? Math.max(0, Math.min(MAX_FREEZES, v)) : 1; } catch (e) { return 1; }
  });
  const persistFreezes = useCallback((n) => { try { localStorage.setItem("gfc-freezes-v1", String(n)); } catch (e) {} }, []);
  const earnFreeze = useCallback(() => setFreezes(f => { const n = Math.min(MAX_FREEZES, f + 1); persistFreezes(n); return n; }), [persistFreezes]);
  // Set when a freeze was spent on app open, to tell the user their streak was saved.
  const [freezeNotice, setFreezeNotice] = useState(null); // { streak } | null
  // User-adjustable daily goal (cards/day target). Default 20 preserves behaviour for existing users.
  const [dailyGoal, setDailyGoal] = useState(20);
  // Daily trend stats: { "YYYY-MM-DD": {attempts, correct, totalMs}, ... } — last 60 days
  // Only the FIRST attempt on each card per session is counted (repeats don't reflect real recall).
  const [trendStats, setTrendStats] = useState({});
  const [showTrendBreakdown, setShowTrendBreakdown] = useState(false);
  const [newlyMastered, setNewlyMastered] = useState([]);
  const [masteryBurst, setMasteryBurst] = useState(null);
  // Non-blocking full-screen celebration (daily goal reached, streak milestone).
  // { color, icon, tag, big, sub, subIcon } | null
  const [celebration, setCelebration] = useState(null);
  const [rankUp, setRankUp] = useState(null); // {from, to} — a full CEFR level was just completed
  const prevLevelRef = useRef(null);
  const prevChaptersRef = useRef(null);
  const celebrateTimerRef = useRef(null);
  // Queue a celebration instead of showing it now; the flush effect plays it on home.
  const showCelebration = useCallback((c) => { celebQueueRef.current.push({ kind: "toast", payload: c }); }, []);
  const celebrateGoal = useCallback((d) => showCelebration({
    color: "#4ADE80", icon: "check", tag: "Daily goal reached", big: `${d.count} cards today`,
    sub: `${d.streak}-day streak going strong`, subIcon: "flame",
  }), [showCelebration]);
  const celebrateStreak = useCallback((n) => showCelebration({
    color: "#FFCC00", icon: "flame", tag: `${n}-day streak`,
    big: n >= 100 ? "Legendary." : n >= 30 ? "Unstoppable." : n >= 14 ? "On fire." : "You're on a roll!",
    sub: "Keep it alive — come back tomorrow", subIcon: null,
  }), [showCelebration]);
  // Session-complete flourish: a short arpeggio when you reach the results having cleared
  // every card (graded modes only). Fires once on entering the screen.
  useEffect(() => {
    if (screen === "results" && failed.length === 0 && mode !== "audio") playSfx("win");
  }, [screen]); // eslint-disable-line react-hooks/exhaustive-deps
  const [lastSession, setLastSession] = useState(null);
  // Detect whether localStorage actually writes (false in Safari private mode / quota exhausted)
  const [storageOK, setStorageOK] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [importError, setImportError] = useState("");
  const [updateCheckMsg, setUpdateCheckMsg] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingLevel, setOnboardingLevel] = useState("A1");
  const [onboardingGoal, setOnboardingGoal] = useState(20);
  const [onboardingMode, setOnboardingMode] = useState("vocab");
  // P5 placement flow state: intake → placement → result.
  const [obStep, setObStep] = useState("intake");
  const [intakeAns, setIntakeAns] = useState({});
  const [plItems, setPlItems] = useState([]);
  const [plIdx, setPlIdx] = useState(0);
  const [plScore, setPlScore] = useState({});
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [offlineReady, setOfflineReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Saved locally");
  // New version of the app is installed and waiting
  const [updateAvailable, setUpdateAvailable] = useState(false);

  const inputRef = useRef(null);
  // Per-session snapshot of prior lastSeen values, keyed by storage key. Lets CardStats
  // show "Last seen Nd ago" without polluting the exportable prog object.
  const priorLastSeenRef = useRef({});
  const typedInputRef = useRef(null);      // current typed-answer <input>, for the umlaut bar
  const feedbackTimerRef = useRef(null);   // clears the answer-feedback class after it plays
  // Speaking mode: mic state + the live SpeechRecognition instance.
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [speechErr, setSpeechErr] = useState("");
  const recogRef = useRef(null);
  // Audio-mode playback control. audioTimer = setTimeout id for next step; wakeLockRef
  // holds the Screen Wake Lock so the phone doesn't dim/sleep during playback.
  const audioTimerRef = useRef(null);
  const audioPlayingRef = useRef(false); // mirrors audioPlaying for use inside async callbacks
  const wakeLockRef = useRef(null);
  // Keys of cards already counted toward trend stats this session. Resets on new session start;
  // explicitly NOT reset by startRepeat — repeats must not affect averages.
  const countedKeysRef = useRef(new Set());
  // Keys already re-queued for an in-session retry (one retry per card per session).
  const requeuedRef = useRef(new Set());
  // Listening mode "Play all" — stores timer IDs so we can cancel the chain on re-tap
  const playAllTimersRef = useRef([]);
  // Prevent double-taps from scheduling two "next card" transitions and pushing idx past cards.length.
  const navLockRef = useRef(false);
  // Live cards.length for advance guards. The swipe path calls nextCard from a setTimeout
  // whose closure pre-dates an in-session retry splice; reading length via ref keeps the
  // "last card?" decision correct even then.
  const cardsLenRef = useRef(0);
  const [playAllActive, setPlayAllActive] = useState(false);
  const stopPlayAll = useCallback(() => {
    playAllTimersRef.current.forEach(t => clearTimeout(t));
    playAllTimersRef.current = [];
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setPlayAllActive(false);
  }, []);

  // Load progress + daily stats
  useEffect(() => {
    // Probe write-capability — catches Safari private mode and quota-exhausted states.
    try {
      const probe = "__gfc_probe";
      localStorage.setItem(probe, "1");
      if (localStorage.getItem(probe) !== "1") throw new Error("readback mismatch");
      localStorage.removeItem(probe);
    } catch (e) {
      setStorageOK(false);
    }
    // Ask the browser to protect this origin's storage from eviction (months of
    // progress live only in localStorage). Silently ignored where unsupported.
    try { navigator.storage?.persist?.(); } catch (e) {}
    (async () => {
      let hasProgress = false;
      try {
        const r = localStorage.getItem("gfc-v7");
        if (r) { hasProgress = true; setProg(JSON.parse(r)); }
      } catch (e) {
        // Main blob unreadable (corrupted write, quota kill mid-write) — fall back to
        // the daily last-good snapshot rather than silently starting from zero.
        try {
          const b = localStorage.getItem("gfc-v7-backup");
          if (b) { hasProgress = true; setProg(JSON.parse(b)); setSaveStatus("Restored from backup"); }
        } catch (e2) {}
      }
      try {
        const kn = localStorage.getItem("gfc-known-v7");
        if (kn) { const arr = JSON.parse(kn); if (Array.isArray(arr)) setKnown(new Set(arr)); }
      } catch (e) {}
      try {
        const d = localStorage.getItem("gfc-daily-v7");
        if (d) {
          const parsed = JSON.parse(d);
          const today = todayKey();
          if (parsed.date === today) {
            setDailyStats(parsed);
          } else {
            // New day. Carry the streak if active yesterday; if a day was missed, spend
            // banked Streak Freezes to absorb it. Do NOT increment here — record() handles
            // the increment when the user actually practises.
            const parseDay = s => { const p = String(s).split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]).getTime(); };
            const gap = Math.round((parseDay(today) - parseDay(parsed.date)) / 86400000);
            const missed = Math.max(0, gap - 1); // full days skipped between last active day and today
            const wasActive = (parsed.count || 0) > 0;
            let newStreak = 0;
            if (wasActive && missed === 0) {
              newStreak = parsed.streak; // active yesterday → carry
            } else if (wasActive && parsed.streak > 0 && missed > 0) {
              let have = 1;
              try { const v = parseInt(localStorage.getItem("gfc-freezes-v1"), 10); have = Number.isFinite(v) ? v : 1; } catch (e) {}
              if (have >= missed) {
                const left = have - missed;
                setFreezes(left); persistFreezes(left);
                newStreak = parsed.streak; // streak saved by the freeze(s)
                setFreezeNotice({ streak: parsed.streak });
                // Persist date=today so reopening before practising doesn't double-spend.
                saveDaily({ date: today, count: 0, streak: newStreak });
              }
            }
            setDailyStats({ date: today, count: 0, streak: newStreak });
          }
        }
      } catch (e) {}
      try {
        const ls = localStorage.getItem("gfc-last-v7");
        if (ls) setLastSession(JSON.parse(ls));
      } catch (e) {}
      try {
        const g = localStorage.getItem("gfc-goal-v7");
        if (g) {
          const parsed = parseInt(g, 10);
          if (Number.isFinite(parsed) && parsed >= 10 && parsed <= 200) setDailyGoal(parsed);
        }
      } catch (e) {}
      try {
        const ts = localStorage.getItem("gfc-stats-v7");
        if (ts) {
          const parsed = JSON.parse(ts);
          if (parsed && typeof parsed === "object") setTrendStats(parsed);
        }
      } catch (e) {}
      try {
        const seenOnboarding = localStorage.getItem("ad-onboarding-v1") === "done";
        if (!seenOnboarding && !hasProgress) setShowOnboarding(true);
      } catch (e) {
        if (!hasProgress) setShowOnboarding(true);
      }
    })();
  }, []);

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    const updateOfflineReady = () => setOfflineReady(Boolean(navigator.serviceWorker?.controller || window.__SW_REG__));
    updateOnline();
    updateOfflineReady();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    window.addEventListener("sw-update-available", updateOfflineReady);
    navigator.serviceWorker?.addEventListener?.("controllerchange", updateOfflineReady);
    const t = setInterval(updateOfflineReady, 1500);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
      window.removeEventListener("sw-update-available", updateOfflineReady);
      navigator.serviceWorker?.removeEventListener?.("controllerchange", updateOfflineReady);
      clearInterval(t);
    };
  }, []);

  // Tap animation for every icon-bearing button. One delegated capture-phase listener (so it
  // fires even when the button's handler stops propagation) plays the icon's in-character
  // Web-Animations keyframe. Skipped under reduced-motion. Mounted once.
  useEffect(() => {
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
    const onClick = (e) => {
      if (reduce && reduce.matches) return;
      const t = e.target;
      const btn = t && t.closest ? t.closest('button, [role="button"]') : null;
      if (!btn) return;
      const svg = btn.querySelector('svg[data-ico]');
      if (svg) playIconTap(svg);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Collapse the setup modal's Advanced controls each time it opens (presets-first).
  useEffect(() => { if (showSetup) setShowAdvanced(false); }, [showSetup]);

  // Debounce the main progress write — it fires on every card answer and the prog object
  // can grow to ~200KB. Writes less often during active sessions, flushes on page leave.
  const saveTimer = useRef(null);
  const pendingProgRef = useRef(null);
  // Once per day, before the first overwrite, copy the current (known-good) blob to a
  // backup key. If a later write corrupts gfc-v7, load() falls back to this snapshot —
  // worst case loses one day of progress instead of everything.
  const snapshotProgOnce = useCallback(() => {
    try {
      const today = todayKey();
      if (localStorage.getItem("gfc-v7-backup-date") === today) return;
      const cur = localStorage.getItem("gfc-v7");
      if (cur) {
        localStorage.setItem("gfc-v7-backup", cur);
        localStorage.setItem("gfc-v7-backup-date", today);
      }
    } catch (e) {}
  }, []);
  const save = useCallback(p => {
    pendingProgRef.current = p;
    setSaveStatus("Saving locally...");
    if (saveTimer.current) return; // already scheduled
    saveTimer.current = setTimeout(() => {
      snapshotProgOnce();
      try { localStorage.setItem("gfc-v7", JSON.stringify(pendingProgRef.current)); setSaveStatus("Saved locally"); } catch (e) { setSaveStatus("Storage blocked"); }
      saveTimer.current = null;
      pendingProgRef.current = null;
    }, 400);
  }, [snapshotProgOnce]);
  const flushProg = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (pendingProgRef.current) {
      snapshotProgOnce();
      try { localStorage.setItem("gfc-v7", JSON.stringify(pendingProgRef.current)); setSaveStatus("Saved locally"); } catch (e) { setSaveStatus("Storage blocked"); }
      pendingProgRef.current = null;
    }
  }, [snapshotProgOnce]);
  const saveDaily = useCallback(d => { try { localStorage.setItem("gfc-daily-v7", JSON.stringify(d)); setSaveStatus("Saved locally"); } catch (e) { setSaveStatus("Storage blocked"); } }, []);
  const saveLast = useCallback(ls => { try { localStorage.setItem("gfc-last-v7", JSON.stringify(ls)); } catch (e) {} }, []);

  // ── Daily reminder scheduling ──
  // Keep a ref of today's progress so the fire callback can decide whether to skip a nag
  // without making the scheduler depend on (and re-run for) every card answered.
  useEffect(() => { dailyRef.current = { count: dailyStats.count, goal: dailyGoal, date: dailyStats.date }; }, [dailyStats, dailyGoal]);
  const rescheduleReminder = useCallback(async () => {
    if (reminderTimerRef.current) { clearTimeout(reminderTimerRef.current); reminderTimerRef.current = null; }
    let reg = (typeof window !== "undefined" && window.__SW_REG__) || null;
    try { if (!reg && navigator.serviceWorker) reg = await navigator.serviceWorker.ready; } catch (e) {}
    await clearScheduledReminders(reg);
    if (!reminderOn || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    // Preferred path: schedule a week of triggers that fire even when the app is closed.
    if (reg && triggersSupported()) {
      try {
        for (const ts of reminderTimes(reminderTime, 7)) {
          await reg.showNotification(REMINDER_TITLE, {
            tag: REMINDER_TAG + "-" + ts, body: REMINDER_BODY,
            icon: "./icons/icon-192x192.png", badge: "./icons/icon-192x192.png",
            showTrigger: new window.TimestampTrigger(ts), data: { url: "./" },
          });
        }
        return;
      } catch (e) { /* fall through to foreground timer */ }
    }
    // Fallback: fire once at the next occurrence while a tab is open, then re-arm.
    const ts = reminderTimes(reminderTime, 2)[0];
    if (!ts) return;
    const delay = ts - Date.now();
    if (delay <= 0 || delay > 2147483647) return; // setTimeout ceiling (~24.8 days)
    reminderTimerRef.current = setTimeout(() => {
      try {
        const d = dailyRef.current;
        const metToday = d && d.date === todayKey() && d.count >= d.goal;
        if (!metToday && typeof Notification !== "undefined" && Notification.permission === "granted") {
          if (reg) reg.showNotification(REMINDER_TITLE, { tag: REMINDER_TAG, body: REMINDER_BODY, icon: "./icons/icon-192x192.png", data: { url: "./" } });
          else new Notification(REMINDER_TITLE, { body: REMINDER_BODY });
        }
      } catch (e) {}
      rescheduleReminder();
    }, delay);
  }, [reminderOn, reminderTime]);
  useEffect(() => {
    rescheduleReminder();
    const onVis = () => { if (document.visibilityState === "visible") rescheduleReminder(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { document.removeEventListener("visibilitychange", onVis); if (reminderTimerRef.current) clearTimeout(reminderTimerRef.current); };
  }, [rescheduleReminder]);
  const toggleReminder = useCallback(async () => {
    if (reminderOn) { setReminderOn(false); try { localStorage.setItem("ad-reminder-on-v1", "0"); } catch (e) {} return; }
    if (typeof Notification === "undefined") { setNotifPerm("unsupported"); return; }
    let perm = Notification.permission;
    if (perm === "default") { try { perm = await Notification.requestPermission(); } catch (e) {} }
    setNotifPerm(perm);
    if (perm !== "granted") return; // denied/dismissed → leave the toggle off
    setReminderOn(true); try { localStorage.setItem("ad-reminder-on-v1", "1"); } catch (e) {}
  }, [reminderOn]);
  const updateReminderTime = useCallback((t) => {
    if (!t) return;
    setReminderTime(t); try { localStorage.setItem("ad-reminder-time-v1", t); } catch (e) {}
  }, []);

  // Mark/unmark a vocab word as known. Known words are kept out of session pools but their
  // saved progress is untouched, so unmarking restores them exactly where they were.
  const toggleKnown = useCallback((cat, de) => {
    setKnown(prev => {
      const next = new Set(prev);
      const k = knownKey(cat, de);
      next.has(k) ? next.delete(k) : next.add(k);
      try { localStorage.setItem("gfc-known-v7", JSON.stringify([...next])); } catch (e) {}
      return next;
    });
  }, []);

  // Update the daily goal and persist immediately. Clamped to [10, 200] range.
  const updateDailyGoal = useCallback(n => {
    const clamped = Math.max(10, Math.min(200, Math.round(n)));
    setDailyGoal(clamped);
    try { localStorage.setItem("gfc-goal-v7", String(clamped)); } catch (e) {}
  }, []);

  // Persist trend stats (keyed by date string). Caller prunes to 60 days before passing.
  const saveTrend = useCallback(t => {
    try { localStorage.setItem("gfc-stats-v7", JSON.stringify(t)); } catch (e) {}
  }, []);

  // Audio mode: lightweight daily-goal counter (does NOT touch SRS — audio is passive exposure)
  const recordAudioHeard = useCallback(() => {
    const today = todayKey();
    setDailyStats(prev => {
      let d;
      if (prev.date === today) {
        const firstCardOfDay = prev.count === 0;
        d = { ...prev, count: prev.count + 1, streak: firstCardOfDay ? prev.streak + 1 : prev.streak };
      } else {
        // Only continue the streak if the previous activity was actually yesterday —
        // an app left open across 2+ idle midnights must not over-count.
        d = { date: today, count: 1, streak: prev.date === todayKey(new Date(Date.now() - SRS_DAY_MS)) ? prev.streak + 1 : 1 };
      }
      if (prev.date === today && prev.count < dailyGoal && d.count >= dailyGoal) {
        setTimeout(() => celebrateGoal(d), 0);
      }
      if (d.streak > prev.streak && STREAK_MILESTONES.has(d.streak)) {
        setTimeout(() => celebrateStreak(d.streak), 0);
      }
      if (d.streak > prev.streak && d.streak % 7 === 0) {
        setTimeout(() => earnFreeze(), 0);
      }
      saveDaily(d);
      return d;
    });
  }, [saveDaily, dailyGoal, celebrateGoal, celebrateStreak, earnFreeze]);

  // Screen Wake Lock: keeps the screen on during audio playback.
  // iOS 16.4+ and modern Android support it; older browsers silently no-op.
  const acquireWakeLock = useCallback(async () => {
    if (!navigator.wakeLock) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request("screen");
    } catch (e) { /* denied or unsupported — not fatal */ }
  }, []);
  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      try { wakeLockRef.current.release(); } catch (e) {}
      wakeLockRef.current = null;
    }
  }, []);

  // Pause-aware timeout. Resolves after `ms` unless playback is paused/stopped.
  const pauseAwareDelay = useCallback((ms) => {
    return new Promise(resolve => {
      audioTimerRef.current = setTimeout(() => {
        audioTimerRef.current = null;
        resolve();
      }, ms);
    });
  }, []);

  // Play through one card: speak primary → pause → speak secondary → pause → advance
  const playOneCard = useCallback(async (card) => {
    if (!audioPlayingRef.current) return;
    const de = audioIncludeExample && card.ex ? `${card.de}. ${card.ex}` : card.de;
    const en = card.en;
    const firstText = audioEnFirst ? en : de;
    const firstLang = audioEnFirst ? "en-US" : "de-DE";
    const secondText = audioEnFirst ? de : en;
    const secondLang = audioEnFirst ? "de-DE" : "en-US";
    await speakWith(firstText, firstLang, 0.85);
    if (!audioPlayingRef.current) return;
    await pauseAwareDelay(audioPauseLen);
    if (!audioPlayingRef.current) return;
    await speakWith(secondText, secondLang, 0.9);
    if (!audioPlayingRef.current) return;
    await pauseAwareDelay(audioPauseLen);
  }, [audioEnFirst, audioIncludeExample, audioPauseLen, pauseAwareDelay]);

  // Pause playback cleanly — cancel current utterance and any pending timer
  const audioPause = useCallback(() => {
    audioPlayingRef.current = false;
    setAudioPlaying(false);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (audioTimerRef.current) { clearTimeout(audioTimerRef.current); audioTimerRef.current = null; }
    releaseWakeLock();
  }, [releaseWakeLock]);

  // Exit audio mode fully (pause + cleanup)
  const audioExit = useCallback(() => {
    audioPause();
    setScreen("home");
  }, [audioPause]);

  // Resume playback from current position
  const audioResume = useCallback(async () => {
    audioPlayingRef.current = true;
    setAudioPlaying(true);
    await acquireWakeLock();
  }, [acquireWakeLock]);

  // Flush pending progress on tab hide / page unload — protects against data loss
  // if the user closes the browser or backgrounds the PWA mid-debounce.
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === "hidden") flushProg(); };
    window.addEventListener("beforeunload", flushProg);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("beforeunload", flushProg);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [flushProg]);

  // Export all progress as a downloadable JSON file
  const exportData = useCallback(() => {
    const payload = {
      app: "AutoDeutsch",
      schemaVersion: "v7",
      exportedAt: new Date().toISOString(),
      prog, dailyStats, lastSession, dailyGoal, trendStats, freezes,
      known: [...known],
    };
    try {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `autodeutsch-${todayKey()}.json`;
      document.body.appendChild(a); a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
    } catch (e) {
      setImportError("Export failed: " + (e.message || "unknown error"));
    }
  }, [prog, dailyStats, lastSession, dailyGoal, trendStats, known]);

  // Import progress from a user-selected JSON file; merges by keeping the higher box / attempts
  const importData = useCallback((file) => {
    setImportError("");
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || typeof data !== "object" || !data.prog) throw new Error("Not an AutoDeutsch backup");
        if (data.schemaVersion && data.schemaVersion !== "v7") throw new Error(`Unsupported schema: ${data.schemaVersion}`);
        // Merge rule: for each key, keep whichever entry has more attempts (more learning history)
        const merged = { ...prog };
        Object.entries(data.prog).forEach(([k, v]) => {
          const incoming = normalizeEntry(v);
          const existing = merged[k] ? normalizeEntry(merged[k]) : null;
          if (!existing || incoming.stats.attempts > existing.stats.attempts) merged[k] = v;
        });
        setProg(merged); save(merged); flushProg();
        if (Array.isArray(data.known)) {
          // Union: a word marked known on either device stays known
          setKnown(prev => {
            const next = new Set([...prev, ...data.known.filter(k => typeof k === "string")]);
            try { localStorage.setItem("gfc-known-v7", JSON.stringify([...next])); } catch (e) {}
            return next;
          });
        }
        if (data.dailyStats && data.dailyStats.date) {
          // Adopt the higher streak, keep today's count
          const today = todayKey();
          const keepCount = dailyStats.date === today ? dailyStats.count : 0;
          const newStreak = Math.max(dailyStats.streak || 0, data.dailyStats.streak || 0);
          const d = { date: today, count: keepCount, streak: newStreak };
          setDailyStats(d); saveDaily(d);
        }
        if (data.lastSession) { setLastSession(data.lastSession); saveLast(data.lastSession); }
        if (typeof data.dailyGoal === "number" && data.dailyGoal >= 10 && data.dailyGoal <= 200) {
          updateDailyGoal(data.dailyGoal);
        }
        if (typeof data.freezes === "number") {
          const f = Math.max(0, Math.min(MAX_FREEZES, Math.round(data.freezes)));
          setFreezes(prev => { const n = Math.max(prev, f); persistFreezes(n); return n; }); // keep the higher
        }
        if (data.trendStats && typeof data.trendStats === "object") {
          // Merge per-day: keep whichever record has more attempts (richer history).
          // Then prune the union to last 60 days.
          const merged = { ...trendStats };
          Object.entries(data.trendStats).forEach(([day, incoming]) => {
            if (!incoming || typeof incoming !== "object") return;
            const existing = merged[day];
            if (!existing || (incoming.attempts || 0) > (existing.attempts || 0)) merged[day] = incoming;
          });
          const cutoff = Date.now() - 60 * 86400000;
          const pruned = {};
          Object.entries(merged).forEach(([k, v]) => {
            if (new Date(k + "T00:00:00").getTime() >= cutoff) pruned[k] = v;
          });
          setTrendStats(pruned); saveTrend(pruned);
        }
        setImportError("✓ Imported successfully");
      } catch (e) {
        setImportError("Import failed: " + (e.message || "invalid file"));
      }
    };
    reader.onerror = () => setImportError("Could not read file");
    reader.readAsText(file);
  }, [prog, dailyStats, save, saveDaily, saveLast, flushProg, updateDailyGoal, trendStats, saveTrend]);

  // Warm up TTS voices — on iOS Safari, getVoices() returns [] until loaded asynchronously.
  // Without this, the first utterance of a cold session often uses the default (English) voice.
  useEffect(() => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.getVoices();
    const onVoices = () => window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener?.("voiceschanged", onVoices);
    return () => window.speechSynthesis.removeEventListener?.("voiceschanged", onVoices);
  }, []);

  // Esc key closes any open modal/overlay — matches hardware-keyboard expectations (e.g. iPad
  // users). Includes the full-screen rank-up celebration (a blocking overlay) and onboarding.
  useEffect(() => {
    if (!showSetup && !showSettings && !showOnboarding && !rankUp) return;
    const onKey = e => {
      if (e.key === "Escape") {
        if (showSettings) setShowSettings(false);
        else if (showSetup) setShowSetup(false);
        else if (rankUp) setRankUp(null);
        else if (showOnboarding) setShowOnboarding(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showSetup, showSettings, showOnboarding, rankUp]);

  // A11y: when a dialog opens, move keyboard focus into it and trap Tab inside (so focus can't
  // wander to the page behind). One shared ref — only one of these modals is open at a time.
  const modalRef = useRef(null);
  useEffect(() => {
    if (!showSetup && !showSettings && !showOnboarding) return;
    const node = modalRef.current;
    if (!node) return;
    const focusables = () => [...node.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(el => !el.disabled && el.offsetParent !== null);
    const prev = document.activeElement;
    (focusables()[0] || node).focus({ preventScroll: true });
    const onKey = e => {
      if (e.key !== "Tab") return;
      const f = focusables();
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    node.addEventListener("keydown", onKey);
    return () => { node.removeEventListener("keydown", onKey); if (prev && prev.focus) try { prev.focus({ preventScroll: true }); } catch (e) {} };
  }, [showSetup, showSettings, showOnboarding]);

  // Stop audio playback when leaving the audio screen (e.g. app reload, nav to another mode)
  useEffect(() => {
    if (screen !== "audio" && audioPlayingRef.current) {
      audioPlayingRef.current = false;
      setAudioPlaying(false);
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      if (audioTimerRef.current) { clearTimeout(audioTimerRef.current); audioTimerRef.current = null; }
      if (wakeLockRef.current) { try { wakeLockRef.current.release(); } catch (e) {} wakeLockRef.current = null; }
    }
    // Also stop any active "Play all" dialogue chain
    if (screen !== "drill" && playAllTimersRef.current.length > 0) {
      stopPlayAll();
    }
    // Any screen change kills a pending auto-advance — it must never fire into another screen.
    if (autoAdvTimerRef.current) { clearTimeout(autoAdvTimerRef.current); autoAdvTimerRef.current = null; }
  }, [screen, stopPlayAll]);

  // Listen for "update available" dispatched from the SW registration script
  useEffect(() => {
    const onUpdate = () => setUpdateAvailable(true);
    window.addEventListener("sw-update-available", onUpdate);
    return () => window.removeEventListener("sw-update-available", onUpdate);
  }, []);

  // Audio mode driver — runs whenever audioPlaying flips true.
  // Plays current card, on completion increments dailyGoal + advances to next.
  // Auto-stops at end of queue.
  useEffect(() => {
    if (!audioPlaying) return;
    audioPlayingRef.current = true;
    let cancelled = false;
    (async () => {
      while (!cancelled && audioPlayingRef.current) {
        const current = cards[idx];
        if (!current) { audioPause(); break; }
        await playOneCard(current);
        if (cancelled || !audioPlayingRef.current) break;
        recordAudioHeard();
        // advance
        if (idx + 1 >= cards.length) {
          audioPause();
          setScreen("results");
          // minimal stats for results screen
          setStats(s => ({ c: cards.length, w: 0 }));
          break;
        }
        setIdx(i => i + 1);
        // yield a tick so state update commits before next iteration sees new idx
        await new Promise(r => setTimeout(r, 50));
      }
    })();
    return () => { cancelled = true; };
  }, [audioPlaying, idx, cards, playOneCard, recordAudioHeard, audioPause]);

  // Re-acquire wake-lock if it's lost when the page becomes visible again (iOS behaviour)
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && audioPlaying && !wakeLockRef.current) {
        acquireWakeLock();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [audioPlaying, acquireWakeLock]);

  const applyUpdate = useCallback(() => {
    const waiting = window.__SW_WAITING__;
    if (waiting) waiting.postMessage({ type: "SKIP_WAITING" });
    else window.location.reload();
  }, []);

  const nouns = useMemo(getNouns, []);
  const pluralNouns = useMemo(getPluralNouns, []);
  // Library groups with any unmapped categories appended as "More" (future-proofing).
  const libGroups = useMemo(() => {
    const assigned = new Set(LIB_GROUPS.flatMap(g => g.cats));
    const groups = LIB_GROUPS.map(g => ({ ...g, cats: g.cats.filter(c => CATS.includes(c)) }));
    const extra = CATS.filter(c => !assigned.has(c));
    if (extra.length) groups.push({ name: "More", cats: extra });
    return groups.filter(g => g.cats.length > 0);
  }, []);
  const totalW = useMemo(() => Object.values(V).flat().length, []);
  const totalL = useMemo(
    () => CATS.reduce((sum, cat) => sum + V[cat].filter(w => isMasteredEntry(prog[`production::${cat}::${w.de}`])).length, 0),
    [prog]
  );

  // Leech detection: failed 4+ times and box < 3
  const leeches = useMemo(() => {
    return Object.entries(prog).filter(([k, v]) => {
      const n = normalizeEntry(v);
      return n.stats.incorrect >= 4 && n.srs.box < 3;
    }).map(([k, v]) => ({ key: k, ...normalizeEntry(v) }));
  }, [prog]);

  // Weak cards: leeches + low-box cards + slow-response cards
  const weakCards = useMemo(() => {
    const weak = new Set();
    Object.entries(prog).forEach(([k, v]) => {
      const n = normalizeEntry(v);
      if (n.stats.incorrect >= 4 && n.srs.box < 3) weak.add(k);
      if (n.srs.box <= 2 && n.stats.attempts >= 2) weak.add(k);
      if (n.stats.avgTime > 15000 && n.stats.timedAttempts >= 2) weak.add(k);
    });
    return weak;
  }, [prog]);

  // Cards that are due for review based on SRS box + lastReviewed timestamp.
  // Only considers resolvable keys (vocab/production/cloze/imperativ — same subset as weak areas).
  const dueCards = useMemo(() => {
    const due = new Set();
    const now = Date.now();
    Object.entries(prog).forEach(([k, v]) => {
      const n = normalizeEntry(v);
      if (n.stats.attempts < 1) return;
      const box = Math.max(0, Math.min(5, Math.floor(n.srs.box)));
      const intervalMs = SRS_INTERVALS[box] * 86400000;
      const lastRev = n.srs.lastReviewed || n.stats.lastSeen || 0;
      if (!lastRev || (now - lastRev) >= intervalMs) due.add(k);
    });
    return due;
  }, [prog]);

  const gk = (card, cat, m) => `${m}::${card._cat || card.cat || cat}::${cardId(card)}`;

  // Flash the answer-feedback animation (shake on wrong, pop on correct) for ~600ms.
  // Adds a light haptic tick where supported (Android); stronger pulse on mistakes.
  const triggerFeedback = (kind) => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    setFeedback(kind);
    playSfx(kind);
    try {
      const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!reduce && navigator.vibrate) navigator.vibrate(kind === "wrong" ? 35 : 12);
    } catch (e) {}
    feedbackTimerRef.current = setTimeout(() => setFeedback(null), 600);
  };

  // Insert a German special character into the focused typed-answer input at the caret.
  // AI Tutor: persist key/model/chat; call Anthropic directly from the browser (BYOK).
  const saveAiKey = (k) => { setAiKey(k); try { k ? localStorage.setItem("gfc-ai-key", k) : localStorage.removeItem("gfc-ai-key"); } catch (e) {} };
  const saveAiModel = (m) => { setAiModel(m); try { localStorage.setItem("gfc-ai-model", m); } catch (e) {} };
  const persistTutor = (msgs) => { try { localStorage.setItem("gfc-tutor-msgs", JSON.stringify(msgs.slice(-40))); } catch (e) {} };

  const sendTutor = async (text) => {
    const body = (text || tutorInput).trim();
    if (!body || tutorBusy || !aiKey) return;
    const next = [...tutorMsgs, { role: "user", text: body }];
    setTutorMsgs(next); persistTutor(next); setTutorInput(""); setTutorBusy(true); setTutorError("");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": aiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: aiModel,
          max_tokens: 700,
          system: TUTOR_SYSTEM,
          messages: next.slice(-20).map(m => ({ role: m.role, content: m.text })),
        }),
      });
      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try { const j = await res.json(); detail = j?.error?.message || detail; } catch (e) {}
        if (res.status === 401) detail = "Invalid API key — check it in Settings.";
        else if (res.status === 429) detail = "Rate limited or out of credit. Try again shortly.";
        throw new Error(detail);
      }
      const data = await res.json();
      const reply = (data.content || []).filter(c => c.type === "text").map(c => c.text).join("\n").trim();
      const withReply = [...next, { role: "assistant", text: reply || "(empty reply)" }];
      setTutorMsgs(withReply); persistTutor(withReply);
    } catch (e) {
      setTutorError(e.message || "Request failed. Check your connection.");
    } finally {
      setTutorBusy(false);
    }
  };
  const clearTutor = () => { setTutorMsgs([]); setTutorError(""); try { localStorage.removeItem("gfc-tutor-msgs"); } catch (e) {} };
  // "Why?" bridge: jump from an answered card into the Tutor with a prepared question,
  // and remember where to return so Back resumes the session.
  const tutorReturnRef = useRef("home");
  const askTutorAboutCard = () => {
    const c = cards[idx]; if (!c) return;
    let q;
    if (mode === "cloze") q = `Im Satz "${(c.q || "").replace("___", c.a)}" ist die Lösung "${c.a}".${c.h ? ` Hinweis: ${c.h}.` : ""} Erkläre die Grammatik kurz auf Englisch, mit einem neuen Beispiel.`;
    else if (mode === "verb") q = `Erkläre kurz die Verbform "${c.pron} ${c.correct}" von "${c.verb}" (${c.tense}). Antwort auf Englisch mit einem neuen Beispiel.`;
    else if (mode === "imperativ") q = `Erkläre den Imperativ "${c[c._person]}" (${c._person}-Form von "${c.base}"). Antwort auf Englisch.`;
    else if (mode === "article") q = `Warum heißt es "${c.article} ${c.noun}"? Gibt es eine Regel oder Eselsbrücke für das Genus? Antwort auf Englisch.`;
    else if (mode === "plural") q = `Der Plural von "${c.de}" ist "${c.pl}". Welche Pluralregel steckt dahinter (Endung, Umlaut)? Antwort auf Englisch mit 1–2 ähnlichen Beispielen.`;
    else if (mode === "sentence") q = `Erkläre die Wortstellung in: "${(c.correct || []).join(" ")}" (Regel: ${c.rule}). Antwort auf Englisch.`;
    else if (mode === "listening") q = `Erkläre kurz auf Englisch: "${c.q}" — die richtige Antwort war "${(c.opts || [])[c.correctIdx]}".`;
    else q = `Erkläre kurz das Wort "${c.de}" (${c.en}): Grammatik, typische Verwendung, ein neues Beispiel. Antwort auf Englisch.`;
    tutorReturnRef.current = screen;
    setScreen("tutor");
    if (aiKey) sendTutor(q);
  };

  // Dictation: speak each new card automatically (the first card is spoken from the
  // Start tap itself for iOS; this covers every advance after that).
  useEffect(() => {
    if (screen !== "cards" || mode !== "dictation" || answered || idx === 0) return;
    const c = cards[idx];
    if (c?.de) { const t = setTimeout(() => speak(c.de), 250); return () => clearTimeout(t); }
  }, [idx, screen, mode]);

  const insertChar = (ch) => {
    const el = typedInputRef.current;
    if (!el) { setInput(v => v + ch); return; }
    const s = el.selectionStart ?? el.value.length;
    const e = el.selectionEnd ?? el.value.length;
    setInput(el.value.slice(0, s) + ch + el.value.slice(e));
    requestAnimationFrame(() => { try { el.focus(); el.setSelectionRange(s + ch.length, s + ch.length); } catch (err) {} });
  };

  const record = (correct, card, elapsed) => {
    triggerFeedback(correct ? "correct" : "wrong");
    const key = gk(card, category, mode);
    const prev = normalizeEntry(prog[key]);
    const now = Date.now();
    // Snapshot prior lastSeen for CardStats display (separate from prog to keep exports clean)
    if (prev.stats.lastSeen) priorLastSeenRef.current[key] = prev.stats.lastSeen;

    const recallMs = correct ? Math.min(Math.max(elapsed || 0, 0), 60000) : 0;
    const attempts = prev.stats.attempts + 1;
    const timedAttempts = prev.stats.timedAttempts + (recallMs > 0 ? 1 : 0);
    const rollingAvg = recallMs > 0
      ? ((prev.stats.avgTime || 0) * prev.stats.timedAttempts + recallMs) / timedAttempts
      : prev.stats.avgTime;
    const currentStreak = correct ? (prev.stats.currentStreak || 0) + 1 : 0;
    // Speaking is spoken production, so it advances the same production-mastery track.
    const isProdMode = mode === "production" || mode === "speaking";
    const productionStreak = isProdMode
      ? (correct ? (prev.stats.productionStreak || 0) + 1 : 0)
      : (prev.stats.productionStreak || 0);
    const unlockedMastery = isProdMode && correct && (prev.stats.productionStreak || 0) < MASTERY_STREAK && productionStreak >= MASTERY_STREAK;
    const masteredAt = isProdMode
      ? (productionStreak >= MASTERY_STREAK ? (prev.stats.masteredAt || now) : null)
      : (prev.stats.masteredAt || null);

    const prevBox = Math.max(0, Math.min(5, Math.floor(prev.srs.box || 0)));
    const newBox = nextBox(prev.srs.box, correct, prev.srs.lastReviewed, now);
    setLastBoxMove({ from: prevBox, to: newBox });
    if (correct) {
      if (unlockedMastery) sessionGains.current.mastered++;
      if (prev.stats.attempts === 0) sessionGains.current.learned++;
    }
    const upd = {
      ...prog,
      [key]: {
        stats: {
          attempts,
          correct: prev.stats.correct + (correct ? 1 : 0),
          incorrect: prev.stats.incorrect + (correct ? 0 : 1),
          lastSeen: now,
          avgTime: Math.round(rollingAvg),
          timedAttempts,
          currentStreak,
          productionStreak,
          masteredAt,
        },
        srs: {
          box: newBox,
          lastReviewed: now,
        },
      },
    };
    setProg(upd); save(upd);
    setStats(s => ({ c: s.c + (correct ? 1 : 0), w: s.w + (correct ? 0 : 1) }));
    // Combo escalation: at the flame tiers (3·7·14·30 in a row) the streak audibly heats
    // up — a rising sparkle + soft haptic that matches the chip's flame intensifying.
    if (correct) {
      const ci = [3, 7, 14, 30].indexOf(combo + 1);
      if (ci >= 0) { playSfx("combo", ci); try { const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; if (!reduce && navigator.vibrate) navigator.vibrate([8, 26, 8]); } catch (e) {} }
    }
    setCombo(c => (correct ? c + 1 : 0));
    if (unlockedMastery) {
      const item = {
        id: key,
        de: card.de || card.q || card.a || card.verb || "Mastered card",
        en: card.en || "",
        cat: card._cat || card.cat || category,
        masteredAt: now,
      };
      setNewlyMastered(list => list.some(x => x.id === key) ? list : [...list, item]);
      // The in-session mastery toast is intentionally suppressed — celebrations are held until
      // home. Mastery is still recapped on the results screen ("+N Mastered ★") and the Library.
    }
    // ── In-session retry (learning step) ──
    // A wrong card re-queues ~4 positions ahead in the SAME session, while the correction
    // is fresh — once per card per session, first round only (repeat rounds ARE the retry).
    // Getting the retry right clears the card from the failed list; the SRS cram guard
    // already stops the same-day success from inflating the review interval.
    if (!correct) {
      const alreadyFailed = failed.some(c => gk(c, category, mode) === key);
      if (!alreadyFailed) {
        setFailed(f => [...f, card]);
        setFailedNames(f => [...f, card.de || card.q || card.verb || (card.article && card.noun ? `${card.article} ${card.noun}` : null) || (card.correct && card.correct.join(' ')) || '?']);
      }
      if (rpt === 0 && !requeuedRef.current.has(key)) {
        requeuedRef.current.add(key);
        setCards(cs => {
          const pos = Math.min(idx + 4, cs.length);
          const copy = [...cs];
          copy.splice(pos, 0, card);
          return copy;
        });
      }
    } else if (requeuedRef.current.has(key)) {
      // Retry succeeded — the card is cleared within the session.
      const removeIdx = failed.findIndex(c => gk(c, category, mode) === key);
      if (removeIdx >= 0) {
        setFailed(f => { const n = [...f]; n.splice(removeIdx, 1); return n; });
        setFailedNames(f => { const n = [...f]; n.splice(removeIdx, 1); return n; });
      }
    }
    setLastElapsed(recallMs);
    // NEW: Update daily stats
    const today = todayKey();
    setDailyStats(prev => {
      let d;
      if (prev.date === today) {
        // Same day — streak already advanced on first card; just increment count
        const firstCardOfDay = prev.count === 0;
        d = { ...prev, count: prev.count + 1, streak: firstCardOfDay ? prev.streak + 1 : prev.streak };
      } else {
        // First activity on a new day (load effect didn't run, rare)
        // Only continue the streak if the previous activity was actually yesterday —
        // an app left open across 2+ idle midnights must not over-count.
        d = { date: today, count: 1, streak: prev.date === todayKey(new Date(Date.now() - SRS_DAY_MS)) ? prev.streak + 1 : 1 };
      }
      // Celebrate the exact moment today's goal is reached — once, mid-session.
      if (prev.date === today && prev.count < dailyGoal && d.count >= dailyGoal) {
        setTimeout(() => celebrateGoal(d), 0);
      }
      // A streak that reaches a milestone today is a bigger moment (overrides goal if same tick).
      if (d.streak > prev.streak && STREAK_MILESTONES.has(d.streak)) {
        setTimeout(() => celebrateStreak(d.streak), 0);
      }
      // Earn a Streak Freeze every 7 streak-days (banked, capped at MAX_FREEZES).
      if (d.streak > prev.streak && d.streak % 7 === 0) {
        setTimeout(() => earnFreeze(), 0);
      }
      saveDaily(d);
      return d;
    });
    // Trend stats — count only the FIRST attempt on each card this session.
    // Repeats (including "Repeat failed" on results) must not influence averages.
    if (!countedKeysRef.current.has(key)) {
      countedKeysRef.current.add(key);
      setTrendStats(prev => {
        const rawDay = prev[today] || { attempts: 0, correct: 0, totalMs: 0 };
        const day = { ...rawDay, timed: rawDay.timed ?? (rawDay.totalMs ? (rawDay.attempts || 0) : 0) };
        const updated = {
          ...prev,
          [today]: {
            attempts: day.attempts + 1,
            correct: day.correct + (correct ? 1 : 0),
            totalMs: day.totalMs + recallMs,
            timed: (day.timed || 0) + (recallMs > 0 ? 1 : 0),
          },
        };
        // Prune to last 60 days
        const cutoff = Date.now() - 60 * 86400000;
        const pruned = {};
        Object.entries(updated).forEach(([k, v]) => {
          if (new Date(k + "T00:00:00").getTime() >= cutoff) pruned[k] = v;
        });
        saveTrend(pruned);
        return pruned;
      });
    }
  };

  // Resolve a progress key back into a card object of the appropriate mode.
  // Returns a card tagged with _mode so the caller knows which screen to route to.
  const resolveKey = (key) => {
    const parts = key.split("::");
    const m = parts[0];
    if (m === "vocab" || m === "production" || m === "dictation" || m === "speaking") {
      const cat = parts[1], de = parts.slice(2).join("::");
      const found = V[cat]?.find(w => w && w.de === de);
      if (found) return { ...found, _cat: cat, _mode: m };
    }
    if (m === "article") {
      const cat = parts[1], id = parts.slice(2).join("::");
      const found = nouns.find(n => n.cat === cat && `${n.article} ${n.noun}` === id);
      if (found) return { ...found, _cat: cat, _mode: m };
    }
    if (m === "plural") {
      const cat = parts[1], id = parts.slice(2).join("::");
      const found = pluralNouns.find(n => n.cat === cat && n.de === id);
      if (found) return { ...found, _cat: cat, _mode: m };
    }
    if (m === "cloze") {
      // cloze keys look like "cloze::Grammar Cloze::<q>"; q may contain "::" so re-join
      const q = parts.slice(2).join("::");
      const found = CLOZE.find(c => c.q === q);
      if (found) return { ...found, _mode: m };
    }
    if (m === "imperativ") {
      // imperativ keys: "imperativ::<category>::<base>::<person>" (e.g. imperativ::Imperative::geben::du)
      const base = parts[2], person = parts[3];
      const found = IMPERATIVES.find(i => i.base === base);
      if (found && person) return { ...found, _person: person, de: `${base}::${person}`, _mode: m };
    }
    return null;
  };

  // Weak cards grouped by resolvable mode. Only these will actually be reviewed.
  const resolvedWeak = useMemo(() => {
    const byMode = {};
    let total = 0;
    [...weakCards].forEach(k => {
      const card = resolveKey(k);
      if (!card) return;
      (byMode[card._mode] = byMode[card._mode] || []).push(card);
      total++;
    });
    return { byMode, total };
  }, [weakCards]);

  // Preview of the user's weakest words (most-missed first), for the Weak-spots deck on
  // Home — makes the deck tangible ("der Kondensator, die Spannung…") instead of a bare
  // count. Ranks by miss-count without resolving every key, then resolves only the top few.
  const weakPreview = useMemo(() => {
    const ranked = [...weakCards]
      .map(k => ({ k, n: normalizeEntry(prog[k]) }))
      .sort((a, b) => (b.n.stats.incorrect || 0) - (a.n.stats.incorrect || 0) || (a.n.srs.box || 0) - (b.n.srs.box || 0));
    const out = [];
    for (const { k } of ranked) {
      const card = resolveKey(k);
      const de = card && (card.de || card.noun || card.base || card.q || card.verb);
      if (de) out.push(de);
      if (out.length >= 6) break;
    }
    return out;
  }, [weakCards, prog]);

  // Resolved + grouped "due today" queue (same resolution rules as weak areas)
  const resolvedDue = useMemo(() => {
    const byMode = {};
    let total = 0;
    [...dueCards].forEach(k => {
      const card = resolveKey(k);
      if (!card) return;
      (byMode[card._mode] = byMode[card._mode] || []).push(card);
      total++;
    });
    return { byMode, total };
  }, [dueCards]);

  const almostCards = useMemo(() => {
    const byMode = {};
    let total = 0;
    Object.entries(prog).forEach(([k, v]) => {
      if (!k.startsWith("production::")) return;
      const n = normalizeEntry(v);
      if (n.stats.productionStreak < MASTERY_STREAK - 1 || n.stats.productionStreak >= MASTERY_STREAK) return;
      const card = resolveKey(k);
      if (!card) return;
      (byMode[card._mode] = byMode[card._mode] || []).push(card);
      total++;
    });
    return { byMode, total };
  }, [prog]);

  // 30-day trend summary derived from trendStats. Used by the home Progress section.
  // Output: { days: [{date, attempts, correct, totalMs}, ...30 items, oldest→newest],
  //           totalAttempts, totalCorrect, totalMs, accuracy (0-100), avgSec }
  const trend30 = useMemo(() => {
    const days = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const key = todayKey(d);
      const raw = trendStats[key] || {};
      const entry = {
        attempts: raw.attempts || 0,
        correct: raw.correct || 0,
        totalMs: raw.totalMs || 0,
        timed: raw.timed ?? (raw.totalMs ? (raw.attempts || 0) : 0),
      };
      days.push({ date: key, ...entry });
    }
    const totals = days.reduce((a, d) => ({
      attempts: a.attempts + d.attempts,
      correct: a.correct + d.correct,
      totalMs: a.totalMs + d.totalMs,
      timed: a.timed + (d.timed || 0),
    }), { attempts: 0, correct: 0, totalMs: 0, timed: 0 });
    return {
      days,
      totalAttempts: totals.attempts,
      totalCorrect: totals.correct,
      totalMs: totals.totalMs,
      totalTimed: totals.timed,
      accuracy: totals.attempts >= 3 ? Math.round((totals.correct / totals.attempts) * 100) : null,
      avgSec: totals.timed > 0 ? (totals.totalMs / totals.timed / 1000) : null,
    };
  }, [trendStats]);

  // Deep statistics for the Stats screen: per-CEFR-level vocab funnel, SRS box
  // histogram, all-time totals, and a mastery-pace projection toward B2 derived
  // from masteredAt timestamps (cards mastered in the last 28 days → weekly rate).
  const deepStats = useMemo(() => {
    const levels = {};
    LEVELS.forEach(l => { levels[l] = { total: 0, seen: 0, strong: 0, mastered: 0 }; });
    allVocab().forEach(w => {
      const L = levels[cardLevel(w)];
      if (!L) return;
      L.total++;
      const s = wordStrength(prog[`vocab::${w._cat}::${w.de}`], prog[`production::${w._cat}::${w.de}`]);
      if (s.seen) L.seen++;
      if (s.strong) L.strong++;
      if (s.mastered) L.mastered++;
    });
    const boxes = [0, 0, 0, 0, 0, 0];
    let attempts = 0, correct = 0, entries = 0;
    const masteredDates = [];
    Object.entries(prog).forEach(([k, raw]) => {
      const n = normalizeEntry(raw);
      if (n.stats.attempts < 1) return;
      entries++;
      attempts += n.stats.attempts;
      correct += n.stats.correct;
      boxes[Math.max(0, Math.min(5, Math.floor(n.srs.box || 0)))]++;
      if (k.startsWith("production::") && n.stats.masteredAt) masteredDates.push(n.stats.masteredAt);
    });
    const now = Date.now();
    const recent28 = masteredDates.filter(t => now - t <= 28 * SRS_DAY_MS).length;
    const perWeek = recent28 / 4;
    const b2Remaining = Math.max(0, levels.B2.total - levels.B2.mastered);
    const b2WeeksLeft = perWeek > 0 ? b2Remaining / perWeek : null;
    // "Journey to B2" is cumulative across the WHOLE curriculum (A1→B2), not B2-only, and now
    // advances on STRONG (not full mastery) — a novice climbs from 0 the first day they make a
    // word stick, instead of staring at ~0% until they 5-streak it. Mastered ★ is tracked
    // alongside as the deeper achievement layer.
    const journeyTotal = LEVELS.reduce((s, l) => s + levels[l].total, 0);
    const journeyStrong = LEVELS.reduce((s, l) => s + levels[l].strong, 0);
    const journeyMastered = LEVELS.reduce((s, l) => s + levels[l].mastered, 0);
    const journeyPct = journeyTotal ? (journeyStrong / journeyTotal) * 100 : 0;
    const journeyRemaining = Math.max(0, journeyTotal - journeyStrong);
    // Pace projection stays about full mastery (it reads off masteredAt timestamps) — an
    // honestly-labelled "you've fully mastered N words" stretch goal beneath the strong rank.
    const masteryRemaining = Math.max(0, journeyTotal - journeyMastered);
    const journeyWeeksLeft = perWeek > 0 ? masteryRemaining / perWeek : null;
    // Current CEFR level = the lowest level not yet fully STRONG (your rank). Reaching it for a
    // level ranks you up — achievable in days, not the months full mastery used to demand.
    let currentLevel = LEVELS[LEVELS.length - 1];
    for (const l of LEVELS) { if (levels[l].strong < levels[l].total) { currentLevel = l; break; } }
    // Chapters: each level is split into CHAPTERS equal-size chunks so a checkpoint lands every
    // ~20% of a level. Chapters fill on STRONG too, so a checkpoint is reachable in days.
    let chaptersDoneTotal = 0;
    LEVELS.forEach(l => {
      const L = levels[l];
      L.chapterSize = Math.max(1, Math.ceil(L.total / CHAPTERS));
      L.chaptersDone = Math.min(CHAPTERS, Math.floor(L.strong / L.chapterSize));
      chaptersDoneTotal += L.chaptersDone;
    });
    const curL = levels[currentLevel];
    const currentChapter = Math.min(CHAPTERS, curL.chaptersDone + 1); // 1-indexed chapter you're working on
    const chapterStrongInto = curL.strong - curL.chaptersDone * curL.chapterSize; // strong within current chapter
    const chapterRemaining = Math.max(0, curL.chapterSize - chapterStrongInto); // words to finish current chapter
    return { levels, boxes, attempts, correct, entries, masteredTotal: masteredDates.length, recent28, perWeek, b2Remaining, b2WeeksLeft, journeyTotal, journeyStrong, journeyMastered, journeyPct, journeyRemaining, journeyWeeksLeft, currentLevel, chaptersDoneTotal, currentChapter, chapterRemaining };
  }, [prog]);

  // The mission the journey nudges next: first not-done mission at/just-above the learner's level.
  const currentMission = useMemo(() => {
    const cl = Math.max(0, LEVELS.indexOf(deepStats.currentLevel));
    const lvlOk = (m) => LEVELS.indexOf(m.level) <= Math.min(LEVELS.length - 1, cl + 1);
    const notDone = (m) => !(missionProg[m.id] && missionProg[m.id].doneAt);
    return MISSIONS.find(m => notDone(m) && lvlOk(m)) || MISSIONS.find(notDone) || MISSIONS[0];
  }, [missionProg, deepStats.currentLevel]);

  // P2 capability model: what the learner can DO (earned can-dos = completed missions) + a
  // telc/Goethe exam-readiness estimate per level (vocab-strength proxy). Reads, never writes.
  const capability = useMemo(() => {
    const earned = MISSIONS.filter(m => missionProg[m.id] && missionProg[m.id].doneAt);
    const recent = [...earned].sort((a, b) => (missionProg[b.id].doneAt || 0) - (missionProg[a.id].doneAt || 0)).slice(0, 3);
    const byLevel = {}; const exam = {};
    LEVELS.forEach(l => {
      const ms = MISSIONS.filter(m => m.level === l);
      byLevel[l] = { done: ms.filter(m => missionProg[m.id] && missionProg[m.id].doneAt).length, total: ms.length };
      const lv = deepStats.levels[l] || { strong: 0, total: 0 };
      const pct = lv.total ? Math.round((lv.strong / lv.total) * 100) : 0;
      const missionsDone = byLevel[l].total ? byLevel[l].done === byLevel[l].total : true;
      exam[l] = { pct, state: pct >= 75 && missionsDone ? "ready" : pct >= 40 ? "almost" : "building" };
    });
    return { earned, earnedCount: earned.length, recent, byLevel, exam, role: roleFor(earned.length), nextRole: ROLES.find(r => r.min > earned.length) || null };
  }, [missionProg, deepStats.levels]);
  const [showUnderHood, setShowUnderHood] = useState(false);
  // Celebrate moving up a relocation status (Newcomer → Settling in → Resident → Local).
  const prevRoleRef = useRef(null);
  useEffect(() => {
    const r = capability.role.name;
    if (prevRoleRef.current && prevRoleRef.current !== r) {
      celebQueueRef.current.push({ kind: "toast", payload: { color: "#FFCC00", icon: capability.role.icon, tag: "New status", big: r, sub: capability.role.sub, subIcon: null } });
    }
    prevRoleRef.current = r;
  }, [capability.role.name]);

  // Progress milestones: a full-screen RANK-UP when a CEFR level is completed, and a lighter
  // CHAPTER checkpoint when you finish a chapter mid-level. Detected on upward transitions
  // (prevLevelRef seeds on first load so nothing fires on open); both are QUEUED and played
  // back on home by the flush effect. Level-up wins when the last chapter completes the level.
  useEffect(() => {
    const cl = deepStats.currentLevel, ch = deepStats.chaptersDoneTotal;
    const prevL = prevLevelRef.current, prevC = prevChaptersRef.current;
    if (prevL != null) {
      if (LEVELS.indexOf(cl) > LEVELS.indexOf(prevL)) {
        celebQueueRef.current.push({ kind: "rankup", payload: { from: prevL, to: cl } });
      } else if (prevC != null && ch > prevC) {
        const lvl = prevL, n = deepStats.levels[lvl].chaptersDone;
        celebQueueRef.current.push({ kind: "toast", payload: {
          color: LEVEL_COLOR[lvl] || A, icon: "check", tag: `${lvl} · Chapter ${n} complete`,
          big: `Chapter ${n} of ${CHAPTERS} done!`,
          sub: `${CHAPTERS - n} chapter${CHAPTERS - n === 1 ? "" : "s"} to rank up`, subIcon: null,
        } });
      }
    }
    prevLevelRef.current = cl;
    prevChaptersRef.current = ch;
  }, [deepStats.currentLevel, deepStats.chaptersDoneTotal]);

  // Flush queued celebrations once back on home, one at a time (toast auto-dismisses → next;
  // rank-up waits for the user to tap through → next). Nothing plays during a session.
  useEffect(() => {
    if (screen !== "home" || celebration || rankUp || !celebQueueRef.current.length) return;
    const t = setTimeout(() => {
      if (screenRef.current !== "home" || !celebQueueRef.current.length) return;
      const item = celebQueueRef.current.shift();
      playSfx("win");
      try { const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; if (!reduce && navigator.vibrate) navigator.vibrate(item.kind === "rankup" ? [40, 60, 40, 60, 90] : [35, 55, 35]); } catch (e) {}
      if (item.kind === "rankup") { setRankUp(item.payload); }
      else { setCelebration(item.payload); if (celebrateTimerRef.current) clearTimeout(celebrateTimerRef.current); celebrateTimerRef.current = setTimeout(() => setCelebration(null), 2300); }
    }, 480);
    return () => clearTimeout(t);
  }, [screen, celebration, rankUp]);

  const openSetup = (cat, dm) => {
    setSetupCat(cat);
    setSetupMode(dm || "vocab");
    const mx = cat === "__all__" ? totalW : cat === "__grammar__" ? CLOZE.length : cat === "__verb__" ? VERBS.length : cat === "__sentence__" ? SENTENCES.length : cat === "__imperativ__" ? IMPERATIVES.length : cat === "__listening__" ? DIALOGUES.length : cat === "__confusion__" ? 15 : cat === "__exam__" ? 15 : cat === "__weak__" ? Math.max(weakCards.size, 1) : (V[cat]?.length || 25);
    setSessLen(Math.min(15, mx));
    setShowSetup(true);
  };

  const finishOnboarding = () => {
    updateDailyGoal(onboardingGoal);
    setSetupMode(onboardingMode);
    setSessLevel(onboardingLevel); // honour the chosen level — actually filter content to it
    setSessDiff(["B1", "B2"].includes(onboardingLevel) ? "hard" : "mixed");
    setShowOnboarding(false);
    try {
      localStorage.setItem("ad-onboarding-v1", "done");
      localStorage.setItem("ad-onboarding-pref-v1", JSON.stringify({
        level: onboardingLevel,
        dailyGoal: onboardingGoal,
        preferredMode: onboardingMode,
        completedAt: new Date().toISOString(),
      }));
    } catch (e) {}
  };

  // ── P5 placement flow ──
  const startPlacement = () => {
    const items = LEVELS.flatMap(L => {
      const pool = PLACEMENT.items.filter(i => i.level === L);
      return [...pool].sort(() => Math.random() - 0.5).slice(0, 3); // 3 per level, varied on retake
    });
    setPlItems(items); setPlIdx(0); setPlScore({}); setObStep("placement");
  };
  const answerPlacement = (oi) => {
    const it = plItems[plIdx];
    setPlScore(prev => { const s = { ...(prev[it.level] || { c: 0, n: 0 }) }; s.n++; if (oi === it.correctIdx) s.c++; return { ...prev, [it.level]: s }; });
    if (plIdx >= plItems.length - 1) setObStep("result"); else setPlIdx(i => i + 1);
  };
  // Open the flow from Settings (retake).
  const openPlacement = () => { setIntakeAns({}); setPlScore({}); setPlIdx(0); setObStep("intake"); setShowSettings(false); setShowOnboarding(true); };
  // The arc a learner's stated goal points them at.
  const goalArc = (goal) => goal === "Working in German" ? "job" : goal === "Settling in & making friends" ? "belonging" : "touchdown";
  const firstMissionFor = (lvl, goal) => {
    const arc = goalArc(goal); const li = LEVELS.indexOf(lvl);
    const ok = (m) => LEVELS.indexOf(m.level) <= Math.min(LEVELS.length - 1, li + 1);
    return MISSIONS.find(m => m.arc === arc && ok(m) && !(missionProg[m.id] && missionProg[m.id].doneAt)) || MISSIONS.find(m => m.arc === arc) || MISSIONS[0];
  };
  // Finish: seed the starting level (NOT a flat "all"), persist intake + level, route into the first mission.
  const completePlacement = (lvl, missionId) => {
    setSessLevel(lvl); setSessDiff(["B1", "B2"].includes(lvl) ? "hard" : "mixed");
    const mode = intakeAns.goal === "Working in German" ? "production" : "vocab";
    setSetupMode(mode); setShowOnboarding(false); setObStep("intake");
    try {
      localStorage.setItem("ad-onboarding-v1", "done");
      localStorage.setItem("ad-onboarding-pref-v1", JSON.stringify({ level: lvl, dailyGoal, preferredMode: mode, completedAt: new Date().toISOString() }));
      localStorage.setItem("ad-placement-v1", JSON.stringify({ intake: intakeAns, level: lvl, placedAt: Date.now() }));
    } catch (e) {}
    if (missionId) openMission(missionId);
  };

  const resetSessionState = () => {
    navLockRef.current = false;
    if (autoAdvTimerRef.current) { clearTimeout(autoAdvTimerRef.current); autoAdvTimerRef.current = null; }
    setCombo(0);
    sessionGains.current = { mastered: 0, learned: 0 };
    setStats({ c: 0, w: 0 }); setFailed([]); setFailedNames([]); setRpt(0); setIdx(0); setNewlyMastered([]); setMasteryBurst(null);
    setFlipped(false); setAnswered(false); setSel(null); setShowEx(false); setShowHint(false);
    setVis(true); setInput(""); setInputResult(null); setLastElapsed(0); setRevealElapsed(0); setLastBoxMove(null);
    // Fresh session → clear first-attempt tracker so stats record this run's first attempts.
    // startRepeat deliberately does NOT call this, so repeated failures stay excluded.
    countedKeysRef.current = new Set();
    requeuedRef.current = new Set();
    setSbPool([]); setSbPicked([]); setSbChecked(false); setSbCorrect(false);
  };

  // Apply the "known" suppression and the CEFR level filter to a vocab pool. Both degrade
  // gracefully: if the level filter would leave nothing, it's dropped so a session can still
  // start; if every card is marked known, we fall back to the full pool rather than a dead end.
  // "auto" resolves to the learner's current level; an explicit band wins over it.
  const resolveLevel = (lvl) => (lvl === "auto" ? (deepStats.currentLevel || "A1") : lvl);
  const filterPool = (pool, levelOverride) => {
    const lvl = resolveLevel(levelOverride || setupLevel);
    const notKnown = pool.filter(c => !known.has(knownKey(c._cat, c.de)));
    const base = notKnown.length ? notKnown : pool;
    if (lvl === "all") return base;
    const leveled = base.filter(c => cardLevel(c) === lvl);
    return leveled.length ? leveled : base;
  };

  // ── P0 mission helpers ──
  const missionById = (id) => MISSIONS.find(m => m.id === id) || null;
  const missionDialogues = (m) => (m ? m.dialogues.map(t => DIALOGUES.find(d => d.title === t)).filter(Boolean) : []);
  const missionStatus = (id) => { const p = missionProg[id]; return !p ? "todo" : (p.doneAt ? "done" : "started"); };
  const missionStepDone = (id, step) => !!(missionProg[id] && missionProg[id][step]);
  const arcDone = (arcId) => MISSIONS.filter(m => m.arc === arcId && missionProg[m.id] && missionProg[m.id].doneAt).length;
  const arcTotal = (arcId) => MISSIONS.filter(m => m.arc === arcId).length;
  const markMissionStep = useCallback((id, step) => {
    setMissionProg(prev => {
      const cur = { ...(prev[id] || {}) };
      cur[step] = true;
      const wasDone = !!(prev[id] && prev[id].doneAt);
      if (cur.learned && cur.listened && cur.spoke && !cur.doneAt) {
        cur.doneAt = Date.now();
        if (!wasDone) {
          const m = MISSIONS.find(x => x.id === id);
          if (m) {
            const arc = MISSION_ARCS.find(a => a.id === m.arc);
            celebQueueRef.current.push({ kind: "toast", payload: {
              color: "#4ADE80", icon: "check", tag: "Skill unlocked",
              big: "You can now " + m.cando.charAt(0).toLowerCase() + m.cando.slice(1),
              sub: arc ? `${arc.title} · real-world German` : "real-world German", subIcon: null,
            } });
          }
        }
      }
      const merged = { ...prev, [id]: cur };
      try { localStorage.setItem("ad-mission-progress-v1", JSON.stringify(merged)); } catch (e) {}
      return merged;
    });
  }, []);
  // Launch a mission step through an existing engine; mark "learned"/"spoke" on results.
  const launchMissionStep = (m, step) => {
    if (step === "listened") {
      const dlgs = missionDialogues(m);
      if (!dlgs.length) return;
      setCards(dlgs); setDlgIdx(0); setDlgRevealed({});
      missionReturnRef.current = { id: m.id, step };
      markMissionStep(m.id, "listened"); // opening the scene to listen counts
      setScreen("dialogues"); setTStart(Date.now());
      return;
    }
    const cat = m.cats[0];
    const sessMode = step === "spoke" ? "speaking" : "vocab";
    startSession(cat, sessMode, 12, { level: m.level });
    missionReturnRef.current = { id: m.id, step }; // startSession cleared it; re-set so results credits it
  };
  const openMission = (id) => { setActiveMission(id); setScreen("mission"); };
  // Credit a mission step when its launched session reaches results.
  useEffect(() => { if (screen === "results" && missionReturnRef.current) markMissionStep(missionReturnRef.current.id, missionReturnRef.current.step); }, [screen, markMissionStep]);

  const startSession = (cat, m, count, opts = {}) => {
    missionReturnRef.current = null; // cleared by default; the mission launcher re-sets it after
    setMode(m); setShowSetup(false); resetSessionState();
    // Remember this session for one-tap resume
    const label = cat === "__all__" ? "All Categories" : cat === "__grammar__" ? "Grammar Cloze" : cat === "__verb__" ? "Verb Trainer" : cat === "__sentence__" ? "Sentence Builder" : cat === "__imperativ__" ? "Imperative" : cat === "__listening__" ? "Listening Practice" : cat === "__confusion__" ? "Confusion Pairs" : cat === "__exam__" ? "Exam Practice" : cat;
    const ls = { cat, m, count, label, ts: Date.now() };
    setLastSession(ls); saveLast(ls);

    // Guard: never navigate into an empty session (e.g. a library category whose every card
    // is filtered out by the current level) — that renders a blank "0 / 0" dead-end. Bounce
    // back home and surface a brief notice instead.
    const guardEmpty = (list) => {
      if (list && list.length) return false;
      setShowSetup(false); setScreen("home");
      showCelebration({ color: "#FFCC00", icon: "alert", tag: "Nothing to practise", big: "No cards for that pick", sub: "Try another topic or level", subIcon: null });
      return true;
    };

    if (m === "vocab" || m === "production" || m === "dictation" || m === "speaking") {
      const isAll = cat === "__all__";
      setCategory(isAll ? "All Categories" : cat);
      const rawPool = isAll ? allVocab() : V[cat].map(w => ({ ...w, _cat: cat }));
      // Presets pass explicit diff/level so a one-tap start isn't raced by async setState.
      const pool = filterPool(rawPool, opts.level);
      const pk = c => `${m}::${c._cat}::${c.de}`;
      const getMult = c => sessionMultiplier(prog[pk(c)], opts.diff || sessDiff);
      const { seeded, rest } = seedDueFirst(pool, count, c => dueCards.has(pk(c)));
      const need = count - seeded.length;
      // New-card pacing: a session must not flood the coming days' review queue (the
      // classic SRS burnout failure). Reviews (due + in-progress) fill the session
      // first; never-seen cards take an adaptive share that *shrinks as due-load grows*
      // (newCap proportional to the non-due remainder), so a backlog day stays mostly
      // review. The cap relaxes to more new cards only when there isn't enough review
      // material, so a fresh category still fills the session.
      const isNew = c => normalizeEntry(prog[pk(c)]).stats.attempts === 0;
      const newRest = rest.filter(isNew);
      const seenRest = rest.filter(c => !isNew(c));
      const newCap = Math.ceil(need * 0.5);
      const newPick = weightedSelect(newRest, Math.min(newCap, need), getMult);
      const seenPick = weightedSelect(seenRest, need - newPick.length, getMult);
      let restPick = [...seenPick, ...newPick];
      if (restPick.length < need) {
        const used = new Set(restPick.map(pk));
        restPick = restPick.concat(weightedSelect(newRest.filter(c => !used.has(pk(c))), need - restPick.length, getMult));
      }
      // Front-load due reviews: they land while attention is freshest, and an abandoned
      // session still services SRS debt before fresh material.
      const sel = [...sh(seeded), ...sh(restPick)];
      if (guardEmpty(sel)) return;
      setCards(sel);
      setScreen("cards"); setTStart(Date.now());
      if (m === "dictation") {
        // Same iOS rule as audio mode: prime TTS inside the tap, then speak the first card.
        try { if (window.speechSynthesis) { const warm = new SpeechSynthesisUtterance(" "); warm.volume = 0; window.speechSynthesis.speak(warm); } } catch (e) {}
        setTimeout(() => { if (sel[0]?.de) speak(sel[0].de); }, 300);
      }
    } else if (m === "article") {
      setCategory("Article Drill"); const pool = cat === "__all__" ? nouns : nouns.filter(n => n.cat === cat);
      const take = Math.min(count, pool.length);
      const { seeded, rest } = seedDueFirst(pool, take, c => dueCards.has(`article::${c.cat}::${c.article} ${c.noun}`));
      const aCards = [...sh(seeded), ...sh(rest).slice(0, Math.max(0, take - seeded.length))];
      if (guardEmpty(aCards)) return;
      setCards(aCards);
      setScreen("drill"); setTStart(Date.now());
    } else if (m === "plural") {
      setCategory("Plural Drill"); const pool = cat === "__all__" ? pluralNouns : pluralNouns.filter(n => n.cat === cat);
      const take = Math.min(count, pool.length);
      const { seeded, rest } = seedDueFirst(pool, take, c => dueCards.has(`plural::${c.cat}::${c.de}`));
      const pCards = [...sh(seeded), ...sh(rest).slice(0, Math.max(0, take - seeded.length))];
      if (guardEmpty(pCards)) return;
      setCards(pCards);
      setScreen("drill"); setTStart(Date.now());
    } else if (m === "cloze") {
      setCategory("Grammar Cloze");
      const cbase = clozeTopic === "all" ? CLOZE : CLOZE.filter(c => c.topic === clozeTopic);
      let cpool;
      if (diffBand === "all") cpool = [...cbase];
      else {
        const hit = cbase.filter(c => inBand(c, diffBand));
        // Stay in-band when it can fill the session; otherwise top up with the rest.
        cpool = hit.length >= Math.min(count, cbase.length) ? hit : [...hit, ...cbase.filter(c => !inBand(c, diffBand))];
      }
      const take = Math.min(count, cpool.length);
      const { seeded, rest } = seedDueFirst(cpool, take, c => dueCards.has(`cloze::Grammar Cloze::${c.q}`));
      setCards([...sh(seeded), ...sh(rest).slice(0, Math.max(0, take - seeded.length))]);
      setScreen("drill"); setTStart(Date.now());
    } else if (m === "verb") {
      setCategory("Verb Trainer");
      // Weakness-aware draw: aggregate saved per-conjugation stats for the selected tense
      // into one entry per verb, then weight the random draw with perfMultiplier so verbs
      // you struggle with come up more often (same soft boost as vocab, max 1.8x).
      const tenseLabel = { present: "Präsens", perfekt: "Perfekt", praeteritum: "Präteritum", konjunktiv1: "Konjunktiv I", konjunktiv2: "Konjunktiv II" }[verbTense];
      const aggByVerb = {};
      Object.entries(prog).forEach(([k, v]) => {
        if (!k.startsWith("verb::")) return;
        const id = k.split("::").slice(2).join("::");
        if (!id.endsWith(`-${tenseLabel}`)) return;
        const verbName = id.slice(0, id.indexOf("-")); // verb names contain no dash
        const n = normalizeEntry(v);
        const a = aggByVerb[verbName] || (aggByVerb[verbName] = { attempts: 0, correct: 0, incorrect: 0, totalMs: 0, timed: 0 });
        a.attempts += n.stats.attempts; a.correct += n.stats.correct; a.incorrect += n.stats.incorrect;
        a.totalMs += (n.stats.avgTime || 0) * (n.stats.timedAttempts || 0); a.timed += n.stats.timedAttempts || 0;
      });
      const weights = VERBS.map(vb => {
        const a = aggByVerb[vb.v];
        if (!a) return 1;
        return perfMultiplier({
          stats: { attempts: a.attempts, correct: a.correct, incorrect: a.incorrect, avgTime: a.timed ? a.totalMs / a.timed : 0, timedAttempts: a.timed, currentStreak: 0, productionStreak: 0, masteredAt: null, lastSeen: null },
          srs: { box: 0 },
        });
      });
      const totalWt = weights.reduce((s, w) => s + w, 0);
      const drawVerb = () => {
        let r = Math.random() * totalWt;
        for (let i = 0; i < VERBS.length; i++) { r -= weights[i]; if (r <= 0) return VERBS[i]; }
        return VERBS[VERBS.length - 1];
      };
      let prevVerb = null;
      setCards(Array.from({ length: count }, () => {
        let vb = drawVerb();
        if (prevVerb && vb.v === prevVerb) vb = drawVerb(); // soften back-to-back repeats
        prevVerb = vb.v;
        return makeVerbQ(verbTense, vb);
      }));
      setScreen("drill"); setTStart(Date.now());
    } else if (m === "sentence") {
      setCategory("Sentence Builder");
      let sordered;
      if (diffBand === "all") sordered = sh([...SENTENCES]);
      else {
        const hit = sh(SENTENCES.filter(s => inBand(s, diffBand)));
        sordered = hit.length >= Math.min(count, SENTENCES.length) ? hit : [...hit, ...sh(SENTENCES.filter(s => !inBand(s, diffBand)))];
      }
      const pool = sordered.slice(0, Math.min(count, SENTENCES.length));
      setCards(pool); setScreen("sentence");
      const first = pool[0]; setSbPool(sh([...first.correct])); setSbPicked([]); setSbChecked(false); setSbCorrect(false);
      setTStart(Date.now());
    } else if (m === "imperativ") {
      setCategory("Imperative");
      // Build one card per (imperative × selected person)
      const persons = Object.entries(impPersons).filter(([k, v]) => v).map(([k]) => k);
      const selected = persons.length > 0 ? persons : ["du", "ihr", "sie"];
      // Expand: each IMPERATIVES row becomes one card per chosen person
      const pool = sh([...IMPERATIVES]).flatMap(card => selected.map(p => ({ ...card, _person: p, de: `${card.base}::${p}` })));
      const take = Math.min(count, pool.length);
      const { seeded, rest } = seedDueFirst(pool, take, c => dueCards.has(`imperativ::Imperative::${c.de}`));
      setCards([...sh(seeded), ...rest.slice(0, Math.max(0, take - seeded.length))]);
      setScreen("drill"); setTStart(Date.now());
    } else if (m === "listening") {
      setCategory(listenMode === "questions" ? "Listening + Questions" : "Listening Practice");
      const dband = (arr) => diffBand === "all" ? sh([...arr])
        : [...sh(arr.filter(d => inBand(d, diffBand))), ...sh(arr.filter(d => !inBand(d, diffBand)))];
      if (listenMode === "listen") {
        // Tap-through mode: use existing dialogues screen
        const pool = dband(DIALOGUES).slice(0, count);
        setCards(pool); setDlgIdx(0); setDlgRevealed({});
        setScreen("dialogues"); setTStart(Date.now());
      } else {
        // Questions mode: flatten to one card per question, only dialogues that have questions
        const withQ = DIALOGUES.filter(d => d.questions && d.questions.length);
        const shuffled = dband(withQ);
        const expanded = shuffled.flatMap(d => d.questions.map((q, qi) => ({
          _dialogue: d, _qIdx: qi, q: q.q, opts: q.opts, correctIdx: q.correctIdx,
          de: `${d.title}::${qi}`,
        })));
        setCards(expanded.slice(0, count));
        setScreen("drill"); setTStart(Date.now());
      }
    } else if (m === "confusion") {
      // Confusion-pair drill: each item → a binary MC (the two base words as options).
      setCategory("Confusion Pairs");
      const lvl = resolveLevel(setupLevel);
      const pool = lvl === "all" ? CONFUSIONS : (CONFUSIONS.filter(c => c.level === lvl).length ? CONFUSIONS.filter(c => c.level === lvl) : CONFUSIONS);
      const cards = sh([...pool]).flatMap(p => p.items.map((it, ii) => ({
        _pair: p, q: it.q, opts: [p.a.de, p.b.de], correctIdx: it.correct === "a" ? 0 : 1,
        answer: it.answer, exEn: it.en, why: it.why, rule: p.rule,
        de: `${p.id}::${ii}`,
      })));
      setCards(sh(cards).slice(0, count));
      setScreen("drill"); setTStart(Date.now());
    } else if (m === "exam") {
      // Exam-format practice: each question → an MC card; the passage rides along for the render.
      setCategory("Exam Practice");
      const lvl = resolveLevel(setupLevel);
      const pool = lvl === "all" ? EXAM : (EXAM.filter(e => e.level === lvl).length ? EXAM.filter(e => e.level === lvl) : EXAM);
      const cards = sh([...pool]).flatMap(s => s.questions.map((q, qi) => ({
        _set: s, q: q.q, opts: q.opts, correctIdx: q.correctIdx, why: q.why,
        de: `${s.id}::${qi}`,
      })));
      setCards(cards.slice(0, count));
      setScreen("drill"); setTStart(Date.now());
    } else if (m === "audio") {
      // Audio mode: same pool construction as vocab, but play instead of quiz.
      // Does NOT touch SRS. Counts toward daily goal only.
      const isAll = cat === "__all__";
      setCategory(isAll ? "All Categories (Audio)" : `${cat} (Audio)`);
      const pool = filterPool(isAll ? allVocab() : V[cat].map(w => ({ ...w, _cat: cat })));
      const getMult = c => sessionMultiplier(prog[`vocab::${c._cat}::${c.de}`], sessDiff);
      const selected = weightedSelect(pool, count, getMult);
      setCards(selected);
      setIdx(0);
      setScreen("audio"); setTStart(Date.now());
      // iOS Safari only lets speechSynthesis start from inside a user gesture. startSession
      // runs synchronously within the "Start session" tap, so prime a silent utterance here
      // to unlock TTS for the deferred autostart below — otherwise the first card is silent.
      try { if (window.speechSynthesis) { const warm = new SpeechSynthesisUtterance(" "); warm.volume = 0; window.speechSynthesis.speak(warm); } } catch (e) {}
      // Auto-start playback after screen mounts so user lands in "playing" state
      setTimeout(() => { audioPlayingRef.current = true; setAudioPlaying(true); acquireWakeLock(); }, 100);
    }
  };

  // Launch weak review. Weak cards span multiple modes (vocab, cloze, imperativ, etc.)
  // but each mode has its own screen. Strategy: pick the largest mode bucket from the
  // pre-grouped memo and review those cards on the matching screen.
  const startWeakReview = () => {
    if (resolvedWeak.total === 0) return;
    const buckets = resolvedWeak.byMode;
    const largestMode = Object.keys(buckets).sort((a, b) => buckets[b].length - buckets[a].length)[0];
    const pool = buckets[largestMode];
    resetSessionState();
    const picked = sh(pool).slice(0, Math.min(20, pool.length));
    setCards(picked);
    if (largestMode === "vocab" || largestMode === "production") {
      setMode(largestMode); setCategory("Weak Areas"); setScreen("cards");
    } else if (largestMode === "article") {
      setMode("article"); setCategory("Article Drill"); setScreen("drill");
    } else if (largestMode === "plural") {
      setMode("plural"); setCategory("Plural Drill"); setScreen("drill");
    } else if (largestMode === "cloze") {
      setMode("cloze"); setCategory("Grammar Cloze"); setScreen("drill");
    } else if (largestMode === "imperativ") {
      setMode("imperativ"); setCategory("Imperative"); setScreen("drill");
    } else {
      setMode("vocab"); setCategory("Weak Areas"); setScreen("cards");
    }
    setTStart(Date.now());
  };

  // Launch Daily Review — SRS-scheduled cards that are due today.
  // Same routing logic as weak review: pick largest mode bucket, route to matching screen.
  const startDueReview = () => {
    if (resolvedDue.total === 0) return;
    const buckets = resolvedDue.byMode;
    const largestMode = Object.keys(buckets).sort((a, b) => buckets[b].length - buckets[a].length)[0];
    const pool = buckets[largestMode];
    resetSessionState();
    const picked = sh(pool).slice(0, Math.min(25, pool.length));
    setCards(picked);
    if (largestMode === "vocab" || largestMode === "production") {
      setMode(largestMode); setCategory("Today's Review"); setScreen("cards");
    } else if (largestMode === "article") {
      setMode("article"); setCategory("Article Drill"); setScreen("drill");
    } else if (largestMode === "plural") {
      setMode("plural"); setCategory("Plural Drill"); setScreen("drill");
    } else if (largestMode === "cloze") {
      setMode("cloze"); setCategory("Grammar Cloze"); setScreen("drill");
    } else if (largestMode === "imperativ") {
      setMode("imperativ"); setCategory("Imperative"); setScreen("drill");
    } else {
      setMode("vocab"); setCategory("Today's Review"); setScreen("cards");
    }
    setTStart(Date.now());
  };

  const startAlmostReview = () => {
    if (almostCards.total === 0) return;
    const buckets = almostCards.byMode;
    const largestMode = Object.keys(buckets).sort((a, b) => buckets[b].length - buckets[a].length)[0];
    const pool = buckets[largestMode];
    resetSessionState();
    const picked = sh(pool).slice(0, Math.min(15, pool.length));
    setCards(picked);
    if (largestMode === "vocab" || largestMode === "production") {
      setMode(largestMode); setCategory("Almost Mastered"); setScreen("cards");
    } else if (largestMode === "article") {
      setMode("article"); setCategory("Article Drill"); setScreen("drill");
    } else if (largestMode === "plural") {
      setMode("plural"); setCategory("Plural Drill"); setScreen("drill");
    } else if (largestMode === "cloze") {
      setMode("cloze"); setCategory("Grammar Cloze"); setScreen("drill");
    } else if (largestMode === "imperativ") {
      setMode("imperativ"); setCategory("Imperative"); setScreen("drill");
    } else {
      setMode("vocab"); setCategory("Almost Mastered"); setScreen("cards");
    }
    setTStart(Date.now());
  };

  const startRepeat = () => {
    const m = mode;
    // Verbs repeat the exact conjugations you failed (that's what the button promises) —
    // not a fresh random batch.
    if (m === "verb") setCards(sh([...failed]));
    else if (m === "sentence") {
      setCards(sh([...failed]));
      const f = failed[0];
      if (f) { setSbPool(sh([...f.correct])); setSbPicked([]); setSbChecked(false); setSbCorrect(false); }
    } else setCards(sh([...failed]));
    setIdx(0); setFlipped(false); setAnswered(false); setSel(null); setShowEx(false); setShowHint(false);
    setVis(true); setInput(""); setInputResult(null); setLastElapsed(0); setRevealElapsed(0); setMasteryBurst(null); setLastBoxMove(null);
    setStats({ c: 0, w: 0 }); setFailed([]); setFailedNames([]); setCombo(0); setRpt(r => r + 1); setTStart(Date.now());
    setScreen(m === "sentence" ? "sentence" : (m === "vocab" || m === "production" || m === "dictation" || m === "speaking") ? "cards" : "drill");
  };

  // Card flip handlers
  const handleFlipAnswer = (correct) => { if (answered) return; setAnswered(true); record(correct, cards[idx], revealElapsed || (Date.now() - tStart)); };
  // ── Recall swipe model ──
  // The German prompt is graded by the FIRST gesture, before any reveal:
  //   swipe right / → / 2  = "got it"   → count correct
  //   swipe left  / ← / tap = "not sure" → count wrong
  // What the gesture DOES depends on the auto-advance setting:
  //   • auto-advance ON  → a correct "got it" flies straight off (no summary you'd skim
  //     past); "not sure" flips to the answer to study.
  //   • auto-advance OFF → BOTH directions flip to the answer, so you always see the
  //     summary (the setting is the toggle for "show me my correct ones too").
  // Either way the grade is the gesture's direction, and once revealed the only step
  // left is to move on, so any swipe (or Enter) advances.
  const revealGraded = (correct) => {
    if (flipped || !vis || answered || navLockRef.current) return;
    setRevealElapsed(Date.now() - tStart);
    handleFlipAnswer(correct);
    setFlipped(true);
    if (cards[idx]?.de) speak(cards[idx].de);
  };
  const notSure = () => revealGraded(false);            // left / tap — always flips, counts wrong
  const gotIt = () => {                                  // right — correct; flies off only if auto-advancing
    if (flipped || answered || !vis || navLockRef.current) return;
    if (autoAdvance) { handleFlipAnswer(true); flyCardOff(true, nextCard); }
    else revealGraded(true);
  };
  const handleRevealKey = e => {
    if (flipped) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); nextCard(); } return; }
    if (e.key === "ArrowRight" || e.key === "2") { e.preventDefault(); gotIt(); }
    else if (e.key === "ArrowLeft" || e.key === "1" || e.key === "Enter" || e.key === " ") { e.preventDefault(); notSure(); }
  };

  // Drag is applied imperatively (ref styles), so pointermove never causes a re-render.
  const swipeRef = useRef(null);
  const swipeLeftRef = useRef(null);   // left stamp ("REVEAL" on the front, "NEXT" once flipped)
  const swipeRightRef = useRef(null);  // right stamp ("GOT IT" / "NEXT")
  const swipeMovedRef = useRef(false); // suppresses click-to-reveal right after a drag
  const swipeDrag = useRef({ active: false, startX: 0, startY: 0, dx: 0 });
  // pointermove can fire several times per frame; we only stash the latest dx and apply
  // it once per animation frame (rAF-throttled) to avoid redundant style recalcs.
  const swipeRafRef = useRef(0);
  const applySwipeFrame = () => {
    swipeRafRef.current = 0;
    const el = swipeRef.current;
    if (!el || !swipeDrag.current.active) return;
    const dx = swipeDrag.current.dx;
    // translate3d forces a compositor layer so the card's shadow/gradient/3D subtree is
    // rasterised once and only transformed on the GPU thereafter — no per-frame repaint.
    el.style.transform = `translate3d(${dx}px,0,0) rotate(${dx * 0.045}deg)`;
    const p = Math.min(1, Math.abs(dx) / 110);
    if (swipeRightRef.current) swipeRightRef.current.style.opacity = dx > 0 ? p : 0;
    if (swipeLeftRef.current) swipeLeftRef.current.style.opacity = dx < 0 ? p : 0;
  };
  const resetSwipeVisuals = () => {
    if (swipeRafRef.current) { cancelAnimationFrame(swipeRafRef.current); swipeRafRef.current = 0; }
    const el = swipeRef.current;
    if (el) { el.style.transition = ""; el.style.transform = ""; el.style.opacity = ""; el.style.willChange = ""; }
    if (swipeLeftRef.current) swipeLeftRef.current.style.opacity = 0;
    if (swipeRightRef.current) swipeRightRef.current.style.opacity = 0;
  };
  // Fly the flip card off-screen, then run `after` (typically nextCard).
  const flyCardOff = (right, after) => {
    if (swipeRafRef.current) { cancelAnimationFrame(swipeRafRef.current); swipeRafRef.current = 0; }
    const el = swipeRef.current;
    if (el) {
      el.style.willChange = "transform";
      el.style.transition = "transform .26s cubic-bezier(.4,.0,.7,.2), opacity .26s ease-in";
      el.style.transform = `translate3d(${right ? 640 : -640}px,0,0) rotate(${right ? 18 : -18}deg)`;
      el.style.opacity = "0";
    }
    const stamp = right ? swipeRightRef.current : swipeLeftRef.current;
    if (stamp) stamp.style.opacity = 1;
    // Reset happens inside nextCard's hidden window (not here): clearing the transform while
    // the card is still visible would snap the old card back to centre for one frame.
    window.setTimeout(after, 240);
  };
  const snapCardBack = () => {
    const el = swipeRef.current;
    if (el) { el.style.transition = "transform .2s cubic-bezier(.22,.61,.36,1)"; el.style.transform = "translate3d(0,0,0)"; el.style.opacity = ""; }
    if (swipeLeftRef.current) swipeLeftRef.current.style.opacity = 0;
    if (swipeRightRef.current) swipeRightRef.current.style.opacity = 0;
    window.setTimeout(() => { const e2 = swipeRef.current; if (e2 && !swipeDrag.current.active) e2.style.willChange = ""; }, 220);
  };
  const onCardPointerDown = (e) => {
    swipeMovedRef.current = false;
    if (navLockRef.current) return;
    if (answered && !flipped) return; // mid know-fly-off — nothing to grab
    swipeDrag.current = { active: true, startX: e.clientX, startY: e.clientY, dx: 0 };
    const el = swipeRef.current;
    if (el) { el.style.transition = "none"; el.style.willChange = "transform"; } // promote to its own layer up front
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
  };
  const onCardPointerMove = (e) => {
    const s = swipeDrag.current;
    if (!s.active) return;
    const dx = e.clientX - s.startX, dy = e.clientY - s.startY;
    if (!swipeMovedRef.current && Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
    swipeMovedRef.current = true;
    s.dx = dx;
    if (!swipeRafRef.current) swipeRafRef.current = requestAnimationFrame(applySwipeFrame);
  };
  const onCardPointerUp = () => {
    const s = swipeDrag.current;
    if (!s.active) return;
    s.active = false;
    if (swipeRafRef.current) { cancelAnimationFrame(swipeRafRef.current); swipeRafRef.current = 0; }
    const past = swipeMovedRef.current && Math.abs(s.dx) > 90;
    if (past && !navLockRef.current) {
      if (flipped) flyCardOff(s.dx > 0, nextCard);  // revealed → only action is advance
      else if (s.dx > 0) { gotIt(); if (!autoAdvance) snapCardBack(); } // right → "got it"; study mode flips, so spring the drag back
      else { notSure(); snapCardBack(); }            // front, left → "not sure"
    } else {
      snapCardBack();
    }
  };
  // ── Swipe-to-advance for the non-flip cards (production / drills / sentence) ──
  // Once a card is answered the only thing left to do is move on, so a horizontal swipe
  // flings it away (the same flyOff exit the Next button triggers) — matching the Recall
  // feel without a second tap. Gesture-only: a tap (no travel) still falls through to the
  // button underneath, so Hören / Show example / Next keep working.
  const advStartRef = useRef(null);
  const onAdvPointerDown = (e) => { advStartRef.current = { x: e.clientX, y: e.clientY, captured: false }; };
  // Capture the pointer once a real horizontal travel begins so the release still lands on
  // this card even if the finger/cursor has left it (mouse has no implicit capture). Taps
  // never travel, so they never capture — buttons underneath keep working.
  const onAdvPointerMove = (e) => {
    const s = advStartRef.current;
    if (!s || s.captured) return;
    if (Math.abs(e.clientX - s.x) > 12) { s.captured = true; try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {} }
  };
  const onAdvPointerUp = (ready, advanceFn) => (e) => {
    const s = advStartRef.current; advStartRef.current = null;
    if (!s || !ready || navLockRef.current) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.3) advanceFn();
  };
  // ── Auto-advance on exact-correct answers ──
  // A correct answer needs no review stop, so the card flies away on its own — but not
  // before the pronunciation has finished, since hearing the word is the value of getting
  // it right. speakThenAdvance speaks the answer and advances when the utterance ends
  // (onend), floored at ~0.7s so a silent/instant device still gives a beat, and hard-
  // capped so a browser that never fires onend can't strand the session. Wrong and "close"
  // answers still stop for inspection. Toggleable in Settings; any manual advance or
  // leaving the screen bumps the token, voiding every pending fire for this answer.
  const autoAdvTimerRef = useRef(null);
  const autoAdvTokenRef = useRef(0);
  const speakThenAdvance = (text, advanceFn) => {
    if (!autoAdvance) { if (text) speak(text); return; }
    const token = ++autoAdvTokenRef.current;
    const startedAt = Date.now();
    // Floor so a silent/instant device still gives a beat; a length-based estimate
    // (~70ms/char, the same heuristic the dialogue player uses) is the PRIMARY timer so a
    // browser that never fires onend still advances promptly. onend, when it fires, advances
    // earlier — but never before the floor — so audio is heard out without over-waiting.
    const MIN_MS = 650;
    const est = Math.min(2600, Math.max(MIN_MS, (text ? text.length : 6) * 70 + 550));
    const fire = () => { if (autoAdvTokenRef.current !== token) return; advanceFn(); };
    const scheduleFire = (delay) => { if (autoAdvTimerRef.current) clearTimeout(autoAdvTimerRef.current); autoAdvTimerRef.current = setTimeout(fire, Math.max(0, delay)); };
    scheduleFire(est);
    speakWith(text).then(() => {
      if (autoAdvTokenRef.current !== token) return;
      scheduleFire(MIN_MS - (Date.now() - startedAt));
    });
  };
  const cancelAutoAdvance = () => { autoAdvTokenRef.current++; if (autoAdvTimerRef.current) { clearTimeout(autoAdvTimerRef.current); autoAdvTimerRef.current = null; } };

  const submitTyped = () => {
    if (answered) return;
    const card = cards[idx]; const target = mode === "vocab" ? card.en : card.de;
    const result = checkMatch(input, target);
    setInputResult(result); setAnswered(true);
    if (result === "exact" || result === "capital" || result === "eszett") setBloom(b => b + 1);
    record(result !== "wrong", card, Date.now() - tStart);
    if (result === "exact") speakThenAdvance(card.de, nextCard); else speak(card.de);
  };
  // "I don't know" on a typed card: reveal + count as wrong. Blanking is the honest
  // demote signal (and re-queues the card via the in-session retry), instead of forcing
  // a fake guess just to see the answer.
  const revealTyped = () => {
    if (answered) return;
    const card = cards[idx];
    setInput(""); setInputResult("wrong"); setAnswered(true);
    record(false, card, Date.now() - tStart);
    speak(card.de);
  };

  // ── Speaking mode ──
  const stopListening = () => {
    const r = recogRef.current; recogRef.current = null;
    if (r) { try { r.onresult = r.onerror = r.onend = null; r.stop(); } catch (e) {} }
    setListening(false);
  };
  // Grade a spoken attempt against the target German (case/punctuation-insensitive via
  // checkMatch). Speech has no capitalisation, so "capital"/"eszett" count as correct.
  const gradeSpoken = (transcript) => {
    if (answered) return;
    stopListening();
    const card = cards[idx];
    const result = checkMatch(transcript, card.de);
    setInput(transcript); setInputResult(result); setAnswered(true);
    if (result !== "wrong") setBloom(b => b + 1);
    record(result !== "wrong", card, Date.now() - tStart);
    if (result === "exact" || result === "capital" || result === "eszett") speakThenAdvance(card.de, nextCard);
    else speak(card.de);
  };
  // Shadowing fallback (no SpeechRecognition, e.g. iOS): the learner self-grades.
  const gradeSelf = (ok) => {
    if (answered) return;
    const card = cards[idx];
    setInput(""); setInputResult(ok ? "exact" : "wrong"); setAnswered(true);
    record(ok, card, Date.now() - tStart);
    if (ok) speakThenAdvance(card.de, nextCard); else speak(card.de);
  };
  const startListening = () => {
    if (answered || !SPEECH_REC_CTOR || recogRef.current) return;
    setSpeechErr(""); setHeard("");
    let rec;
    try { rec = new SPEECH_REC_CTOR(); } catch (e) { setSpeechErr("Mic unavailable"); return; }
    rec.lang = "de-DE"; rec.interimResults = true; rec.maxAlternatives = 1; rec.continuous = false;
    rec.onresult = (ev) => {
      let txt = "";
      for (let i = 0; i < ev.results.length; i++) txt += ev.results[i][0].transcript;
      setHeard(txt.trim());
      if (ev.results[ev.results.length - 1].isFinal) gradeSpoken(txt.trim());
    };
    rec.onerror = (ev) => { setSpeechErr(ev.error === "not-allowed" ? "Mic blocked — allow access" : "Didn't catch that"); stopListening(); };
    rec.onend = () => { if (recogRef.current) setListening(false); };
    recogRef.current = rec;
    try { rec.start(); setListening(true); } catch (e) { recogRef.current = null; setSpeechErr("Couldn't start mic"); }
  };
  // Stop the mic whenever we leave the session screen (and on unmount).
  useEffect(() => { if (screen !== "cards" && recogRef.current) stopListening(); }, [screen]);
  const submitCloze = () => {
    if (answered) return;
    const card = cards[idx]; const result = checkMatch(input, card.a);
    setInputResult(result); setAnswered(true);
    record(result !== "wrong", card, Date.now() - tStart);
    if (result === "exact") speakThenAdvance(card.a, nextDrill);
  };
  const submitPlural = () => {
    if (answered) return;
    const card = cards[idx]; const result = checkPlural(input, card.pl);
    setInputResult(result); setAnswered(true);
    record(result !== "wrong", card, Date.now() - tStart);
    if (result === "exact") speakThenAdvance(card.pl, nextDrill); else speak(card.pl);
  };
  // "I don't know" on a typed drill (plural / cloze / imperativ / typed-verb): reveal the
  // answer and count it wrong — the same honest demote as revealTyped on production. Without
  // this the only way to surrender a typed drill was to type gibberish, which the user hit.
  const revealDrill = () => {
    if (answered) return;
    const card = cards[idx];
    setInput(""); setInputResult("wrong"); setAnswered(true);
    record(false, card, Date.now() - tStart);
    if (mode === "plural") speak(card.pl);
    else if (mode === "imperativ") speak(card[card._person]);
    else if (mode === "verb" && card.pron && card.correct) speak(`${card.pron} ${card.correct}`);
    // cloze stays silent, matching submitCloze.
  };

  const nextCard = () => {
    cancelAutoAdvance();
    if (navLockRef.current) return;
    if (recogRef.current) stopListening();
    setHeard(""); setSpeechErr("");
    if (idx >= cardsLenRef.current - 1) { setScreen("results"); return; }
    navLockRef.current = true;
    // Production/dictation cards fly off on advance; Recall already flew its inner card via
    // the swipe transform, so it keeps the gentle slide instead of double-animating.
    if (mode === "production" || mode === "dictation" || mode === "speaking") setFlyOff(true);
    setVis(false); setFeedback(null);
    setTimeout(() => {
      resetSwipeVisuals(); // card is hidden (vis=false) now, so clearing the swipe transform can't flash
      setFlyOff(false);
      setFlipped(false); setAnswered(false); setShowEx(false); setShowHint(false); setInput(""); setInputResult(null); setLastElapsed(0); setRevealElapsed(0); setMasteryBurst(null); setLastBoxMove(null);
      setIdx(i => Math.min(i + 1, Math.max(cardsLenRef.current - 1, 0)));
      setTStart(Date.now());
      setTimeout(() => { setVis(true); navLockRef.current = false; }, 50);
    }, 180);
  };

  const handleDrillAnswer = (oi) => {
    if (answered) return; setAnswered(true); setSel(oi);
    const card = cards[idx]; let correct;
    if (mode === "article") correct = ["der", "die", "das"][oi] === card.article;
    else if (mode === "verb") correct = oi === card.correctIdx;
    else if (mode === "listening" || mode === "confusion" || mode === "exam") correct = oi === card.correctIdx;
    else correct = false;
    record(correct, card, Date.now() - tStart);
    // Speak the answer where there's something meaningful to hear: the full "pron +
    // conjugation" for verbs, "article + noun" for genders (so a correct der/die/das is
    // reinforced aloud). Listening has no extra utterance — the clip already played.
    const audio = (mode === "verb" && card.pron && card.correct) ? `${card.pron} ${card.correct}`
      : mode === "article" ? `${card.article} ${card.noun}` : "";
    if (correct) speakThenAdvance(audio, nextDrill);
    else if (mode === "verb" && card.pron && card.correct) speak(`${card.pron} ${card.correct}`);
  };

  const nextDrill = () => {
    cancelAutoAdvance();
    if (navLockRef.current) return;
    if (idx >= cardsLenRef.current - 1) { setScreen("results"); return; }
    navLockRef.current = true;
    setFlyOff(true);
    setVis(false); setFeedback(null);
    setTimeout(() => {
      setFlyOff(false);
      setAnswered(false); setSel(null); setInput(""); setInputResult(null); setShowHint(false); setLastElapsed(0); setRevealElapsed(0); setMasteryBurst(null); setLastBoxMove(null);
      setIdx(i => Math.min(i + 1, Math.max(cardsLenRef.current - 1, 0)));
      setTStart(Date.now());
      setTimeout(() => { setVis(true); navLockRef.current = false; }, 50);
    }, 180);
  };

  // Sentence building
  const sbTapWord = (word, i) => { if (sbChecked) return; const np = [...sbPool]; np.splice(i, 1); setSbPool(np); setSbPicked(p => [...p, word]); };
  const sbUntapWord = (word, i) => { if (sbChecked) return; const np = [...sbPicked]; np.splice(i, 1); setSbPicked(np); setSbPool(p => [...p, word]); };
  const sbCheck = () => { const card = cards[idx]; const isCorrect = sbPicked.join(" ") === card.correct.join(" "); setSbChecked(true); setSbCorrect(isCorrect); record(isCorrect, card, Date.now() - tStart); if (isCorrect) speakThenAdvance(card.correct.join(" "), sbNext); };
  const sbNext = () => {
    cancelAutoAdvance();
    if (navLockRef.current) return;
    if (idx >= cardsLenRef.current - 1) { setScreen("results"); return; }
    navLockRef.current = true;
    setFlyOff(true);
    setVis(false); setFeedback(null);
    setTimeout(() => {
      setFlyOff(false);
      const next = cards[Math.min(idx + 1, cards.length - 1)];
      if (next) setSbPool(sh([...next.correct]));
      setSbPicked([]); setSbChecked(false); setSbCorrect(false); setLastElapsed(0); setRevealElapsed(0); setMasteryBurst(null); setLastBoxMove(null);
      setIdx(i => Math.min(i + 1, Math.max(cards.length - 1, 0)));
      setTStart(Date.now());
      setTimeout(() => { setVis(true); navLockRef.current = false; }, 50);
    }, 180);
  };

  // Session keyboard shortcuts (desktop / iPad with keyboard): Space reveals or toggles
  // audio, 1–4 answers, Enter advances. Subscribed without a dependency array so the
  // handler always closes over fresh state — one listener, re-bound per render (cheap).
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (showSetup || showSettings || showOnboarding) return;
      const tag = ((e.target && e.target.tagName) || "").toLowerCase();
      const inField = tag === "input" || tag === "textarea" || tag === "select";
      const flipMode = screen === "cards" && mode !== "production" && mode !== "dictation" && mode !== "speaking";
      if (e.key === "Enter") {
        if (inField) return; // typed inputs own their Enter (submit)
        if (screen === "cards" && answered) { e.preventDefault(); nextCard(); }
        else if (screen === "drill" && answered) { e.preventDefault(); nextDrill(); }
        else if (screen === "sentence") {
          if (sbChecked) { e.preventDefault(); sbNext(); }
          else if (sbPicked.length > 0) { e.preventDefault(); sbCheck(); }
        }
        return;
      }
      if (inField) return;
      if (e.key === " ") {
        if (screen === "audio") { e.preventDefault(); audioPlaying ? audioPause() : audioResume(); return; }
        // The card handles its own Space when focused (role=button) — skip to avoid double fire.
        const onRevealEl = e.target && e.target.getAttribute && e.target.getAttribute("role") === "button";
        if (flipMode && flipped) { e.preventDefault(); nextCard(); }            // revealed → advance
        else if (flipMode && !answered && !onRevealEl) { e.preventDefault(); notSure(); }
        return;
      }
      // Front of a Recall card: → / 2 = "got it", ← / 1 = "not sure".
      if (flipMode && !flipped && !answered) {
        if (e.key === "ArrowRight" || e.key === "2") { e.preventDefault(); gotIt(); }
        else if (e.key === "ArrowLeft" || e.key === "1") { e.preventDefault(); notSure(); }
        return;
      }
      if (screen === "drill" && !answered && card) {
        const n = parseInt(e.key, 10);
        if (Number.isNaN(n) || n < 1) return;
        if (mode === "article" && n <= 3) { e.preventDefault(); handleDrillAnswer(n - 1); }
        else if ((mode === "verb" || mode === "listening") && card.opts && n <= card.opts.length) { e.preventDefault(); handleDrillAnswer(n - 1); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Lock page scrolling while in a single-card session (Recall / typed / drills / sentence).
  // These screens are exactly one viewport tall, so any scroll is an accidental drag that
  // fights the swipe gestures — the single most annoying thing about swiping. The document
  // is pinned; internal scrollers (e.g. a long listening transcript) still scroll on their own.
  useEffect(() => {
    const lock = ["cards", "drill", "sentence"].includes(screen);
    const html = document.documentElement, body = document.body;
    if (lock) { html.style.overflow = "hidden"; body.style.overflow = "hidden"; }
    else { html.style.overflow = ""; body.style.overflow = ""; }
    return () => { html.style.overflow = ""; body.style.overflow = ""; };
  }, [screen]);

  // Precompute all category stats in one pass — avoids 19×N recomputation on every render.
  const catStats = useMemo(() => {
    const out = {};
    CATS.forEach(cat => {
      const ws = V[cat];
      let seen = 0, productionSeen = 0, strong = 0, mastered = 0, almost = 0;
      let recognitionAttempts = 0, recognitionCorrect = 0, productionAttempts = 0, productionCorrect = 0;
      let totalRecallMs = 0, timedAttempts = 0;
      const masteredCards = [];
      ws.forEach(w => {
        if (!w?.de) return;
        const vk = `vocab::${cat}::${w.de}`, pk = `production::${cat}::${w.de}`;
        const recognition = normalizeEntry(prog[vk]);
        const production = normalizeEntry(prog[pk]);
        const strength = wordStrength(prog[vk], prog[pk]);
        if (recognition.stats.attempts > 0 || production.stats.attempts > 0) seen++;
        if (production.stats.attempts > 0) productionSeen++;
        if (strength.strong) strong++;
        if (isMasteredEntry(production)) {
          mastered++;
          masteredCards.push(w);
        } else if (production.stats.productionStreak > 0) {
          almost++;
        }
        recognitionAttempts += recognition.stats.attempts;
        recognitionCorrect += recognition.stats.correct;
        productionAttempts += production.stats.attempts;
        productionCorrect += production.stats.correct;
        totalRecallMs += (production.stats.avgTime || 0) * (production.stats.timedAttempts || 0);
        timedAttempts += production.stats.timedAttempts || 0;
      });
      out[cat] = {
        total: ws.length,
        seen,
        productionSeen,
        strong,
        mastered,
        almost,
        recognitionAccuracy: recognitionAttempts ? Math.round((recognitionCorrect / recognitionAttempts) * 100) : null,
        productionAccuracy: productionAttempts ? Math.round((productionCorrect / productionAttempts) * 100) : null,
        avgRecall: timedAttempts ? totalRecallMs / timedAttempts / 1000 : null,
        masteredCards,
      };
    });
    return out;
  }, [prog]);
  const getCatStats = cat => catStats[cat] || { total: 0, seen: 0, productionSeen: 0, strong: 0, mastered: 0, almost: 0, recognitionAccuracy: null, productionAccuracy: null, avgRecall: null, masteredCards: [] };
  const newlyMasteredCats = useMemo(() => new Set(newlyMastered.map(x => x.cat).filter(cat => CATS.includes(cat))), [newlyMastered]);

  // Progress summaries per training mode. "Seen" counts an item as completed when
  // any attempt has scored correct >= 1, matching the brief's simple completion rule.
  // Denominators are chosen to be meaningful, not the full key-space:
  //   - Cloze: each CLOZE entry uniquely identified by its question
  //   - Sentence: each SENTENCES entry by its .correct joined
  //   - Imperative: unique .base verbs (ignoring which person was asked)
  //   - Verb Trainer: unique verbs the user has gotten right in any pronoun/tense
  //   - Listening: unique dialogue titles
  //   - Article drill is omitted because cards don't carry a stable id yet
  const trainingStats = useMemo(() => {
    const out = {
      article: { total: nouns.length, seen: 0 },
      plural: { total: pluralNouns.length, seen: 0 },
      cloze: { total: CLOZE.length, seen: 0 },
      sentence: { total: SENTENCES.length, seen: 0 },
      imperativ: { total: IMPERATIVES.length, seen: 0 },
      verb: { total: VERBS.length, seen: 0 },
      listening: { total: DIALOGUES.length, seen: 0 },
    };
    // Unique-identifier sets so we count each underlying item only once
    const seenArticle = new Set(), seenPlural = new Set(), seenCloze = new Set(), seenSent = new Set(), seenImp = new Set(), seenVerb = new Set(), seenDlg = new Set();
    for (const [key, raw] of Object.entries(prog)) {
      const n = normalizeEntry(raw);
      if (n.stats.correct < 1) continue;
      const parts = key.split("::");
      if (parts.length < 3) continue;
      const [m, cat, id] = [parts[0], parts[1], parts.slice(2).join("::")];
      if (m === "article") seenArticle.add(`${cat}::${id}`);
      else if (m === "plural") seenPlural.add(`${cat}::${id}`);
      else if (m === "cloze") seenCloze.add(id);
      else if (m === "sentence") seenSent.add(id);
      else if (m === "imperativ") {
        // id is "{base}::{person}" — strip ::person to get unique base
        const base = id.split("::")[0];
        seenImp.add(base);
      } else if (m === "verb") {
        // id is "{verb}-{pron}-{tense}" — strip to verb stem
        const verb = id.split("-")[0];
        seenVerb.add(verb);
      } else if (m === "listening") seenDlg.add(id);
    }
    out.article.seen = seenArticle.size;
    out.plural.seen = seenPlural.size;
    out.cloze.seen = seenCloze.size;
    out.sentence.seen = seenSent.size;
    out.imperativ.seen = seenImp.size;
    out.verb.seen = seenVerb.size;
    out.listening.seen = seenDlg.size;
    return out;
  }, [prog, nouns, pluralNouns]);

  const card = cards[idx];
  cardsLenRef.current = cards.length;
  const sessionScreens = new Set(["cards", "drill", "sentence", "audio"]);
  const activeCardMissing = sessionScreens.has(screen) && cards.length > 0 && !card;
  const cardBox = card ? normalizeEntry(prog[gk(card, category, mode)]).srs.box : 0;
  // A card you keep getting wrong (leech-like). Used to auto-surface its mnemonic on
  // reveal — brute-force repetition is the worst leech fix; the hint is the lever.
  const cardStruggling = card ? normalizeEntry(prog[gk(card, category, mode)]).stats.incorrect >= 3 : false;
  // An exact-correct answer auto-advances in ~1s, so the heavy review summary only
  // flashes and can't be read — suppress it on that fast path. It still shows in full
  // for wrong/close answers and whenever auto-advance is off (where you actually stop).
  const answeredCorrect = answered && (
    mode === "article" ? (sel !== null && ["der", "die", "das"][sel] === card?.article) :
    ((mode === "verb" && card?.opts) || mode === "listening") ? (sel === card?.correctIdx) :
    inputResult === "exact"
  );
  const skipSummary = answered && autoAdvance && answeredCorrect;

  useEffect(() => {
    if (!activeCardMissing) return;
    navLockRef.current = false;
    const t = setTimeout(() => {
      setScreen("results");
      setIdx(i => Math.min(i, Math.max(cards.length - 1, 0)));
    }, 0);
    return () => clearTimeout(t);
  }, [activeCardMissing, cards.length]);

  // Styles
  const A = "#FFCC00", AD = "#CC9900", BG = "#0A0A0A", S = "#111111", SH = "#1A1A1A", B = "#2A2A2A";
  const G = "#4ADE80", R = "#DD0000", T = "#F0EDE5", TD = "#8A857D", BL = "#60A5FA";
  // Brand red #DD0000 is ~3.84:1 on #0A0A0A — fails WCAG-AA for normal-size text. RT is a
  // brightened red (~6.9:1) used for red *text*; the deep R stays for rules/borders/badges.
  const RT = "#FF5A5A";
  const dailyGoalPct = Math.min(1, dailyStats.count / Math.max(dailyGoal, 1));
  const FN = `'Montserrat',sans-serif`, BD = `'Montserrat',sans-serif`;
  const FLAG = `linear-gradient(90deg, #050505 0 33%, ${R} 33% 66%, ${A} 66%)`;
  const SOFT_PANEL = "linear-gradient(180deg, #171717 0%, #101010 100%)";
  // Shared class for the card content wrapper: directional slide on advance (is-out, keyed on
  // vis) + answer-feedback shake/pop (keyed on feedback). The two are mutually exclusive by vis.
  const cardCls = "ad-card-enter" + (vis ? (feedback === "wrong" ? " ad-shake" : feedback === "correct" ? " ad-pop" : "") : (flyOff ? " is-fly" : " is-out"));
  // Each category maps to a distinct, literal glyph (audited for collisions + recognisability).
  const categoryIcons = { "Greetings & Basics": "hand", "Numbers & Time": "clock", "Family & People": "users", "Food & Drink": "utensils", "Around the House": "home", "Body & Health": "heart", "Colours & Descriptions": "palette", "Common Verbs": "bolt", "Weather & Nature": "cloud", "Travel & Directions": "map", "Shopping & Money": "cart", "Emotions & Opinions": "smile", "Everyday Actions": "calendar", "Work & Study": "briefcase", "Connectors & Structure": "link", "Abstract & Advanced": "layers", "Media & Communication": "megaphone", "Sport & Leisure": "trophy", "Technology & Digital": "chip", "Admin & Bureaucracy": "file", "Housing & Renting": "key", "Banking & Finance": "bank", "Driving & Traffic": "car", "Cooking & Kitchen": "pot", "Idioms & Slang": "quote", "Electrical Engineering": "bolt", "Maths & Statistics": "chart", "Engineering Workplace": "wrench", "Health & Doctor": "medical", "Clothing & Style": "shirt", "Nature & Outdoors": "leaf", "Small Talk & Social": "message", "Restaurant & Dining Out": "wine", "Opinions & Argument": "scale", "Emails & Phone": "mail", "Character & Personality": "user" };
  // What one tap of a review button actually drills: the largest mode bucket, capped at 20.
  // Shown under the queue total so the badge number and the session size can't contradict.
  const nextBatchLabel = (resolved) => {
    const modes = Object.keys(resolved.byMode);
    if (!modes.length) return "";
    const top = modes.sort((a, b) => resolved.byMode[b].length - resolved.byMode[a].length)[0];
    return `next: ${Math.min(20, resolved.byMode[top].length)} ${modeSummaryLabel(top)}`;
  };
  const reviewQueueItems = [
    { key: "due", title: "Due", count: resolvedDue.total, next: nextBatchLabel(resolvedDue), detail: formatModeBreakdown(resolvedDue.byMode), icon: "calendarCheck", color: A, onClick: startDueReview },
    { key: "weak", title: "Weak", count: resolvedWeak.total, next: nextBatchLabel(resolvedWeak), detail: formatModeBreakdown(resolvedWeak.byMode), icon: "alert", color: RT, onClick: startWeakReview },
    { key: "almost", title: "Almost", count: almostCards.total, next: nextBatchLabel(almostCards), detail: formatModeBreakdown(almostCards.byMode), icon: "trophy", color: G, onClick: startAlmostReview },
  ].filter(item => item.count > 0);

  const Header = ({ extra }) => (
    <div style={{
      paddingTop: "max(12px, env(safe-area-inset-top))",
      marginBottom: 14,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <button onClick={() => setScreen("home")} style={{
          background: "transparent", border: `1px solid ${A}33`, borderRadius: 10,
          color: A, fontSize: 13, cursor: "pointer", padding: "8px 14px",
          fontWeight: 600, letterSpacing: 0.3, flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6
        }}><Icon name="arrowLeft" size={14} /> Back</button>
        <div style={{ fontSize: 11, color: TD, fontWeight: 600, textAlign: "right", lineHeight: 1.3, minWidth: 0, flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
          <div style={{ color: T, fontWeight: 700, letterSpacing: 0.4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
            {extra}{category}
          </div>
          {combo >= 3 && (() => { const h = flameHeat(combo); return <span className="ad-pop" key={combo} style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 4, background: `${h.color}1C`, border: `1px solid ${h.color}55`, borderRadius: 999, padding: "4px 10px", fontSize: 10.5, fontWeight: 900, color: h.color, boxShadow: h.glow ? `0 0 ${h.glow}px ${h.color}55` : "none" }}><HotFlame n={combo} size={12} /> {combo}</span>; })()}
          <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5, background: "#141414", border: `1px solid ${HAIR}`, borderRadius: 999, padding: "4px 11px", fontSize: 10.5, fontWeight: 800, letterSpacing: 0.5 }}>
            {rpt > 0 && <span style={{ color: RT }}>R{rpt + 1}</span>}
            <span style={{ color: T }}>{idx + 1}<span style={{ color: TD, fontWeight: 700 }}> / {cards.length}</span></span>
          </span>
        </div>
      </div>
    </div>
  );

  // Uniform section label used by every home-screen section (Today / Training / Library).
  const SectionHead = ({ title, right, style: s }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "0 0 10px", ...s }}>
      <div style={{ fontSize: 11, color: TD, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase" }}>{title}</div>
      {right || null}
    </div>
  );

  // Keyboard-shortcut hint, rendered only on devices with a hardware pointer.
  const KeyHint = ({ text }) => HAS_FINE_POINTER
    ? <div style={{ textAlign: "center", fontSize: 10, color: TD, opacity: 0.55, paddingTop: 8, letterSpacing: 0.5 }}>{text}</div>
    : null;

  // NEW: Automaticity badge shown after answer
  const SpeedBadge = ({ ms }) => {
    if (!ms || !answered || skipSummary) return null;
    const { text, color } = speedLabel(ms);
    return (<div style={{ fontSize: 11, color, fontWeight: 600, marginTop: 6, textAlign: "center" }}>{text} ({(ms / 1000).toFixed(1)}s)</div>);
  };

  // NEW: Hint toggle button for cards with mnemonic hints
  const HintBtn = ({ hint }) => {
    if (!hint || skipSummary) return null;
    // Struggling cards show the mnemonic automatically (only once answered, so it never
    // gives the answer away pre-attempt); others keep it behind a tap.
    if (showHint || (answered && cardStruggling)) return (<div style={{ marginTop: 6, padding: "8px 12px", background: "#0A0A0A66", borderRadius: 8, fontSize: 11, color: BL, lineHeight: 1.4, borderLeft: `3px solid ${BL}`, display: "flex", gap: 6, alignItems: "flex-start" }}><Icon name="target" size={13} style={{ marginTop: 1 }} /> <span>{answered && cardStruggling && !showHint ? <><strong style={{ color: T }}>Tricky one — </strong>{hint}</> : hint}</span></div>);
    return (<button onClick={() => setShowHint(true)} style={{ marginTop: 6, background: "none", border: `1px solid ${BL}44`, borderRadius: 8, padding: "7px 12px", color: BL, fontSize: 11, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="target" size={13} /> Show hint</button>);
  };

  // Per-card verdict shown after answering. ONE calm block, not a stack of competing chips:
  // a single SRS-outcome line (the genuinely useful "what happened to my schedule"), an
  // optional slim mastery track for production, and a quiet "ask the tutor" link — all in one
  // accent colour driven by whether the card moved up or down. The raw attempts/✓/✗ tally and
  // "last seen" were debug noise on the most-seen screen in the app and have been removed.
  const CardStats = () => {
    if (!answered || !card || skipSummary) return null;
    const key = gk(card, category, mode);
    const n = normalizeEntry(prog[key]);
    if (!n.stats.attempts) return null;
    const productionStreak = n.stats.productionStreak || 0;
    const mastered = productionStreak >= MASTERY_STREAK;
    const unlockedNow = (mode === "production" || mode === "speaking") && inputResult !== "wrong" && productionStreak === MASTERY_STREAK;
    const up = lastBoxMove && lastBoxMove.to > lastBoxMove.from;
    const down = lastBoxMove && lastBoxMove.to < lastBoxMove.from;
    const box = lastBoxMove ? lastBoxMove.to : Math.max(0, Math.min(5, Math.floor(n.srs.box || 0)));
    const days = SRS_INTERVALS[box];
    const accent = up ? G : down ? "#F8A33A" : `${A}AA`;
    const sched = up
      ? `Locked in deeper — back in ${days} day${days === 1 ? "" : "s"}`
      : down
      ? `More practice needed — back in ${days} day${days === 1 ? "" : "s"}`
      : `Memory level ${box + 1}/6 · review in ${days} day${days === 1 ? "" : "s"}`;
    return (
      <div className={unlockedNow ? "ad-mastery-pop" : undefined} style={{ margin: "12px auto 0", maxWidth: 290, background: "#0A0A0A66", border: `1px solid ${accent}2E`, borderLeft: `3px solid ${accent}`, borderRadius: 10, padding: "9px 13px", textAlign: "left" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, fontWeight: 700, color: up ? G : down ? "#F8A33A" : T, lineHeight: 1.35 }}>
          <span aria-hidden="true" style={{ fontWeight: 900 }}>{up ? "↑" : down ? "↓" : "•"}</span>
          <span>{sched}</span>
        </div>
        {(mode === "production" || mode === "speaking") && (mastered ? (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 8, fontSize: 11, fontWeight: 800, color: G }}>
            <Icon name="check" size={13} /> {unlockedNow ? "Mastery unlocked ★ — 5 in a row" : "Mastered ★"}
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 8 }}>
            <span style={{ display: "inline-flex", gap: 4 }}>
              {[0, 1, 2, 3, 4].map(i => <span key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: i < productionStreak ? G : "#2A2A2A" }} />)}
            </span>
            <span style={{ fontSize: 10.5, color: TD, fontWeight: 700 }}>{productionStreak}/{MASTERY_STREAK} to mastery ★</span>
          </div>
        ))}
        <button type="button" onClick={askTutorAboutCard} style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 9, background: "transparent", border: "none", padding: 0, color: TD, fontSize: 10.5, fontWeight: 700, cursor: "pointer", opacity: 0.85 }}>
          <Icon name="message" size={12} /> Why? Ask the tutor
        </button>
      </div>
    );
  };

  const maxC = setupCat === "__all__" ? (setupMode === "article" ? Math.max(nouns.length, 5) : setupMode === "plural" ? Math.max(pluralNouns.length, 5) : totalW) : setupCat === "__grammar__" ? CLOZE.length : setupCat === "__verb__" ? VERBS.length : setupCat === "__sentence__" ? SENTENCES.length : setupCat === "__imperativ__" ? IMPERATIVES.length : setupCat === "__listening__" ? DIALOGUES.length : setupCat === "__confusion__" ? 15 : setupCat === "__exam__" ? 15 : setupCat === "__weak__" ? Math.max(weakCards.size, 1) : (V[setupCat]?.length || nouns.length);
  const hasNouns = setupCat && !["__all__", "__grammar__", "__verb__", "__sentence__", "__weak__"].includes(setupCat) && nouns.some(n => n.cat === setupCat);
  const setupSpecialCats = ["__grammar__", "__verb__", "__sentence__", "__imperativ__", "__listening__", "__confusion__", "__exam__", "__weak__"];
  const setupIsLibrary = setupCat && !setupSpecialCats.includes(setupCat);
  // The Train-tab Articles/Plural drills run over the whole noun pool, so they use cat
  // "__all__" — which the setup would otherwise treat as a *library* vocab session (showing
  // Recall/Speak/Produce presets that ignore the drill mode). Flag that case so the setup
  // shows the drill's own Start button instead of the mode-discarding presets.
  const setupIsGrammarDrill = setupCat === "__all__" && (setupMode === "article" || setupMode === "plural");
  const setupCanUseArticles = hasNouns || setupCat === "__all__";
  const setupCanUsePlural = pluralNouns.length > 0 && (setupCat === "__all__" || (setupIsLibrary && pluralNouns.some(n => n.cat === setupCat)));
  const setupMinC = Math.min(5, maxC);
  const setupTitle = setupCat === "__all__" ? (setupMode === "article" ? "Article Drill" : setupMode === "plural" ? "Plural Drill" : "All Categories") : setupCat === "__grammar__" ? "Grammar Cloze" : setupCat === "__verb__" ? "Verb Trainer" : setupCat === "__sentence__" ? "Sentence Builder" : setupCat === "__imperativ__" ? "Imperative" : setupCat === "__listening__" ? "Listening Practice" : setupCat === "__confusion__" ? "Confusion Pairs" : setupCat === "__exam__" ? "Exam Practice" : setupCat === "__weak__" ? "Weak Areas" : setupCat;
  const stepSessionLength = delta => setSessLen(n => Math.max(setupMinC, Math.min(maxC, n + delta)));

  const ProgressHub = () => {
    return (
      <div style={{ background: PANEL_GRAD, border: `1px solid ${HAIR}`, borderRadius: 18, padding: "18px 18px 18px", marginBottom: 14, position: "relative", overflow: "hidden", boxShadow: ELEV }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: FLAG, opacity: 0.8 }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginTop: 4, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 10, color: TD, fontWeight: 800, letterSpacing: 2 }}>Progress</div>
            <div style={{ fontSize: 11, color: TD, marginTop: 3 }}>Recent performance</div>
          </div>
          <div style={{ fontSize: 10, color: TD, textAlign: "right", lineHeight: 1.35 }}>First attempt<br />correct-time only</div>
        </div>

        {trend30.totalAttempts < 3 ? (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 14 }}>
              <div>
                <div style={{ fontFamily: FN, fontSize: 26, color: T, fontWeight: 800 }}>{trend30.totalAttempts}</div>
                <div style={{ fontSize: 10, color: TD, fontWeight: 700, letterSpacing: 0.5 }}>Saved</div>
              </div>
              <svg viewBox="0 0 86 28" width="86" height="28" aria-hidden="true">
                <line x1="8" y1="14" x2="78" y2="14" stroke={`${TD}22`} strokeWidth="2" strokeLinecap="round" />
                {[0, 1, 2].map(i => (
                  <circle key={i} cx={14 + i * 29} cy="14" r={i < trend30.totalAttempts ? 5 : 3.5} fill={i < trend30.totalAttempts ? A : `${TD}55`} />
                ))}
              </svg>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: FN, fontSize: 26, color: A, fontWeight: 800 }}>{Math.max(0, 3 - trend30.totalAttempts)}</div>
                <div style={{ fontSize: 10, color: TD, fontWeight: 700, letterSpacing: 0.5 }}>To unlock</div>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div>
                <div style={{ fontFamily: FN, fontSize: 26, color: trend30.accuracy >= 80 ? G : trend30.accuracy >= 60 ? A : R, fontWeight: 800 }}>{trend30.accuracy}%</div>
                <div style={{ fontSize: 10, color: TD, fontWeight: 700, letterSpacing: 0.5 }}>Accuracy</div>
              </div>
              <div style={{ borderLeft: `1px solid ${B}`, paddingLeft: 10 }}>
                <div style={{ fontFamily: FN, fontSize: 26, color: trend30.avgSec == null ? TD : trend30.avgSec < 8 ? G : trend30.avgSec < 15 ? A : R, fontWeight: 800 }}>{trend30.avgSec == null ? "-" : trend30.avgSec.toFixed(1)}{trend30.avgSec != null && <span style={{ fontSize: 13, color: TD }}>s</span>}</div>
                <div style={{ fontSize: 10, color: TD, fontWeight: 700, letterSpacing: 0.5 }}>Recall</div>
              </div>
              <div style={{ borderLeft: `1px solid ${B}`, paddingLeft: 10 }}>
                <div style={{ fontFamily: FN, fontSize: 26, color: T, fontWeight: 800 }}>{trend30.totalAttempts}</div>
                <div style={{ fontSize: 10, color: TD, fontWeight: 700, letterSpacing: 0.5 }}>Cards</div>
              </div>
            </div>
            <div style={{ background: "#0F0F0F", borderRadius: 12, padding: "12px 10px 8px", marginTop: 4 }}>
            <svg viewBox="0 0 300 46" width="100%" height="46" style={{ display: "block" }}>
              {(() => {
                const pts = trend30.days.map((d, i) => {
                  const x = (i / 29) * 300;
                  const acc = d.attempts > 0 ? (d.correct / d.attempts) * 100 : null;
                  const y = acc === null ? 42 : 43 - (acc / 100) * 36;
                  return { x, y, acc, attempts: d.attempts };
                });
                const linePath = pts.filter(p => p.acc !== null).map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
                return (
                  <>
                    <line x1="0" y1="7" x2="300" y2="7" stroke={`${A}22`} strokeDasharray="2,3" />
                    <line x1="0" y1="25" x2="300" y2="25" stroke={`${TD}22`} strokeDasharray="2,3" />
                    {linePath && <path d={linePath} pathLength="1" className="ad-spark" fill="none" stroke={A} strokeWidth="1.5" strokeLinejoin="round" />}
                    {pts.map((p, i) => p.acc === null ? (
                      <circle key={i} cx={p.x} cy="43" r="1" fill={`${TD}55`} />
                    ) : (
                      <circle key={i} cx={p.x} cy={p.y} r={p.attempts >= 3 ? 2 : 1.4} fill={p.acc >= 80 ? G : p.acc >= 60 ? A : R} />
                    ))}
                  </>
                );
              })()}
            </svg>
            </div>
            <button onClick={() => setShowTrendBreakdown(v => !v)}
              style={{ background: "none", border: "none", color: TD, fontSize: 11, fontWeight: 700, cursor: "pointer", padding: "6px 0 0", width: "100%", textAlign: "left" }}>
              {showTrendBreakdown ? "v" : ">"} Daily breakdown
            </button>
            {showTrendBreakdown && (
              <div style={{ marginTop: 8, maxHeight: 180, overflowY: "auto", borderTop: `1px solid ${B}`, paddingTop: 8 }}>
                {trend30.days.filter(d => d.attempts > 0).slice().reverse().slice(0, 30).map(d => {
                  const acc = Math.round((d.correct / d.attempts) * 100);
                  const avg = d.timed ? (d.totalMs / d.timed / 1000).toFixed(1) : "-";
                  const label = (() => {
                    const dd = new Date(d.date + "T00:00:00");
                    const today = new Date(); today.setHours(0, 0, 0, 0);
                    const diff = Math.round((today - dd) / 86400000);
                    if (diff === 0) return "Today";
                    if (diff === 1) return "Yesterday";
                    return dd.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
                  })();
                  return (
                    <div key={d.date} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", fontSize: 12, borderBottom: `1px solid ${B}44` }}>
                      <span style={{ color: T, fontWeight: 500, flex: 1 }}>{label}</span>
                      <span style={{ color: TD, fontSize: 11, width: 50, textAlign: "right" }}>{d.attempts} cards</span>
                      <span style={{ color: acc >= 80 ? G : acc >= 60 ? A : R, fontWeight: 800, width: 48, textAlign: "right" }}>{acc}%</span>
                      <span style={{ color: TD, fontSize: 11, width: 50, textAlign: "right" }}>{avg === "-" ? avg : `${avg}s`}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>
    );
  };

  return (
    <div style={{ fontFamily: BD, background: APP_BG, color: T, minHeight: DVH, maxWidth: 480, margin: "0 auto", position: "relative" }}>
      {/* Montserrat now loads from <head> (see index.html) — no late React-injected <link>. */}
      <style>{`
        * { -webkit-tap-highlight-color: transparent; }
        body { -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; font-variant-numeric: tabular-nums; }
        button { touch-action: manipulation; -webkit-user-select: none; user-select: none; }
        button:not(:disabled):active { transform: translateY(1px); }
        ::selection { background: rgba(255,204,0,0.25); }
        @keyframes ad-screen-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .ad-screen { animation: ad-screen-in .24s ease-out; }
        @keyframes ad-ring-in { from { stroke-dashoffset: var(--c); } }
        .ad-ringin { animation: ad-ring-in .9s ease-out; }
        @keyframes ad-mastery-pop {
          0% { transform: scale(0.92); box-shadow: 0 0 0 rgba(88, 214, 141, 0); }
          48% { transform: scale(1.04); box-shadow: 0 0 28px rgba(88, 214, 141, 0.28); }
          100% { transform: scale(1); box-shadow: 0 0 0 rgba(88, 214, 141, 0); }
        }
        @keyframes ad-mastery-burst {
          0% { opacity: 0; transform: translateY(8px) scale(0.96); }
          30% { opacity: 1; transform: translateY(0) scale(1.02); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes ad-category-mastered {
          0%, 100% { box-shadow: 0 0 0 rgba(88, 214, 141, 0); }
          50% { box-shadow: 0 0 22px rgba(88, 214, 141, 0.18); }
        }
        .ad-mastery-pop { animation: ad-mastery-pop 560ms ease-out; }
        .ad-mastery-burst { animation: ad-mastery-burst 620ms ease-out; }
        .ad-category-mastered { animation: ad-category-mastered 1600ms ease-in-out 2; }
        @keyframes ad-shake { 10%,90%{transform:translateX(-2px)} 20%,80%{transform:translateX(3px)} 30%,50%,70%{transform:translateX(-6px)} 40%,60%{transform:translateX(6px)} }
        @keyframes ad-pop { 0%{transform:scale(1)} 35%{transform:scale(1.045)} 100%{transform:scale(1)} }
        @keyframes ad-draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
        .ad-shake { animation: ad-shake 460ms cubic-bezier(.36,.07,.19,.97); }
        .ad-pop { animation: ad-pop 420ms ease-out; }
        .ad-card-enter { opacity: 1; transform: translateX(0); transition: opacity .18s ease, transform .26s cubic-bezier(.22,.61,.36,1); }
        .ad-card-enter.is-out { opacity: 0; transform: translateX(26px); }
        .ad-card-enter.is-fly { opacity: 0; transform: translateX(118%) rotate(5deg); transition: opacity .14s ease-in, transform .3s cubic-bezier(.4,0,.7,.2); }
        .ad-spark { stroke-dasharray: 1; stroke-dashoffset: 1; animation: ad-draw 950ms ease-out forwards; }
        /* min-width:0 lets the input shrink inside its flex row so the adjacent submit
           button can't be pushed past the viewport edge on narrow (≤320px) phones. */
        .ad-input { min-width: 0; transition: border-color .18s ease, box-shadow .18s ease, background .18s ease; }
        .ad-input:focus { outline: none; border-color: #FFCC00 !important; box-shadow: 0 0 0 3px rgba(255,204,0,.16); background: #1d1d1d; }
        .ad-uk:active { transform: translateY(1px) scale(.95); border-color: #FFCC00; }
        .ad-elev { box-shadow: 0 20px 44px -24px rgba(0,0,0,.85), 0 0 30px -16px rgba(255,204,0,.16); }
        button:focus-visible, [role="button"]:focus-visible, input:focus-visible { outline: 2px solid #FFCC00AA; outline-offset: 2px; }
        @keyframes ad-goal-in { 0%{opacity:0;transform:scale(.82) translateY(10px)} 55%{opacity:1;transform:scale(1.05) translateY(0)} 72%{transform:scale(.98)} 100%{opacity:1;transform:scale(1)} }
        @keyframes ad-goal-out { to { opacity:0; transform:scale(.96) } }
        .ad-goal { animation: ad-goal-in .52s cubic-bezier(.2,.7,.3,1.3) both, ad-goal-out .42s ease 2.28s forwards; }
        @keyframes ad-goal-ring { 0%{transform:scale(.55);opacity:.65} 100%{transform:scale(2);opacity:0} }
        .ad-goal-ring { animation: ad-goal-ring 1.15s ease-out .12s both; }
        @keyframes ad-confetti { 0% { opacity:1; transform:translate3d(0,0,0) rotate(0) } 100% { opacity:0; transform:translate3d(var(--tx),var(--ty),0) rotate(var(--rot)) } }
        @keyframes ad-flame-flicker { 0%,100% { transform:scale(1) translateY(0) } 50% { transform:scale(1.08) translateY(-.5px) } }
        @keyframes ad-flame-roar { 0%,100% { transform:scale(1.04) rotate(-2deg) } 50% { transform:scale(1.16) rotate(2deg) } }
        .ad-flame-flicker { animation: ad-flame-flicker 1.5s ease-in-out infinite; transform-origin:50% 80%; }
        .ad-flame-roar { animation: ad-flame-roar 1s ease-in-out infinite; transform-origin:50% 80%; }
        @keyframes ad-toast-in { from { opacity:0; transform:translateY(-16px) scale(.96) } to { opacity:1; transform:translateY(0) scale(1) } }
        @keyframes ad-toast-out { to { opacity:0; transform:translateY(-10px) } }
        .ad-toast { animation: ad-toast-in .36s cubic-bezier(.2,.7,.3,1.3) both, ad-toast-out .36s ease 1.85s forwards; }
        @keyframes ad-bloom { 0%{opacity:0;transform:scale(.55)} 22%{opacity:.5} 100%{opacity:0;transform:scale(1.35)} }
        .ad-bloom { position:absolute; inset:0; border-radius:20px; pointer-events:none; z-index:4; opacity:0; mix-blend-mode:screen; background:radial-gradient(circle at 50% 52%, rgba(74,222,128,.42), rgba(74,222,128,0) 70%); animation:ad-bloom .62s ease-out forwards; }
        @keyframes ad-answer-pop { 0%{opacity:0;transform:scale(.82)} 60%{opacity:1;transform:scale(1.04)} 100%{transform:scale(1)} }
        .ad-answer-pop { animation:ad-answer-pop .42s cubic-bezier(.2,.7,.3,1.3) both; }
        @keyframes ad-screen-in { from { opacity:0; transform:translateY(9px) } to { opacity:1; transform:translateY(0) } }
        .ad-screen-in { animation: ad-screen-in .28s cubic-bezier(.22,.61,.36,1) both; }
        @keyframes ad-tab-pop { 0%{transform:scale(1)} 40%{transform:scale(1.24)} 100%{transform:scale(1)} }
        .ad-tab-pop { animation: ad-tab-pop .34s cubic-bezier(.2,.7,.3,1.3); display:inline-flex; }
        @keyframes ad-pulse { 0%,100%{ transform:scale(1); opacity:.55 } 55%{ transform:scale(1.35); opacity:0 } }
        .ad-pulse { animation: ad-pulse 2.1s ease-out infinite; }
        @keyframes ad-bar-rise { from { transform:scaleY(0); opacity:.4 } to { transform:scaleY(1); opacity:1 } }
        .ad-bar-rise { animation: ad-bar-rise .5s cubic-bezier(.2,.8,.3,1) both; }
        @media (prefers-reduced-motion: reduce) {
          .ad-mastery-pop, .ad-mastery-burst, .ad-category-mastered, .ad-shake, .ad-pop, .ad-spark, .ad-screen, .ad-ringin, .ad-goal, .ad-goal-ring, .ad-toast, .ad-flame-flicker, .ad-flame-roar, .ad-bloom, .ad-answer-pop, .ad-screen-in, .ad-tab-pop, .ad-pulse, .ad-bar-rise { animation: none; }
          .ad-card-enter { transition: opacity .12s ease; }
          .ad-card-enter.is-out, .ad-card-enter.is-fly { transform: none; }
          .ad-spark { stroke-dashoffset: 0; }
        }
      `}</style>

      {/* Screen-reader announcement of answer feedback (visually hidden) */}
      <div aria-live="polite" style={{ position: "absolute", width: 1, height: 1, margin: -1, padding: 0, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0 }}>
        {feedback === "correct" ? "Richtig" : feedback === "wrong" ? "Falsch" : ""}
      </div>

      {/* ── MILESTONE TOAST (goal / streak / chapter) — a top, non-blocking slide-in so it
          celebrates without covering the card or interrupting a session. Big full-screen
          confetti is reserved for the rare rank-up. ── */}
      {celebration && (
        <div role="status" aria-label={celebration.tag} style={{ position: "fixed", top: "calc(env(safe-area-inset-top) + 70px)", left: "50%", transform: "translateX(-50%)", zIndex: 130, width: "calc(100% - 28px)", maxWidth: 420, pointerEvents: "none", display: "flex", justifyContent: "center" }}>
          <div className="ad-toast" style={{ display: "flex", alignItems: "center", gap: 12, background: "linear-gradient(135deg, #15170E 0%, #0F0F0F 72%)", border: `1px solid ${celebration.color}66`, borderRadius: 14, padding: "10px 16px 10px 11px", boxShadow: `0 16px 46px -12px ${celebration.color}55, 0 8px 24px rgba(0,0,0,.5)`, maxWidth: 380, minWidth: 0 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: `${celebration.color}1A`, border: `1px solid ${celebration.color}55`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: `0 0 18px -5px ${celebration.color}77` }}>
              <Icon name={celebration.icon} size={22} stroke={celebration.icon === "check" ? 3 : 2} style={{ color: celebration.color }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 9.5, color: celebration.color, fontWeight: 900, letterSpacing: 1.2, textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{celebration.tag}</div>
              <div style={{ fontFamily: FN, fontSize: 15, fontWeight: 800, color: T, lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{celebration.big}</div>
              {celebration.sub && <div style={{ fontSize: 10.5, color: TD, marginTop: 1, display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{celebration.subIcon && <Icon name={celebration.subIcon} size={12} style={{ color: A, flexShrink: 0 }} />}{celebration.sub}</div>}
            </div>
          </div>
        </div>
      )}

      {/* ── RANK-UP — the big moment when you complete a whole CEFR level. Full-screen so it
          lands as a real milestone, with the new level badge front and centre. ── */}
      {rankUp && (() => { const lc = LEVEL_COLOR[rankUp.to] || A; return (
        <div role="dialog" aria-modal="true" aria-label={`Reached ${LEVEL_TITLES[rankUp.to]}`} onClick={() => setRankUp(null)}
          style={{ position: "fixed", inset: 0, zIndex: 132, background: "rgba(0,0,0,0.93)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 30, textAlign: "center" }}>
          <Confetti count={54} top="16%" />
          <div className="ad-screen-in" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontSize: 11, color: lc, fontWeight: 900, letterSpacing: 4, textTransform: "uppercase", marginBottom: 20 }}>Level up</div>
            <div style={{ position: "relative", marginBottom: 24, width: 116, height: 116, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div className="ad-goal-ring" style={{ position: "absolute", inset: 0, borderRadius: 30, border: `2px solid ${lc}` }} />
              <div style={{ width: 116, height: 116, borderRadius: 30, background: `${lc}1A`, border: `2px solid ${lc}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 56px -8px ${lc}` }}>
                <span style={{ fontFamily: FN, fontSize: 46, fontWeight: 900, color: lc, lineHeight: 1 }}>{rankUp.to}</span>
              </div>
            </div>
            <div style={{ fontFamily: FN, fontSize: 28, fontWeight: 800, color: T, lineHeight: 1.12 }}>You've reached {LEVEL_TITLES[rankUp.to]}!</div>
            <div style={{ fontSize: 13.5, color: TD, marginTop: 11, maxWidth: 300, lineHeight: 1.5 }}>You've got every {rankUp.from} word solid. {rankUp.to === "B2" ? "That's the full B2 vocabulary within reach — keep mastering to lock it in. 🏁" : `On to ${LEVEL_TITLES[rankUp.to]} on the road to B2.`}</div>
          </div>
          <button type="button" onClick={() => setRankUp(null)} style={{ marginTop: 38, background: lc, color: "#0A0A0A", border: "none", borderRadius: 14, padding: "15px 46px", fontFamily: FN, fontSize: 16, fontWeight: 800, cursor: "pointer" }}>Weiter →</button>
        </div>
      ); })()}

      {/* ── MASTERY TOAST — slides down when a word is mastered (5 production in a row).
          Lighter than the centre celebrations because it can fire several times a session. ── */}
      {masteryBurst && <div style={{ position: "fixed", inset: 0, zIndex: 124, pointerEvents: "none" }}><Confetti count={30} top="5%" /></div>}
      {masteryBurst && (
        <div role="status" aria-label={`Mastered ${masteryBurst.de}`} style={{ position: "fixed", top: "calc(env(safe-area-inset-top) + 70px)", left: "50%", transform: "translateX(-50%)", zIndex: 125, width: "calc(100% - 32px)", maxWidth: 420, pointerEvents: "none", display: "flex", justifyContent: "center" }}>
          <div className="ad-toast" style={{ display: "flex", alignItems: "center", gap: 11, background: "linear-gradient(135deg, #0F1A11 0%, #0F0F0F 70%)", border: `1px solid ${G}66`, borderRadius: 14, padding: "10px 16px 10px 11px", boxShadow: `0 14px 44px -12px ${G}66, 0 8px 24px rgba(0,0,0,.5)`, maxWidth: 360, minWidth: 0 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: `${G}18`, border: `1px solid ${G}55`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon name="trophy" size={20} style={{ color: G }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 9.5, color: G, fontWeight: 900, letterSpacing: 1.4, textTransform: "uppercase" }}>Mastered · 5 in a row</div>
              <div style={{ fontFamily: FN, fontSize: 15, fontWeight: 800, color: T, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{masteryBurst.de}</div>
            </div>
          </div>
        </div>
      )}

      {/* Keyed on `screen` so every navigation gets a subtle slide-up entrance. */}
      <div key={screen} className="ad-screen">

      {/* ── FIRST-RUN ONBOARDING ── */}
      {showOnboarding && <div style={{ position: "fixed", inset: 0, zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.92)", padding: 22 }}>
        <div ref={modalRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Welcome to AutoDeutsch" style={{ outline: "none", background: SOFT_PANEL, border: `1px solid ${A}2E`, borderRadius: 18, padding: "26px 22px 22px", width: "100%", maxWidth: 390, maxHeight: "92vh", overflowY: "auto", boxShadow: "0 24px 80px rgba(0,0,0,0.45)" }}>
          <div style={{ height: 3, width: 74, background: FLAG, borderRadius: 2, marginBottom: 16 }} />
          {obStep === "intake" && (<>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <IconBadge name="map" size={38} />
              <div>
                <div style={{ fontSize: 10, color: TD, fontWeight: 800, letterSpacing: 2.4, textTransform: "uppercase" }}>Welcome</div>
                <h2 style={{ fontFamily: FN, fontSize: 22, margin: "2px 0 0", lineHeight: 1.05 }}>Let's set your journey</h2>
              </div>
            </div>
            <p style={{ color: TD, fontSize: 12, lineHeight: 1.55, margin: "0 0 16px" }}>A few quick questions, then a 2-minute placement to find your level. Saves locally; works offline after first launch.</p>
            {PLACEMENT.intake.map(q => (
              <div key={q.id} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: T, fontWeight: 700, marginBottom: 7 }}>{q.q}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {q.opts.map(o => {
                    const on = intakeAns[q.id] === o;
                    return <button key={o} type="button" onClick={() => setIntakeAns(a => ({ ...a, [q.id]: o }))} style={{ padding: "8px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer", background: on ? A : "#0D0D0D", color: on ? "#0A0A0A" : T, border: `1px solid ${on ? A : B}` }}>{o}</button>;
                  })}
                </div>
              </div>
            ))}
            <Btn bg={A} color="#0A0A0A" onClick={startPlacement} style={{ marginTop: 6, fontFamily: FN, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>Start placement <Icon name="arrowRight" size={17} /></Btn>
            <button type="button" onClick={() => completePlacement("A1", firstMissionFor("A1", intakeAns.goal).id)} style={{ marginTop: 12, width: "100%", background: "transparent", border: "none", color: TD, fontSize: 12, cursor: "pointer", padding: 8 }}>Skip — I'm a beginner</button>
          </>)}
          {obStep === "placement" && (() => {
            const it = plItems[plIdx]; if (!it) return null;
            return (<>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 10, color: TD, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase" }}>Placement</span>
                <span style={{ fontSize: 11, color: TD, fontWeight: 700 }}>{plIdx + 1} / {plItems.length}</span>
              </div>
              <ProgBar pct={(plIdx / Math.max(1, plItems.length)) * 100} color={A} />
              <div style={{ fontFamily: FN, fontSize: 19, fontWeight: 700, lineHeight: 1.3, margin: "16px 0" }}>{it.q}</div>
              <div style={{ display: "grid", gap: 8 }}>
                {it.opts.map((o, oi) => (
                  <button key={oi} type="button" onClick={() => answerPlacement(oi)} style={{ width: "100%", textAlign: "left", padding: "13px 15px", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer", background: "#0D0D0D", color: T, border: `1px solid ${B}`, fontFamily: "inherit" }}>{o}</button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: TD, textAlign: "center", marginTop: 14 }}>Just pick the best answer — no scoring shown until the end.</div>
            </>);
          })()}
          {obStep === "result" && (() => {
            const lvl = placeLevel(plScore);
            const fm = firstMissionFor(lvl, intakeAns.goal);
            const arc = MISSION_ARCS.find(a => a.id === fm.arc) || {};
            const TITLES = { A1: "Beginner", A2: "Elementary", B1: "Intermediate", B2: "Upper Intermediate" };
            const city = intakeAns.country && intakeAns.country !== "Not sure yet" ? intakeAns.country : "Germany";
            const goalTxt = intakeAns.goal ? intakeAns.goal.toLowerCase() : "getting settled";
            return (<>
              <div style={{ textAlign: "center" }}>
                <div style={{ width: 64, height: 64, borderRadius: 18, margin: "2px auto 12px", background: `${A}18`, border: `1.5px solid ${A}`, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontFamily: FN, fontSize: 24, fontWeight: 900, color: A }}>{lvl}</span></div>
                <div style={{ fontSize: 10, color: TD, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase" }}>You're starting at</div>
                <h2 style={{ fontFamily: FN, fontSize: 24, margin: "4px 0 0" }}>{TITLES[lvl]} · {lvl}</h2>
                <p style={{ color: TD, fontSize: 12.5, lineHeight: 1.55, margin: "10px 6px 18px" }}>Here's your path to {goalTxt} in {city}. Your first step:</p>
              </div>
              <button type="button" onClick={() => completePlacement(lvl, fm.id)} style={{ width: "100%", textAlign: "left", marginBottom: 12, background: "linear-gradient(100deg, #15140D 0%, #0E0E0E 70%)", border: `1px solid ${A}3D`, borderRadius: 14, padding: "13px 14px", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 12 }}>
                <IconBadge name={arc.icon || "map"} size={38} color={A} bg={`${A}12`} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 10, color: TD, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase" }}>First mission</span>
                  <span style={{ display: "block", fontSize: 14.5, fontWeight: 800, color: T }}>{fm.cando}</span>
                </span>
                <Icon name="arrowRight" size={17} style={{ color: A }} />
              </button>
              <Btn bg={A} color="#0A0A0A" onClick={() => completePlacement(lvl, fm.id)} style={{ fontFamily: FN, fontWeight: 900 }}>Start my journey</Btn>
              <button type="button" onClick={() => completePlacement(lvl, null)} style={{ marginTop: 12, width: "100%", background: "transparent", border: "none", color: TD, fontSize: 12, cursor: "pointer", padding: 8 }}>Start from home instead</button>
            </>);
          })()}
        </div>
      </div>}

      {/* Setup modal */}
      {showSetup && <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.88)", padding: 18 }} onClick={() => setShowSetup(false)}>
        <div ref={modalRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Session setup" onClick={e => e.stopPropagation()} style={{ outline: "none", background: S, border: `1px solid ${A}33`, borderRadius: 18, width: "100%", maxWidth: 382, maxHeight: "92vh", overflow: "hidden", boxShadow: `0 0 40px ${A}11`, display: "flex", flexDirection: "column" }}>
          <div style={{ height: 4, background: FLAG }} />
          <div style={{ padding: "18px 18px 10px" }}>
            <div style={{ fontSize: 10, color: RT, fontWeight: 800, letterSpacing: 3.2, textTransform: "uppercase", marginBottom: 6 }}>Setup</div>
            <h3 style={{ fontFamily: FN, fontSize: 20, margin: "0 0 4px", fontWeight: 800, lineHeight: 1.18 }}>{setupTitle}</h3>
            <div style={{ fontSize: 11, color: TD, minHeight: 15 }}>
              {setupIsGrammarDrill ? (setupMode === "article" ? "der · die · das — across every noun" : "Build the plural of any noun") : setupCat === "__imperativ__" ? "Imperativ" : setupCat === "__listening__" ? "Hör-Training" : setupMode === "production" ? "German recall and spelling" : "Choose the session shape"}
            </div>
            {setupIsLibrary && !setupIsGrammarDrill && (() => {
              const cs = getCatStats(setupCat);
              return cs.total > 0 && (
                <div style={{ display: "flex", gap: 14, marginTop: 9, paddingTop: 9, borderTop: `1px solid ${B}66` }}>
                  {[
                    { label: "Seen", value: cs.seen, color: T },
                    { label: "Production", value: cs.productionSeen, color: A },
                    { label: "Mastered ★", value: cs.mastered, color: G },
                  ].map(it => (
                    <div key={it.label} style={{ minWidth: 0 }}>
                      <span style={{ fontFamily: FN, fontSize: 15, color: it.color, fontWeight: 800 }}>{it.value}</span>
                      <span style={{ fontSize: 10, color: TD, fontWeight: 700 }}> / {cs.total}</span>
                      <div style={{ fontSize: 9, color: TD, fontWeight: 800, letterSpacing: 0.4, marginTop: 1 }}>{it.label}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          <div style={{ padding: "0 18px 14px", overflowY: "auto" }}>
            {/* Presets: three one-tap session shapes. The full configurator lives under Advanced
                so a session starts in one tap instead of after five separate choices. */}
            {setupIsLibrary && !setupIsGrammarDrill && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 8 }}>
                  {SESSION_PRESETS.map(p => {
                    const len = Math.min(p.len, maxC);
                    return (
                      <button key={p.key} onClick={() => { setSetupMode(p.mode); setSessDiff(p.diff); setSessLen(len); startSession(setupCat, p.mode, len, { diff: p.diff }); }}
                        style={{ display: "grid", justifyItems: "center", gap: 6, padding: "13px 6px 11px", borderRadius: 13, cursor: "pointer", fontFamily: "inherit", background: "linear-gradient(180deg, #15140D 0%, #0E0E0E 70%)", border: `1px solid ${A}3D` }}>
                        <IconBadge name={p.icon} size={30} color={A} bg={`${A}12`} />
                        <span style={{ fontSize: 12.5, fontWeight: 900, color: T }}>{p.label}</span>
                        <span style={{ fontSize: 9.5, fontWeight: 800, color: TD, letterSpacing: 0.2 }}>{p.tag} · {len}</span>
                      </button>
                    );
                  })}
                </div>
                <button onClick={() => setShowAdvanced(v => !v)} aria-expanded={showAdvanced}
                  style={{ width: "100%", marginTop: 10, background: "transparent", border: "none", color: TD, fontSize: 11.5, fontWeight: 800, letterSpacing: 0.3, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "6px 0" }}>
                  {showAdvanced ? "Hide options" : "Advanced options"} <Icon name="chevron" size={13} style={{ transform: showAdvanced ? "rotate(180deg)" : "none", transition: "transform .18s" }} />
                </button>
              </div>
            )}
            {setupIsLibrary && showAdvanced && (() => {
              // Two distinct things, no longer a flat list: "Review this topic" (vocab modes)
              // and "Grammar drills" (article/plural, scoped to THIS topic's nouns — the
              // category-specific complement to the all-topics Train tab).
              const gridStyle = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 4, padding: 4, background: "#0A0A0A", border: `1px solid ${B}`, borderRadius: 12 };
              const lbl = { fontSize: 11, color: TD, fontWeight: 800, letterSpacing: 0.8, marginBottom: 8 };
              const btn = ([m, label, sub]) => {
                const on = setupMode === m;
                return (
                  <button key={m} onClick={() => setSetupMode(m)} style={{ minWidth: 0, padding: "9px 8px", borderRadius: 9, border: "none", background: on ? A : "transparent", color: on ? "#0A0A0A" : T, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                    <span style={{ display: "block", fontSize: 12, fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
                    <span style={{ display: "block", marginTop: 2, fontSize: 9, color: on ? "#0A0A0A" : TD, fontWeight: 800, opacity: on ? 0.8 : 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</span>
                  </button>
                );
              };
              const drills = [
                ...(setupCanUseArticles ? [["article", "Articles", "der/die/das"]] : []),
                ...(setupCanUsePlural ? [["plural", "Plurals", "die … ?"]] : []),
              ];
              return (
                <div style={{ marginBottom: 16 }}>
                  <div style={lbl}>Review this topic</div>
                  <div style={gridStyle}>{[["vocab", "Recall", "DE → EN"], ["speaking", "Speaking", "EN → speak"], ["production", "Production", "EN → DE"], ["dictation", "Dictation", "Hear → type"], ["audio", "Audio", "Hands-free"]].map(btn)}</div>
                  {drills.length > 0 && (<>
                    <div style={{ ...lbl, marginTop: 14 }}>Grammar drills · this topic</div>
                    <div style={gridStyle}>{drills.map(btn)}</div>
                  </>)}
                </div>
              );
            })()}

            {setupMode === "audio" && setupIsLibrary && showAdvanced && (
              <>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: TD, fontWeight: 800, letterSpacing: 0.8, marginBottom: 8 }}>Order</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, padding: 4, background: "#0A0A0A", border: `1px solid ${B}`, borderRadius: 12 }}>
                    {[[false, "DE → EN"], [true, "EN → DE"]].map(([value, label]) => {
                      const on = audioEnFirst === value;
                      return <button key={label} onClick={() => setAudioEnFirst(value)} style={{ padding: "9px 10px", borderRadius: 9, border: "none", fontSize: 12, fontWeight: 900, cursor: "pointer", background: on ? A : "transparent", color: on ? "#0A0A0A" : TD }}>{label}</button>;
                    })}
                  </div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: TD, fontWeight: 800, letterSpacing: 0.8, marginBottom: 8 }}>Pause</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                    {[[2000, "2s"], [3500, "3.5s"], [5000, "5s"], [7000, "7s"]].map(([ms, l]) => (
                      <button key={ms} onClick={() => setAudioPauseLen(ms)} style={{ padding: "8px 0", borderRadius: 9, fontSize: 12, fontWeight: 800, cursor: "pointer", background: audioPauseLen === ms ? A : "#0A0A0A", color: audioPauseLen === ms ? "#0A0A0A" : TD, border: `1px solid ${audioPauseLen === ms ? A : B}` }}>{l}</button>
                    ))}
                  </div>
                </div>
                <button onClick={() => setAudioIncludeExample(x => !x)} style={{ width: "100%", padding: "11px 12px", borderRadius: 10, fontSize: 12, fontWeight: 800, cursor: "pointer", background: audioIncludeExample ? `${A}22` : "#0A0A0A", color: audioIncludeExample ? A : TD, border: `1px solid ${audioIncludeExample ? A : B}`, textAlign: "left", marginBottom: 14 }}>
                  Example sentence: {audioIncludeExample ? "On" : "Off"}
                </button>
              </>
            )}

            {setupCat === "__verb__" && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: TD, fontWeight: 800, letterSpacing: 0.8, marginBottom: 8 }}>Tense</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 4, padding: 4, background: "#0A0A0A", border: `1px solid ${B}`, borderRadius: 12 }}>
                  {[["present", "Präsens"], ["perfekt", "Perfekt"], ["praeteritum", "Präteritum"], ["konjunktiv1", "Konjunktiv I"], ["konjunktiv2", "Konjunktiv II"]].map(([t, l]) => (
                    <button key={t} onClick={() => setVerbTense(t)} style={{ minWidth: 0, padding: "9px 10px", borderRadius: 9, fontSize: 12, fontWeight: 900, cursor: "pointer", background: verbTense === t ? A : "transparent", color: verbTense === t ? "#0A0A0A" : TD, border: "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l}</button>
                  ))}
                </div>
                {verbTense === "konjunktiv1" && <div style={{ fontSize: 10.5, color: TD, marginTop: 6, lineHeight: 1.4 }}>Reported speech (indirekte Rede), 3rd person: „Er sagt, sie sei/habe/gehe…". Regular for all verbs except sein → sei.</div>}
                {verbTense === "konjunktiv2" && <div style={{ fontSize: 10.5, color: TD, marginTop: 6, lineHeight: 1.4 }}>Polite requests & hypotheticals: wäre, hätte, könnte… Typed — both the irregular form and „würde + Infinitiv" count where natural.</div>}
              </div>
            )}

            {setupCat === "__grammar__" && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: TD, fontWeight: 800, letterSpacing: 0.8, marginBottom: 8 }}>Focus</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 4, padding: 4, background: "#0A0A0A", border: `1px solid ${B}`, borderRadius: 12 }}>
                  {[["all", "Everything"], ["adjektiv", "Adjective endings"], ["praeteritum", "Präteritum"], ["konjunktiv", "Konjunktiv"], ["passiv", "Passiv"], ["partizip", "Partizipien"], ["relativ", "Relativsätze"], ["genitiv", "Genitiv"]].map(([k, l]) => (
                    <button key={k} onClick={() => setClozeTopic(k)} style={{ minWidth: 0, padding: "9px 6px", borderRadius: 9, fontSize: 11, fontWeight: 900, cursor: "pointer", background: clozeTopic === k ? A : "transparent", color: clozeTopic === k ? "#0A0A0A" : TD, border: "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l}</button>
                  ))}
                </div>
              </div>
            )}

            {(setupCat === "__sentence__" || setupCat === "__grammar__" || setupCat === "__listening__") && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: TD, fontWeight: 800, letterSpacing: 0.8, marginBottom: 8 }}>Difficulty</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 4, padding: 4, background: "#0A0A0A", border: `1px solid ${B}`, borderRadius: 12 }}>
                  {[["all", "Mixed"], ["easy", "Easy"], ["core", "Core"], ["hard", "Hard"]].map(([k, l]) => (
                    <button key={k} onClick={() => setDiffBand(k)} style={{ minWidth: 0, padding: "9px 6px", borderRadius: 9, fontSize: 11, fontWeight: 900, cursor: "pointer", background: diffBand === k ? A : "transparent", color: diffBand === k ? "#0A0A0A" : TD, border: "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l}</button>
                  ))}
                </div>
                <div style={{ fontSize: 10.5, color: TD, marginTop: 6, lineHeight: 1.4 }}>
                  {diffBand === "easy" ? "A1–A2 · simple & short" : diffBand === "core" ? "B1 · everyday complexity" : diffBand === "hard" ? "B2 · complex & demanding" : "All levels mixed together"}
                </div>
              </div>
            )}

            {setupCat === "__imperativ__" && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: TD, fontWeight: 800, letterSpacing: 0.8, marginBottom: 8 }}>Persons</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                  {[["du", "du"], ["ihr", "ihr"], ["sie", "Sie"]].map(([k, l]) => {
                    const on = impPersons[k];
                    const anyOthers = Object.entries(impPersons).some(([kk, v]) => kk !== k && v);
                    return (
                      <button key={k} onClick={() => {
                        if (on && !anyOthers) return;
                        setImpPersons(p => ({ ...p, [k]: !p[k] }));
                      }} style={{ padding: "10px 0", borderRadius: 10, fontSize: 12, fontWeight: 900, cursor: "pointer", background: on ? A : "#0A0A0A", color: on ? "#0A0A0A" : TD, border: `1px solid ${on ? A : B}` }}>{l}</button>
                    );
                  })}
                </div>
              </div>
            )}

            {(((setupMode === "audio" || setupMode === "dictation") && setupIsLibrary && showAdvanced) || setupCat === "__listening__") && deVoices.length > 1 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: TD, fontWeight: 800, letterSpacing: 0.8, marginBottom: 8 }}>German voice</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {[["", "Auto"], ...deVoices.map(v => [v.name, v.name.replace(/\s*\([^)]*\)/g, "").trim()])].map(([val, label]) => (
                    <button key={val || "auto"} onClick={() => { setVoiceName(val); setTtsVoice(val); if (val) speakWith("Guten Tag! Schön, dich zu sehen."); }} style={{ padding: "8px 12px", borderRadius: 9, fontSize: 11, fontWeight: 900, cursor: "pointer", background: voiceName === val ? A : "#0A0A0A", color: voiceName === val ? "#0A0A0A" : TD, border: `1px solid ${voiceName === val ? A : B}`, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</button>
                  ))}
                </div>
                <div style={{ fontSize: 10.5, color: TD, marginTop: 6 }}>Tap a voice to hear a preview — used everywhere the app speaks.</div>
              </div>
            )}

            {setupCat === "__listening__" && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: TD, fontWeight: 800, letterSpacing: 0.8, marginBottom: 8 }}>Mode</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {[["listen", "Full Dialogue", "Listen through"], ["questions", "With Questions", "Comprehension"]].map(([m, l, de]) => (
                    <button key={m} onClick={() => setListenMode(m)} style={{ padding: "10px 10px", borderRadius: 10, fontSize: 12, fontWeight: 900, cursor: "pointer", background: listenMode === m ? A : "#0A0A0A", color: listenMode === m ? "#0A0A0A" : TD, border: `1px solid ${listenMode === m ? A : B}`, textAlign: "left", lineHeight: 1.2 }}>
                      <span style={{ display: "block" }}>{l}</span>
                      <span style={{ display: "block", fontSize: 9, opacity: 0.75, fontWeight: 800, marginTop: 3 }}>{de}</span>
                    </button>
                  ))}
                </div>
                {listenMode === "questions" && <p style={{ fontSize: 10, color: TD, marginTop: 8, lineHeight: 1.4 }}>Only dialogues with questions will be included ({DIALOGUES.filter(d => d.questions).length} available).</p>}
              </div>
            )}

            {setupIsLibrary && showAdvanced && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: TD, fontWeight: 800, letterSpacing: 0.8, marginBottom: 8 }}>Difficulty</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4, padding: 4, background: "#0A0A0A", border: `1px solid ${B}`, borderRadius: 12 }}>
                  {[["mixed", "Mixed"], ["easy", "Easy"], ["hard", "Hard"]].map(([k, l]) => (
                    <button key={k} onClick={() => setSessDiff(k)} style={{ padding: "9px 6px", borderRadius: 9, fontSize: 12, fontWeight: 900, cursor: "pointer", background: sessDiff === k ? A : "transparent", color: sessDiff === k ? "#0A0A0A" : TD, border: "none" }}>{l}</button>
                  ))}
                </div>
              </div>
            )}

            {setupIsLibrary && showAdvanced && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: TD, fontWeight: 800, letterSpacing: 0.8, marginBottom: 8 }}>Level</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 4, padding: 4, background: "#0A0A0A", border: `1px solid ${B}`, borderRadius: 12 }}>
                  {[["auto", "Auto"], ["all", "All"], ...LEVELS.map(l => [l, l])].map(([k, l]) => (
                    <button key={k} onClick={() => setSessLevel(k)} style={{ padding: "9px 3px", borderRadius: 9, fontSize: 11.5, fontWeight: 900, cursor: "pointer", background: setupLevel === k ? A : "transparent", color: setupLevel === k ? "#0A0A0A" : TD, border: "none" }}>{l}</button>
                  ))}
                </div>
                {setupLevel === "auto" && <div style={{ fontSize: 10.5, color: TD, marginTop: 6 }}>Following your level — currently <span style={{ color: A, fontWeight: 800 }}>{deepStats.currentLevel}</span></div>}
              </div>
            )}

            {(!setupIsLibrary || showAdvanced || setupIsGrammarDrill) && (<>
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
                <div style={{ fontSize: 11, color: TD, fontWeight: 800, letterSpacing: 0.8 }}>Cards</div>
                <div style={{ fontFamily: FN, fontSize: 26, color: A, fontWeight: 900 }}>{sessLen}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "42px 1fr 42px", gap: 8, alignItems: "center", marginBottom: 10 }}>
                <button aria-label="Decrease cards" onClick={() => stepSessionLength(-5)} disabled={sessLen <= setupMinC} style={{ height: 42, borderRadius: 10, background: "#0A0A0A", color: sessLen <= setupMinC ? B : T, border: `1px solid ${B}`, fontSize: 20, fontWeight: 900, cursor: sessLen <= setupMinC ? "default" : "pointer" }}>-</button>
                <div style={{ height: 42, borderRadius: 10, background: "#0A0A0A", border: `1px solid ${B}`, display: "flex", alignItems: "center", justifyContent: "center", color: TD, fontSize: 11, fontWeight: 800 }}>{setupMinC} to {maxC}</div>
                <button aria-label="Increase cards" onClick={() => stepSessionLength(5)} disabled={sessLen >= maxC} style={{ height: 42, borderRadius: 10, background: "#0A0A0A", color: sessLen >= maxC ? B : T, border: `1px solid ${B}`, fontSize: 20, fontWeight: 900, cursor: sessLen >= maxC ? "default" : "pointer" }}>+</button>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[5, 10, 15, 20, 25, 50].filter((n, i, a) => n <= maxC && a.indexOf(n) === i).map(n => (
                  <button key={n} onClick={() => setSessLen(n)} style={{ padding: "6px 11px", borderRadius: 999, fontSize: 12, fontWeight: 800, cursor: "pointer", background: sessLen === n ? A : "#0A0A0A", color: sessLen === n ? "#0A0A0A" : TD, border: `1px solid ${sessLen === n ? A : B}` }}>{n}</button>
                ))}
                {maxC <= 50 && sessLen !== maxC && (
                  <button onClick={() => setSessLen(maxC)} style={{ padding: "6px 11px", borderRadius: 999, fontSize: 12, fontWeight: 800, cursor: "pointer", background: "#0A0A0A", color: TD, border: `1px solid ${B}` }}>All {maxC}</button>
                )}
              </div>
            </div>
            {sessLen > 40 && <p style={{ fontSize: 11, color: A, margin: "0 0 12px", lineHeight: 1.5, padding: "8px 12px", background: "#0A0A0A66", borderRadius: 8, borderLeft: `3px solid ${A}` }}>Long session. Shorter repeated sessions build habit faster than one marathon.</p>}
            </>)}
          </div>

          {(!setupIsLibrary || showAdvanced || setupIsGrammarDrill) && <div style={{ padding: "12px 18px max(18px, env(safe-area-inset-bottom))", borderTop: `1px solid ${B}`, background: S, boxShadow: "0 -14px 22px rgba(0,0,0,0.28)" }}>
            <div style={{ fontSize: 10, color: TD, marginBottom: 10, textAlign: "center" }}>Failed cards repeat until cleared.</div>
            <Btn bg={A} color="#0A0A0A" onClick={() => { const m = setupCat === "__grammar__" ? "cloze" : setupCat === "__verb__" ? "verb" : setupCat === "__sentence__" ? "sentence" : setupCat === "__imperativ__" ? "imperativ" : setupCat === "__listening__" ? "listening" : setupCat === "__confusion__" ? "confusion" : setupCat === "__exam__" ? "exam" : setupMode; startSession(setupCat, m, sessLen); }} style={{ fontFamily: FN, fontSize: 16 }}>Start session</Btn>
          </div>}
        </div>
      </div>}
      {/* ── SETTINGS MODAL ── */}
      {showSettings && <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.88)", padding: 24 }} onClick={() => setShowSettings(false)}>
        <div ref={modalRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Settings" onClick={e => e.stopPropagation()} style={{ outline: "none", background: S, border: `1px solid ${A}33`, borderRadius: 20, padding: "28px 24px", width: "100%", maxWidth: 360, maxHeight: "90vh", overflowY: "auto", boxShadow: `0 0 40px ${A}11` }}>
          <div style={{ height: 3, width: 72, background: FLAG, borderRadius: 2, marginBottom: 16 }} />
          <div style={{ fontSize: 10, color: RT, fontWeight: 800, letterSpacing: 4, textTransform: "uppercase", marginBottom: 6 }}>Settings</div>

          <h3 style={{ fontFamily: FN, fontSize: 16, margin: "0 0 10px", fontWeight: 700 }}>Offline & Storage</h3>
          <div style={{ marginBottom: 20, display: "grid", gap: 8 }}>
            {[
              { label: offlineReady ? "Offline ready" : "Cache pending", value: offlineReady ? "App shell cached" : "Open once online to cache", icon: offlineReady ? "shield" : "wifi", color: offlineReady ? G : A },
              { label: storageOK ? "Saving locally" : "Storage blocked", value: storageOK ? saveStatus : "Progress will not persist", icon: storageOK ? "save" : "shield", color: storageOK ? G : R },
              { label: online ? "Online" : "Offline", value: online ? "Updates can be checked" : "Practice still works from cache", icon: "wifi", color: online ? BL : A },
            ].map(item => (
              <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#0A0A0A66", border: `1px solid ${B}`, borderRadius: 10 }}>
                <IconBadge name={item.icon} size={30} color={item.color} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: T, fontSize: 12, fontWeight: 800 }}>{item.label}</div>
                  <div style={{ color: TD, fontSize: 11, marginTop: 1 }}>{item.value}</div>
                </div>
              </div>
            ))}
          </div>

          <h3 style={{ fontFamily: FN, fontSize: 16, margin: "0 0 10px", fontWeight: 700 }}>Practice</h3>
          <div style={{ marginBottom: 20 }}>
            <button onClick={toggleAutoAdvance} style={{ width: "100%", padding: "11px 12px", borderRadius: 10, fontSize: 12, fontWeight: 800, cursor: "pointer", background: autoAdvance ? `${A}22` : "#0A0A0A", color: autoAdvance ? A : TD, border: `1px solid ${autoAdvance ? A : B}`, textAlign: "left", fontFamily: "inherit" }}>
              Auto-advance on correct: {autoAdvance ? "On" : "Off"}
            </button>
            <div style={{ fontSize: 11, color: TD, marginTop: 6, lineHeight: 1.45 }}>Correct answers move on by themselves after a second. Wrong or near-miss answers always stop for review.</div>
            <button onClick={toggleSfx} style={{ width: "100%", marginTop: 10, padding: "11px 12px", borderRadius: 10, fontSize: 12, fontWeight: 800, cursor: "pointer", background: sfxOn ? `${A}22` : "#0A0A0A", color: sfxOn ? A : TD, border: `1px solid ${sfxOn ? A : B}`, textAlign: "left", fontFamily: "inherit" }}>
              Sound effects: {sfxOn ? "On" : "Off"}
            </button>
            <div style={{ fontSize: 11, color: TD, marginTop: 6, lineHeight: 1.45 }}>Subtle cues on correct, wrong, and session-complete. Spoken German pronunciation is always on.</div>
          </div>

          <h3 style={{ fontFamily: FN, fontSize: 16, margin: "0 0 10px", fontWeight: 700 }}>Your Journey</h3>
          <div style={{ marginBottom: 20 }}>
            <button type="button" onClick={openPlacement} style={{ width: "100%", padding: "11px 12px", borderRadius: 10, fontSize: 12, fontWeight: 800, cursor: "pointer", background: "#0A0A0A", color: A, border: `1px solid ${A}44`, textAlign: "left", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="map" size={15} /> Placement test
            </button>
            <div style={{ fontSize: 11, color: TD, marginTop: 6, lineHeight: 1.45 }}>Retake the 2-minute placement to re-estimate your starting level. It only adjusts which level your sessions target — your progress is kept.</div>
          </div>

          {/* Daily goal — cards-per-day target shown on home's streak row */}
          <h3 style={{ fontFamily: FN, fontSize: 16, margin: "0 0 10px", fontWeight: 700 }}>Daily Goal</h3>
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: TD }}>Cards per day</span>
              <span style={{ fontFamily: FN, fontSize: 28, color: A }}>{dailyGoal}</span>
            </div>
            <input type="range" aria-label="Cards per day" min={10} max={200} step={1} value={dailyGoal} onChange={e => updateDailyGoal(Number(e.target.value))}
              style={{ width: "100%", height: 6, appearance: "none", background: B, borderRadius: 3, outline: "none", cursor: "pointer", accentColor: A }} />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
              {[10, 20, 30, 50, 100, 200].map(n => (
                <button key={n} onClick={() => updateDailyGoal(n)} style={{ padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", background: dailyGoal === n ? A : "transparent", color: dailyGoal === n ? "#0A0A0A" : TD, border: `1px solid ${dailyGoal === n ? A : B}` }}>{n}</button>
              ))}
            </div>
            {dailyGoal > 60 && <p style={{ fontSize: 11, color: A, marginTop: 12, lineHeight: 1.5, padding: "8px 12px", background: "#0A0A0A66", borderRadius: 8, borderLeft: `3px solid ${A}` }}>Ambitious goal. Consistency beats intensity — missing a big target often hurts streak motivation more than a smaller goal would.</p>}
          </div>

          {/* Daily reminder — opt-in local notification to defend the streak */}
          <h3 style={{ fontFamily: FN, fontSize: 16, margin: "0 0 10px", fontWeight: 700 }}>Daily Reminder</h3>
          <div style={{ marginBottom: 20 }}>
            <button onClick={toggleReminder} style={{ width: "100%", padding: "11px 12px", borderRadius: 10, fontSize: 12, fontWeight: 800, cursor: "pointer", background: reminderOn ? `${A}22` : "#0A0A0A", color: reminderOn ? A : TD, border: `1px solid ${reminderOn ? A : B}`, textAlign: "left", fontFamily: "inherit" }}>
              Daily reminder: {reminderOn ? "On" : "Off"}
            </button>
            {reminderOn && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, padding: "10px 12px", background: "#0A0A0A66", border: `1px solid ${B}`, borderRadius: 10 }}>
                <span style={{ fontSize: 12, color: T, fontWeight: 800 }}>Remind me at</span>
                <input type="time" aria-label="Reminder time" value={reminderTime} onChange={e => updateReminderTime(e.target.value)}
                  style={{ background: SH, color: T, border: `1px solid ${B}`, borderRadius: 8, padding: "6px 10px", fontSize: 14, fontFamily: BD, outline: "none", colorScheme: "dark" }} />
              </div>
            )}
            <div style={{ fontSize: 11, color: notifPerm === "denied" ? R : TD, marginTop: 6, lineHeight: 1.45 }}>
              {notifPerm === "denied"
                ? "Notifications are blocked for this site — turn them on in your browser settings to use reminders."
                : notifPerm === "unsupported"
                ? "This browser doesn't support notifications."
                : "A gentle nudge to keep your streak alive — skipped on days you've already hit your goal. Works best with the app installed; on iOS it may only remind while the app has been opened recently."}
            </div>
          </div>

          <h3 style={{ fontFamily: FN, fontSize: 16, margin: "0 0 10px", fontWeight: 700 }}>AI Tutor</h3>
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, color: TD, marginBottom: 8, lineHeight: 1.5 }}>
              Chat with a German tutor powered by your own Anthropic API key. The key is stored only on this device and messages go straight to Anthropic — you pay your own usage (a typical chat is a fraction of a cent). Get a key at <span style={{ color: A }}>console.anthropic.com</span>.
            </div>
            <input type="password" value={aiKey} onChange={e => saveAiKey(e.target.value.trim())} placeholder="sk-ant-…" autoCapitalize="off" autoCorrect="off" spellCheck="false"
              className="ad-input" style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 12, border: `1px solid ${B}`, background: SH, color: T, fontSize: 14, fontFamily: "monospace", outline: "none", marginBottom: 8 }} />
            <select aria-label="Tutor model" value={aiModel} onChange={e => saveAiModel(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", background: "#0F0F0F", color: T, border: `1px solid ${HAIR}`, borderRadius: 10, padding: "10px 12px", fontSize: 12, fontFamily: BD, outline: "none" }}>
              {AI_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
            <div style={{ fontSize: 11, color: aiKey ? G : TD, marginTop: 8, fontWeight: 700 }}>{aiKey ? "✓ Key saved on this device" : "No key yet — the Tutor is locked until you add one."}</div>
          </div>

          <h3 style={{ fontFamily: FN, fontSize: 16, margin: "0 0 10px", fontWeight: 700 }}>App Updates</h3>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: TD, marginBottom: 6 }}>Current build: <span style={{ color: A, fontFamily: "monospace" }}>{APP_VERSION}</span></div>
            <Btn bg={SH} border={`1px solid ${A}44`} color={A} onClick={async () => {
              const reg = window.__SW_REG__;
              if (!reg) { setUpdateCheckMsg("Service worker not registered yet."); return; }
              setUpdateCheckMsg("Checking…");
              try {
                await reg.update();
                // Give the browser a moment to install the new worker if there is one
                setTimeout(() => {
                  if (window.__SW_WAITING__) setUpdateCheckMsg("✓ Update available — tap the banner on home.");
                  else setUpdateCheckMsg("You're on the latest version.");
                }, 1500);
              } catch (e) {
                setUpdateCheckMsg("Check failed: " + (e.message || "network error"));
              }
            }} style={{ fontFamily: FN, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Icon name="refresh" size={16} /> Check for updates</Btn>
            {updateCheckMsg && (
              <div style={{ fontSize: 11, color: updateCheckMsg.startsWith("✓") ? G : updateCheckMsg.startsWith("Check failed") ? R : TD, marginTop: 8, padding: "8px 12px", background: "#0A0A0A66", borderRadius: 8 }}>{updateCheckMsg}</div>
            )}
          </div>

          <h3 style={{ fontFamily: FN, fontSize: 16, margin: "0 0 10px", fontWeight: 700 }}>Backup & Restore</h3>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: TD, marginBottom: 6 }}>Export your progress to a file you can save anywhere (iCloud, email, etc.).</div>
            <Btn bg={SH} border={`1px solid ${A}44`} color={A} onClick={exportData} style={{ fontFamily: FN, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Icon name="download" size={16} /> Export progress</Btn>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: TD, marginBottom: 6 }}>Restore from a previously exported file. Merges with current progress (keeps whichever entry has more attempts).</div>
            <label style={{ display: "flex", padding: "14px 16px", borderRadius: 14, border: `1px solid ${B}`, background: SH, color: T, fontSize: 14, fontWeight: 700, textAlign: "center", cursor: "pointer", fontFamily: FN, alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Icon name="upload" size={16} /> Import progress
              <input type="file" accept="application/json,.json" onChange={e => { const f = e.target.files?.[0]; if (f) importData(f); e.target.value = ""; }} style={{ display: "none" }} />
            </label>
          </div>

          {importError && (
            <div style={{ fontSize: 11, color: importError.startsWith("✓") ? G : R, marginBottom: 14, padding: "8px 12px", background: importError.startsWith("✓") ? "#0A1A0A" : "#1A0000", borderRadius: 8, borderLeft: `3px solid ${importError.startsWith("✓") ? G : R}` }}>{importError}</div>
          )}

          <div style={{ marginTop: 18, padding: "10px 12px", background: "#0A0A0A66", borderRadius: 8, fontSize: 11, color: TD, lineHeight: 1.5, borderLeft: `3px solid ${BL}` }}>
            <strong style={{ color: T }}>Current state</strong><br />
            {Object.keys(prog).length} entries · {totalL} mastered · {dailyStats.streak}-day streak
          </div>

          <Btn bg={SH} border={`1px solid ${B}`} onClick={() => setShowSettings(false)} style={{ marginTop: 18, fontSize: 14 }}>Close</Btn>
        </div>
      </div>}

      {/* ── HOME ── */}
      {screen === "home" && <div className="ad-screen-in" style={{ padding: "max(12px, env(safe-area-inset-top)) 20px max(56px, calc(env(safe-area-inset-bottom) + 36px))" }}>
        {/* Streak Freeze used — reassure the user their streak survived a missed day */}
        {freezeNotice && (
          <button onClick={() => setFreezeNotice(null)}
            style={{ width: "100%", background: "linear-gradient(135deg, #0E1626 0%, #0F0F0F 65%)", color: T, border: `1px solid ${BL}55`, borderRadius: 12, padding: "11px 14px", marginBottom: 14, fontSize: 12, lineHeight: 1.4, cursor: "pointer", textAlign: "left", fontFamily: "inherit", fontWeight: 700, display: "flex", alignItems: "center", gap: 10 }}>
            <Icon name="flake" size={20} style={{ color: BL, flexShrink: 0 }} />
            <span style={{ flex: 1 }}><strong style={{ color: BL }}>Streak Freeze used</strong><br /><span style={{ fontWeight: 500, fontSize: 11, color: TD }}>A missed day was absorbed — your {freezeNotice.streak}-day streak is safe.</span></span>
            <Icon name="check" size={16} style={{ color: BL }} />
          </button>
        )}
        {/* Update available — appears when a new SW version is installed and waiting */}
        {updateAvailable && (
          <button onClick={applyUpdate}
            style={{ width: "100%", background: A, color: "#0A0A0A", border: "none", borderRadius: 12, padding: "10px 14px", marginBottom: 14, fontSize: 12, lineHeight: 1.4, cursor: "pointer", textAlign: "left", fontFamily: "inherit", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}><Icon name="refresh" size={18} /><span><strong>Update available</strong><br /><span style={{ fontWeight: 500, fontSize: 11, opacity: 0.8 }}>Tap to reload with the new version</span></span></span>
            <Icon name="arrowRight" size={17} />
          </button>
        )}

        {/* Storage warning — only shown if localStorage is not writable */}
        {!storageOK && (
          <div style={{ background: "#1A0000", border: `1px solid ${R}55`, borderRadius: 12, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: RT, lineHeight: 1.4 }}>
            <strong>Progress won't save</strong><br />
            <span style={{ color: T, fontWeight: 400, fontSize: 11 }}>Private browsing is on, or storage is full. Nothing you do this session will be remembered.</span>
          </div>
        )}

        {/* Hero */}
        <div style={{ background: HERO_GRAD, border: "1px solid rgba(255,204,0,0.14)", borderRadius: 20, padding: "26px 22px 24px", marginBottom: 18, position: "relative", overflow: "hidden", boxShadow: "0 16px 50px -16px rgba(255,200,40,0.22), 0 10px 30px -16px rgba(0,0,0,0.8)" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: FLAG }} />
          <button onClick={() => { setShowSettings(true); setImportError(""); setUpdateCheckMsg(""); }} aria-label="Settings"
            style={{ position: "absolute", top: 10, right: 10, background: "#0A0A0A66", border: `1px solid ${B}`, borderRadius: 9, color: TD, cursor: "pointer", padding: 7, lineHeight: 1 }}><Icon name="settings" size={16} /></button>
          <div style={{ fontSize: 10, color: A, fontWeight: 800, letterSpacing: 2.5, marginBottom: 8, textTransform: "uppercase" }}>{(() => { const h = new Date().getHours(); return h < 5 ? "Gute Nacht" : h < 11 ? "Guten Morgen" : h < 18 ? "Guten Tag" : "Guten Abend"; })()}</div>
          <h1 style={{ fontFamily: FN, fontSize: 40, margin: "0 0 8px", fontWeight: 800, lineHeight: 1, color: T, display: "flex", alignItems: "center", letterSpacing: -0.5 }}>
            <img src="icons/icon-192x192.png" alt="" style={{ width: 50, height: 50, mixBlendMode: "screen", marginLeft: -11, marginRight: -9, marginTop: -2 }} />
            <span>utodeutsch</span>
          </h1>
          <p style={{ color: TD, fontSize: 13, margin: "0" }}>{totalW.toLocaleString()} words · <span style={{ color: G, fontWeight: 700 }}>{deepStats.journeyStrong.toLocaleString()} learned</span>{totalL > 0 && <span style={{ color: TD }}> · {totalL.toLocaleString()} ★</span>}</p>
        </div>

        {/* Journey rank — your current CEFR level + progress toward the next, surfaced as a
            tappable identity (matches the Stats roadmap). Novice sees a clear rank + climb. */}
        {(() => {
          const LC = { A1: G, A2: BL, B1: A, B2: R };
          const TITLES = { A1: "Beginner", A2: "Elementary", B1: "Intermediate", B2: "Upper Intermediate" };
          const curIdx = LEVELS.findIndex(l => deepStats.levels[l].strong < deepStats.levels[l].total);
          const cl = curIdx === -1 ? LEVELS[LEVELS.length - 1] : LEVELS[curIdx];
          const CL = deepStats.levels[cl];
          const clPct = CL.total ? (CL.strong / CL.total) * 100 : 0;
          const clSeenPct = CL.total ? (CL.seen / CL.total) * 100 : 0;
          return (
            <button type="button" onClick={() => setScreen("stats")} aria-label={`Level ${cl} ${TITLES[cl]} — open your journey`}
              style={{ width: "100%", marginTop: 14, marginBottom: 4, background: "linear-gradient(100deg, #131313 0%, #0E0E0E 70%)", border: `1px solid ${HAIR}`, borderRadius: 13, padding: "11px 13px 12px", cursor: "pointer", fontFamily: "inherit", display: "block", textAlign: "left" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ width: 28, height: 28, borderRadius: 9, background: `${LC[cl]}1A`, border: `1px solid ${LC[cl]}`, display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: FN, fontSize: 12, fontWeight: 900, color: LC[cl], flexShrink: 0 }}>{cl}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 800, color: T }}>{TITLES[cl]}<span style={{ color: TD, fontWeight: 600, fontSize: 11 }}> · {curIdx === -1 ? "journey to B2" : `Chapter ${deepStats.currentChapter} of ${CHAPTERS}`}</span></span>
                <span style={{ fontSize: 12, color: G, fontWeight: 800, flexShrink: 0 }}>{Math.round(clPct)}%</span>
                <Icon name="chevron" size={14} style={{ color: TD, transform: "rotate(-90deg)" }} />
              </div>
              {curIdx === -1 ? (
                <div style={{ height: 6, background: "#0A0A0A", borderRadius: 3, overflow: "hidden", position: "relative" }}>
                  <div style={{ position: "absolute", inset: 0, width: `${clPct}%`, background: G, borderRadius: 3 }} />
                </div>
              ) : (
                <div style={{ display: "flex", gap: 3 }}>
                  {[1, 2, 3, 4, 5].map(n => {
                    const done = n <= CL.chaptersDone;
                    const current = n === CL.chaptersDone + 1;
                    const within = current && CL.chapterSize ? Math.max(0, Math.min(1, (CL.strong - CL.chaptersDone * CL.chapterSize) / CL.chapterSize)) : 0;
                    return (
                      <div key={n} style={{ flex: 1, height: 6, background: "#0A0A0A", borderRadius: 3, overflow: "hidden", position: "relative", boxShadow: current ? `0 0 0 1px ${LC[cl]}66` : "none" }}>
                        <div style={{ position: "absolute", inset: 0, width: done ? "100%" : `${within * 100}%`, background: done ? G : LC[cl], borderRadius: 3, transition: "width .5s" }} />
                      </div>
                    );
                  })}
                </div>
              )}
            </button>
          );
        })()}

        {currentMission && (() => {
          const m = currentMission;
          const arc = MISSION_ARCS.find(a => a.id === m.arc);
          const STEP_LABELS = { learned: "Learn the words", listened: "Listen to the scene", spoke: "Say it out loud" };
          const nextStep = ["learned", "listened", "spoke"].find(s => !missionStepDone(m.id, s)) || "learned";
          return (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "2px 2px 10px" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 800, color: A, letterSpacing: 0.6, textTransform: "uppercase" }}><Icon name={capability.role.icon} size={12} style={{ color: A }} /> {capability.role.name}</span>
                <button type="button" onClick={() => setScreen("scenarios")} style={{ background: "transparent", border: "none", color: A, fontSize: 11, fontWeight: 800, cursor: "pointer", padding: 0 }}>All scenarios →</button>
              </div>
              <button type="button" onClick={() => openMission(m.id)} style={{ width: "100%", textAlign: "left", marginBottom: 20, background: "linear-gradient(100deg, #15140D 0%, #0E0E0E 70%)", border: `1px solid ${A}3D`, borderRadius: 16, padding: "14px 15px", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 13 }}>
                <IconBadge name={arc ? arc.icon : "map"} size={40} color={A} bg={`${A}12`} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 10, color: TD, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase" }}>{arc ? arc.title : "Your mission"} · {m.level}</span>
                  <span style={{ display: "block", fontSize: 15, fontWeight: 800, color: T, lineHeight: 1.2 }}>{m.cando}</span>
                  <span style={{ display: "block", fontSize: 11, color: A, fontWeight: 700, marginTop: 3 }}>Next: {STEP_LABELS[nextStep]} →</span>
                </span>
                <Icon name="chevron" size={16} style={{ color: TD, transform: "rotate(-90deg)" }} />
              </button>
            </>
          );
        })()}

        {SectionHead({ title: "Today", style: { margin: "2px 0 10px" } })}
        {/* Today panel: goal ring + streak + last-7-days activity */}
        <div style={{ background: PANEL_GRAD, border: `1px solid ${HAIR}`, borderRadius: 18, padding: "16px 18px 13px", marginBottom: 20, position: "relative", overflow: "hidden", boxShadow: ELEV }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: FLAG, opacity: 0.85 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 18, paddingTop: 4 }}>
            {(() => {
              const R0 = 34, C0 = 2 * Math.PI * R0;
              const goalDone = dailyStats.count >= dailyGoal;
              return (
                <div role="img" aria-label={`${dailyStats.count} of ${dailyGoal} cards today`} style={{ position: "relative", width: 84, height: 84, flexShrink: 0 }}>
                  <svg width="84" height="84" viewBox="0 0 84 84">
                    <circle cx="42" cy="42" r={R0} fill="none" stroke="#1D1D1D" strokeWidth="7" />
                    <circle cx="42" cy="42" r={R0} fill="none" stroke={goalDone ? G : A} strokeWidth="7" strokeLinecap="round"
                      strokeDasharray={C0} strokeDashoffset={C0 * (1 - dailyGoalPct)}
                      transform="rotate(-90 42 42)" style={{ transition: "stroke-dashoffset .5s ease, stroke .3s ease" }} />
                  </svg>
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ fontFamily: FN, fontSize: 22, fontWeight: 800, color: goalDone ? G : T, lineHeight: 1 }}><CountUp value={dailyStats.count} /></div>
                    <div style={{ fontSize: 9, color: TD, fontWeight: 700, marginTop: 2 }}>/ {dailyGoal}</div>
                  </div>
                </div>
              );
            })()}
            <div style={{ flex: 1, minWidth: 0 }}>
              {(dailyStats.count === 0 && dailyStats.streak === 0 && trend30.totalAttempts === 0) ? (
                // Warm first-run welcome instead of an empty 0/0 dashboard.
                <>
                  <div style={{ fontFamily: FN, fontSize: 16, fontWeight: 800, color: T, lineHeight: 1.15 }}>Willkommen — let's begin</div>
                  <div style={{ fontSize: 12, color: TD, marginTop: 7, lineHeight: 1.45 }}>Finish today's first cards to light your <span style={{ color: A, fontWeight: 700 }}>streak</span> <Icon name="flame" size={12} style={{ color: A, verticalAlign: "-1px" }} /> and start filling your week.</div>
                </>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <HotFlame n={dailyStats.streak} size={17} />
                    <span style={{ fontFamily: FN, fontSize: 22, fontWeight: 800, color: T, lineHeight: 1 }}><CountUp value={dailyStats.streak} /></span>
                    <span style={{ fontSize: 11, color: TD, fontWeight: 700 }}>day streak</span>
                    {freezes > 0 && <span title={`${freezes} Streak Freeze${freezes > 1 ? "s" : ""} banked — absorbs a missed day`} style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 3, color: BL, fontSize: 12, fontWeight: 800 }}><Icon name="flake" size={14} /> {freezes}</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 30, marginTop: 11 }}>
                    {trend30.days.slice(-7).map((d, i) => {
                      const isToday = i === 6;
                      const v = isToday ? Math.max(d.attempts, dailyStats.count) : d.attempts;
                      const h = v <= 0 ? 3 : Math.max(5, Math.min(30, Math.round((v / Math.max(dailyGoal, 1)) * 30)));
                      return <div key={d.date} style={{ flex: 1, height: h, borderRadius: 2, background: v <= 0 ? "#1D1D1D" : v >= dailyGoal ? G : A, opacity: isToday ? 1 : 0.6, transition: "height .3s ease" }} />;
                    })}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                    <span style={{ fontSize: 9, color: TD, letterSpacing: 0.4 }}>last 7 days</span>
                    {dailyStats.count >= dailyGoal && <span style={{ fontSize: 9, color: G, fontWeight: 800 }}>✓ Goal reached</span>}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Today's work — the SRS return-trigger. When reviews are due they become the single
            gold hero action (the one thing an SRS app should pull you back for); Weak/Almost sit
            below as smaller secondary cells. The gold "new session" CTA further down demotes to a
            quiet outline whenever Due is the hero, so there's only ever one gold focal point. */}
        {reviewQueueItems.some(i => i.key !== "weak") && (() => {
          const dueItem = reviewQueueItems.find(item => item.key === "due");
          const otherItems = reviewQueueItems.filter(item => item.key !== "due" && item.key !== "weak");
          const shown = [dueItem, ...otherItems].filter(Boolean);
          return (
            <div style={{ background: PANEL_GRAD, border: `1px solid ${HAIR}`, borderRadius: 18, padding: "16px 16px 14px", marginBottom: 14, position: "relative", overflow: "hidden", boxShadow: ELEV }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: FLAG, opacity: 0.85 }} />
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 11, paddingTop: 2 }}>
                <div style={{ fontSize: 11, color: T, fontWeight: 800, letterSpacing: 0.4 }}>Today's work</div>
                <div style={{ fontSize: 10, color: TD }}>{shown.reduce((sum, item) => sum + item.count, 0)} waiting</div>
              </div>
              {dueItem && (
                <button type="button" onClick={dueItem.onClick} title={dueItem.detail}
                  style={{ width: "100%", background: "linear-gradient(135deg, #FFD93B 0%, #F2B400 100%)", color: "#0A0A0A", border: "none", borderRadius: 15, padding: "14px 16px", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, fontFamily: "inherit", fontWeight: 800, boxShadow: "0 12px 30px -10px rgba(255,204,0,0.5)", marginBottom: otherItems.length ? 8 : 0 }}>
                  <IconBadge name="calendarCheck" size={36} color="#0A0A0A" bg="#0A0A0A18" />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 11, opacity: 0.74, fontWeight: 800 }}>Reviews due · lock them in before they slip</span>
                    <span style={{ display: "block", fontFamily: FN, fontSize: 17, marginTop: 2 }}>Review {dueItem.count} word{dueItem.count === 1 ? "" : "s"}</span>
                    {dueItem.next && <span style={{ display: "block", fontSize: 10.5, opacity: 0.7, fontWeight: 700, marginTop: 2 }}>{dueItem.next}</span>}
                  </span>
                  <Icon name="arrowRight" size={20} />
                </button>
              )}
              {otherItems.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${otherItems.length}, minmax(0, 1fr))`, gap: 7 }}>
                  {otherItems.map(item => (
                    <button key={item.key} type="button" onClick={item.onClick} title={item.detail}
                      style={{ minWidth: 0, background: `linear-gradient(180deg, ${item.color}14 0%, #0D0D0D 75%)`, color: T, border: `1px solid ${item.color}2E`, borderRadius: 14, padding: "10px 7px 9px", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 9, fontFamily: "inherit" }}>
                      <IconBadge name={item.icon} size={26} color={item.color} bg="#0A0A0A66" />
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 11, color: T, fontWeight: 800, lineHeight: 1 }}>{item.title} <span style={{ color: item.color }}>{item.count}</span></span>
                        {item.next && <span style={{ display: "block", fontSize: 9.5, color: TD, lineHeight: 1.1, letterSpacing: 0.2, marginTop: 3 }}>{item.next}</span>}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* Weak spots — a first-class deck of the words that keep slipping. Promoted out of the
            cramped Today's-work cell so it can show the actual trouble words (tangible + motivating)
            and a clear drill CTA. Stays secondary to the gold Due hero above. */}
        {resolvedWeak.total > 0 && (
          <button type="button" onClick={startWeakReview} aria-label={`Drill ${resolvedWeak.total} weak words`}
            style={{ display: "block", width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "inherit", background: PANEL_GRAD, border: `1px solid ${R}33`, borderRadius: 18, padding: "15px 16px 14px", marginBottom: 14, position: "relative", overflow: "hidden", boxShadow: ELEV }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${R} 0%, ${A} 100%)`, opacity: 0.8 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 11, paddingTop: 2 }}>
              <IconBadge name="alert" size={34} color={R} bg={`${R}1A`} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 11.5, color: T, fontWeight: 800, letterSpacing: 0.3 }}>Weak spots <span style={{ color: RT }}>{resolvedWeak.total}</span></span>
                <span style={{ display: "block", fontSize: 10.5, color: TD, marginTop: 1 }}>Words that keep slipping — pin them down</span>
              </span>
              <Icon name="arrowRight" size={18} style={{ color: TD }} />
            </div>
            {weakPreview.length > 0 && (
              <span style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 11 }}>
                {weakPreview.slice(0, 5).map((w, i) => (
                  <span key={i} style={{ maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11.5, fontWeight: 700, color: T, background: "#0A0A0A", border: `1px solid ${HAIR}`, borderRadius: 999, padding: "5px 11px" }}>{w}</span>
                ))}
                {resolvedWeak.total > 5 && <span style={{ fontSize: 11.5, fontWeight: 700, color: TD, padding: "5px 4px", alignSelf: "center" }}>+{resolvedWeak.total - 5} more</span>}
              </span>
            )}
          </button>
        )}

        {/* Primary actions */}
        <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
          {/* Mode + Level grouped into one "quick session" tuning block, so the gold hero
              below reads as the single primary action — not the third of three stacked steps. */}
          <div style={{ background: "#0C0C0C", border: `1px solid ${HAIR}`, borderRadius: 14, padding: "12px 12px 13px", display: "grid", gap: 13 }}>
          <div>
            <div style={{ fontSize: 10, color: TD, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", marginBottom: 7, paddingLeft: 2 }}>Practice mode</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
              {[["vocab", "Recall", "layers"], ["speaking", "Speaking", "mic"], ["production", "Production", "keyboard"], ["dictation", "Dictation", "volume"], ["audio", "Audio", "headphones"]].map(([m, label, icon]) => {
                const on = (HERO_MODES[setupMode] ? setupMode : "production") === m;
                return (
                  <button key={m} type="button" aria-pressed={on} onClick={() => setSetupMode(m)}
                    style={{ background: on ? `${A}1A` : "#0F0F0F", border: `1px solid ${on ? A : HAIR}`, borderRadius: 12, padding: "10px 4px 8px", cursor: "pointer", display: "grid", justifyItems: "center", gap: 5, fontFamily: "inherit", transition: "background .15s, border-color .15s" }}>
                    <Icon name={icon} size={18} style={{ color: on ? A : TD }} />
                    <span style={{ fontSize: 10, fontWeight: 800, color: on ? A : TD, lineHeight: 1 }}>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          {/* Level focus — aim sessions at a CEFR level (e.g. B2) straight from home. */}
          <div>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 7, paddingLeft: 2 }}>
              <span style={{ fontSize: 10, color: TD, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase" }}>Level focus</span>
              {setupLevel === "auto"
                ? <span style={{ fontSize: 9.5, color: A, fontWeight: 700 }}>Auto · {deepStats.currentLevel}</span>
                : setupLevel !== "all" && <span style={{ fontSize: 9.5, color: A, fontWeight: 700 }}>{setupLevel} only</span>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
              {[["auto", "Auto"], ["all", "All"], ["A1", "A1"], ["A2", "A2"], ["B1", "B1"], ["B2", "B2"]].map(([lv, label]) => {
                const on = setupLevel === lv;
                return (
                  <button key={lv} type="button" aria-pressed={on} onClick={() => setSessLevel(lv)}
                    style={{ background: on ? `${A}1A` : "#0F0F0F", border: `1px solid ${on ? A : HAIR}`, borderRadius: 10, padding: "8px 0", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 800, color: on ? A : TD, transition: "background .15s, border-color .15s" }}>{label}</button>
                );
              })}
            </div>
          </div>
          </div>
          {(() => {
            const hm = HERO_MODES[setupMode] || HERO_MODES.production; const heroMode = HERO_MODES[setupMode] ? setupMode : "production";
            // When reviews are due, the gold Due hero above owns the spotlight — so this
            // "new session" launch steps back to a calm outline. With nothing due, it's the
            // primary gold action again.
            const demoted = resolvedDue.total > 0;
            return (
            <button type="button" onClick={() => { const n = Math.max(5, Math.min(totalW, lastSession?.count || 15)); startSession("__all__", heroMode, n); }}
              style={{ width: "100%", background: demoted ? "#0F0F0F" : "linear-gradient(135deg, #FFD93B 0%, #F2B400 100%)", color: demoted ? T : "#0A0A0A", border: demoted ? `1px solid ${A}44` : "none", borderRadius: demoted ? 14 : 16, padding: demoted ? "13px 16px" : "17px 18px", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, fontFamily: "inherit", fontWeight: 800, boxShadow: demoted ? "none" : "0 12px 30px -8px rgba(255,204,0,0.45)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <IconBadge name={hm.icon} size={demoted ? 30 : 36} color={demoted ? A : "#0A0A0A"} bg={demoted ? `${A}14` : "#0A0A0A18"} />
                <span>
                  <span style={{ display: "block", fontSize: demoted ? 10 : 11, opacity: demoted ? 1 : 0.74, fontWeight: 800, color: demoted ? A : "#0A0A0A" }}>{demoted ? "Or learn new words" : `${hm.sup} · one tap`}</span>
                  <span style={{ display: "block", fontFamily: FN, fontSize: demoted ? 14 : 16, marginTop: 2 }}>{hm.title}</span>
                </span>
              </span>
              <Icon name="arrowRight" size={demoted ? 17 : 20} />
            </button>
            ); })()}

          {/* Next topic — a guided path through the 36 categories. Surfaces the first topic
              (in curriculum order) you haven't fully mastered, so "study a specific topic"
              is findable from the launch flow and progresses systematically, not at random. */}
          {(() => {
            const ordered = libGroups.flatMap(g => g.cats);
            const next = ordered.find(c => { const s = getCatStats(c); return s.total > 0 && s.strong < s.total; });
            if (!next) return null;
            const s = getCatStats(next);
            const strongPct = s.total ? (s.strong / s.total) * 100 : 0;
            const mPct = s.total ? (s.mastered / s.total) * 100 : 0;
            const pPct = s.total ? (s.productionSeen / s.total) * 100 : 0;
            return (
              <button type="button" onClick={() => openSetup(next, HERO_MODES[setupMode] ? setupMode : "production")}
                style={{ width: "100%", background: "linear-gradient(100deg, #15140D 0%, #0E0E0E 62%)", color: T, border: `1px solid ${A}3D`, borderRadius: 14, padding: "12px 14px", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 11, fontFamily: "inherit", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: FLAG, opacity: 0.85 }} />
                <IconBadge name={categoryIcons[next] || "book"} size={34} color={A} bg={`${A}10`} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", color: A, fontSize: 10, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase" }}>Next topic</span>
                  <span style={{ display: "block", fontFamily: FN, fontSize: 14, fontWeight: 800, color: T, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{next}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                    <div style={{ flex: 1, height: 4, background: "#0A0A0A", borderRadius: 2, overflow: "hidden", position: "relative" }}>
                      <div style={{ position: "absolute", inset: 0, width: `${pPct}%`, background: `${A}33`, borderRadius: 2, transition: "width .5s" }} />
                      <div style={{ position: "absolute", inset: 0, width: `${strongPct}%`, background: `${A}CC`, borderRadius: 2, transition: "width .5s" }} />
                      <div style={{ position: "absolute", inset: 0, width: `${mPct}%`, background: G, borderRadius: 2, transition: "width .5s" }} />
                    </div>
                    <span style={{ fontSize: 10, color: s.strong ? A : TD, fontWeight: 800, flexShrink: 0 }}>{s.strong}/{s.total}{s.mastered > 0 && <span style={{ color: G }}> · {s.mastered}★</span>}</span>
                  </div>
                </div>
                <Icon name="arrowRight" size={16} color={A} />
              </button>
            );
          })()}

          <div style={{ display: "grid", gridTemplateColumns: lastSession ? "1fr 1fr" : "1fr", gap: 10 }}>
            {lastSession && <button type="button" onClick={() => lastSession.cat === "__due__" ? startDueReview() : startSession(lastSession.cat, lastSession.m, lastSession.count)}
              style={{ width: "100%", background: "#0F0F0F", color: T, border: `1px solid ${A}36`, borderRadius: 12, padding: "13px 14px", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, fontFamily: "inherit", fontWeight: 700 }}>
              <IconBadge name="refresh" size={30} color={A} />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", color: A, fontSize: 10, fontWeight: 800 }}>Continue</span>
                <span style={{ display: "block", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lastSession.label}</span>
              </span>
            </button>}
            <button type="button" onClick={() => openSetup("__all__", setupMode)}
              style={{ width: "100%", background: "#0F0F0F", color: T, border: `1px solid ${HAIR}`, borderRadius: 12, padding: "13px 14px", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, fontFamily: "inherit", fontWeight: 700 }}>
              <IconBadge name="layers" size={30} color={TD} />
              <span>
                <span style={{ display: "block", color: TD, fontSize: 10, fontWeight: 800 }}>All cards</span>
                <span style={{ display: "block", fontSize: 12 }}>Custom session</span>
              </span>
            </button>
          </div>
          <button type="button" onClick={() => { tutorReturnRef.current = "home"; setScreen("tutor"); }}
            style={{ width: "100%", marginTop: 10, background: "linear-gradient(135deg, #14110A 0%, #0F0F0F 60%)", color: T, border: `1px solid ${A}44`, borderRadius: 12, padding: "13px 14px", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, fontFamily: "inherit", fontWeight: 700 }}>
            <IconBadge name="message" size={30} color={A} bg={`${A}14`} />
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: "block", color: A, fontSize: 10, fontWeight: 800, letterSpacing: 0.3 }}>AI Tutor {!aiKey && "· setup needed"}</span>
              <span style={{ display: "block", fontSize: 12 }}>Chat & ask in German</span>
            </span>
            <Icon name="arrowRight" size={16} />
          </button>
        </div>
      </div>}

      {/* ── TRAIN TAB — promoted from a buried Home section to its own destination. Home is
          the daily vocab loop; targeted grammar & skill drills live here, one tap from the
          nav instead of a long scroll. Prioritised list: one Focus, coverage, all drills. ── */}
      {screen === "train" && <div className="ad-screen-in" style={{ padding: "0 20px 8px" }}>
        <div style={{ paddingTop: "max(16px, env(safe-area-inset-top))", marginBottom: 16 }}>
          <div style={{ fontFamily: FN, fontSize: 22, fontWeight: 800, color: T, letterSpacing: -0.3 }}>Training</div>
          <div style={{ fontSize: 11, color: TD, marginTop: 2 }}>Targeted grammar &amp; skill drills</div>
        </div>
        {(() => {
          const DRILLS = [
            { m: "article", c: "__all__", icon: "book", name: "Articles", desc: "der · die · das — noun gender" },
            { m: "plural", c: "__all__", icon: "grid", name: "Plural Forms", desc: "Build the plural of any noun" },
            { m: "verb", c: "__verb__", icon: "bolt", name: "Verb Trainer", desc: "Conjugate across every tense" },
            { m: "cloze", c: "__grammar__", icon: "layers", name: "Grammar Cloze", desc: "Fill the gap in real sentences" },
            { m: "sentence", c: "__sentence__", icon: "keyboard", name: "Sentence Builder", desc: "Master German word order" },
            { m: "imperativ", c: "__imperativ__", icon: "target", name: "Imperative", desc: "Commands — du, ihr, Sie" },
            { m: "listening", c: "__listening__", icon: "headphones", name: "Listening", desc: "Understand spoken dialogue" },
            { m: "confusion", c: "__confusion__", icon: "target", name: "Confusion pairs", desc: "Tell apart easily-confused words" },
            { m: "exam", c: "__exam__", icon: "book", name: "Exam practice", desc: "telc / Goethe reading & gap-fill" },
          ];
          const rows = DRILLS.map(d => {
            const ts = trainingStats[d.m];
            const pct = ts && ts.total > 0 ? (ts.seen / ts.total) * 100 : 0;
            return { ...d, ts, pct, done: !!(ts && ts.total > 0 && ts.seen >= ts.total) };
          });
          const avg = Math.round(rows.reduce((a, d) => a + d.pct, 0) / rows.length);
          const undone = rows.filter(d => !d.done);
          const focus = undone.length ? undone.reduce((b, d) => d.pct < b.pct ? d : b, undone[0]).m : null;
          const lenFor = (m) => Math.min(15, m === "cloze" ? CLOZE.length : m === "verb" ? 30 : m === "sentence" ? SENTENCES.length : m === "imperativ" ? IMPERATIVES.length : m === "listening" ? DIALOGUES.length : m === "confusion" ? 15 : m === "exam" ? 15 : m === "plural" ? Math.max(pluralNouns.length, 5) : nouns.length);
          return (<>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1, height: 6, background: "#0A0A0A", border: `1px solid ${HAIR}`, borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.max(avg, 1.5)}%`, background: undone.length ? A : G, opacity: 0.9, borderRadius: 4, transition: "width .6s" }} />
              </div>
              <span style={{ fontSize: 11, color: T, fontWeight: 800, flexShrink: 0 }}>{undone.length ? `${avg}% explored` : "All explored ✓"}</span>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {rows.map(d => {
                const isFocus = d.m === focus;
                return (
                  <button key={d.m} aria-label={`${d.name} — ${d.desc}`}
                    onClick={() => { setSetupCat(d.c); setSetupMode(d.m); setSessLen(lenFor(d.m)); setShowSetup(true); }}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, textAlign: "left", cursor: "pointer", fontFamily: "inherit",
                      background: isFocus ? "linear-gradient(100deg, #1B1810 0%, #0E0E0E 60%)" : "linear-gradient(100deg, #141414 0%, #0E0E0E 100%)",
                      border: `1px solid ${d.done ? `${G}44` : isFocus ? `${A}66` : HAIR}`, borderRadius: 14, padding: "13px 13px 12px", position: "relative", overflow: "hidden" }}>
                    {isFocus && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: FLAG, opacity: 0.9 }} />}
                    <IconBadge name={d.icon} size={38} color={d.done ? G : A} bg={`${A}0F`} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <span style={{ fontFamily: FN, fontSize: 14, fontWeight: 800, color: T }}>{d.name}</span>
                        {isFocus && <span style={{ fontSize: 8.5, fontWeight: 900, letterSpacing: 0.8, color: "#0A0A0A", background: A, borderRadius: 999, padding: "2px 7px", textTransform: "uppercase" }}>Focus</span>}
                        {d.done && <Icon name="check" size={13} color={G} />}
                      </div>
                      <div style={{ fontSize: 11, color: TD, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.desc}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 7 }}>
                        <div style={{ flex: 1, height: 4, background: "#000", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${d.pct}%`, background: d.done ? G : A, opacity: 0.85, borderRadius: 3, transition: "width .5s" }} />
                        </div>
                        {d.ts && <span style={{ fontSize: 9.5, color: TD, fontWeight: 800, flexShrink: 0 }}>{d.ts.seen}/{d.ts.total}</span>}
                      </div>
                    </div>
                    <Icon name="arrowRight" size={15} color={isFocus ? A : TD} />
                  </button>
                );
              })}
            </div>
          </>);
        })()}
      </div>}

      {/* ── LIBRARY TAB — themed, collapsible groups instead of a flat 36-card wall ── */}
      {screen === "library" && <div className="ad-screen-in" style={{ padding: "0 20px 8px" }}>
        <div style={{ paddingTop: "max(16px, env(safe-area-inset-top))", marginBottom: 14, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10 }}>
          <div>
            <div style={{ fontFamily: FN, fontSize: 22, fontWeight: 800, color: T, letterSpacing: -0.3 }}>Library</div>
            <div style={{ fontSize: 11, color: TD, marginTop: 2 }}>{totalW.toLocaleString()} words · {CATS.length} topics</div>
          </div>
          <button type="button" onClick={() => { setBrowseQuery(""); setBrowseFilter("all"); setScreen("browse"); }}
            style={{ background: "transparent", border: `1px solid ${A}33`, borderRadius: 999, padding: "6px 13px", color: A, fontSize: 11, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
            <Icon name="book" size={12} /> Browse & search
          </button>
        </div>
        {currentMission && (
          <button type="button" onClick={() => setScreen("scenarios")} style={{ width: "100%", textAlign: "left", marginBottom: 14, background: "linear-gradient(100deg, #15140D 0%, #0E0E0E 70%)", border: `1px solid ${A}3D`, borderRadius: 14, padding: "13px 14px", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 12 }}>
            <IconBadge name="map" size={36} color={A} bg={`${A}12`} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 13.5, fontWeight: 800, color: T }}>Your journey — real-world scenarios</span>
              <span style={{ display: "block", fontSize: 11, color: TD }}>Next: {currentMission.cando}</span>
            </span>
            <Icon name="chevron" size={16} style={{ color: TD, transform: "rotate(-90deg)" }} />
          </button>
        )}
        <div style={{ display: "grid", gap: 8 }}>
          {libGroups.map((g, gi) => {
            const agg = g.cats.reduce((a, cat) => {
              const st = getCatStats(cat);
              return { total: a.total + st.total, strong: a.strong + st.strong, mastered: a.mastered + st.mastered, prod: a.prod + st.productionSeen };
            }, { total: 0, strong: 0, mastered: 0, prod: 0 });
            const open = openGroups[g.name] ?? (gi === 0);
            const strongPct = agg.total ? (agg.strong / agg.total) * 100 : 0;
            const mPct = agg.total ? (agg.mastered / agg.total) * 100 : 0;
            const pPct = agg.total ? (agg.prod / agg.total) * 100 : 0;
            const groupGlow = g.cats.some(cat => newlyMasteredCats.has(cat));
            return (
              <div key={g.name}>
                <button type="button" onClick={() => toggleGroup(g.name)} aria-expanded={open}
                  style={{ width: "100%", background: "linear-gradient(180deg, #161616 0%, #0F0F0F 100%)", border: `1px solid ${groupGlow ? `${G}55` : open ? `${A}2E` : HAIR}`, borderRadius: 13, padding: "12px 14px 11px", cursor: "pointer", textAlign: "left", fontFamily: "inherit", display: "block" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Icon name="chevron" size={15} style={{ color: open ? A : TD, transform: open ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform .18s ease" }} />
                    <span style={{ fontFamily: FN, fontSize: 14, fontWeight: 800, color: T, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</span>
                    <span style={{ fontSize: 10, color: TD, fontWeight: 700, flexShrink: 0 }}>{g.cats.length} topics</span>
                    <span style={{ fontSize: 10, color: agg.strong ? A : TD, fontWeight: 800, flexShrink: 0 }}>{agg.strong}/{agg.total}{agg.mastered > 0 && <span style={{ color: G }}> · {agg.mastered}★</span>}</span>
                  </div>
                  <div style={{ height: 3, background: "#0A0A0A", borderRadius: 2, overflow: "hidden", position: "relative", marginTop: 9 }}>
                    <div style={{ position: "absolute", inset: 0, width: `${pPct}%`, background: `${A}33`, borderRadius: 2, transition: "width .5s" }} />
                    <div style={{ position: "absolute", inset: 0, width: `${strongPct}%`, background: `${A}CC`, borderRadius: 2, transition: "width .5s" }} />
                    <div style={{ position: "absolute", inset: 0, width: `${mPct}%`, background: G, borderRadius: 2, transition: "width .5s" }} />
                  </div>
                </button>
                {open && <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginTop: 8 }}>
                  {g.cats.map(cat => {
                    const st = getCatStats(cat);
                    const productionPct = st.total > 0 ? (st.productionSeen / st.total) * 100 : 0;
                    const strongPct = st.total > 0 ? (st.strong / st.total) * 100 : 0;
                    const masteredPct = st.total > 0 ? (st.mastered / st.total) * 100 : 0;
                    const done = st.strong >= st.total && st.total > 0;
                    const justMastered = newlyMasteredCats.has(cat);
                    return (
                      <button key={cat} className={justMastered ? "ad-category-mastered" : undefined} onClick={() => openSetup(cat, HERO_MODES[setupMode] ? setupMode : "production")} style={{ background: justMastered ? `linear-gradient(155deg, ${G}14, #101010 42%)` : "linear-gradient(180deg, #171717 0%, #0D0D0D 100%)", border: `1px solid ${justMastered ? G : done ? `${G}66` : HAIR}`, borderRadius: 12, padding: "11px 12px 10px", textAlign: "left", cursor: "pointer", transition: "all 0.15s, transform 0.1s", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", gap: 9 }}>
                        {justMastered && <div style={{ position: "absolute", top: 7, right: 8, fontSize: 9, color: G, fontWeight: 900, letterSpacing: 0.8, textTransform: "uppercase" }}>New</div>}
                        <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                          <IconBadge name={categoryIcons[cat] || "book"} size={26} color={done ? G : A} bg="#0A0A0A66" />
                          <span style={{ fontFamily: FN, fontSize: 13, color: T, lineHeight: 1.15, fontWeight: 800, minWidth: 0 }}>{cat}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {/* Tri-layer bar: faint = seen, gold = learned (strong), green = mastered ★ */}
                          <div style={{ flex: 1, height: 4, background: "#0A0A0A", borderRadius: 2, overflow: "hidden", position: "relative" }}>
                            <div style={{ position: "absolute", inset: 0, width: `${productionPct}%`, background: `${A}33`, borderRadius: 2, transition: "width 0.5s" }} />
                            <div style={{ position: "absolute", inset: 0, width: `${strongPct}%`, background: `${A}CC`, borderRadius: 2, transition: "width 0.5s" }} />
                            <div style={{ position: "absolute", inset: 0, width: `${masteredPct}%`, background: G, borderRadius: 2, transition: "width 0.5s" }} />
                          </div>
                          <span style={{ fontSize: 10, color: st.strong ? A : st.productionSeen ? `${A}99` : TD, fontWeight: 800, flexShrink: 0 }}>
                            {st.total ? `${st.strong}/${st.total}` : ""}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>}
              </div>
            );
          })}
        </div>
      </div>}

      {activeCardMissing && <div style={{ padding: "40px 24px 24px", minHeight: DVH, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: 360, background: SOFT_PANEL, border: `1px solid ${B}`, borderRadius: 16, padding: "24px 22px", textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}><IconBadge name="refresh" size={38} color={A} /></div>
          <div style={{ fontFamily: FN, fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Session recovered</div>
          <div style={{ color: TD, fontSize: 13, lineHeight: 1.5, marginBottom: 18 }}>The session lost its place for a moment. AutoDeutsch is moving you to Results so you can continue safely.</div>
          <Btn bg={A} color="#0A0A0A" onClick={() => setScreen("results")} style={{ fontFamily: FN }}>Open Results</Btn>
        </div>
      </div>}

      {/* ── AI TUTOR ── */}
      {screen === "tutor" && (
        <div className="ad-screen-in" style={{ padding: "0 16px calc(max(16px, env(safe-area-inset-bottom)) + 64px)", minHeight: DVH, display: "flex", flexDirection: "column" }}>
          <div style={{ paddingTop: "max(12px, env(safe-area-inset-top))", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <button onClick={() => { const r = tutorReturnRef.current || "home"; tutorReturnRef.current = "home"; setScreen(r); }} style={{ background: "transparent", border: `1px solid ${A}33`, borderRadius: 10, color: A, fontSize: 13, cursor: "pointer", padding: "8px 14px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="arrowLeft" size={14} /> Back</button>
            <div style={{ fontFamily: FN, fontSize: 14, fontWeight: 800, color: T }}>AI Tutor</div>
            {tutorMsgs.length > 0
              ? <button onClick={clearTutor} style={{ background: "transparent", border: `1px solid ${B}`, borderRadius: 10, color: TD, fontSize: 11, cursor: "pointer", padding: "8px 12px", fontWeight: 700 }}>Clear</button>
              : <span style={{ width: 56 }} />}
          </div>

          {!aiKey ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 16px", gap: 14 }}>
              <IconBadge name="message" size={48} color={A} bg={`${A}14`} />
              <div style={{ fontFamily: FN, fontSize: 18, fontWeight: 800, color: T }}>Add your API key to start</div>
              <div style={{ fontSize: 13, color: TD, lineHeight: 1.55, maxWidth: 320 }}>The Tutor uses your own Anthropic key — it stays on this device and you pay your own usage (a fraction of a cent per chat). Get one at console.anthropic.com, then paste it in Settings.</div>
              <Btn bg={A} color="#0A0A0A" onClick={() => { setScreen("home"); setShowSettings(true); }} style={{ fontFamily: FN, width: "auto", padding: "14px 22px" }}>Open Settings</Btn>
            </div>
          ) : (
            <>
              <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, paddingBottom: 10 }}>
                {tutorMsgs.length === 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 12, color: TD, lineHeight: 1.5, marginBottom: 12, textAlign: "center" }}>Chat in German with a B1 tutor. It corrects you and explains why. Tap a starter or type below.</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {tutorStarters.map((s, i) => (
                        <button key={i} onClick={() => sendTutor(s)} style={{ textAlign: "left", background: "#101010", border: `1px solid ${B}`, borderRadius: 12, padding: "12px 14px", color: T, fontSize: 13, cursor: "pointer", fontFamily: "inherit", lineHeight: 1.4 }}>{s}</button>
                      ))}
                    </div>
                  </div>
                )}
                {tutorMsgs.map((m, i) => (
                  <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "88%", background: m.role === "user" ? A : "#161616", color: m.role === "user" ? "#0A0A0A" : T, border: m.role === "user" ? "none" : `1px solid ${B}`, borderRadius: 16, borderBottomRightRadius: m.role === "user" ? 4 : 16, borderBottomLeftRadius: m.role === "user" ? 16 : 4, padding: "10px 14px", fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap", fontWeight: m.role === "user" ? 600 : 400 }}>{m.text}</div>
                ))}
                {tutorBusy && <div style={{ alignSelf: "flex-start", color: TD, fontSize: 13, fontStyle: "italic", padding: "4px 6px" }}>Tutor denkt nach…</div>}
                {tutorError && <div style={{ alignSelf: "stretch", background: "#1A0000", border: `1px solid ${R}55`, color: "#F87171", borderRadius: 12, padding: "10px 14px", fontSize: 12 }}>{tutorError}</div>}
              </div>
              <div style={{ display: "flex", gap: 8, paddingTop: 8, borderTop: `1px solid ${B}` }}>
                <input value={tutorInput} onChange={e => setTutorInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && tutorInput.trim()) sendTutor(); }}
                  placeholder="Schreib auf Deutsch…" autoCapitalize="sentences" className="ad-input"
                  style={{ flex: 1, padding: "13px 16px", borderRadius: 12, border: `1px solid ${B}`, background: SH, color: T, fontSize: 16, fontFamily: BD, outline: "none" }} />
                <Btn bg={A} color="#0A0A0A" ariaLabel="Send" onClick={() => sendTutor()} style={{ width: "auto", padding: "13px 18px", opacity: tutorBusy ? 0.5 : 1 }}>→</Btn>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── WORD BROWSER ── */}
      {screen === "browse" && (() => {
        const q = normalize(browseQuery);
        let list = allVocab();
        if (browseFilter === "known") list = list.filter(w => known.has(knownKey(w._cat, w.de)));
        else if (browseFilter === "mastered") list = list.filter(w => normalizeEntry(prog[`production::${w._cat}::${w.de}`]).stats.productionStreak >= MASTERY_STREAK);
        if (q) list = list.filter(w => normalize(w.de).includes(q) || w.en.toLowerCase().includes(browseQuery.trim().toLowerCase()));
        // Sort by the noun stripped of its article so "der Bahnhof" files under B, not D —
        // otherwise every der/die/das noun clusters under one letter and A–Z is meaningless.
        const sortKey = w => w.de.replace(/^(der|die|das)\s+/i, "");
        list.sort((a, b) => sortKey(a).localeCompare(sortKey(b), "de"));
        const total = list.length;
        const shown = list.slice(0, 120);
        // Group the shown rows under A–Z section headers for rhythm + a sense of place.
        const groups = [];
        shown.forEach(w => {
          const L = (sortKey(w).trim()[0] || "#").toUpperCase();
          const last = groups[groups.length - 1];
          if (last && last.letter === L) last.items.push(w); else groups.push({ letter: L, items: [w] });
        });
        return (
          <div style={{ padding: "0 20px max(28px, env(safe-area-inset-bottom))", minHeight: DVH, display: "flex", flexDirection: "column" }}>
            <div style={{ paddingTop: "max(12px, env(safe-area-inset-top))", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <button onClick={() => setScreen("library")} style={{ background: "transparent", border: `1px solid ${A}33`, borderRadius: 10, color: A, fontSize: 13, cursor: "pointer", padding: "8px 14px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="arrowLeft" size={14} /> Back</button>
              <div style={{ fontSize: 11, color: TD, fontWeight: 700 }}>{known.size} known · {allVocab().length} words</div>
            </div>
            <input className="ad-input" value={browseQuery} onChange={e => setBrowseQuery(e.target.value)} placeholder="Search German or English…" autoCapitalize="off" autoCorrect="off" spellCheck="false"
              style={{ width: "100%", boxSizing: "border-box", padding: "13px 16px", borderRadius: 12, border: `1px solid ${B}`, background: SH, color: T, fontSize: 16, fontFamily: BD, outline: "none", marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              {[["all", "All words"], ["mastered", "★ Mastered"], ["known", "Known"]].map(([v, l]) => (
                <button key={v} onClick={() => setBrowseFilter(v)} style={{ padding: "6px 13px", borderRadius: 999, fontSize: 12, fontWeight: 800, cursor: "pointer", background: browseFilter === v ? A : "#0A0A0A", color: browseFilter === v ? "#0A0A0A" : TD, border: `1px solid ${browseFilter === v ? A : B}` }}>{l}</button>
              ))}
            </div>
            {shown.length === 0 && <div style={{ color: TD, fontSize: 13, textAlign: "center", marginTop: 40 }}>{browseFilter === "known" ? "No words marked as known yet. Tap “Known” on any word you don’t need to practise." : browseFilter === "mastered" ? "No mastered words yet. Master a word with 5 correct production answers in a row." : "No matches. Try a shorter search."}</div>}
            {groups.map(g => (
              <div key={g.letter}>
                <div style={{ position: "sticky", top: 0, zIndex: 3, background: "#0A0A0A", padding: "8px 4px 6px", fontFamily: FN, fontSize: 12, fontWeight: 900, color: A, letterSpacing: 1.5, borderBottom: `1px solid ${B}` }}>{g.letter}</div>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 8, padding: "8px 0 12px" }}>
                  {g.items.map(w => {
                    const isKnown = known.has(knownKey(w._cat, w.de));
                    const v = normalizeEntry(prog[`vocab::${w._cat}::${w.de}`]);
                    const pr = normalizeEntry(prog[`production::${w._cat}::${w.de}`]);
                    const att = v.stats.attempts + pr.stats.attempts;
                    const mastered = pr.stats.productionStreak >= MASTERY_STREAK;
                    return (
                      <div key={`${w._cat}::${w.de}`} style={{ minWidth: 0, background: "#101010", border: `1px solid ${mastered ? `${G}44` : B}`, borderRadius: 12, padding: "11px 12px", opacity: isKnown && browseFilter !== "known" ? 0.55 : 1 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
                              <span style={{ fontFamily: FN, fontSize: 15, fontWeight: 800, color: T, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{w.de}</span>
                              <span style={{ fontSize: 9, color: A, fontWeight: 800, border: `1px solid ${A}44`, borderRadius: 999, padding: "1px 6px", flexShrink: 0 }}>{cardLevel(w)}</span>
                              {mastered && <span style={{ fontSize: 9, color: G, fontWeight: 900, flexShrink: 0 }}>★</span>}
                            </div>
                            <div style={{ fontSize: 12, color: TD, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.en}</div>
                            <div style={{ fontSize: 9.5, color: TD, marginTop: 3, opacity: 0.8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w._cat}{att > 0 ? ` · ${att} attempt${att !== 1 ? "s" : ""}` : " · not practised yet"}</div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                            <button type="button" aria-label={`Hear ${w.de}`} onClick={() => speak(w.de)} style={{ background: "#FFCC0012", border: `1px solid ${A}33`, borderRadius: 10, width: 36, height: 36, color: A, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name="volume" size={15} /></button>
                            <button type="button" onClick={() => toggleKnown(w._cat, w.de)} style={{ background: isKnown ? `${G}18` : "#0A0A0A", border: `1px solid ${isKnown ? G : B}`, borderRadius: 10, height: 36, padding: "0 11px", color: isKnown ? G : TD, fontSize: 11, fontWeight: 800, cursor: "pointer" }}>{isKnown ? "Known ✓" : "Known"}</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {total > shown.length && <div style={{ color: TD, fontSize: 11, textAlign: "center", marginTop: 12 }}>Showing {shown.length} of {total} — refine your search to see more.</div>}
          </div>
        );
      })()}

      {/* ── STATS DEEP-DIVE ── */}
      {screen === "stats" && (() => {
        const ds = deepStats;
        const isFresh = ds.attempts === 0; // brand-new user → show an aspirational preview, not a wall of zeros
        const LEVEL_COLORS = { A1: G, A2: BL, B1: A, B2: R };
        const maxBox = Math.max(1, ...ds.boxes);
        const boxLabels = ["1d", "2d", "4d", "7d", "14d", "30d"];
        const overallAcc = ds.attempts > 0 ? Math.round((ds.correct / ds.attempts) * 100) : null;
        const b2Months = ds.b2WeeksLeft != null ? ds.b2WeeksLeft / 4.345 : null;
        const journeyMonths = ds.journeyWeeksLeft != null ? ds.journeyWeeksLeft / 4.345 : null;
        const panel = { background: PANEL_GRAD, border: `1px solid ${HAIR}`, borderRadius: 18, padding: "16px 16px 14px", marginBottom: 14, position: "relative", overflow: "hidden", boxShadow: ELEV };
        const flagBar = <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: FLAG, opacity: 0.85 }} />;
        return (
          <div className="ad-screen-in" style={{ padding: "0 20px max(28px, env(safe-area-inset-bottom))", minHeight: DVH }}>
            <div style={{ paddingTop: "max(16px, env(safe-area-inset-top))", marginBottom: 14 }}>
              <div style={{ fontFamily: FN, fontSize: 22, fontWeight: 800, color: T, letterSpacing: -0.3 }}>Progress</div>
              <div style={{ fontSize: 11, color: TD, marginTop: 2 }}>Your journey to living and working in Germany</div>
            </div>

            {/* ── P2 capability lead: what you can DO (earned can-dos), not how much you've covered ── */}
            <div style={panel}>
              {flagBar}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12, paddingTop: 4 }}>
                <span style={{ fontSize: 10, color: TD, fontWeight: 800, letterSpacing: 2 }}>WHAT YOU CAN DO NOW</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 800, color: A, border: `1px solid ${A}55`, borderRadius: 999, padding: "2px 9px 2px 7px", flexShrink: 0 }}><Icon name={capability.role.icon} size={11} style={{ color: A }} /> {capability.role.name}</span>
              </div>
              {capability.earnedCount > 0 ? (<>
                <div style={{ display: "flex", alignItems: "baseline", gap: 9, marginBottom: 12 }}>
                  <span style={{ fontFamily: FN, fontSize: 34, fontWeight: 900, color: G, lineHeight: 1 }}>{capability.earnedCount}</span>
                  <span style={{ fontSize: 13, color: T, fontWeight: 700, lineHeight: 1.3 }}>real-world thing{capability.earnedCount === 1 ? "" : "s"} you can do in German</span>
                </div>
                <div style={{ display: "grid", gap: 7, marginBottom: 13 }}>
                  {capability.recent.map(m => (
                    <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, color: T }}>
                      <span style={{ width: 18, height: 18, borderRadius: 999, background: G, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="check" size={11} style={{ color: "#0A0A0A" }} /></span>
                      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.cando}</span>
                    </div>
                  ))}
                </div>
              </>) : (
                <div style={{ fontSize: 13, color: TD, lineHeight: 1.55, marginBottom: 13 }}>Complete your first scenario to earn your first real-world skill — like ordering at a café or registering your address.</div>
              )}
              {capability.nextRole && capability.earnedCount > 0 && <div style={{ fontSize: 11, color: TD, marginBottom: 11, lineHeight: 1.5 }}><span style={{ color: A, fontWeight: 800 }}>{capability.nextRole.min - capability.earnedCount}</span> more skill{capability.nextRole.min - capability.earnedCount === 1 ? "" : "s"} to become <span style={{ color: T, fontWeight: 800 }}>{capability.nextRole.name}</span></div>}
              <button type="button" onClick={() => currentMission ? openMission(currentMission.id) : setScreen("scenarios")} style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, background: `${A}10`, border: `1px solid ${A}3D`, borderRadius: 12, padding: "11px 13px", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                <IconBadge name="map" size={32} color={A} bg={`${A}12`} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 10, color: TD, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase" }}>Next skill</span>
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 800, color: T, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{currentMission ? currentMission.cando : "Browse scenarios"}</span>
                </span>
                <Icon name="chevron" size={15} style={{ color: TD, transform: "rotate(-90deg)" }} />
              </button>
            </div>

            {/* ── Your German Journey: a CEFR roadmap (rank · current focus · milestones · path) — the
                striking lead element of the screen, so it sits up top before the recent-performance hub ── */}
            {(() => {
              const LEVEL_TITLES = { A1: "Beginner", A2: "Elementary", B1: "Intermediate", B2: "Upper Intermediate" };
              const curIdx = LEVELS.findIndex(l => ds.levels[l].strong < ds.levels[l].total);
              const allDone = curIdx === -1;
              const cl = allDone ? LEVELS[LEVELS.length - 1] : LEVELS[curIdx];
              const nextLevel = allDone ? null : (LEVELS[LEVELS.indexOf(cl) + 1] || null);
              const CL = ds.levels[cl];
              const clPct = CL.total ? (CL.strong / CL.total) * 100 : 0;
              const clSeenPct = CL.total ? (CL.seen / CL.total) * 100 : 0;
              const clRemaining = Math.max(0, CL.total - CL.strong);
              const curChapter = Math.min(CHAPTERS, CL.chaptersDone + 1);
              const chRemaining = Math.max(0, CL.chapterSize - (CL.strong - CL.chaptersDone * CL.chapterSize));
              const jp = ds.journeyPct > 0 && ds.journeyPct < 10 ? ds.journeyPct.toFixed(1) : Math.round(ds.journeyPct);
              return (
                <div style={panel}>
                  {flagBar}
                  <div style={{ fontSize: 10, color: TD, fontWeight: 800, letterSpacing: 2, marginBottom: 14, paddingTop: 4 }}>YOUR JOURNEY TO B2</div>

                  {/* Current-level rank hero */}
                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 16, background: `${LEVEL_COLORS[cl]}1A`, border: `1.5px solid ${LEVEL_COLORS[cl]}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: `0 0 20px -7px ${LEVEL_COLORS[cl]}` }}>
                      <span style={{ fontFamily: FN, fontSize: 21, fontWeight: 900, color: LEVEL_COLORS[cl], lineHeight: 1 }}>{cl}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 9.5, color: TD, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase" }}>{allDone ? "Top level reached" : `You're at · Chapter ${curChapter} of ${CHAPTERS}`}</div>
                      <div style={{ fontFamily: FN, fontSize: 18, fontWeight: 800, color: T, lineHeight: 1.1 }}>{LEVEL_TITLES[cl]}</div>
                      <div style={{ fontSize: 11, color: TD, marginTop: 2 }}>{CL.strong.toLocaleString()} / {CL.total.toLocaleString()} {cl} words learned{CL.mastered > 0 && <span style={{ color: G }}> · {CL.mastered.toLocaleString()} ★</span>}</div>
                    </div>
                    <div style={{ fontFamily: FN, fontSize: 27, fontWeight: 800, color: G, lineHeight: 1, flexShrink: 0 }}>{Math.round(clPct)}%</div>
                  </div>
                  {/* Chapter trail — the 5 chapters of this level as a path you walk: completed
                      (checked), the current one as a ring you're filling (pulsing), and what's ahead. */}
                  {!allDone && (
                    <div style={{ display: "flex", alignItems: "center", marginBottom: 12, padding: "2px 2px 0" }}>
                      {(() => {
                        const within = CL.chapterSize ? Math.max(0, Math.min(1, (CL.strong - CL.chaptersDone * CL.chapterSize) / CL.chapterSize)) : 0;
                        const els = [];
                        for (let n = 1; n <= CHAPTERS; n++) {
                          const done = n <= CL.chaptersDone;
                          const current = n === CL.chaptersDone + 1;
                          els.push(
                            <div key={`n${n}`} style={{ position: "relative", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {current && <div className="ad-pulse" style={{ position: "absolute", inset: -5, borderRadius: "50%", border: `2px solid ${LEVEL_COLORS[cl]}` }} />}
                              <div style={{ width: current ? 30 : 24, height: current ? 30 : 24, borderRadius: "50%", padding: current ? 2.5 : 0, background: done ? G : current ? `conic-gradient(${LEVEL_COLORS[cl]} ${within * 360}deg, ${HAIR} 0deg)` : "#0A0A0A", border: done ? `2px solid ${G}` : current ? "none" : `2px solid ${HAIR}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: current ? `0 0 14px -3px ${LEVEL_COLORS[cl]}` : "none" }}>
                                {current ? (
                                  <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: "#0E0E0E", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <span style={{ fontFamily: FN, fontSize: 12, fontWeight: 900, color: LEVEL_COLORS[cl] }}>{n}</span>
                                  </div>
                                ) : done ? <Icon name="check" size={12} color="#0A0A0A" /> : <span style={{ fontFamily: FN, fontSize: 11, fontWeight: 800, color: TD }}>{n}</span>}
                              </div>
                            </div>
                          );
                          if (n < CHAPTERS) els.push(
                            <div key={`c${n}`} style={{ flex: 1, height: 3, background: "#0A0A0A", borderRadius: 2, margin: "0 3px", overflow: "hidden", position: "relative" }}>
                              <div style={{ position: "absolute", inset: 0, width: done ? "100%" : "0%", background: G, transition: "width .5s" }} />
                            </div>
                          );
                        }
                        return els;
                      })()}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 14, marginBottom: 14, fontSize: 10.5, color: TD, fontWeight: 700 }}>
                    <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: `${LEVEL_COLORS[cl]}66`, marginRight: 5 }} />{CL.seen} seen</span>
                    <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: LEVEL_COLORS[cl], marginRight: 5 }} />{CL.strong} learned</span>
                    <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: G, marginRight: 5 }} />{CL.mastered} mastered ★</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: TD, marginBottom: 18, lineHeight: 1.5 }}>
                    {allDone ? <>You've made every level solid — the full B2 vocabulary is locked in. 🏁</>
                      : <>Learn <span style={{ color: T, fontWeight: 800 }}>{chRemaining.toLocaleString()}</span> more to finish <span style={{ color: LEVEL_COLORS[cl], fontWeight: 800 }}>Chapter {curChapter} of {CHAPTERS}</span>{nextLevel ? <> — on your way to <span style={{ color: LEVEL_COLORS[nextLevel], fontWeight: 800 }}>{nextLevel}</span></> : <> to complete B2</>}.</>}
                  </div>

                  {/* The roadmap — 4 CEFR stages, you-are-here */}
                  {LEVELS.map((l, i) => {
                    const L = ds.levels[l];
                    const strongPct = L.total ? (L.strong / L.total) * 100 : 0;
                    const mPct = L.total ? (L.mastered / L.total) * 100 : 0;
                    const sPct = L.total ? (L.seen / L.total) * 100 : 0;
                    const done = L.total > 0 && L.strong >= L.total;
                    const isCurrent = l === cl && !allDone;
                    const reached = i <= LEVELS.indexOf(cl);
                    const last = i === LEVELS.length - 1;
                    return (
                      <button key={l} type="button" onClick={() => { setSessLevel(l); setScreen("home"); }} aria-label={`Practice ${l} ${LEVEL_TITLES[l]}`} style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left", padding: 0, opacity: reached || strongPct > 0 ? 1 : 0.62 }}>
                        <div style={{ position: "relative", width: 20, alignSelf: "stretch", display: "flex", justifyContent: "center", flexShrink: 0 }}>
                          {!last && <div style={{ position: "absolute", top: "50%", bottom: -6, width: 2, background: done ? G : `${HAIR}` }} />}
                          <div style={{ alignSelf: "center", width: done || isCurrent ? 16 : 12, height: done || isCurrent ? 16 : 12, borderRadius: "50%", background: done ? G : isCurrent ? LEVEL_COLORS[l] : "#0A0A0A", border: `2px solid ${done ? G : isCurrent ? LEVEL_COLORS[l] : HAIR}`, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1, boxShadow: isCurrent ? `0 0 12px -1px ${LEVEL_COLORS[l]}` : "none" }}>
                            {done && <Icon name="check" size={9} color="#0A0A0A" />}
                          </div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0, padding: "9px 0" }}>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
                            <span style={{ fontSize: 11, fontWeight: 900, color: LEVEL_COLORS[l] }}>{l}</span>
                            <span style={{ fontSize: 12, color: isCurrent ? T : TD, fontWeight: isCurrent ? 800 : 600, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{LEVEL_TITLES[l]}{isCurrent ? " — you are here" : ""}</span>
                            <span style={{ fontSize: 10.5, color: done ? G : TD, fontWeight: 800, flexShrink: 0 }}>{done ? "Complete" : `${Math.round(strongPct)}%`}</span>
                          </div>
                          <div style={{ height: 4, background: "#0A0A0A", borderRadius: 2, overflow: "hidden", marginTop: 5, position: "relative" }}>
                            <div style={{ position: "absolute", inset: 0, width: `${sPct}%`, background: `${LEVEL_COLORS[l]}33`, borderRadius: 2 }} />
                            <div style={{ position: "absolute", inset: 0, width: `${strongPct}%`, background: done ? G : LEVEL_COLORS[l], borderRadius: 2, transition: "width .5s" }} />
                            <div style={{ position: "absolute", inset: 0, width: `${mPct}%`, background: G, opacity: 0.9, borderRadius: 2, transition: "width .5s" }} />
                          </div>
                          {(() => {
                            const bl = capability.byLevel[l] || { done: 0, total: 0 };
                            const ex = capability.exam[l] || { state: "building" };
                            const exTxt = ex.state === "ready" ? "exam-ready" : ex.state === "almost" ? "exam ~" + ex.pct + "%" : "building";
                            const exCol = ex.state === "ready" ? G : ex.state === "almost" ? A : TD;
                            return (
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
                                {bl.total > 0 && <span style={{ fontSize: 10, color: TD, fontWeight: 700 }}>{bl.done}/{bl.total} can-dos</span>}
                                <span style={{ fontSize: 9, fontWeight: 800, color: exCol, border: `1px solid ${exCol}55`, borderRadius: 6, padding: "1px 6px", letterSpacing: 0.2 }}>telc {l} · {exTxt}</span>
                              </div>
                            );
                          })()}
                        </div>
                        <Icon name="chevron" size={14} style={{ color: TD, transform: "rotate(-90deg)", flexShrink: 0, alignSelf: "flex-start", marginTop: 10 }} />
                      </button>
                    );
                  })}

                  {/* Overall backdrop + pace */}
                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${B}66`, display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
                    <span style={{ fontSize: 11, color: TD, fontWeight: 700 }}>Across all levels · A1 → B2</span>
                    <span style={{ fontSize: 12.5, color: G, fontWeight: 800 }}>{ds.journeyStrong.toLocaleString()} words learned</span>
                  </div>
                  <div style={{ padding: "10px 12px", background: "#0A0A0A66", borderRadius: 10, borderLeft: `3px solid ${A}`, fontSize: 12, color: TD, lineHeight: 1.55 }}>
                    {ds.perWeek > 0 && journeyMonths != null ? (
                      journeyMonths <= 36 ? (
                        <>You fully mastered <span style={{ color: T, fontWeight: 800 }}>{ds.recent28}</span> words ★ in the last 4 weeks (~<span style={{ color: A, fontWeight: 800 }}>{ds.perWeek.toFixed(1)}/week</span>). At this pace, locking in all of B2 is about <span style={{ color: A, fontWeight: 800 }}>{journeyMonths >= 18 ? `${(journeyMonths / 12).toFixed(1)} years` : `${Math.round(journeyMonths)} months`}</span> away — keep it up.</>
                      ) : (
                        <>You're mastering ★ ~<span style={{ color: A, fontWeight: 800 }}>{ds.perWeek.toFixed(1)}/week</span> ({ds.recent28} in the last 4 weeks). Push that higher and your time to full B2 mastery drops fast — every extra word a week compounds.</>
                      )
                    ) : (
                      <>Master a few words in production mode (5 in a row ★) to start your pace toward B2.</>
                    )}
                  </div>
                </div>
              );
            })()}

            {isFresh ? (
              /* Aspirational empty state — a brand-new user has no data, so instead of four
                 panels of zeros we preview what this screen becomes and invite the first session. */
              <div style={panel}>
                {flagBar}
                <div style={{ fontSize: 10, color: TD, fontWeight: 800, letterSpacing: 2, marginBottom: 10, paddingTop: 4 }}>YOUR PROGRESS, LIVE</div>
                <div style={{ fontFamily: FN, fontSize: 17, fontWeight: 800, color: T, lineHeight: 1.25, marginBottom: 6 }}>This is where your climb to B2 takes shape.</div>
                <div style={{ fontSize: 12, color: TD, lineHeight: 1.5, marginBottom: 8 }}>Answer your first cards and this screen fills in — every session moves the bars up.</div>
                {[
                  { icon: "target", label: "Accuracy", desc: "How often you nail it first try" },
                  { icon: "bolt", label: "Recall speed", desc: "How fast the word comes back" },
                  { icon: "chart", label: "Memory strength", desc: "How long each word will stick" },
                  { icon: "flame", label: "Day streak", desc: "Your daily momentum" },
                ].map(r => (
                  <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: `1px solid ${HAIR}` }}>
                    <div style={{ width: 30, height: 30, borderRadius: 9, background: `${A}14`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name={r.icon} size={15} style={{ color: A }} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, color: T, fontWeight: 700 }}>{r.label}</div>
                      <div style={{ fontSize: 10.5, color: TD }}>{r.desc}</div>
                    </div>
                    <span style={{ fontFamily: FN, fontSize: 18, fontWeight: 800, color: TD, opacity: 0.35 }}>—</span>
                  </div>
                ))}
                <Btn bg={A} color="#0A0A0A" onClick={() => startSession("__all__", "vocab", 12)} style={{ marginTop: 16, fontFamily: FN, fontSize: 15, fontWeight: 800 }}>Start your first session →</Btn>
              </div>
            ) : (<>
            <button type="button" onClick={() => setShowUnderHood(v => !v)} aria-expanded={showUnderHood} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, background: "transparent", border: "none", color: TD, fontSize: 11.5, fontWeight: 800, letterSpacing: 0.4, cursor: "pointer", padding: "2px 0 12px" }}>
              {showUnderHood ? "Hide the numbers" : "Under the hood — the numbers"} <Icon name="chevron" size={13} style={{ transform: showUnderHood ? "rotate(180deg)" : "none", transition: "transform .18s" }} />
            </button>
            {showUnderHood && <>
            {ProgressHub()}

            {/* SRS box histogram */}
            <div style={panel}>
              {flagBar}
              <div style={{ fontSize: 10, color: TD, fontWeight: 800, letterSpacing: 2, marginBottom: 3, paddingTop: 4 }}>MEMORY STRENGTH</div>
              <div style={{ fontSize: 11, color: TD, marginBottom: 14 }}>How many words sit at each memory stage — further right means it sticks for longer</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 90 }}>
                {ds.boxes.map((n, i) => (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: n > 0 ? T : TD }}>{n}</span>
                    <div style={{ width: "100%", height: `${Math.max(3, (n / maxBox) * 62)}px`, borderRadius: 4, background: i >= 4 ? G : i >= 2 ? A : `${A}55`, opacity: n > 0 ? 1 : 0.25, transition: "height .4s ease" }} />
                    <span style={{ fontSize: 9, color: TD, fontWeight: 700 }}>{boxLabels[i]}</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 10, color: TD, marginTop: 10, lineHeight: 1.45 }}>Right is better: a card in the 30d box only needs a monthly check. Wrong answers move cards left.</div>
            </div>

            {/* All-time totals */}
            <div style={panel}>
              {flagBar}
              <div style={{ fontSize: 10, color: TD, fontWeight: 800, letterSpacing: 2, marginBottom: 12, paddingTop: 4 }}>ALL-TIME</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                {[
                  { v: ds.entries, l: "Cards practised", c: T },
                  { v: ds.attempts, l: "Answers", c: T },
                  { v: overallAcc == null ? "–" : `${overallAcc}%`, l: "Accuracy", c: overallAcc >= 80 ? G : overallAcc >= 60 ? A : R },
                  { v: ds.masteredTotal, l: "Mastered ★", c: G },
                ].map(it => (
                  <div key={it.l} style={{ minWidth: 0, textAlign: "center" }}>
                    <div style={{ fontFamily: FN, fontSize: 20, fontWeight: 800, color: it.c }}>{typeof it.v === "number" ? it.v.toLocaleString() : it.v}</div>
                    <div style={{ fontSize: 9, color: TD, fontWeight: 700, letterSpacing: 0.3, marginTop: 2 }}>{it.l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Drill coverage */}
            <div style={panel}>
              {flagBar}
              <div style={{ fontSize: 10, color: TD, fontWeight: 800, letterSpacing: 2, marginBottom: 3, paddingTop: 4 }}>DRILL COVERAGE</div>
              <div style={{ fontSize: 11, color: TD, marginBottom: 14 }}>Items answered correctly at least once</div>
              {[["article", "Articles"], ["plural", "Plurals"], ["cloze", "Grammar Cloze"], ["verb", "Verbs"], ["sentence", "Sentences"], ["imperativ", "Imperative"], ["listening", "Listening"]].map(([m, label]) => {
                const ts = trainingStats[m];
                if (!ts || !ts.total) return null;
                const pct = (ts.seen / ts.total) * 100;
                return (
                  <div key={m} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
                    <span style={{ fontSize: 11, color: T, fontWeight: 700, width: 96, flexShrink: 0 }}>{label}</span>
                    <div style={{ flex: 1, height: 5, background: "#0A0A0A", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: pct >= 100 ? G : A, borderRadius: 3, transition: "width .4s" }} />
                    </div>
                    <span style={{ fontSize: 10, color: TD, fontWeight: 800, width: 70, textAlign: "right", flexShrink: 0 }}>{ts.seen}/{ts.total}</span>
                  </div>
                );
              })}
            </div>
            </>}
            </>)}
          </div>
        );
      })()}

      {/* ── FLIP CARD SCREEN (vocab/production) ── */}
      {/* Production/dictation cards size to content (tall answered summary scrolls the page);
          the vocab/recall FLIP card needs a fixed-height container so its 1-1-auto, absolutely-
          positioned faces have a height to fill — minHeight alone collapses it to a strip. */}
      {screen === "cards" && card && <div style={{ padding: "0 20px", height: DVH, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {Header({ extra: (mode === "production" || mode === "speaking") ? <span style={{ color: A, marginRight: 6 }}>EN→DE</span> : "" })}
        <ProgBar pct={((idx + 1) / cards.length) * 100} color={rpt > 0 ? R : A} />

        {(mode === "production" || mode === "dictation" || mode === "speaking") ? (
          <div className={cardCls} onPointerDown={onAdvPointerDown} onPointerMove={onAdvPointerMove} onPointerUp={onAdvPointerUp(answered, nextCard)} style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", opacity: vis ? 1 : 0 }}>
            <div className="ad-elev" style={{ background: CARD_GRAD, border: `1px solid ${A}22`, borderRadius: 20, padding: "28px 24px", flex: "0 0 auto", minHeight: 160, marginBottom: 16, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, #1A1A1A 33%, ${R} 33% 66%, ${A} 66%)`, opacity: 0.7 }} />
              {answered && (inputResult === "exact" || inputResult === "capital" || inputResult === "eszett") && <span key={bloom} className="ad-bloom" aria-hidden="true" />}
              {mode === "dictation" ? (
                <button onClick={() => speak(card.de)} style={{ background: `${A}10`, border: `1.5px solid ${A}55`, borderRadius: 999, padding: "16px 26px", color: A, fontSize: 15, cursor: "pointer", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 10 }}>
                  <Icon name="volume" size={22} /> {answered ? "Nochmal hören" : "Play · Tippe, was du hörst"}
                </button>
              ) : (
                <div style={{ fontFamily: FN, fontSize: 33, fontWeight: 700, textAlign: "center", lineHeight: 1.18, color: T, letterSpacing: -0.4 }}>{card.en}</div>
              )}
              {answered && <>
                {mode === "dictation" && <div style={{ marginTop: 12, fontSize: 13, color: TD }}>{card.en}</div>}
                <div className={inputResult === "wrong" ? undefined : "ad-answer-pop"} style={{ marginTop: 16, fontFamily: FN, fontSize: 22, fontWeight: 600, color: inputResult === "wrong" ? R : G, letterSpacing: -0.2 }}>{card.de}</div>
                {inputResult === "close" && <div style={{ fontSize: 11, color: A, marginTop: 4 }}>Close! Check spelling.</div>}
                {inputResult === "capital" && <div style={{ fontSize: 11, color: A, marginTop: 4, fontWeight: 700 }}>✓ Right — mind the capitalisation</div>}
                {inputResult === "eszett" && <div style={{ fontSize: 11, color: A, marginTop: 4, fontWeight: 700 }}>✓ Right — mind ß vs ss</div>}
                {inputResult === "wrong" && input.trim() && <div style={{ fontSize: 12, color: TD, marginTop: 5 }}>{mode === "speaking" ? "Heard" : "You wrote"} <span style={{ color: "#F87171", textDecoration: "line-through", textDecorationColor: `${R}88` }}>{input.trim()}</span></div>}
                <button onClick={() => speak(card.de)} style={{ background: "transparent", border: `1px solid ${A}44`, borderRadius: 999, padding: "5px 12px", color: A, fontSize: 11, cursor: "pointer", fontWeight: 600, marginTop: 10, opacity: 0.9, display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="volume" size={13} /> Hören</button>
                {SpeedBadge({ ms: lastElapsed })}{CardStats()}
                {HintBtn({ hint: card.hint })}
                {/* Vocabulary-in-context: every card carries an example sentence, so show it by
                    default once answered (target word highlighted) instead of hiding it behind a
                    tap. Turns isolated word→word recall into "seen in a real sentence", and fills
                    the space the keyboard vacates on answer. Suppressed only on the fast
                    correct+auto-advance path, where the card flies off before it can be read. */}
                {!skipSummary && card.ex && (
                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${B}`, textAlign: "center", maxWidth: "92%" }}>
                    <div style={{ fontSize: 13, color: TD, lineHeight: 1.55, fontStyle: "italic" }}>
                      {highlightExample(card.ex, card.de).map((p, i) => p.hl
                        ? <span key={i} style={{ color: A, fontWeight: 600, fontStyle: "normal" }}>{p.text}</span>
                        : <span key={i}>{p.text}</span>
                      )}
                    </div>
                    {card.exEn && <div style={{ fontSize: 11, color: TD, lineHeight: 1.45, marginTop: 5, opacity: 0.7 }}>{card.exEn}</div>}
                  </div>
                )}
              </>}
            </div>
            <div style={{ marginTop: answered ? "auto" : undefined, paddingTop: 16, paddingBottom: "max(28px, env(safe-area-inset-bottom))" }}>
              {!answered ? (mode === "speaking" ? (
                <div style={{ display: "grid", gap: 12, justifyItems: "center" }}>
                  {SPEECH_REC_CTOR ? (<>
                    <button type="button" onClick={listening ? stopListening : startListening} aria-label={listening ? "Stop listening" : "Tap and speak"}
                      style={{ width: 86, height: 86, borderRadius: 999, border: `2px solid ${listening ? R : A}`, background: listening ? `${R}1A` : `${A}12`, color: listening ? R : A, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: listening ? `0 0 0 6px ${R}14` : "none", transition: "box-shadow .2s" }}>
                      <Icon name="mic" size={34} />
                    </button>
                    <div style={{ fontSize: 13, fontWeight: 800, color: listening ? R : A }}>{listening ? "Listening… tap to stop" : "Tap and say it in German"}</div>
                    {heard && <div style={{ fontSize: 15, color: T, fontFamily: BD }}>“{heard}”</div>}
                    {speechErr && <div style={{ fontSize: 12, color: RT }}>{speechErr}</div>}
                  </>) : (<>
                    <Icon name="mic" size={30} style={{ color: TD }} />
                    <div style={{ fontSize: 12, color: TD, textAlign: "center", lineHeight: 1.5, maxWidth: 280 }}>Say it aloud in German, then mark yourself. (Live speech scoring isn't supported on this browser.)</div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <Btn bg={`${G}1A`} border={`1px solid ${G}`} color={G} onClick={() => gradeSelf(true)} style={{ width: "auto", padding: "12px 20px" }}>✓ Got it</Btn>
                      <Btn bg={SH} border={`1px solid ${B}`} color={TD} onClick={() => gradeSelf(false)} style={{ width: "auto", padding: "12px 20px" }}>✗ Missed</Btn>
                    </div>
                  </>)}
                  <button type="button" onClick={revealTyped} style={{ marginTop: 2, background: "transparent", border: "none", color: TD, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 6, letterSpacing: 0.3 }}>Reveal answer</button>
                </div>
              ) : <><UmlautBar onInsert={insertChar} /><div style={{ display: "flex", gap: 8 }}>
                <input ref={typedInputRef} lang="de" className="ad-input" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && input.trim()) submitTyped(); }}
                  placeholder="Type in German…" autoFocus autoCapitalize="off" autoCorrect="off" spellCheck="false"
                  style={{ flex: 1, padding: "14px 16px", borderRadius: 12, border: `1px solid ${B}`, background: SH, color: T, fontSize: 16, fontFamily: BD, outline: "none" }} />
                <Btn bg={A} color="#0A0A0A" ariaLabel="Submit answer" onClick={submitTyped} style={{ width: "auto", padding: "14px 20px" }}>→</Btn>
              </div>
              <button type="button" onClick={revealTyped} style={{ marginTop: 10, width: "100%", background: "transparent", border: "none", color: TD, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 6, letterSpacing: 0.3 }}>I don't know — reveal answer</button>
              </>)
                : <Btn bg={SH} border={`1px solid ${B}`} onClick={nextCard}>{idx < cards.length - 1 ? "Next →" : "Results"}</Btn>}
              {mode !== "speaking" && KeyHint({ text: "Enter to submit · Enter again for next" })}
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", opacity: vis ? 1 : 0, transition: "opacity 0.15s" }}>
            <div ref={swipeRef} role={!flipped ? "button" : undefined} tabIndex={!flipped && vis ? 0 : -1} aria-label={!flipped ? "Swipe right if you got it, left if not sure" : "Answer revealed"} onKeyDown={handleRevealKey}
              onPointerDown={onCardPointerDown} onPointerMove={onCardPointerMove} onPointerUp={onCardPointerUp} onPointerCancel={onCardPointerUp}
              style={{ flex: "1 1 auto", maxHeight: 540, perspective: 900, cursor: "grab", position: "relative", touchAction: "none" }}>
              {/* Swipe verdict stamps — opacity driven imperatively while dragging */}
              <div ref={swipeRightRef} style={{ position: "absolute", top: 18, left: 14, zIndex: 6, opacity: 0, pointerEvents: "none", transform: "rotate(-12deg)", border: `3px solid ${G}`, color: G, borderRadius: 10, padding: "5px 13px", fontFamily: FN, fontWeight: 900, fontSize: 21, letterSpacing: 1.5, background: "#0A0A0AB8" }}>{flipped ? "NEXT" : "GOT IT"}</div>
              <div ref={swipeLeftRef} style={{ position: "absolute", top: 18, right: 14, zIndex: 6, opacity: 0, pointerEvents: "none", transform: "rotate(12deg)", border: `3px solid ${flipped ? G : A}`, color: flipped ? "#86EFAC" : A, borderRadius: 10, padding: "5px 13px", fontFamily: FN, fontWeight: 900, fontSize: 21, letterSpacing: 1.5, background: "#0A0A0AB8" }}>{flipped ? "NEXT" : "NOT SURE"}</div>
              <div style={{ width: "100%", height: "100%", transformStyle: "preserve-3d", transition: vis ? "transform 0.5s cubic-bezier(0.4,0,0.2,1)" : "none", transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)", position: "relative" }}>
                <div className="ad-elev" style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", background: CARD_GRAD, border: `1px solid ${A}22`, borderRadius: 20, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 24px", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, #1A1A1A 33%, ${R} 33% 66%, ${A} 66%)` }} />
                  {/* Top eyebrow — orients the otherwise-cavernous card (category · level on the
                      left, difficulty on the right) so the single word reads as the centre of a
                      composed three-zone card, not a word floating in black. */}
                  <div style={{ position: "absolute", top: 15, left: 16, right: 15, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 800, color: TD, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{card._cat || category}<span style={{ color: A }}> · {cardLevel(card)}</span></span>
                    {card.diff && <span style={{ flexShrink: 0, fontSize: 9, color: card.diff === "hard" ? R : card.diff === "medium" ? A : G, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.8, background: "#0A0A0AAA", border: `1px solid ${card.diff === "hard" ? R : card.diff === "medium" ? A : G}40`, borderRadius: 999, padding: "3px 9px" }}>{card.diff}</span>}
                  </div>
                  <div style={{ fontFamily: FN, fontSize: 46, fontWeight: 700, textAlign: "center", lineHeight: 1.08, color: T, letterSpacing: -0.5 }}>{card.de}</div>
                  <div style={{ position: "absolute", bottom: 18, display: "flex", alignItems: "center", gap: 14, fontSize: 11, letterSpacing: 0.5, fontWeight: 700, opacity: 0.75 }}>
                    <span style={{ color: A }}>← not sure</span>
                    <span style={{ color: TD, opacity: 0.5 }}>swipe</span>
                    <span style={{ color: G }}>got it →</span>
                  </div>
                </div>
                <div className="ad-elev" style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", transform: "rotateY(180deg)", background: CARD_GRAD, border: `1px solid ${A}22`, borderRadius: 20, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 24px", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, #1A1A1A 33%, ${R} 33% 66%, ${A} 66%)` }} />
                  <div style={{ fontFamily: FN, fontSize: 34, fontWeight: 700, textAlign: "center", lineHeight: 1.15, color: T, marginBottom: 18, letterSpacing: -0.4 }}>{card.en}</div>
                  <div style={{ fontFamily: FN, fontSize: 19, textAlign: "center", lineHeight: 1.3, color: A, fontWeight: 600, marginBottom: 6 }}>{card.de}</div>
                  <button onClick={e => { e.stopPropagation(); speak(card.de); }} style={{ background: "transparent", border: `1px solid ${A}44`, borderRadius: 999, padding: "5px 12px", color: A, fontSize: 11, cursor: "pointer", fontWeight: 600, marginBottom: 14, opacity: 0.9, display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="volume" size={13} /> Hören</button>
                  {HintBtn({ hint: card.hint })}
                  {showEx ? (
                    <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${B}`, textAlign: "center", maxWidth: "92%" }}>
                      <div style={{ fontSize: 13, color: TD, lineHeight: 1.55, fontStyle: "italic" }}>
                        {highlightExample(card.ex, card.de).map((p, i) => p.hl
                          ? <span key={i} style={{ color: A, fontWeight: 600, fontStyle: "normal" }}>{p.text}</span>
                          : <span key={i}>{p.text}</span>
                        )}
                      </div>
                      {card.exEn && <div style={{ fontSize: 11, color: TD, lineHeight: 1.45, marginTop: 5, opacity: 0.7 }}>{card.exEn}</div>}
                    </div>
                  ) : flipped && <button onClick={e => { e.stopPropagation(); setShowEx(true); }} style={{ marginTop: 10, background: "transparent", border: "none", color: TD, fontSize: 11, cursor: "pointer", fontWeight: 600, opacity: 0.7, letterSpacing: 1.2, padding: "6px 8px", }}>Show example</button>}
                </div>
              </div>
            </div>
            <div style={{ paddingTop: 18, paddingBottom: "max(28px, env(safe-area-inset-bottom))" }}>
              {/* Revealed = you didn't know it (already counted wrong); the only step left is
                  to move on, so swipe in any direction or tap Next. */}
              {flipped && <Btn bg={SH} border={`1px solid ${B}`} onClick={() => nextCard()}>{idx < cards.length - 1 ? "Next →" : "Results"}</Btn>}
              {!flipped && vis && <div style={{ textAlign: "center", color: TD, fontSize: 12, paddingTop: 6 }}>Swipe <span style={{ color: G, fontWeight: 700 }}>right if you got it</span>, <span style={{ color: A, fontWeight: 700 }}>left if not sure</span></div>}
              {KeyHint({ text: flipped ? "Enter or swipe to continue" : "→ got it · ← not sure" })}
            </div>
          </div>
        )}
      </div>}

      {/* ── DRILL SCREEN (article/cloze/verb) ── */}
      {screen === "drill" && card && (() => {
        // Compose the canvas (fill the card, drop the bottom auto-margin so there's no void)
        // whenever there's no keyboard to fill the lower half: every answered state, plus the
        // multiple-choice modes. Typed modes while unanswered stay top-anchored (keyboard space).
        const composed = answered || mode === "article" || mode === "listening" || mode === "confusion" || mode === "exam" || (mode === "verb" && !!card.opts);
        return (<div style={{ padding: "0 20px", height: DVH, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {Header({ extra: <span style={{ color: A, marginRight: 6 }}>{mode === "article" ? "der/die/das" : mode === "plural" ? "Plural" : mode === "cloze" ? "Cloze" : mode === "imperativ" ? "Imperative" : mode === "listening" ? "Listening" : mode === "confusion" ? "Confusion" : mode === "exam" ? "Exam" : "Verb"}</span> })}
        <ProgBar pct={((idx + 1) / cards.length) * 100} color={rpt > 0 ? R : A} />

        <div className={cardCls} onPointerDown={onAdvPointerDown} onPointerMove={onAdvPointerMove} onPointerUp={onAdvPointerUp(answered, nextDrill)} style={{ opacity: vis ? 1 : 0, flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: composed ? "center" : "flex-start" }}>
          <div className="ad-elev" style={{ background: CARD_GRAD, border: `1px solid ${A}22`, borderRadius: 20, padding: "28px 20px", marginBottom: 16, flex: "0 0 auto", minHeight: 160, maxHeight: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", overflowX: "hidden", overflowY: "auto" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, #1A1A1A 33%, ${R} 33% 66%, ${A} 66%)`, opacity: 0.7 }} />
            {answeredCorrect && <span key={bloom} className="ad-bloom" aria-hidden="true" />}
            {mode === "article" && <>
              <div style={{ fontSize: 10, color: AD, letterSpacing: 3, textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>What article?</div>
              <div style={{ fontFamily: FN, fontSize: 26, textAlign: "center" }}>___ {card.noun}</div>
              <div style={{ fontSize: 12, color: TD, marginTop: 8 }}>({card.en})</div>
              {answered && <><div style={{ marginTop: 12, fontFamily: FN, fontSize: 20, color: sel !== null && ["der", "die", "das"][sel] === card.article ? G : R }}>{card.article} {card.noun}</div><SpeakBtn text={`${card.article} ${card.noun}`} />{SpeedBadge({ ms: lastElapsed })}{CardStats()}
                {!skipSummary && card.ex && <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${B}55`, textAlign: "center", maxWidth: "92%" }}>
                  <div style={{ fontSize: 12.5, color: TD, lineHeight: 1.5, fontStyle: "italic" }}>
                    {highlightExample(card.ex, card.noun).map((p, i) => p.hl
                      ? <span key={i} style={{ color: A, fontWeight: 600, fontStyle: "normal" }}>{p.text}</span>
                      : <span key={i}>{p.text}</span>)}
                  </div>
                  {card.exEn && <div style={{ fontSize: 11, color: TD, marginTop: 4, opacity: 0.7 }}>{card.exEn}</div>}
                </div>}
              </>}
            </>}
            {mode === "plural" && <>
              <div style={{ fontSize: 10, color: AD, letterSpacing: 3, textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>What's the plural?</div>
              <div style={{ fontFamily: FN, fontSize: 26, textAlign: "center", lineHeight: 1.2 }}>{card.de}</div>
              <div style={{ fontSize: 12, color: TD, marginTop: 8 }}>({card.en})</div>
              {answered && <>
                <div style={{ marginTop: 12, fontFamily: FN, fontSize: 20, color: inputResult === "wrong" ? R : G }}>{card.pl}</div>
                {inputResult === "wrong" && input && <div style={{ fontSize: 11, color: RT, marginTop: 4 }}>You: {input}</div>}
                {inputResult === "close" && <div style={{ fontSize: 11, color: A, marginTop: 4 }}>Close! Check spelling.</div>}
                {inputResult === "capital" && <div style={{ fontSize: 11, color: A, marginTop: 4, fontWeight: 700 }}>✓ Right — mind the capitalisation</div>}
                {inputResult === "eszett" && <div style={{ fontSize: 11, color: A, marginTop: 4, fontWeight: 700 }}>✓ Right — mind ß vs ss</div>}
                <SpeakBtn text={card.pl} />{SpeedBadge({ ms: lastElapsed })}{CardStats()}
                {!skipSummary && <GrammarNote note={pluralRule(card.de, card.pl)} />}
                {!skipSummary && card.ex && <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${B}55`, textAlign: "center", maxWidth: "92%" }}>
                  <div style={{ fontSize: 12.5, color: TD, lineHeight: 1.5, fontStyle: "italic" }}>
                    {highlightExample(card.ex, card.noun).map((p, i) => p.hl
                      ? <span key={i} style={{ color: A, fontWeight: 600, fontStyle: "normal" }}>{p.text}</span>
                      : <span key={i}>{p.text}</span>)}
                  </div>
                  {card.exEn && <div style={{ fontSize: 11, color: TD, marginTop: 4, opacity: 0.7 }}>{card.exEn}</div>}
                </div>}
              </>}
            </>}
            {mode === "cloze" && <>
              <div style={{ fontSize: 10, color: AD, letterSpacing: 3, textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>Fill the gap</div>
              <div style={{ fontFamily: FN, fontSize: 20, textAlign: "center", lineHeight: 1.4 }}>{answered ? card.q.replace("___", card.a) : card.q}</div>
              {answered && <><div style={{ marginTop: 12, fontSize: 12, color: TD, textAlign: "center", lineHeight: 1.5, padding: "8px 14px", background: "#0A0A0A66", borderRadius: 10, borderLeft: `3px solid ${A}` }}>
                {inputResult === "wrong" ? <>{input && <><span style={{ color: RT }}>Your answer: {input}</span><br /></>}<span style={{ color: G }}>Correct: {card.a}</span><br /></> :
                  inputResult === "capital" ? <span style={{ color: A }}>✓ Right — mind the capitalisation ({card.a})</span> :
                  inputResult === "eszett" ? <span style={{ color: A }}>✓ Right — mind ß vs ss ({card.a})</span> :
                  <span style={{ color: G }}>Correct! ✓</span>}{" "}{!skipSummary && card.h}
                {SpeedBadge({ ms: lastElapsed })}
              </div>{CardStats()}</>}
            </>}
            {mode === "verb" && <>
              <div style={{ fontSize: 10, color: AD, letterSpacing: 3, textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>Conjugate — {card.tense}</div>
              <div style={{ fontFamily: FN, fontSize: 22, color: A, marginBottom: 6 }}>{card.verb}</div>
              {card.tense === "Perfekt" ? <div style={{ fontSize: 15, color: T, fontWeight: 600 }}>{card.pron} ___ ___?</div>
                : <div style={{ fontSize: 15, color: T, fontWeight: 600 }}>{card.pron} ___?</div>}
              <div style={{ fontSize: 12, color: TD, marginTop: 4 }}>({card.en})</div>
              {answered && <><div style={{ marginTop: 12, fontSize: 13, color: G, fontWeight: 700 }}>{card.pron} {card.correct}</div>
                {!skipSummary && <div style={{ fontSize: 11, color: TD, marginTop: 4 }}>{card.hint}</div>}<SpeakBtn text={`${card.pron} ${card.correct}`} />{SpeedBadge({ ms: lastElapsed })}{CardStats()}
                {!skipSummary && <GrammarNote note={verbRule(VERBS.find(v => v.v === card.verb))} />}</>}
            </>}
            {mode === "imperativ" && <>
              <div style={{ fontSize: 10, color: AD, letterSpacing: 3, textTransform: "uppercase", marginBottom: 12, fontWeight: 700 }}>Imperative — {card._person === "sie" ? "Sie" : card._person}</div>
              <div style={{ fontFamily: FN, fontSize: 22, color: A, marginBottom: 4 }}>{card.base}</div>
              <div style={{ fontSize: 12, color: TD, marginBottom: 8 }}>({card.en})</div>
              {!answered && <div style={{ fontSize: 11, color: TD, textAlign: "center", fontStyle: "italic" }}>Give the {card._person === "sie" ? "Sie" : card._person}-form command</div>}
              {answered && <>
                <div style={{ marginTop: 10, width: "100%", maxWidth: 300, background: "#0A0A0A66", borderRadius: 10, padding: "10px 14px", borderLeft: `3px solid ${inputResult === "wrong" ? R : G}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" }}>
                    <span style={{ color: TD }}>du</span>
                    <span style={{ color: card._person === "du" ? (inputResult === "wrong" ? R : G) : T, fontWeight: card._person === "du" ? 700 : 500 }}>{card.du}{card._person === "du" ? " ←" : ""}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" }}>
                    <span style={{ color: TD }}>ihr</span>
                    <span style={{ color: card._person === "ihr" ? (inputResult === "wrong" ? R : G) : T, fontWeight: card._person === "ihr" ? 700 : 500 }}>{card.ihr}{card._person === "ihr" ? " ←" : ""}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" }}>
                    <span style={{ color: TD }}>Sie</span>
                    <span style={{ color: card._person === "sie" ? (inputResult === "wrong" ? R : G) : T, fontWeight: card._person === "sie" ? 700 : 500 }}>{card.sie}{card._person === "sie" ? " ←" : ""}</span>
                  </div>
                </div>
                {inputResult === "wrong" && input && <div style={{ fontSize: 11, color: RT, marginTop: 6 }}>You: {input}</div>}
                {!skipSummary && <div style={{ fontSize: 11, color: TD, marginTop: 8, fontStyle: "italic", textAlign: "center", padding: "0 6px" }}>„{card.ex}"</div>}
                {!skipSummary && <div style={{ fontSize: 11, color: BL, marginTop: 4, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}><Icon name="target" size={12} /> {card.hint}</div>}
                <SpeakBtn text={card[card._person]} />
                {SpeedBadge({ ms: lastElapsed })}{CardStats()}
              </>}
            </>}
            {mode === "listening" && card._dialogue && <>
              <div style={{ fontSize: 10, color: AD, letterSpacing: 3, textTransform: "uppercase", marginBottom: 10, fontWeight: 700 }}>Listening — {card._dialogue.title}</div>
              <div style={{ width: "100%", maxHeight: 160, overflowY: "auto", background: "#0A0A0A66", borderRadius: 10, padding: "10px 14px", marginBottom: 14, borderLeft: `3px solid ${A}` }}>
                {card._dialogue.lines.map((line, i) => (
                  <div key={i} style={{ marginBottom: 8 }}>
                    {line.speaker && <div style={{ fontSize: 9, color: AD, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>{line.speaker}</div>}
                    <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                      <div style={{ fontSize: 12, color: T, lineHeight: 1.4, flex: 1 }}>{line.de}</div>
                      <button type="button" aria-label={`Play line ${i + 1}`} onClick={(e) => { e.stopPropagation(); speak(line.de); }} style={{ background: "none", border: "none", color: A, fontSize: 12, cursor: "pointer", flexShrink: 0, padding: 3 }}><Icon name="volume" size={14} /></button>
                    </div>
                  </div>
                ))}
                <button onClick={() => {
                  if (playAllActive) { stopPlayAll(); return; }
                  setPlayAllActive(true);
                  playAllTimersRef.current = [];
                  // Use a per-line delay proportional to character count (~70ms/char + 900ms base)
                  // rather than a fixed 2.8s — long lines used to cut off.
                  let cumulative = 0;
                  card._dialogue.lines.forEach((line, i, arr) => {
                    const delay = cumulative;
                    const t = setTimeout(() => {
                      speak(line.de);
                      if (i === arr.length - 1) {
                        // after final line finishes (~ line.de.length*70 + 600 ms), clear flag
                        const clearT = setTimeout(() => { playAllTimersRef.current = []; setPlayAllActive(false); }, line.de.length * 70 + 600);
                        playAllTimersRef.current.push(clearT);
                      }
                    }, delay);
                    playAllTimersRef.current.push(t);
                    cumulative += line.de.length * 70 + 900;
                  });
                }}
                  style={{ marginTop: 4, background: playAllActive ? `${R}22` : `${A}22`, border: `1px solid ${playAllActive ? R : A}55`, borderRadius: 8, padding: "5px 12px", color: playAllActive ? R : A, fontSize: 11, cursor: "pointer", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Icon name={playAllActive ? "pause" : "play"} size={13} /> {playAllActive ? "Stop" : "Play all"}
                </button>
              </div>
              <div style={{ fontFamily: FN, fontSize: 16, color: T, fontWeight: 700, textAlign: "center", lineHeight: 1.4 }}>{card.q}</div>
              {answered && <>
                <div style={{ fontSize: 11, color: sel === card.correctIdx ? G : R, marginTop: 8, fontWeight: 700 }}>
                  {sel === card.correctIdx ? "✓ Correct" : `✗ Correct: ${card.opts[card.correctIdx]}`}
                </div>
                {SpeedBadge({ ms: lastElapsed })}{CardStats()}
              </>}
            </>}
            {mode === "confusion" && <>
              <div style={{ fontSize: 10, color: AD, letterSpacing: 3, textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>Which word fits?</div>
              <div style={{ fontFamily: FN, fontSize: 20, textAlign: "center", lineHeight: 1.4 }}>{answered ? card.q.replace("___", card.answer) : card.q}</div>
              {answered && <>
                <div style={{ fontSize: 11, color: sel === card.correctIdx ? G : R, marginTop: 10, fontWeight: 700 }}>{sel === card.correctIdx ? "✓ Correct" : `✗ Correct: ${card.answer}`}</div>
                <div style={{ marginTop: 10, fontSize: 12, color: TD, textAlign: "center", lineHeight: 1.5, padding: "9px 14px", background: "#0A0A0A66", borderRadius: 10, borderLeft: `3px solid ${A}`, maxWidth: "94%" }}>{card.exEn}<br /><span style={{ color: A, fontWeight: 700 }}>{card.why}</span></div>
                {!skipSummary && <div style={{ fontSize: 11, color: TD, marginTop: 8, textAlign: "center", maxWidth: "92%", fontStyle: "italic" }}>{card.rule}</div>}
                {SpeedBadge({ ms: lastElapsed })}{CardStats()}
              </>}
            </>}
            {mode === "exam" && card._set && <>
              <div style={{ fontSize: 10, color: AD, letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 7, fontWeight: 700 }}>{card._set.skill} · {card._set.level}</div>
              <div style={{ fontSize: 13, color: A, fontWeight: 800, marginBottom: 8, textAlign: "center" }}>{card._set.title}</div>
              <div style={{ width: "100%", maxHeight: 150, overflowY: "auto", background: "#0A0A0A66", borderRadius: 10, padding: "10px 14px", marginBottom: 8, borderLeft: `3px solid ${A}`, fontSize: 12.5, color: T, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{(showEx && card._set.passageEn) ? card._set.passageEn : card._set.passage}</div>
              {card._set.passageEn && <button type="button" onClick={(e) => { e.stopPropagation(); setShowEx(v => !v); }} style={{ background: "transparent", border: "none", color: A, fontSize: 11, fontWeight: 700, cursor: "pointer", marginBottom: 12, padding: 0 }}>{showEx ? "Show German" : "Show English"}</button>}
              <div style={{ fontFamily: FN, fontSize: 16, color: T, fontWeight: 700, textAlign: "center", lineHeight: 1.4 }}>{card.q}</div>
              {answered && <>
                <div style={{ fontSize: 11, color: sel === card.correctIdx ? G : R, marginTop: 8, fontWeight: 700 }}>{sel === card.correctIdx ? "✓ Correct" : `✗ Correct: ${card.opts[card.correctIdx]}`}</div>
                {card.why && !skipSummary && <div style={{ fontSize: 11, color: TD, marginTop: 6, textAlign: "center", maxWidth: "92%" }}>{card.why}</div>}
                {SpeedBadge({ ms: lastElapsed })}{CardStats()}
              </>}
            </>}
          </div>

          {mode === "cloze" && !answered && (
            <><UmlautBar onInsert={insertChar} />
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input ref={typedInputRef} lang="de" className="ad-input" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && input.trim()) submitCloze(); }}
                placeholder="Type answer…" autoFocus autoCapitalize="off" autoCorrect="off" spellCheck="false"
                style={{ flex: 1, padding: "14px 16px", borderRadius: 12, border: `1px solid ${B}`, background: SH, color: T, fontSize: 16, fontFamily: BD, outline: "none" }} />
              <Btn bg={A} color="#0A0A0A" ariaLabel="Submit answer" onClick={submitCloze} style={{ width: "auto", padding: "14px 20px" }}>→</Btn>
            </div>
            <button type="button" onClick={revealDrill} style={{ marginBottom: 16, width: "100%", background: "transparent", border: "none", color: TD, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 6, letterSpacing: 0.3 }}>I don't know — reveal answer</button></>
          )}
          {mode === "plural" && !answered && (
            <><UmlautBar onInsert={insertChar} />
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input ref={typedInputRef} lang="de" className="ad-input" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && input.trim()) submitPlural(); }}
                placeholder="die …" autoFocus autoCapitalize="off" autoCorrect="off" spellCheck="false"
                style={{ flex: 1, padding: "14px 16px", borderRadius: 12, border: `1px solid ${B}`, background: SH, color: T, fontSize: 16, fontFamily: BD, outline: "none" }} />
              <Btn bg={A} color="#0A0A0A" ariaLabel="Submit answer" onClick={() => { if (input.trim()) submitPlural(); }} style={{ width: "auto", padding: "14px 20px" }}>→</Btn>
            </div>
            <button type="button" onClick={revealDrill} style={{ marginBottom: 16, width: "100%", background: "transparent", border: "none", color: TD, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 6, letterSpacing: 0.3 }}>I don't know — reveal answer</button></>
          )}
          {mode === "imperativ" && !answered && (
            <><UmlautBar onInsert={insertChar} />
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input ref={typedInputRef} lang="de" className="ad-input" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && input.trim()) { const target = card[card._person]; const result = checkMatch(input, target); setInputResult(result); setAnswered(true); record(result !== "wrong", card, Date.now() - tStart); if (result === "exact") speakThenAdvance(target, nextDrill); else speak(target); } }}
                placeholder={card._person === "sie" ? "e.g. kommen Sie" : "Type the imperative…"} autoFocus autoCapitalize="off" autoCorrect="off" spellCheck="false"
                style={{ flex: 1, padding: "14px 16px", borderRadius: 12, border: `1px solid ${B}`, background: SH, color: T, fontSize: 16, fontFamily: BD, outline: "none" }} />
              <Btn bg={A} color="#0A0A0A" ariaLabel="Submit answer" onClick={() => { if (!input.trim()) return; const target = card[card._person]; const result = checkMatch(input, target); setInputResult(result); setAnswered(true); record(result !== "wrong", card, Date.now() - tStart); if (result === "exact") speakThenAdvance(target, nextDrill); else speak(target); }} style={{ width: "auto", padding: "14px 20px" }}>→</Btn>
            </div>
            <button type="button" onClick={revealDrill} style={{ marginBottom: 16, width: "100%", background: "transparent", border: "none", color: TD, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 6, letterSpacing: 0.3 }}>I don't know — reveal answer</button></>
          )}
          {(mode === "listening" || mode === "confusion" || mode === "exam") && !answered && card.opts && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
              {card.opts.map((opt, i) => <button key={i} onClick={() => handleDrillAnswer(i)} style={{ padding: "14px 16px", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer", background: SH, border: `2px solid ${B}`, color: T, fontFamily: BD, textAlign: "left" }}>{opt}</button>)}
            </div>
          )}
          {(mode === "listening" || mode === "confusion" || mode === "exam") && answered && card.opts && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
              {card.opts.map((opt, i) => { const isC = i === card.correctIdx; const wasS = i === sel;
                return (<div key={i} style={{ padding: "14px 16px", borderRadius: 12, fontSize: 14, fontWeight: 600, background: isC ? "#0A1A0A" : wasS ? "#1A0000" : SH, border: `2px solid ${isC ? G : wasS ? R : B}`, color: isC ? G : wasS ? R : TD, fontFamily: BD, textAlign: "left" }}>{opt}{isC ? " ✓" : wasS ? " ✗" : ""}</div>);
              })}
            </div>
          )}
          {mode === "article" && !answered && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {["der", "die", "das"].map((art, i) => <button key={i} onClick={() => handleDrillAnswer(i)} style={{ padding: "16px", borderRadius: 14, fontSize: 18, fontWeight: 700, cursor: "pointer", background: SH, border: `2px solid ${B}`, color: T, fontFamily: FN }}>{art}</button>)}
            </div>
          )}
          {mode === "article" && answered && (() => {
            const gr = genderRule(card.noun, card.article);
            return (<>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                {["der", "die", "das"].map((art, i) => { const isC = art === card.article; const wasS = i === sel;
                  return (<div key={i} style={{ padding: "16px", borderRadius: 14, fontSize: 18, fontWeight: 700, background: isC ? "#0A1A0A" : wasS ? "#1A0000" : SH, border: `2px solid ${isC ? G : wasS ? R : B}`, color: isC ? G : wasS ? R : TD, fontFamily: FN, textAlign: "center" }}>{art}{isC ? " ✓" : wasS ? " ✗" : ""}</div>);
                })}
              </div>
              {!skipSummary && <GrammarNote note={gr} />}
            </>);
          })()}
          {mode === "verb" && !answered && card.opts && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {card.opts.map((opt, i) => <button key={i} onClick={() => handleDrillAnswer(i)} style={{ padding: "14px", borderRadius: 14, fontSize: 16, fontWeight: 700, cursor: "pointer", background: SH, border: `2px solid ${B}`, color: T, fontFamily: FN }}>{opt}</button>)}
            </div>
          )}
          {mode === "verb" && answered && card.opts && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {card.opts.map((opt, i) => { const isC = i === card.correctIdx; const wasS = i === sel;
                return (<div key={i} style={{ padding: "14px", borderRadius: 14, fontSize: 16, fontWeight: 700, background: isC ? "#0A1A0A" : wasS ? "#1A0000" : SH, border: `2px solid ${isC ? G : wasS ? R : B}`, color: isC ? G : wasS ? R : TD, fontFamily: FN, textAlign: "center" }}>{opt}{isC ? " ✓" : wasS ? " ✗" : ""}</div>);
              })}
            </div>
          )}
          {mode === "verb" && !answered && !card.opts && (
            <><UmlautBar onInsert={insertChar} />
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input ref={typedInputRef} lang="de" className="ad-input" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && input.trim()) { setAnswered(true); const result = checkMatch(input, card.correct); setInputResult(result); record(result !== "wrong", card, Date.now() - tStart); const say = `${card.pron} ${card.correct}`; if (result === "exact") speakThenAdvance(say, nextDrill); else speak(say); } }}
                placeholder={`${card.pron} …`} autoFocus autoCapitalize="off" autoCorrect="off" spellCheck="false"
                style={{ flex: 1, padding: "14px 16px", borderRadius: 12, border: `1px solid ${B}`, background: SH, color: T, fontSize: 16, fontFamily: BD, outline: "none" }} />
              <Btn bg={A} color="#0A0A0A" ariaLabel="Submit answer" onClick={() => { if (!input.trim()) return; setAnswered(true); const result = checkMatch(input, card.correct); setInputResult(result); record(result !== "wrong", card, Date.now() - tStart); const say = `${card.pron} ${card.correct}`; if (result === "exact") speakThenAdvance(say, nextDrill); else speak(say); }} style={{ width: "auto", padding: "14px 20px" }}>→</Btn>
            </div>
            <button type="button" onClick={revealDrill} style={{ width: "100%", background: "transparent", border: "none", color: TD, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 6, letterSpacing: 0.3 }}>I don't know — reveal answer</button></>
          )}
          <div style={{ marginTop: composed ? 0 : "auto", paddingTop: 16, paddingBottom: "max(28px, env(safe-area-inset-bottom))" }}>
            {answered && <Btn bg={SH} border={`1px solid ${B}`} onClick={nextDrill}>{idx < cards.length - 1 ? "Next →" : "Results"}</Btn>}
            {KeyHint({ text: mode === "article" ? "Keys 1–3 to answer · Enter for next" : (mode === "listening" || (mode === "verb" && card.opts)) ? "Keys 1–4 to answer · Enter for next" : "Enter to submit · Enter again for next" })}
          </div>
        </div>
      </div>); })()}

      {/* ── SENTENCE BUILDER ── */}
      {screen === "sentence" && card && <div style={{ padding: "0 20px", height: DVH, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {Header({ extra: <span style={{ color: A, marginRight: 6 }}>Build</span> })}
        <ProgBar pct={((idx + 1) / cards.length) * 100} color={rpt > 0 ? R : BL} />
        <div className={cardCls} onPointerDown={onAdvPointerDown} onPointerMove={onAdvPointerMove} onPointerUp={onAdvPointerUp(sbChecked, sbNext)} style={{ opacity: vis ? 1 : 0, flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div className="ad-elev" style={{ background: CARD_GRAD, border: `1px solid ${A}22`, borderRadius: 20, padding: "24px 20px", marginBottom: 16, flex: "0 0 auto", maxHeight: "100%", position: "relative", overflowX: "hidden", overflowY: "auto" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: CARD_ACCENT, opacity: 0.7 }} />
            <div style={{ fontSize: 10, color: AD, letterSpacing: 3, textTransform: "uppercase", marginBottom: 12, fontWeight: 700 }}>Build the sentence</div>
            <div style={{ fontSize: 14, color: TD, marginBottom: 16, lineHeight: 1.4 }}>"{card.en}"</div>
            <div style={{ minHeight: 52, padding: "12px 14px", borderRadius: 12, border: `2px dashed ${sbChecked ? (sbCorrect ? G : R) : B}`, background: "#0A0A0A44", display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
              {sbPicked.length === 0 && <span style={{ color: TD, fontSize: 13, fontStyle: "italic" }}>Tap words below…</span>}
              {sbPicked.map((w, i) => <button key={i} onClick={() => sbUntapWord(w, i)} disabled={sbChecked} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: sbChecked ? "default" : "pointer", background: sbChecked ? (sbCorrect ? "#0A1A0A" : "#1A0000") : SH, border: `1px solid ${sbChecked ? (sbCorrect ? G : R) : A}`, color: sbChecked ? (sbCorrect ? G : R) : T }}>{w}</button>)}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {sbPool.map((w, i) => <button key={i} onClick={() => sbTapWord(w, i)} disabled={sbChecked} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: sbChecked ? "default" : "pointer", background: S, border: `1px solid ${B}`, color: T }}>{w}</button>)}
            </div>
            {sbChecked && <div style={{ marginTop: 16 }}>
              {!sbCorrect && <div style={{ fontSize: 13, color: G, fontWeight: 600, marginBottom: 6 }}>Correct: {card.correct.join(" ")}</div>}
              <div style={{ fontSize: 12, color: TD, padding: "8px 12px", background: "#0A0A0A66", borderRadius: 8, borderLeft: `3px solid ${BL}` }}>{card.rule}</div>
              <SpeakBtn text={card.correct.join(" ")} />
              {SpeedBadge({ ms: lastElapsed })}{CardStats()}
            </div>}
          </div>
          <div style={{ marginTop: 0, paddingTop: 8, paddingBottom: "max(28px, env(safe-area-inset-bottom))" }}>
            {!sbChecked && sbPicked.length > 0 && <Btn bg={BL} color="#0A0A0A" onClick={sbCheck} style={{ fontFamily: FN }}>Check</Btn>}
            {sbChecked && <Btn bg={SH} border={`1px solid ${B}`} onClick={sbNext}>{idx < cards.length - 1 ? "Next →" : "Results"}</Btn>}
            {KeyHint({ text: "Enter to check · Enter again for next" })}
          </div>
        </div>
      </div>}

      {/* ── NEW: DIALOGUE SCREEN ── */}
      {screen === "scenarios" && <div style={{ padding: "max(16px, env(safe-area-inset-top)) 18px 24px", minHeight: DVH, overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <button onClick={() => setScreen("home")} style={{ background: "transparent", border: `1px solid ${A}33`, borderRadius: 10, color: A, fontSize: 13, cursor: "pointer", padding: "8px 14px", fontWeight: 600 }}>← Back</button>
        </div>
        <div style={{ fontFamily: FN, fontSize: 24, fontWeight: 800, margin: "10px 0 2px" }}>Your journey</div>
        <div style={{ fontSize: 13, color: TD, marginBottom: 18 }}>Real situations on the way to living and working in Germany.</div>
        {MISSION_ARCS.map(arc => {
          const ms = MISSIONS.filter(m => m.arc === arc.id);
          const done = arcDone(arc.id), total = arcTotal(arc.id);
          return (
            <div key={arc.id} style={{ marginBottom: 22 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 10 }}>
                <IconBadge name={arc.icon} size={34} color={A} bg={`${A}12`} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: FN, fontSize: 16, fontWeight: 800 }}>{arc.title}</div>
                  <div style={{ fontSize: 11, color: TD }}>{arc.sub}</div>
                </div>
                <div style={{ fontSize: 11, color: done === total && total ? G : TD, fontWeight: 800 }}>{done}/{total}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 8 }}>
                {ms.map(m => {
                  const st = missionStatus(m.id);
                  const isCur = currentMission && currentMission.id === m.id;
                  return (
                    <button key={m.id} onClick={() => openMission(m.id)} style={{ display: "flex", alignItems: "center", gap: 11, textAlign: "left", width: "100%", minWidth: 0, background: isCur ? `${A}10` : "#0F0F0F", border: `1px solid ${isCur ? A : HAIR}`, borderRadius: 12, padding: "12px 13px", cursor: "pointer", fontFamily: "inherit" }}>
                      <span style={{ width: 22, height: 22, borderRadius: 999, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: st === "done" ? G : st === "started" ? `${A}22` : "transparent", border: `1.5px solid ${st === "done" ? G : st === "started" ? A : B}` }}>
                        {st === "done" ? <Icon name="check" size={13} style={{ color: "#0A0A0A" }} /> : null}
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: T, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.cando}</span>
                        {isCur && st !== "done" && <span style={{ fontSize: 10.5, color: A, fontWeight: 800, letterSpacing: 0.3 }}>START HERE</span>}
                      </span>
                      <span style={{ fontSize: 9, fontWeight: 900, color: TD, border: `1px solid ${B}`, borderRadius: 6, padding: "2px 6px", flexShrink: 0 }}>{m.level}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>}

      {screen === "mission" && (() => {
        const m = missionById(activeMission); if (!m) return null;
        const arc = MISSION_ARCS.find(a => a.id === m.arc);
        const done = missionStatus(m.id) === "done";
        const steps = [
          { key: "learned", label: "Learn the words", sub: m.cats.join(" · "), icon: "layers" },
          { key: "listened", label: "Listen to the scene", sub: `${missionDialogues(m).length} dialogue${missionDialogues(m).length > 1 ? "s" : ""}`, icon: "headphones" },
          { key: "spoke", label: "Say it out loud", sub: "Speaking practice", icon: "mic" },
        ];
        return (
          <div style={{ padding: "max(16px, env(safe-area-inset-top)) 20px 24px", minHeight: DVH, overflowY: "auto" }}>
            <button onClick={() => setScreen("scenarios")} style={{ background: "transparent", border: `1px solid ${A}33`, borderRadius: 10, color: A, fontSize: 13, cursor: "pointer", padding: "8px 14px", fontWeight: 600 }}>← Journey</button>
            <div style={{ fontSize: 10.5, color: TD, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", margin: "16px 0 6px" }}>{arc ? arc.title : ""} · {m.level}</div>
            <div style={{ fontSize: 12, color: TD, marginBottom: 2 }}>After this you'll be able to</div>
            <div style={{ fontFamily: FN, fontSize: 23, fontWeight: 800, lineHeight: 1.2, marginBottom: 18 }}>{m.cando}.</div>
            {done && <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 14px", background: `${G}14`, border: `1px solid ${G}55`, borderRadius: 12, marginBottom: 16, color: G, fontWeight: 800, fontSize: 13 }}><Icon name="check" size={16} /> You can now {m.cando.charAt(0).toLowerCase() + m.cando.slice(1)}.</div>}
            <div style={{ display: "grid", gap: 10 }}>
              {steps.map(s => {
                const sd = missionStepDone(m.id, s.key);
                return (
                  <button key={s.key} onClick={() => launchMissionStep(m, s.key)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", background: "#0F0F0F", border: `1px solid ${sd ? G : A}33`, borderRadius: 14, padding: "14px 14px", cursor: "pointer", fontFamily: "inherit" }}>
                    <IconBadge name={s.icon} size={36} color={sd ? G : A} bg={sd ? `${G}12` : `${A}12`} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 14.5, fontWeight: 800, color: T }}>{s.label}</span>
                      <span style={{ display: "block", fontSize: 11, color: TD, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.sub}</span>
                    </span>
                    {sd ? <Icon name="check" size={18} style={{ color: G }} /> : <Icon name="chevron" size={16} style={{ color: TD, transform: "rotate(-90deg)" }} />}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 11, color: TD, textAlign: "center", marginTop: 16, lineHeight: 1.5 }}>Finish all three to complete the mission. The words you practise here count toward your normal progress too.</div>
          </div>
        );
      })()}

      {screen === "dialogues" && <div style={{ padding: "max(16px, env(safe-area-inset-top)) 20px 0", minHeight: DVH, display: "flex", flexDirection: "column" }}>
        {(() => {
          const pool = (cards && cards.length) ? cards : DIALOGUES;
          const dlg = pool[dlgIdx];
          if (!dlg) return null;
          return (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <button onClick={() => { dlgStopPlay(); if (missionReturnRef.current) { const id = missionReturnRef.current.id; setActiveMission(id); setScreen("mission"); } else setScreen("home"); }} style={{ background: "transparent", border: `1px solid ${A}33`, borderRadius: 10, color: A, fontSize: 13, cursor: "pointer", padding: "8px 14px", fontWeight: 600, letterSpacing: 0.3 }}>← Back</button>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {dlg.level && <span style={{ fontSize: 9, fontWeight: 900, color: A, border: `1px solid ${A}55`, borderRadius: 6, padding: "2px 7px", letterSpacing: 0.5 }}>{dlg.level}</span>}
                  <div style={{ fontSize: 12, color: TD, fontWeight: 600 }}>{dlgIdx + 1}/{pool.length}</div>
                </div>
              </div>
              <ProgBar pct={((dlgIdx + 1) / Math.max(pool.length, 1)) * 100} color={A} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 14, marginBottom: 4 }}>
                <div style={{ fontFamily: FN, fontSize: 21, lineHeight: 1.15 }}>{dlg.title}</div>
                <button onClick={() => playDialogue(dlg.lines)} aria-label="Play whole dialogue" style={{ display: "flex", alignItems: "center", gap: 6, background: `${A}14`, border: `1px solid ${A}44`, borderRadius: 999, color: A, fontSize: 11, fontWeight: 900, cursor: "pointer", padding: "7px 13px", flexShrink: 0 }}><Icon name="volume" size={13} /> Play all</button>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
                <span style={{ fontSize: 10.5, color: TD }}>{dlgListenFirst ? "Listen, then tap a bubble to reveal it." : "Tap a bubble to hear it and reveal the English."}</span>
                <button onClick={toggleDlgListen} aria-pressed={dlgListenFirst} style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0, background: dlgListenFirst ? `${A}14` : "transparent", border: `1px solid ${dlgListenFirst ? A : HAIR}`, borderRadius: 999, color: dlgListenFirst ? A : TD, fontSize: 10, fontWeight: 800, letterSpacing: 0.3, cursor: "pointer", padding: "5px 11px" }}>
                  <Icon name={dlgListenFirst ? "headphones" : "book"} size={12} /> {dlgListenFirst ? "Listen-first" : "Read-along"}
                </button>
              </div>
              <div style={{ flex: 1 }}>
                {dlg.lines.map((line, i) => {
                  const right = i % 2 === 1; // second speaker sits right, chat-style
                  return (
                    <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: right ? "flex-end" : "flex-start", marginBottom: 10 }}>
                      {line.speaker && <div style={{ fontSize: 9.5, color: AD, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", marginBottom: 3, padding: "0 6px" }}>{line.speaker}</div>}
                      <button type="button" aria-label={`Play and translate line ${i + 1}`} onClick={() => { dlgStopPlay(); setDlgRevealed(r => ({ ...r, [i]: true })); speak(line.de); }}
                        style={{
                          maxWidth: "86%", textAlign: "left", cursor: "pointer", padding: "11px 14px",
                          background: right ? `linear-gradient(160deg, ${A}1C 0%, ${A}0E 100%)` : "linear-gradient(160deg, #1A1A1A 0%, #121212 100%)",
                          border: `1px solid ${right ? `${A}3D` : B}`,
                          borderRadius: 16,
                          borderBottomRightRadius: right ? 5 : 16,
                          borderBottomLeftRadius: right ? 16 : 5,
                          fontFamily: "inherit",
                        }}>
                        <span style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                          {(dlgListenFirst && !dlgRevealed[i])
                            ? <span style={{ fontSize: 13.5, color: TD, lineHeight: 1.45, fontWeight: 600, fontStyle: "italic" }}>Tap to listen…</span>
                            : <span style={{ fontSize: 14.5, color: T, lineHeight: 1.45, fontWeight: 600 }}>{line.de}</span>}
                          <Icon name="volume" size={12} stroke={2.2} style={{ color: A, opacity: 0.65, flexShrink: 0, alignSelf: "center" }} />
                        </span>
                        {dlgRevealed[i] && <span style={{ display: "block", fontSize: 12, color: BL, lineHeight: 1.4, marginTop: 6 }}>{line.en}</span>}
                      </button>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: "auto", paddingTop: 18, paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>
                {dlgIdx > 0 && <Btn bg={S} border={`1px solid ${B}`} onClick={() => { dlgStopPlay(); setDlgIdx(i => i - 1); setDlgRevealed({}); }} style={{ flex: 1 }}>← Prev</Btn>}
                {dlgIdx < pool.length - 1 && <Btn bg={A} color="#0A0A0A" onClick={() => { dlgStopPlay(); setDlgIdx(i => i + 1); setDlgRevealed({}); }} style={{ flex: 1 }}>Next →</Btn>}
                {dlgIdx === pool.length - 1 && <Btn bg={SH} border={`1px solid ${B}`} onClick={() => { dlgStopPlay(); setScreen("home"); }} style={{ flex: 1 }}>Done</Btn>}
              </div>
            </>
          );
        })()}
      </div>}

      {/* ── AUDIO PLAYER SCREEN ── */}
      {screen === "audio" && <div style={{ padding: "max(16px, env(safe-area-inset-top)) 20px 0", minHeight: DVH, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <button onClick={audioExit} style={{ background: "transparent", border: `1px solid ${A}33`, borderRadius: 10, color: A, fontSize: 13, cursor: "pointer", padding: "8px 14px", fontWeight: 600, letterSpacing: 0.3 }}>← Back</button>
          <div style={{ fontSize: 12, color: TD, fontWeight: 600 }}>{idx + 1} / {cards.length}</div>
        </div>
        <ProgBar pct={((idx + 1) / Math.max(cards.length, 1)) * 100} color={A} />

        {/* Card display — large, readable from a distance */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 0" }}>
          {cards[idx] && (
            <>
              <div style={{ fontSize: 10, color: AD, letterSpacing: 3, textTransform: "uppercase", marginBottom: 16, fontWeight: 700 }}>
                {category}
              </div>
              <div className="ad-elev" style={{ background: CARD_GRAD, border: `1px solid ${A}22`, borderRadius: 20, padding: "40px 24px", width: "100%", textAlign: "center", marginBottom: 18, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: CARD_ACCENT, opacity: 0.7 }} />
                <div style={{ fontFamily: FN, fontSize: 32, color: T, fontWeight: 700, marginBottom: 14, lineHeight: 1.2 }}>
                  {cards[idx].de}
                </div>
                <div style={{ fontSize: 18, color: A, fontWeight: 500, marginBottom: 8 }}>
                  {cards[idx].en}
                </div>
                {audioIncludeExample && cards[idx].ex && (
                  <div style={{ fontSize: 13, color: TD, fontStyle: "italic", marginTop: 16, lineHeight: 1.4 }}>
                    „{cards[idx].ex}"
                  </div>
                )}
                {cards[idx]._cat && cards[idx]._cat !== category && (
                  <div style={{ fontSize: 10, color: TD, marginTop: 14, letterSpacing: 1, textTransform: "uppercase" }}>
                    {cards[idx]._cat}
                  </div>
                )}
              </div>
              {/* Position dots */}
              <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap", justifyContent: "center", maxWidth: 280 }}>
                {cards.slice(Math.max(0, idx - 4), Math.min(cards.length, idx + 5)).map((_, i) => {
                  const realIdx = Math.max(0, idx - 4) + i;
                  return (
                    <div key={realIdx} style={{
                      width: realIdx === idx ? 20 : 6,
                      height: 6,
                      borderRadius: 3,
                      background: realIdx < idx ? G : realIdx === idx ? A : B,
                      transition: "all 0.3s"
                    }} />
                  );
                })}
              </div>
              {audioPlaying && (
                <div style={{ fontSize: 11, color: A, letterSpacing: 2, textTransform: "uppercase", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon name="volume" size={13} /> Playing
                </div>
              )}
              {!audioPlaying && (
                <div style={{ fontSize: 11, color: TD, letterSpacing: 2, textTransform: "uppercase", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon name="pause" size={13} /> Paused
                </div>
              )}
            </>
          )}
        </div>

        {/* Bottom controls — thumb reach */}
        <div style={{ paddingBottom: "max(28px, env(safe-area-inset-bottom))", paddingTop: 14 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "center" }}>
            <button
              type="button"
              aria-label="Previous audio card"
              onClick={() => {
                if (idx > 0) {
                  const wasPlaying = audioPlayingRef.current;
                  audioPause();
                  setIdx(i => Math.max(0, i - 1));
                  if (wasPlaying) setTimeout(() => audioResume(), 120);
                }
              }}
              disabled={idx === 0}
              style={{ width: 56, height: 56, borderRadius: "50%", background: PANEL_GRAD, border: `1px solid ${HAIR}`, color: idx === 0 ? B : T, fontSize: 22, cursor: idx === 0 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="skipBack" size={22} />
            </button>
            <button
              type="button"
              aria-label={audioPlaying ? "Pause audio mode" : "Resume audio mode"}
              onClick={() => audioPlaying ? audioPause() : audioResume()}
              style={{ width: 72, height: 72, borderRadius: "50%", background: A, border: "none", color: "#0A0A0A", fontSize: 28, cursor: "pointer", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 20px ${A}44` }}>
              <Icon name={audioPlaying ? "pause" : "play"} size={28} stroke={2.2} />
            </button>
            <button
              type="button"
              aria-label="Next audio card"
              onClick={() => {
                const wasPlaying = audioPlayingRef.current;
                audioPause();
                if (idx + 1 < cards.length) {
                  setIdx(i => i + 1);
                  if (wasPlaying) setTimeout(() => audioResume(), 120);
                } else {
                  setScreen("results");
                  setStats({ c: cards.length, w: 0 });
                }
              }}
              style={{ width: 56, height: 56, borderRadius: "50%", background: PANEL_GRAD, border: `1px solid ${HAIR}`, color: T, fontSize: 22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="skipForward" size={22} />
            </button>
          </div>
          <div style={{ textAlign: "center", fontSize: 10, color: TD, marginTop: 14, letterSpacing: 1 }}>
            {audioEnFirst ? "EN → DE" : "DE → EN"} · {audioPauseLen / 1000}s pause
          </div>
        </div>
      </div>}

      {/* ── RESULTS ── */}
      {screen === "results" && (() => {
        const totalAns = stats.c + stats.w;
        const acc = totalAns > 0 ? Math.round((stats.c / totalAns) * 100) : null;
        const good = failed.length === 0;
        // Reward the finish: a flawless first pass (no repeats, 100%) or a strong cleared
        // session earns confetti + a louder headline, so the completion moment is as alive
        // as the in-session rewards instead of a flat "complete".
        const flawless = rpt === 0 && acc === 100 && totalAns > 0;
        const strong = good && acc != null && acc >= 85;
        const party = (flawless || strong) && mode !== "audio";
        const headline = mode === "audio" ? "Nice listening" : flawless ? "Perfect!" : strong ? "Strong session" : good ? "Session complete" : "Keep going";
        const heroColor = good || party ? G : A;
        const modeLabel = mode === "vocab" ? "DE→EN" : mode === "production" ? "EN→DE" : mode === "speaking" ? "Speak" : mode === "article" ? "der/die/das" : mode === "plural" ? "Plural" : mode === "cloze" ? "Cloze" : mode === "verb" ? "Verb" : mode === "sentence" ? "Sentence" : mode === "imperativ" ? "Imperative" : mode === "listening" ? "Listening" : mode === "audio" ? "Audio" : mode;
        const R1 = 50, C1 = 2 * Math.PI * R1;
        const goalPct = Math.min(1, dailyStats.count / Math.max(dailyGoal, 1));
        return (
          <div style={{ padding: "0 20px max(28px, env(safe-area-inset-bottom))", minHeight: DVH, display: "flex", flexDirection: "column", position: "relative" }}>
            {party && <Confetti top="16%" />}
            <div style={{ paddingTop: "max(24px, env(safe-area-inset-top))", textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: heroColor, fontWeight: 800, letterSpacing: 3, textTransform: "uppercase" }}>{headline}</div>
              <div style={{ fontSize: 12, color: TD, marginTop: 5 }}>{category}{rpt > 0 ? ` · Round ${rpt + 1}` : ""} · <span style={{ color: A, fontWeight: 700 }}>{modeLabel}</span></div>
            </div>

            {/* Session summary — marginTop:auto pairs with the actions' marginTop:auto to
                center the summary/failed block evenly between the title and the buttons. */}
            <div style={{ background: PANEL_GRAD, border: `1px solid ${HAIR}`, borderRadius: 18, padding: "20px 18px 16px", marginTop: "auto", marginBottom: 14, position: "relative", overflow: "hidden", boxShadow: ELEV, textAlign: "center" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: FLAG, opacity: 0.85 }} />
              {mode === "audio" ? (
                /* Audio is passive listening — no graded answers, so no accuracy fiction. */
                <div style={{ padding: "14px 0 10px" }}>
                  <div style={{ fontFamily: FN, fontSize: 52, color: A, fontWeight: 800, lineHeight: 1 }}><CountUp value={stats.c} /></div>
                  <div style={{ fontSize: 10, color: TD, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.4, marginTop: 6 }}>Phrases heard</div>
                </div>
              ) : (
                <>
                  <div style={{ position: "relative", width: 124, height: 124, margin: "6px auto 10px" }}>
                    <svg width="124" height="124" viewBox="0 0 124 124">
                      <circle cx="62" cy="62" r={R1} fill="none" stroke="#1D1D1D" strokeWidth="9" />
                      {acc != null && <circle className="ad-ringin" cx="62" cy="62" r={R1} fill="none" stroke={acc >= 80 ? G : acc >= 60 ? A : R} strokeWidth="9" strokeLinecap="round"
                        strokeDasharray={C1} strokeDashoffset={C1 * (1 - acc / 100)} transform="rotate(-90 62 62)" style={{ "--c": `${C1}` }} />}
                    </svg>
                    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ fontFamily: FN, fontSize: 30, fontWeight: 800, color: acc == null ? TD : acc >= 80 ? G : acc >= 60 ? A : R, lineHeight: 1 }}>{acc == null ? "–" : <CountUp value={acc} format={n => `${n}%`} />}</div>
                      <div style={{ fontSize: 9, color: TD, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", marginTop: 3 }}>accuracy</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: `${G}12`, border: `1px solid ${G}33`, borderRadius: 999, padding: "6px 14px", color: G, fontSize: 13, fontWeight: 800 }}>✓ <CountUp value={stats.c} /></span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: stats.w > 0 ? `${R}12` : "#141414", border: `1px solid ${stats.w > 0 ? `${R}33` : B}`, borderRadius: 999, padding: "6px 14px", color: stats.w > 0 ? "#F87171" : TD, fontSize: 13, fontWeight: 800 }}>✗ <CountUp value={stats.w} /></span>
                  </div>
                  {/* Earned progress — real SRS gains (mastery crossings, new words), not points.
                      Only shows when you actually moved the needle, so it always means something. */}
                  {(() => {
                    const g = sessionGains.current;
                    const items = [
                      g.mastered > 0 && { label: "Mastered ★", value: g.mastered, color: G },
                      g.learned > 0 && { label: "New words", value: g.learned, color: A },
                    ].filter(Boolean);
                    if (!items.length) return null;
                    return (
                      <div style={{ display: "flex", justifyContent: "center", gap: 26, marginTop: 16, paddingTop: 14, borderTop: `1px solid ${B}66` }}>
                        {items.map(it => (
                          <div key={it.label} style={{ textAlign: "center" }}>
                            <div style={{ fontFamily: FN, fontSize: 22, fontWeight: 800, color: it.color, lineHeight: 1 }}>+<CountUp value={it.value} /></div>
                            <div style={{ fontSize: 9, color: TD, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.7, marginTop: 4 }}>{it.label}</div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </>
              )}
              {/* Session → daily goal connection */}
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${B}55`, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 10, color: TD, fontWeight: 700, letterSpacing: 0.4, flexShrink: 0 }}>Today</span>
                <div style={{ flex: 1, height: 5, background: "#0A0A0A", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${goalPct * 100}%`, background: dailyStats.count >= dailyGoal ? G : A, borderRadius: 3, transition: "width .5s ease" }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 800, color: dailyStats.count >= dailyGoal ? G : T, flexShrink: 0 }}>{dailyStats.count}<span style={{ color: TD, fontWeight: 700 }}> / {dailyGoal}</span></span>
              </div>
            </div>

            {newlyMastered.length > 0 && <div className="ad-mastery-burst" style={{ margin: "0 0 14px", padding: "14px 14px 12px", background: `linear-gradient(145deg, ${G}14, #0F0F0F 68%)`, border: `1px solid ${G}55`, borderRadius: 14, textAlign: "left", boxShadow: `0 0 24px ${G}12` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <IconBadge name="trophy" size={30} color={G} />
                  <div>
                    <div style={{ color: G, fontSize: 10, fontWeight: 900, letterSpacing: 1.2, textTransform: "uppercase" }}>Newly mastered</div>
                    <div style={{ color: T, fontFamily: FN, fontSize: 16, fontWeight: 900 }}>{newlyMastered.length} card{newlyMastered.length === 1 ? "" : "s"}</div>
                  </div>
                </div>
                <div style={{ color: TD, fontSize: 10, textAlign: "right" }}>5/5 production<br />streak</div>
              </div>
              <div style={{ display: "grid", gap: 7 }}>
                {newlyMastered.slice(0, 5).map(item => (
                  <div key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "7px 0", borderTop: `1px solid ${B}55`, fontSize: 12 }}>
                    <span style={{ color: T, fontWeight: 900 }}>{item.de}</span>
                    {item.en && <span style={{ color: TD, textAlign: "right" }}>{item.en}</span>}
                  </div>
                ))}
              </div>
              {newlyMastered.length > 5 && <div style={{ color: TD, fontSize: 10, textAlign: "center", paddingTop: 8 }}>+ {newlyMastered.length - 5} more</div>}
            </div>}

            {failedNames.length > 0 && <div style={{ marginBottom: 14, background: "linear-gradient(180deg, #161010 0%, #100C0C 100%)", border: `1px solid ${R}30`, borderRadius: 14, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 14px 9px", borderBottom: `1px solid ${R}22` }}>
                <Icon name="refresh" size={14} style={{ color: "#F87171" }} />
                <span style={{ fontSize: 11, color: "#F87171", fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", flex: 1 }}>To repeat</span>
                <span style={{ fontSize: 11, color: TD, fontWeight: 700 }}>{failed.length}</span>
              </div>
              <div style={{ padding: "6px 14px 10px", maxHeight: 120, overflowY: "auto" }}>
                {failedNames.map((n, i) => (<div key={i} style={{ fontSize: 12.5, color: T, padding: "5px 0", borderBottom: i < failedNames.length - 1 ? `1px solid ${B}44` : "none" }}>{n}</div>))}
              </div>
            </div>}

            <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10, paddingTop: 10 }}>
              {failed.length > 0 ? <>
                <Btn bg={R} color="#FFF" onClick={startRepeat} style={{ fontFamily: FN, fontSize: 15, fontWeight: 800 }}>Repeat {failed.length} Failed Card{failed.length !== 1 ? "s" : ""}</Btn>
                <Btn bg={SH} border={`1px solid ${B}`} onClick={() => setScreen("home")} style={{ fontWeight: 600 }}>Back to home</Btn>
              </> : <>
                <Btn bg={A} color="#0A0A0A" onClick={() => setScreen("home")} style={{ fontFamily: FN, fontSize: 15, fontWeight: 800 }}>Weiter</Btn>
                {lastSession && lastSession.cat !== "__due__" && <Btn bg={SH} border={`1px solid ${B}`} onClick={() => startSession(lastSession.cat, lastSession.m, lastSession.count)} style={{ fontWeight: 600, fontSize: 13 }}>Go again — {lastSession.label}</Btn>}
              </>}
            </div>
          </div>
        );
      })()}

      {/* Spacer keeps tab-screen content clear of the fixed bottom nav — sized to the
          nav incl. the home-indicator safe area, so the last row is never clipped. */}
      {["home", "train", "library", "stats"].includes(screen) && <div style={{ height: "calc(72px + env(safe-area-inset-bottom))" }} />}
      </div>

      {/* ── BOTTOM TAB NAVIGATION (hidden during sessions for focus) ── */}
      {["home", "train", "library", "stats"].includes(screen) && (
        <nav aria-label="Main navigation" style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, zIndex: 90, background: "rgba(9,9,9,0.86)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderTop: `1px solid ${HAIR}` }}>
          <div style={{ height: 2, background: FLAG, opacity: 0.5 }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}>
            {[["home", "Home", "home"], ["library", "Library", "book"], ["train", "Train", "bolt"], ["stats", "Progress", "chart"]].map(([id, label, icon]) => {
              const active = screen === id;
              return (
                <button key={id} type="button" aria-current={active ? "page" : undefined}
                  onClick={() => { if (id === "tutor") tutorReturnRef.current = "home"; setScreen(id); }}
                  style={{ background: "transparent", border: "none", cursor: "pointer", padding: "10px 0 6px", display: "grid", justifyItems: "center", gap: 4, color: active ? A : TD, fontFamily: "inherit" }}>
                  {id === "stats"
                    ? <span style={{ display: "inline-flex" }}><ProgressIcon size={21} color={active ? A : TD} active={active} /></span>
                    : <span style={{ display: "inline-flex" }}><Icon name={icon} size={21} stroke={active ? 2.2 : 1.9} /></span>}
                  <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 0.4 }}>{label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}


ReactDOM.createRoot(document.getElementById('root')).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
);
