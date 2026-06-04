/**
 * Beatport signal — core scene credibility.
 * Scrapes genre Top 100 charts (plain HTTP, __NEXT_DATA__), aggregates each
 * artist's best position / charting tracks / cross-genre reach into a 0-100 score.
 * Merge-safe: only writes when an artist actually charts; never wipes existing data.
 */
const axios = require("axios");
const path  = require("path");
const fs    = require("fs");

const RANKINGS = path.join(__dirname, "..", "frontend", "public", "rankings.json");
const ARTISTS  = path.join(__dirname, "artists.json");
const ARCHIVE  = path.join(__dirname, "beatport-archive.json");   // committed weekly Top-100 history (not gitignored data/)

// Beatport genre Top 100 charts relevant to a house / techno roster
const GENRES = [
  ["House", "house", 5],
  ["Tech House", "tech-house", 11],
  ["Melodic House & Techno", "melodic-house-techno", 90],
  ["Techno (Peak Time / Driving)", "techno-peak-time-driving", 6],
  ["Techno (Raw / Deep / Hypnotic)", "techno-raw-deep-hypnotic", 92],
  ["Minimal / Deep Tech", "minimal-deep-tech", 14],
  ["Deep House", "deep-house", 12],
  ["Afro House", "afro-house", 89],
  ["Progressive House", "progressive-house", 15],
  ["Organic House / Downtempo", "organic-house-downtempo", 93],
  ["Indie Dance", "indie-dance", 37],
];

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36";
const delay = ms => new Promise(r => setTimeout(r, ms));
const norm = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

async function scrapeChart(label, slug, id) {
  const url = `https://www.beatport.com/genre/${slug}/${id}/top-100`;
  const r = await axios.get(url, { headers: { "User-Agent": UA }, timeout: 20000 });
  const m = r.data.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return [];
  const data = JSON.parse(m[1]);
  const queries = data?.props?.pageProps?.dehydratedState?.queries ?? [];
  const results = queries.map(q => q.state?.data?.results).find(x => Array.isArray(x) && x.length) ?? [];
  return results.map((t, i) => ({
    position: i + 1,
    title: t.name + (t.mix_name && !/^original/i.test(t.mix_name) ? ` (${t.mix_name})` : ""),
    artists: [...(t.artists || []), ...(t.remixers || [])].map(a => a.name).filter(Boolean),
    label: t.release?.label?.name || null,   // for Label & Release Trajectory
  }));
}

// ISO week key, e.g. "2026-W23" — one archive snapshot per week keeps it bounded.
function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((t - yearStart) / 864e5) + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

(async () => {
  // chartMap: normalizedArtist -> { best, tracks, charts:Set }
  const chartMap = {};
  const genreCharts = {};   // full Top-100 per genre this run, for the archive
  for (const [label, slug, id] of GENRES) {
    try {
      const rows = await scrapeChart(label, slug, id);
      if (rows.length) genreCharts[label] = rows;
      for (const row of rows) {
        for (const name of row.artists) {
          const k = norm(name);
          if (!k) continue;
          const e = chartMap[k] ?? (chartMap[k] = { best: 101, tracks: 0, charts: new Set(), labels: new Set(), display: name });
          e.best = Math.min(e.best, row.position);
          e.tracks += 1;
          e.charts.add(label);
          if (row.label) e.labels.add(row.label);
        }
      }
      console.log(`  ${label}: ${rows.length} tracks`);
      await delay(800);
    } catch (e) {
      console.warn(`  ${label}: failed (${e.response?.status || e.message?.slice(0,40)})`);
    }
  }

  const rankData = JSON.parse(fs.readFileSync(RANKINGS, "utf8"));
  const artists  = JSON.parse(fs.readFileSync(ARTISTS, "utf8"));
  const artistById = Object.fromEntries(artists.map(a => [a.name, a]));

  // Scrape succeeded if we got at least one genre chart.
  const scrapeSucceeded = Object.keys(genreCharts).length > 0;

  let hits = 0, decayed = 0;
  const now = new Date().toISOString();
  const TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

  for (const dj of rankData.rankings) {
    const e = chartMap[norm(dj.name)];
    if (e) {
      // Artist is currently charting — write fresh data + timestamp.
      const positionScore = 101 - e.best;
      const breadth = Math.min(e.tracks, 5) / 5 * 100;
      const reach   = Math.min(e.charts.size, 3) / 3 * 100;
      const score   = Math.round(positionScore * 0.60 + breadth * 0.25 + reach * 0.15);
      const bp = {
        beatport_score: score,
        beatport_best_position: e.best,
        beatport_charting_tracks: e.tracks,
        beatport_charts: [...e.charts],
        beatport_labels: [...e.labels],          // labels this artist is currently charting on
        beatport_updated: now,
      };
      Object.assign(dj, bp);
      if (artistById[dj.name]) Object.assign(artistById[dj.name], bp);
      hits++;
    } else if (scrapeSucceeded && dj.beatport_updated) {
      // Artist not on any chart this run. Only apply TTL when the scrape itself
      // succeeded — never zero scores on a failed/empty scrape (merge-safety rule).
      const age = Date.now() - new Date(dj.beatport_updated).getTime();
      if (age > TTL_MS) {
        // Score expired: artist has been off charts >14 days.
        const decay = {
          beatport_score: 0,
          beatport_best_position: null,
          beatport_charting_tracks: 0,
          beatport_charts: [],
          beatport_labels: [],
          beatport_updated: dj.beatport_updated,  // keep timestamp (shows when they last charted)
        };
        Object.assign(dj, decay);
        if (artistById[dj.name]) Object.assign(artistById[dj.name], decay);
        decayed++;
      }
    }
  }

  fs.writeFileSync(RANKINGS, JSON.stringify(rankData));
  fs.writeFileSync(ARTISTS, JSON.stringify(artists, null, 2));
  console.log(`\nBeatport: ${hits}/${rankData.rankings.length} artists currently charting, ${decayed} expired (>14d off charts).`);
  const top = rankData.rankings.filter(d => d.beatport_score).sort((a,b)=>b.beatport_score-a.beatport_score).slice(0,8);
  top.forEach(d => console.log(`  ${d.name}: score ${d.beatport_score} (best #${d.beatport_best_position}, ${d.beatport_charting_tracks} tracks, ${d.beatport_charts.length} charts)`));

  // ── Beatport chart archive (weekly snapshot, committed) ──
  // Builds our own queryable Top-100 history over time. One snapshot per ISO
  // week so it stays bounded; keeps ~26 weeks (6 months). Compact rows:
  // [position, title, artists(joined), label].
  if (Object.keys(genreCharts).length) {
    let archive = { weeks: [] };
    try { archive = JSON.parse(fs.readFileSync(ARCHIVE, "utf8")); } catch {}
    if (!Array.isArray(archive.weeks)) archive.weeks = [];
    const week = isoWeek();
    const snapshot = {
      week, date: new Date().toISOString().slice(0, 10),
      charts: Object.fromEntries(Object.entries(genreCharts).map(([g, rows]) =>
        [g, rows.map(r => [r.position, r.title, r.artists.join(", "), r.label || ""])])),
    };
    const existing = archive.weeks.findIndex(w => w.week === week);
    if (existing >= 0) archive.weeks[existing] = snapshot;   // refresh this week's snapshot
    else archive.weeks.push(snapshot);
    archive.weeks = archive.weeks.slice(-26);                // ~6 months
    archive.updated = new Date().toISOString();
    fs.writeFileSync(ARCHIVE, JSON.stringify(archive));
    console.log(`Archive: ${archive.weeks.length} weekly snapshot(s) (latest ${week}, ${Object.keys(genreCharts).length} genres).`);
  }
})();
