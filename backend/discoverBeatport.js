/**
 * Beatport discovery — finds artists who chart well on Beatport but are NOT yet
 * in our roster, ranked by the same beatport_score we already use. Read-only by
 * default; pass --add to append the strong candidates (score >= MIN) to
 * artists.json so the enrichment pipeline picks them up.
 *
 *   node discoverBeatport.js            # report only
 *   node discoverBeatport.js --add      # also add candidates with score >= MIN
 */
const axios = require("axios");
const path  = require("path");
const fs    = require("fs");

const ARTISTS  = path.join(__dirname, "artists.json");
const RANKINGS = path.join(__dirname, "..", "frontend", "public", "rankings.json");
const ADD = process.argv.includes("--add");
const MIN = 78;            // min beatport_score to auto-add (strong, credible charting)
const MIN_TRACKS = 2;      // require >1 charting track to avoid one-off flukes
const MIN_CHARTS = 2;      // require cross-genre presence (filters single-chart spikes)

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

async function scrapeChart(slug, id) {
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
  const chartMap = {};
  for (const [label, slug, id] of GENRES) {
    try {
      const rows = await scrapeChart(slug, id);
      for (const row of rows) for (const name of row.artists) {
        const k = norm(name); if (!k) continue;
        const e = chartMap[k] ?? (chartMap[k] = { best: 101, tracks: 0, charts: new Set(), display: name });
        e.best = Math.min(e.best, row.position); e.tracks++; e.charts.add(label);
      }
      console.log(`  ${label}: ${rows.length} tracks`);
      await delay(800);
    } catch (e) { console.warn(`  ${label}: failed (${e.response?.status || e.message?.slice(0,40)})`); }
  }

  const artists = JSON.parse(fs.readFileSync(ARTISTS, "utf8"));
  const have = new Set(artists.map(a => norm(a.name)));
  const baseNorm = s => norm((s || "").replace(/\s*\([a-z]{2}\)\s*$/i, ""));   // strip trailing (DE)/(BR) tags
  const haveBase = new Set(artists.map(a => baseNorm(a.name)));
  const tagged = name => /\([a-z]{2}\)\s*$/i.test(name);                       // country-tagged → manual review

  const score = e => Math.round((101 - e.best) * 0.60 + Math.min(e.tracks,5)/5*100 * 0.25 + Math.min(e.charts.size,3)/3*100 * 0.15);
  const candidates = Object.values(chartMap)
    .filter(e => !have.has(norm(e.display)) && e.tracks >= MIN_TRACKS && e.charts.size >= MIN_CHARTS)
    .map(e => ({ name: e.display, score: score(e), best: e.best, tracks: e.tracks, charts: [...e.charts],
                 dupe: haveBase.has(baseNorm(e.display)), tagged: tagged(e.display) }))
    .sort((a, b) => b.score - a.score);

  console.log(`\n${candidates.length} charting artists NOT in our roster (>=${MIN_TRACKS} tracks):\n`);
  candidates.slice(0, 40).forEach(c =>
    console.log(`  ${String(c.score).padStart(3)} | ${c.name.padEnd(26)} best #${c.best}, ${c.tracks} tracks, ${c.charts.length} charts`));

  if (ADD) {
    // High-confidence only: strong score, cross-genre, no country tag, not a
    // region/alias dupe of an existing artist.
    const toAdd = candidates.filter(c => c.score >= MIN && !c.tagged && !c.dupe);
    for (const c of toAdd) {
      artists.push({ name: c.name, manual_scene_score: 50, source: "beatport-discovery" });
    }
    if (toAdd.length) fs.writeFileSync(ARTISTS, JSON.stringify(artists, null, 2));
    console.log(`\nAdded ${toAdd.length} new artists (score >= ${MIN}, ${MIN_CHARTS}+ charts, untagged) to artists.json. Roster now ${artists.length}.`);
    const skipped = candidates.filter(c => c.score >= MIN && (c.tagged || c.dupe)).map(c => c.name);
 if (skipped.length) console.log("Skipped (country-tagged or dupe: manual review):", skipped.join(", "));
  } else {
 console.log(`\n(report only, re-run with --add to append candidates with score >= ${MIN})`);
  }
})();
