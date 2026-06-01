/**
 * Google Trends 12-month backfill — ANCHORED BATCH version (5× fewer requests).
 *
 * Queries 5 terms per request: [ANCHOR, artist1..4]. Because Google normalizes a
 * batch so its max = 100, we rescale every artist by the anchor's level in the same
 * batch → values become comparable across batches (an anchored common scale).
 *
 * RESUMABLE (skips fresh), RATE-LIMIT-AWARE (backoff + stop on streak),
 * MERGE-SAFE (only writes on success; never wipes — per CLAUDE.md).
 */
const { spawn } = require("child_process");
const fs   = require("fs");
const path = require("path");

const RANKINGS = path.join(__dirname, "..", "frontend", "public", "rankings.json");
const ARTISTS  = path.join(__dirname, "artists.json");
const HIST     = path.join(__dirname, "data", "trends_history.json");
const SCRIPT   = path.join(__dirname, "trendsBatch.py");

const ANCHOR        = "Carl Cox";   // stable, well-searched dance anchor
const ANCHOR_BASE   = 50;           // anchor maps to this baseline on the common scale
const STALE_DAYS    = 20;
const BASE_DELAY_MS = 6000;
const MAX_FAIL_STREAK = 5;

const rankData   = JSON.parse(fs.readFileSync(RANKINGS, "utf8"));
const artists    = JSON.parse(fs.readFileSync(ARTISTS, "utf8"));
const artistById = Object.fromEntries(artists.map(a => [a.name, a]));
let history = {};
try { history = JSON.parse(fs.readFileSync(HIST, "utf8")); } catch {}

const delay  = ms => new Promise(r => setTimeout(r, ms));
const jitter = () => Math.floor(Math.random() * 3000);
const mean   = a => (a && a.length) ? a.reduce((s, v) => s + v, 0) / a.length : 0;
const clamp  = v => Math.max(0, Math.min(100, Math.round(v)));
const pct    = (a, b) => (b && b > 0) ? Math.round((a - b) / b * 1000) / 10 : 0;

function runBatch(terms) {
  return new Promise(resolve => {
    const py = spawn("python3", [SCRIPT, ...terms]);
    let out = "";
    const timer = setTimeout(() => { py.kill(); resolve({ error: "timeout" }); }, 35000);
    py.stdout.on("data", d => out += d.toString());
    py.stderr.on("data", () => {});
    py.on("close", () => { clearTimeout(timer); try { resolve(JSON.parse(out.trim())); } catch { resolve({ error: "parse" }); } });
    py.on("error", () => { clearTimeout(timer); resolve({ error: "spawn" }); });
  });
}

const isFresh = name => {
  const h = history[name];
  return h?.updated && (Date.now() - new Date(h.updated).getTime()) < STALE_DAYS * 864e5;
};

function applyArtist(dj, rawSeries, factor, weeks) {
  const series = rawSeries.map(v => clamp(v * factor));
  const n = series.length;
  const recent4  = mean(series.slice(-4));
  const prior4   = n >= 8 ? mean(series.slice(-8, -4)) : recent4;
  const recent12 = n >= 12 ? mean(series.slice(-12)) : null;
  const prior12  = n >= 24 ? mean(series.slice(-24, -12)) : null;
  const fields = {
    trends_12m: series,
    google_trends_score: Math.round(recent4 * 10) / 10,
    google_trends_direction: series[n - 1] > series[0] ? "up" : series[n - 1] < series[0] ? "down" : "flat",
    trends_mom_4w: pct(recent4, prior4),
    trends_mom_12w: (recent12 != null && prior12 != null) ? pct(recent12, prior12) : 0,
    trends_peak: Math.max(...series),
  };
  Object.assign(dj, fields);
  if (artistById[dj.name]) artistById[dj.name].trends_mom_12w = fields.trends_mom_12w;
  history[dj.name] = { updated: new Date().toISOString(), series: series.map((v, i) => ({ w: weeks[i], v })), ...fields, trends_12m: undefined };
}

function save() {
  fs.mkdirSync(path.dirname(HIST), { recursive: true });
  fs.writeFileSync(HIST, JSON.stringify(history));
  fs.writeFileSync(RANKINGS, JSON.stringify(rankData));
  fs.writeFileSync(ARTISTS, JSON.stringify(artists, null, 2));
}

(async () => {
  const todo = rankData.rankings.filter(d => d.name !== ANCHOR && !isFresh(d.name));
  const batches = [];
  for (let i = 0; i < todo.length; i += 4) batches.push(todo.slice(i, i + 4));
  console.log(`Anchored-batch backfill: ${todo.length} artists in ${batches.length} batches (anchor: ${ANCHOR})…`);

  let ok = 0, failStreak = 0, backoff = BASE_DELAY_MS;
  for (const [bi, batch] of batches.entries()) {
    const termOf = d => d.search_alias || d.name; // disambiguate common names
    const terms = [ANCHOR, ...batch.map(termOf)];
    const res = await runBatch(terms);

    const anchorRaw = res && !res.error ? res[ANCHOR] : null;
    if (anchorRaw && anchorRaw.length) {
      const anchorLevel = mean(anchorRaw);
      const factor = anchorLevel >= 5 ? (ANCHOR_BASE / anchorLevel) : 1;
      const weeks = res._weeks || [];
      for (const dj of batch) {
        const raw = res[termOf(dj)];
        if (raw && raw.length) { applyArtist(dj, raw, factor, weeks); ok++; }
      }
      failStreak = 0; backoff = BASE_DELAY_MS;
      save();
      process.stdout.write(`\rbatch ${bi + 1}/${batches.length} | ${ok} backfilled   `);
    } else {
      failStreak++;
      const throttled = /429/.test(res?.error || "") || res?.error === "timeout";
      if (throttled) backoff = Math.min(backoff * 1.8, 90000);
      if (failStreak >= MAX_FAIL_STREAK) {
        console.log(`\n⚠️  ${failStreak} batches failed in a row — Google throttling. Progress saved; re-run later to continue.`);
        break;
      }
    }
    await delay(backoff + jitter());
  }

  save();
  console.log(`\nThis run: +${ok}. Total with 12-mo history: ${Object.keys(history).length}/${rankData.rankings.length}.`);
})();
