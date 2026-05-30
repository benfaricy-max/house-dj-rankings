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
    artists: [...(t.artists || []), ...(t.remixers || [])].map(a => a.name).filter(Boolean),
  }));
}

(async () => {
  // chartMap: normalizedArtist -> { best, tracks, charts:Set }
  const chartMap = {};
  for (const [label, slug, id] of GENRES) {
    try {
      const rows = await scrapeChart(label, slug, id);
      for (const row of rows) {
        for (const name of row.artists) {
          const k = norm(name);
          if (!k) continue;
          const e = chartMap[k] ?? (chartMap[k] = { best: 101, tracks: 0, charts: new Set(), display: name });
          e.best = Math.min(e.best, row.position);
          e.tracks += 1;
          e.charts.add(label);
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

  let hits = 0;
  for (const dj of rankData.rankings) {
    const e = chartMap[norm(dj.name)];
    if (!e) continue;
    const positionScore = 101 - e.best;
    const breadth = Math.min(e.tracks, 5) / 5 * 100;
    const reach   = Math.min(e.charts.size, 3) / 3 * 100;
    const score   = Math.round(positionScore * 0.60 + breadth * 0.25 + reach * 0.15);
    const bp = {
      beatport_score: score,
      beatport_best_position: e.best,
      beatport_charting_tracks: e.tracks,
      beatport_charts: [...e.charts],
    };
    Object.assign(dj, bp);
    if (artistById[dj.name]) Object.assign(artistById[dj.name], bp);
    hits++;
  }

  fs.writeFileSync(RANKINGS, JSON.stringify(rankData));
  fs.writeFileSync(ARTISTS, JSON.stringify(artists, null, 2));
  console.log(`\nBeatport: ${hits}/${rankData.rankings.length} artists currently charting.`);
  const top = rankData.rankings.filter(d => d.beatport_score).sort((a,b)=>b.beatport_score-a.beatport_score).slice(0,8);
  top.forEach(d => console.log(`  ${d.name}: score ${d.beatport_score} (best #${d.beatport_best_position}, ${d.beatport_charting_tracks} tracks, ${d.beatport_charts.length} charts)`));
})();
