import { useEffect, useRef, useState } from "react";

// Shared methodology primitives so the "how is this built?" tooltip and the
// published Momentum blend live in ONE place — used by the rankings rows, the
// artist profile, and the How It Works page. Research finding #2: a black-box
// score is a dealbreaker, so the breakdown must sit next to every number.

// Single source of truth for the Momentum blend.
export const MOMENTUM_BLEND = [
  { signal: "Google Trends slope (search acceleration)", weight: "42%", color: "#4285F4" },
  { signal: "Listener growth rate",                      weight: "25%", color: "#1DB954" },
  { signal: "Wikipedia views trend (30d vs prior 30d)",  weight: "15%", color: "#9aa0a6" },
  { signal: "Beatport position change (week/week)",      weight: "12%", color: "#a8e00f" },
  { signal: "Touring velocity (cities & shows growth)",  weight: "6%",  color: "#FF5C00" },
];

// Accessible info tooltip: hover (desktop) + click/focus (touch + keyboard),
// closes on outside-click / Escape.
export function InfoTip({ label, children }) {
  // Two independent triggers: `hover` (pointer) and `pinned` (click / focus / tap).
  // Keeping them separate means a click stays open even after the pointer leaves,
  // and works on touch where there's no hover at all.
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const ref = useRef(null);
  const open = hover || pinned;
  useEffect(() => {
    if (!pinned) return;
    const onDoc = e => { if (ref.current && !ref.current.contains(e.target)) setPinned(false); };
    const onKey = e => { if (e.key === "Escape") setPinned(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [pinned]);
  return (
    <span className="infotip" ref={ref}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button type="button" className="infotip-trigger" aria-label={label} aria-expanded={open}
        onClick={e => { e.stopPropagation(); e.preventDefault(); setPinned(true); }}
        onFocus={() => setPinned(true)} onBlur={() => setPinned(false)}>ⓘ</button>
      {open && <span className="infotip-pop" role="tooltip" onClick={e => e.stopPropagation()}>{children}</span>}
    </span>
  );
}

// The Momentum tooltip — the published blend, identical everywhere it appears.
export function MomentumTip({ dj }) {
  return (
    <InfoTip label="How momentum is calculated">
      <span className="itip-h">Momentum = rate of change, not size</span>
      {MOMENTUM_BLEND.map(f => (
        <span className="itip-row" key={f.signal}>
          <span className="itip-row-l">{f.signal.replace(/ \(.*\)/, "")}</span>
          <span className="itip-row-w" style={{ color: f.color }}>{f.weight}</span>
        </span>
      ))}
      {dj && Number.isFinite(dj.momentum_signal_count) && (
        <span className="itip-foot">{dj.momentum_signal_count} of 5 signals have data for {dj.name}{dj.momentum_confidence ? ` · ${dj.momentum_confidence} confidence` : ""}.</span>
      )}
    </InfoTip>
  );
}

// ── Form / trajectory ────────────────────────────────────────────────────────
// A categorical, at-a-glance read of an act's DIRECTION (rising / steady / cooling)
// — distinct from Momentum's magnitude. Brand belief #3: "movement, not position;
// who's accelerating is the alpha." Built only from signals that can go NEGATIVE,
// so "cooling" means real decline, not merely a low momentum score. Conservative by
// design: defaults to steady unless the signal is clear, so it never makes a bold
// wrong call on a mixed-signal act. Changes nothing in the ranking — it's context.
const clipDir = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Net direction in [-1, +1] from the signed rate-of-change signals an act has data
// for (self-healing: averages whichever are present).
export function trajectoryDirection(a) {
  const p = [];
  if (Number.isFinite(a.trends_mom_12w))               p.push(clipDir(a.trends_mom_12w / 50, -1, 1));
  if (Number.isFinite(a.spotify_follower_growth_rate)) p.push(clipDir(a.spotify_follower_growth_rate / 12, -1, 1));
  if (Number.isFinite(a.wikipedia_trend))              p.push(clipDir(a.wikipedia_trend / 50, -1, 1));
  if (Number.isFinite(a.beatport_pos_change))          p.push(clipDir(a.beatport_pos_change / 6, -1, 1));
  return p.length ? p.reduce((s, x) => s + x, 0) / p.length : null;
}

export const FORM_META = {
  rising:  { tag: "▲", label: "Rising",  color: "#C8F750" },
  steady:  { tag: "▬", label: "Steady",  color: "#9aa0a6" },
  cooling: { tag: "▼", label: "Cooling", color: "#e0894a" },
};

// Classify an act's form. Momentum (the purpose-built acceleration composite) is the
// spine for "rising"; direction supplies "cooling", since momentum can't go negative.
// Thresholds tuned against a labeled act set (rising ~17%, cooling ~9% of the field).
export function artistForm(a) {
  if (!a) return null;
  const M = Number.isFinite(a.momentum_score) ? a.momentum_score : null;
  const D = trajectoryDirection(a);
  if (M === null && D === null) return null;                                  // no signal → no chip
  if (M !== null && M >= 58) return "rising";                                 // clearly accelerating
  if ((M !== null && M <= 12) || (D !== null && D <= -0.25 && (M === null || M < 45))) return "cooling";
  if (D !== null && D >= 0.45 && (M === null || M >= 45)) return "rising";     // strong warming w/o high momentum
  return "steady";
}

// The Form tooltip — explains the read so ▲/▬/▼ never looks like an opaque verdict.
export function FormTip({ dj }) {
  if (!artistForm(dj)) return null;
  return (
    <InfoTip label="What 'form' means">
      <span className="itip-h">Form = direction, not size</span>
      <span className="itip-note">Whether booking demand is accelerating (▲ Rising), holding (▬ Steady) or fading (▼ Cooling) — read from the rate-of-change signals (12-week search trend, listener growth, Wikipedia trend, Beatport movement) plus the Momentum score. It's context only; it doesn't move the ranking.</span>
    </InfoTip>
  );
}

// ── Scene geography (international appeal) ────────────────────────────────────
// Two genuinely different axes, kept separate on purpose:
//   • BOOKING footprint — where an act is actually booked (RA top regions). A
//     European tech-house act tours Ibiza/Berlin/Amsterdam even if huge in the US.
//   • AUDIENCE geography — where the listeners are (Spotify top cities, the real
//     "international appeal" read; Google Trends countries as a sparse fallback).
// An act can be Euro-booked but US-listened — that gap is the insight, so we never
// collapse the two into one number. Core = the electronic-music credibility markets.
const CORE_COUNTRIES = new Set(["Spain","Germany","Netherlands","United Kingdom","Italy","France","Belgium","Croatia","Switzerland","Austria","Georgia","Serbia","Czechia","Czech Republic","Portugal","Greece","Poland","Ireland"]);
// Spotify top-cities use ISO-3166 alpha-2 country codes; Trends/RA use full names.
const CORE_COUNTRY_CODES = new Set(["GB","DE","NL","IT","FR","ES","BE","HR","CH","AT","GE","RS","CZ","PT","GR","PL","IE"]);
const CORE_CITIES = new Set(["Ibiza","Berlin","Amsterdam","London","Barcelona","Milan","Paris","Brussels","Manchester","Naples","Rome","Cologne","Frankfurt","Hamburg","Munich","Tbilisi","Belgrade","Zurich","Vienna","Madrid","Rotterdam","Bristol","Glasgow","Leeds","Lisbon","Athens","Warsaw","Prague","Lyon","Valencia","Sheffield","Nottingham","Dublin"]);

const geoCategory = s => s >= 60 ? "Euro-core" : s >= 38 ? "Global" : "US / Anglo-led";
const GEO_COLOR = { "Euro-core": "#C8F750", "Global": "#9aa0a6", "US / Anglo-led": "#e0894a" };

// Booking footprint from RA top regions (city-level). Returns null if no data.
function bookingGeo(dj) {
  const regs = Array.isArray(dj?.ra_top_regions) ? dj.ra_top_regions : [];
  if (!regs.length) return null;
  const hits = regs.filter(r => CORE_CITIES.has(r.name) || CORE_COUNTRIES.has(r.country)).map(r => r.name);
  const score = Math.round((hits.length / regs.length) * 100);
  return { score, category: geoCategory(score), hits, color: GEO_COLOR[geoCategory(score)] };
}

// Audience geography — prefer Spotify top cities (populated by enrichSpotifyGeo via
// the Interceptor); fall back to the sparser/noisier Trends-by-country data.
function audienceGeo(dj) {
  const cities = Array.isArray(dj?.spotify_top_cities) ? dj.spotify_top_cities : [];
  if (cities.length) {
    let core = 0, tot = 0; const hits = [];
    for (const c of cities) {
      const n = c.listeners || c.numberOfListeners || 1; tot += n;
      if (CORE_CITIES.has(c.city) || CORE_COUNTRY_CODES.has(c.country) || CORE_COUNTRIES.has(c.country)) { core += n; hits.push(c.city); }
    }
    const score = Math.round(tot ? (core / tot) * 100 : 0);
    return { score, category: geoCategory(score), hits, color: GEO_COLOR[geoCategory(score)], source: "Spotify cities", top: cities.slice(0, 5).map(c => c.city) };
  }
  const tr = dj?.google_trends_countries_raw || {};
  const ent = Object.entries(tr);
  if (!ent.length) return null;
  let core = 0, tot = 0; const hits = [];
  for (const [c, v] of ent) { tot += v; if (CORE_COUNTRIES.has(c)) { core += v; hits.push(c); } }
  const score = Math.round(tot ? (core / tot) * 100 : 0);
  return { score, category: geoCategory(score), hits, color: GEO_COLOR[geoCategory(score)], source: "search interest", top: ent.sort((a,b)=>b[1]-a[1]).slice(0,5).map(([c])=>c) };
}

// Combined read for the markets strip + (later) a weighted scene_geography signal.
export function sceneGeography(dj) {
  const booking = bookingGeo(dj);
  const audience = audienceGeo(dj);
  if (!booking && !audience) return null;
  return { booking, audience };
}

// Single source of truth for the demand index behind the Price/Demand Gap.
// LIVE-LED (mirrors backend enrichValueGap.js SIGNALS): bookers told us global
// digital metrics are noise until they line up with the rooms you fill and the
// tickets you move, so live/local signals carry ~0.66 of the weight and digital
// reach only corroborates.
export const DEMAND_BLEND = [
  { signal: "Venue size commanded (room tier)",     weight: "24%", color: "#FF5C00" },
  { signal: "Live draw per show (RA attendance)",   weight: "22%", color: "#FF5C00" },
  { signal: "Streaming reach (monthly listeners)",  weight: "16%", color: "#1DB954" },
  { signal: "Streaming→live conversion",            weight: "12%", color: "#C8F750" },
  { signal: "Beatport chart credibility",           weight: "12%", color: "#a8e00f" },
  { signal: "Tour routing breadth",                 weight: "8%",  color: "#4fd6e8" },
  { signal: "Search interest + YouTube",            weight: "6%",  color: "#4285F4" },
];

// The Value Gap tooltip — explains the buy/sell signal in plain language so
// "underpriced" never reads as a black-box claim (research finding #2).
export function ValueGapTip({ dj }) {
  return (
    <InfoTip label="How the price-vs-demand gap is calculated">
      <span className="itip-h">Demand-implied fee vs. the asking fee</span>
      <span className="itip-note">We build a demand index, map it to the same fee tiers the market uses, then compare to the act's known fee. The gap is the difference in tiers — it never sees the fee while scoring.</span>
      {DEMAND_BLEND.map(f => (
        <span className="itip-row" key={f.signal}>
          <span className="itip-row-l">{f.signal}</span>
          <span className="itip-row-w" style={{ color: f.color }}>{f.weight}</span>
        </span>
      ))}
      {dj && dj.demand_fee_label && dj.booking_fee && (
        <span className="itip-foot">Demand implies {dj.demand_fee_label} vs. the current {dj.booking_fee.label} band.</span>
      )}
    </InfoTip>
  );
}
