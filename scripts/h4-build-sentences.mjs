// H4 — build-sentence depth for early missions. Brings A2/early missions from 1 → 3 buildable
// sentences (the "Build the sentence" bonus step). Idempotent: skips a sentence already present
// (matched by mission + en). Run: node scripts/h4-build-sentences.mjs  (then validate + build).
import { readFileSync, writeFileSync } from "fs";

const ADD = [
  // post (A2)
  { mission: "post", level: "A2", en: "Do you have a letter for me?", rule: "yes/no question, verb first", correct: ["Haben", "Sie", "einen", "Brief", "für", "mich"] },
  { mission: "post", level: "A2", en: "How much is the postage?", rule: "wie viel + verb", correct: ["Wie", "viel", "kostet", "das", "Porto"] },
  // landlord (A2)
  { mission: "landlord", level: "A2", en: "The lift is broken.", rule: "sein + adjective", correct: ["Der", "Aufzug", "ist", "kaputt"] },
  { mission: "landlord", level: "A2", en: "Can you please repair that?", rule: "modal verb question", correct: ["Können", "Sie", "das", "bitte", "reparieren"] },
  // workhours (A2)
  { mission: "workhours", level: "A2", en: "I work from nine to five.", rule: "von … bis", correct: ["Ich", "arbeite", "von", "neun", "bis", "fünf"] },
  { mission: "workhours", level: "A2", en: "When do I finish work?", rule: "W-question, verb 2nd", correct: ["Wann", "habe", "ich", "Feierabend"] },
  // sim (B1, early money mission)
  { mission: "sim", level: "B1", en: "How long does the contract run?", rule: "W-question, verb 2nd", correct: ["Wie", "lange", "läuft", "der", "Vertrag"] },
  { mission: "sim", level: "B1", en: "I'd like a prepaid plan.", rule: "möchte + accusative", correct: ["Ich", "möchte", "einen", "Prepaid-Tarif"] },
];

const FILE = "src/data.js";
let src = readFileSync(FILE, "utf8");
const anchor = "const SENTENCES = [\n";
const at = src.indexOf(anchor);
if (at < 0) throw new Error("SENTENCES anchor not found");
let added = 0, skipped = 0;
for (const s of ADD) {
  const enKey = `en:${JSON.stringify(s.en)}`;
  // crude idempotency: skip if this exact en + mission already appear together nearby
  if (src.includes(enKey) && src.includes(`mission:${JSON.stringify(s.mission)}`)) {
    // confirm they co-occur in one object by checking the en string isn't already tagged to this mission
    const re = new RegExp(`\\{[^}]*${s.en.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^}]*mission:"${s.mission}"`, "s");
    if (re.test(src)) { skipped++; continue; }
  }
  const obj = `  {correct:[${s.correct.map(w => JSON.stringify(w)).join(",")}], en:${JSON.stringify(s.en)}, rule:${JSON.stringify(s.rule)}, level:${JSON.stringify(s.level)}, mission:${JSON.stringify(s.mission)}},\n`;
  src = src.slice(0, at + anchor.length) + obj + src.slice(at + anchor.length);
  added++;
}
writeFileSync(FILE, src);
console.log(`added ${added} sentences, skipped ${skipped}`);
