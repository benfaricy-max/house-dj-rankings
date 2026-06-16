/**
 * ra_score — recomputed from PERSISTED RA aggregates, every build.
 *
 * WHY this is its own module (was inline in fetchRA.js): ra_score used to be frozen
 * at fetch time and only carried forward by generateStatic (`prev.ra_score`). That
 * (a) baked whatever weighting was live at the last RA fetch into the snapshot and
 * (b) let ra_score drift out of sync with its own components. Recomputing it from
 * the stored aggregates on every build (like computeLiveDemand) makes the weighting
 * change immediately, keeps it consistent with the components, and is idempotent.
 *
 * WEIGHTING (v5 — devalue attending). RA "attending" is soft RSVP/"interested" data,
 * not a door count: it's festival-inflated (a festival event reports the whole-site
 * crowd, not the act's draw — Midland's avg reads 4094 against tier-2 clubs) and it
 * saturates at the 500 cap, so at the top it barely discriminates while one festival
 * gig still pegs an act to 100. So it's the LEAST reliable RA input and no longer the
 * largest. Weight moved into the HARD structural facts: venue tier (real room
 * capacity — how big are the rooms they actually play) and booking density (how often
 * they're booked). Geo footprint unchanged.
 *
 *   attending 0.40 → 0.20   (soft RSVP, festival-inflated, cap-saturated)
 *   density   0.25 → 0.35   (real booking frequency — reliable, hard to game)
 *   geo       0.20 → 0.30   (countries played — reliable footprint)
 *   venue tier 0.15 → 0.15  (left flat: boosting it rewarded big-room/festival acts
 *                            for the ROOM rather than the draw — exactly the lift we
 *                            didn't want. Frequency + footprint over capacity.)
 *
 * Pure over already-fetched fields (ra_avg_attending, ra_events_6m, ra_countries,
 * ra_venue_tier). Merge-safe: an act with no RA data (all components 0/absent) gets
 * ra_score 0 and is treated downstream exactly as before (computeLiveDemand reads it).
 */

const RA_WEIGHTS = { attend: 0.20, density: 0.35, geo: 0.30, tier: 0.15 };

// Normalization caps mirror the originals: attending/500, events/12, countries/10,
// venue tier (1–5 capacity bucket) / 5.
function computeRaScore(a) {
  const avgAttending = Number.isFinite(a.ra_avg_attending) ? a.ra_avg_attending : 0;
  const events       = Number.isFinite(a.ra_events_6m)     ? a.ra_events_6m     : 0;
  const countries    = Number.isFinite(a.ra_countries)     ? a.ra_countries     : 0;
  const tier         = Number.isFinite(a.ra_venue_tier)    ? a.ra_venue_tier    : 0;

  const attendScore  = Math.min(avgAttending / 500, 1) * 100;
  const densityScore = Math.min(events / 12, 1) * 100;
  const geoScore     = Math.min(countries / 10, 1) * 100;
  const tierScore    = (tier / 5) * 100;

  return Math.round(
    attendScore  * RA_WEIGHTS.attend +
    densityScore * RA_WEIGHTS.density +
    geoScore     * RA_WEIGHTS.geo +
    tierScore    * RA_WEIGHTS.tier
  );
}

// Recompute ra_score in place for any act that has RA aggregates. An act RA never
// found (no events, no tier, no countries) recomputes to 0 — same as before.
function recomputeRaScores(artists) {
  for (const a of artists) {
    const hasRA = (a.ra_events_6m || 0) > 0 || (a.ra_venue_tier || 0) > 0 || (a.ra_countries || 0) > 0;
    if (hasRA) a.ra_score = computeRaScore(a);
  }
  return artists;
}

module.exports = { computeRaScore, recomputeRaScores, RA_WEIGHTS };
