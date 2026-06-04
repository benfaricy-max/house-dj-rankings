/**
 * Tour-reach reconciliation (Songkick × Resident Advisor).
 *
 * WHY: Songkick barely covers underground/electronic acts, so its ld+json yields
 * false zeros for artists who are clearly touring (e.g. Objekt: 0 on Songkick but
 * 11 upcoming RA shows across 7 countries). RA is the authoritative source for this
 * scene and we already fetch it (enrichRA.js). This step fills the tour_* fields
 * from RA *only when Songkick is empty*, so a report never shows "0 shows" for an
 * artist who is actively gigging.
 *
 * MERGE-SAFE (CLAUDE.md Rule #1): never lowers a real Songkick value; only fills
 * 0/null tour fields with real RA-derived numbers. Stamps tour_source for honesty.
 *
 * Run: node backend/reconcileTour.js   (also called at the end of the daily refresh)
 */
const fs = require("fs");
const path = require("path");

const RANKINGS = path.join(__dirname, "..", "frontend", "public", "rankings.json");

// Same shape as fetchTour's score: 40% event volume, 60% geographic spread (capped at 8).
const scoreFrom = (events, countries) =>
  Math.round((Math.min(events, 8) / 8) * 100 * 0.4 + (Math.min(countries, 8) / 8) * 100 * 0.6);

function reconcile(d) {
  let filled = 0, kept = 0, quiet = 0;
  for (const dj of d.rankings) {
    const skUpcoming = Number(dj.tour_upcoming) || 0;
    const songkickHasData = skUpcoming > 0;

    const raUpcoming = Number(dj.ra_upcoming) || 0;
    const raRecent   = Number(dj.ra_events_6m) || 0;     // saturates ~10 = very active
    const raCountries = Number(dj.ra_countries) || 0;

    if (songkickHasData) {
      // Trust Songkick's richer next-show detail, but ensure source is marked and
      // give credit for a wider RA country footprint if RA clearly knows more.
      if (raCountries > (Number(dj.tour_countries) || 0)) {
        dj.tour_countries = raCountries;
        dj.tour_score = scoreFrom(skUpcoming, raCountries);
      }
      dj.tour_source = dj.tour_source === "resident-advisor" ? "both" : (raUpcoming || raRecent ? "both" : "songkick");
      kept++;
      continue;
    }

    // Songkick empty → derive reach from RA if it shows real activity.
    const events = Math.max(raUpcoming, raRecent);
    if (events > 0 || raCountries > 0) {
      dj.tour_upcoming   = raUpcoming;            // honest upcoming count
      dj.tour_countries  = raCountries;
      dj.tour_score      = scoreFrom(events, raCountries);
      dj.tour_active_6m  = raRecent;              // recent-activity context for reports
      dj.tour_source     = "resident-advisor";
      dj.tour_reconciled = new Date().toISOString();
      filled++;
    } else {
      // No Songkick and no RA activity — a genuine quiet period (or true coverage
      // gap). Leave as a real zero; don't fabricate.
      if (dj.tour_upcoming == null) dj.tour_upcoming = 0;
      dj.tour_source = dj.tour_source || "none";
      quiet++;
    }
  }
  return { filled, kept, quiet };
}

if (require.main === module) {
  const d = JSON.parse(fs.readFileSync(RANKINGS, "utf8"));
  const { filled, kept, quiet } = reconcile(d);
  fs.writeFileSync(RANKINGS, JSON.stringify(d));
  const withReach = d.rankings.filter(x => (x.tour_upcoming > 0) || (x.tour_active_6m > 0)).length;
  console.log(`Tour reconcile: ${filled} filled from RA · ${kept} kept from Songkick · ${quiet} genuinely quiet.`);
  console.log(`${withReach}/${d.rankings.length} artists now show real touring reach.`);
}

module.exports = { reconcile };
