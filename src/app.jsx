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

// Deterministic id from any card shape. An explicit `id` (see src/data.js editing
// rules) wins, so content strings can be corrected without orphaning progress.
const cardId = (card) => card.id || card._id || card.de || card.q || card.a || (card.article && card.noun ? `${card.article} ${card.noun}` : null) || (card.verb ? `${card.verb}-${card.pron}-${card.tense}` : null) || (card.correct && card.correct.join(" ")) || "unknown";

const MODE_SUMMARY_LABELS = {
  vocab: "recognition",
  production: "production",
  article: "articles",
  cloze: "cloze",
  verb: "verbs",
  sentence: "sentences",
  imperativ: "imperative",
  listening: "listening",
  audio: "audio",
};
const modeSummaryLabel = (mode) => MODE_SUMMARY_LABELS[mode] || mode;
const formatModeBreakdown = (byMode) => Object.entries(byMode).map(([m, arr]) => `${arr.length} ${modeSummaryLabel(m)}`).join(" · ");

// CEFR level of a vocab card. New content sets `level` explicitly; older cards derive a
// v1 heuristic from difficulty so every card is filterable by level (A1/A2/B1).
const LEVEL_FROM_DIFF = { easy: "A1", medium: "A2", hard: "B1" };
const cardLevel = (w) => w.level || LEVEL_FROM_DIFF[w.diff] || "A2";
const LEVELS = ["A1", "A2", "B1"];

// "Mark as known" identity for a vocab word — mode-agnostic (knowing "Hallo" suppresses it
// in both recall and production). Kept separate from progress keys, which are per-mode.
const knownKey = (cat, de) => `${cat}::${de}`;

// Flat list of every vocab card tagged with its category — used by the word browser.
const allVocab = () => Object.entries(V).flatMap(([c, ws]) => ws.map(w => ({ ...w, _cat: c })));

// Nouns whose dictionary form is plural-only (die Eltern, die Unterlagen, …) —
// excluded from der/die/das practice, which would otherwise teach the plural
// article as if it were the noun's gender.
const PLURAL_ONLY_NOUNS = new Set(["Eltern","Haare","Pilze","Leute","Geschwister","Möbel","Lebensmittel","Ferien","Nachrichten","Daten","Kopfhörer","Unterlagen","Nebenkosten","Schulden","Zinsen","Ausgaben","Raten"]);

function getNouns() {
  const n = [];
  Object.entries(V).forEach(([c, ws]) => { ws.forEach(w => { if (!w?.de) return; const m = w.de.match(/^(der|die|das) (.+)$/); if (m && !PLURAL_ONLY_NOUNS.has(m[2])) n.push({ article: m[1], noun: m[2], en: w.en, cat: c }); }); });
  return n;
}

function makeVerbQ(tense = "present") {
  const vb = VERBS[0 | Math.random() * VERBS.length];
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
  const correct = vb.pr[key];
  const allF = [...new Set(Object.values(vb.pr))].filter(f => f !== correct);
  const wrongs = sh(allF).slice(0, 3); while (wrongs.length < 3) wrongs.push(correct + "e");
  const opts = sh([correct, ...wrongs]);
  return { verb: vb.v, en: vb.en, pron, correct, opts, correctIdx: opts.indexOf(correct), tense: "Präsens", hint: `${pron} → ${correct}` };
}

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
    const pref = voices.find(v => v.lang.startsWith(lang.slice(0, 2)));
    if (pref) u.voice = pref;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

// Fire-and-forget wrapper used by tap-to-speak buttons (UI doesn't await).
function speak(text) { speakWith(text); }

function normalize(s) { return s.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9 ]/g, "").trim(); }

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

function checkMatch(input, target) {
  const ni = normalize(input), nt = normalize(target);
  if (ni === nt) return "exact";
  const parts = target.split("/").map(s => s.trim());
  for (const p of parts) if (normalize(p) === ni) return "exact";
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

// ── Color palette (module scope so hoisted components can reference) ──
const PAL = {
  A: "#FFCC00", AD: "#CC9900", BG: "#0A0A0A", S: "#111111", SH: "#1A1A1A", B: "#2A2A2A",
  G: "#4ADE80", R: "#DD0000", T: "#F0EDE5", TD: "#8A857D", BL: "#60A5FA", CARD: "#151515",
};

// Visible in Settings → App Updates. Bump whenever you deploy a meaningful change
// so you can confirm at a glance which build is running on the device.
const APP_VERSION = "2026.06.09.4";

// 100dvh tracks the *visible* viewport on mobile (no jump when the URL bar collapses);
// fall back to 100vh where dvh is unsupported (pre-2022 browsers).
const DVH = (typeof CSS !== "undefined" && CSS.supports && CSS.supports("height: 100dvh")) ? "100dvh" : "100vh";

const ICONS = {
  settings: "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm8.5 3.5a7.5 7.5 0 0 0-.08-1.1l2.08-1.6-2-3.46-2.45 1a8.2 8.2 0 0 0-1.9-1.1L15.8 3h-4l-.35 2.74a8.2 8.2 0 0 0-1.9 1.1l-2.45-1-2 3.46 2.08 1.6a7.5 7.5 0 0 0 0 2.2L5.1 14.7l2 3.46 2.45-1a8.2 8.2 0 0 0 1.9 1.1L11.8 21h4l.35-2.74a8.2 8.2 0 0 0 1.9-1.1l2.45 1 2-3.46-2.08-1.6c.05-.36.08-.73.08-1.1Z",
  play: "M8 5v14l11-7-11-7Z",
  pause: "M8 5h3v14H8V5Zm5 0h3v14h-3V5Z",
  skipBack: "M19 5v14l-9-7 9-7ZM5 5v14",
  skipForward: "M5 5v14l9-7-9-7ZM19 5v14",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  arrowLeft: "M19 12H5M11 6l-6 6 6 6",
  refresh: "M20 6v5h-5M4 18v-5h5M18.5 9a7 7 0 0 0-12-2.5L4 9m16 6-2.5 2.5A7 7 0 0 1 5.5 15",
  book: "M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 0-4-4V4Zm0 0v12",
  layers: "M12 3 3 8l9 5 9-5-9-5Zm-7 9 7 4 7-4M5 16l7 4 7-4",
  headphones: "M4 13a8 8 0 0 1 16 0v5a2 2 0 0 1-2 2h-2v-7h4M4 13h4v7H6a2 2 0 0 1-2-2v-5Z",
  keyboard: "M4 7h16v10H4V7Zm3 3h.01M10 10h.01M13 10h.01M16 10h.01M7 14h10",
  target: "M12 3v3M12 18v3M3 12h3M18 12h3M7.5 7.5l2.1 2.1M14.4 14.4l2.1 2.1M16.5 7.5l-2.1 2.1M9.6 14.4l-2.1 2.1M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
  calendar: "M7 3v3M17 3v3M4 8h16M5 5h14v16H5V5Z",
  clock: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 4v4l3 2",
  chart: "M5 19V5M5 19h15M9 16v-5M13 16V8M17 16v-8",
  check: "M20 6 9 17l-5-5",
  shield: "M12 3 5 6v5c0 4.5 2.8 8 7 10 4.2-2 7-5.5 7-10V6l-7-3Z",
  wifi: "M5 10a10 10 0 0 1 14 0M8 13a6 6 0 0 1 8 0M11 16a2 2 0 0 1 2 0M12 19h.01",
  save: "M5 4h12l2 2v14H5V4Zm3 0v6h8V4M8 20v-6h8v6",
  upload: "M12 16V4M7 9l5-5 5 5M5 20h14",
  download: "M12 4v12M7 11l5 5 5-5M5 20h14",
  volume: "M4 10v4h4l5 4V6l-5 4H4Zm13-2a5 5 0 0 1 0 8M19 5a9 9 0 0 1 0 14",
  home: "M4 11 12 4l8 7v9h-5v-6H9v6H4v-9Z",
  users: "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-1a3 3 0 1 0 0-6M2 20a6 6 0 0 1 12 0M14 20a5 5 0 0 1 8 0",
  heart: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z",
  hand: "M7 11V6a2 2 0 0 1 4 0v5M11 10V5a2 2 0 0 1 4 0v6M15 11V7a2 2 0 0 1 4 0v5c0 5-3 8-7 8h-1a6 6 0 0 1-6-6v-3a2 2 0 0 1 4 0v2",
  utensils: "M6 3v8M4 3v5a2 2 0 0 0 4 0V3M6 11v10M15 3v18M18 3v7a3 3 0 0 1-3 3",
  sofa: "M5 12V9a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3M4 12h16v6H4v-6Zm2 6v2m12-2v2",
  medical: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 5v8M8 12h8",
  smile: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16ZM9 10h.01M15 10h.01M8.5 14a5 5 0 0 0 7 0",
  megaphone: "M4 10v4h4l9 4V6l-9 4H4Zm4 4v5M17 9a4 4 0 0 1 0 6",
  cart: "M4 5h2l2 10h9l2-7H7M9 20h.01M17 20h.01",
  grid: "M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z",
  alert: "M12 3 2 21h20L12 3Zm0 6v5m0 3h.01",
  calendarCheck: "M7 3v3M17 3v3M4 8h16M5 5h14v16H5V5Zm4 10 2 2 4-5",
  palette: "M12 4a8 8 0 0 0 0 16h1.5a2 2 0 0 0 1.4-3.4l-.3-.3a1 1 0 0 1 .7-1.7H17a5 5 0 0 0 0-10H12ZM7.5 11h.01M9.5 8h.01M13 7.5h.01",
  bolt: "M13 2 4 14h7l-1 8 9-12h-7l1-8Z",
  cloud: "M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11-2A5 5 0 0 0 7 18Z",
  map: "M9 18 4 20V6l5-2 6 2 5-2v14l-5 2-6-2Zm0 0V4m6 16V6",
  briefcase: "M9 6V4h6v2M4 7h16v12H4V7Zm0 5h16",
  message: "M4 5h16v11H8l-4 4V5Z",
  chip: "M8 8h8v8H8V8Zm-4 3h4M4 15h4M16 11h4M16 15h4M11 4v4M15 4v4M11 16v4M15 16v4",
  trophy: "M8 4h8v3a4 4 0 0 1-8 0V4Zm0 1H5a3 3 0 0 0 3 5M16 5h3a3 3 0 0 1-3 5M12 11v5M9 20h6M10 16h4",
  link: "M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1",
};

const Icon = React.memo(({ name, size = 18, stroke = 1.8, style }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" style={{ display: "block", flexShrink: 0, ...style }}>
    <path d={ICONS[name] || ICONS.book} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
));

const IconBadge = React.memo(({ name, color = PAL.A, bg = "#0A0A0A66", size = 32 }) => (
  <span style={{ width: size, height: size, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", color, background: bg, border: `1px solid ${color}22`, flexShrink: 0 }}>
    <Icon name={name} size={Math.max(16, size - 14)} />
  </span>
));

// ── Hoisted stateless components — defined once at module scope instead of
// re-created every App render. The three heaviest-used components in the tree. ──
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
  <div style={{ height: 3, background: PAL.B, borderRadius: 2, marginBottom: 18, overflow: "hidden" }}>
    <div style={{
      height: "100%",
      width: `${pct}%`,
      background: color === PAL.R
        ? `linear-gradient(90deg, ${PAL.R}99, ${PAL.R})`
        : `linear-gradient(90deg, ${PAL.AD}, ${PAL.A})`,
      borderRadius: 2,
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

function App() {
  const [screen, setScreen] = useState("home");
  const [mode, setMode] = useState("vocab");
  const [cards, setCards] = useState([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [stats, setStats] = useState({ c: 0, w: 0 });
  const [failed, setFailed] = useState([]);
  const [failedNames, setFailedNames] = useState([]);
  const [rpt, setRpt] = useState(0);
  const [prog, setProg] = useState({});
  const [known, setKnown] = useState(() => new Set());   // vocab words the user marked as known (knownKey)
  const [setupLevel, setSetupLevel] = useState("all");    // session level filter: "all" | A1 | A2 | B1
  const [browseQuery, setBrowseQuery] = useState("");     // word-browser search text
  const [browseKnownOnly, setBrowseKnownOnly] = useState(false); // word-browser: show only known words
  const [showEx, setShowEx] = useState(false);
  const [showHint, setShowHint] = useState(false); // NEW: mnemonic hint toggle
  const [vis, setVis] = useState(true);
  const [feedback, setFeedback] = useState(null); // "correct" | "wrong" | null — drives answer-feedback animation
  const [showSetup, setShowSetup] = useState(false);
  const [setupCat, setSetupCat] = useState(null);
  const [setupMode, setSetupMode] = useState("vocab");
  const [sessLen, setSessLen] = useState(15);
  const [category, setCategory] = useState("");
  const [input, setInput] = useState("");
  const [inputResult, setInputResult] = useState(null);
  const [sel, setSel] = useState(null);
  const [tStart, setTStart] = useState(0);
  const [lastElapsed, setLastElapsed] = useState(0); // NEW: for automaticity display
  const [revealElapsed, setRevealElapsed] = useState(0);
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
  // Audio mode state
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioPauseLen, setAudioPauseLen] = useState(3500); // ms between utterances
  const [audioEnFirst, setAudioEnFirst] = useState(false); // EN→DE order instead of DE→EN
  const [audioIncludeExample, setAudioIncludeExample] = useState(false);
  // NEW: Dialogue state
  const [dlgIdx, setDlgIdx] = useState(0);
  const [dlgRevealed, setDlgRevealed] = useState({});
  // NEW: Streak + daily stats
  const [dailyStats, setDailyStats] = useState({ date: todayKey(), count: 0, streak: 0 });
  // User-adjustable daily goal (cards/day target). Default 20 preserves behaviour for existing users.
  const [dailyGoal, setDailyGoal] = useState(20);
  // Daily trend stats: { "YYYY-MM-DD": {attempts, correct, totalMs}, ... } — last 60 days
  // Only the FIRST attempt on each card per session is counted (repeats don't reflect real recall).
  const [trendStats, setTrendStats] = useState({});
  const [showTrendBreakdown, setShowTrendBreakdown] = useState(false);
  const [selectedProgressCat, setSelectedProgressCat] = useState(CATS[0] || "");
  const [showMasteredList, setShowMasteredList] = useState(false);
  const [newlyMastered, setNewlyMastered] = useState([]);
  const [masteryBurst, setMasteryBurst] = useState(null);
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
  // Audio-mode playback control. audioTimer = setTimeout id for next step; wakeLockRef
  // holds the Screen Wake Lock so the phone doesn't dim/sleep during playback.
  const audioTimerRef = useRef(null);
  const audioPlayingRef = useRef(false); // mirrors audioPlaying for use inside async callbacks
  const wakeLockRef = useRef(null);
  // Keys of cards already counted toward trend stats this session. Resets on new session start;
  // explicitly NOT reset by startRepeat — repeats must not affect averages.
  const countedKeysRef = useRef(new Set());
  // Listening mode "Play all" — stores timer IDs so we can cancel the chain on re-tap
  const playAllTimersRef = useRef([]);
  // Prevent double-taps from scheduling two "next card" transitions and pushing idx past cards.length.
  const navLockRef = useRef(false);
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
            // New day: carry streak if yesterday was active (count > 0), else reset.
            // Do NOT increment here — record() handles increment when user actually records.
            const yesterday = todayKey(new Date(Date.now() - 86400000));
            const wasActiveYesterday = parsed.date === yesterday && (parsed.count || 0) > 0;
            const newStreak = wasActiveYesterday ? parsed.streak : 0;
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
      saveDaily(d);
      return d;
    });
  }, [saveDaily]);

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
      prog, dailyStats, lastSession, dailyGoal, trendStats,
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
            if (new Date(k).getTime() >= cutoff) pruned[k] = v;
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

  // Esc key closes any open modal — matches hardware-keyboard expectations (e.g. iPad users)
  useEffect(() => {
    if (!showSetup && !showSettings) return;
    const onKey = e => {
      if (e.key === "Escape") {
        if (showSettings) setShowSettings(false);
        else if (showSetup) setShowSetup(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showSetup, showSettings]);

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
  const triggerFeedback = (kind) => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    setFeedback(kind);
    feedbackTimerRef.current = setTimeout(() => setFeedback(null), 600);
  };

  // Insert a German special character into the focused typed-answer input at the caret.
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
    const productionStreak = mode === "production"
      ? (correct ? (prev.stats.productionStreak || 0) + 1 : 0)
      : (prev.stats.productionStreak || 0);
    const unlockedMastery = mode === "production" && correct && (prev.stats.productionStreak || 0) < MASTERY_STREAK && productionStreak >= MASTERY_STREAK;
    const masteredAt = mode === "production"
      ? (productionStreak >= MASTERY_STREAK ? (prev.stats.masteredAt || now) : null)
      : (prev.stats.masteredAt || null);

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
          box: nextBox(prev.srs.box, correct, prev.srs.lastReviewed, now),
          lastReviewed: now,
        },
      },
    };
    setProg(upd); save(upd);
    setStats(s => ({ c: s.c + (correct ? 1 : 0), w: s.w + (correct ? 0 : 1) }));
    if (unlockedMastery) {
      const item = {
        id: key,
        de: card.de || card.q || card.a || card.verb || "Mastered card",
        en: card.en || "",
        cat: card._cat || card.cat || category,
        masteredAt: now,
      };
      setNewlyMastered(list => list.some(x => x.id === key) ? list : [...list, item]);
      setMasteryBurst(item);
      window.setTimeout(() => setMasteryBurst(cur => cur?.id === key ? null : cur), 1800);
    }
    if (!correct) { setFailed(f => [...f, card]); setFailedNames(f => [...f, card.de || card.q || card.verb || (card.article && card.noun ? `${card.article} ${card.noun}` : null) || (card.correct && card.correct.join(' ')) || '?']); }
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
          if (new Date(k).getTime() >= cutoff) pruned[k] = v;
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
    if (m === "vocab" || m === "production") {
      const cat = parts[1], de = parts.slice(2).join("::");
      const found = V[cat]?.find(w => w && w.de === de);
      if (found) return { ...found, _cat: cat, _mode: m };
    }
    if (m === "article") {
      const cat = parts[1], id = parts.slice(2).join("::");
      const found = nouns.find(n => n.cat === cat && `${n.article} ${n.noun}` === id);
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

  const openSetup = (cat, dm) => {
    setSetupCat(cat);
    setSetupMode(dm || "vocab");
    const mx = cat === "__all__" ? totalW : cat === "__grammar__" ? CLOZE.length : cat === "__verb__" ? 30 : cat === "__sentence__" ? SENTENCES.length : cat === "__imperativ__" ? IMPERATIVES.length : cat === "__listening__" ? DIALOGUES.length : cat === "__weak__" ? Math.max(weakCards.size, 1) : (V[cat]?.length || 25);
    setSessLen(Math.min(15, mx));
    setShowSetup(true);
  };

  const finishOnboarding = () => {
    updateDailyGoal(onboardingGoal);
    setSetupMode(onboardingMode);
    setSessDiff(onboardingLevel === "B1" ? "hard" : "mixed");
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

  const resetSessionState = () => {
    navLockRef.current = false;
    setStats({ c: 0, w: 0 }); setFailed([]); setFailedNames([]); setRpt(0); setIdx(0); setNewlyMastered([]); setMasteryBurst(null);
    setFlipped(false); setAnswered(false); setSel(null); setShowEx(false); setShowHint(false);
    setVis(true); setInput(""); setInputResult(null); setLastElapsed(0); setRevealElapsed(0);
    // Fresh session → clear first-attempt tracker so stats record this run's first attempts.
    // startRepeat deliberately does NOT call this, so repeated failures stay excluded.
    countedKeysRef.current = new Set();
    setSbPool([]); setSbPicked([]); setSbChecked(false); setSbCorrect(false);
  };

  // Apply the "known" suppression and the CEFR level filter to a vocab pool. Both degrade
  // gracefully: if the level filter would leave nothing, it's dropped so a session can still
  // start; if every card is marked known, we fall back to the full pool rather than a dead end.
  const filterPool = (pool) => {
    const notKnown = pool.filter(c => !known.has(knownKey(c._cat, c.de)));
    const base = notKnown.length ? notKnown : pool;
    if (setupLevel === "all") return base;
    const leveled = base.filter(c => cardLevel(c) === setupLevel);
    return leveled.length ? leveled : base;
  };

  const startSession = (cat, m, count) => {
    setMode(m); setShowSetup(false); resetSessionState();
    // Remember this session for one-tap resume
    const label = cat === "__all__" ? "All Categories" : cat === "__grammar__" ? "Grammar Cloze" : cat === "__verb__" ? "Verb Trainer" : cat === "__sentence__" ? "Sentence Builder" : cat === "__imperativ__" ? "Imperative" : cat === "__listening__" ? "Listening Practice" : cat;
    const ls = { cat, m, count, label, ts: Date.now() };
    setLastSession(ls); saveLast(ls);

    if (m === "vocab" || m === "production") {
      const isAll = cat === "__all__";
      setCategory(isAll ? "All Categories" : cat);
      const rawPool = isAll ? allVocab() : V[cat].map(w => ({ ...w, _cat: cat }));
      const pool = filterPool(rawPool);
      const getMult = c => sessionMultiplier(prog[`${m}::${c._cat}::${c.de}`], sessDiff);
      const { seeded, rest } = seedDueFirst(pool, count, c => dueCards.has(`${m}::${c._cat}::${c.de}`));
      setCards(sh([...seeded, ...weightedSelect(rest, count - seeded.length, getMult)]));
      setScreen("cards"); setTStart(Date.now());
    } else if (m === "article") {
      setCategory("Article Drill"); const pool = cat === "__all__" ? nouns : nouns.filter(n => n.cat === cat);
      const take = Math.min(count, pool.length);
      const { seeded, rest } = seedDueFirst(pool, take, c => dueCards.has(`article::${c.cat}::${c.article} ${c.noun}`));
      setCards(sh([...seeded, ...sh(rest).slice(0, Math.max(0, take - seeded.length))]));
      setScreen("drill"); setTStart(Date.now());
    } else if (m === "cloze") {
      setCategory("Grammar Cloze");
      const take = Math.min(count, CLOZE.length);
      const { seeded, rest } = seedDueFirst([...CLOZE], take, c => dueCards.has(`cloze::Grammar Cloze::${c.q}`));
      setCards(sh([...seeded, ...sh(rest).slice(0, Math.max(0, take - seeded.length))]));
      setScreen("drill"); setTStart(Date.now());
    } else if (m === "verb") {
      setCategory("Verb Trainer"); setCards(Array.from({ length: count }, () => makeVerbQ(verbTense)));
      setScreen("drill"); setTStart(Date.now());
    } else if (m === "sentence") {
      setCategory("Sentence Builder");
      const pool = sh([...SENTENCES]).slice(0, Math.min(count, SENTENCES.length));
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
      setCards(sh([...seeded, ...rest.slice(0, Math.max(0, take - seeded.length))]));
      setScreen("drill"); setTStart(Date.now());
    } else if (m === "listening") {
      setCategory(listenMode === "questions" ? "Listening + Questions" : "Listening Practice");
      if (listenMode === "listen") {
        // Tap-through mode: use existing dialogues screen
        const pool = sh([...DIALOGUES]).slice(0, count);
        setCards(pool); setDlgIdx(0); setDlgRevealed({});
        setScreen("dialogues"); setTStart(Date.now());
      } else {
        // Questions mode: flatten to one card per question, only dialogues that have questions
        const withQ = DIALOGUES.filter(d => d.questions && d.questions.length);
        const shuffled = sh([...withQ]);
        const expanded = shuffled.flatMap(d => d.questions.map((q, qi) => ({
          _dialogue: d, _qIdx: qi, q: q.q, opts: q.opts, correctIdx: q.correctIdx,
          de: `${d.title}::${qi}`,
        })));
        setCards(expanded.slice(0, count));
        setScreen("drill"); setTStart(Date.now());
      }
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
    if (m === "verb") setCards(Array.from({ length: failed.length }, () => makeVerbQ(verbTense)));
    else if (m === "sentence") {
      setCards(sh([...failed]));
      const f = failed[0];
      if (f) { setSbPool(sh([...f.correct])); setSbPicked([]); setSbChecked(false); setSbCorrect(false); }
    } else setCards(sh([...failed]));
    setIdx(0); setFlipped(false); setAnswered(false); setSel(null); setShowEx(false); setShowHint(false);
    setVis(true); setInput(""); setInputResult(null); setLastElapsed(0); setRevealElapsed(0); setMasteryBurst(null);
    setStats({ c: 0, w: 0 }); setFailed([]); setFailedNames([]); setRpt(r => r + 1); setTStart(Date.now());
    setScreen(m === "sentence" ? "sentence" : (m === "vocab" || m === "production") ? "cards" : "drill");
  };

  // Card flip handlers
  const handleFlipAnswer = (correct) => { if (answered) return; setAnswered(true); record(correct, cards[idx], revealElapsed || (Date.now() - tStart)); };
  const revealCard = () => {
    if (!flipped && vis) {
      setRevealElapsed(Date.now() - tStart);
      setFlipped(true);
      if (cards[idx]?.de) speak(cards[idx].de);
    }
  };
  const handleRevealKey = e => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      revealCard();
    }
  };
  const submitTyped = () => {
    if (answered) return;
    const card = cards[idx]; const target = mode === "production" ? card.de : card.en;
    const result = checkMatch(input, target);
    setInputResult(result); setAnswered(true);
    record(result !== "wrong", card, Date.now() - tStart);
    speak(card.de);
  };
  const submitCloze = () => {
    if (answered) return;
    const card = cards[idx]; const result = checkMatch(input, card.a);
    setInputResult(result); setAnswered(true);
    record(result !== "wrong", card, Date.now() - tStart);
  };

  const nextCard = () => {
    if (navLockRef.current) return;
    if (idx >= cards.length - 1) { setScreen("results"); return; }
    navLockRef.current = true;
    setVis(false); setFeedback(null);
    setTimeout(() => {
      setFlipped(false); setAnswered(false); setShowEx(false); setShowHint(false); setInput(""); setInputResult(null); setLastElapsed(0); setRevealElapsed(0); setMasteryBurst(null);
      setIdx(i => Math.min(i + 1, Math.max(cards.length - 1, 0)));
      setTStart(Date.now());
      setTimeout(() => { setVis(true); navLockRef.current = false; }, 50);
    }, 180);
  };

  const handleDrillAnswer = (oi) => {
    if (answered) return; setAnswered(true); setSel(oi);
    const card = cards[idx]; let correct;
    if (mode === "article") correct = ["der", "die", "das"][oi] === card.article;
    else if (mode === "verb") correct = oi === card.correctIdx;
    else if (mode === "listening") correct = oi === card.correctIdx;
    else correct = false;
    record(correct, card, Date.now() - tStart);
    // Only speak when there's something meaningful to say. In verb mode the full
    // "pron + conjugation" is the natural utterance. Other modes don't emit speech here.
    if (mode === "verb" && card.pron && card.correct) speak(`${card.pron} ${card.correct}`);
  };

  const nextDrill = () => {
    if (navLockRef.current) return;
    if (idx >= cards.length - 1) { setScreen("results"); return; }
    navLockRef.current = true;
    setVis(false); setFeedback(null);
    setTimeout(() => {
      setAnswered(false); setSel(null); setInput(""); setInputResult(null); setShowHint(false); setLastElapsed(0); setRevealElapsed(0); setMasteryBurst(null);
      setIdx(i => Math.min(i + 1, Math.max(cards.length - 1, 0)));
      setTStart(Date.now());
      setTimeout(() => { setVis(true); navLockRef.current = false; }, 50);
    }, 180);
  };

  // Sentence building
  const sbTapWord = (word, i) => { if (sbChecked) return; const np = [...sbPool]; np.splice(i, 1); setSbPool(np); setSbPicked(p => [...p, word]); };
  const sbUntapWord = (word, i) => { if (sbChecked) return; const np = [...sbPicked]; np.splice(i, 1); setSbPicked(np); setSbPool(p => [...p, word]); };
  const sbCheck = () => { const card = cards[idx]; const isCorrect = sbPicked.join(" ") === card.correct.join(" "); setSbChecked(true); setSbCorrect(isCorrect); record(isCorrect, card, Date.now() - tStart); };
  const sbNext = () => {
    if (navLockRef.current) return;
    if (idx >= cards.length - 1) { setScreen("results"); return; }
    navLockRef.current = true;
    setVis(false); setFeedback(null);
    setTimeout(() => {
      const next = cards[Math.min(idx + 1, cards.length - 1)];
      if (next) setSbPool(sh([...next.correct]));
      setSbPicked([]); setSbChecked(false); setSbCorrect(false); setLastElapsed(0); setRevealElapsed(0); setMasteryBurst(null);
      setIdx(i => Math.min(i + 1, Math.max(cards.length - 1, 0)));
      setTStart(Date.now());
      setTimeout(() => { setVis(true); navLockRef.current = false; }, 50);
    }, 180);
  };

  // Precompute all category stats in one pass — avoids 19×N recomputation on every render.
  const catStats = useMemo(() => {
    const out = {};
    CATS.forEach(cat => {
      const ws = V[cat];
      let seen = 0, productionSeen = 0, mastered = 0, almost = 0;
      let recognitionAttempts = 0, recognitionCorrect = 0, productionAttempts = 0, productionCorrect = 0;
      let totalRecallMs = 0, timedAttempts = 0;
      const masteredCards = [];
      ws.forEach(w => {
        if (!w?.de) return;
        const vk = `vocab::${cat}::${w.de}`, pk = `production::${cat}::${w.de}`;
        const recognition = normalizeEntry(prog[vk]);
        const production = normalizeEntry(prog[pk]);
        if (recognition.stats.attempts > 0 || production.stats.attempts > 0) seen++;
        if (production.stats.attempts > 0) productionSeen++;
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
  const getCatStats = cat => catStats[cat] || { total: 0, seen: 0, productionSeen: 0, mastered: 0, almost: 0, recognitionAccuracy: null, productionAccuracy: null, avgRecall: null, masteredCards: [] };
  const selectedCatStats = getCatStats(selectedProgressCat);
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
      cloze: { total: CLOZE.length, seen: 0 },
      sentence: { total: SENTENCES.length, seen: 0 },
      imperativ: { total: IMPERATIVES.length, seen: 0 },
      verb: { total: VERBS.length, seen: 0 },
      listening: { total: DIALOGUES.length, seen: 0 },
    };
    // Unique-identifier sets so we count each underlying item only once
    const seenArticle = new Set(), seenCloze = new Set(), seenSent = new Set(), seenImp = new Set(), seenVerb = new Set(), seenDlg = new Set();
    for (const [key, raw] of Object.entries(prog)) {
      const n = normalizeEntry(raw);
      if (n.stats.correct < 1) continue;
      const parts = key.split("::");
      if (parts.length < 3) continue;
      const [m, cat, id] = [parts[0], parts[1], parts.slice(2).join("::")];
      if (m === "article") seenArticle.add(`${cat}::${id}`);
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
    out.cloze.seen = seenCloze.size;
    out.sentence.seen = seenSent.size;
    out.imperativ.seen = seenImp.size;
    out.verb.seen = seenVerb.size;
    out.listening.seen = seenDlg.size;
    return out;
  }, [prog, nouns]);

  const card = cards[idx];
  const sessionScreens = new Set(["cards", "drill", "sentence", "audio"]);
  const activeCardMissing = sessionScreens.has(screen) && cards.length > 0 && !card;
  const cardBox = card ? normalizeEntry(prog[gk(card, category, mode)]).srs.box : 0;

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
  const dailyGoalPct = Math.min(1, dailyStats.count / Math.max(dailyGoal, 1));
  const FN = `'Montserrat',sans-serif`, BD = `'Montserrat',sans-serif`;
  const FGRAD = "linear-gradient(145deg, #111 0%, #1A0808 50%, #1A1400 100%)";
  const FGRAD2 = "linear-gradient(145deg, #0A0A0A 0%, #180808 60%, #181200 100%)";
  const FLAG = `linear-gradient(90deg, #050505 0 33%, ${R} 33% 66%, ${A} 66%)`;
  const SOFT_PANEL = "linear-gradient(180deg, #171717 0%, #101010 100%)";
  // Shared class for the card content wrapper: directional slide on advance (is-out, keyed on
  // vis) + answer-feedback shake/pop (keyed on feedback). The two are mutually exclusive by vis.
  const cardCls = "ad-card-enter" + (vis ? (feedback === "wrong" ? " ad-shake" : feedback === "correct" ? " ad-pop" : "") : " is-out");
  const categoryIcons = { "Greetings & Basics": "hand", "Numbers & Time": "clock", "Family & People": "users", "Food & Drink": "utensils", "Around the House": "sofa", "Body & Health": "medical", "Colours & Descriptions": "palette", "Common Verbs": "bolt", "Weather & Nature": "cloud", "Travel & Directions": "map", "Shopping & Money": "cart", "Emotions & Opinions": "smile", "Everyday Actions": "calendar", "Work & Study": "briefcase", "Connectors & Structure": "link", "Abstract & Advanced": "layers", "Media & Communication": "megaphone", "Sport & Leisure": "trophy", "Technology & Digital": "chip", "Admin & Bureaucracy": "briefcase", "Housing & Renting": "sofa", "Banking & Finance": "cart", "Driving & Traffic": "map", "Cooking & Kitchen": "utensils", "Idioms & Slang": "smile", "Electrical Engineering": "bolt", "Maths & Statistics": "chart", "Engineering Workplace": "briefcase" };
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
    { key: "weak", title: "Weak", count: resolvedWeak.total, next: nextBatchLabel(resolvedWeak), detail: formatModeBreakdown(resolvedWeak.byMode), icon: "alert", color: R, onClick: startWeakReview },
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
        <div style={{ fontSize: 11, color: TD, fontWeight: 600, textAlign: "right", lineHeight: 1.3, minWidth: 0, flex: 1 }}>
          <div style={{ color: T, fontWeight: 700, letterSpacing: 0.4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {extra}{category}
          </div>
          <div style={{ fontSize: 10, marginTop: 2, letterSpacing: 1 }}>
            {rpt > 0 && <span style={{ color: R, fontWeight: 700, marginRight: 6 }}>R{rpt + 1}</span>}
            <span style={{ color: TD }}>{idx + 1} / {cards.length}</span>
          </div>
        </div>
      </div>
    </div>
  );

  // NEW: Automaticity badge shown after answer
  const SpeedBadge = ({ ms }) => {
    if (!ms || !answered) return null;
    const { text, color } = speedLabel(ms);
    return (<div style={{ fontSize: 11, color, fontWeight: 600, marginTop: 6, textAlign: "center" }}>{text} ({(ms / 1000).toFixed(1)}s)</div>);
  };

  // NEW: Hint toggle button for cards with mnemonic hints
  const HintBtn = ({ hint }) => {
    if (!hint) return null;
    if (showHint) return (<div style={{ marginTop: 6, padding: "8px 12px", background: "#0A0A0A66", borderRadius: 8, fontSize: 11, color: BL, lineHeight: 1.4, borderLeft: `3px solid ${BL}`, display: "flex", gap: 6, alignItems: "flex-start" }}><Icon name="target" size={13} style={{ marginTop: 1 }} /> <span>{hint}</span></div>);
    return (<button onClick={() => setShowHint(true)} style={{ marginTop: 6, background: "none", border: `1px solid ${BL}44`, borderRadius: 8, padding: "7px 12px", color: BL, fontSize: 11, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="target" size={13} /> Show hint</button>);
  };

  // Per-card stats shown after answering
  const CardStats = () => {
    if (!answered || !card) return null;
    const key = gk(card, category, mode);
    const n = normalizeEntry(prog[key]);
    if (!n.stats.attempts) return null;
    const productionStreak = n.stats.productionStreak || 0;
    const mastered = productionStreak >= MASTERY_STREAK;
    const unlockedNow = mode === "production" && inputResult !== "wrong" && productionStreak === MASTERY_STREAK;
    // "Last seen" helper — reinforces SRS intuition. Pulled from in-session ref, not prog.
    const priorLastSeen = priorLastSeenRef.current[key];
    let lastSeenLabel = null;
    if (priorLastSeen && n.stats.attempts > 1) {
      const daysAgo = Math.floor((Date.now() - priorLastSeen) / 86400000);
      if (daysAgo >= 1) lastSeenLabel = `Last seen ${daysAgo}d ago`;
      else {
        const hoursAgo = Math.floor((Date.now() - priorLastSeen) / 3600000);
        if (hoursAgo >= 1) lastSeenLabel = `Last seen ${hoursAgo}h ago`;
      }
    }
    return (
      <>
        {mode === "production" && (
          <div className={unlockedNow ? "ad-mastery-pop" : undefined} style={{ margin: "8px auto 0", maxWidth: 230, borderRadius: 999, border: `1px solid ${mastered ? G : A}55`, background: mastered ? `${G}14` : `${A}10`, color: mastered ? G : A, fontSize: 11, fontWeight: 800, padding: "6px 10px", textAlign: "center" }}>
            {mastered ? (unlockedNow ? "Mastery unlocked - 5 in a row" : "Mastered - 5 in a row") : `${productionStreak} / ${MASTERY_STREAK} production streak`}
          </div>
        )}
        {unlockedNow && masteryBurst?.id === key && (
          <div className="ad-mastery-burst" style={{ margin: "8px auto 0", maxWidth: 250, borderRadius: 12, border: `1px solid ${G}55`, background: `linear-gradient(135deg, ${G}18, #0F0F0F 70%)`, padding: "9px 12px", color: T, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: `0 0 18px ${G}18` }}>
            <Icon name="trophy" size={16} style={{ color: G }} />
            <span style={{ fontSize: 11, fontWeight: 900 }}>New mastered card</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, marginTop: 8, fontSize: 11, color: TD, letterSpacing: 0.2 }}>
          <span>Attempts {n.stats.attempts}</span>
          <span style={{ opacity: 0.35 }}>•</span>
          <span style={{ color: G }}>✓ {n.stats.correct}</span>
          <span style={{ opacity: 0.35 }}>•</span>
          <span style={{ color: R }}>✗ {n.stats.incorrect}</span>
        </div>
        {lastSeenLabel && <div style={{ fontSize: 10, color: TD, marginTop: 4, textAlign: "center", opacity: 0.7 }}>{lastSeenLabel}</div>}
      </>
    );
  };

  const maxC = setupCat === "__all__" ? totalW : setupCat === "__grammar__" ? CLOZE.length : setupCat === "__verb__" ? 30 : setupCat === "__sentence__" ? SENTENCES.length : setupCat === "__imperativ__" ? IMPERATIVES.length : setupCat === "__listening__" ? DIALOGUES.length : setupCat === "__weak__" ? Math.max(weakCards.size, 1) : (V[setupCat]?.length || nouns.length);
  const hasNouns = setupCat && !["__all__", "__grammar__", "__verb__", "__sentence__", "__weak__"].includes(setupCat) && nouns.some(n => n.cat === setupCat);
  const setupSpecialCats = ["__grammar__", "__verb__", "__sentence__", "__imperativ__", "__listening__", "__weak__"];
  const setupIsLibrary = setupCat && !setupSpecialCats.includes(setupCat);
  const setupCanUseArticles = hasNouns || setupCat === "__all__";
  const setupMinC = Math.min(5, maxC);
  const setupTitle = setupCat === "__all__" ? "All Categories" : setupCat === "__grammar__" ? "Grammar Cloze" : setupCat === "__verb__" ? "Verb Trainer" : setupCat === "__sentence__" ? "Sentence Builder" : setupCat === "__imperativ__" ? "Imperative" : setupCat === "__listening__" ? "Listening Practice" : setupCat === "__weak__" ? "Weak Areas" : setupCat;
  const stepSessionLength = delta => setSessLen(n => Math.max(setupMinC, Math.min(maxC, n + delta)));

  const ProgressHub = () => {
    const productionPct = selectedCatStats.total ? (selectedCatStats.productionSeen / selectedCatStats.total) * 100 : 0;
    const masteryPct = selectedCatStats.total ? (selectedCatStats.mastered / selectedCatStats.total) * 100 : 0;
    const seenPct = selectedCatStats.total ? (selectedCatStats.seen / selectedCatStats.total) * 100 : 0;
    return (
      <div style={{ background: SH, border: `1px solid ${B}`, borderRadius: 14, padding: "16px 16px 15px", marginBottom: 20, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: FLAG, opacity: 0.8 }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginTop: 4, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 10, color: TD, fontWeight: 800, letterSpacing: 2 }}>Progress</div>
            <div style={{ fontSize: 11, color: TD, marginTop: 3 }}>Recent performance</div>
          </div>
          <div style={{ fontSize: 10, color: TD, textAlign: "right", lineHeight: 1.35 }}>First attempt<br />correct-time only</div>
        </div>

        {trend30.totalAttempts < 3 ? (
          <div style={{ paddingBottom: 14, borderBottom: `1px solid ${B}` }}>
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
          <div style={{ paddingBottom: 14, borderBottom: `1px solid ${B}` }}>
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
            <svg viewBox="0 0 300 46" width="100%" height="38" style={{ display: "block" }}>
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

          <div style={{ paddingTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: TD, fontWeight: 800, letterSpacing: 1.6 }}>Category mastery</div>
              <div style={{ fontSize: 11, color: TD, marginTop: 3 }}>Seen, production, mastered</div>
            </div>
            <select aria-label="Progress category" value={selectedProgressCat} onChange={e => { setSelectedProgressCat(e.target.value); setShowMasteredList(false); }}
              style={{ minWidth: 148, maxWidth: 190, background: "#0F0F0F", color: T, border: `1px solid ${B}`, borderRadius: 10, padding: "9px 10px", fontSize: 12, fontFamily: BD, outline: "none" }}>
              {CATS.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 13 }}>
            {[
              { label: "Seen", value: `${selectedCatStats.seen}/${selectedCatStats.total}`, color: T },
              { label: "Production", value: `${selectedCatStats.productionSeen}/${selectedCatStats.total}`, color: A },
              { label: "Mastered", value: `${selectedCatStats.mastered}/${selectedCatStats.total}`, color: G },
            ].map(item => (
              <div key={item.label} style={{ minWidth: 0 }}>
                <div style={{ fontFamily: FN, fontSize: 17, color: item.color, fontWeight: 800, whiteSpace: "nowrap" }}>{item.value}</div>
                <div style={{ fontSize: 9, color: TD, fontWeight: 800, letterSpacing: 0.4 }}>{item.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gap: 8, marginBottom: 13 }}>
            {[
              { label: "Seen", value: seenPct, color: TD },
              { label: "Production", value: productionPct, color: A },
              { label: "Mastered", value: masteryPct, color: G },
            ].map(row => (
              <div key={row.label}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: TD, marginBottom: 4 }}><span>{row.label}</span><span>{Math.round(row.value)}%</span></div>
                <div style={{ height: 4, background: "#0A0A0A", borderRadius: 2, overflow: "hidden" }}><div style={{ height: "100%", width: `${row.value}%`, background: row.color, borderRadius: 2 }} /></div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button type="button" onClick={() => openSetup(selectedProgressCat, "production")}
              style={{ background: "#0F0F0F", color: A, border: `1px solid ${A}44`, borderRadius: 10, padding: "10px 12px", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
              <Icon name="keyboard" size={14} /> Practice
            </button>
            <button type="button" onClick={() => setShowMasteredList(v => !v)}
              style={{ background: "#0F0F0F", color: selectedCatStats.mastered ? G : TD, border: `1px solid ${selectedCatStats.mastered ? G : B}44`, borderRadius: 10, padding: "10px 12px", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
              <Icon name="trophy" size={14} /> Mastered
            </button>
          </div>

          {showMasteredList && (
            <div style={{ marginTop: 12, borderTop: `1px solid ${B}`, paddingTop: 10, maxHeight: 220, overflowY: "auto" }}>
              {selectedCatStats.masteredCards.length ? selectedCatStats.masteredCards.slice(0, 40).map(w => (
                <div key={w.de} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "7px 0", borderBottom: `1px solid ${B}44`, fontSize: 12 }}>
                  <span style={{ color: T, fontWeight: 800 }}>{w.de}</span>
                  <span style={{ color: TD, textAlign: "right" }}>{w.en}</span>
                </div>
              )) : (
                <div style={{ fontSize: 11, color: TD, textAlign: "center", padding: "10px 0" }}>No mastered cards yet.</div>
              )}
              {selectedCatStats.masteredCards.length > 40 && <div style={{ fontSize: 10, color: TD, textAlign: "center", paddingTop: 8 }}>+ {selectedCatStats.masteredCards.length - 40} more</div>}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ fontFamily: BD, background: BG, color: T, minHeight: DVH, maxWidth: 480, margin: "0 auto", position: "relative" }}>
      <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <style>{`
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
        .ad-spark { stroke-dasharray: 1; stroke-dashoffset: 1; animation: ad-draw 950ms ease-out forwards; }
        .ad-input { transition: border-color .18s ease, box-shadow .18s ease, background .18s ease; }
        .ad-input:focus { outline: none; border-color: #FFCC00 !important; box-shadow: 0 0 0 3px rgba(255,204,0,.16); background: #1d1d1d; }
        .ad-uk:active { transform: translateY(1px) scale(.95); border-color: #FFCC00; }
        .ad-elev { box-shadow: 0 20px 44px -24px rgba(0,0,0,.85), 0 0 30px -16px rgba(255,204,0,.16); }
        button:focus-visible, [role="button"]:focus-visible, input:focus-visible { outline: 2px solid #FFCC00AA; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) {
          .ad-mastery-pop, .ad-mastery-burst, .ad-category-mastered, .ad-shake, .ad-pop, .ad-spark { animation: none; }
          .ad-card-enter { transition: opacity .12s ease; }
          .ad-card-enter.is-out { transform: none; }
          .ad-spark { stroke-dashoffset: 0; }
        }
      `}</style>

      {/* ── FIRST-RUN ONBOARDING ── */}
      {showOnboarding && <div style={{ position: "fixed", inset: 0, zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.92)", padding: 22 }}>
        <div role="dialog" aria-modal="true" aria-label="Welcome to AutoDeutsch" style={{ background: SOFT_PANEL, border: `1px solid ${A}2E`, borderRadius: 18, padding: "26px 22px 22px", width: "100%", maxWidth: 390, maxHeight: "92vh", overflowY: "auto", boxShadow: "0 24px 80px rgba(0,0,0,0.45)" }}>
          <div style={{ height: 3, width: 74, background: FLAG, borderRadius: 2, marginBottom: 18 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <IconBadge name="book" size={38} />
            <div>
              <div style={{ fontSize: 10, color: TD, fontWeight: 800, letterSpacing: 2.4, textTransform: "uppercase" }}>Welcome</div>
              <h2 style={{ fontFamily: FN, fontSize: 23, margin: "2px 0 0", lineHeight: 1.05 }}>Set up AutoDeutsch</h2>
            </div>
          </div>
          <p style={{ color: TD, fontSize: 12, lineHeight: 1.55, margin: "0 0 18px" }}>A quick setup tunes your daily target and default practice style. Everything still saves locally and works offline after the first cached launch.</p>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: TD, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase", marginBottom: 8 }}>Starting level</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {["A1", "A2", "B1"].map(level => (
                <button key={level} type="button" onClick={() => setOnboardingLevel(level)} style={{ padding: "11px 8px", borderRadius: 10, border: `1px solid ${onboardingLevel === level ? A : B}`, background: onboardingLevel === level ? `${A}18` : "#0D0D0D", color: onboardingLevel === level ? A : T, fontWeight: 800, cursor: "pointer", fontFamily: FN }}>{level}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: TD, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase", marginBottom: 8 }}>Daily target</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {[10, 20, 30].map(goal => (
                <button key={goal} type="button" onClick={() => setOnboardingGoal(goal)} style={{ padding: "11px 8px", borderRadius: 10, border: `1px solid ${onboardingGoal === goal ? A : B}`, background: onboardingGoal === goal ? `${A}18` : "#0D0D0D", color: onboardingGoal === goal ? A : T, fontWeight: 800, cursor: "pointer", fontFamily: FN }}>{goal}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: TD, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase", marginBottom: 8 }}>Preferred practice</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
              {[["vocab", "Recognition", "German to English", "book"], ["production", "Production", "English to German", "keyboard"], ["audio", "Audio mode", "Hands-free review", "headphones"]].map(([m, title, sub, icon]) => (
                <button key={m} type="button" onClick={() => setOnboardingMode(m)} style={{ padding: "12px 12px", borderRadius: 10, border: `1px solid ${onboardingMode === m ? A : B}`, background: onboardingMode === m ? `${A}14` : "#0D0D0D", color: T, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, textAlign: "left", fontFamily: "inherit" }}>
                  <IconBadge name={icon} size={30} color={onboardingMode === m ? A : TD} />
                  <span style={{ flex: 1 }}>
                    <span style={{ display: "block", fontSize: 13, fontWeight: 800 }}>{title}</span>
                    <span style={{ display: "block", fontSize: 11, color: TD, marginTop: 1 }}>{sub}</span>
                  </span>
                  {onboardingMode === m && <Icon name="check" size={17} style={{ color: A }} />}
                </button>
              ))}
            </div>
          </div>

          <Btn bg={A} color="#0A0A0A" onClick={finishOnboarding} style={{ fontFamily: FN, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            Start learning <Icon name="arrowRight" size={17} />
          </Btn>
          <button type="button" onClick={finishOnboarding} style={{ marginTop: 12, width: "100%", background: "transparent", border: "none", color: TD, fontSize: 12, cursor: "pointer", padding: 8 }}>Use defaults</button>
        </div>
      </div>}

      {/* Setup modal */}
      {showSetup && <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.88)", padding: 18 }} onClick={() => setShowSetup(false)}>
        <div role="dialog" aria-modal="true" aria-label="Session setup" onClick={e => e.stopPropagation()} style={{ background: S, border: `1px solid ${A}33`, borderRadius: 18, width: "100%", maxWidth: 382, maxHeight: "92vh", overflow: "hidden", boxShadow: `0 0 40px ${A}11`, display: "flex", flexDirection: "column" }}>
          <div style={{ height: 4, background: FLAG }} />
          <div style={{ padding: "18px 18px 10px" }}>
            <div style={{ fontSize: 10, color: R, fontWeight: 800, letterSpacing: 3.2, textTransform: "uppercase", marginBottom: 6 }}>Setup</div>
            <h3 style={{ fontFamily: FN, fontSize: 20, margin: "0 0 4px", fontWeight: 800, lineHeight: 1.18 }}>{setupTitle}</h3>
            <div style={{ fontSize: 11, color: TD, minHeight: 15 }}>
              {setupCat === "__imperativ__" ? "Imperativ" : setupCat === "__listening__" ? "Hör-Training" : setupMode === "production" ? "German recall and spelling" : "Choose the session shape"}
            </div>
          </div>

          <div style={{ padding: "0 18px 14px", overflowY: "auto" }}>
            {setupIsLibrary && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: TD, fontWeight: 800, letterSpacing: 0.8, marginBottom: 8 }}>Mode</div>
                <div style={{ display: "grid", gridTemplateColumns: setupCanUseArticles ? "repeat(2, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))", gap: 4, padding: 4, background: "#0A0A0A", border: `1px solid ${B}`, borderRadius: 12 }}>
                  {[
                    ["vocab", "Recall", "DE → EN"],
                    ["production", "Production", "EN → DE"],
                    ["audio", "Audio", "Hands-free"],
                    ...(setupCanUseArticles ? [["article", "Articles", "der/die/das"]] : []),
                  ].map(([m, label, sub]) => {
                    const on = setupMode === m;
                    return (
                      <button key={m} onClick={() => setSetupMode(m)} style={{ minWidth: 0, padding: "9px 8px", borderRadius: 9, border: "none", background: on ? A : "transparent", color: on ? "#0A0A0A" : T, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                        <span style={{ display: "block", fontSize: 12, fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
                        <span style={{ display: "block", marginTop: 2, fontSize: 9, color: on ? "#0A0A0A" : TD, fontWeight: 800, opacity: on ? 0.8 : 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {setupMode === "audio" && setupIsLibrary && (
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
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, padding: 4, background: "#0A0A0A", border: `1px solid ${B}`, borderRadius: 12 }}>
                  {[["present", "Präsens"], ["perfekt", "Perfekt"]].map(([t, l]) => (
                    <button key={t} onClick={() => setVerbTense(t)} style={{ padding: "9px 10px", borderRadius: 9, fontSize: 12, fontWeight: 900, cursor: "pointer", background: verbTense === t ? A : "transparent", color: verbTense === t ? "#0A0A0A" : TD, border: "none" }}>{l}</button>
                  ))}
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

            {setupIsLibrary && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: TD, fontWeight: 800, letterSpacing: 0.8, marginBottom: 8 }}>Difficulty</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4, padding: 4, background: "#0A0A0A", border: `1px solid ${B}`, borderRadius: 12 }}>
                  {[["mixed", "Mixed"], ["easy", "Easy"], ["hard", "Hard"]].map(([k, l]) => (
                    <button key={k} onClick={() => setSessDiff(k)} style={{ padding: "9px 6px", borderRadius: 9, fontSize: 12, fontWeight: 900, cursor: "pointer", background: sessDiff === k ? A : "transparent", color: sessDiff === k ? "#0A0A0A" : TD, border: "none" }}>{l}</button>
                  ))}
                </div>
              </div>
            )}

            {setupIsLibrary && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: TD, fontWeight: 800, letterSpacing: 0.8, marginBottom: 8 }}>Level</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4, padding: 4, background: "#0A0A0A", border: `1px solid ${B}`, borderRadius: 12 }}>
                  {[["all", "All"], ...LEVELS.map(l => [l, l])].map(([k, l]) => (
                    <button key={k} onClick={() => setSetupLevel(k)} style={{ padding: "9px 6px", borderRadius: 9, fontSize: 12, fontWeight: 900, cursor: "pointer", background: setupLevel === k ? A : "transparent", color: setupLevel === k ? "#0A0A0A" : TD, border: "none" }}>{l}</button>
                  ))}
                </div>
              </div>
            )}

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
          </div>

          <div style={{ padding: "12px 18px max(18px, env(safe-area-inset-bottom))", borderTop: `1px solid ${B}`, background: S, boxShadow: "0 -14px 22px rgba(0,0,0,0.28)" }}>
            <div style={{ fontSize: 10, color: TD, marginBottom: 10, textAlign: "center" }}>Failed cards repeat until cleared.</div>
            <Btn bg={A} color="#0A0A0A" onClick={() => { const m = setupCat === "__grammar__" ? "cloze" : setupCat === "__verb__" ? "verb" : setupCat === "__sentence__" ? "sentence" : setupCat === "__imperativ__" ? "imperativ" : setupCat === "__listening__" ? "listening" : setupMode; startSession(setupCat, m, sessLen); }} style={{ fontFamily: FN, fontSize: 16 }}>Start session</Btn>
          </div>
        </div>
      </div>}
      {/* ── SETTINGS MODAL ── */}
      {showSettings && <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.88)", padding: 24 }} onClick={() => setShowSettings(false)}>
        <div role="dialog" aria-modal="true" aria-label="Settings" onClick={e => e.stopPropagation()} style={{ background: S, border: `1px solid ${A}33`, borderRadius: 20, padding: "28px 24px", width: "100%", maxWidth: 360, maxHeight: "90vh", overflowY: "auto", boxShadow: `0 0 40px ${A}11` }}>
          <div style={{ height: 3, width: 72, background: FLAG, borderRadius: 2, marginBottom: 16 }} />
          <div style={{ fontSize: 10, color: R, fontWeight: 800, letterSpacing: 4, textTransform: "uppercase", marginBottom: 6 }}>Settings</div>

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
      {screen === "home" && <div style={{ padding: "12px 20px 24px" }}>
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
          <div style={{ background: "#1A0000", border: `1px solid ${R}55`, borderRadius: 12, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: R, lineHeight: 1.4 }}>
            <strong>Progress won't save</strong><br />
            <span style={{ color: T, fontWeight: 400, fontSize: 11 }}>Private browsing is on, or storage is full. Nothing you do this session will be remembered.</span>
          </div>
        )}

        {/* Hero */}
        <div style={{ background: SOFT_PANEL, border: `1px solid ${B}`, borderRadius: 14, padding: "24px 22px 20px", marginBottom: 16, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: FLAG }} />
          <button onClick={() => { setShowSettings(true); setImportError(""); setUpdateCheckMsg(""); }} aria-label="Settings"
            style={{ position: "absolute", top: 10, right: 10, background: "#0A0A0A66", border: `1px solid ${B}`, borderRadius: 9, color: TD, cursor: "pointer", padding: 7, lineHeight: 1 }}><Icon name="settings" size={16} /></button>
          <div style={{ fontSize: 11, color: TD, fontWeight: 700, letterSpacing: 0.6, marginBottom: 6 }}>Learn German</div>
          <h1 style={{ fontFamily: FN, fontSize: 34, margin: "0 0 6px", fontWeight: 800, lineHeight: 1, color: T, display: "flex", alignItems: "center" }}>
            <img src="icons/icon-192x192.png" alt="" style={{ width: 38, height: 38, mixBlendMode: "screen", marginLeft: -6, marginRight: -2 }} />
            <span>utodeutsch</span>
          </h1>
          <p style={{ color: TD, fontSize: 13, margin: "0 0 14px" }}>Offline-first German trainer · {totalW} cards · {totalL} mastered</p>
          <div style={{ height: 4, background: "#222", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${totalW > 0 ? (totalL / totalW) * 100 : 0}%`, background: A, borderRadius: 2, transition: "width 0.5s" }} />
          </div>
        </div>

        <div style={{ fontSize: 11, color: TD, fontWeight: 700, letterSpacing: 0.6, margin: "2px 0 10px" }}>Today</div>
        {/* Today metrics */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <div style={{ background: SH, border: `1px solid ${B}`, borderRadius: 14, padding: "14px 16px", flex: 1, textAlign: "center" }}>
            <div style={{ fontFamily: FN, fontSize: 26, color: T, fontWeight: 800 }}><CountUp value={dailyStats.streak} /></div>
            <div style={{ fontSize: 10, color: TD, fontWeight: 600, letterSpacing: 0.4 }}>Day streak</div>
          </div>
          <div style={{ background: SH, border: `1px solid ${B}`, borderRadius: 14, padding: "14px 16px", flex: 2, textAlign: "center" }}>
            <div style={{ fontFamily: FN, fontSize: 26, fontWeight: 800 }}>
              <span style={{ color: dailyStats.count >= dailyGoal ? G : T }}>{dailyStats.count}</span>
              <span style={{ color: TD, fontSize: 16 }}> / {dailyGoal}</span>
            </div>
            <div style={{ fontSize: 10, color: TD, fontWeight: 600, letterSpacing: 0.4 }}>Cards today</div>
            <div style={{ height: 3, background: "#0A0A0A", borderRadius: 2, overflow: "hidden", marginTop: 8 }}>
              <div style={{ height: "100%", width: `${dailyGoalPct * 100}%`, background: dailyStats.count >= dailyGoal ? G : A, borderRadius: 2, transition: "width 0.35s ease-out" }} />
            </div>
            {dailyStats.count >= dailyGoal && <div style={{ fontSize: 10, color: G, marginTop: 4, fontWeight: 700 }}>✓ Goal reached</div>}
          </div>
        </div>

        {/* Today's work */}
        {reviewQueueItems.length > 0 && (
          <div style={{ background: SH, border: `1px solid ${B}`, borderRadius: 14, padding: "14px 14px 12px", marginBottom: 14, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: FLAG, opacity: 0.8 }} />
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 10, paddingTop: 2 }}>
              <div style={{ fontSize: 11, color: T, fontWeight: 800, letterSpacing: 0.4 }}>Today's work</div>
              <div style={{ fontSize: 10, color: TD }}>{reviewQueueItems.reduce((sum, item) => sum + item.count, 0)} waiting</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${reviewQueueItems.length}, minmax(0, 1fr))`, gap: 7 }}>
              {reviewQueueItems.map(item => (
                <button key={item.key} type="button" onClick={item.onClick}
                  title={item.detail}
                  style={{ minWidth: 0, background: "#0F0F0F", color: T, border: item.key === "due" && item.count > 0 ? `1.5px solid ${item.color}66` : `1px solid ${item.color}38`, boxShadow: item.key === "due" && item.count > 0 ? `0 0 16px -6px ${item.color}66` : "none", borderRadius: 10, padding: "9px 7px 8px", textAlign: "center", cursor: "pointer", display: "grid", justifyItems: "center", gap: 5, fontFamily: "inherit" }}>
                  <IconBadge name={item.icon} size={26} color={item.color} bg="#0A0A0A66" />
                  <span style={{ fontSize: 11, color: T, fontWeight: 800, lineHeight: 1 }}>{item.title}</span>
                  <span style={{ fontSize: 14, color: item.color, fontWeight: 800, lineHeight: 1 }}>{item.count}</span>
                  {item.count > 0 && item.next && <span style={{ fontSize: 9.5, color: TD, lineHeight: 1, letterSpacing: 0.2 }}>{item.next}</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Primary actions */}
        <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
          <button type="button" onClick={() => openSetup("__all__", "production")}
            style={{ width: "100%", background: A, color: "#0A0A0A", border: "none", borderRadius: 12, padding: "16px 18px", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, fontFamily: "inherit", fontWeight: 800, boxShadow: `0 10px 24px ${A}16` }}>
            <span style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              <IconBadge name="keyboard" size={36} color="#0A0A0A" bg="#0A0A0A18" />
              <span>
                <span style={{ display: "block", fontSize: 11, opacity: 0.74, fontWeight: 800 }}>Build mastery</span>
                <span style={{ display: "block", fontFamily: FN, fontSize: 16, marginTop: 2 }}>Production practice</span>
              </span>
            </span>
            <Icon name="arrowRight" size={20} />
          </button>

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
              style={{ width: "100%", background: "#0F0F0F", color: T, border: `1px solid ${B}`, borderRadius: 12, padding: "13px 14px", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, fontFamily: "inherit", fontWeight: 700 }}>
              <IconBadge name="layers" size={30} color={TD} />
              <span>
                <span style={{ display: "block", color: TD, fontSize: 10, fontWeight: 800 }}>All cards</span>
                <span style={{ display: "block", fontSize: 12 }}>Custom session</span>
              </span>
            </button>
          </div>
        </div>
        {ProgressHub()}

        {/* Library */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 30, marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: TD, fontWeight: 800, letterSpacing: 0.6 }}>Library</div>
          <button type="button" onClick={() => { setBrowseQuery(""); setBrowseKnownOnly(false); setScreen("browse"); }}
            style={{ background: "transparent", border: `1px solid ${A}33`, borderRadius: 999, padding: "5px 12px", color: A, fontSize: 11, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}>
            <Icon name="book" size={12} /> Browse all words
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {CATS.map(cat => {
            const st = getCatStats(cat);
            const pct = st.total > 0 ? (st.seen / st.total) * 100 : 0;
            const productionPct = st.total > 0 ? (st.productionSeen / st.total) * 100 : 0;
            const masteredPct = st.total > 0 ? (st.mastered / st.total) * 100 : 0;
            const done = st.mastered >= st.total && st.total > 0;
            const justMastered = newlyMasteredCats.has(cat);
            return (
              <button key={cat} className={justMastered ? "ad-category-mastered" : undefined} onClick={() => openSetup(cat)} style={{ background: justMastered ? `linear-gradient(155deg, ${G}10, #101010 42%)` : "#101010", border: `1px solid ${justMastered ? G : done ? G : B}`, borderRadius: 10, padding: "12px 11px 10px", minHeight: 112, textAlign: "left", cursor: "pointer", transition: "all 0.15s, transform 0.1s", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div style={{ position: "absolute", top: 0, left: 0, height: 2, width: `${pct}%`, background: A, opacity: 0.18, transition: "width 0.5s" }} />
                {justMastered && <div style={{ position: "absolute", top: 7, right: 8, fontSize: 9, color: G, fontWeight: 900, letterSpacing: 0.8, textTransform: "uppercase" }}>New</div>}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, minWidth: 0 }}>
                  <IconBadge name={categoryIcons[cat] || "book"} size={27} color={done ? G : A} bg="#0A0A0A66" />
                  <span style={{ fontFamily: FN, fontSize: 13, color: T, lineHeight: 1.16, fontWeight: 800, minWidth: 0 }}>{cat}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 9, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontFamily: FN, fontSize: 15, color: A, fontWeight: 800 }}>{st.productionSeen}</div>
                    <div style={{ fontSize: 9, color: TD, fontWeight: 800 }}>Production</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: FN, fontSize: 15, color: st.mastered ? G : TD, fontWeight: 800 }}>{st.mastered}</div>
                    <div style={{ fontSize: 9, color: TD, fontWeight: 800 }}>Mastered</div>
                  </div>
                </div>
                <div style={{ display: "grid", gap: 5 }}>
                  <div style={{ height: 3, background: "#0A0A0A", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${productionPct}%`, background: A, borderRadius: 2, opacity: 0.9, transition: "width 0.5s" }} />
                  </div>
                  <div style={{ height: 3, background: "#0A0A0A", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${masteredPct}%`, background: G, borderRadius: 2, opacity: 0.95, transition: "width 0.5s" }} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Training */}
        <div style={{ marginTop: 34 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: TD, fontWeight: 800, letterSpacing: 0.6 }}>Training</div>
            <div style={{ fontSize: 10, color: TD }}>Targeted drills</div>
          </div>
          <div style={{ background: "#0A0A0A", border: `1px solid ${A}22`, borderRadius: 14, padding: 10, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: FLAG, opacity: 0.9 }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
              {[
                { l: "der / die / das", s: "Articles", meta: "Gender", icon: "book", c: "__all__", m: "article" },
                { l: "Grammar Cloze", s: "Gaps", meta: "Structure", icon: "layers", c: "__grammar__", m: "cloze" },
                { l: "Verb Trainer", s: "Conjugation", meta: "Speed", icon: "bolt", c: "__verb__", m: "verb" },
                { l: "Sentence Builder", s: "Word order", meta: "Syntax", icon: "keyboard", c: "__sentence__", m: "sentence" },
                { l: "Imperative", s: "Imperativ", meta: "Commands", icon: "target", c: "__imperativ__", m: "imperativ" },
                { l: "Listening", s: "Hör-Training", meta: "Dialogue", icon: "headphones", c: "__listening__", m: "listening" },
              ].map(({ l, s, meta, icon, c, m }) => {
                const ts = trainingStats[m];
                const pct = ts && ts.total > 0 ? (ts.seen / ts.total) * 100 : 0;
                const done = ts && ts.seen >= ts.total && ts.total > 0;
                return (
                  <button key={m} onClick={() => { setSetupCat(c); setSetupMode(m); setSessLen(Math.min(15, m === "cloze" ? CLOZE.length : m === "verb" ? 30 : m === "sentence" ? SENTENCES.length : m === "imperativ" ? IMPERATIVES.length : m === "listening" ? DIALOGUES.length : nouns.length)); setShowSetup(true); }}
                    style={{ background: "linear-gradient(155deg, #151515 0%, #0D0D0D 100%)", border: `1px solid ${done ? G : A}22`, borderRadius: 12, padding: "12px 10px 10px", minHeight: 96, textAlign: "left", cursor: "pointer", transition: "all 0.15s, transform 0.1s", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 10, fontFamily: "inherit", position: "relative", overflow: "hidden" }}>
                    {ts && <div style={{ position: "absolute", bottom: 0, left: 0, height: 2, width: `${pct}%`, background: done ? G : A, opacity: 0.8, transition: "width 0.5s" }} />}
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                      <IconBadge name={icon} size={30} color={done ? G : A} bg={`${A}0F`} />
                      <span style={{ fontSize: 9, color: done ? G : TD, fontWeight: 900, letterSpacing: 0.7, textTransform: "uppercase", paddingTop: 3 }}>{meta}</span>
                    </div>
                    <div>
                      <div style={{ fontFamily: FN, fontSize: 13, color: T, lineHeight: 1.12, fontWeight: 900 }}>{l}</div>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginTop: 5 }}>
                        <span style={{ fontSize: 10, color: TD, fontWeight: 700 }}>{s}</span>
                        {ts && <span style={{ fontSize: 10, color: TD, fontWeight: 800 }}>{ts.seen}/{ts.total}</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
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

      {/* ── WORD BROWSER ── */}
      {screen === "browse" && (() => {
        const q = normalize(browseQuery);
        let list = allVocab();
        if (browseKnownOnly) list = list.filter(w => known.has(knownKey(w._cat, w.de)));
        if (q) list = list.filter(w => normalize(w.de).includes(q) || w.en.toLowerCase().includes(browseQuery.trim().toLowerCase()));
        list.sort((a, b) => a.de.localeCompare(b.de, "de"));
        const total = list.length;
        const shown = list.slice(0, 80);
        return (
          <div style={{ padding: "0 20px max(28px, env(safe-area-inset-bottom))", minHeight: DVH, display: "flex", flexDirection: "column" }}>
            <div style={{ paddingTop: "max(12px, env(safe-area-inset-top))", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <button onClick={() => setScreen("home")} style={{ background: "transparent", border: `1px solid ${A}33`, borderRadius: 10, color: A, fontSize: 13, cursor: "pointer", padding: "8px 14px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="arrowLeft" size={14} /> Back</button>
              <div style={{ fontSize: 11, color: TD, fontWeight: 700 }}>{known.size} known · {allVocab().length} words</div>
            </div>
            <input className="ad-input" value={browseQuery} onChange={e => setBrowseQuery(e.target.value)} placeholder="Search German or English…" autoCapitalize="off" autoCorrect="off" spellCheck="false"
              style={{ width: "100%", boxSizing: "border-box", padding: "13px 16px", borderRadius: 12, border: `1px solid ${B}`, background: SH, color: T, fontSize: 16, fontFamily: BD, outline: "none", marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              {[[false, "All words"], [true, "Known"]].map(([v, l]) => (
                <button key={l} onClick={() => setBrowseKnownOnly(v)} style={{ padding: "6px 14px", borderRadius: 999, fontSize: 12, fontWeight: 800, cursor: "pointer", background: browseKnownOnly === v ? A : "#0A0A0A", color: browseKnownOnly === v ? "#0A0A0A" : TD, border: `1px solid ${browseKnownOnly === v ? A : B}` }}>{l}</button>
              ))}
            </div>
            {shown.length === 0 && <div style={{ color: TD, fontSize: 13, textAlign: "center", marginTop: 40 }}>{browseKnownOnly ? "No words marked as known yet. Tap “Known” on any word you don’t need to practise." : "No matches. Try a shorter search."}</div>}
            <div style={{ display: "grid", gap: 8 }}>
              {shown.map(w => {
                const isKnown = known.has(knownKey(w._cat, w.de));
                const v = normalizeEntry(prog[`vocab::${w._cat}::${w.de}`]);
                const pr = normalizeEntry(prog[`production::${w._cat}::${w.de}`]);
                const att = v.stats.attempts + pr.stats.attempts;
                const mastered = pr.stats.productionStreak >= MASTERY_STREAK;
                return (
                  <div key={`${w._cat}::${w.de}`} style={{ background: "#101010", border: `1px solid ${mastered ? `${G}44` : B}`, borderRadius: 12, padding: "11px 12px", opacity: isKnown && !browseKnownOnly ? 0.55 : 1 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
                          <span style={{ fontFamily: FN, fontSize: 15, fontWeight: 800, color: T, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.de}</span>
                          <span style={{ fontSize: 9, color: A, fontWeight: 800, border: `1px solid ${A}44`, borderRadius: 999, padding: "1px 6px", flexShrink: 0 }}>{cardLevel(w)}</span>
                          {mastered && <span style={{ fontSize: 9, color: G, fontWeight: 900, flexShrink: 0 }}>★</span>}
                        </div>
                        <div style={{ fontSize: 12, color: TD, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.en}</div>
                        <div style={{ fontSize: 9.5, color: TD, marginTop: 3, opacity: 0.8 }}>{w._cat}{att > 0 ? ` · ${att} attempt${att !== 1 ? "s" : ""}` : " · not practised yet"}</div>
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
            {total > shown.length && <div style={{ color: TD, fontSize: 11, textAlign: "center", marginTop: 12 }}>Showing {shown.length} of {total} — refine your search to see more.</div>}
          </div>
        );
      })()}

      {/* ── FLIP CARD SCREEN (vocab/production) ── */}
      {screen === "cards" && card && <div style={{ padding: "0 20px", height: DVH, display: "flex", flexDirection: "column" }}>
        {Header({ extra: mode === "production" ? <span style={{ color: A, marginRight: 6 }}>EN→DE</span> : "" })}
        <ProgBar pct={((idx + 1) / cards.length) * 100} color={rpt > 0 ? R : A} />

        {mode === "production" ? (
          <div className={cardCls} style={{ flex: 1, display: "flex", flexDirection: "column", opacity: vis ? 1 : 0 }}>
            <div className="ad-elev" style={{ background: "linear-gradient(160deg, #121212 0%, #0E0E0E 100%)", border: `1px solid ${A}22`, borderRadius: 20, padding: "32px 24px", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", maxHeight: 320, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, #222 33%, ${R} 33% 66%, ${A} 66%)`, opacity: 0.7 }} />
              <div style={{ fontFamily: FN, fontSize: 28, fontWeight: 600, textAlign: "center", lineHeight: 1.25, color: T, letterSpacing: -0.3 }}>{card.en}</div>
              {answered && <>
                <div style={{ marginTop: 16, fontFamily: FN, fontSize: 22, fontWeight: 600, color: inputResult === "wrong" ? R : G, letterSpacing: -0.2 }}>{card.de}</div>
                {inputResult === "close" && <div style={{ fontSize: 11, color: A, marginTop: 4 }}>Close! Check spelling.</div>}
                <button onClick={() => speak(card.de)} style={{ background: "transparent", border: `1px solid ${A}44`, borderRadius: 999, padding: "5px 12px", color: A, fontSize: 11, cursor: "pointer", fontWeight: 600, marginTop: 10, opacity: 0.9, display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="volume" size={13} /> Hören</button>
                {SpeedBadge({ ms: lastElapsed })}{CardStats()}
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
                ) : <button onClick={() => setShowEx(true)} style={{ marginTop: 10, background: "transparent", border: "none", color: TD, fontSize: 11, cursor: "pointer", fontWeight: 600, opacity: 0.7, letterSpacing: 1.2, padding: "6px 8px", }}>Show example</button>}
              </>}
            </div>
            <div style={{ paddingTop: 16, paddingBottom: "max(28px, env(safe-area-inset-bottom))" }}>
              {!answered ? <><UmlautBar onInsert={insertChar} /><div style={{ display: "flex", gap: 8 }}>
                <input ref={typedInputRef} className="ad-input" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && input.trim()) submitTyped(); }}
                  placeholder="Type in German…" autoFocus autoCapitalize="off" autoCorrect="off" spellCheck="false"
                  style={{ flex: 1, padding: "14px 16px", borderRadius: 12, border: `1px solid ${B}`, background: SH, color: T, fontSize: 16, fontFamily: BD, outline: "none" }} />
                <Btn bg={A} color="#0A0A0A" ariaLabel="Submit answer" onClick={submitTyped} style={{ width: "auto", padding: "14px 20px" }}>→</Btn>
              </div></>
                : <Btn bg={SH} border={`1px solid ${B}`} onClick={nextCard}>{idx < cards.length - 1 ? "Next →" : "Results"}</Btn>}
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div role={!flipped ? "button" : undefined} tabIndex={!flipped && vis ? 0 : -1} aria-label={!flipped ? "Reveal answer" : "Answer revealed"} onKeyDown={handleRevealKey} onClick={revealCard} style={{ flex: 1, perspective: 900, cursor: !flipped ? "pointer" : "default", maxHeight: 360, opacity: vis ? 1 : 0, transition: "opacity 0.15s" }}>
              <div style={{ width: "100%", height: "100%", transformStyle: "preserve-3d", transition: vis ? "transform 0.5s cubic-bezier(0.4,0,0.2,1)" : "none", transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)", position: "relative" }}>
                <div className="ad-elev" style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", background: "linear-gradient(160deg, #141414 0%, #0E0E0E 100%)", border: `1px solid ${A}33`, borderRadius: 20, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 24px", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, #222 33%, ${R} 33% 66%, ${A} 66%)` }} />
                  <div style={{ fontFamily: FN, fontSize: 30, fontWeight: 600, textAlign: "center", lineHeight: 1.2, color: T, letterSpacing: -0.3 }}>{card.de}</div>
                  {card.diff && <div style={{ position: "absolute", top: 14, right: 16, fontSize: 9, color: card.diff === "hard" ? R : card.diff === "medium" ? A : G, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{card.diff}</div>}
                  <div style={{ position: "absolute", bottom: 18, fontSize: 11, color: TD, letterSpacing: 1, fontWeight: 600, opacity: 0.65 }}>Tap to reveal</div>
                </div>
                <div className="ad-elev" style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", transform: "rotateY(180deg)", background: "linear-gradient(160deg, #141414 0%, #0E0E0E 100%)", border: `1px solid ${A}33`, borderRadius: 20, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 24px", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, #222 33%, ${R} 33% 66%, ${A} 66%)` }} />
                  <div style={{ fontFamily: FN, fontSize: 28, fontWeight: 600, textAlign: "center", lineHeight: 1.2, color: T, marginBottom: 18, letterSpacing: -0.3 }}>{card.en}</div>
                  <div style={{ fontFamily: FN, fontSize: 19, textAlign: "center", lineHeight: 1.3, color: A, fontWeight: 600, marginBottom: 6 }}>{card.de}</div>
                  <button onClick={e => { e.stopPropagation(); speak(card.de); }} style={{ background: "transparent", border: `1px solid ${A}44`, borderRadius: 999, padding: "5px 12px", color: A, fontSize: 11, cursor: "pointer", fontWeight: 600, marginBottom: 14, opacity: 0.9, display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="volume" size={13} /> Hören</button>
                  {answered && <>{SpeedBadge({ ms: lastElapsed })}{CardStats()}</>}
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
            <div style={{ paddingTop: 20, paddingBottom: "max(28px, env(safe-area-inset-bottom))" }}>
              {flipped && !answered && <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => handleFlipAnswer(false)} style={{
                  flex: 1, padding: "18px 16px", borderRadius: 16,
                  background: `linear-gradient(180deg, ${R}14 0%, ${R}22 100%)`,
                  color: "#F87171", border: `1px solid ${R}44`,
                  fontSize: 16, fontWeight: 700, fontFamily: "inherit",
                  cursor: "pointer", letterSpacing: 0.3,
                  boxShadow: `inset 0 1px 0 ${R}33, 0 2px 4px rgba(0,0,0,0.35)`,
                  transition: "transform 0.1s, background 0.2s"
                }}>Again</button>
                <button onClick={() => handleFlipAnswer(true)} style={{
                  flex: 1, padding: "18px 16px", borderRadius: 16,
                  background: `linear-gradient(180deg, ${G}14 0%, ${G}22 100%)`,
                  color: "#86EFAC", border: `1px solid ${G}55`,
                  fontSize: 16, fontWeight: 700, fontFamily: "inherit",
                  cursor: "pointer", letterSpacing: 0.3,
                  boxShadow: `inset 0 1px 0 ${G}33, 0 2px 4px rgba(0,0,0,0.35)`,
                  transition: "transform 0.1s, background 0.2s"
                }}>Got it</button>
              </div>}
              {answered && <Btn bg={SH} border={`1px solid ${B}`} onClick={nextCard}>{idx < cards.length - 1 ? "Next →" : "Results"}</Btn>}
              {!flipped && vis && <div style={{ textAlign: "center", color: TD, fontSize: 12, paddingTop: 6 }}>Think of the answer, then tap</div>}
            </div>
          </div>
        )}
      </div>}

      {/* ── DRILL SCREEN (article/cloze/verb) ── */}
      {screen === "drill" && card && <div style={{ padding: "0 20px", minHeight: DVH, display: "flex", flexDirection: "column" }}>
        {Header({ extra: <span style={{ color: A, marginRight: 6 }}>{mode === "article" ? "der/die/das" : mode === "cloze" ? "Cloze" : mode === "imperativ" ? "Imperative" : mode === "listening" ? "Listening" : "Verb"}</span> })}
        <ProgBar pct={((idx + 1) / cards.length) * 100} color={rpt > 0 ? R : A} />

        <div className={cardCls} style={{ opacity: vis ? 1 : 0, flex: 1, display: "flex", flexDirection: "column" }}>
          <div className="ad-elev" style={{ background: FGRAD, border: `1px solid ${A}22`, borderRadius: 20, padding: "28px 20px", marginBottom: 16, minHeight: 160, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, #222 33%, ${R} 33% 66%, ${A} 66%)`, opacity: 0.7 }} />
            {mode === "article" && <>
              <div style={{ fontSize: 10, color: AD, letterSpacing: 3, textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>What article?</div>
              <div style={{ fontFamily: FN, fontSize: 26, textAlign: "center" }}>___ {card.noun}</div>
              <div style={{ fontSize: 12, color: TD, marginTop: 8 }}>({card.en})</div>
              {answered && <><div style={{ marginTop: 12, fontFamily: FN, fontSize: 20, color: sel !== null && ["der", "die", "das"][sel] === card.article ? G : R }}>{card.article} {card.noun}</div><SpeakBtn text={`${card.article} ${card.noun}`} />{SpeedBadge({ ms: lastElapsed })}{CardStats()}</>}
            </>}
            {mode === "cloze" && <>
              <div style={{ fontSize: 10, color: AD, letterSpacing: 3, textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>Fill the gap</div>
              <div style={{ fontFamily: FN, fontSize: 20, textAlign: "center", lineHeight: 1.4 }}>{answered ? card.q.replace("___", card.a) : card.q}</div>
              {answered && <div style={{ marginTop: 12, fontSize: 12, color: TD, textAlign: "center", lineHeight: 1.5, padding: "8px 14px", background: "#0A0A0A66", borderRadius: 10, borderLeft: `3px solid ${A}` }}>
                {inputResult === "wrong" ? <><span style={{ color: R }}>Your answer: {input}</span><br /><span style={{ color: G }}>Correct: {card.a}</span><br /></> :
                  <span style={{ color: G }}>Correct! ✓</span>}{" "}{card.h}
                {SpeedBadge({ ms: lastElapsed })}{CardStats()}
              </div>}
            </>}
            {mode === "verb" && <>
              <div style={{ fontSize: 10, color: AD, letterSpacing: 3, textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>Conjugate — {card.tense}</div>
              <div style={{ fontFamily: FN, fontSize: 22, color: A, marginBottom: 6 }}>{card.verb}</div>
              {card.tense === "Perfekt" ? <div style={{ fontSize: 15, color: T, fontWeight: 600 }}>{card.pron} ___ ___?</div>
                : <div style={{ fontSize: 15, color: T, fontWeight: 600 }}>{card.pron} ___?</div>}
              <div style={{ fontSize: 12, color: TD, marginTop: 4 }}>({card.en})</div>
              {answered && <><div style={{ marginTop: 12, fontSize: 13, color: G, fontWeight: 700 }}>{card.pron} {card.correct}</div>
                <div style={{ fontSize: 11, color: TD, marginTop: 4 }}>{card.hint}</div><SpeakBtn text={`${card.pron} ${card.correct}`} />{SpeedBadge({ ms: lastElapsed })}{CardStats()}</>}
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
                {inputResult === "wrong" && <div style={{ fontSize: 11, color: R, marginTop: 6 }}>You: {input}</div>}
                <div style={{ fontSize: 11, color: TD, marginTop: 8, fontStyle: "italic", textAlign: "center", padding: "0 6px" }}>„{card.ex}"</div>
                <div style={{ fontSize: 11, color: BL, marginTop: 4, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}><Icon name="target" size={12} /> {card.hint}</div>
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
          </div>

          {mode === "cloze" && !answered && (
            <><UmlautBar onInsert={insertChar} />
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input ref={typedInputRef} className="ad-input" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && input.trim()) submitCloze(); }}
                placeholder="Type answer…" autoFocus autoCapitalize="off" autoCorrect="off" spellCheck="false"
                style={{ flex: 1, padding: "14px 16px", borderRadius: 12, border: `1px solid ${B}`, background: SH, color: T, fontSize: 16, fontFamily: BD, outline: "none" }} />
              <Btn bg={A} color="#0A0A0A" ariaLabel="Submit answer" onClick={submitCloze} style={{ width: "auto", padding: "14px 20px" }}>→</Btn>
            </div></>
          )}
          {mode === "imperativ" && !answered && (
            <><UmlautBar onInsert={insertChar} />
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input ref={typedInputRef} className="ad-input" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && input.trim()) { const target = card[card._person]; const result = checkMatch(input, target); setInputResult(result); setAnswered(true); record(result !== "wrong", card, Date.now() - tStart); speak(target); } }}
                placeholder={card._person === "sie" ? "e.g. kommen Sie" : "Type the imperative…"} autoFocus autoCapitalize="off" autoCorrect="off" spellCheck="false"
                style={{ flex: 1, padding: "14px 16px", borderRadius: 12, border: `1px solid ${B}`, background: SH, color: T, fontSize: 16, fontFamily: BD, outline: "none" }} />
              <Btn bg={A} color="#0A0A0A" ariaLabel="Submit answer" onClick={() => { if (!input.trim()) return; const target = card[card._person]; const result = checkMatch(input, target); setInputResult(result); setAnswered(true); record(result !== "wrong", card, Date.now() - tStart); speak(target); }} style={{ width: "auto", padding: "14px 20px" }}>→</Btn>
            </div></>
          )}
          {mode === "listening" && !answered && card.opts && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
              {card.opts.map((opt, i) => <button key={i} onClick={() => handleDrillAnswer(i)} style={{ padding: "14px 16px", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer", background: SH, border: `2px solid ${B}`, color: T, fontFamily: BD, textAlign: "left" }}>{opt}</button>)}
            </div>
          )}
          {mode === "listening" && answered && card.opts && (
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
          {mode === "article" && answered && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {["der", "die", "das"].map((art, i) => { const isC = art === card.article; const wasS = i === sel;
                return (<div key={i} style={{ padding: "16px", borderRadius: 14, fontSize: 18, fontWeight: 700, background: isC ? "#0A1A0A" : wasS ? "#1A0000" : SH, border: `2px solid ${isC ? G : wasS ? R : B}`, color: isC ? G : wasS ? R : TD, fontFamily: FN, textAlign: "center" }}>{art}{isC ? " ✓" : wasS ? " ✗" : ""}</div>);
              })}
            </div>
          )}
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
            <div style={{ display: "flex", gap: 8 }}>
              <input ref={typedInputRef} className="ad-input" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && input.trim()) { setAnswered(true); const result = checkMatch(input, card.correct); setInputResult(result); record(result !== "wrong", card, Date.now() - tStart); } }}
                placeholder={`${card.pron} …`} autoFocus autoCapitalize="off" autoCorrect="off" spellCheck="false"
                style={{ flex: 1, padding: "14px 16px", borderRadius: 12, border: `1px solid ${B}`, background: SH, color: T, fontSize: 16, fontFamily: BD, outline: "none" }} />
              <Btn bg={A} color="#0A0A0A" ariaLabel="Submit answer" onClick={() => { if (!input.trim()) return; setAnswered(true); const result = checkMatch(input, card.correct); setInputResult(result); record(result !== "wrong", card, Date.now() - tStart); }} style={{ width: "auto", padding: "14px 20px" }}>→</Btn>
            </div></>
          )}
          <div style={{ marginTop: "auto", paddingTop: 16, paddingBottom: "max(28px, env(safe-area-inset-bottom))" }}>
            {answered && <Btn bg={SH} border={`1px solid ${B}`} onClick={nextDrill}>{idx < cards.length - 1 ? "Next →" : "Results"}</Btn>}
          </div>
        </div>
      </div>}

      {/* ── SENTENCE BUILDER ── */}
      {screen === "sentence" && card && <div style={{ padding: "0 20px", minHeight: DVH, display: "flex", flexDirection: "column" }}>
        {Header({ extra: <span style={{ color: BL, marginRight: 6 }}>Build</span> })}
        <ProgBar pct={((idx + 1) / cards.length) * 100} color={rpt > 0 ? R : BL} />
        <div className={cardCls} style={{ opacity: vis ? 1 : 0, flex: 1, display: "flex", flexDirection: "column" }}>
          <div className="ad-elev" style={{ background: FGRAD, border: `1px solid ${A}22`, borderRadius: 20, padding: "24px 20px", marginBottom: 16 }}>
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
          <div style={{ marginTop: "auto", paddingTop: 8, paddingBottom: "max(28px, env(safe-area-inset-bottom))" }}>
            {!sbChecked && sbPicked.length > 0 && <Btn bg={BL} color="#0A0A0A" onClick={sbCheck} style={{ fontFamily: FN }}>Check</Btn>}
            {sbChecked && <Btn bg={SH} border={`1px solid ${B}`} onClick={sbNext}>{idx < cards.length - 1 ? "Next →" : "Results"}</Btn>}
          </div>
        </div>
      </div>}

      {/* ── NEW: DIALOGUE SCREEN ── */}
      {screen === "dialogues" && <div style={{ padding: "0 20px", minHeight: DVH }}>
        {(() => {
          const pool = (cards && cards.length) ? cards : DIALOGUES;
          const dlg = pool[dlgIdx];
          if (!dlg) return null;
          return (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <button onClick={() => setScreen("home")} style={{ background: "none", border: "none", color: TD, fontSize: 14, cursor: "pointer" }}>← Back</button>
                <div style={{ fontSize: 12, color: TD, fontWeight: 600 }}>{dlgIdx + 1}/{pool.length}</div>
              </div>
              <div style={{ fontFamily: FN, fontSize: 22, marginBottom: 16 }}>{dlg.title}</div>
              {dlg.lines.map((line, i) => (
                <div key={i} style={{ marginBottom: 14 }}>
                  {line.speaker && <div style={{ fontSize: 10, color: AD, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>{line.speaker}</div>}
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <div style={{ fontSize: 14, color: T, lineHeight: 1.5, flex: 1 }}>{line.de}</div>
                    <button type="button" aria-label={`Play line ${i + 1}`} onClick={() => speak(line.de)} style={{ background: "none", border: "none", color: A, fontSize: 14, cursor: "pointer", flexShrink: 0, padding: 3 }}><Icon name="volume" size={15} /></button>
                  </div>
                  <button onClick={() => { setDlgRevealed(r => ({ ...r, [i]: true })); speak(line.de); }} style={{ background: "none", border: "none", color: dlgRevealed[i] ? BL : TD, fontSize: 12, cursor: "pointer", padding: "4px 0", fontStyle: "italic" }}>
                    {dlgRevealed[i] ? line.en : "↳ tap to translate"}
                  </button>
                </div>
              ))}
              <div style={{ display: "flex", gap: 10, marginTop: 24, paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>
                {dlgIdx > 0 && <Btn bg={S} border={`1px solid ${B}`} onClick={() => { setDlgIdx(i => i - 1); setDlgRevealed({}); }} style={{ flex: 1 }}>← Prev</Btn>}
                {dlgIdx < pool.length - 1 && <Btn bg={A} color="#0A0A0A" onClick={() => { setDlgIdx(i => i + 1); setDlgRevealed({}); }} style={{ flex: 1 }}>Next →</Btn>}
                {dlgIdx === pool.length - 1 && <Btn bg={SH} border={`1px solid ${B}`} onClick={() => setScreen("home")} style={{ flex: 1 }}>Done</Btn>}
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
              <div style={{ background: FGRAD, border: `1px solid ${A}22`, borderRadius: 20, padding: "40px 24px", width: "100%", textAlign: "center", marginBottom: 18 }}>
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
              style={{ width: 56, height: 56, borderRadius: "50%", background: SH, border: `1px solid ${B}`, color: idx === 0 ? B : T, fontSize: 22, cursor: idx === 0 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
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
              style={{ width: 56, height: 56, borderRadius: "50%", background: SH, border: `1px solid ${B}`, color: T, fontSize: 22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="skipForward" size={22} />
            </button>
          </div>
          <div style={{ textAlign: "center", fontSize: 10, color: TD, marginTop: 14, letterSpacing: 1 }}>
            {audioEnFirst ? "EN → DE" : "DE → EN"} · {audioPauseLen / 1000}s pause
          </div>
        </div>
      </div>}

      {/* ── RESULTS ── */}
      {screen === "results" && <div style={{ padding: "40px 24px 24px", textAlign: "center" }}>
        <div style={{ height: 3, background: `linear-gradient(90deg, #222 33%, ${R} 33% 66%, ${A} 66%)`, borderRadius: 2, marginBottom: 24 }} />
        <div style={{ fontSize: 11, color: TD, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>{failed.length > 0 ? "Keep Going" : "Complete"}</div>
        <h2 style={{ fontFamily: FN, fontSize: 28, margin: "0 0 6px", fontWeight: 800, color: T }}>{failed.length > 0 ? "Almost There" : "Session Complete"}</h2>
        <p style={{ color: TD, fontSize: 13, marginBottom: 8 }}>
          {category}
          {rpt > 0 ? ` · Round ${rpt + 1}` : ""}
          {" · "}
          <span style={{ color: A, fontWeight: 600 }}>{mode === "vocab" ? "DE→EN" : mode === "production" ? "EN→DE" : mode === "article" ? "der/die/das" : mode === "cloze" ? "Cloze" : mode === "verb" ? "Verb" : mode === "sentence" ? "Sentence" : mode === "imperativ" ? "Imperative" : mode === "listening" ? "Listening" : mode === "audio" ? "Audio" : mode}</span>
        </p>
        {failed.length > 0 && <p style={{ color: R, fontSize: 13, marginBottom: 8, fontWeight: 700 }}>{failed.length} card{failed.length !== 1 ? "s" : ""} to repeat</p>}
        {failedNames.length > 0 && <div style={{ marginBottom: 20, padding: "12px 16px", background: SH, border: `1px solid ${R}33`, borderRadius: 14, textAlign: "left", maxHeight: 120, overflowY: "auto" }}>
          {failedNames.map((n, i) => (<div key={i} style={{ fontSize: 12, color: R, padding: "4px 0", borderBottom: i < failedNames.length - 1 ? `1px solid ${B}` : "none" }}>✗ {n}</div>))}
        </div>}
        {newlyMastered.length > 0 && <div className="ad-mastery-burst" style={{ margin: "0 0 20px", padding: "14px 14px 12px", background: `linear-gradient(145deg, ${G}14, #0F0F0F 68%)`, border: `1px solid ${G}55`, borderRadius: 14, textAlign: "left", boxShadow: `0 0 24px ${G}12` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <IconBadge name="trophy" size={30} color={G} bg={`${G}12`} />
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
        {failed.length === 0 && <div style={{ height: 16 }} />}

        {mode === "audio" ? (
          /* Audio is passive listening — there are no graded answers, so showing a
             correct/wrong split or "100% accuracy" here would be fiction. */
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontFamily: FN, fontSize: 48, color: A, fontWeight: 800 }}><CountUp value={stats.c} /></div>
            <div style={{ fontSize: 10, color: TD, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Phrases heard</div>
          </div>
        ) : (
        <div style={{ display: "flex", justifyContent: "center", gap: 32, marginBottom: 28 }}>
          <div><div style={{ fontFamily: FN, fontSize: 48, color: G, fontWeight: 800 }}><CountUp value={stats.c} /></div><div style={{ fontSize: 10, color: TD, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Correct</div></div>
          <div style={{ width: 1, background: B }} />
          <div><div style={{ fontFamily: FN, fontSize: 48, color: R, fontWeight: 800 }}><CountUp value={stats.w} /></div><div style={{ fontSize: 10, color: TD, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Wrong</div></div>
        </div>
        )}

        {(mode !== "audio" && stats.c + stats.w > 0) && <div style={{ width: 110, height: 110, borderRadius: "50%", border: `3px solid ${failed.length > 0 ? R : A}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", margin: "0 auto 28px", background: SH }}>
          <div style={{ fontFamily: FN, fontSize: 30, color: failed.length > 0 ? R : A, fontWeight: 800 }}><CountUp value={Math.round((stats.c / (stats.c + stats.w)) * 100)} format={n => `${n}%`} /></div>
          <div style={{ fontSize: 10, color: TD, fontWeight: 600 }}>accuracy</div>
        </div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {failed.length > 0 ? <>
            <Btn bg={R} color="#FFF" onClick={startRepeat} style={{ fontFamily: FN, fontSize: 15, fontWeight: 800 }}>Repeat {failed.length} Failed Card{failed.length !== 1 ? "s" : ""}</Btn>
            <Btn bg={SH} border={`1px solid ${B}`} onClick={() => setScreen("home")} style={{ fontWeight: 600 }}>Back to home</Btn>
          </> : <Btn bg={A} color="#0A0A0A" onClick={() => setScreen("home")} style={{ fontFamily: FN, fontSize: 15, fontWeight: 800 }}>Weiter</Btn>}
        </div>
      </div>}
    </div>
  );
}


ReactDOM.createRoot(document.getElementById('root')).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
);
