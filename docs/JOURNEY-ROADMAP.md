# The Journey — full review + roadmap

The journey is AutoDeutsch's soul: **learn to live in a German-speaking country by doing the real
scenarios**, not by grinding a word list. This doc reviews what exists, what's missing, and a phased
plan to make the journey *the* product. (Status doc; updated as phases land. Pairs with ROADMAP.md.)

## What exists today (grounded in the code/data)
- **58 missions across 7 arcs** — Touchdown (10, A1-heavy) → Paperwork → A Roof → Money → Health →
  Job → Belonging (8). Spread A1→B2; Touchdown is the A1 on-ramp, later arcs lean B1/B2.
- **Per-mission syllabus→test loop** (the strongest part): **Learn the exact scene words**
  (`MISSION_VOCAB`, ~10, 58/58 covered) → **Listen** to the scene(s) (`dialogues`; 34/58 multi-scene)
  → comprehension **questions** → **Build the sentence** (mission-tagged `SENTENCES`, 58/58, bonus
  step). One coherent word set end to end, all flowing through the real SRS engine.
- **Capability framing** — each mission is a can-do ("Order at a café or bakery"); completing it fires
  a "You can now…" skill-unlock.
- **Identity ladder** — `ROLES`: Newcomer → Settling in (3) → Resident (8) → Local (18), by *count of
  missions done*. Role-up celebration.
- **Entry** — placement test (P5) estimates CEFR + recommends a first mission for the learner's goal-arc.
- **Surfaces** — Home mission card (shows next step); **Library opens on the journey** (continue-hero +
  arc overview); Scenarios screen (full arc→mission list); Mission detail (the 4 steps).
- **Navigation** now seamless — back-stack follows your path; finishing a step returns to the mission.

## What it does well
1. **A real, differentiated purpose.** The arcs literally trace relocating (land → paperwork → flat →
   money → health → job → belonging). The DACH-rite content (Anmeldung, Rundfunkbeitrag, SCHUFA,
   Krankenkasse, Kaution…) is genuinely useful and hard to find elsewhere.
2. **Best-in-class per-mission pedagogy.** Learn the *exact* words a scene uses → hear them → be tested
   on them → produce them. Most apps teach words that never reconnect; here they do.
3. **Outcome-oriented.** "You can now…" + CEFR anchoring makes progress legible and motivating.
4. **A gentle on-ramp** (placement → A1 Touchdown) and **multi-surface presence**.

## What it needs to truly work (the gaps)
1. **It's a menu, not a path.** All 58 missions are open at once; the only guidance is "START HERE" on
   one. There's no felt forward motion through an arc, no "next up", no soft sequencing. The Scenarios
   screen is a flat list of everything — focus-less and a little overwhelming.
2. **Arcs are invisible as chapters.** Arcs are the narrative units but have no beginning (why this
   matters), and **finishing an arc does nothing** — no payoff, no "you're official now," no transition
   to the next chapter. The biggest motivational lever is unused.
3. **Missions don't make you *do* the scenario.** The loop is receptive + drill. There's no roleplay,
   no conversation, no "can you actually pull it off" climax. For "Order at a café," the peak should be
   *doing* the café exchange — the context-aware Tutor exists but isn't wired into the mission.
4. **Two competing progress systems.** The mission/role ladder (Newcomer→Local, by mission count) and
   the CEFR "Journey to B2" (vocab strength, "Chapter X of 5") are separate bars telling different
   stories. A learner can't tell which one *is* "the journey."
5. **Home leads with the grind, not the journey.** The primary Home hero is SRS "Review N words"; the
   journey is a secondary card. The daily habit and the journey are disconnected — you do reviews, but
   they don't visibly move the journey, and the journey doesn't drive what you review.
6. **One-and-done, no durability.** A completed mission is done forever (`doneAt`). Competence fades but
   nothing resurfaces ("your café German is rusty"). The journey doesn't maintain itself.
7. **Shallow personalization.** After placement picks a goal-arc + first mission, everyone gets the same
   fixed 58 in the same order. Goal ("Working in German" vs "Settling in") should reshape emphasis.
8. **No map.** The "map" metaphor is named but unrealized — Scenarios is a vertical list, not a route
   you can see yourself moving along.
9. **Uneven depth.** 24/58 missions still have a single Listen scene (content-lane work in progress).

---

## Roadmap (phased — J1…J6)

Sequenced for value-first: make it the flagship surface, then a felt path, then make you *do* it,
then unify + deepen. Each phase is shippable on its own.

### J1 — Home becomes journey-first  *(highest visibility; the "flagship" ask)* — ✅ DONE (v.23)
Make the journey the first thing you see and do. Shipped: the **gold "Continue your journey →
{mission}"** hero now leads Home (right under the greeting, with role eyebrow + "All scenarios →" +
"Next: {step}"), and the SRS "Review N words" + the custom-session CTA are demoted to calm dark
secondary cards — so the journey is the single gold focal point. `allDone` shows a "Journey complete"
hero. *Possible follow-up: the hero could one-tap into the next step (currently opens the mission hub).*

### J2 — A felt path: arc focus, sequencing & a map — ✅ DONE (v.25)
Replace the flat Scenarios list with a **focused current-arc view**: the active arc up top with its
missions as ordered stops (done ✓ / current ● / upcoming ○), your position marked; other arcs
collapsed/peeked. Add a lightweight **journey map** (arcs as a route, you as a pin). Keep everything
reachable (soft sequencing, not hard locks). *Effort: Med-High · app.jsx. Risk: Low-Med.*

**Shipped:** the Scenarios screen is now a **map you walk**. (1) An **overview header** — role +
"{done}/58 scenarios" + a progress bar + "Next: {role} at {n}" — gives the whole-journey glance.
(2) Arcs are **foldable chapters**; by default only the **active** arc (the one holding `currentMission`)
is open, with completed/future arcs collapsed to a one-line summary (icon, payoff/sub, "✓" or
"{done}/{total}", chevron) — focusing the screen on where you are. The active arc wears a gold
**"YOU ARE HERE"** chip. (3) Inside an open arc the missions sit on a **connected vertical trail**: a
spine line threads through node dots that fill **green** as completed (walked segments turn green too),
the current step is a **gold pulsing node** ("START HERE" / "CONTINUE →"), done can-dos mute. Soft
sequencing only — everything stays tappable (`openMission`), no hard locks. `arcOpen` fold state;
harness `journeypath` (`journeyMid` seed). *Possible follow-up: a true top-down route/pin map graphic;
remember the user's manual fold choices across visits (currently resets per screen mount).*

### J3 — Arc as a chapter: intro, payoff, transition — ✅ DONE (v.24)
Give each arc a short **intro** ("The Paperwork — make yourself official") and, on completion, a
**real celebration + reward** (an arc badge / status moment) that hands off to the next arc ("You're
registered. Next: find a flat."). Wire arc-complete into the existing celebration queue. *Effort: Med
· app.jsx + a little arc copy in data. Risk: Low.*

**Shipped:** completing the last mission of an arc fires a **full-screen "CHAPTER COMPLETE"**
celebration — green arc badge, "{Arc} complete", a one-line **payoff** (new `payoff` field on all 7
`MISSION_ARCS`), and a "Next chapter: {next arc} — {sub}" hand-off → "Start the next chapter →".
Detected in `markMissionStep` (only on the finishing step), queued via `celebQueueRef` (kind `"arc"`
→ `arcCeleb` state), flush + Escape wiring alongside toast/rank-up. Scenarios arc header now shows
green badge + payoff line + "✓ Complete" when the arc is done. Harness path: `arccomplete`. *(Arc
**intro** copy is a small remaining follow-on — the payoff/transition half is the felt motivation
loop and is live.)*

### J4 — The "do it" climax: mission roleplay  *(biggest pedagogical upgrade)* — ✅ DONE (v.26)
Add a final **roleplay** step to each mission: the context-aware Tutor plays the other party ("I'm the
barista — order in German") and grades whether you pulled it off, using the mission's vocab + scene.
This turns a mission from *drill the words* into *perform the scenario* — the real proof of "you can
now…". Falls back gracefully without an API key (scripted self-check). *Effort: High · app.jsx +
Tutor. Risk: Med (BYO-key; needs a no-key fallback).*

**Shipped:** a gold **"The real thing · Do it for real"** climax card on the mission hub opens a focused
roleplay chat. With a key, the **Tutor stops tutoring and becomes the other party** (`buildRoleplaySystem`
+ a `__BEGIN__` opener kick): German-only, in character, turn-by-turn; **"Finish & see how I did"** sends a
`__GRADE__` turn and the model drops character for a parsed **verdict** (Passed / Almost / Keep practising
+ went-well + to-improve). Finishing credits a **bonus `roleplayed` step** (does NOT gate the learn/listen/
speak completion). **No-key fallback** = a scripted self-check: the mission's real phrases (tagged SENTENCES,
each with audio) to rehearse out loud + a "Could you do this for real?" self-rate that credits the step.
Own chat state (`rpMsgs`/`rpVerdict`/`rpMission`…), kept out of the Tutor history; reuses the BYOK Anthropic
path. Harness: `roleplay` (no-key) + `roleplaychat` (mocked endpoint — interception keyed on message
*content*, since the system prompt itself names the `__GRADE__` token). *Possible follow-ups: surface the
roleplay verdict on Progress / arc payoff; per-mission opening-line flavour; voice input.*

### J5 — Unify progression + make daily practice maintain the journey
Collapse the two progress systems into one legible spine: **status/role is the headline** (Newcomer→
Local), **CEFR is the "language level" sub-metric**, and the **journey % = missions done**. Then make
the daily review visibly **maintenance for the journey** — surface "refresh" of completed-mission
scenarios when their words decay (`doneAt` + SRS strength), so the habit loop and the journey are one
system. *Effort: Med-High · app.jsx. Risk: Med (touches Progress + Home framing).*

### J6 — Personalization + content depth  *(some of this is the content lane)*
Goal-based emphasis (reorder/spotlight arcs for "Working in German" vs "Settling in & making friends");
finish multi-scene coverage (24 single-scene missions → 2 scenes); light per-arc narrative framing;
mission-step variety. *Effort: Med, mostly additive `src/data.js`. Risk: Low.*

## Recommended order & why
**J1 ✅ → J3 ✅ → J2 ✅ → J4 ✅ → J5 (next) → J6.** J1 made the journey the flagship immediately (the
explicit goal) and was low-risk. J3 (arc payoff) was cheap and added the missing motivation loop. J2
(path/map) was the bigger UX build that benefited from J1/J3 being in place. J4 (mission roleplay climax
via the Tutor) was the marquee depth upgrade — *perform the scenario*, not just drill it. **All four are
now live (v.23/24/25/26).** **J5 (unify progression + make daily practice maintain the journey) is next**
— collapse the two progress systems into one legible spine and reframe the daily review as journey
maintenance. J6 deepens content in parallel (content lane can run it anytime). Each ships independently;
we can resequence on your call.
