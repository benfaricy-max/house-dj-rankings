const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
const SNAP_FILE = path.join(DATA_DIR, "snapshots.json");

// Keep in-memory to avoid re-reading disk on every call
let snapshots = {};
try {
  if (fs.existsSync(SNAP_FILE)) snapshots = JSON.parse(fs.readFileSync(SNAP_FILE, "utf8"));
} catch { snapshots = {}; }

function persist() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SNAP_FILE, JSON.stringify(snapshots));
}

function saveSnapshot(artistName, data) {
  if (!snapshots[artistName]) snapshots[artistName] = [];
  snapshots[artistName].push({ ...data, timestamp: new Date().toISOString() });
  if (snapshots[artistName].length > 52) snapshots[artistName].shift();
  persist();
}

function getLastWeekSnapshot(artistName) {
  const h = snapshots[artistName] || [];
  return h.length >= 2 ? h[h.length - 2] : null;
}

// Called after scoring so final rank is persisted into the current snapshot
function updateRank(artistName, rank) {
  const h = snapshots[artistName];
  if (!h?.length) return;
  h[h.length - 1].rank = rank;
  persist();
}

// Returns last 8 snapshots (rank + score + listeners + timestamp) for trend chart
function getArtistHistory(artistName) {
  const h = snapshots[artistName] ?? [];
  return h.slice(-8).map(s => ({
    timestamp: s.timestamp ?? null,
    rank:  s.rank  ?? null,
    score: s.score ?? null,
    spotify_monthly_listeners: s.spotify_monthly_listeners ?? 0,
  }));
}

module.exports = { saveSnapshot, getLastWeekSnapshot, updateRank, getArtistHistory };
