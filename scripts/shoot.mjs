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
const ALL = ["home", "library", "stats", "browse", "tutor", "drill", "recall", "setup", "settings"];
const screens = argv.length ? (argv.includes("all") ? ALL : argv) : ["home"];
// SHOOT_PERSONA = first | daily (default) | advanced. The "onboarding" screen ignores it.
const PERSONA = process.env.SHOOT_PERSONA || "daily";

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

// Deterministic learner state per persona, so screens render as a real user would see
// them. "onboarding" leaves storage fresh (modal shows); "first" is onboarded but has no
// data (empty states); "daily"/"advanced" scale up streak, goal progress and mastery.
function seedState({ persona, mode, near, streakReady, freezeMiss, mastery }) {
  localStorage.clear();
  if (persona === "onboarding") return;
  localStorage.setItem("ad-onboarding-v1", "done");
  if (mastery) {
    // One real card, one step from mastery and due → it's the session's first card; the
    // driver types its known answer to cross the 5th production streak.
    const D = 86400000;
    localStorage.setItem("gfc-goal-v7", "20");
    localStorage.setItem("gfc-daily-v7", JSON.stringify({ date: new Date().toISOString().slice(0, 10), count: 12, streak: 6 }));
    localStorage.setItem("gfc-freezes-v1", "2");
    localStorage.setItem("gfc-v7", JSON.stringify({
      "production::Travel & Directions::der Bahnhof": { stats: { attempts: 4, correct: 4, incorrect: 0, lastSeen: Date.now() - 25 * D, avgTime: 5000, timedAttempts: 4, currentStreak: 4, productionStreak: 4, masteredAt: null }, srs: { box: 3, lastReviewed: Date.now() - 25 * D } },
    }));
    return;
  }
  if (mode) localStorage.setItem("ad-mode-v1", mode); // SHOOT_MODE: verify the dynamic hero
  // Expand all Library groups so every category icon is visible for audits.
  localStorage.setItem("ad-lib-groups-v1", JSON.stringify({ "Everyday Life": true, "Out & About": true, "Work & Engineering": true, "Life Admin": true, "Language & Society": true, "More": true }));
  if (persona === "first") return;
  const adv = persona === "advanced";
  const z = n => String(n).padStart(2, "0");
  const key = (d = new Date()) => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
  const DAY = 86400000, today = key();
  localStorage.setItem("gfc-goal-v7", "20");
  // `near` = one card short of the goal, to reach the goal-crossing celebration.
  localStorage.setItem("gfc-daily-v7", JSON.stringify({ date: today, count: near ? 19 : (adv ? 23 : 12), streak: adv ? 48 : 6 }));
  // `streakReady` = active yesterday at streak 6, none today → first card today hits the 7-day milestone.
  if (streakReady) localStorage.setItem("gfc-daily-v7", JSON.stringify({ date: key(new Date(Date.now() - DAY)), count: 8, streak: 6 }));
  localStorage.setItem("gfc-freezes-v1", "2"); // banked Streak Freezes (shown on home)
  // `freezeMiss` = last active 2 days ago (missed yesterday) with 1 freeze → freeze absorbs the gap on load.
  if (freezeMiss) { localStorage.setItem("gfc-daily-v7", JSON.stringify({ date: key(new Date(Date.now() - 2 * DAY)), count: 8, streak: 6 })); localStorage.setItem("gfc-freezes-v1", "1"); }
  const trend = {};
  for (let i = 29; i >= 0; i--) {
    const k = key(new Date(Date.now() - i * DAY));
    const a = (adv ? 22 : 8) + ((i * 7) % 16);
    trend[k] = { attempts: a, correct: Math.round(a * ((adv ? 0.82 : 0.65) + (i % 5) * 0.04)), totalMs: a * (adv ? 5200 : 6400), timed: a };
  }
  localStorage.setItem("gfc-stats-v7", JSON.stringify(trend));
  const prog = {};
  const mk = (box, correct, incorrect, pstreak, masteredAt) => ({
    stats: { attempts: correct + incorrect, correct, incorrect, lastSeen: Date.now() - 2 * DAY, avgTime: adv ? 4800 : 7200, timedAttempts: correct, currentStreak: pstreak, productionStreak: pstreak, masteredAt },
    srs: { box, lastReviewed: Date.now() - (box >= 3 ? 20 : 1) * DAY },
  });
  const cats = ["Greetings & Basics", "Work & Study", "Electrical Engineering", "Travel & Directions"];
  const per = adv ? 18 : 8;
  cats.forEach((c, ci) => {
    for (let i = 0; i < per; i++) {
      const box = (ci + i) % 6, mastered = adv ? (ci + i) % 2 === 0 : (ci + i) % 4 === 0;
      prog[`production::${c}::seed${ci}_${i}`] = mk(box, 5 + i, i % 3, mastered ? 5 : i % 5, mastered ? Date.now() - (i % 24) * DAY : null);
      prog[`vocab::${c}::seed${ci}_${i}`] = mk(box, 4 + i, 1, 0, null);
    }
  });
  // Real card keys (these `de` values exist in data.js) so the home review queue
  // (Due / Weak) actually resolves and renders.
  const real = {
    "Greetings & Basics": ["Hallo", "Tschüss", "Danke", "Entschuldigung", "Guten Morgen"],
    "Work & Study": ["die Arbeit", "das Büro", "der Termin", "die Prüfung"],
    "Electrical Engineering": ["der Widerstand", "die Spannung", "der Kondensator"],
    "Travel & Directions": ["die Straße", "der Bahnhof", "das Auto"],
  };
  let ri = 0;
  Object.entries(real).forEach(([c, des]) => des.forEach(de => {
    ri++;
    prog[`production::${c}::${de}`] = ri % 4 === 0
      ? mk(1, 2, 5, 0, null) // weak: incorrect 5, box 1
      : { stats: { attempts: 6, correct: 5, incorrect: 1, lastSeen: Date.now() - 25 * DAY, avgTime: 6000, timedAttempts: 5, currentStreak: 2, productionStreak: 2, masteredAt: null }, srs: { box: 3, lastReviewed: Date.now() - 25 * DAY } }; // due (box 3, interval 7d, 25d ago)
  }));
  localStorage.setItem("gfc-v7", JSON.stringify(prog));
}

async function clickText(page, txt) {
  const ok = await page.evaluate((t) => {
    const lc = t.toLowerCase();
    const el = [...document.querySelectorAll("button,[role=button]")]
      .find(e => (e.textContent || "").trim().toLowerCase().includes(lc)
        || (e.getAttribute("aria-label") || "").trim().toLowerCase() === lc);
    if (el) { el.click(); return true; }
    return false;
  }, txt);
  if (!ok) throw new Error(`no clickable matching "${txt}"`);
  await new Promise(r => setTimeout(r, 650));
}

async function gotoScreen(page, screen) {
  if (screen === "home" || screen === "onboarding" || screen === "freezeused") return;
  if (["library", "stats", "tutor"].includes(screen)) return clickText(page, screen);
  if (screen === "browse") { await clickText(page, "Library"); return clickText(page, "Browse"); }
  if (screen === "drill") return clickText(page, "Production practice");
  if (screen === "setup") return clickText(page, "Custom session");
  if (screen === "settings") return clickText(page, "Settings");
  if (screen === "audioscreen") { await clickText(page, "Audio"); await clickText(page, "Audio review"); await new Promise(r => setTimeout(r, 700)); return; }
  if (screen === "mastery") {
    // First card is the seeded near-mastery card (der Bahnhof). Type its correct answer.
    await clickText(page, "Production practice");
    await new Promise(r => setTimeout(r, 250));
    await page.evaluate(() => { const i = document.querySelector('input[lang="de"]'); if (i) { i.focus(); const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set; set.call(i, "der Bahnhof"); i.dispatchEvent(new Event("input", { bubbles: true })); } });
    await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.getAttribute("aria-label") === "Submit answer")?.click());
    await new Promise(r => setTimeout(r, 550));
    return;
  }
  if (screen === "goal" || screen === "streak") {
    // goal: seeded one short of the goal. streak: first card today hits a milestone.
    await clickText(page, "Production practice");
    await page.evaluate(() => {
      const i = document.querySelector('input[lang="de"]');
      if (i) { i.focus(); const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set; set.call(i, "x"); i.dispatchEvent(new Event("input", { bubbles: true })); }
    });
    await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.getAttribute("aria-label") === "Submit answer")?.click());
    await new Promise(r => setTimeout(r, 600)); // celebration is mid-animation
  }
  if (screen === "answered") {
    // Production session → submit a wrong answer so the answered-state feedback
    // (reveal, stats, hint, example, auto-advance-off) is visible and stable.
    await clickText(page, "Production practice");
    // Use React's native value setter so the controlled input's onChange actually fires.
    await page.evaluate(() => {
      const i = document.querySelector('input[lang="de"]');
      if (i) { i.focus(); const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set; set.call(i, "betrug"); i.dispatchEvent(new Event("input", { bubbles: true })); }
    });
    await new Promise(r => setTimeout(r, 200));
    await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.getAttribute("aria-label") === "Submit answer")?.click());
    await new Promise(r => setTimeout(r, 700));
  }
  if (screen === "recall") {
    // Custom session → Recall (DE→EN flip) → Start, then reveal the first card so the
    // swipe chips + verdict stamps are visible.
    await clickText(page, "Custom session");
    await clickText(page, "Recall");
    await clickText(page, "Start session");
    await page.evaluate(() => document.querySelector('[aria-label="Reveal answer"]')?.click());
    await new Promise(r => setTimeout(r, 700));
  }
  if (screen === "results") {
    // Drive a short production session to completion (all wrong) to reach the results screen.
    await clickText(page, "Custom session");
    await page.evaluate(() => [...document.querySelectorAll("button")].find(b => (b.textContent || "").trim() === "5")?.click()); // 5 cards
    await new Promise(r => setTimeout(r, 150));
    await clickText(page, "Start session");
    const nativeType = (val) => page.evaluate((v) => {
      const i = document.querySelector('input[lang="de"]');
      if (!i) return false;
      i.focus(); const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set; set.call(i, v); i.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    }, val);
    for (let k = 0; k < 24; k++) {
      const done = await page.evaluate(() => /Repeat \d|Keep going|Session complete|Weiter|Back to home/i.test(document.body.innerText) && !document.querySelector('input[lang="de"]'));
      if (done) break;
      if (await nativeType("x")) {
        await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.getAttribute("aria-label") === "Submit answer")?.click());
        await new Promise(r => setTimeout(r, 220));
      }
      await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /^(Next|Results)/.test((b.textContent || "").trim()))?.click());
      await new Promise(r => setTimeout(r, 220));
    }
    await new Promise(r => setTimeout(r, 500));
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
      await page.evaluateOnNewDocument(seedState, { persona: screen === "onboarding" ? "onboarding" : PERSONA, mode: process.env.SHOOT_MODE || "", near: screen === "goal", streakReady: screen === "streak", freezeMiss: screen === "freezeused", mastery: screen === "mastery" });
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
