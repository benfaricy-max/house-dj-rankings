// ── Monoline icon set ──────────────────────────────────────────────
// Replaces pictographic emoji used as structural icons (Data Sources, insight
// cards, ProPage venue tiers). One consistent visual language: 24-grid,
// 1.75 stroke, currentColor — themeable, crisp at any size, and renders the
// same on every OS (unlike emoji). Colour is driven by the caller via `color`
// (falls back to currentColor), matching the per-source brand hues.

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

// Each glyph is built from primitives (line/rect/circle/polyline/path) so the
// shapes are guaranteed valid and read cleanly at small sizes.
const GLYPHS = {
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><line x1="12" y1="18" x2="12" y2="21" /><line x1="8" y1="21" x2="16" y2="21" /></>,
  sliders: <><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" /><circle cx="9" cy="7" r="2" fill="currentColor" stroke="none" /><circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" /><circle cx="8" cy="17" r="2" fill="currentColor" stroke="none" /></>,
  disc: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="2.2" /></>,
  list: <><line x1="8" y1="7" x2="20" y2="7" /><line x1="8" y1="12" x2="20" y2="12" /><line x1="8" y1="17" x2="20" y2="17" /><circle cx="4.2" cy="7" r="1" fill="currentColor" stroke="none" /><circle cx="4.2" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="4.2" cy="17" r="1" fill="currentColor" stroke="none" /></>,
  trending: <><polyline points="3,16 9,10 13,14 21,6" /><polyline points="15,6 21,6 21,12" /></>,
  calendar: <><rect x="4" y="5" width="16" height="16" rx="2" /><line x1="4" y1="9" x2="20" y2="9" /><line x1="8" y1="3" x2="8" y2="6" /><line x1="16" y1="3" x2="16" y2="6" /></>,
  tent: <><path d="M12 3 3 20h18L12 3Z" /><line x1="12" y1="3" x2="12" y2="20" /><path d="M12 12 7 20" /><path d="m12 12 5 8" /></>,
  video: <><rect x="3" y="6" width="13" height="12" rx="2" /><path d="M16 10l5-3v10l-5-3Z" /></>,
  book: <><path d="M5 4h9a2 2 0 0 1 2 2v14a3 3 0 0 0-3-2H5Z" /><path d="M19 4h-1a2 2 0 0 0-2 2v12" /></>,
  rocket: <><path d="M12 3c3 1.5 5 5 5 9l-3 3h-4l-3-3c0-4 2-7.5 5-9Z" /><circle cx="12" cy="9" r="1.6" /><path d="M9 18c-1.5 1-2 3-2 3s2-.5 3-2" /><path d="M15 18c1.5 1 2 3 2 3s-2-.5-3-2" /></>,
  headphones: <><path d="M4 13a8 8 0 0 1 16 0" /><rect x="3" y="13" width="4" height="7" rx="1.5" /><rect x="17" y="13" width="4" height="7" rx="1.5" /></>,
  search: <><circle cx="11" cy="11" r="7" /><line x1="16" y1="16" x2="21" y2="21" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><line x1="3" y1="12" x2="21" y2="12" /></>,
  ticket: <><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2 2 2 0 0 0 0 8 2 2 0 0 1-2 2H5a2 2 0 0 1-2-2 2 2 0 0 0 0-8Z" /><line x1="14" y1="6" x2="14" y2="18" strokeDasharray="2 2" /></>,
  venue: <><path d="M3 21V8l9-5 9 5v13" /><line x1="3" y1="21" x2="21" y2="21" /><rect x="9" y="13" width="6" height="8" /><line x1="7" y1="9" x2="7" y2="11" /><line x1="17" y1="9" x2="17" y2="11" /></>,
  speaker: <><rect x="5" y="3" width="14" height="18" rx="2" /><circle cx="12" cy="14" r="4" /><circle cx="12" cy="7" r="1.2" fill="currentColor" stroke="none" /></>,
  music: <><path d="M9 18V6l10-2v12" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="16.5" cy="16" r="2.5" /></>,
  play: <><circle cx="12" cy="12" r="9" /><path d="M10 8.5 16 12l-6 3.5Z" fill="currentColor" stroke="none" /></>,
};

export function Icon({ name, size = 18, color, className, title, style }) {
  const glyph = GLYPHS[name];
  if (!glyph) return null;
  return (
    <svg
      viewBox="0 0 24 24" width={size} height={size}
      className={className}
      style={{ color, ...style }}
      role={title ? "img" : "presentation"}
      aria-label={title || undefined} aria-hidden={title ? undefined : true}
      {...STROKE}
    >
      {title && <title>{title}</title>}
      {glyph}
    </svg>
  );
}

// Podium medal for ranks 1–3 — a ribbon + disc with the place number, tinted
// gold / silver / bronze. Replaces the 🥇🥈🥉 emoji while keeping the at-a-glance
// podium read.
const MEDAL_TINT = { 1: "#E8C45A", 2: "#C7CBD1", 3: "#CB8B5C" };
export function Medal({ place, size = 22 }) {
  const tint = MEDAL_TINT[place];
  if (!tint) return null;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} role="img"
      aria-label={`Rank ${place}`} style={{ display: "block" }}>
      <path d="M8 2.5 6 9l3 1 3-5Z" fill={tint} opacity="0.55" />
      <path d="M16 2.5 18 9l-3 1-3-5Z" fill={tint} opacity="0.55" />
      <circle cx="12" cy="15" r="6.5" fill="none" stroke={tint} strokeWidth="1.75" />
      <text x="12" y="15" textAnchor="middle" dominantBaseline="central"
        fontSize="8" fontWeight="700" fill={tint}
        fontFamily="'IBM Plex Mono', monospace">{place}</text>
    </svg>
  );
}
