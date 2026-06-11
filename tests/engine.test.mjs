// Unit tests for the pure engine functions that encode learning behavior.
// The app ships as one compiled classic script (app.js) with no exports, so we
// evaluate it in a vm sandbox with just enough browser/React surface stubbed for
// top-level execution, then harvest the functions out of the context.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

// Content loads first (separate classic script in the browser), engine second.
const dataCode = await readFile(new URL("../data.js", import.meta.url), "utf8");
const code = await readFile(new URL("../app.js", import.meta.url), "utf8");

const noop = () => {};
const ReactStub = new Proxy(
  { Component: class {}, memo: f => f, createElement: () => null, Fragment: Symbol("Fragment") },
  { get: (t, k) => (k in t ? t[k] : noop) }
);
const ctx = {
  console,
  React: ReactStub,
  ReactDOM: { createRoot: () => ({ render: noop }) },
  document: { getElementById: () => ({}), addEventListener: noop, createElement: () => ({}) },
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  navigator: { userAgent: "test" },
  setTimeout, clearTimeout, setInterval, clearInterval,
};
ctx.window = ctx;
ctx.self = ctx;
vm.createContext(ctx);
vm.runInContext(dataCode, ctx);
vm.runInContext(code, ctx);

// Top-level const/function bindings live in the context's global scope; a second
// script in the same context can read them even though they aren't on globalThis.
const api = vm.runInContext(
  "({ checkMatch, within1Edit, normalize, nextBox, todayKey, weightedSelect, sessionMultiplier, seedDueFirst, SRS_INTERVALS })",
  ctx
);
const { checkMatch, within1Edit, normalize, nextBox, todayKey, weightedSelect, sessionMultiplier, seedDueFirst, SRS_INTERVALS } = api;

const DAY = 86400000;

test("normalize folds umlauts/ß and strips punctuation", () => {
  assert.equal(normalize("Tschüss!"), "tschuess");
  assert.equal(normalize("GROSS"), normalize("groß"));
});

test("within1Edit accepts one insertion/deletion/substitution, rejects two", () => {
  assert.equal(within1Edit("hallo", "hallo"), true);
  assert.equal(within1Edit("halo", "hallo"), true);   // insertion
  assert.equal(within1Edit("halllo", "hallo"), true); // deletion
  assert.equal(within1Edit("hallo", "hello"), true);  // substitution
  assert.equal(within1Edit("hallo", "heLLo".toLowerCase()), true);
  assert.equal(within1Edit("haus", "maus2"), false);  // sub + insert
  assert.equal(within1Edit("ab", "abcd"), false);     // length diff 2
});

test("checkMatch: exact matches, including umlaut folding and / alternatives", () => {
  assert.equal(checkMatch("neun", "neun"), "exact");
  assert.equal(checkMatch("Tschuess", "Tschüss"), "exact"); // ü folds to "ue"
  assert.equal(checkMatch("Tschuss", "Tschüss"), "close");  // missing the e = one edit
  assert.equal(checkMatch("gerne", "gern / gerne"), "exact");
});

test("checkMatch: short-word near-misses are wrong, not close (different words)", () => {
  assert.equal(checkMatch("neue", "neun"), "wrong");
  assert.equal(checkMatch("rat", "rot"), "wrong");
  assert.equal(checkMatch("vier", "Bier"), "wrong");
  assert.equal(checkMatch("see", "Tee"), "wrong");
});

test("checkMatch: 5+ char targets tolerate one typo as close, per alternative", () => {
  assert.equal(checkMatch("hallu", "Hallo"), "close");
  assert.equal(checkMatch("niemal", "niemals / nie"), "close");
  assert.equal(checkMatch("xyzzy", "Hallo"), "wrong");
});

test("nextBox: wrong always demotes one box, floored at 0", () => {
  const now = Date.now();
  assert.equal(nextBox(3, false, now - 10 * DAY, now), 2);
  assert.equal(nextBox(0, false, now - 10 * DAY, now), 0);
});

test("nextBox: first-ever correct answer promotes", () => {
  assert.equal(nextBox(0, true, null, Date.now()), 1);
});

test("nextBox: same-day correct repeat does NOT promote (cram guard)", () => {
  const now = Date.now();
  assert.equal(nextBox(2, true, now - 60_000, now), 2);        // a minute later
  assert.equal(nextBox(2, true, now - 0.5 * DAY, now), 2);      // later the same day (interval 4d)
});

test("nextBox: correct on/after the due date promotes, capped at 5", () => {
  const now = Date.now();
  assert.equal(nextBox(1, true, now - SRS_INTERVALS[1] * DAY, now), 2);
  assert.equal(nextBox(1, true, now - 3 * DAY, now), 2);
  assert.equal(nextBox(5, true, now - 31 * DAY, now), 5);
});

test("todayKey formats as YYYY-MM-DD", () => {
  assert.equal(todayKey(new Date(2026, 0, 5)), "2026-01-05");
  assert.match(todayKey(), /^\d{4}-\d{2}-\d{2}$/);
});

test("weightedSelect returns unique cards from the pool, capped at count", () => {
  const pool = Array.from({ length: 30 }, (_, i) => ({ de: `w${i}`, diff: i % 3 === 0 ? "hard" : "easy" }));
  const out = weightedSelect(pool, 10, () => 1);
  assert.equal(out.length, 10);
  assert.equal(new Set(out.map(c => c.de)).size, 10);
  out.forEach(c => assert.ok(pool.includes(c)));
  assert.equal(weightedSelect(pool.slice(0, 4), 10, () => 1).length, 4);
});

test("sessionMultiplier stays within documented bounds", () => {
  const entry = { stats: { attempts: 10, correct: 3, incorrect: 7, avgTime: 20000, timedAttempts: 3 }, srs: { box: 0 } };
  for (const mode of ["easy", "hard", "mixed"]) {
    const m = sessionMultiplier(entry, mode);
    assert.ok(typeof m === "number" && m >= 0.3 && m <= 2.5, `${mode} → ${m}`);
  }
  assert.ok(sessionMultiplier(undefined, "easy") > 0);
});

test("buildUmlautTolerant matches both spellings without nested groups", () => {
  const { buildUmlautTolerant } = vm.runInContext("({ buildUmlautTolerant })", ctx);
  const pat = buildUmlautTolerant("über");
  assert.ok(new RegExp(pat, "i").test("über"));
  assert.ok(new RegExp(pat, "i").test("ueber"));
  assert.ok(!pat.includes("(?:(?:"), `nested groups in: ${pat}`);
});

test("highlightExample covers umlaut tails (Universität fully highlighted)", () => {
  const { highlightExample } = vm.runInContext("({ highlightExample })", ctx);
  const parts = highlightExample("Die Universität ist groß.", "die Universität");
  const hl = parts.filter(p => p.hl).map(p => p.text).join("");
  assert.ok(hl.includes("Universität"), `highlighted: "${hl}"`);
});

test("makeVerbQ konjunktiv2 produces a typed KII question", () => {
  const { makeVerbQ } = vm.runInContext("({ makeVerbQ })", ctx);
  for (let i = 0; i < 25; i++) {
    const q = makeVerbQ("konjunktiv2");
    assert.equal(q.tense, "Konjunktiv II");
    assert.ok(["ich", "er"].includes(q.pron), `pron: ${q.pron}`);
    assert.ok(typeof q.correct === "string" && q.correct.length > 0);
    assert.equal(q.opts, undefined); // typed answer, not multiple choice
  }
});

test("makeVerbQ honors a pre-picked verb (weighted selection hook)", () => {
  const { makeVerbQ, VERBS } = vm.runInContext("({ makeVerbQ, VERBS })", ctx);
  const sein = VERBS.find(v => v.v === "sein");
  const q = makeVerbQ("konjunktiv2", sein);
  assert.equal(q.verb, "sein");
  assert.equal(q.correct, "wäre");
});

test("every verb carries a Konjunktiv II form", () => {
  const { VERBS } = vm.runInContext("({ VERBS })", ctx);
  VERBS.forEach(v => assert.ok(typeof v.kj2 === "string" && v.kj2.trim().length > 0, `${v.v} missing kj2`));
});

test("checkMatch accepts either Konjunktiv II alternative", () => {
  assert.equal(checkMatch("ginge", "ginge / würde gehen"), "exact");
  assert.equal(checkMatch("würde gehen", "ginge / würde gehen"), "exact");
  assert.equal(checkMatch("wuerde gehen", "ginge / würde gehen"), "exact"); // umlaut folding
  assert.equal(checkMatch("gehe", "ginge / würde gehen"), "wrong");
});

test("checkPlural accepts the plural with or without the article", () => {
  const { checkPlural } = vm.runInContext("({ checkPlural })", ctx);
  assert.equal(checkPlural("die Wohnungen", "die Wohnungen"), "exact");
  assert.equal(checkPlural("Wohnungen", "die Wohnungen"), "exact");
  assert.equal(checkPlural("Baeume", "die Bäume"), "exact"); // umlaut folding
  assert.equal(checkPlural("Wohnung", "die Wohnungen"), "wrong"); // singular is not the plural
  assert.equal(checkPlural("Visa", "die Visa / Visen"), "exact"); // alternatives
});

test("plural pool: every card has a 'die …' plural and resolvable fields", () => {
  const { getPluralNouns } = vm.runInContext("({ getPluralNouns })", ctx);
  const pool = getPluralNouns();
  assert.ok(pool.length > 800, `expected a large plural pool, got ${pool.length}`);
  pool.forEach(n => {
    assert.match(n.pl, /^die .+/, `${n.de} → ${n.pl}`);
    assert.ok(n.de && n.cat && n.en, n.de);
  });
});

test("article/plural pools carry example sentences for the post-answer reveal", () => {
  const { getNouns, getPluralNouns } = vm.runInContext("({ getNouns, getPluralNouns })", ctx);
  const nouns = getNouns();
  const plural = getPluralNouns();
  assert.ok(nouns.filter(n => n.ex).length / nouns.length > 0.8, "most article cards should have ex");
  assert.ok(plural.filter(n => n.ex).length / plural.length > 0.8, "most plural cards should have ex");
});

test("seedDueFirst takes at most half the session from the due set", () => {
  const pool = Array.from({ length: 20 }, (_, i) => ({ de: `w${i}` }));
  const dueSet = new Set(["w0", "w1", "w2", "w3", "w4", "w5", "w6", "w7"]);
  const { seeded, rest } = seedDueFirst(pool, 10, c => dueSet.has(c.de));
  assert.equal(seeded.length, 5); // ceil(10/2), 8 available
  seeded.forEach(c => assert.ok(dueSet.has(c.de)));
  assert.equal(rest.length, 12);
  rest.forEach(c => assert.ok(!dueSet.has(c.de)));
  // Fewer due than half → take them all
  const few = seedDueFirst(pool, 10, c => c.de === "w3");
  assert.equal(few.seeded.length, 1);
});
