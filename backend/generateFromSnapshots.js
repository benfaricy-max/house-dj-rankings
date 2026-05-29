/**
 * Generates rankings.json from existing local snapshots (no API calls needed).
 */
const path = require("path");
const fs   = require("fs");
const { scoreArtists } = require("./score");

const SNAP_FILE = path.join(__dirname, "data", "snapshots.json");
const OUT_FILE  = path.join(__dirname, "..", "frontend", "public", "rankings.json");

const snapshots = JSON.parse(fs.readFileSync(SNAP_FILE, "utf8"));

// Take the latest snapshot for each artist
const enriched = Object.entries(snapshots).map(([name, history]) => {
  return history[history.length - 1];
}).filter(Boolean);

if (enriched.length === 0) { console.error("No snapshot data"); process.exit(1); }

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
