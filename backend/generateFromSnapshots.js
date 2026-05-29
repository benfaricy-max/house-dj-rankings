/**
 * Generates rankings.json by merging:
 *  - Latest snapshot data (real metrics) for artists we've fetched before
 *  - Base artist record (zeros) for artists not yet fetched
 * Also computes velocity (week-over-week growth) and breakout flags.
 */
const path = require("path");
const fs   = require("fs");
const { scoreArtists } = require("./score");

const SNAP_FILE = path.join(__dirname, "data", "snapshots.json");
const ARTISTS   = require("./artists.json");
const OUT_FILE  = path.join(__dirname, "..", "frontend", "public", "rankings.json");

const VELOCITY_METRICS = [
  "spotify_followers",
  "spotify_monthly_listeners",
  "tiktok_post_count",
  "youtube_subscribers",
  "youtube_views_weekly",
  "google_trends_score",
  "mixcloud_followers",
];

// Load snapshots (may not exist yet)
let snapshots = {};
try { snapshots = JSON.parse(fs.readFileSync(SNAP_FILE, "utf8")); } catch {}

// Compute week-over-week velocity for an artist's snapshot history
function computeVelocity(history) {
  if (!history || history.length < 2) return null;
  const curr = history[history.length - 1];
  const prev = history[history.length - 2];
  const changes = {};
  let total = 0, count = 0;
  for (const key of VELOCITY_METRICS) {
    const c = curr[key] || 0;
    const p = prev[key] || 0;
    if (p > 0) {
      const pct = ((c - p) / p) * 100;
      changes[key] = Math.round(pct * 10) / 10;
      total += pct;
      count++;
    } else if (c > 0) {
      changes[key] = null; // new signal, no baseline
    } else {
      changes[key] = 0;
    }
  }
  return {
    metrics: changes,
    composite: count > 0 ? Math.round((total / count) * 10) / 10 : 0,
    prev_score: prev.score ?? null,
    curr_score: curr.score ?? null,
    score_change_pct: (prev.score && curr.score)
      ? Math.round(((curr.score - prev.score) / prev.score) * 1000) / 10
      : null,
  };
}

// Merge: use latest snapshot if available, otherwise base record with zeros
const enriched = ARTISTS.map(artist => {
  const history = snapshots[artist.name];
  if (history?.length) {
    const latest = history[history.length - 1];
    return { ...latest, velocity: computeVelocity(history) };
  }
  return {
    ...artist,
    spotify_followers: 0, spotify_monthly_listeners: 0,
    spotify_avg_track_popularity: 0,
    spotify_playlist_placements: artist.album_count ?? 0,
    tiktok_post_count: 0, youtube_subscribers: 0,
    youtube_views_weekly: 0, soundcloud_followers: 0,
    google_trends_score: 0, google_trends_direction: "stable",
    spotify_follower_growth_rate: 0, mixcloud_followers: 0,
    mixcloud_play_count_total: 0,
    velocity: null,
  };
});

const ranked = scoreArtists(enriched);
ranked.forEach((dj, i) => { dj.rank = i + 1; });

// Velocity leaders — ranked by composite velocity score
const velocityRanked = ranked
  .filter(d => d.velocity?.composite != null)
  .sort((a, b) => b.velocity.composite - a.velocity.composite);

// Breakout alerts — score jumped > 8% week-over-week
const BREAKOUT_THRESHOLD = 8;
const breakouts = ranked
  .filter(d => d.velocity?.score_change_pct != null && d.velocity.score_change_pct >= BREAKOUT_THRESHOLD)
  .sort((a, b) => b.velocity.score_change_pct - a.velocity.score_change_pct);

const onesToWatch = ranked
  .filter(d => d.rank > 10 && (!d.spotify_monthly_listeners || d.spotify_monthly_listeners < 500_000))
  .slice(0, 50);

const payload = {
  rankings:       ranked,
  onesToWatch,
  velocityRanked,
  breakouts,
  breakoutThreshold: BREAKOUT_THRESHOLD,
  movers:         { rising: [], falling: [] },
  lastUpdated:    new Date().toISOString(),
};

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify(payload));
console.log(`Saved ${ranked.length} artists → ${OUT_FILE}`);
console.log(`  Velocity data: ${velocityRanked.length} artists`);
console.log(`  Breakout alerts: ${breakouts.length} artists (>${BREAKOUT_THRESHOLD}% score jump)`);
