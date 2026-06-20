// Helper (run: node scripts/mission-vocab.mjs) — proposes a relevance-guaranteed vocab list per
// mission by finding the V cards whose headword actually appears in that mission's dialogue + question
// text. Output is a starting point for the curated `vocab` field on each mission (words the learner
// studies in the "Learn the words" step, so the syllabus matches the scene + its questions exactly).
import { loadData } from "./validate-data.mjs";

const { V, DIALOGUES, MISSIONS } = await loadData();
const dlgByTitle = new Map((DIALOGUES || []).map(d => [d.title, d]));

// de-headword (strip a leading article) → its full `de` key, across all categories.
const headToDe = new Map();
for (const list of Object.values(V)) for (const w of list) {
  const head = (w.de || "").replace(/^(der|die|das) /, "").toLowerCase();
  if (head.length >= 3 && !headToDe.has(head)) headToDe.set(head, w.de);
}
const heads = [...headToDe.keys()].sort((a, b) => b.length - a.length); // longest first

function missionText(m) {
  const parts = [];
  for (const t of (m.dialogues || [])) {
    const d = dlgByTitle.get(t); if (!d) continue;
    for (const l of d.lines || []) parts.push(l.de || "");
    for (const q of d.questions || []) { parts.push(q.q || ""); (q.opts || []).forEach(o => parts.push(o)); }
  }
  return " " + parts.join(" ").toLowerCase() + " ";
}

let total = 0;
for (const m of MISSIONS) {
  const text = missionText(m);
  const found = [];
  for (const head of heads) {
    // whole-word-ish match: the headword bounded by non-letters (catches base nouns/verbs in the scene)
    const re = new RegExp(`[^a-zäöüß]${head.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^a-zäöüß]`);
    if (re.test(text)) found.push(headToDe.get(head));
  }
  const uniq = [...new Set(found)];
  total += uniq.length;
  const flag = uniq.length < 4 ? "  ⚠ thin — hand-curate" : "";
  console.log(`${m.id.padEnd(16)} ${m.level}  (${uniq.length})${flag}`);
  console.log(`  ${JSON.stringify(uniq)}`);
}
console.log(`\nMissions: ${MISSIONS.length} · total candidate refs: ${total} · avg ${(total / MISSIONS.length).toFixed(1)}/mission`);
