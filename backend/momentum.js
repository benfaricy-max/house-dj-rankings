/**
 * Momentum Score — the core differentiator. Ranks who is ACCELERATING relative
 * to their own baseline, not who is biggest. A standalone 0-100 metric (separate
 * from the overall rank) blended from rate-of-change signals:
 *
 *   - Google Trends slope        (trends_mom_12w / trends_mom_4w)   — search acceleration
 *   - Listener growth            (follower_growth_rate, listener_daily_delta)
 *   - Wikipedia views trend      (wikipedia_trend, recent vs prior) — public interest slope
 *   - Beatport position change   (beatport_pos_change, week-over-week) — chart climb
 *   - Touring velocity           (tour_velocity, cities/shows growth) — booking acceleration
 *
 * Robust + honest: each component is normalized across the field; an artist's
 * momentum is the weighted average of ONLY the components it has data for
 * (weights renormalized per artist). Artists with no rate-of-change data at all
 * get momentum_score = null and are excluded from the momentum leaderboard,
 * we never fabricate acceleration from a static snapshot.
 */
const clip = (v, lo, hi) => Math.max(lo, Math.min(v, hi));

const COMPONENTS = [
  { key: "trends",   weight: 0.42, get: a => {
      const mo = firstFinite(a.trends_mom_12w, a.trends_mom_4w);
      if (mo == null) return null;
      // Gate: a huge % spike on a near-zero search base is noise, not momentum.
      if ((a.google_trends_score || 0) < 8) return null;
      return clip(mo, -100, 300);                 // clip outliers so one spike can't peg the scale
    } },
  { key: "listener", weight: 0.25, get: a => {
      const v = firstFinite(a.listener_daily_delta, a.spotify_follower_growth_rate);
      return v == null ? null : clip(v, -100, 100);
    } },
  { key: "wiki",     weight: 0.15, get: a => {
      const t = firstFinite(a.wikipedia_trend);
      if (t == null) return null;
      if ((a.wikipedia_pageviews || 0) < 2000) return null;   // tiny-article noise gate
      return clip(t, -100, 300);
    } },
  { key: "beatport", weight: 0.12, get: a => firstFinite(a.beatport_pos_change) },
  { key: "tour",     weight: 0.06, get: a => firstFinite(a.tour_velocity) },
];

function firstFinite(...vals) {
  for (const v of vals) if (Number.isFinite(v) && v !== 0) return v;
  return null;
}
function norm(v, min, max) { return max === min ? 50 : ((v - min) / (max - min)) * 100; }

function computeMomentum(artists) {
  // Field-wide min/max per component over artists that have the signal.
  const ranges = {};
  for (const c of COMPONENTS) {
    const vals = artists.map(c.get).filter(v => v != null);
    ranges[c.key] = vals.length >= 5
      ? { min: Math.min(...vals), max: Math.max(...vals), live: true }
      : { live: false };           // too sparse to be meaningful → skip this component
  }

  for (const a of artists) {
    // Base gate: momentum is only meaningful with a real audience to accelerate.
    // Below ~50k monthly listeners, a big % spike is almost always namesake/noise
    // (e.g. a DJ sharing a name with an author). Matches the booker's mental model.
    if ((a.spotify_monthly_listeners || 0) < 50000) { a.momentum_score = null; a.momentum_parts = null; continue; }
    let scoreSum = 0, weightSum = 0;
    const parts = {};
    for (const c of COMPONENTS) {
      if (!ranges[c.key].live) continue;
      const raw = c.get(a);
      if (raw == null) continue;
      const n = Math.max(0, Math.min(100, norm(raw, ranges[c.key].min, ranges[c.key].max)));
      parts[c.key] = Math.round(n);
      scoreSum += n * c.weight;
      weightSum += c.weight;
    }
    const signalCount = Object.keys(parts).length;
    a.momentum_score        = weightSum > 0 ? Math.round(scoreSum / weightSum) : null;
    a.momentum_updated      = weightSum > 0 ? new Date().toISOString() : a.momentum_updated ?? null;
    a.momentum_parts        = weightSum > 0 ? parts : null;
    a.momentum_signal_count = weightSum > 0 ? signalCount : null;
    a.momentum_confidence   = weightSum > 0
      ? (signalCount >= 3 ? "high" : signalCount === 2 ? "medium" : "low")
      : null;
  }
  return artists;
}

module.exports = { computeMomentum };
