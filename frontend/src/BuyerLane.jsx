/**
 * BuyerLane — a "for buyers" band for the homepage hero.
 *
 * WHY (June 2026 research panel): every professional persona said the front door
 * "sells the magazine, not the tool." The homepage answers "who's hot"; a buyer's
 * actual job is "who's underpriced for MY city and MY budget, right now." This
 * component is that lane — it turns the open ranking into a buyer entry point
 * without paywalling anything (neutrality moat intact; STRATEGY.md §3).
 *
 * Drop-in & additive: pure read of the rankings array already loaded by App.
 * No new data, no network, defensive about missing fields. Navigates to the
 * existing Value Gap report route (#/value/<slug>) — the wedge artifact (GTM.md §3).
 *
 * Wiring (see docs/HOMEPAGE-REPOSITION.md): import and render it once, just under
 * the hero <h1>, passing the ranked list:
 *     import BuyerLane from "./BuyerLane";
 *     <BuyerLane rankings={rankings} />
 */
import { useMemo, useState } from "react";
import { slugify } from "./artistLink";  // canonical slug — must match the /value/<slug> prerender (NFD, strips combining marks). A local NFKD copy mangled accented names (Sven Väth -> sven-va-th) and 404'd.
import "./BuyerLane.css";

// Fee-band filter options map to booking_fee.tier (computeFees.js BANDS).
const BAND_FILTERS = [
  { id: "all", label: "Any budget", test: () => true },
  { id: "lt10", label: "Under £10k", test: (t) => t <= 2 },
  { id: "10to40", label: "£10k–£40k", test: (t) => t >= 3 && t <= 4 },
  { id: "gt40", label: "£40k+", test: (t) => t >= 5 },
];

export default function BuyerLane({ rankings = [], onOpenValue }) {
  const [region, setRegion] = useState("all");
  const [band, setBand] = useState("all");

  // Regions a buyer would recognise — derived from where acts are actually booked.
  // ra_top_regions is [{name, country}] (cities — most useful to a buyer);
  // ra_country_list is [string]. tour_countries is a COUNT (number), not a list —
  // never iterate it. actRegions() normalises any act to a flat string[] of places.
  const actRegions = (a) => {
    const out = [];
    for (const r of (Array.isArray(a.ra_top_regions) ? a.ra_top_regions : [])) {
      const name = (r && typeof r === "object" ? r.name : r);
      if (name) out.push(String(name).trim());
    }
    for (const r of (Array.isArray(a.ra_country_list) ? a.ra_country_list : [])) {
      if (r) out.push(String(r).trim());
    }
    return out;
  };

  const regions = useMemo(() => {
    const counts = {};
    for (const a of rankings) {
      for (const key of actRegions(a)) counts[key] = (counts[key] || 0) + 1;
    }
    return Object.entries(counts)
      .filter(([, n]) => n >= 4) // only regions with enough acts to be useful
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([r]) => r);
  }, [rankings]);

  const bandTest = (BAND_FILTERS.find((b) => b.id === band) || BAND_FILTERS[0]).test;

  const picks = useMemo(() => {
    const inRegion = (a) => {
      if (region === "all") return true;
      return actRegions(a).includes(region);
    };
    return rankings
      .filter((a) => a.value_signal === "strong-buy" || a.value_signal === "buy")
      .filter((a) => bandTest((a.booking_fee && a.booking_fee.tier) || 0))
      .filter(inRegion)
      .sort(
        (x, y) =>
          (y.value_signal === "strong-buy") - (x.value_signal === "strong-buy") ||
          (y.value_gap_pct || y.value_gap || 0) - (x.value_gap_pct || x.value_gap || 0) ||
          (y.momentum_score || 0) - (x.momentum_score || 0)
      )
      .slice(0, 6);
  }, [rankings, region, band, bandTest]);

  const open = (a) => {
    const slug = slugify(a.name);
    if (onOpenValue) onOpenValue(slug);
    else window.location.hash = `#/value/${slug}`;
  };

  return (
    <section className="bl" aria-label="For buyers — who's underpriced right now">
      <div className="bl-head">
        <span className="bl-tag">For buyers</span>
        <h2 className="bl-title">Who's underpriced right now</h2>
        <p className="bl-sub">
          The neutral read for the offer you're about to make — fee band vs. what demand implies.
          No agency, no act, no kickback. Free.
        </p>
      </div>

      <div className="bl-filters" role="group" aria-label="Filter by region and budget">
        <select className="bl-select" value={region} onChange={(e) => setRegion(e.target.value)} aria-label="Region">
          <option value="all">Any region</option>
          {regions.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <div className="bl-bands">
          {BAND_FILTERS.map((b) => (
            <button
              key={b.id}
              className={`bl-band ${band === b.id ? "is-on" : ""}`}
              onClick={() => setBand(b.id)}
              aria-pressed={band === b.id}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {picks.length === 0 ? (
        <p className="bl-empty">No underpriced reads match that filter right now — widen the budget or region.</p>
      ) : (
        <ul className="bl-list">
          {picks.map((a) => {
            const gap = a.value_gap_pct != null ? `+${a.value_gap_pct}%` : null;
            return (
              <li key={a.name}>
                <button className="bl-row" onClick={() => open(a)}>
                  <span className="bl-sig" data-strong={a.value_signal === "strong-buy"}>
                    {a.value_signal === "strong-buy" ? "◆ Strong buy" : "▲ Underpriced"}
                  </span>
                  <span className="bl-name">{a.name}</span>
                  <span className="bl-fee">
                    <b>{a.booking_fee && a.booking_fee.label}</b>
                    <span className="bl-arrow">→</span>
                    {a.demand_fee_label || "demand-implied"}
                    {gap && <span className="bl-gap">{gap}</span>}
                  </span>
                  <span className="bl-cta">See the read</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="bl-foot">
        Estimated fee bands until verified — the demand side is RA bookings, Beatport, search &amp; streaming.{" "}
        <a href="#/methodology">How we read it →</a>
      </p>
    </section>
  );
}
