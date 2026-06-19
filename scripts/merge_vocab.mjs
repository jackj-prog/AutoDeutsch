// Merge an authored vocab batch into src/data.js.
// Usage: node scripts/merge_vocab.mjs scripts/vocab_batches/batchN.json
// Batch shape: { "Category Name": [ {de,en,pl?,ex,exEn,diff,level,hint?}, ... ], ... }
// Each card is inserted (compact, one per line) just before its category array's closing ].
import { readFileSync, writeFileSync } from "node:fs";

const batchPath = process.argv[2];
if (!batchPath) { console.error("usage: node scripts/merge_vocab.mjs <batch.json>"); process.exit(1); }
const batch = JSON.parse(readFileSync(batchPath, "utf8"));
let lines = readFileSync("src/data.js", "utf8").split("\n");

const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
const ser = (c) => {
  const p = [`de:"${esc(c.de)}"`, `en:"${esc(c.en)}"`];
  if (c.pl) p.push(`pl:"${esc(c.pl)}"`);
  p.push(`ex:"${esc(c.ex)}"`, `exEn:"${esc(c.exEn)}"`, `diff:"${c.diff}"`, `level:"${c.level}"`);
  if (c.hint) p.push(`hint:"${esc(c.hint)}"`);
  return "    {" + p.join(",") + "},";
};

let added = 0;
for (const [cat, cards] of Object.entries(batch)) {
  if (!cards || !cards.length) continue;
  const reCat = cat.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const openRe = new RegExp('^\\s*"' + reCat + '"\\s*:\\s*\\[');
  const oi = lines.findIndex((l) => openRe.test(l));
  if (oi < 0) { console.error("CATEGORY NOT FOUND:", cat); process.exit(1); }
  let ci = -1;
  for (let i = oi + 1; i < lines.length; i++) { if (/^\s{2}\],?\s*$/.test(lines[i])) { ci = i; break; } }
  if (ci < 0) { console.error("CLOSING ] NOT FOUND for:", cat); process.exit(1); }
  lines.splice(ci, 0, ...cards.map(ser));
  added += cards.length;
  console.log(`  ${cat}: +${cards.length}`);
}
writeFileSync("src/data.js", lines.join("\n"));
console.log("merged", added, "cards into src/data.js");
