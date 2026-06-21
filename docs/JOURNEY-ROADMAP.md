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

### J1 — Home becomes journey-first  *(highest visibility; the "flagship" ask)*
Make the journey the first thing you see and do. The primary Home hero becomes **"Continue your
journey → {current mission} · next: {step}"** (gold, top). SRS "Review N words" demotes to the daily
habit slot beneath it. Add a one-line "where you are" (arc · role · mission N of M). *Effort: Med ·
app.jsx. Risk: Low (currentMission/step already exist).* **→ recommended first.**

### J2 — A felt path: arc focus, sequencing & a map
Replace the flat Scenarios list with a **focused current-arc view**: the active arc up top with its
missions as ordered stops (done ✓ / current ● / upcoming ○), your position marked; other arcs
collapsed/peeked. Add a lightweight **journey map** (arcs as a route, you as a pin). Keep everything
reachable (soft sequencing, not hard locks). *Effort: Med-High · app.jsx. Risk: Low-Med.*

### J3 — Arc as a chapter: intro, payoff, transition
Give each arc a short **intro** ("The Paperwork — make yourself official") and, on completion, a
**real celebration + reward** (an arc badge / status moment) that hands off to the next arc ("You're
registered. Next: find a flat."). Wire arc-complete into the existing celebration queue. *Effort: Med
· app.jsx + a little arc copy in data. Risk: Low.*

### J4 — The "do it" climax: mission roleplay  *(biggest pedagogical upgrade)*
Add a final **roleplay** step to each mission: the context-aware Tutor plays the other party ("I'm the
barista — order in German") and grades whether you pulled it off, using the mission's vocab + scene.
This turns a mission from *drill the words* into *perform the scenario* — the real proof of "you can
now…". Falls back gracefully without an API key (scripted self-check). *Effort: High · app.jsx +
Tutor. Risk: Med (BYO-key; needs a no-key fallback).*

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
**J1 → J3 → J2 → J4 → J5 → J6.** J1 makes the journey the flagship immediately (the explicit goal) and
is low-risk. J3 (arc payoff) is cheap and adds the missing motivation loop. J2 (path/map) is the bigger
UX build that benefits from J1/J3 being in place. J4 (roleplay) is the marquee depth upgrade — do it
once the frame is right. J5 unifies the story. J6 deepens content in parallel (content lane can run it
anytime). Each ships independently; we can resequence on your call.
