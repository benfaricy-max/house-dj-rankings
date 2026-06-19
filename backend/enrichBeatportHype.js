/**
 * Beatport HYPE signal — emerging / pre-breakout credibility.
 *
 * Beatport's per-genre "Hype 100" is its board for tracks gaining traction before
 * they hit the main Top 100. Charting here = the scene is picking you up early,
 * which is exactly the "before the industry catches on" signal PEAKTIME is about.
 * It complements beatport_score (established Top-100 standing) with a leading
 * indicator. Same plain-HTTP __NEXT_DATA__ scrape as enrichBeatport.js — runs in CI.
 *
 * Merge-safe (CLAUDE.md Rule #1): only writes for artists currently on a Hype
 * chart; a failed scrape never wipes anyone. Writes beatport_hype_score (0-100) +
 * best position / track count / chart breadth.
 */
const axios = require("axios");
const path  = require("path");
const fs    = require("fs");

const RANKINGS = path.join(__dirname, "..", "frontend", "public", "rankings.json");
const ARTISTS  = path.join(__dirname, "artists.json");

// Same house/techno genre set as the Top-100 scraper.
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

async function scrapeHype(slug, id) {
  const url = `https://www.beatport.com/genre/${slug}/${id}/hype-100`;
  const r = await axios.get(url, { headers: { "User-Agent": UA }, timeout: 20000 });
  const m = r.data.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return [];
  const data = JSON.parse(m[1]);
  const queries = data?.props?.pageProps?.dehydratedState?.queries ?? [];
  const results = queries.map(q => q.state?.data?.results).find(x => Array.isArray(x) && x.length) ?? [];
  return results.map((t, i) => ({
    position: i + 1,
    artists: [...(t.artists || []), ...(t.remixers || [])].map(a => a.name).filter(Boolean),
  }));
}

(async () => {
  const chartMap = {};   // normalizedArtist -> { best, tracks, charts:Set }
  let scraped = 0;
  for (const [label, slug, id] of GENRES) {
    try {
      const rows = await scrapeHype(slug, id);
      if (rows.length) scraped++;
      for (const row of rows) {
        for (const name of row.artists) {
          const k = norm(name);
          if (!k) continue;
          const e = chartMap[k] ?? (chartMap[k] = { best: 101, tracks: 0, charts: new Set() });
          e.best = Math.min(e.best, row.position);
          e.tracks += 1;
          e.charts.add(label);
        }
      }
      console.log(`  ${label}: ${rows.length} hype tracks`);
      await delay(800);
    } catch (e) {
      console.warn(`  ${label}: failed (${e.response?.status || e.message?.slice(0, 40)})`);
    }
  }

  if (scraped === 0) {
 console.log("No Hype charts scraped (likely throttled), keeping existing data.");
    return;
  }

  const rankData = JSON.parse(fs.readFileSync(RANKINGS, "utf8"));
  const artists  = JSON.parse(fs.readFileSync(ARTISTS, "utf8"));
  const artistById = Object.fromEntries(artists.map(a => [a.name, a]));

  let hits = 0;
  for (const dj of rankData.rankings) {
    const e = chartMap[norm(dj.name)];
    if (!e) continue;
    const positionScore = 101 - e.best;                 // higher on the Hype chart = stronger
    const breadth = Math.min(e.tracks, 5) / 5 * 100;
    const reach   = Math.min(e.charts.size, 3) / 3 * 100;
    const score   = Math.round(positionScore * 0.60 + breadth * 0.25 + reach * 0.15);
    const hype = {
      beatport_hype_score: score,
      beatport_hype_best: e.best,
      beatport_hype_tracks: e.tracks,
      beatport_hype_charts: [...e.charts],
    };
    Object.assign(dj, hype);
    if (artistById[dj.name]) Object.assign(artistById[dj.name], hype);
    hits++;
  }

  fs.writeFileSync(RANKINGS, JSON.stringify(rankData));
  fs.writeFileSync(ARTISTS, JSON.stringify(artists, null, 2));
  console.log(`\nBeatport Hype: ${hits}/${rankData.rankings.length} artists on a Hype chart.`);
  rankData.rankings.filter(d => d.beatport_hype_score)
    .sort((a, b) => b.beatport_hype_score - a.beatport_hype_score).slice(0, 8)
    .forEach(d => console.log(`  ${d.name}: hype ${d.beatport_hype_score} (best #${d.beatport_hype_best}, ${d.beatport_hype_tracks} tracks)`));
})();
