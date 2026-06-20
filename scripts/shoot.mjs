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
//   journey: scenarios | mission  ·  pending (content-lane datasets): placement | confusion | exam
//   SHOOT_WIDTH=320 for a narrow-phone overflow check.
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
function seedState({ persona, mode, near, streakReady, freezeMiss, mastery, correctFast, eszett, level, training, missionReady, tutorChat, tutorChatEmpty }) {
  localStorage.clear();
  if (persona === "onboarding") return;
  localStorage.setItem("ad-onboarding-v1", "done");
  if (mastery || correctFast || eszett) {
    // One real due card → it's the session's first card; the driver types its known answer.
    // productionStreak 4 (mastery) crosses the 5th streak; 1 otherwise. eszett uses a ß word.
    const ps = mastery ? 4 : 1, D = 86400000;
    const cardKey = eszett ? "production::Travel & Directions::die Straße" : "production::Travel & Directions::der Bahnhof";
    localStorage.setItem("gfc-goal-v7", "20");
    localStorage.setItem("gfc-daily-v7", JSON.stringify({ date: new Date().toISOString().slice(0, 10), count: 12, streak: 6 }));
    localStorage.setItem("gfc-freezes-v1", "2");
    localStorage.setItem("gfc-v7", JSON.stringify({
      [cardKey]: { stats: { attempts: ps, correct: ps, incorrect: 0, lastSeen: Date.now() - 25 * D, avgTime: 5000, timedAttempts: ps, currentStreak: ps, productionStreak: ps, masteredAt: null }, srs: { box: 3, lastReviewed: Date.now() - 25 * D } },
    }));
    return;
  }
  if (mode) localStorage.setItem("ad-mode-v1", mode); // SHOOT_MODE: verify the dynamic hero
  if (level) localStorage.setItem("ad-level-v1", level); // SHOOT_LEVEL: verify level focus
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
      const box = (ci + i) % 6;
      // Practice volume only — these synthetic ids aren't real vocab, so they must NOT claim
      // mastery (that would inflate all-time/journey numbers vs the real per-level counts).
      prog[`production::${c}::seed${ci}_${i}`] = mk(box, 5 + i, i % 3, i % 5, null);
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
      : ri % 2 === 0
      ? mk(5, 9, 0, 6, Date.now() - (ri % 18) * DAY) // mastered: box 5, productionStreak 6, masteredAt set
      : { stats: { attempts: 6, correct: 5, incorrect: 1, lastSeen: Date.now() - 25 * DAY, avgTime: 6000, timedAttempts: 5, currentStreak: 2, productionStreak: 2, masteredAt: null }, srs: { box: 3, lastReviewed: Date.now() - 25 * DAY } }; // due (box 3, interval 7d, 25d ago)
  }));
  if (training) {
    // Varied training coverage so the redesigned Training list shows partial bars, a
    // shifted Focus (plural = weakest), and a completed drill (verb = 100% → green check).
    const seenMk = { stats: { attempts: 3, correct: 3, incorrect: 0, lastSeen: Date.now() - DAY, avgTime: 5000, timedAttempts: 3, currentStreak: 3, productionStreak: 0, masteredAt: null }, srs: { box: 2, lastReviewed: Date.now() - DAY } };
    const addN = (n, fn) => { for (let i = 0; i < n; i++) prog[fn(i)] = seenMk; };
    addN(140, i => `article::cat${i % 5}::an${i}`);
    addN(50, i => `plural::cat${i % 5}::pn${i}`);
    addN(60, i => `verb::__verb__::vstem${i}-ich-present`);
    addN(115, i => `cloze::__grammar__::cz${i}`);
    addN(30, i => `sentence::__sentence__::sn${i}`);
    addN(10, i => `imperativ::__imperativ__::imp${i}::du`);
    addN(44, i => `listening::__listening__::dlg${i}`);
  }
  localStorage.setItem("gfc-v7", JSON.stringify(prog));
  if (tutorChat) {
    // A local-only fake key unlocks the chat UI; a seeded conversation renders the bubbles.
    // No network call is made (the harness never taps Send), so the key is never used.
    localStorage.setItem("gfc-ai-key", "sk-ant-demo-localonly-not-a-real-key");
    // tutorChatEmpty seeds the key but no messages, so the data-driven starter chips show.
    if (!tutorChatEmpty) localStorage.setItem("gfc-tutor-msgs", JSON.stringify([
      { role: "user", text: "Hallo! Ich moechte mein Deutsch ueben." },
      { role: "assistant", text: "Sehr gern! Dein Satz ist korrekt. Erzaehl mir: Was hast du heute gemacht?" },
      { role: "user", text: "Ich habe gestern einen Termin beim Buergeramt gemacht." },
      { role: "assistant", text: "Fast perfekt! Kleiner Hinweis: \"einen Termin vereinbaren\" klingt natuerlicher als \"machen\". Also: \"Ich habe gestern einen Termin beim Buergeramt vereinbart.\" Warum warst du dort?" },
    ]));
  }
  if (missionReady) {
    // Seed the café mission at 2/3 steps (learned + spoke). Crediting the third step
    // ("listened", earned just by opening the scene) completes it → fires the green
    // "Skill unlocked — You can now …" celebration. The extra two pre-done missions push
    // the completion across the 3-mission role threshold (Newcomer → Settling in) so the
    // status toast queues behind it too.
    localStorage.setItem("ad-mission-progress-v1", JSON.stringify({
      directions: { learned: true, listened: true, spoke: true, doneAt: Date.now() - 2 * 86400000 },
      hotel: { learned: true, listened: true, spoke: true, doneAt: Date.now() - 86400000 },
      cafe: { learned: true, spoke: true },
    }));
  }
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
  await new Promise(r => setTimeout(r, process.env.SHOOT_FASTNAV ? +process.env.SHOOT_FASTNAV : 650));
}

async function gotoScreen(page, screen) {
  if (screen === "home" || screen === "onboarding" || screen === "freezeused") return;
  if (screen === "stats") return clickText(page, "Progress"); // the Stats tab is labelled "Progress"
  if (["train", "library", "tutor"].includes(screen)) return clickText(page, screen);
  if (screen === "browse") { await clickText(page, "Library"); return clickText(page, "Browse"); }
  if (screen === "libcat") { await clickText(page, "Library"); await new Promise(r => setTimeout(r, 300)); await clickText(page, "Greetings & Basics"); await new Promise(r => setTimeout(r, 400)); return; }
  if (screen === "resultswin") {
    // Recall session graded all-correct via the "I know it" gesture (→ / ArrowRight on the
    // German front) to reach the flawless results celebration (Perfect! + confetti).
    // "Custom session" opens the __all__ setup; its "Quick" preset (Recall · 10) starts a
    // recall session in one tap. Then drive it all-correct via the keyboard "I know it"
    // gesture — but the swipe card only takes keys when focused (tabIndex lives on the card).
    await clickText(page, "Custom session");
    await clickText(page, "Quick");
    await new Promise(r => setTimeout(r, 500));
    for (let k = 0; k < 30; k++) {
      const done = await page.evaluate(() => /accuracy/i.test(document.body.innerText));
      if (done) break;
      const focused = await page.evaluate(() => { const el = document.querySelector('[aria-label^="Swipe right"]'); if (el) { el.focus(); return true; } return false; });
      if (!focused) break;
      await page.keyboard.press("ArrowRight"); // "I know it" → correct + fly off + next
      await new Promise(r => setTimeout(r, 300));
    }
    await new Promise(r => setTimeout(r, 1500)); // let the accuracy CountUp ring settle
    return;
  }
  if (screen === "drill") return clickText(page, "Production practice");
  if (screen === "speaking") { await clickText(page, "Speaking"); await new Promise(r => setTimeout(r, 250)); await clickText(page, "Speaking practice"); await new Promise(r => setTimeout(r, 500)); return; }
  if (screen === "scenarios") { await clickText(page, "All scenarios →"); await new Promise(r => setTimeout(r, 400)); return; }
  if (screen === "mission") { await clickText(page, "All scenarios →"); await new Promise(r => setTimeout(r, 350)); await clickText(page, "Order at a café or bakery"); await new Promise(r => setTimeout(r, 400)); return; }
  if (screen === "longword" || screen === "longprompt") {
    // Regression guards for long-content clipping. longword: the longest single German compound
    // ("die Kommunikationsmöglichkeit", 29) at the front of a recall session. longprompt: the
    // longest English gloss (65 chars) as a production prompt (card.en is shown big).
    await page.evaluate(() => {
      const D = 86400000, t = Date.now() - 20 * D;
      const mk = () => ({ stats: { attempts: 3, correct: 3, incorrect: 0, lastSeen: t, avgTime: 5000, timedAttempts: 3, currentStreak: 1, productionStreak: 0, masteredAt: null }, srs: { box: 3, lastReviewed: t } });
      localStorage.setItem("ad-onboarding-v1", "done");
      localStorage.setItem("ad-level-v1", "B2"); // so the long B2 words are in-pool, not level-filtered
      localStorage.setItem("gfc-v7", JSON.stringify({
        "vocab::Media & Communication::die Kommunikationsmöglichkeit": mk(),
        "vocab::Opinions & Argument::die Schlussfolgerung": mk(),
        "production::Abstract & Advanced::das Kindesbein": mk(),
      }));
    });
    await page.reload({ waitUntil: "load" });
    await page.waitForFunction(() => document.getElementById("root")?.childElementCount > 0, { timeout: 15000 });
    await new Promise(r => setTimeout(r, 600));
    if (screen === "longprompt") { await clickText(page, "Production practice"); await new Promise(r => setTimeout(r, 600)); return; }
    await clickText(page, "Custom session");
    await clickText(page, "Quick");
    await new Promise(r => setTimeout(r, 700));
    return;
  }
  if (screen === "longcando") {
    // Longest mission can-do (66 chars) on the mission detail screen.
    await clickText(page, "All scenarios →"); await new Promise(r => setTimeout(r, 350));
    await clickText(page, "Read and query your utility-bill"); await new Promise(r => setTimeout(r, 450));
    return;
  }
  if (screen === "missionbuild") { await clickText(page, "All scenarios →"); await new Promise(r => setTimeout(r, 350)); await clickText(page, "Order at a café or bakery"); await new Promise(r => setTimeout(r, 350)); await clickText(page, "Build the sentence"); await new Promise(r => setTimeout(r, 600)); return; }
  if (screen === "missionlearn") { await clickText(page, "All scenarios →"); await new Promise(r => setTimeout(r, 350)); await clickText(page, "Order at a café or bakery"); await new Promise(r => setTimeout(r, 350)); await clickText(page, "Learn the words"); await new Promise(r => setTimeout(r, 600)); return; }
  // Pending app.jsx screens for the content-lane datasets (PLACEMENT / CONFUSIONS / EXAM).
  // These reference the entry labels pinned in docs/P5-placement-buildspec.md +
  // docs/practice-data-spec.md; once the app.jsx owner builds the screens with those labels
  // these paths shoot automatically. Kept out of ALL so `shoot all` is unaffected until then.
  if (screen === "placement") { await clickText(page, "Settings"); await new Promise(r => setTimeout(r, 200)); await clickText(page, "Placement test"); await new Promise(r => setTimeout(r, 400)); return; }
  if (screen === "confusion") { await clickText(page, "Train"); await new Promise(r => setTimeout(r, 200)); await clickText(page, "Confusion pairs"); await clickText(page, "Start session"); await new Promise(r => setTimeout(r, 400)); return; }
  if (screen === "exam") { await clickText(page, "Train"); await new Promise(r => setTimeout(r, 200)); await clickText(page, "Exam practice"); await new Promise(r => setTimeout(r, 400)); return; }
  if (screen === "setup") return clickText(page, "Custom session");
  if (screen === "settings") return clickText(page, "Settings");
  if (screen === "audioscreen") { await clickText(page, "Audio"); await clickText(page, "Audio review"); await new Promise(r => setTimeout(r, 700)); return; }
  if (screen === "konj1") { await clickText(page, "Train"); await clickText(page, "Verb Trainer"); await clickText(page, "Konjunktiv I"); await clickText(page, "Start session"); return; }
  if (screen === "traindrill") {
    // Generic Train-tab drill capture. SHOOT_DRILL = tile label (e.g. "Grammar Cloze").
    await clickText(page, "Train");
    await new Promise(r => setTimeout(r, 300));
    await clickText(page, process.env.SHOOT_DRILL || "Grammar Cloze");
    await new Promise(r => setTimeout(r, 300));
    // For the article/plural drills setupCat is "__all__", which the setup treats as a
    // library category: it shows vocab presets and hides the mode-respecting "Start session"
    // button behind "Advanced options". Reveal it if the direct button isn't present.
    const hasStart = await page.evaluate(() => [...document.querySelectorAll("button,[role=button]")].some(e => /start session/i.test((e.textContent || ""))));
    if (!hasStart) {
      await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /advanced options/i.test(b.textContent || ""))?.click());
      await new Promise(r => setTimeout(r, 350));
    }
    await clickText(page, "Start session");
    await new Promise(r => setTimeout(r, 700));
    if (process.env.SHOOT_REVEAL) {
      // Surrender a typed drill via "I don't know — reveal answer" to verify the revealed
      // state (no dangling "You:" line, correct answer shown, advance enabled).
      await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /reveal answer/i.test(b.textContent || ""))?.click());
      await new Promise(r => setTimeout(r, 600));
      return;
    }
    if (process.env.SHOOT_ANSWER) {
      // Reveal the answered state (grammar note): type into a typed drill, else click the
      // first multiple-choice option.
      const typed = await page.evaluate(() => {
        const i = document.querySelector('input[lang="de"]');
        if (i) { i.focus(); const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set; set.call(i, "x"); i.dispatchEvent(new Event("input", { bubbles: true })); return true; }
        return false;
      });
      if (typed) await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.getAttribute("aria-label") === "Submit answer")?.click());
      else await page.evaluate(() => { const g = document.querySelector('[style*="grid-template-columns"]'); const b = g && g.querySelector("button"); if (b) b.click(); });
      await new Promise(r => setTimeout(r, 600));
      if (process.env.SHOOT_SWIPEADV) {
        // Swipe the answered card horizontally and confirm it advances (requirement A).
        const before = await page.evaluate(() => (document.body.innerText.match(/(\d+)\s*\/\s*\d+/) || [])[1]);
        const box = await page.evaluate(() => { const c = document.querySelector('.ad-elev'); if (!c) return null; const r = c.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
        if (box) { await page.mouse.move(box.x, box.y); await page.mouse.down(); for (let i = 1; i <= 8; i++) { await page.mouse.move(box.x + i * 26, box.y); await new Promise(r => setTimeout(r, 16)); } await page.mouse.up(); }
        await new Promise(r => setTimeout(r, 600));
        const after = await page.evaluate(() => (document.body.innerText.match(/(\d+)\s*\/\s*\d+/) || [])[1]);
        console.log(`swipe-advance: card ${before} -> ${after}`);
      }
    }
    return;
  }
  if (screen === "mastery" || screen === "correct" || screen === "capital" || screen === "eszett") {
    // First card is the seeded due card (der Bahnhof). Type its answer — lowercased for
    // the 'capital' case to verify the capitalisation flag.
    await clickText(page, "Production practice");
    await new Promise(r => setTimeout(r, 250));
    const answer = screen === "capital" ? "der bahnhof" : screen === "eszett" ? "die Strasse" : "der Bahnhof";
    await page.evaluate((a) => { const i = document.querySelector('input[lang="de"]'); if (i) { i.focus(); const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set; set.call(i, a); i.dispatchEvent(new Event("input", { bubbles: true })); } }, answer);
    await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.getAttribute("aria-label") === "Submit answer")?.click());
    await new Promise(r => setTimeout(r, +process.env.SHOOT_HOLD || 550));
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
    await new Promise(r => setTimeout(r, 600));
    if (process.env.SHOOT_HOME) {
      // Celebrations are suspended until home — go back and let the queue flush there.
      await clickText(page, "Back");
      await new Promise(r => setTimeout(r, 1100)); // 480ms flush delay + toast slide-in
    }
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
  if (screen === "progmax") {
    // High-capability Progress: every A1 word strong + ~half of A2, so the journey bar, level
    // funnel and "Elementary" rank are populated (the advanced persona seeds volume, not mastery).
    await page.evaluate(() => {
      const now = Date.now();
      const lvlOf = w => w.level || ({ easy: "A1", medium: "A2", hard: "B1" })[w.diff] || "A2";
      const prog = {}; let a2 = 0;
      for (const cat of Object.keys(V)) for (const w of V[cat]) {
        const L = lvlOf(w);
        if (L === "A1" || (L === "A2" && a2++ % 2 === 0)) {
          const mastered = L === "A1" && a2 % 3 === 0;
          prog[`production::${cat}::${w.de}`] = { stats: { attempts: 6, correct: 6, incorrect: 0, lastSeen: now, avgTime: 5000, timedAttempts: 6, currentStreak: 5, productionStreak: 5, masteredAt: mastered ? now - 10 * 86400000 : null }, srs: { box: mastered ? 5 : 4, lastReviewed: now } };
        }
      }
      localStorage.setItem("gfc-v7", JSON.stringify(prog));
      localStorage.setItem("ad-onboarding-v1", "done");
      localStorage.setItem("gfc-daily-v7", JSON.stringify({ date: new Date().toISOString().slice(0, 10), count: 18, streak: 23 }));
      localStorage.setItem("ad-mission-progress-v1", JSON.stringify(Object.fromEntries(["directions", "hotel", "cafe", "restaurant", "supermarket", "transit", "anmeldung", "rundfunk"].map(id => [id, { learned: true, listened: true, spoke: true, doneAt: now - 86400000 }]))));
    });
    await page.reload({ waitUntil: "load" });
    await page.waitForFunction(() => document.getElementById("root")?.childElementCount > 0, { timeout: 15000 });
    await new Promise(r => setTimeout(r, 700));
    await clickText(page, "Progress");
    await new Promise(r => setTimeout(r, 500));
    return;
  }
  if (screen === "rankup") {
    // The full-screen CEFR rank-up fires when deepStats.currentLevel rises during a session.
    // currentLevel = lowest level not yet fully STRONG, so seed EVERY A1 card strong & not-due
    // except "der Bahnhof" (left one short + due) → currentLevel sticks at A1. Then drive one
    // correct production answer on Bahnhof to make it strong → A1 completes → A1→A2 rank-up,
    // queued and flushed on home. cardLevel = w.level || {easy:A1,medium:A2,hard:B1}[diff] || A2.
    await page.evaluate(() => {
      const D = 86400000, now = Date.now();
      const lvlOf = w => w.level || ({ easy: "A1", medium: "A2", hard: "B1" })[w.diff] || "A2";
      const prog = {};
      for (const cat of Object.keys(V)) for (const w of V[cat]) {
        if (lvlOf(w) !== "A1") continue;
        if (cat === "Travel & Directions" && w.de === "der Bahnhof") continue;
        // box 3 = strong; lastReviewed today = NOT due, so it won't enter the review session.
        prog[`production::${cat}::${w.de}`] = { stats: { attempts: 4, correct: 4, incorrect: 0, lastSeen: now, avgTime: 5000, timedAttempts: 4, currentStreak: 3, productionStreak: 3, masteredAt: null }, srs: { box: 3, lastReviewed: now } };
      }
      // Bahnhof: due + one short of strong (box 2, pStreak 2) → one correct answer crosses it.
      prog["production::Travel & Directions::der Bahnhof"] = { stats: { attempts: 2, correct: 2, incorrect: 0, lastSeen: now - 25 * D, avgTime: 5000, timedAttempts: 2, currentStreak: 2, productionStreak: 2, masteredAt: null }, srs: { box: 2, lastReviewed: now - 25 * D } };
      localStorage.setItem("gfc-v7", JSON.stringify(prog));
      localStorage.setItem("ad-onboarding-v1", "done");
      localStorage.setItem("gfc-goal-v7", "20");
      localStorage.setItem("gfc-daily-v7", JSON.stringify({ date: new Date().toISOString().slice(0, 10), count: 12, streak: 6 }));
    });
    await page.reload({ waitUntil: "load" });
    await page.waitForFunction(() => document.getElementById("root")?.childElementCount > 0, { timeout: 15000 });
    await new Promise(r => setTimeout(r, 700));
    await clickText(page, "Production practice");
    await new Promise(r => setTimeout(r, 350));
    await page.evaluate(() => { const i = document.querySelector('input[lang="de"]'); if (i) { i.focus(); const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set; set.call(i, "der Bahnhof"); i.dispatchEvent(new Event("input", { bubbles: true })); } });
    await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.getAttribute("aria-label") === "Submit answer")?.click());
    await new Promise(r => setTimeout(r, 800));
    // Single due card → session ends at results; go home so the queued rank-up flushes.
    for (let i = 0; i < 3; i++) {
      const onHome = await page.evaluate(() => /GUTEN TAG|Guten Tag/.test(document.body.innerText));
      if (onHome) break;
      const moved = await page.evaluate(() => { const b = [...document.querySelectorAll("button,[role=button]")].find(e => /^\s*(←\s*)?(Back to home|Back|Weiter|Home)\s*$/i.test(e.textContent || "")); if (b) { b.click(); return true; } return false; });
      if (!moved) break;
      await new Promise(r => setTimeout(r, 700));
    }
    await new Promise(r => setTimeout(r, +(process.env.SHOOT_RANKWAIT || 1400)));
    return;
  }
  if (screen === "skillunlock" || screen === "statusup") {
    // Open the café mission (seeded 2/3) and credit its final "listened" step by opening the
    // scene → the mission completes and queues the green "Skill unlocked" toast (+ the
    // Newcomer→Settling-in status toast for `statusup`). Back out to home so the queue flushes.
    await clickText(page, "All scenarios →");
    await new Promise(r => setTimeout(r, 350));
    await clickText(page, "Order at a café or bakery");
    await new Promise(r => setTimeout(r, 350));
    await clickText(page, "Listen to the scene");
    await new Promise(r => setTimeout(r, 500));
    for (let i = 0; i < 5; i++) {
      const onHome = await page.evaluate(() => /GUTEN TAG|Guten Tag/.test(document.body.innerText));
      if (onHome) break;
      // Mission back-button reads "← Journey"; scene/scenarios read "Back"; tap the Home nav otherwise.
      const moved = await page.evaluate(() => {
        const b = [...document.querySelectorAll("button,[role=button]")].find(e => /^\s*(←\s*)?(Back|Journey)\s*$/i.test(e.textContent || ""));
        if (b) { b.click(); return true; }
        const home = [...document.querySelectorAll("button,[role=button]")].find(e => (e.textContent || "").trim() === "Home" || (e.getAttribute("aria-label") || "").toLowerCase() === "home");
        if (home) { home.click(); return true; }
        return false;
      });
      if (!moved) break;
      await new Promise(r => setTimeout(r, 500));
    }
    // Flush plays one toast at a time (2.3s each); statusup is second in the queue.
    await new Promise(r => setTimeout(r, screen === "statusup" ? 2900 : 900));
    return;
  }
  if (screen === "confusionanswered") {
    await clickText(page, "Train"); await new Promise(r => setTimeout(r, 200));
    await clickText(page, "Confusion pairs"); await clickText(page, "Start session");
    await new Promise(r => setTimeout(r, 500));
    await page.evaluate(() => { const g = document.querySelector('[style*="grid-template-columns"]'); const b = g && g.querySelector("button"); if (b) b.click(); });
    await new Promise(r => setTimeout(r, 700));
    return;
  }
  if (screen === "examanswered") {
    await clickText(page, "Train"); await new Promise(r => setTimeout(r, 200));
    await clickText(page, "Exam practice"); await clickText(page, "Start session");
    await new Promise(r => setTimeout(r, 500));
    await page.evaluate(() => { const g = document.querySelector('[style*="grid-template-columns"]'); const b = g && g.querySelector("button"); if (b) b.click(); });
    await new Promise(r => setTimeout(r, 700));
    return;
  }
  if (screen === "speakingrevealed") {
    await clickText(page, "Speaking"); await new Promise(r => setTimeout(r, 250));
    await clickText(page, "Speaking practice"); await new Promise(r => setTimeout(r, 400));
    await page.evaluate(() => [...document.querySelectorAll("button,[role=button]")].find(b => /reveal answer/i.test(b.textContent || ""))?.click());
    await new Promise(r => setTimeout(r, 600));
    return;
  }
  if (screen === "drillsetup") {
    // The drill setup modal itself (before starting) — verifies the Articles/Plural tiles open
    // a drill setup with a Start button, not the mode-discarding vocab presets.
    await clickText(page, "Train");
    await new Promise(r => setTimeout(r, 300));
    await clickText(page, process.env.SHOOT_DRILL || "Articles");
    await new Promise(r => setTimeout(r, 400));
    return;
  }
  if (screen === "weakspots") {
    // Home "Weak spots" card → startWeakReview() begins a weak-words session in one tap.
    await clickText(page, "Weak spots");
    await new Promise(r => setTimeout(r, 600));
    return;
  }
  if (screen === "masteryresult") {
    // Single due card seeded one correct-answer short of mastery → answering it crosses to
    // mastered and the session ends on the results screen showing "+1 Mastered ★" + the
    // newly-mastered recap panel (the in-session burst is suppressed by design).
    await clickText(page, "Production practice");
    await new Promise(r => setTimeout(r, 300));
    const typeSubmit = async (val) => {
      const ok = await page.evaluate((v) => { const i = document.querySelector('input[lang="de"]'); if (!i) return false; i.focus(); const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set; set.call(i, v); i.dispatchEvent(new Event("input", { bubbles: true })); return true; }, val);
      if (ok) await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.getAttribute("aria-label") === "Submit answer")?.click());
      return ok;
    };
    // Card 1 is the seeded due card der Bahnhof — answer it right to cross mastery; the rest
    // can be anything (wrong is fine), we just need to reach results.
    for (let k = 0; k < 40; k++) {
      const done = await page.evaluate(() => /Mastered|Repeat \d|Keep going|Perfect|Strong session|Session complete|Back to home/i.test(document.body.innerText) && !document.querySelector('input[lang="de"]'));
      if (done) break;
      if (await typeSubmit(k === 0 ? "der Bahnhof" : "x")) await new Promise(r => setTimeout(r, 220));
      await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /^(Next|Results)/.test((b.textContent || "").trim()))?.click());
      await new Promise(r => setTimeout(r, 220));
    }
    await new Promise(r => setTimeout(r, 1000));
    return;
  }
  if (screen === "tutorchat" || screen === "tutorstart") {
    // aiKey + a sample conversation are seeded (tutorChat flag) → the live chat UI renders
    // with bubbles. No Send is tapped, so no network request is made.
    await clickText(page, "Chat & ask in German");
    await new Promise(r => setTimeout(r, 600));
    return;
  }
  if (screen === "dictation") {
    // Dictation lives under the library setup's Advanced options (Review-this-topic grid).
    await clickText(page, "Custom session");
    await new Promise(r => setTimeout(r, 300));
    await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /advanced options/i.test(b.textContent || ""))?.click());
    await new Promise(r => setTimeout(r, 350));
    await clickText(page, "Dictation");
    await new Promise(r => setTimeout(r, 200));
    await clickText(page, "Start session");
    await new Promise(r => setTimeout(r, 1100));
    return;
  }
  if (screen === "comprehension") {
    // Listening drill in "With Questions" (comprehension MCQ) mode.
    await clickText(page, "Train");
    await new Promise(r => setTimeout(r, 250));
    await clickText(page, "Listening");
    await new Promise(r => setTimeout(r, 300));
    await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /with questions|comprehension/i.test(b.textContent || ""))?.click());
    await new Promise(r => setTimeout(r, 250));
    await clickText(page, "Start session");
    await new Promise(r => setTimeout(r, 900));
    return;
  }
  if (screen === "dialoguerevealed") {
    // Listening scene with the German bubbles tapped open (tap-to-reveal).
    await clickText(page, "Train");
    await new Promise(r => setTimeout(r, 250));
    await clickText(page, "Listening");
    await new Promise(r => setTimeout(r, 250));
    await clickText(page, "Start session");
    await new Promise(r => setTimeout(r, 500));
    await page.evaluate(() => [...document.querySelectorAll("button,[role=button]")].filter(b => /tap to listen|tap to reveal/i.test(b.textContent || "")).forEach(b => b.click()));
    await new Promise(r => setTimeout(r, 700));
    return;
  }
  if (screen === "recall") {
    // Custom session → Quick (Recall · 10) starts the flip session in one tap. Reveal the
    // first card via the keyboard "not sure" gesture (ArrowLeft = always flips) — the card
    // only takes keys when focused, so focus it first. Shows the answer face + Next.
    await clickText(page, "Custom session");
    await clickText(page, "Quick");
    await new Promise(r => setTimeout(r, 500));
    await page.evaluate(() => document.querySelector('[aria-label^="Swipe right"]')?.focus());
    await page.keyboard.press("ArrowLeft");
    await new Promise(r => setTimeout(r, 700));
  }
  if (screen === "recallfront") {
    // The un-revealed front of a recall card (German prompt + swipe hints).
    await clickText(page, "Custom session");
    await clickText(page, "Quick");
    await new Promise(r => setTimeout(r, 600));
  }
  if (screen === "recallgot") {
    // Full right-swipe ("got it") + release. With auto-advance ON the card flies off to
    // the next; with SHOOT_AUTOADV=0 it flips to the answer (study mode). Logs which.
    await clickText(page, "Custom session");
    await clickText(page, "Recall");
    await clickText(page, "Start session");
    await new Promise(r => setTimeout(r, 500));
    const box = await page.evaluate(() => { const el = document.querySelector('[aria-label^="Swipe right"]') || document.querySelector('[role="button"]'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    const before = await page.evaluate(() => (document.body.innerText.match(/(\d+)\s*\/\s*\d+/) || [])[1]);
    if (box) { await page.mouse.move(box.x, box.y); await page.mouse.down(); for (let i = 1; i <= 7; i++) { await page.mouse.move(box.x + i * 18, box.y); await new Promise(r => setTimeout(r, 16)); } await page.mouse.up(); }
    await new Promise(r => setTimeout(r, 700));
    const state = await page.evaluate(() => ({ card: (document.body.innerText.match(/(\d+)\s*\/\s*\d+/) || [])[1], revealed: !!document.querySelector('[aria-label="Answer revealed"]') }));
    console.log(`recallgot[autoadv=${process.env.SHOOT_AUTOADV === "0" ? "off" : "on"}]: card ${before} -> ${state.card}, revealed=${state.revealed}`);
  }
  if (screen === "recallswipe") {
    // Drag the German FRONT right and hold — surfaces the green GOT IT ("I know it") stamp.
    await clickText(page, "Custom session");
    await clickText(page, "Recall");
    await clickText(page, "Start session");
    await new Promise(r => setTimeout(r, 500));
    const box = await page.evaluate(() => {
      const el = document.querySelector('[aria-label^="Swipe right"]') || document.querySelector('[role="button"]');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    if (box) {
      await page.mouse.move(box.x, box.y);
      await page.mouse.down();
      for (let i = 1; i <= 6; i++) { await page.mouse.move(box.x + i * 22, box.y); await new Promise(r => setTimeout(r, 25)); }
      await new Promise(r => setTimeout(r, 120));
    }
  }
  if (screen === "results") {
    // Drive a production session to completion (all wrong) to reach the results screen.
    // Start via the home "Production practice" hero — going through "Custom session" lands on
    // the "__all__" setup modal whose Start session is hidden behind Advanced options.
    await clickText(page, "Production practice");
    await new Promise(r => setTimeout(r, 250));
    const nativeType = (val) => page.evaluate((v) => {
      const i = document.querySelector('input[lang="de"]');
      if (!i) return false;
      i.focus(); const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set; set.call(i, v); i.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    }, val);
    for (let k = 0; k < 40; k++) {
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
  if (screen === "drillbloom") {
    // Article drill (der/die/das). Click "der" each card until a masculine noun lands
    // correct, then return immediately so the screenshot catches the green bloom mid-flight.
    await clickText(page, "Train"); // Training drills live in the Train tab
    await new Promise(r => setTimeout(r, 300));
    await clickText(page, "Articles"); // opens the setup modal
    await new Promise(r => setTimeout(r, 200));
    // "__all__" setup hides the mode-respecting Start session under Advanced options.
    const hasStart = await page.evaluate(() => [...document.querySelectorAll("button,[role=button]")].some(e => /start session/i.test((e.textContent || ""))));
    if (!hasStart) { await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /advanced options/i.test(b.textContent || ""))?.click()); await new Promise(r => setTimeout(r, 350)); }
    await clickText(page, "Start session");
    await new Promise(r => setTimeout(r, 350));
    for (let k = 0; k < 18; k++) {
      const clicked = await page.evaluate(() => {
        const b = [...document.querySelectorAll("button")].find(x => (x.textContent || "").trim() === "der");
        if (b) { b.click(); return true; }
        return false;
      });
      if (!clicked) break;
      await new Promise(r => setTimeout(r, +process.env.SHOOT_HOLD || 130));
      const correct = await page.evaluate(() => !!document.querySelector(".ad-bloom"));
      if (correct) return; // bloom is animating — capture now
      await page.evaluate(() => [...document.querySelectorAll("button")].find(x => /^(Next|Weiter|Results)/.test((x.textContent || "").trim()))?.click());
      await new Promise(r => setTimeout(r, 250));
    }
    return;
  }
}

async function run() {
  await buildHarness();
  await mkdir(OUT, { recursive: true });
  const browser = await puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: "shell" });
  try {
    for (const screen of screens) {
      const page = await browser.newPage();
      await page.setViewport({ width: +(process.env.SHOOT_WIDTH || 390), height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      // "rankup" seeds itself post-load (it needs the vocab list V, unavailable pre-load) and
      // reloads — so it must NOT register the seedState clobber, which would wipe it on reload.
      if (screen !== "rankup" && screen !== "progmax" && screen !== "longword" && screen !== "longprompt")
        await page.evaluateOnNewDocument(seedState, { persona: screen === "onboarding" ? "onboarding" : PERSONA, mode: process.env.SHOOT_MODE || "", near: screen === "goal", streakReady: screen === "streak", freezeMiss: screen === "freezeused", mastery: screen === "mastery" || screen === "masteryresult", correctFast: screen === "correct" || screen === "capital", eszett: screen === "eszett", level: process.env.SHOOT_LEVEL || "", training: process.env.SHOOT_TRAINING === "1", missionReady: screen === "skillunlock" || screen === "statusup", tutorChat: screen === "tutorchat" || screen === "tutorstart", tutorChatEmpty: screen === "tutorstart" });
      if (process.env.SHOOT_AUTOADV === "0") await page.evaluateOnNewDocument(() => { try { localStorage.setItem("gfc-autoadv-v1", "0"); } catch (e) {} });
      await page.goto("file://" + HARNESS, { waitUntil: "load" });
      await page.waitForFunction(() => document.getElementById("root")?.childElementCount > 0, { timeout: 15000 });
      await new Promise(r => setTimeout(r, 500));
      try { await gotoScreen(page, screen); } catch (e) { console.warn(`  (${screen}: ${e.message})`); }
      if (process.env.SHOOT_OVERFLOW) {
        const report = await page.evaluate(() => {
          const vw = document.documentElement.clientWidth;
          const out = [];
          document.querySelectorAll("*").forEach(el => {
            const r = el.getBoundingClientRect();
            if (r.right > vw + 1 && r.width <= vw + 40) {
              const txt = (el.textContent || "").trim().slice(0, 40);
              out.push(`+${Math.round(r.right - vw)}px past edge | <${el.tagName.toLowerCase()}> "${txt}"`);
            }
          });
          return { vw, docScroll: document.documentElement.scrollWidth, items: out.slice(0, 12) };
        });
        console.log(`OVERFLOW @${report.vw}px (docScrollWidth=${report.docScroll}):`);
        report.items.forEach(i => console.log("  " + i));
      }
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
