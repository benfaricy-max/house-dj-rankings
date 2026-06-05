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
 * SET-CRAWL (re-enabled). The weekly chart is only the top 20 tracks/week, so it
 * catches a handful of roster artists. The set-crawl reads the ACTUAL tracklists
 * of recent sets (feed → tracklist detail) and counts how many recent sets each
 * roster artist is PLAYED in — far broader coverage. It was dropped earlier
 * because the feed "timed out" and "many sets returned empty tracklists"; the real
 * cause was a per-IP soft-block (the API served a 200 captcha shell that parsed as
 * empty). The interceptor now (a) detects that block and returns a retryable 503
 * instead of fake-empty, and (b) runs a cooled rate limit (8/min) so it stops
 * tripping. So the crawl is reliable now. It is additive + merge-safe: it only
 * LIFTS tl_support_score for artists played but not charting (never lowers a chart
 * score), accumulates across runs into a recency-pruned archive, backs off on 503,
 * and is capped per run so coverage builds over nightly runs. Disable: TL_SETCRAWL=0.
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
const SETPLAYS = path.join(__dirname, "tracklists-setplays.json");
const PUBLIC_TL = path.join(__dirname, "..", "frontend", "public", "tracklists.json");
const BASE = process.env.TL_API_BASE || "http://localhost:3001";
const BACKFILL_WEEKS = parseInt(process.env.TL_BACKFILL_WEEKS || "52", 10);
const SETCRAWL = process.env.TL_SETCRAWL !== "0";                          // re-enabled by default
const SETCRAWL_CAP = parseInt(process.env.TL_SETCRAWL_SETS || "150", 10);  // NEW sets crawled per run
const SETPLAYS_WINDOW_D = 60;                                              // "recent" set-play window
const SETPLAYS_KEEP = 800;                                                 // retained sets (file-size bound)

const norm = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const slugify = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const splitArtists = s => (s || "").split(/\s+(?:vs\.?|&|x|ft\.?|feat\.?|featuring|with|\+|,|\/)\s+/i).map(t => t.trim()).filter(Boolean);
const delay = ms => new Promise(r => setTimeout(r, ms));

// A 503 from our interceptor means the source soft-blocked our IP (rate-limited).
// Surface it as a typed error so callers can BACK OFF and keep existing data
// (PERMANENT RULE #1) rather than treating a block as real/empty.
class Blocked extends Error { constructor() { super("rate_limited"); this.name = "Blocked"; } }
const get = async p => {
  try { return (await axios.get(`${BASE}${p}`, { timeout: 20000 })).data; }
  catch (e) { if (e.response?.status === 503) throw new Blocked(); throw e; }
};
const dateFromUrl = u => (String(u || "").match(/(\d{4}-\d{2}-\d{2})/) || [])[1] || new Date().toISOString().slice(0, 10);

/**
 * Set-crawl: page the feed for NEW (uncrawled) tracklist ids, fetch each set's
 * tracklist, and record which roster artists are played. Merge-safe + block-aware:
 * accumulates into a recency-pruned archive, dedups by tracklist id across runs,
 * and STOPS on the first 503 (keeping everything gathered so far). Returns a
 * per-artist map: normName -> { recent, total, lastSeen }.
 */
async function setCrawl(inRoster) {
  let sp = { sets: {}, updated: null };
  try { sp = JSON.parse(fs.readFileSync(SETPLAYS, "utf8")); } catch {}
  if (!sp.sets) sp.sets = {};

  // 1) Collect NEW tracklist ids from /latest + /feed pagination (skip already-crawled).
  const ids = [];
  const pushNew = items => { for (const it of (items || [])) if (it.id && !sp.sets[it.id]) ids.push(it.id); };
  let blocked = false;
  try {
    const latest = await get(`/api/1001tracklists/latest`);
    pushNew(latest.items);
    let cursor = latest.nextCursor, guard = 0;
    while (cursor && ids.length < SETCRAWL_CAP && guard++ < 80) {
      const page = await get(`/api/1001tracklists/feed?pos=${cursor.pos}&id=${encodeURIComponent(cursor.id)}&count=20`);
      if (!(page.items || []).length) break;
      pushNew(page.items);
      cursor = page.nextCursor;
      await delay(120);
    }
  } catch (e) { if (e instanceof Blocked) blocked = true; /* else: feed seed failed → nothing new to crawl */ }

  // 2) Crawl each NEW set's tracklist; record roster plays. Mark every fetched id
  //    crawled (even empty/404) so we never re-spend on it. Back off on 503.
  let crawled = 0;
  for (const id of ids.slice(0, SETCRAWL_CAP)) {
    if (blocked) break;
    try {
      const tl = await get(`/api/1001tracklists/tracklist/${id}`);
      const roster = new Set();
      for (const t of (tl.tracks || [])) for (const who of splitArtists(t.artist)) { if (inRoster(who)) roster.add(norm(who)); }
      sp.sets[id] = { date: dateFromUrl(tl.url), artists: [...roster] };
      crawled++;
      await delay(120);
    } catch (e) {
      if (e instanceof Blocked) { blocked = true; break; }                 // keep data, stop
      sp.sets[id] = { date: new Date().toISOString().slice(0, 10), artists: [] }; // 404/empty: don't retry forever
    }
  }

  // 3) Prune to the most-recent SETPLAYS_KEEP sets (bounds file size + enforces recency).
  const kept = Object.entries(sp.sets)
    .sort((a, b) => (b[1].date || "").localeCompare(a[1].date || ""))
    .slice(0, SETPLAYS_KEEP);
  sp.sets = Object.fromEntries(kept);
  sp.updated = new Date().toISOString();
  fs.writeFileSync(SETPLAYS, JSON.stringify(sp));

  // 4) Per-artist counts: total retained sets + sets within the recency window.
  const cutoff = new Date(Date.now() - SETPLAYS_WINDOW_D * 864e5).toISOString().slice(0, 10);
  const plays = {};
  for (const [, s] of kept) {
    for (const k of (s.artists || [])) {
      const p = plays[k] ?? (plays[k] = { recent: 0, total: 0, lastSeen: null });
      p.total++;
      if (s.date >= cutoff) p.recent++;
      if (!p.lastSeen || s.date > p.lastSeen) p.lastSeen = s.date;
    }
  }
  console.log(`1001TL set-crawl: +${crawled} new sets (${kept.length} retained) · ${Object.keys(plays).length} roster artists played${blocked ? " · stopped early (rate-limited, kept data)" : ""}`);
  return plays;
}

/** Set-play support floor 0-45 (kept below chart ceiling so charting still dominates). */
const setFloor = sp => (sp ? Math.min(45, Math.round(sp.recent * 6 + Math.min(sp.total, 20))) : 0);

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
  catch (e) {
    // A soft-block (503) means the API is UP but our IP is rate-limited — proceed
    // (the chart loop preserves data, the set-crawl backs off). Only a true
    // unreachable (connection refused / DNS / timeout) should skip the whole run.
    if (!(e instanceof Blocked)) { console.log(`1001Tracklists API unreachable at ${BASE} (${e.code || e.message}) — keeping existing tl_* data. Skipping.`); return; }
    console.log(`1001Tracklists API reachable but IP soft-blocked — proceeding with back-off; existing data preserved.`);
  }

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

  // ── Set-crawl: broaden coverage beyond the top-20 chart with who's actually
  //    PLAYED in recent sets. Additive, merge-safe, block-aware (see setCrawl). ──
  const plays = SETCRAWL ? await setCrawl(inRoster) : {};
  const setCutoff = new Date(Date.now() - SETPLAYS_WINDOW_D * 864e5).toISOString().slice(0, 10);

  // ── Score 0-100 from the chart record, LIFTED by set-play coverage ──
  const byNameArtists = Object.fromEntries(artists.map(a => [a.name, a]));
  let supported = 0;
  for (const a of data.rankings) {
    const k = norm(a.name);
    const r = rec[k];
    const sp = plays[k];
    const floor = setFloor(sp);                              // 0-45 from recent set-plays
    const setFields = {
      tl_setplays_recent: sp?.recent || 0,
      tl_setplays_total: sp?.total || 0,
      tl_set_recent: !!(sp && sp.lastSeen && sp.lastSeen >= setCutoff),
    };
    if (!r) {
      // No chart record → support is set-play-only (0 if never played). Derived from
      // the preserved set archive, not a transient fetch, so this is merge-safe.
      const tl = {
        tl_support_score: floor,
        tl_weeks_charted: 0, tl_chart_best: null, tl_chart_now: null, tl_chart_recent: false,
        ...setFields, tl_updated: new Date().toISOString(),
      };
      Object.assign(a, tl);
      if (byNameArtists[a.name]) Object.assign(byNameArtists[a.name], tl);
      if (tl.tl_support_score > 0) supported++;
      continue;
    }
    const weeksAgo = (total - 1) - r.lastIdx;                 // 0 = charted this week
    const consistency = (r.weeks / maxWeeks) * 100;           // breadth over the year
    const peak = Math.max(0, 21 - Math.min(r.best, 21)) / 20 * 100; // best position ever
    const recency = weeksAgo <= 1 ? 100 : weeksAgo <= 4 ? 75 : weeksAgo <= 12 ? 45 : 20;
    const chartScore = Math.round(consistency * 0.45 + peak * 0.35 + recency * 0.20);
    const tl = {
      tl_support_score: Math.max(chartScore, floor),         // LIFT-only: set-plays never lower a chart score
      tl_weeks_charted: r.weeks,
      tl_chart_best: r.best <= 20 ? r.best : null,            // best position ever
      tl_chart_now: r.thisWeekBest && r.thisWeekBest <= 20 ? r.thisWeekBest : null, // on the chart this week
      tl_chart_recent: weeksAgo <= 4,
      ...setFields,
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
    .map(a => ({ name: a.name, slug: slugify(a.name), score: a.tl_support_score, weeks: a.tl_weeks_charted, best: a.tl_chart_best, now: !!a.tl_chart_now, recent: !!a.tl_chart_recent, sets: a.tl_setplays_recent || 0, set_recent: !!a.tl_set_recent }));
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

  const viaSetsOnly = data.rankings.filter(a => a.tl_support_score > 0 && !a.tl_weeks_charted).length;
  console.log(`1001TL: ${total} weeks archived (+${fetched} fetched) · ${supported}/${data.rankings.length} roster artists with DJ support (${Math.round(supported / data.rankings.length * 100)}%)${SETCRAWL ? ` · ${viaSetsOnly} via set-crawl only` : ""}.`);
  topSupported.slice(0, 14).forEach(a => console.log(`  ${a.name.padEnd(22)} score ${String(a.score).padStart(3)} · ${a.weeks}wk · best #${a.best ?? "—"}${a.now ? " · on chart now" : a.recent ? " · recent" : ""}${a.sets ? ` · ${a.sets} recent sets` : ""}`));
}

main();
