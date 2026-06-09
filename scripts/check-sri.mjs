// Verifies the shipped artifacts are in lockstep: the SRI hashes in index.html must
// match the actual bytes of app.js and data.js, or the browser will refuse to load
// them. Run standalone (`npm run check-sri`) or in CI.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const root = new URL("..", import.meta.url);
const index = await readFile(new URL("index.html", root), "utf8");
let failed = false;

for (const file of ["app.js", "data.js"]) {
  const body = await readFile(new URL(file, root));
  const actual = "sha512-" + createHash("sha512").update(body).digest("base64");
  const m = index.match(new RegExp(`<script src="${file}" integrity="(sha512-[^"]+)"`));
  if (!m) { console.error(`FAIL: no SRI script tag for ${file} in index.html`); failed = true; continue; }
  if (m[1] !== actual) {
    console.error(`FAIL: ${file} SRI mismatch\n  index.html: ${m[1]}\n  actual:     ${actual}\n  (run \`npm run build\` and commit the result)`);
    failed = true;
  } else {
    console.log(`OK: ${file} matches its SRI hash`);
  }
}
process.exit(failed ? 1 : 0);
