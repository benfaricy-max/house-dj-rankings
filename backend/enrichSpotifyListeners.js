/**
 * Spotify monthly-listeners via the Interceptor pipeline (replaces the fragile
 * puppeteer scrape in fetchSpotifyScrape.js).
 *
 * The Interceptor project (../intercept) exposes a robust Spotify route that
 * drives a real web-player session (TOTP-gated token harvested automatically)
 * and reads monthly listeners straight from the internal GraphQL "pathfinder"
 * API — far more reliable than scraping the artist page HTML, and it covers
 * EVERY artist (kworb only covers the global top-2500).
 *
 * Local only: needs the Interceptor API + a connected `spotify` browser:
 *   cd ../intercept
 *   pnpm dev
 *   ./scripts/connect-browser.sh --profile spotify --url https://open.spotify.com
 * Then here:
 *   node backend/enrichSpotifyListeners.js [limit]
 *
 * ⛔ Merge-safe (PERMANENT RULE #1): only overwrites monthly_listeners /
 * followers when the API returns a real (>0) value. A failed/empty fetch keeps
 * the existing number. Marks listener_source="intercept" so generateStatic.js
 * computes listener-growth from this series (it prefers history/intercept over
 * the kworb fallback).
 */

const fs = require("fs");
const path = require("path");

const RANKINGS = path.join(__dirname, "..", "frontend", "public", "rankings.json");
const API = process.env.INTERCEPT_API ?? "http://localhost:3001";
const LIMIT = Number(process.argv[2]) || Infinity;
const SAVE_EVERY = 20;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchArtist(id) {
  const res = await fetch(`${API}/api/spotify/artist/${id}`, { signal: AbortSignal.timeout(45000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const d = await res.json();
  if (d.error) throw new Error(d.error);
  return d;
}

(async () => {
  // Preflight: make sure the Interceptor API is reachable before touching data.
  try {
    const ping = await fetch(`${API}/api/spotify/auth/status`, { signal: AbortSignal.timeout(5000) });
    if (!ping.ok) throw new Error(`status ${ping.status}`);
  } catch (e) {
    console.error(
      `✖ Interceptor API not reachable at ${API} (${e.message}).\n` +
        `  Start it: cd ../intercept && pnpm dev, then connect the spotify browser.`,
    );
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(RANKINGS, "utf8"));
  const today = new Date().toISOString().slice(0, 10);
  const eligible = data.rankings.filter((a) => /^[A-Za-z0-9]{22}$/.test(a.spotify_id || ""));
  // Resumable: skip artists already refreshed from intercept today (set FORCE=1 to
  // re-pull everyone). Lets a crashed run be re-run cheaply for just the remainder.
  const force = process.env.FORCE === "1";
  const artists = force
    ? eligible
    : eligible.filter((a) => !(a.listener_source === "intercept" && a.listener_intercept_at === today));
  const targets = artists.slice(0, LIMIT === Infinity ? artists.length : LIMIT);
  console.log(`${targets.length} to fetch (${eligible.length - artists.length} already fresh today).`);

  let ok = 0;
  let kept = 0;
  let i = 0;
  for (const a of targets) {
    i++;
    try {
      const o = await fetchArtist(a.spotify_id);
      // Merge-safe: only assign real values; never wipe good data.
      if (o.monthlyListeners > 0) {
        a.spotify_monthly_listeners = o.monthlyListeners;
        a.listener_source = "intercept";
        a.listener_intercept_at = today; // resume marker
        ok++;
      } else {
        kept++;
      }
      if (o.followers > 0) a.spotify_followers = o.followers;
      if (Number.isFinite(o.worldRank)) a.spotify_world_rank = o.worldRank;
      if (i % 25 === 0 || i === targets.length) {
        process.stdout.write(`  [${i}/${targets.length}] ${a.name}: ${o.monthlyListeners?.toLocaleString() ?? "—"}\n`);
      }
    } catch (e) {
      kept++; // keep existing value on any failure (rule #1)
      if (i % 25 === 0) process.stdout.write(`  [${i}/${targets.length}] ${a.name}: kept (${e.message})\n`);
    }
    // Progressive save so a mid-run crash never loses captured data.
    if (i % SAVE_EVERY === 0) fs.writeFileSync(RANKINGS, JSON.stringify(data));
    await sleep(150); // gentle; the Interceptor side also rate-limits to 20/min
  }

  fs.writeFileSync(RANKINGS, JSON.stringify(data));
  console.log(`\nintercept listeners: updated ${ok}, kept ${kept} (of ${targets.length}).`);
})();
