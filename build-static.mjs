import { createHash } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import vm from "node:vm";
import { loadData, validateData } from "./scripts/validate-data.mjs";

const BABEL_URL = "https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.9/babel.min.js";
const INDEX_FILE = "index.html";
const SOURCE_FILE = "src/app.jsx";
const DATA_SOURCE = "src/data.js";
const OUTPUT_FILE = "app.js";
const DATA_OUTPUT = "data.js";

// ── 1. Validate content before anything ships ──
const data = await loadData();
const { errors, warnings, counts } = validateData(data);
warnings.forEach(w => console.warn(`  warn: ${w}`));
if (errors.length) {
  errors.forEach(e => console.error(`  ERROR: ${e}`));
  throw new Error(`Content validation failed with ${errors.length} error(s) — not building.`);
}
console.log(`Content OK: ${counts.vocab} vocab · ${counts.cloze} cloze · ${counts.verbs} verbs · ${counts.sentences} sentences · ${counts.dialogues} dialogues · ${counts.imperatives} imperatives`);

// ── 2. Babel: prefer the pinned local copy (offline builds); fall back to CDN ──
let Babel;
try {
  const require = createRequire(import.meta.url);
  Babel = require("@babel/standalone");
  console.log("Using local @babel/standalone");
} catch {
  console.log("Local @babel/standalone not found, fetching from CDN…");
  const res = await fetch(BABEL_URL);
  if (!res.ok) throw new Error(`Could not download Babel: ${res.status}`);
  const ctx = { console };
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(await res.text(), ctx);
  Babel = ctx.Babel;
}

// ── 3. Compile the engine (compact output ≈ one third smaller, names intact) ──
// Multi-file support (for splitting the monolith into per-owner modules): any *.js/*.jsx in
// src/lib, then src/components, then src/screens are concatenated (sorted within each dir)
// BEFORE src/app.jsx into one compilation unit — a single IIFE scope, so files share globals
// exactly as the one-file version did (no ES imports needed). Until those dirs exist this is a
// no-op: the compiled output is byte-identical to compiling src/app.jsx alone (Babel strips the
// path-marker comments via comments:false). See docs/MODULARIZATION-PLAN.md.
const SRC_DIRS = ["src/lib", "src/components", "src/screens"];
async function collectSources() {
  const parts = [];
  for (const dir of SRC_DIRS) {
    let files = [];
    try { files = (await readdir(dir)).filter(f => /\.jsx?$/.test(f)).sort(); } catch { /* dir absent → skip */ }
    for (const f of files) parts.push(`/* ${dir}/${f} */\n${await readFile(`${dir}/${f}`, "utf8")}`);
  }
  parts.push(`/* ${SOURCE_FILE} */\n${await readFile(SOURCE_FILE, "utf8")}`);
  return parts.join("\n;\n");
}
const source = await collectSources();
const output = Babel.transform(source, {
  presets: ["react"],
  comments: false,
  compact: true,
}).code + "\n";
await writeFile(OUTPUT_FILE, output, "utf8");

// ── 4. Content ships verbatim (plain JS, no JSX) so it stays readable/diffable ──
const dataJs = await readFile(DATA_SOURCE, "utf8");
await writeFile(DATA_OUTPUT, dataJs, "utf8");

// ── 5. Refresh both SRI hashes in index.html (data.js must load before app.js) ──
const sri = (s) => createHash("sha512").update(s).digest("base64");
const appTag = `  <script src="app.js" integrity="sha512-${sri(output)}"></script>`;
const dataTag = `  <script src="data.js" integrity="sha512-${sri(dataJs)}"></script>`;

let index = await readFile(INDEX_FILE, "utf8");
const appRe = /[ \t]*<script src="app\.js" integrity="sha512-[^"]+"><\/script>/;
const dataRe = /[ \t]*<script src="data\.js" integrity="sha512-[^"]+"><\/script>/;
if (!appRe.test(index)) throw new Error("Could not find the app.js script tag in index.html");
index = dataRe.test(index)
  ? index.replace(dataRe, dataTag).replace(appRe, appTag)
  : index.replace(appRe, `${dataTag}\n${appTag}`);
await writeFile(INDEX_FILE, index, "utf8");

// ── 6. Bump the service-worker cache key so every deploy invalidates the offline cache.
// The SW precaches app.js/data.js/index.html under CACHE_NAME and only re-installs when its
// own bytes change; if the key is stale a returning user keeps the previous bundle forever.
// Deriving it from a hash of the shipped app.js + data.js makes it change iff the content
// does — so "bump CACHE_NAME when deploying" can no longer be forgotten.
const SW_FILE = "service-worker.js";
const buildHash = createHash("sha256").update(output + dataJs + index).digest("hex").slice(0, 12);
const cacheName = `autodeutsch-${buildHash}`;
let sw = await readFile(SW_FILE, "utf8");
const cacheRe = /const CACHE_NAME = '[^']*';/;
if (!cacheRe.test(sw)) throw new Error("Could not find CACHE_NAME in service-worker.js");
const swChanged = !sw.includes(`'${cacheName}'`);
sw = sw.replace(cacheRe, `const CACHE_NAME = '${cacheName}';`);
await writeFile(SW_FILE, sw, "utf8");

console.log(`Wrote ${OUTPUT_FILE} (${(output.length / 1024).toFixed(0)} KB) and ${DATA_OUTPUT} (${(dataJs.length / 1024).toFixed(0)} KB)`);
console.log("Updated index.html SRI hashes");
console.log(`Service-worker cache: ${cacheName}${swChanged ? " (bumped)" : " (unchanged)"}`);
