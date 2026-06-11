/**
 * HeroLive — the live data band under the masthead.
 *
 * A data product's hero should BE the data, not a sentence about it. This shows,
 * above the fold: a proof strip (how big / how many signals / how fresh) and the
 * live "who's moving" read — the brand's core thesis that movement is the signal,
 * not position. It prefers real rank climbers once daily rank-history has accrued
 * (rank_change), and falls back to top momentum (always present) before then.
 *
 * No new data and no App internals — reads the rankings array it's handed and
 * deep-links each act to its shareable profile.
 */
import { slugify } from "./ArtistProfile";

const num = (v) => (Number.isFinite(v) ? v : 0);

export default function HeroLive({ rankings, lastUpdated, onExplore }) {
  if (!Array.isArray(rankings) || !rankings.length) return null;

  const signals = num(rankings[0]?.signals_total) || 13;
  const updated = lastUpdated
    ? new Date(lastUpdated).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
    : null;

  // Prefer real rank climbers; fall back to highest momentum (accelerating acts).
  const climbers = rankings
    .filter((d) => num(d.rank_change) > 0)
    .sort((a, b) => num(b.rank_change) - num(a.rank_change))
    .slice(0, 5);

  const usingClimbers = climbers.length >= 3;
  const movers = usingClimbers
    ? climbers
    : rankings
        .filter((d) => num(d.momentum_score) > 0)
        .sort((a, b) => num(b.momentum_score) - num(a.momentum_score))
        .slice(0, 5);

  const label = usingClimbers ? "This week's movers" : "Accelerating now";
  const badge = (d) =>
    usingClimbers ? `▲${num(d.rank_change)}` : `${Math.round(num(d.momentum_score))}`;

  return (
    <section className="hero-live" aria-label="Live index summary">
      <div className="hl-proof">
        <span className="hl-stat"><b>{rankings.length}</b> acts</span>
        <span className="hl-dot" aria-hidden="true">·</span>
        <span className="hl-stat"><b>{signals}</b> signals</span>
        <span className="hl-dot" aria-hidden="true">·</span>
        <span className="hl-stat">{updated ? `refreshed ${updated}` : "refreshed daily"}</span>
      </div>

      {movers.length > 0 && (
        <div className="hl-movers">
          <span className="hl-eyebrow">{label}</span>
          <div className="hl-mover-row">
            {movers.map((d) => (
              <a key={d.name} className="hl-mover" href={`#/artist/${slugify(d.name)}`}>
                <span className="hl-mv-name">{d.name}</span>
                <span className="hl-mv-delta" aria-label={usingClimbers ? "positions gained" : "momentum"}>
                  {usingClimbers ? "" : "▲"}{badge(d)}
                </span>
              </a>
            ))}
          </div>
          {onExplore && (
            <button className="hl-explore" onClick={() => onExplore("rankings")}>
              See the full index →
            </button>
          )}
        </div>
      )}
    </section>
  );
}
