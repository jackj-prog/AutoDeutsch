// Screenshot / visual-audit harness for AutoDeutsch.
//
// Why this exists: the dev environment's network policy blocks cdnjs and Google
// Fonts, so a headless browser can't load the app's CDN React. This harness renders
// the REAL built bundle (data.js + app.js) but swaps the two CDN <script> tags for
// React UMD copies vendored from npm. It never touches the shipped index.html.
// Chromium is the npm-delivered @sparticuz/chromium binary driven by puppeteer-core,
// because Playwright's browser CDN is blocked here too.
//
// One-time setup (deps are intentionally NOT in package.json, to keep CI lean):
//   npm i -D puppeteer-core @sparticuz/chromium react@18.2.0 react-dom@18.2.0
//
// Usage:  npm run build && node scripts/shoot.mjs [screen ...]
//   screens: home (default) | library | stats | browse | tutor | drill | all
// Output:  screenshots/<screen>.png   (390x844 @2x, mobile)
import { readFile, writeFile, mkdir, rm, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "screenshots");
const HARNESS = path.join(ROOT, ".shoot-harness.html");

// Optional deps via dynamic import, with a helpful message if missing.
let chromium, puppeteer;
try {
  chromium = (await import("@sparticuz/chromium")).default;
  puppeteer = (await import("puppeteer-core")).default;
  await access(path.join(ROOT, "node_modules/react/umd/react.production.min.js"));
  await access(path.join(ROOT, "node_modules/react-dom/umd/react-dom.production.min.js"));
} catch {
  console.error("Visual-audit deps missing. Install them once with:\n  npm i -D puppeteer-core @sparticuz/chromium react@18.2.0 react-dom@18.2.0");
  process.exit(1);
}

const argv = process.argv.slice(2);
const ALL = ["home", "library", "stats", "browse", "tutor", "drill", "recall"];
const screens = argv.length ? (argv.includes("all") ? ALL : argv) : ["home"];

// Harness HTML: reuse the shipped <head> (its styles), drop SW + self-heal, point the
// two React tags at local UMD builds, load data.js/app.js as-is (same origin, file://).
async function buildHarness() {
  const index = await readFile(path.join(ROOT, "index.html"), "utf8");
  const head = index.slice(0, index.indexOf("</head>") + 7);
  await writeFile(HARNESS, `${head}
<body>
  <div id="root"></div>
  <script src="./node_modules/react/umd/react.production.min.js"></script>
  <script src="./node_modules/react-dom/umd/react-dom.production.min.js"></script>
  <script src="./data.js"></script>
  <script src="./app.js"></script>
</body></html>`, "utf8");
}

// Deterministic learner so panels render with content, not empty states.
function seedState() {
  const z = n => String(n).padStart(2, "0");
  const key = (d = new Date()) => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
  const DAY = 86400000, today = key();
  localStorage.setItem("ad-onboarding-v1", "done");
  localStorage.setItem("gfc-goal-v7", "20");
  localStorage.setItem("gfc-daily-v7", JSON.stringify({ date: today, count: 12, streak: 6 }));
  const trend = {};
  for (let i = 13; i >= 0; i--) {
    const k = key(new Date(Date.now() - i * DAY));
    const a = 8 + ((i * 7) % 18);
    trend[k] = { attempts: a, correct: Math.round(a * (0.65 + (i % 5) * 0.06)), totalMs: a * 6400, timed: a };
  }
  localStorage.setItem("gfc-stats-v7", JSON.stringify(trend));
  const prog = {};
  const mk = (box, correct, incorrect, pstreak, masteredAt) => ({
    stats: { attempts: correct + incorrect, correct, incorrect, lastSeen: Date.now() - 2 * DAY, avgTime: 7200, timedAttempts: correct, currentStreak: pstreak, productionStreak: pstreak, masteredAt },
    srs: { box, lastReviewed: Date.now() - (box >= 3 ? 20 : 1) * DAY },
  });
  ["Greetings & Basics", "Work & Study", "Electrical Engineering", "Travel & Directions"].forEach((c, ci) => {
    for (let i = 0; i < 8; i++) {
      const box = (ci + i) % 6, mastered = (ci + i) % 4 === 0;
      prog[`production::${c}::seed${ci}_${i}`] = mk(box, 5 + i, i % 3, mastered ? 5 : i % 5, mastered ? Date.now() - (i % 20) * DAY : null);
      prog[`vocab::${c}::seed${ci}_${i}`] = mk(box, 4 + i, 1, 0, null);
    }
  });
  localStorage.setItem("gfc-v7", JSON.stringify(prog));
}

async function clickText(page, txt) {
  const ok = await page.evaluate((t) => {
    const el = [...document.querySelectorAll("button,[role=button]")]
      .find(e => (e.textContent || "").trim().toLowerCase().includes(t.toLowerCase()));
    if (el) { el.click(); return true; }
    return false;
  }, txt);
  if (!ok) throw new Error(`no clickable matching "${txt}"`);
  await new Promise(r => setTimeout(r, 650));
}

async function gotoScreen(page, screen) {
  if (screen === "home") return;
  if (["library", "stats", "tutor"].includes(screen)) return clickText(page, screen);
  if (screen === "browse") { await clickText(page, "Library"); return clickText(page, "Browse"); }
  if (screen === "drill") return clickText(page, "Production practice");
  if (screen === "recall") {
    // Custom session → Recall (DE→EN flip) → Start, then reveal the first card so the
    // swipe chips + verdict stamps are visible.
    await clickText(page, "Custom session");
    await clickText(page, "Recall");
    await clickText(page, "Start session");
    await page.evaluate(() => document.querySelector('[aria-label="Reveal answer"]')?.click());
    await new Promise(r => setTimeout(r, 700));
  }
}

async function run() {
  await buildHarness();
  await mkdir(OUT, { recursive: true });
  const browser = await puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: "shell" });
  try {
    for (const screen of screens) {
      const page = await browser.newPage();
      await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      await page.evaluateOnNewDocument(seedState);
      await page.goto("file://" + HARNESS, { waitUntil: "load" });
      await page.waitForFunction(() => document.getElementById("root")?.childElementCount > 0, { timeout: 15000 });
      await new Promise(r => setTimeout(r, 500));
      try { await gotoScreen(page, screen); } catch (e) { console.warn(`  (${screen}: ${e.message})`); }
      const file = path.join(OUT, `${screen}.png`);
      // SHOOT_FULL=0 captures just the viewport (shows fixed elements — e.g. bottom nav —
      // in their real pinned position, which fullPage screenshots misplace).
      await page.screenshot({ path: file, fullPage: process.env.SHOOT_FULL !== "0" });
      console.log("shot:", path.relative(ROOT, file));
      await page.close();
    }
  } finally {
    await browser.close();
    await rm(HARNESS, { force: true });
  }
}

run().catch(e => { console.error(e); process.exit(1); });
