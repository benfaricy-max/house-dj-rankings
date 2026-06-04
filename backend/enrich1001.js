/**
 * 1001Tracklists DJ-Support signal — the truest peak-time scene signal.
 *
 * 1001Tracklists' weekly chart ranks the tracks DJs are actually PLAYING in their
 * sets (not sales, not streams). Charting here means the scene's tastemakers are
 * spinning your music right now — the hardest signal to game and the one bookers
 * and labels watch. We match our roster against the weekly chart, score it, and
 * archive weekly snapshots so a cumulative "weeks charted" record builds over time.
 *
 * Source: a local 1001Tracklists API (default http://localhost:3001, override with
 * TL_API_BASE). Not reachable in CI → the script no-ops gracefully and the
 * already-committed tl_* fields + archive persist (merge-safe per CLAUDE.md).
 *
 * Run: node backend/enrich1001.js
 */
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const RANKINGS = path.join(__dirname, "..", "frontend", "public", "rankings.json");
const ARTISTS  = path.join(__dirname, "artists.json");
const ARCHIVE  = path.join(__dirname, "tracklists-archive.json");   // committed weekly history
const BASE = process.env.TL_API_BASE || "http://localhost:3001";

const norm = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
// Split a combined credit ("Dom Dolla & Tiga", "A vs. B ft. C") into individual artists.
const splitArtists = s => (s || "").split(/\s+(?:vs\.?|&|x|ft\.?|feat\.?|featuring|with|\+|,|\/)\s+/i).map(t => t.trim()).filter(Boolean);

function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const ys = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return `${t.getUTCFullYear()}-W${String(Math.ceil((((t - ys) / 864e5) + 1) / 7)).padStart(2, "0")}`;
}

async function main() {
  let chart;
  try {
    chart = (await axios.get(`${BASE}/api/1001tracklists/chart/weekly`, { timeout: 12000 })).data;
  } catch (e) {
    console.log(`1001Tracklists API unreachable at ${BASE} (${e.code || e.message}) — keeping existing tl_* data. Skipping.`);
    return;
  }
  const entries = (chart?.entries || []).filter(e => e.artist && e.title);
  if (!entries.length) { console.log("Empty chart — skipping."); return; }

  const data = JSON.parse(fs.readFileSync(RANKINGS, "utf8"));
  const artists = JSON.parse(fs.readFileSync(ARTISTS, "utf8"));
  const rosterByNorm = {};
  for (const a of data.rankings) rosterByNorm[norm(a.name)] = a;

  // ── Archive this week's chart (one snapshot per ISO week, keep ~16 weeks) ──
  let archive = { weeks: [] };
  try { archive = JSON.parse(fs.readFileSync(ARCHIVE, "utf8")); } catch {}
  if (!Array.isArray(archive.weeks)) archive.weeks = [];
  const week = isoWeek();
  const snapshot = { week, date: new Date().toISOString().slice(0, 10), entries: entries.map(e => ({ rank: e.rank, artist: e.artist, title: e.title, trackId: e.trackId })) };
  const ix = archive.weeks.findIndex(w => w.week === week);
  if (ix >= 0) archive.weeks[ix] = snapshot; else archive.weeks.push(snapshot);
  archive.weeks = archive.weeks.slice(-16);
  archive.updated = new Date().toISOString();
  fs.writeFileSync(ARCHIVE, JSON.stringify(archive));

  // ── Per-artist support: best chart rank + charting track count THIS week,
  //    plus cumulative weeks-charted across the whole archive. ──
  const thisWeek = {};   // normArtist -> { best, tracks:[{title,rank}] }
  for (const e of entries) {
    const rank = e.rank || 21;   // unranked entries sit just outside the top 20
    for (const who of splitArtists(e.artist)) {
      const k = norm(who);
      if (!rosterByNorm[k]) continue;
      const rec = thisWeek[k] ?? (thisWeek[k] = { best: 99, tracks: [] });
      rec.best = Math.min(rec.best, rank);
      rec.tracks.push({ title: e.title, rank: e.rank });
    }
  }
  // cumulative weeks charted (distinct weeks an artist appeared, across archive)
  const weeksCharted = {};
  for (const w of archive.weeks) {
    const seen = new Set();
    for (const e of (w.entries || [])) for (const who of splitArtists(e.artist)) seen.add(norm(who));
    for (const k of seen) weeksCharted[k] = (weeksCharted[k] || 0) + 1;
  }

  const byNameArtists = Object.fromEntries(artists.map(a => [a.name, a]));
  let hits = 0;
  for (const a of data.rankings) {
    const k = norm(a.name);
    const rec = thisWeek[k];
    const weeks = weeksCharted[k] || 0;
    if (rec) {
      // Score 0-100: chart position (top of a 20-deep chart) 70% + track breadth 30%.
      const positionScore = Math.max(0, 21 - Math.min(rec.best, 21)) / 20 * 100;
      const breadth = Math.min(rec.tracks.length, 3) / 3 * 100;
      const tl = {
        tl_support_score: Math.round(positionScore * 0.7 + breadth * 0.3),
        tl_chart_best: rec.best <= 20 ? rec.best : null,
        tl_chart_tracks: rec.tracks.length,
        tl_chart_titles: rec.tracks.sort((x, y) => (x.rank || 99) - (y.rank || 99)).slice(0, 3).map(t => t.title),
        tl_weeks_charted: weeks,
        tl_updated: new Date().toISOString(),
      };
      Object.assign(a, tl);
      if (byNameArtists[a.name]) Object.assign(byNameArtists[a.name], tl);
      hits++;
    } else {
      // Not on this week's chart. Keep cumulative weeks-charted (history), but clear
      // the current-week fields so a stale "charting now" never lingers.
      a.tl_support_score = null; a.tl_chart_best = null; a.tl_chart_tracks = null; a.tl_chart_titles = null;
      a.tl_weeks_charted = weeks || a.tl_weeks_charted || 0;
    }
  }

  // ── Public chart file for the frontend "What DJs Are Playing" surface ──
  // Resolve each track's credited artists to roster matches (name + slug) so the
  // UI can link them; non-roster acts render plain (and double as expansion leads).
  const slugify = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const PUBLIC_TL = path.join(__dirname, "..", "frontend", "public", "tracklists.json");
  const publicChart = {
    week, date: snapshot.date, count: entries.length,
    roster_hits: hits,
    entries: entries.map(e => ({
      rank: e.rank, artist: e.artist, title: e.title, url: e.url,
      roster: splitArtists(e.artist).filter(w => rosterByNorm[norm(w)]).map(w => ({ name: rosterByNorm[norm(w)].name, slug: slugify(rosterByNorm[norm(w)].name) })),
    })),
  };
  fs.writeFileSync(PUBLIC_TL, JSON.stringify(publicChart));

  fs.writeFileSync(RANKINGS, JSON.stringify(data));
  fs.writeFileSync(ARTISTS, JSON.stringify(artists, null, 2));
  console.log(`1001Tracklists: ${entries.length} chart tracks → ${hits} roster artists charting this week (${week}). Archive: ${archive.weeks.length} week(s).`);
  data.rankings.filter(a => a.tl_support_score > 0).sort((x, y) => y.tl_support_score - x.tl_support_score).slice(0, 12)
    .forEach(a => console.log(`  ${a.name.padEnd(22)} support ${a.tl_support_score} (best #${a.tl_chart_best ?? "—"}, ${a.tl_chart_tracks} track(s), ${a.tl_weeks_charted}wk)`));
}

main();
