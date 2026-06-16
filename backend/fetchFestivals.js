/**
 * fetchFestivals.js — populate backend/festival_lineups.json from real bookings.
 *
 * APPROACH (act-centric, reuses the proven Songkick pipeline): rather than scrape
 * fragile per-festival lineup pages, we read each roster artist's Songkick events —
 * the same public ld+json MusicEvent data fetchTour already uses — and match each
 * event's `location.name`/`name` against a curated registry of MAJOR festivals.
 * Songkick surfaces the festival as the location (e.g. "Ultra Europe", "Sonar",
 * "Parookaville"), so an act booked on a festival shows up directly in their events.
 *
 * WHY a curated registry (not "any festival"): festival_score is meant to capture
 * MAJOR-stage demand, tier-weighted. We only count festivals we've classified
 * (T1 global flagship 1.0 / T2 major-regional 0.6); unknown small events are ignored.
 *
 * MERGE-SAFE (sacred rule): we start from the existing lineup file, and only REPLACE
 * an artist's festival memberships if THIS run fetched their events successfully. An
 * artist whose Songkick fetch fails/rate-limits keeps their prior memberships — a
 * failed fetch never wipes data. Output is festival → acts (computeFestivalScore's shape).
 *
 * USAGE:  node fetchFestivals.js [limit]   (limit = max artists to fetch, for testing)
 * Runs on plain HTTP (no key), so it's CI-safe. Pair with the daily refresh.
 */
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const ARTISTS_FILE  = path.join(__dirname, "artists.json");
const LINEUPS_FILE  = path.join(__dirname, "festival_lineups.json");
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36";
const norm = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const get = url => axios.get(url, { headers: { "User-Agent": UA }, timeout: 14000 });
const delay = ms => new Promise(r => setTimeout(r, ms));

// ── Festival registry ───────────────────────────────────────────────────────
// canonical name → { tier, match[] }. `match` are normalized substrings tested
// against an event's normalized location/name. Keep matches specific enough not to
// collide (e.g. "ultra" is fine — no other festival/venue normalizes to contain it
// in this set; "movement" paired with city guard would be safer but Detroit's
// "Movement" rarely false-positives in electronic bookings). T1 = global flagship.
const FESTIVALS = {
  "Tomorrowland":        { tier: 1.0, match: ["tomorrowland"] },
  "Ultra":               { tier: 1.0, match: ["ultramiami", "ultraeurope", "ultra"] },
  "Coachella":           { tier: 1.0, match: ["coachella"] },
  "EDC":                 { tier: 1.0, match: ["edclasvegas", "electricdaisycarnival", "edcorlando", "edcmexico", "edc"] },
  "Sónar":               { tier: 1.0, match: ["sonar"] },
  "Awakenings":          { tier: 1.0, match: ["awakenings"] },
  "Time Warp":           { tier: 1.0, match: ["timewarp"] },
  "Dekmantel":           { tier: 1.0, match: ["dekmantel"] },
  "DGTL":                { tier: 1.0, match: ["dgtl"] },
  "Movement Detroit":    { tier: 1.0, match: ["movementdetroit", "movementmusicfestival"] },
  "Glastonbury":         { tier: 1.0, match: ["glastonbury"] },
  "Lollapalooza":        { tier: 1.0, match: ["lollapalooza"] },
  "EXIT":                { tier: 1.0, match: ["exitfestival"] },
  "Creamfields":         { tier: 1.0, match: ["creamfields"] },
  "Parookaville":        { tier: 0.6, match: ["parookaville"] },
  "Parklife":            { tier: 0.6, match: ["parklife"] },
  "CRSSD":               { tier: 0.6, match: ["crssd"] },
  "Portola":             { tier: 0.6, match: ["portola"] },
  "Defqon.1":            { tier: 0.6, match: ["defqon"] },
  "Junction 2":          { tier: 0.6, match: ["junction2"] },
  "Field Day":           { tier: 0.6, match: ["fieldday"] },
  "Lost Village":        { tier: 0.6, match: ["lostvillage"] },
  "Mysteryland":         { tier: 0.6, match: ["mysteryland"] },
  "Kappa FuturFestival": { tier: 0.6, match: ["kappafutur", "kappafuturfestival"] },
  "Hï / Ushuaïa Ibiza":  { tier: 0.6, match: ["hiibiza", "ushuaia"] },
};

// Match an event to a registry festival via its location name + event name.
function matchFestival(ev) {
  const hay = norm(ev.location?.name) + "|" + norm(ev.name);
  for (const [canon, def] of Object.entries(FESTIVALS)) {
    if (def.match.some(m => hay.includes(m))) return canon;
  }
  return null;
}

// Fetch a single artist's Songkick events (upcoming + recent). Returns {status, events}.
async function getArtistEvents(name, slug) {
  try {
    let p = slug ? `/artists/${slug}` : null;
    if (!p) {
      const s = await get(`https://www.songkick.com/search?query=${encodeURIComponent(name)}&type=artists`);
      const cands = [...s.data.matchAll(/href="(\/artists\/[0-9]+-[^"\/]+)"/g)].map(m => m[1]);
      const want = norm(name);
      p = cands.find(c => norm(c.split("-").slice(1).join("-")) === want) || null; // exact only
      if (!p) return { status: "no_match", events: [] };
    }
    const page = await get(`https://www.songkick.com${p}`);
    const blocks = [...page.data.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
      .map(x => { try { return JSON.parse(x[1]); } catch { return null; } }).filter(Boolean);
    const events = [];
    for (const b of blocks) for (const e of (Array.isArray(b) ? b : [b])) if (e["@type"] === "MusicEvent") events.push(e);
    return { status: "ok", events };
  } catch (e) {
    return { status: "error", events: [], msg: e.response?.status || e.message?.slice(0, 50) };
  }
}

async function main() {
  const limit = process.argv[2] ? parseInt(process.argv[2], 10) : Infinity;
  const artists = JSON.parse(fs.readFileSync(ARTISTS_FILE, "utf8"));

  // Existing lineups → act → Set(festival), so a failed fetch preserves prior data.
  let prev = { festivals: [] };
  try { prev = JSON.parse(fs.readFileSync(LINEUPS_FILE, "utf8")); } catch {}
  const actFestivals = {}; // act name → Set(canonical festival)
  for (const f of (prev.festivals || [])) for (const a of (f.acts || [])) {
    (actFestivals[a] = actFestivals[a] || new Set()).add(f.name);
  }

  let fetched = 0, withFest = 0, n = 0;
  for (const artist of artists) {
    if (n >= limit) break;
    n++;
    if (n > 1) await delay(2000);
    if (n > 1 && n % 60 === 0) { console.log(`[pause] ${n} done — resting 15s…`); await delay(15000); }

    const r = await getArtistEvents(artist.name, artist.songkick_slug);
    if (r.status !== "ok") { process.stdout.write("."); continue; } // failed → keep prior memberships
    fetched++;

    const found = new Set();
    for (const ev of r.events) { const c = matchFestival(ev); if (c) found.add(c); }
    // Successful fetch → authoritative replace for this act (even if now empty).
    if (found.size) { actFestivals[artist.name] = found; withFest++; }
    else delete actFestivals[artist.name];
    process.stdout.write(found.size ? "●" : "·");
  }
  console.log(`\nFetched ${fetched} artists; ${withFest} on ≥1 tracked festival.`);

  // Invert act → festivals back to festival → acts (computeFestivalScore's schema).
  const byFestival = {};
  for (const [act, set] of Object.entries(actFestivals)) {
    for (const fname of set) (byFestival[fname] = byFestival[fname] || []).push(act);
  }
  const festivals = Object.entries(byFestival)
    .map(([name, acts]) => ({ name, tier: FESTIVALS[name]?.tier ?? 0.6, acts: acts.sort() }))
    .filter(f => f.acts.length)
    .sort((a, b) => b.tier - a.tier || b.acts.length - a.acts.length);

  const out = {
    _doc: prev._doc || "Major-festival booking presence → festival_score (computeFestivalScore.js). Auto-populated by fetchFestivals.js from Songkick event data. tier: 1.0=global flagship, 0.6=major regional. acts[] match rankings.json names. Self-heals: acts not listed are unmeasured.",
    updated: new Date().toISOString().slice(0, 10),
    source: "fetchFestivals.js (Songkick)",
    festivals,
  };
  fs.writeFileSync(LINEUPS_FILE, JSON.stringify(out, null, 2) + "\n");
  console.log(`Wrote ${festivals.length} festivals → ${path.relative(process.cwd(), LINEUPS_FILE)}`);
}

if (require.main === module) main();
module.exports = { matchFestival, getArtistEvents, FESTIVALS };
