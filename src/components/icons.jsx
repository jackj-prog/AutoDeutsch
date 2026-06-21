// ── Icon system (extracted from app.jsx — H1 modularization, step 2) ─────────────────────
// SVG path map + the <Icon>/<IconBadge>/<ProgressIcon> primitives + the tap-driven micro-animation
// engine. Concatenated by build-static.mjs after src/lib/ (so PAL is already defined) and before
// src/app.jsx (so every screen sees these), all in one shared IIFE scope. No import/export.
// See docs/MODULARIZATION-PLAN.md.
const ICONS = {
  settings: "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  play: "M8 5v14l11-7-11-7Z",
  pause: "M8 5h3v14H8V5Zm5 0h3v14h-3V5Z",
  skipBack: "M19 5v14l-9-7 9-7ZM5 5v14",
  skipForward: "M5 5v14l9-7-9-7ZM19 5v14",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  arrowLeft: "M19 12H5M11 6l-6 6 6 6",
  x: "M18 6 6 18M6 6l12 12",
  refresh: "M20 6v5h-5M4 18v-5h5M18.5 9a7 7 0 0 0-12-2.5L4 9m16 6-2.5 2.5A7 7 0 0 1 5.5 15",
  book: "M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2V4Zm20 0h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7V4Z",
  layers: "M12 3 3 8l9 5 9-5-9-5Zm-7 9 7 4 7-4M5 16l7 4 7-4",
  headphones: "M4 13a8 8 0 0 1 16 0v5a2 2 0 0 1-2 2h-2v-7h4M4 13h4v7H6a2 2 0 0 1-2-2v-5Z",
  keyboard: "M4 7h16v10H4V7Zm3 3h.01M10 10h.01M13 10h.01M16 10h.01M7 14h10",
  target: "M12 3v3M12 18v3M3 12h3M18 12h3M7.5 7.5l2.1 2.1M14.4 14.4l2.1 2.1M16.5 7.5l-2.1 2.1M9.6 14.4l-2.1 2.1M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
  calendar: "M7 3v3M17 3v3M4 8h16M5 5h14v16H5V5Z",
  clock: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 4v4l3 2",
  chart: "M3 3v18h18M8 17v-6m4.5 6V7m4.5 10v-3.5",
  check: "M20 6 9 17l-5-5",
  shield: "M12 3 5 6v5c0 4.5 2.8 8 7 10 4.2-2 7-5.5 7-10V6l-7-3Z",
  wifi: "M5 10a10 10 0 0 1 14 0M8 13a6 6 0 0 1 8 0M11 16a2 2 0 0 1 2 0M12 19h.01",
  save: "M5 4h12l2 2v14H5V4Zm3 0v6h8V4M8 20v-6h8v6",
  upload: "M12 16V4M7 9l5-5 5 5M5 20h14",
  download: "M12 4v12M7 11l5 5 5-5M5 20h14",
  volume: "M4 10v4h4l5 4V6l-5 4H4Zm13-2a5 5 0 0 1 0 8M19 5a9 9 0 0 1 0 14",
  mic: "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3ZM19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 23h8",
  plane: "M17.8 19.2 16 11l3.5-3.5c1.5-1.5 2-3.5 1.5-4.5-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.6c-.2.4-.1.9.3 1.2L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 4.3c.3.4.8.5 1.2.3l.6-.3c.4-.2.6-.6.5-1.1Z",
  card: "M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7ZM2 10h20",
  home: "m3 10 9-7 9 7v10a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2V10Z",
  users: "M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm12.5 10v-2a4 4 0 0 0-3-3.85M16 3.15a4 4 0 0 1 0 7.7",
  heart: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z",
  hand: "M7 11V6a2 2 0 0 1 4 0v5M11 10V5a2 2 0 0 1 4 0v6M15 11V7a2 2 0 0 1 4 0v5c0 5-3 8-7 8h-1a6 6 0 0 1-6-6v-3a2 2 0 0 1 4 0v2",
  utensils: "M6 3v8M4 3v5a2 2 0 0 0 4 0V3M6 11v10M15 3v18M18 3v7a3 3 0 0 1-3 3",
  sofa: "M5 12V9a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3M4 12h16v6H4v-6Zm2 6v2m12-2v2",
  medical: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 5v8M8 12h8",
  smile: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16ZM9 10h.01M15 10h.01M8.5 14a5 5 0 0 0 7 0",
  megaphone: "M4 10v4h4l9 4V6l-9 4H4Zm4 4v5M17 9a4 4 0 0 1 0 6",
  cart: "M2.5 3h2l2.7 12.4a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L21.5 7H6M9 20.5h.01M18 20.5h.01",
  grid: "M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z",
  alert: "M12 3 2 21h20L12 3Zm0 6v5m0 3h.01",
  calendarCheck: "M7 3v3M17 3v3M4 8h16M5 5h14v16H5V5Zm4 10 2 2 4-5",
  palette: "M12 4a8 8 0 0 0 0 16h1.5a2 2 0 0 0 1.4-3.4l-.3-.3a1 1 0 0 1 .7-1.7H17a5 5 0 0 0 0-10H12ZM7.5 11h.01M9.5 8h.01M13 7.5h.01",
  bolt: "M13 2 4 14h7l-1 8 9-12h-7l1-8Z",
  cloud: "M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11-2A5 5 0 0 0 7 18Z",
  map: "M9 18 4 20V6l5-2 6 2 5-2v14l-5 2-6-2Zm0 0V4m6 16V6",
  briefcase: "M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Zm0 4h18",
  message: "M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.6 0-3.1-.4-4.4-1.2L3 20l1.2-5.1A8.5 8.5 0 1 1 21 11.5Z",
  chip: "M8 8h8v8H8V8Zm-4 3h4M4 15h4M16 11h4M16 15h4M11 4v4M15 4v4M11 16v4M15 16v4",
  trophy: "M8 4h8v3a4 4 0 0 1-8 0V4Zm0 1H5a3 3 0 0 0 3 5M16 5h3a3 3 0 0 1-3 5M12 11v5M9 20h6M10 16h4",
  link: "M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1",
  // Solid fire: a strong filled flame with an inner-flame cutout — reads as a real
  // flame at streak size, unlike the previous thin outline.
  flame: "M12.96 2.29a.75.75 0 0 0-1.07-.14A9.74 9.74 0 0 0 8.35 8.33 7.55 7.55 0 0 1 6.65 6.6a.75.75 0 0 0-1.16-.08A9 9 0 1 0 15.68 4.53a7.46 7.46 0 0 1-2.72-2.24ZM15.75 14.25a3.75 3.75 0 1 1-7.31-1.17c.63.46 1.35.8 2.13 1a5.99 5.99 0 0 1 1.93-3.55 3.75 3.75 0 0 1 3.25 3.72Z",
  chevron: "M6 9l6 6 6-6",
  // ── Category icons (added so every Library category gets a distinct, literal glyph) ──
  car: "M5 11l1.6-4.8A2 2 0 0 1 8.5 5h7a2 2 0 0 1 1.9 1.2L20 11M4 11h16a1 1 0 0 1 1 1v4h-3M7 16H3v-4a1 1 0 0 1 1-1M7 16h10M6 16a2 2 0 1 0 4 0 2 2 0 0 0-4 0Zm8 0a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z",
  leaf: "M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10ZM2 21c0-3 1.85-5.36 5.08-6C9.5 14.5 12 13 13 12",
  pot: "M4 11h16v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-5ZM2 11h20M9 7c.7-1 .2-2-.3-3M15 7c.7-1 .2-2-.3-3",
  wrench: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9l-3.8 3.8Z",
  scale: "M12 3v18M7 21h10M3 7h4c2 0 4-1 5-2 1 1 3 2 5 2h4M5 7l-3 7c.9.7 1.9 1 3 1s2.1-.3 3-1L5 7Zm14 0-3 7c.9.7 1.9 1 3 1s2.1-.3 3-1l-3-7Z",
  quote: "M9 7H5a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2l-1 4M21 7h-4a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2l-1 4",
  user: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  bank: "M12 3 4 7h16L12 3ZM4 10v9M8 10v9M12 10v9M16 10v9M20 10v9M3 21h18M3 10h18",
  shirt: "M16 3l4.4 1.5a2 2 0 0 1 1.3 2.2l-.6 3.5a1 1 0 0 1-1 .8H18v9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-9H4.9a1 1 0 0 1-1-.8l-.6-3.5a2 2 0 0 1 1.3-2.2L8 3a4 4 0 0 0 8 0Z",
  key: "M7 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM10 10h10M16 10v3M20 10v3",
  mail: "M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM22 7l-10 7L2 7",
  file: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5ZM14 3v5h5M9 13h6M9 17h6",
  wine: "M8 22h8M12 14v8M7 3h10l-.7 5.2a4.3 4.3 0 0 1-8.6 0L7 3Z",
  flake: "M12 2v20M3.34 7l17.32 10M3.34 17l17.32-10M12 2l-2.5 2.5M12 2l2.5 2.5M12 22l-2.5-2.5M12 22l2.5-2.5M3.34 7l.4 3.4M3.34 7l3.4-.4M20.66 17l-.4-3.4M20.66 17l-3.4.4M20.66 7l-3.4-.4M20.66 7l-.4 3.4M3.34 17l3.4.4M3.34 17l.4-3.4",
};

// Glyph icons that read better as solid silhouettes than hollow outlines. Everything
// else stays line-art (stroke 2) for a consistent, principled icon system.
const SOLID_ICONS = new Set(["flame", "play", "pause"]);
const Icon = React.memo(({ name, size = 18, stroke = 2, style }) => {
  const solid = SOLID_ICONS.has(name);
  return (
    <svg data-ico={name} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" style={{ display: "block", flexShrink: 0, transformBox: "fill-box", transformOrigin: "center", ...style }}>
      <path d={ICONS[name] || ICONS.book} fill={solid ? "currentColor" : "none"} stroke={solid ? "none" : "currentColor"} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" fillRule="evenodd" clipRule="evenodd" />
    </svg>
  );
});

const IconBadge = React.memo(({ name, color = PAL.A, bg, size = 32 }) => (
  <span style={{ width: size, height: size, borderRadius: Math.round(size * 0.34), display: "inline-flex", alignItems: "center", justifyContent: "center", color, background: bg || `linear-gradient(180deg, ${color}1F 0%, ${color}08 100%)`, border: `1px solid ${color}26`, boxShadow: `inset 0 1px 0 ${color}14`, flexShrink: 0 }}>
    <Icon name={name} size={Math.max(15, size - 15)} />
  </span>
));

// Progress nav icon — three ascending bars. When the tab is active they rise from the
// baseline in sequence (keyed remount replays it), signifying progress/growth.
const ProgressIcon = React.memo(({ size = 21, color = PAL.TD, active }) => {
  const bars = [{ x: 4, h: 7 }, { x: 10, h: 12 }, { x: 16, h: 17 }];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ display: "block" }}>
      {bars.map((b, i) => (
        <rect key={(active ? "a" : "s") + i} x={b.x} y={21 - b.h} width="4" height={b.h} rx="1.4" fill={color}
          className={active ? "ad-bar-rise" : undefined}
          style={active ? { transformBox: "fill-box", transformOrigin: "bottom", animationDelay: `${i * 0.12}s` } : undefined} />
      ))}
    </svg>
  );
});

// ── Tap-driven icon micro-animations ──────────────────────────────────────────
// Every icon-bearing button springs to life in-character when tapped — the energy the
// Progress bars already have, extended app-wide. A single delegated listener (see the App
// effect) runs the matching Web-Animations keyframe on the tapped icon's <svg>, so no call
// site needs wiring and a React re-render mid-click can't cut the animation short (it lives
// on the DOM node, not on a className). Single-path stroke icons can't truly morph, so the
// vocabulary is transform-based: spin / drop / build / swing / pulse / beat, default pop.
const ICO_ANIM = {
  settings: "spin", refresh: "spin",
  bolt: "drop",
  home: "build", chart: "build", bank: "build", briefcase: "build", chip: "build",
  book: "swing", key: "swing", hand: "swing", file: "swing", mail: "swing",
  volume: "pulse", headphones: "pulse", mic: "pulse", megaphone: "pulse", message: "pulse", bell: "pulse",
  heart: "beat", flame: "beat", trophy: "beat", flake: "beat",
};
const ICO_KEYFRAMES = {
  spin:  [{ transform: "rotate(0deg)" }, { transform: "rotate(180deg)" }],
  drop:  [{ transform: "translateY(-3px)", opacity: 0.5 }, { transform: "translateY(2px)", opacity: 1 }, { transform: "translateY(0)" }],
  build: [{ transform: "translateY(3px) scale(0.8)", opacity: 0.3 }, { transform: "translateY(0) scale(1)", opacity: 1 }],
  swing: [{ transform: "rotate(0deg)" }, { transform: "rotate(-16deg)" }, { transform: "rotate(11deg)" }, { transform: "rotate(0deg)" }],
  pulse: [{ transform: "scale(1)" }, { transform: "scale(1.18)" }, { transform: "scale(1)" }],
  beat:  [{ transform: "scale(1)" }, { transform: "scale(1.26)" }, { transform: "scale(0.94)" }, { transform: "scale(1)" }],
  pop:   [{ transform: "scale(1)" }, { transform: "scale(1.28)" }, { transform: "scale(1)" }],
};
const ICO_TIMING = { spin: 500, drop: 430, build: 420, swing: 540, pulse: 360, beat: 440, pop: 340 };
const ICO_EASE = { spin: "cubic-bezier(.34,1.18,.4,1)", swing: "cubic-bezier(.36,.07,.19,.97)", pop: "cubic-bezier(.2,.7,.3,1.3)", beat: "ease-out", pulse: "ease-out", drop: "cubic-bezier(.3,1.5,.5,1)", build: "cubic-bezier(.2,.8,.3,1.1)" };
function playIconTap(svg) {
  if (!svg || typeof svg.animate !== "function") return;
  const type = ICO_ANIM[svg.getAttribute("data-ico")] || "pop";
  try { if (svg.__ico) svg.__ico.cancel(); } catch (e) {}
  try { svg.__ico = svg.animate(ICO_KEYFRAMES[type], { duration: ICO_TIMING[type], easing: ICO_EASE[type] || "ease-out" }); } catch (e) {}
}
