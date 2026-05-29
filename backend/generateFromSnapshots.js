/**
 * Generates rankings.json by merging:
 *  - Latest snapshot data (real metrics) for artists we've fetched before
 *  - Base artist record (zeros) for artists not yet fetched
 */
const path = require("path");
const fs   = require("fs");
const { scoreArtists } = require("./score");

const SNAP_FILE  = path.join(__dirname, "data", "snapshots.json");
const ARTISTS    = require("./artists.json");
const OUT_FILE   = path.join(__dirname, "..", "frontend", "public", "rankings.json");

// Load snapshots (may not exist yet)
let snapshots = {};
try { snapshots = JSON.parse(fs.readFileSync(SNAP_FILE, "utf8")); } catch {}

// Merge: use latest snapshot if available, otherwise use base artist record
const enriched = ARTISTS.map(artist => {
  const history = snapshots[artist.name];
  if (history?.length) {
    return history[history.length - 1];
  }
  // No snapshot yet — include with zeros so they appear in the list
  return {
    ...artist,
    spotify_followers: 0,
    spotify_monthly_listeners: 0,
    spotify_avg_track_popularity: 0,
    spotify_playlist_placements: artist.album_count ?? 0,
    tiktok_post_count: 0,
    youtube_subscribers: 0,
    youtube_views_weekly: 0,
    soundcloud_followers: 0,
    google_trends_score: 0,
    google_trends_direction: "stable",
    spotify_follower_growth_rate: 0,
  };
});

const ranked = scoreArtists(enriched);
ranked.forEach((dj, i) => { dj.rank = i + 1; });

const onesToWatch = ranked
  .filter(d => d.rank > 10 && (!d.spotify_monthly_listeners || d.spotify_monthly_listeners < 500_000))
  .slice(0, 50);

const payload = {
  rankings:    ranked,
  onesToWatch,
  movers:      { rising: [], falling: [] },
  lastUpdated: new Date().toISOString(),
};

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify(payload));
console.log(`Saved ${ranked.length} artists → ${OUT_FILE}`);
console.log(`  ${Object.keys(snapshots).length} with real data, ${ranked.length - Object.keys(snapshots).length} with placeholder data`);
