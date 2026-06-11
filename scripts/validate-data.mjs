// Content validator for src/data.js — run standalone (`npm run validate`) or from
// the build, which refuses to ship invalid content. Pure data checks only.
import { readFile } from "node:fs/promises";
import vm from "node:vm";

export async function loadData(path = new URL("../src/data.js", import.meta.url)) {
  const code = await readFile(path, "utf8");
  const ctx = vm.createContext({ console });
  vm.runInContext(code, ctx);
  return vm.runInContext("({ V, CLOZE, VERBS, SENTENCES, DIALOGUES, IMPERATIVES })", ctx);
}

const isStr = (v) => typeof v === "string" && v.trim().length > 0;

export function validateData({ V, CLOZE, VERBS, SENTENCES, DIALOGUES, IMPERATIVES }) {
  const errors = [];
  const warnings = [];
  const err = (m) => errors.push(m);
  const warn = (m) => warnings.push(m);

  // ── Vocabulary ──
  if (!V || typeof V !== "object") err("V missing or not an object");
  const allIds = new Map();
  Object.entries(V || {}).forEach(([cat, list]) => {
    if (!Array.isArray(list)) { err(`V["${cat}"] is not an array`); return; }
    const seenDe = new Map();
    list.forEach((w, i) => {
      if (w === undefined || w === null) { err(`V["${cat}"][${i}] is a hole/null (sparse array)`); return; }
      if (!isStr(w.de)) err(`V["${cat}"][${i}] missing de`);
      if (!isStr(w.en)) err(`V["${cat}"][${i}] (${w.de || "?"}) missing en`);
      if (w.diff && !["easy", "medium", "hard"].includes(w.diff)) err(`V["${cat}"] "${w.de}": bad diff "${w.diff}"`);
      if (w.level && !["A1", "A2", "B1", "B2"].includes(w.level)) err(`V["${cat}"] "${w.de}": bad level "${w.level}"`);
      if (w.ex && !isStr(w.exEn)) warn(`V["${cat}"] "${w.de}": ex without exEn`);
      const key = w.id || w.de;
      if (seenDe.has(key)) err(`V["${cat}"]: duplicate card key "${key}" (progress keys would collide — add a distinct id)`);
      seenDe.set(key, i);
      if (w.id) {
        if (allIds.has(w.id)) err(`duplicate explicit id "${w.id}" (also in ${allIds.get(w.id)})`);
        allIds.set(w.id, cat);
      }
    });
  });

  // ── Cloze ──
  const seenQ = new Set();
  (CLOZE || []).forEach((c, i) => {
    if (!c) { err(`CLOZE[${i}] is a hole`); return; }
    if (!isStr(c.q) || !c.q.includes("___")) err(`CLOZE[${i}]: q missing or has no ___ gap`);
    if (!isStr(c.a)) err(`CLOZE[${i}] "${c.q}": missing answer`);
    if (!isStr(c.h)) warn(`CLOZE[${i}] "${c.q}": missing hint`);
    if (c.level && !["A1", "A2", "B1", "B2"].includes(c.level)) err(`CLOZE[${i}] "${c.q}": bad level "${c.level}"`);
    const key = c.id || c.q;
    if (seenQ.has(key)) err(`CLOZE: duplicate question "${key}"`);
    seenQ.add(key);
  });

  // ── Verbs ──
  const persons = ["ich", "du", "er", "wir", "ihr", "sie"];
  const seenV = new Set();
  (VERBS || []).forEach((v, i) => {
    if (!v) { err(`VERBS[${i}] is a hole`); return; }
    if (!isStr(v.v) || !isStr(v.en)) err(`VERBS[${i}]: missing v/en`);
    persons.forEach(p => { if (!isStr(v.pr?.[p])) err(`VERBS "${v.v}": missing present form for "${p}"`); });
    if (!isStr(v.pf)) err(`VERBS "${v.v}": missing Perfekt`);
    if (!["haben", "sein"].includes(v.aux)) err(`VERBS "${v.v}": aux must be haben|sein`);
    if (seenV.has(v.v)) err(`VERBS: duplicate "${v.v}"`);
    seenV.add(v.v);
  });

  // ── Sentences ──
  const seenS = new Set();
  (SENTENCES || []).forEach((s, i) => {
    if (!s) { err(`SENTENCES[${i}] is a hole`); return; }
    if (!Array.isArray(s.correct) || s.correct.length < 2 || !s.correct.every(isStr)) err(`SENTENCES[${i}]: correct must be an array of words`);
    if (!isStr(s.en) || !isStr(s.rule)) err(`SENTENCES[${i}] "${(s.correct || []).join(" ")}": missing en/rule`);
    if (s.level && !["A1", "A2", "B1", "B2"].includes(s.level)) err(`SENTENCES[${i}] "${(s.correct || []).join(" ")}": bad level "${s.level}"`);
    const key = s.id || (s.correct || []).join(" ");
    if (seenS.has(key)) err(`SENTENCES: duplicate "${key}"`);
    seenS.add(key);
  });

  // ── Dialogues ──
  const seenT = new Set();
  (DIALOGUES || []).forEach((d, i) => {
    if (!d) { err(`DIALOGUES[${i}] is a hole`); return; }
    if (!isStr(d.title)) err(`DIALOGUES[${i}]: missing title`);
    if (!Array.isArray(d.lines) || !d.lines.length) err(`DIALOGUES "${d.title}": no lines`);
    (d.lines || []).forEach((l, j) => { if (!isStr(l?.de) || !isStr(l?.en)) err(`DIALOGUES "${d.title}" line ${j}: missing de/en`); });
    (d.questions || []).forEach((q, j) => {
      if (!isStr(q?.q) || !Array.isArray(q?.opts) || q.opts.length < 2) err(`DIALOGUES "${d.title}" question ${j}: malformed`);
      else if (!(q.correctIdx >= 0 && q.correctIdx < q.opts.length)) err(`DIALOGUES "${d.title}" question ${j}: correctIdx out of range`);
    });
    if (seenT.has(d.title)) err(`DIALOGUES: duplicate title "${d.title}" (progress keys use the title)`);
    seenT.add(d.title);
  });

  // ── Imperatives ──
  const seenB = new Set();
  (IMPERATIVES || []).forEach((m, i) => {
    if (!m) { err(`IMPERATIVES[${i}] is a hole`); return; }
    ["base", "en", "du", "ihr", "sie"].forEach(f => { if (!isStr(m[f])) err(`IMPERATIVES[${i}] "${m.base || "?"}": missing ${f}`); });
    if (seenB.has(m.base)) err(`IMPERATIVES: duplicate base "${m.base}"`);
    seenB.add(m.base);
  });

  const counts = {
    vocab: Object.values(V || {}).reduce((n, l) => n + (Array.isArray(l) ? l.length : 0), 0),
    categories: Object.keys(V || {}).length,
    cloze: (CLOZE || []).length,
    verbs: (VERBS || []).length,
    sentences: (SENTENCES || []).length,
    dialogues: (DIALOGUES || []).length,
    imperatives: (IMPERATIVES || []).length,
  };
  return { errors, warnings, counts };
}

// CLI entry: `node scripts/validate-data.mjs`
if (import.meta.url === `file://${process.argv[1]}`) {
  const data = await loadData();
  const { errors, warnings, counts } = validateData(data);
  console.log(`Content: ${counts.vocab} vocab in ${counts.categories} categories · ${counts.cloze} cloze · ${counts.verbs} verbs · ${counts.sentences} sentences · ${counts.dialogues} dialogues · ${counts.imperatives} imperatives`);
  warnings.forEach(w => console.warn(`  warn: ${w}`));
  if (errors.length) {
    errors.forEach(e => console.error(`  ERROR: ${e}`));
    console.error(`${errors.length} error(s).`);
    process.exit(1);
  }
  console.log(`OK — no errors${warnings.length ? `, ${warnings.length} warning(s)` : ""}.`);
}
