/**
 * RA (Resident Advisor) enrichment — booking-intelligence signals.
 * Resumable (skips artists fresh < STALE_DAYS), paced, merge-safe.
 * Run: node backend/enrichRA.js [limit]
 *
 * Adds to each artist: ra_slug, ra_followers, ra_upcoming, ra_events_6m,
 * ra_avg_attending, ra_top_attending, ra_attending_h1/h2, ra_venue_tier,
 * ra_countries, ra_country_list, ra_top_regions, ra_top_venues, ra_score.
 */
const fs   = require("fs");
const path = require("path");
const { getRAData } = require("./fetchRA");

const RANKINGS   = path.join(__dirname, "..", "frontend", "public", "rankings.json");
const ARTISTS    = path.join(__dirname, "artists.json");
const STALE_DAYS = 14;
const FORCE      = process.argv.includes("--force");   // re-fetch even if fresh (e.g. new RA fields)
const LIMIT      = parseInt(process.argv.find(a => /^\d+$/.test(a)) || "999", 10);
const DELAY_MS   = 1200;

const d          = JSON.parse(fs.readFileSync(RANKINGS, "utf8"));
const artistsRaw = JSON.parse(fs.readFileSync(ARTISTS, "utf8"));
const artistById = Object.fromEntries(artistsRaw.map(a => [a.name, a]));

// Artists with RA data: stale after 14d. Artists not found: retry after 60d (they rarely join RA).
const isFresh = dj => {
  if (FORCE) return false;
  if (!dj.ra_updated) return false;
  const age = Date.now() - new Date(dj.ra_updated).getTime();
  const threshold = dj.ra_slug ? STALE_DAYS : 60;
  return age < threshold * 864e5;
};

const delay = ms => new Promise(r => setTimeout(r, ms));

function save() {
  fs.writeFileSync(RANKINGS, JSON.stringify(d));
  fs.writeFileSync(ARTISTS, JSON.stringify(artistsRaw, null, 2));
}

(async () => {
  const todo = d.rankings.filter(dj => !isFresh(dj)).slice(0, LIMIT);
  console.log(`RA enrichment: ${todo.length} artists to fetch (${d.rankings.length - todo.length} already fresh)…`);

  let done = 0, ok = 0, miss = 0, failStreak = 0;

  for (const dj of todo) {
    // Use ra_slug from artists.json as override if manually set
    const overrideSlug = artistById[dj.name]?.ra_slug || dj.ra_slug || null;

    const { data: ra, error } = await getRAData(dj.name, overrideSlug);
    done++;

    // Always stamp ra_updated so we know this artist was checked (prevents re-checking every run)
    dj.ra_updated = new Date().toISOString();

    if (ra) {
      Object.assign(dj, ra);
      if (artistById[dj.name]) artistById[dj.name].ra_slug = ra.ra_slug;
      ok++;
      failStreak = 0;
    } else {
      miss++;
      // Only count network/API errors toward the fail streak (not "not found" cases)
      if (error) {
        failStreak++;
        if (failStreak >= 8) {
 console.log("\nMultiple consecutive API errors, likely throttled. Saving and stopping.");
          break;
        }
      } else {
 failStreak = 0; // artist not on RA, not a failure
      }
    }

    if (done % 5 === 0) {
      save();
      process.stdout.write(`\r${done}/${todo.length} | found: ${ok} | miss: ${miss}   `);
    }

    await delay(DELAY_MS + Math.random() * 600);
  }

  save();
  const total = d.rankings.filter(x => x.ra_score > 0).length;
  console.log(`\nDone. ${ok} fetched, ${miss} not found. ${total} artists now have RA data.`);

  // Summary of top RA scores
  const top = d.rankings
    .filter(x => x.ra_score > 0)
    .sort((a, b) => b.ra_score - a.ra_score)
    .slice(0, 10);
  top.forEach(dj =>
    console.log(`  ${dj.name}: ra_score=${dj.ra_score} attending=${dj.ra_avg_attending} events=${dj.ra_events_6m} countries=${dj.ra_countries} tier=${dj.ra_venue_tier}`)
  );
})();
