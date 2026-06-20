// Content validator for src/data.js — run standalone (`npm run validate`) or from
// the build, which refuses to ship invalid content. Pure data checks only.
import { readFile } from "node:fs/promises";
import vm from "node:vm";

export async function loadData(path = new URL("../src/data.js", import.meta.url)) {
  const code = await readFile(path, "utf8");
  const ctx = vm.createContext({ console });
  vm.runInContext(code, ctx);
  return vm.runInContext("({ V, CLOZE, VERBS, SENTENCES, DIALOGUES, IMPERATIVES, MISSIONS: typeof MISSIONS!=='undefined'?MISSIONS:null, MISSION_ARCS: typeof MISSION_ARCS!=='undefined'?MISSION_ARCS:null, CONFUSIONS: typeof CONFUSIONS!=='undefined'?CONFUSIONS:null, EXAM: typeof EXAM!=='undefined'?EXAM:null, PLACEMENT: typeof PLACEMENT!=='undefined'?PLACEMENT:null })", ctx);
}

const isStr = (v) => typeof v === "string" && v.trim().length > 0;

export function validateData({ V, CLOZE, VERBS, SENTENCES, DIALOGUES, IMPERATIVES, MISSIONS, MISSION_ARCS, CONFUSIONS, EXAM, PLACEMENT }) {
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
      if (w.pl !== undefined) {
        if (!isStr(w.pl) || !/^die .+/.test(w.pl)) err(`V["${cat}"] "${w.de}": pl must look like "die …" (got "${w.pl}")`);
        if (!/^(der|die|das) /.test(w.de || "")) err(`V["${cat}"] "${w.de}": pl set on a non-noun card`);
      }
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
    if (!isStr(v.pt)) err(`VERBS "${v.v}": missing Präteritum`);
    if (!isStr(v.kj2)) err(`VERBS "${v.v}": missing Konjunktiv II (kj2)`);
    if (!isStr(v.ki)) err(`VERBS "${v.v}": missing Konjunktiv I (ki)`);
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

  // ── Missions (P0 scenario spine) ──
  if (MISSIONS) {
    const dlgTitles = new Set((DIALOGUES || []).map(d => d.title));
    const dlgLevel = new Map((DIALOGUES || []).map(d => [d.title, d.level]));
    const LV = { A1: 1, A2: 2, B1: 3, B2: 4 };
    const arcIds = new Set((MISSION_ARCS || []).map(a => a.id));
    const catNames = new Set(Object.keys(V || {}));
    const seenM = new Set();
    let dialogueRefsCovered = 0;
    MISSIONS.forEach((m, i) => {
      if (!isStr(m.id)) err(`MISSIONS[${i}] missing id`);
      if (seenM.has(m.id)) err(`MISSIONS: duplicate id "${m.id}"`);
      seenM.add(m.id);
      if (!isStr(m.cando)) err(`MISSIONS "${m.id}": missing cando`);
      if (!arcIds.has(m.arc)) err(`MISSIONS "${m.id}": arc "${m.arc}" not in MISSION_ARCS`);
      if (m.level && !["A1", "A2", "B1", "B2"].includes(m.level)) err(`MISSIONS "${m.id}": bad level "${m.level}"`);
      (m.dialogues || []).forEach(t => { if (!dlgTitles.has(t)) err(`MISSIONS "${m.id}": dialogue "${t}" not found`); else dialogueRefsCovered++; });
      (m.cats || []).forEach(c => { if (!catNames.has(c)) err(`MISSIONS "${m.id}": category "${c}" not found`); });
      if (!(m.dialogues || []).length) warn(`MISSIONS "${m.id}": no dialogues`);
      // Journey integrity: a mission promising a CEFR level should have an entry-point
      // dialogue at/below that level — otherwise a learner at the mission's level is thrown
      // into harder content (the "upside-down journey" P1 fixed). Warn, don't block.
      const dlgLvls = (m.dialogues || []).map(t => LV[dlgLevel.get(t)]).filter(Boolean);
      if (m.level && dlgLvls.length && Math.min(...dlgLvls) > (LV[m.level] || 0)) {
        const easiest = Object.keys(LV).find(k => LV[k] === Math.min(...dlgLvls));
        warn(`MISSIONS "${m.id}": level ${m.level} but its easiest dialogue is ${easiest} — no entry-level content for a learner at ${m.level}`);
      }
    });
  }

  const LEVELS = ["A1", "A2", "B1", "B2"];

  // ── Confusion pairs (confusion-pair drill) ──
  if (CONFUSIONS) {
    if (!Array.isArray(CONFUSIONS)) err("CONFUSIONS is not an array");
    const seenC = new Set();
    (CONFUSIONS || []).forEach((p, i) => {
      if (!p) { err(`CONFUSIONS[${i}] is a hole`); return; }
      if (!isStr(p.id)) err(`CONFUSIONS[${i}]: missing id`);
      if (seenC.has(p.id)) err(`CONFUSIONS: duplicate id "${p.id}"`);
      seenC.add(p.id);
      if (p.level && !LEVELS.includes(p.level)) err(`CONFUSIONS "${p.id}": bad level "${p.level}"`);
      ["a", "b"].forEach(side => {
        if (!p[side] || !isStr(p[side].de) || !isStr(p[side].en)) err(`CONFUSIONS "${p.id}": side ${side} needs {de,en}`);
      });
      if (!isStr(p.rule)) warn(`CONFUSIONS "${p.id}": missing rule`);
      if (!Array.isArray(p.items) || !p.items.length) { err(`CONFUSIONS "${p.id}": no items`); return; }
      p.items.forEach((it, j) => {
        if (!isStr(it?.q) || !it.q.includes("___")) err(`CONFUSIONS "${p.id}" item ${j}: q missing or has no ___ gap`);
        if (it?.correct !== "a" && it?.correct !== "b") err(`CONFUSIONS "${p.id}" item ${j}: correct must be "a" or "b"`);
        if (!isStr(it?.answer)) err(`CONFUSIONS "${p.id}" item ${j}: missing answer (surface form)`);
        if (!isStr(it?.en)) warn(`CONFUSIONS "${p.id}" item ${j}: missing en`);
        if (!isStr(it?.why)) warn(`CONFUSIONS "${p.id}" item ${j}: missing why`);
      });
    });
  }

  // ── Exam-format sets (exam mode) ──
  if (EXAM) {
    if (!Array.isArray(EXAM)) err("EXAM is not an array");
    const seenE = new Set();
    const FORMATS = ["leseverstehen", "sprachbausteine"];
    (EXAM || []).forEach((s, i) => {
      if (!s) { err(`EXAM[${i}] is a hole`); return; }
      if (!isStr(s.id)) err(`EXAM[${i}]: missing id`);
      if (seenE.has(s.id)) err(`EXAM: duplicate id "${s.id}"`);
      seenE.add(s.id);
      if (s.level && !LEVELS.includes(s.level)) err(`EXAM "${s.id}": bad level "${s.level}"`);
      if (!FORMATS.includes(s.format)) err(`EXAM "${s.id}": format "${s.format}" not in ${FORMATS.join("|")}`);
      if (!isStr(s.title)) warn(`EXAM "${s.id}": missing title`);
      if (!isStr(s.passage)) err(`EXAM "${s.id}": missing passage`);
      if (!Array.isArray(s.questions) || !s.questions.length) { err(`EXAM "${s.id}": no questions`); return; }
      // sprachbausteine gaps are numbered (1)…(n) in the passage; check each gap is referenced.
      if (s.format === "sprachbausteine" && isStr(s.passage)) {
        const gaps = (s.passage.match(/\(\d+\)/g) || []).length;
        if (gaps !== s.questions.length) warn(`EXAM "${s.id}": ${gaps} gap(s) in passage but ${s.questions.length} question(s)`);
      }
      s.questions.forEach((q, j) => {
        if (!isStr(q?.q) || !Array.isArray(q?.opts) || q.opts.length < 2) err(`EXAM "${s.id}" question ${j}: malformed`);
        else if (!(q.correctIdx >= 0 && q.correctIdx < q.opts.length)) err(`EXAM "${s.id}" question ${j}: correctIdx out of range`);
      });
    });
  }

  // ── Placement test (P5 onboarding) ──
  if (PLACEMENT) {
    if (typeof PLACEMENT !== "object" || Array.isArray(PLACEMENT)) err("PLACEMENT must be an object { intake, items }");
    (PLACEMENT.intake || []).forEach((q, i) => {
      if (!isStr(q?.id)) err(`PLACEMENT.intake[${i}]: missing id`);
      if (!isStr(q?.q)) err(`PLACEMENT.intake[${i}]: missing q`);
      if (!Array.isArray(q?.opts) || q.opts.length < 2) err(`PLACEMENT.intake[${i}] "${q?.id}": needs ≥2 opts`);
    });
    if (!Array.isArray(PLACEMENT?.items) || !PLACEMENT.items.length) err("PLACEMENT.items missing or empty");
    const seenP = new Set();
    const byLevel = {};
    (PLACEMENT?.items || []).forEach((it, i) => {
      if (!isStr(it?.id)) err(`PLACEMENT.items[${i}]: missing id`);
      if (seenP.has(it.id)) err(`PLACEMENT.items: duplicate id "${it.id}"`);
      seenP.add(it.id);
      if (!LEVELS.includes(it?.level)) err(`PLACEMENT.items "${it?.id}": bad/missing level "${it?.level}"`);
      else byLevel[it.level] = (byLevel[it.level] || 0) + 1;
      if (!isStr(it?.q)) err(`PLACEMENT.items "${it?.id}": missing q`);
      if (!Array.isArray(it?.opts) || it.opts.length < 2) err(`PLACEMENT.items "${it?.id}": needs ≥2 opts`);
      else if (!(it.correctIdx >= 0 && it.correctIdx < it.opts.length)) err(`PLACEMENT.items "${it?.id}": correctIdx out of range`);
    });
    LEVELS.forEach(L => { if ((byLevel[L] || 0) < 3) warn(`PLACEMENT: only ${byLevel[L] || 0} item(s) at ${L} — recommend ≥3 for a reliable estimate`); });
  }

  const counts = {
    vocab: Object.values(V || {}).reduce((n, l) => n + (Array.isArray(l) ? l.length : 0), 0),
    categories: Object.keys(V || {}).length,
    cloze: (CLOZE || []).length,
    verbs: (VERBS || []).length,
    sentences: (SENTENCES || []).length,
    dialogues: (DIALOGUES || []).length,
    imperatives: (IMPERATIVES || []).length,
    missions: (MISSIONS || []).length,
    confusions: (CONFUSIONS || []).length,
    exam: (EXAM || []).length,
    placement: ((PLACEMENT && PLACEMENT.items) || []).length,
  };
  return { errors, warnings, counts };
}

// CLI entry: `node scripts/validate-data.mjs`
if (import.meta.url === `file://${process.argv[1]}`) {
  const data = await loadData();
  const { errors, warnings, counts } = validateData(data);
  console.log(`Content: ${counts.vocab} vocab in ${counts.categories} categories · ${counts.cloze} cloze · ${counts.verbs} verbs · ${counts.sentences} sentences · ${counts.dialogues} dialogues · ${counts.imperatives} imperatives · ${counts.missions} missions · ${counts.confusions} confusion-pairs · ${counts.exam} exam-sets · ${counts.placement} placement-items`);
  warnings.forEach(w => console.warn(`  warn: ${w}`));
  if (errors.length) {
    errors.forEach(e => console.error(`  ERROR: ${e}`));
    console.error(`${errors.length} error(s).`);
    process.exit(1);
  }
  console.log(`OK — no errors${warnings.length ? `, ${warnings.length} warning(s)` : ""}.`);
}
