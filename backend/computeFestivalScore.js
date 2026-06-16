/**
 * festival_score — major-festival booking presence, the signal RA + Beatport miss.
 *
 * WHY: RA under-logs US/festival-circuit and viral acts, and Beatport only sees
 * track-charting producers — so a real festival-field-filler with no RA club nights
 * and no Beatport release (Disco Lines, Gordo, Hugel) reads as low-demand across the
 * whole panel. Festival presence is exactly that missing demand: who's booked to play
 * the big stages. It's a LIVE-demand signal, complementary to RA/tour.
 *
 * SCORE: festival_score 0-100 = min(Σ festival_tier, CAP) / CAP * 100, where each
 * festival an act is on contributes its tier weight (T1 global flagship = 1.0,
 * T2 major/regional = 0.6). CAP = 6 (≈ six flagship bookings = a maxed festival season).
 *
 * SELF-HEALS ON ABSENCE (registered in score.js SELF_HEAL_ABSENT): an act on NO tracked
 * lineup gets `festival_score` left undefined → its weight redistributes per-artist,
 * never scored as zero. So the signal only LIFTS festival acts; it never penalises a
 * club-only/underground act for not playing festivals. Coverage is the gate (same as
 * 1001TL/scene_geography): it nudges only the acts the lineup file actually covers.
 *
 * DATA: backend/festival_lineups.json (festival → tier → acts). Hand-seeded today;
 * meant to be grown/refreshed by a scraper (fetchFestivals.js — Songkick festival
 * tags / lineup aggregators). Act names must match rankings.json names exactly.
 *
 * Pure + idempotent over the lineup file. Run in generateStatic BEFORE scoreArtists.
 */
const fs = require("fs");
const path = require("path");

const LINEUPS_FILE   = path.join(__dirname, "festival_lineups.json");   // auto-scraped (fetchFestivals.js)
const OVERRIDES_FILE = path.join(__dirname, "festival_overrides.json"); // hand-verified supplement
const CAP = 6; // Σ tier at which festival_score saturates to 100

// Build name → Σ(tier), merging the auto-scraped lineups with a hand-verified
// overrides file. WHY overrides: the Songkick scraper is European-summer skewed
// (same blind spot as RA) and misses the US-festival/viral acts the signal is meant
// to reach (Disco Lines, Gordo @ EDC/Coachella). The overrides file is a small,
// hand-verified supplement that credits those confirmed bookings the scraper can't see.
// DEDUP by festival NAME per act (an act on the same festival in both files counts
// ONCE; the overrides tier wins on conflict) — so the two sources can't double-count.
// Returns {} if both files are missing (signal self-heals away — safe no-op).
function loadFestivalWeights() {
  const actFest = {}; // act → Map(festivalName → tier)
  const ingest = (file) => {
    let data;
    try { data = JSON.parse(fs.readFileSync(file, "utf8")); } catch { return; }
    for (const f of (data.festivals || [])) {
      if (!f.name) continue;
      const tier = Number.isFinite(f.tier) ? f.tier : 0.6;
      for (const act of (f.acts || [])) {
        (actFest[act] || (actFest[act] = new Map())).set(f.name, tier);
      }
    }
  };
  ingest(LINEUPS_FILE);
  ingest(OVERRIDES_FILE); // merged on top; same festival name → deduped, override tier wins
  const weights = {};
  for (const [act, m] of Object.entries(actFest)) {
    weights[act] = [...m.values()].reduce((s, t) => s + t, 0);
  }
  return weights;
}

function festivalScoreFor(name, weights) {
  const w = weights[name];
  if (!(w > 0)) return undefined; // absent → unmeasured (self-heals), not zero
  return Math.round(Math.min(w, CAP) / CAP * 100);
}

// Set a.festival_score from the lineup file. AUTHORITATIVE: an act no longer on any
// tracked lineup has its festival_score CLEARED (deleted) so score.js self-heals it
// away — otherwise a prior value carried in via generateStatic's `...prev` spread
// would go stale (festival presence is current-season). The lineup file is already
// merge-safe at the scraper level (a failed fetch keeps prior memberships), so the
// file is the authoritative current state to mirror here.
function computeFestivalScores(artists, weights = loadFestivalWeights()) {
  for (const a of artists) {
    const s = festivalScoreFor(a.name, weights);
    if (s !== undefined) a.festival_score = s;
    else if ("festival_score" in a) delete a.festival_score;
  }
  return artists;
}

module.exports = { computeFestivalScores, festivalScoreFor, loadFestivalWeights, CAP };
