/**
 * Audit Spotify artist IDs for acts missing monthly_listeners.
 *
 * Root-cause split for the no-listener acts (which block growth-rate coverage):
 *   BAD_ID        — open.spotify.com/artist/<id> genuinely 404s. Stored ID is wrong →
 *                   must be re-resolved before any scrape can ever fetch listeners.
 *   WRONG_ARTIST  — ID resolves 200 but to a DIFFERENT artist (namesake). Re-resolve.
 *   OK_ID         — ID resolves to the right artist, but listeners are still empty →
 *                   the local intercept scrape just hasn't covered them. Re-run scrape.
 *   UNKNOWN       — couldn't get a clean answer (rate-limited/redirect-looping/network)
 *                   even after retries. NOT counted as bad — re-run later.
 *
 * Hardened against rate limiting: open.spotify.com throttles bursts, and a naive
 * "non-200 = bad" check then mislabels valid IDs as 404. So this follows redirects,
 * retries transient failures (429/5xx/network) with exponential backoff, paces requests,
 * and only ever calls a real 404 BAD. Pure HTTP, no API key. Read-only (writes a report).
 *
 *   node backend/auditSpotifyIds.js
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

const ARTISTS = path.join(__dirname, "artists.json");
const RANKINGS = path.join(__dirname, "..", "frontend", "public", "rankings.json");

const norm = s => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
const sleep = ms => new Promise(r => setTimeout(r, ms));
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

// One HTTP GET. Returns { code, title, location }. code 0 = network error/timeout.
function fetchOnce(url) {
  return new Promise(resolve => {
    const req = https.get(url, { headers: { "User-Agent": UA, "Accept-Language": "en" } }, res => {
      const code = res.statusCode;
      if (code >= 300 && code < 400 && res.headers.location) { res.resume(); return resolve({ code, location: res.headers.location }); }
      if (code !== 200) { res.resume(); return resolve({ code }); }
      let body = "";
      res.on("data", c => { body += c; if (body.length > 80000) req.destroy(); });
      res.on("end", () => resolve({ code: 200, title: (body.match(/<meta property="og:title" content="([^"]+)"/) || [])[1] || null }));
    });
    req.on("error", () => resolve({ code: 0 }));
    req.setTimeout(12000, () => { req.destroy(); resolve({ code: 0 }); });
  });
}

// Resolve an artist id to OK / NOT_FOUND / UNKNOWN, following redirects and
// retrying transient failures (429/5xx/network) with exponential backoff.
async function resolveArtist(id) {
  for (let attempt = 0; attempt < 4; attempt++) {
    let url = `https://open.spotify.com/artist/${id}`;
    let redirects = 0, r;
    do {
      r = await fetchOnce(url);
      if (r.code >= 300 && r.code < 400 && r.location) {
        try { url = new URL(r.location, url).href; } catch { r = { code: 0 }; break; }
        redirects++;
      } else break;
    } while (redirects < 6);

    if (r.code === 200) return { status: "OK", title: r.title };
    if (r.code === 404) return { status: "NOT_FOUND" };
    // 429 / 5xx / redirect-loop / network → transient: back off and retry.
    await sleep((2 ** attempt) * 1500 + Math.random() * 500);
  }
  return { status: "UNKNOWN" };
}

async function main() {
  const arts = Object.fromEntries(JSON.parse(fs.readFileSync(ARTISTS, "utf8")).map(a => [a.name, a]));
  const r = (() => { const d = JSON.parse(fs.readFileSync(RANKINGS, "utf8")); return d.rankings || d; })();
  const targets = r.filter(x => !x.spotify_monthly_listeners).map(x => x.name);

  const buckets = { BAD_ID: [], WRONG_ARTIST: [], OK_ID: [], UNKNOWN: [], NO_ID: [] };
  console.log(`Auditing ${targets.length} no-listener acts against Spotify (paced + retried)…\n`);
  for (const name of targets) {
    const id = arts[name]?.spotify_id;
    if (!id) { buckets.NO_ID.push({ name }); continue; }
    let status, title;
    try { ({ status, title } = await resolveArtist(id)); } catch { status = "UNKNOWN"; } // one bad act never kills the run
    if (status === "NOT_FOUND") buckets.BAD_ID.push({ name, id });
    else if (status === "OK" && title && norm(title) !== norm(name)) buckets.WRONG_ARTIST.push({ name, id, resolvesTo: title });
    else if (status === "OK") buckets.OK_ID.push({ name, id });
    else buckets.UNKNOWN.push({ name, id });
    await sleep(650 + Math.random() * 350); // pace to avoid tripping the throttle
  }

  const report = { generated: new Date().toISOString().slice(0, 10), counts: Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, v.length])), buckets };
  fs.writeFileSync(path.join(__dirname, "spotify_id_audit.json"), JSON.stringify(report, null, 2));

  console.log("=== Spotify ID audit ===");
  console.log(`BAD_ID (genuine 404, re-resolve): ${buckets.BAD_ID.length}`);
  console.log(`WRONG_ARTIST (namesake, fix):     ${buckets.WRONG_ARTIST.length}`);
  console.log(`OK_ID (valid, needs scrape run):  ${buckets.OK_ID.length}`);
  console.log(`UNKNOWN (rate-limited, re-run):   ${buckets.UNKNOWN.length}`);
  console.log(`NO_ID (no id stored):             ${buckets.NO_ID.length}`);
  if (buckets.BAD_ID.length) console.log(`\nBAD_ID:`, buckets.BAD_ID.map(b => b.name).join(", "));
  if (buckets.WRONG_ARTIST.length) console.log(`\nWRONG_ARTIST:`, buckets.WRONG_ARTIST.map(b => `${b.name}→${b.resolvesTo}`).join(", "));
  if (buckets.UNKNOWN.length) console.log(`\nUNKNOWN (re-run to classify):`, buckets.UNKNOWN.map(b => b.name).join(", "));
  console.log(`\nWrote backend/spotify_id_audit.json`);
}
main();
