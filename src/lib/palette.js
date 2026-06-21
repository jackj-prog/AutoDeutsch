// ── Palette (extracted from app.jsx — H1 modularization, step 1) ──────────────────────────────
// The build (`build-static.mjs`) concatenates src/lib/ → src/components/ → src/screens/ BEFORE
// src/app.jsx into ONE compilation unit / IIFE scope, so this `const PAL` is the very same
// module-scope binding it was inline — no import/export, shared scope. It lands first in the concat
// order, so everything in app.jsx that reads `PAL.*` (at module-load AND at render) is safe.
// See docs/MODULARIZATION-PLAN.md.
const PAL = {
  A: "#FFCC00", AD: "#CC9900", BG: "#0A0A0A", S: "#111111", SH: "#1A1A1A", B: "#2A2A2A",
  G: "#4ADE80", R: "#DD0000", T: "#F0EDE5", TD: "#97938B", BL: "#60A5FA", CARD: "#151515",
};
