/**
 * Routing-Saturation alert — the booker's "will this feel fresh in MY market?"
 * check. Bookers (Cookiy AI research) said a global demand number is useless
 * until they know how hard the artist has been touring their own region: an act
 * that just played your city three times in two months won't sell tickets again
 * at the same fee. Built from ra_recent_cities (per-city recent shows + recency
 * + RA's saturation index), aggregated to region/country level.
 */

// Aggregate recent shows (last ~90d, from RA) by country. Returns regions sorted
// by recent show count, each with a saturation level a booker can act on.
export function computeRouting(dj) {
  const cities = Array.isArray(dj?.ra_recent_cities) ? dj.ra_recent_cities : [];
  if (!cities.length) return null;
  const byCountry = {};
  for (const c of cities) {
    const k = c.country || "—";
    const r = (byCountry[k] ||= { country: k, shows: 0, cities: new Set(), minDays: Infinity, satMax: 0 });
    r.shows += c.shows_3m || c.shows || 0;
    if (c.city) r.cities.add(c.city);
    if (Number.isFinite(c.days_since)) r.minDays = Math.min(r.minDays, c.days_since);
    if (Number.isFinite(c.saturation)) r.satMax = Math.max(r.satMax, c.saturation);
  }
  const regions = Object.values(byCountry)
    .map(r => ({
      country: r.country,
      shows: r.shows,
      cities: r.cities.size,
      lastDays: Number.isFinite(r.minDays) ? r.minDays : null,
      saturation: r.satMax,
      level: r.shows >= 4 ? "heavy" : r.shows >= 2 ? "active" : "light",
    }))
    .sort((a, b) => b.shows - a.shows || (a.lastDays ?? 999) - (b.lastDays ?? 999));
  const total = regions.reduce((s, r) => s + r.shows, 0);
  return { regions, total, topHeavy: regions.find(r => r.level === "heavy") || null };
}

const LEVEL_LABEL = { heavy: "Heavy rotation", active: "Active", light: "Light" };

export default function RoutingSaturation({ dj, max = 4, compact = false }) {
  const data = computeRouting(dj);
  if (!data || !data.regions.length) return null;
  const regions = data.regions.slice(0, max);
  return (
    <div className={`routing-sat${compact ? " routing-sat--compact" : ""}`}>
      <div className="routing-sat-head">
        <span className="routing-sat-dot" />
        Recent routing
        <span className="routing-sat-sub">{data.total} shows · last ~90 days</span>
      </div>
      <div className="routing-sat-rows">
        {regions.map(r => (
          <div key={r.country} className={`routing-row routing-row--${r.level}`}>
            <span className="routing-region">{r.country}</span>
            <span className="routing-count">
              {r.shows}× {r.cities > 1 ? `· ${r.cities} cities` : ""}
            </span>
            {r.lastDays != null && <span className="routing-recency">last {r.lastDays}d ago</span>}
            <span className={`routing-level routing-level--${r.level}`}>{LEVEL_LABEL[r.level]}</span>
          </div>
        ))}
      </div>
      {data.topHeavy && (
        <div className="routing-sat-flag">
          ⚠ Heavily routed in {data.topHeavy.country} ({data.topHeavy.shows} recent shows) —
          a date here will feel less exclusive; price/pitch accordingly.
        </div>
      )}
    </div>
  );
}
