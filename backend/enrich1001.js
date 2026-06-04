/**
 * 1001Tracklists DJ-Support signal — the truest peak-time scene signal.
 *
 * 1001Tracklists' weekly chart ranks the tracks DJs are actually PLAYING in sets
 * (not sales/streams — hardest to game). The API caps each chart at 20 but it
 * backdates (?week&year), so we backfill a FULL YEAR (52 weeks) into a committed
 * archive and score each artist from their cumulative chart record:
 *   - consistency: how many of the 52 weeks they charted
 *   - peak:        their best position ever
 *   - recency:     charted recently vs long ago
 * → tl_support_score 0-100, plus tl_weeks_charted / tl_chart_best / tl_chart_recent.
 * A year of backfill lifts coverage far above a single 20-track week.
 *
 * (The set-crawl path was dropped: the feed endpoint times out paging deep and
 * many recent sets return empty tracklists, so it added runtime for ~no yield.)
 *
 * Source: local API (TL_API_BASE, default http://localhost:3001). Not reachable in
 * CI → no-ops; tl_* persists via generateStatic's `...prev`. Run: node backend/enrich1001.js
 */
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const RANKINGS = path.join(__dirname, "..", "frontend", "public", "rankings.json");
const ARTISTS  = path.join(__dirname, "artists.json");
const ARCHIVE  = path.join(__dirname, "tracklists-archive.json");
const PUBLIC_TL = path.join(__dirname, "..", "frontend", "public", "tracklists.json");
const BASE = process.env.TL_API_BASE || "http://localhost:3001";
const BACKFILL_WEEKS = parseInt(process.env.TL_BACKFILL_WEEKS || "52", 10);

const norm = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const slugify = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const splitArtists = s => (s || "").split(/\s+(?:vs\.?|&|x|ft\.?|feat\.?|featuring|with|\+|,|\/)\s+/i).map(t => t.trim()).filter(Boolean);
const delay = ms => new Promise(r => setTimeout(r, ms));
const get = async p => (await axios.get(`${BASE}${p}`, { timeout: 15000 })).data;

function isoWeekYear(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const ys = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return { year: t.getUTCFullYear(), week: Math.ceil((((t - ys) / 864e5) + 1) / 7) };
}
const weekKey = (y, w) => `${y}-W${String(w).padStart(2, "0")}`;

async function main() {
  try { await get(`/api/1001tracklists/chart/weekly`); }
  catch (e) { console.log(`1001Tracklists API unreachable at ${BASE} (${e.code || e.message}) — keeping existing tl_* data. Skipping.`); return; }

  const data = JSON.parse(fs.readFileSync(RANKINGS, "utf8"));
  const artists = JSON.parse(fs.readFileSync(ARTISTS, "utf8"));
  const rosterByNorm = {};
  for (const a of data.rankings) rosterByNorm[norm(a.name)] = a;
  const inRoster = n => rosterByNorm[norm(n)];

  // ── Backfill a full year of weekly charts into the archive ──
  let archive = { weeks: [] };
  try { archive = JSON.parse(fs.readFileSync(ARCHIVE, "utf8")); } catch {}
  if (!Array.isArray(archive.weeks)) archive.weeks = [];
  const byWeek = Object.fromEntries(archive.weeks.map(w => [w.week, w]));

  const { year: cy, week: cw } = isoWeekYear();
  const curKey = weekKey(cy, cw);
  let fetched = 0;
  for (let i = 0; i < BACKFILL_WEEKS; i++) {
    let w = cw - i, y = cy;
    while (w <= 0) { w += 52; y -= 1; }
    const key = weekKey(y, w);
    if (byWeek[key] && key !== curKey) continue;           // keep past weeks; always refresh current
    try {
      const c = await get(`/api/1001tracklists/chart/weekly?week=${w}&year=${y}`);
      const entries = (c?.entries || []).filter(e => e.artist && e.title);
      if (entries.length) {
        byWeek[key] = { week: key, date: new Date().toISOString().slice(0, 10), entries: entries.map(e => ({ rank: e.rank, artist: e.artist, title: e.title, trackId: e.trackId, url: e.url })) };
        fetched++;
      }
      await delay(110);
    } catch { /* skip week */ }
  }
  archive.weeks = Object.values(byWeek).sort((a, b) => a.week.localeCompare(b.week)).slice(-BACKFILL_WEEKS);
  archive.updated = new Date().toISOString();
  fs.writeFileSync(ARCHIVE, JSON.stringify(archive));

  const orderedKeys = archive.weeks.map(w => w.week);            // chronological
  const lastKey = orderedKeys[orderedKeys.length - 1];
  const currentWeek = byWeek[curKey] || archive.weeks[archive.weeks.length - 1];

  // ── Per-artist cumulative record across the archive ──
  // weeks charted, best rank ever, and how recently (weeks-ago index of last chart).
  const rec = {};   // normArtist -> { weeks, best, lastIdx, thisWeekBest }
  archive.weeks.forEach((wk, idx) => {
    const seen = new Set();
    for (const e of (wk.entries || [])) {
      for (const who of splitArtists(e.artist)) {
        if (!inRoster(who)) continue;
        const k = norm(who);
        const r = rec[k] ?? (rec[k] = { weeks: 0, best: 99, lastIdx: -1, thisWeekBest: null });
        if (!seen.has(k)) { r.weeks++; seen.add(k); }
        const rank = e.rank || 21;
        r.best = Math.min(r.best, rank);
        r.lastIdx = Math.max(r.lastIdx, idx);
        if (wk.week === curKey) r.thisWeekBest = Math.min(r.thisWeekBest ?? 99, rank);
      }
    }
  });
  const total = archive.weeks.length || 1;
  const maxWeeks = Math.max(1, ...Object.values(rec).map(r => r.weeks));

  // ── Score 0-100 from the chart record ──
  const byNameArtists = Object.fromEntries(artists.map(a => [a.name, a]));
  let supported = 0;
  for (const a of data.rankings) {
    const k = norm(a.name);
    const r = rec[k];
    if (!r) {
      a.tl_support_score = 0; a.tl_weeks_charted = 0; a.tl_chart_best = null; a.tl_chart_recent = false; a.tl_updated = new Date().toISOString();
      continue;
    }
    const weeksAgo = (total - 1) - r.lastIdx;                 // 0 = charted this week
    const consistency = (r.weeks / maxWeeks) * 100;           // breadth over the year
    const peak = Math.max(0, 21 - Math.min(r.best, 21)) / 20 * 100; // best position ever
    const recency = weeksAgo <= 1 ? 100 : weeksAgo <= 4 ? 75 : weeksAgo <= 12 ? 45 : 20;
    const tl = {
      tl_support_score: Math.round(consistency * 0.45 + peak * 0.35 + recency * 0.20),
      tl_weeks_charted: r.weeks,
      tl_chart_best: r.best <= 20 ? r.best : null,            // best position ever
      tl_chart_now: r.thisWeekBest && r.thisWeekBest <= 20 ? r.thisWeekBest : null, // on the chart this week
      tl_chart_recent: weeksAgo <= 4,
      tl_updated: new Date().toISOString(),
    };
    Object.assign(a, tl);
    if (byNameArtists[a.name]) Object.assign(byNameArtists[a.name], tl);
    if (tl.tl_support_score > 0) supported++;
  }

  // ── Public surface: current-week chart + dense "most-supported" leaderboard ──
  const topSupported = data.rankings
    .filter(a => a.tl_support_score > 0)
    .sort((x, y) => y.tl_support_score - x.tl_support_score || y.tl_weeks_charted - x.tl_weeks_charted)
    .slice(0, 50)
    .map(a => ({ name: a.name, slug: slugify(a.name), score: a.tl_support_score, weeks: a.tl_weeks_charted, best: a.tl_chart_best, now: !!a.tl_chart_now, recent: !!a.tl_chart_recent }));
  const publicChart = {
    week: currentWeek?.week, date: new Date().toISOString().slice(0, 10),
    weeks_archived: total, count: currentWeek?.entries?.length || 0,
    roster_hits: (currentWeek?.entries || []).filter(e => splitArtists(e.artist).some(inRoster)).length,
    roster_supported: supported,
    entries: (currentWeek?.entries || []).map(e => ({
      rank: e.rank, artist: e.artist, title: e.title, url: e.url,
      roster: splitArtists(e.artist).filter(inRoster).map(w => ({ name: inRoster(w).name, slug: slugify(inRoster(w).name) })),
    })),
    top_supported: topSupported,
  };
  fs.writeFileSync(PUBLIC_TL, JSON.stringify(publicChart));
  fs.writeFileSync(RANKINGS, JSON.stringify(data));
  fs.writeFileSync(ARTISTS, JSON.stringify(artists, null, 2));

  console.log(`1001TL: ${total} weeks archived (+${fetched} fetched) · ${supported}/${data.rankings.length} roster artists with DJ support (${Math.round(supported / data.rankings.length * 100)}%).`);
  topSupported.slice(0, 14).forEach(a => console.log(`  ${a.name.padEnd(22)} score ${String(a.score).padStart(3)} · ${a.weeks}wk · best #${a.best ?? "—"}${a.now ? " · on chart now" : a.recent ? " · recent" : ""}`));
}

main();
