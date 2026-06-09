import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import vm from "node:vm";

const BABEL_URL = "https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.9/babel.min.js";
const INDEX_FILE = "index.html";
const SOURCE_FILE = "src/app.jsx";
const OUTPUT_FILE = "app.js";

const index = await readFile(INDEX_FILE, "utf8");
let source;

const inlineAppRe = /\s*<script type="text\/babel">\r?\n([\s\S]*?)\r?\n\s*<\/script>/;
const builtAppRe = /\r?\n\s*<script src="app\.js" integrity="sha512-[^"]+"><\/script>/;

try {
  source = await readFile(SOURCE_FILE, "utf8");
} catch {
  const match = index.match(inlineAppRe);
  if (!match) throw new Error("Could not find inline Babel app source in index.html");
  source = match[1];
  await mkdir("src", { recursive: true });
  await writeFile(SOURCE_FILE, source, "utf8");
}

// Babel: prefer the pinned local copy (npm install) so builds work offline;
// fall back to the CDN only if node_modules is absent.
let Babel;
try {
  const require = createRequire(import.meta.url);
  Babel = require("@babel/standalone");
  console.log("Using local @babel/standalone");
} catch {
  console.log("Local @babel/standalone not found, fetching from CDN…");
  const babelResponse = await fetch(BABEL_URL);
  if (!babelResponse.ok) throw new Error(`Could not download Babel: ${babelResponse.status}`);
  const babelCode = await babelResponse.text();
  const context = { console };
  context.window = context;
  context.self = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(babelCode, context);
  Babel = context.Babel;
}

const output = Babel.transform(source, {
  presets: ["react"],
  comments: false,
  compact: false,
}).code + "\n";

await writeFile(OUTPUT_FILE, output, "utf8");

const appHash = createHash("sha512").update(output).digest("base64");
const appScript = `\n  <script src="app.js" integrity="sha512-${appHash}"></script>`;
const withoutBabelCdn = index.replace(/\r?\n\s*<script[^>]+babel-standalone\/7\.23\.9\/babel\.min\.js[^>]*><\/script>/, "");
let nextIndex = withoutBabelCdn;
if (inlineAppRe.test(nextIndex)) {
  nextIndex = nextIndex.replace(inlineAppRe, appScript);
} else if (builtAppRe.test(nextIndex)) {
  nextIndex = nextIndex.replace(builtAppRe, appScript);
} else {
  throw new Error("Could not find app script tag in index.html");
}

await writeFile(INDEX_FILE, nextIndex, "utf8");

console.log(`Wrote ${OUTPUT_FILE}`);
console.log("Updated index.html to load precompiled app.js");
