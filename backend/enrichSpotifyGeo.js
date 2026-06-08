/**
 * Spotify audience geography ("where people listen") via the Interceptor.
 *
 * Pulls each artist's top listener cities from the same Interceptor artist-overview
 * route used for monthly listeners (it now returns `topCities`), and derives a
 * `scene_geography` score (0-100): the share of an artist's top-city listeners that
 * sit in the core electronic-music credibility markets (Ibiza/Spain, Berlin/Germany,
 * Amsterdam/NL, UK, Italy, France, Belgium + festival hubs).
 *
 * WHY: the ranking's reach signals (streaming, search) skew toward wherever an act is
 * popular, which over-credits US-pop acts vs. acts with genuine European/Ibiza
 * standing. Audience geography is the honest "international appeal" read — and unlike
 * RA booking countries (sparse for festival acts), Spotify top-cities covers everyone
 * with listeners. This signal is the durable fix; the artist-card "Scene Geography"
 * strip surfaces `spotify_top_cities` directly.
 *
 * Local only: needs the Interceptor API + a connected `spotify` browser (see
 * enrichSpotifyListeners.js for the setup). Run:  node backend/enrichSpotifyGeo.js [limit]
 *
 * ⛔ Merge-safe (PERMANENT RULE #1): only writes spotify_top_cities / scene_geography
 * when the API returns real cities. A failed/empty fetch keeps the existing values.
 *
 * NOTE: keep CORE_CITIES / CORE_COUNTRIES in sync with frontend/src/methodology.jsx
 * (sceneGeography) so the card strip and the score agree.
 */

const fs = require("fs");
const path = require("path");
const { acquireLock } = require("./scriptLock");

const RANKINGS = path.join(__dirname, "..", "frontend", "public", "rankings.json");
const API = process.env.INTERCEPT_API ?? "http://localhost:3001";
const LIMIT = Number(process.argv[2]) || Infinity;
const SAVE_EVERY = 20;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Core electronic-music credibility markets (mirror of methodology.jsx).
const CORE_COUNTRIES = new Set(["Spain", "Germany", "Netherlands", "United Kingdom", "Italy", "France", "Belgium", "Croatia", "Switzerland", "Austria", "Georgia", "Serbia", "Czechia", "Czech Republic", "Portugal", "Greece", "Poland", "Ireland"]);
const CORE_CITIES = new Set(["Ibiza", "Berlin", "Amsterdam", "London", "Barcelona", "Milan", "Paris", "Brussels", "Manchester", "Naples", "Rome", "Cologne", "Frankfurt", "Hamburg", "Munich", "Tbilisi", "Belgrade", "Zurich", "Vienna", "Madrid", "Rotterdam", "Bristol", "Glasgow", "Leeds", "Lisbon", "Athens", "Warsaw", "Prague", "Lyon", "Valencia", "Sheffield", "Nottingham", "Dublin"]);

// Audience core-market share, 0-100, weighted by listeners per city.
function sceneGeographyScore(cities) {
  let core = 0;
  let total = 0;
  for (const c of cities) {
    const n = c.listeners || 0;
    if (n <= 0) continue;
    total += n;
    if (CORE_CITIES.has(c.city) || CORE_COUNTRIES.has(c.country)) core += n;
  }
  return total > 0 ? Math.round((core / total) * 100) : null;
}

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

  acquireLock("rankings-write"); // refuse to run if another data writer is active
  const data = JSON.parse(fs.readFileSync(RANKINGS, "utf8"));
  const today = new Date().toISOString().slice(0, 10);
  const eligible = data.rankings.filter((a) => /^[A-Za-z0-9]{22}$/.test(a.spotify_id || ""));
  // Resumable: skip artists already refreshed today (set FORCE=1 to re-pull all).
  const force = process.env.FORCE === "1";
  const targets = (force ? eligible : eligible.filter((a) => a.geo_intercept_at !== today))
    .slice(0, LIMIT === Infinity ? Infinity : LIMIT);
  console.log(`${targets.length} to fetch (${eligible.length - targets.length} already fresh today).`);

  let ok = 0;
  let kept = 0;
  let i = 0;
  for (const a of targets) {
    i++;
    try {
      const o = await fetchArtist(a.spotify_id);
      const cities = Array.isArray(o.topCities)
        ? o.topCities.filter((c) => c && c.city).map((c) => ({ city: c.city, country: c.country ?? null, listeners: c.listeners ?? null }))
        : [];
      // Merge-safe: only assign when the API actually returned cities.
      if (cities.length > 0) {
        a.spotify_top_cities = cities;
        const score = sceneGeographyScore(cities);
        if (score !== null) a.scene_geography = score;
        a.geo_intercept_at = today; // resume marker
        a.geo_updated = new Date().toISOString();
        ok++;
      } else {
        kept++; // no city data returned — keep whatever exists
      }
      if (i % 25 === 0 || i === targets.length) {
        process.stdout.write(`  [${i}/${targets.length}] ${a.name}: geo ${a.scene_geography ?? "—"} (${cities.length} cities)\n`);
      }
    } catch (e) {
      kept++; // keep existing values on any failure (rule #1)
      if (i % 25 === 0) process.stdout.write(`  [${i}/${targets.length}] ${a.name}: kept (${e.message})\n`);
    }
    if (i % SAVE_EVERY === 0) fs.writeFileSync(RANKINGS, JSON.stringify(data));
    await sleep(150); // gentle; the Interceptor also rate-limits to 20/min
  }

  fs.writeFileSync(RANKINGS, JSON.stringify(data));
  console.log(`\nintercept geo: updated ${ok}, kept ${kept} (of ${targets.length}).`);
})();
