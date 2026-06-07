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
