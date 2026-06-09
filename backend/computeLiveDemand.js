/**
 * Live-demand blend — so the leading booking signal isn't single-sourced on RA.
 *
 * RA (Resident Advisor) is the richest live signal we have (venue tier, attendance,
 * geo spread), but its event coverage skews underground and Europe-heavy. US
 * festival-circuit, commercial, and bus-and-truck acts are systematically
 * UNDER-logged on RA — so an act can look low-demand simply because RA doesn't
 * see its shows, not because demand is low. Scoring live demand on RA alone bakes
 * that sampling bias into the rank.
 *
 * Fix: blend RA with a second live source (Songkick tour density, via
 * enrichTour.js → tour_score) into `live_demand_score`, and set
 * `ra_coverage_thin` where RA structurally under-covers an act (real reach, few/no
 * RA events) so the UI can flag it instead of quietly scoring it as low-demand.
 *
 * Pure, idempotent compute over already-fetched fields (ra_score, tour_score,
 * ra_events_6m, spotify_monthly_listeners). Safe to run in CI and re-run; writes
 * only derived fields. Run BEFORE scoreArtists (score.js reads live_demand_score).
 */

// An act RA structurally under-logs: meaningful audience reach but few/no RA
// events, OR RA is blind to it entirely while it tours. These are the acts whose
// live demand is real but invisible to RA.
function isRaCoverageThin(a) {
  const listeners = a.spotify_monthly_listeners || 0;
  const raEvents  = a.ra_events_6m || 0;
  const ra        = Number.isFinite(a.ra_score) && a.ra_score > 0 ? a.ra_score : null;
  const tour      = Number.isFinite(a.tour_score) && a.tour_score > 0 ? a.tour_score : null;
  if (listeners >= 750000 && raEvents < 3) return true;     // big reach, RA barely logs them
  if (ra == null && tour != null && tour >= 40) return true; // RA blind, but clearly touring
  return false;
}

function computeLiveDemand(artists) {
  for (const a of artists) {
    const ra   = Number.isFinite(a.ra_score)   && a.ra_score   > 0 ? a.ra_score   : null;
    const tour = Number.isFinite(a.tour_score) && a.tour_score > 0 ? a.tour_score : null;
    const thin = isRaCoverageThin(a);
    a.ra_coverage_thin = thin;

    let live;
    if (ra != null && tour != null) {
      // Both present. The blend only ever CORROBORATES UPWARD: tour can lift an
      // act whose live demand RA under-sees, but a thin/low tour score never
      // drags down a solid RA reading (Songkick has its own coverage gaps — a
      // big act with sparse Songkick data shouldn't be penalised). Where RA
      // structurally under-logs the act, tour is weighted more so the lift is
      // larger. RA is the richer signal, so it's the floor.
      const wTour   = thin ? 0.65 : 0.35;
      const blended = (1 - wTour) * ra + wTour * tour;
      live = Math.max(ra, blended);
    } else if (ra != null) {
      live = ra;                 // tour blind → RA only (unchanged from before)
    } else if (tour != null) {
      live = 0.9 * tour;         // RA blind → fall back to tour density (coarser, lightly discounted)
    } else {
      live = null;               // neither source — leave absent (no contribution)
    }
    a.live_demand_score = live == null ? null : Math.round(live);
  }
  return artists;
}

module.exports = { computeLiveDemand, isRaCoverageThin };
