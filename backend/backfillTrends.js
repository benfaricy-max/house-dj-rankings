/**
 * Google Trends 12-month backfill (Option 5).
 * One request per artist (timeframe today 12-m) → ~52 weekly points = full year line.
 * RESUMABLE: skips artists backfilled within STALE_DAYS, so re-runs complete the set.
 * RATE-LIMIT-AWARE: paces slowly, backs off on 429, stops cleanly after a streak of
 *   failures (Google throttles by IP) — just run again later to continue.
 * MERGE-SAFE: only writes on success; never wipes existing data (per CLAUDE.md).
 *
 * Stores full series in data/trends_history.json; writes trends_12m + momentum
 * fields into rankings.json + artists.json for the frontend.
 */
const { spawn } = require("child_process");
const fs   = require("fs");
const path = require("path");

const RANKINGS = path.join(__dirname, "..", "frontend", "public", "rankings.json");
const ARTISTS  = path.join(__dirname, "artists.json");
const HIST     = path.join(__dirname, "data", "trends_history.json");
const SCRIPT   = path.join(__dirname, "trends12m.py");

const STALE_DAYS    = 20;
const BASE_DELAY_MS = 5000;
const MAX_FAIL_STREAK = 6;   // consecutive failures → assume throttled, stop & resume later

const rankData   = JSON.parse(fs.readFileSync(RANKINGS, "utf8"));
const artists    = JSON.parse(fs.readFileSync(ARTISTS, "utf8"));
const artistById = Object.fromEntries(artists.map(a => [a.name, a]));
let history = {};
try { history = JSON.parse(fs.readFileSync(HIST, "utf8")); } catch {}

const delay = ms => new Promise(r => setTimeout(r, ms));
const jitter = () => Math.floor(Math.random() * 3000);

function fetchYear(name) {
  return new Promise(resolve => {
    const py = spawn("python3", [SCRIPT, name]);
    let out = "";
    const timer = setTimeout(() => { py.kill(); resolve({ error: "timeout" }); }, 30000);
    py.stdout.on("data", d => out += d.toString());
    py.stderr.on("data", () => {});
    py.on("close", () => { clearTimeout(timer); try { resolve(JSON.parse(out.trim())); } catch { resolve({ error: "parse" }); } });
    py.on("error", () => { clearTimeout(timer); resolve({ error: "spawn" }); });
  });
}

function isFresh(name) {
  const h = history[name];
  if (!h?.updated) return false;
  return (Date.now() - new Date(h.updated).getTime()) < STALE_DAYS * 864e5;
}

(async () => {
  const queue = rankData.rankings.filter(d => !isFresh(d.name));   // rank order, freshest skipped
  console.log(`Backfilling 12-mo Trends for ${queue.length} artists (skipping ${rankData.rankings.length - queue.length} fresh)…`);
  let done = 0, ok = 0, failStreak = 0, backoff = BASE_DELAY_MS;

  for (const dj of queue) {
    const res = await fetchYear(dj.name);
    done++;

    if (res && Array.isArray(res.series) && res.series.length) {
      history[dj.name] = { updated: new Date().toISOString(), ...res };
      const fields = {
        trends_12m: res.series.map(s => s.v),
        google_trends_score: res.current,
        google_trends_direction: res.direction,
        trends_mom_4w: res.mom_4w_pct,
        trends_mom_12w: res.mom_12w_pct,
        trends_peak: res.peak,
      };
      Object.assign(dj, fields);
      if (artistById[dj.name]) artistById[dj.name].trends_mom_12w = res.mom_12w_pct;
      ok++; failStreak = 0; backoff = BASE_DELAY_MS;
      if (ok % 5 === 0) {
        fs.writeFileSync(HIST, JSON.stringify(history));
        fs.writeFileSync(RANKINGS, JSON.stringify(rankData));
        process.stdout.write(`\r${done}/${queue.length} | ${ok} backfilled   `);
      }
    } else {
      failStreak++;
      const is429 = /429/.test(res?.error || "") || res?.error === "timeout";
      if (is429) backoff = Math.min(backoff * 1.7, 60000);
      if (failStreak >= MAX_FAIL_STREAK) {
 console.log(`\n⚠️ ${failStreak} failures in a row, Google is throttling. Saving progress and stopping. Re-run later to continue.`);
        break;
      }
    }
    await delay(backoff + jitter());
  }

  fs.mkdirSync(path.dirname(HIST), { recursive: true });
  fs.writeFileSync(HIST, JSON.stringify(history));
  fs.writeFileSync(RANKINGS, JSON.stringify(rankData));
  fs.writeFileSync(ARTISTS, JSON.stringify(artists, null, 2));
  const total = Object.keys(history).length;
  console.log(`\nDone this run: +${ok}. Total artists with 12-mo history: ${total}/${rankData.rankings.length}.`);
})();
