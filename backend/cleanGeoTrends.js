/**
 * Geographic-interest de-noiser for google_trends_countries.
 *
 * WHY: Google Trends "interest by region" keys on the raw search term, so common
 * words / namesakes collide badly — e.g. "Black Coffee" → Albania:100, "Carl Cox"
 * → Isle of Man:100, "Âme" → Congo/Togo/Haiti. Surfacing those in a booker-facing
 * report reads as broken data. We keep a Trends country ONLY if it is plausible:
 *   (a) corroborated by where the artist actually gets booked (RA + tour footprint), OR
 *   (b) an established electronic-music market (allowlist below).
 * Everything else is dropped as keyword-collision noise. When nothing survives, the
 * UI already falls back to the artist's real RA booking markets.
 *
 * MERGE-SAFE (CLAUDE.md Rule #1): the original map is preserved in
 * google_trends_countries_raw; we never lose data, we just stop *displaying* noise.
 *
 * Run: node backend/cleanGeoTrends.js   (also called at the end of the local refresh)
 */
const fs = require("fs");
const path = require("path");

const RANKINGS = path.join(__dirname, "..", "frontend", "public", "rankings.json");

// Established electronic-music markets — real demand here is plausible for almost
// any touring house/techno act, so an uncorroborated Trends hit is still credible.
const MARKETS = new Set([
  "United States", "United States of America", "United Kingdom", "Germany",
  "Netherlands", "Spain", "France", "Italy", "Belgium", "Australia", "Canada",
  "Brazil", "Mexico", "Argentina", "Colombia", "Chile", "Peru", "Portugal",
  "Switzerland", "Austria", "Sweden", "Denmark", "Norway", "Finland", "Ireland",
  "Poland", "Greece", "Croatia", "Czechia", "Czech Republic", "Hungary",
  "Romania", "Turkey", "United Arab Emirates", "South Africa", "Japan",
  "South Korea", "New Zealand", "Israel", "Uruguay", "Ecuador",
]);

// Normalise the few country-name variants RA vs Trends disagree on.
const canon = c => ({
  "United States of America": "United States",
  "USA": "United States",
  "UK": "United Kingdom",
  "Czech Republic": "Czechia",
}[c] || c);

function bookingCountries(dj) {
  const set = new Set();
  if (Array.isArray(dj.ra_country_list)) dj.ra_country_list.forEach(c => set.add(canon(c)));
  if (Array.isArray(dj.ra_top_regions)) dj.ra_top_regions.forEach(r => r?.country && set.add(canon(r.country)));
  if (dj.tour_next_country) set.add(canon(dj.tour_next_country));
  return set;
}

function clean(d) {
  let cleaned = 0, dropped = 0, emptied = 0, untouched = 0;
  for (const dj of d.rankings) {
    const raw = dj.google_trends_countries;
    if (!raw || typeof raw !== "object" || Array.isArray(raw) || Object.keys(raw).length === 0) {
      untouched++;
      continue;
    }
    const booked = bookingCountries(dj);
    const keep = {};
    let removed = 0;
    for (const [country, score] of Object.entries(raw)) {
      if (!score || score <= 0) { removed++; continue; }       // drop zero-interest noise
      const c = canon(country);
      if (booked.has(c) || MARKETS.has(c) || MARKETS.has(country)) keep[country] = score;
      else removed++;
    }
    if (removed === 0) { untouched++; continue; }

    // Preserve the original once (don't clobber an existing raw snapshot).
    if (dj.google_trends_countries_raw == null) dj.google_trends_countries_raw = raw;
    dj.google_trends_countries = keep;
    dropped += removed;
    if (Object.keys(keep).length === 0) emptied++;
    cleaned++;
  }
  return { cleaned, dropped, emptied, untouched };
}

if (require.main === module) {
  const d = JSON.parse(fs.readFileSync(RANKINGS, "utf8"));
  const { cleaned, dropped, emptied, untouched } = clean(d);
  fs.writeFileSync(RANKINGS, JSON.stringify(d));
  console.log(`Geo de-noise: ${cleaned} artists cleaned · ${dropped} noise countries dropped · ${emptied} fully cleared (→ RA fallback) · ${untouched} untouched.`);
}

module.exports = { clean };
