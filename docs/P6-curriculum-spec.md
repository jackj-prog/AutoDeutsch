# P6 — Library → Curriculum; taxonomy → "Dictionary"

## Problem
The **Library** tab — the app's main content surface — currently leads with the **raw database**:
the 36-category taxonomy in 5 super-groups, with the journey demoted to a single thin "Your journey"
card near the top. So discovery is by *word-category* (a dictionary), not by *life-situation* (the
journey). That contradicts the whole journey transformation, where the mission map is the spine.

## Goal
Re-present Library as **curriculum-first**: the sequenced mission map (arcs → missions) is the front
door; the 36-category taxonomy + 5,782-row Browse become an explicitly-labelled **Dictionary**
reference section, clearly secondary. No content is removed — only re-ordered and re-framed.

## Design (one screen, reusing existing data + screens — no duplication)
Library screen, top → bottom:

1. **Header** — "Library", subtitle reframed to "Your path to settling in — and every word behind it."

2. **Curriculum (primary):**
   - **Continue hero** — the `currentMission` (arc · level · can-do) as a prominent gold-edged card →
     `openMission(currentMission.id)`; labelled "Continue your journey" / "START HERE". (When all
     missions are done, it congratulates instead.)
   - **Arc overview** — the 7 `MISSION_ARCS` as rows: icon, title, sub, `arcDone/arcTotal`, a progress
     bar. Tapping a row → the existing **Scenarios** screen (the full mission map). This makes the
     journey the literal front door while the detailed map + mission detail stay where they are.

3. **Dictionary (reference, demoted):**
   - A clear section divider: **"Dictionary"** + sub "Every word by topic — a reference, not a path."
   - The **Browse & search** button moves here (it's a database tool).
   - The existing `libGroups` taxonomy (5 super-groups → 36 categories) renders unchanged beneath it.

## Out of scope
- Renaming the bottom-nav "Library" tab (possible follow-up).
- Rendering the full arc→mission list inline in Library (the Scenarios screen already does this; we
  link to it to avoid duplicating ~40 lines and two sources of truth).
- Any change to mission/scenario/Browse internals.

## Acceptance
- Library opens on the journey: continue-hero + arc overview above the fold; Dictionary is clearly
  labelled and below. Taxonomy + Browse still fully reachable. No horizontal overflow at 320px.
- Tests stay green; no data changes.
