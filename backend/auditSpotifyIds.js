/**
 * Audit Spotify artist IDs for acts missing monthly_listeners.
 *
 * Root-cause split for the no-listener acts (which block growth-rate coverage):
 *   BAD_ID        — open.spotify.com/artist/<id> 404s. The stored ID is wrong →
 *                   must be re-resolved before any scrape can ever fetch listeners.
 *   WRONG_ARTIST  — ID resolves 200 but to a DIFFERENT artist (namesake). Re-resolve.
 *   OK_ID         — ID resolves to the right artist, but listeners are still empty →
 *                   the local intercept scrape just hasn't covered them. Re-run scrape.
 *
 * Pure HTTP against open.spotify.com (no API key, no Interceptor). Read-only — writes a
 * report only, touches nothing. Run: node backend/auditSpotifyIds.js
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

const RANKINGS = path.join(__dirname, "..", "frontend", "public", "rankings.json");
const ARTISTS = path.join(__dirname, "artists.json");

const norm = s => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

function head(id) {
  return new Promise(resolve => {
    const req = https.get(`https://open.spotify.com/artist/${id}`,
      { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" } }, res => {
        if (res.statusCode !== 200) { res.resume(); return resolve({ status: res.statusCode, title: null }); }
        let body = "";
        res.on("data", c => { body += c; if (body.length > 60000) req.destroy(); });
        res.on("end", () => {
          const m = body.match(/<meta property="og:title" content="([^"]+)"/);
          resolve({ status: 200, title: m ? m[1] : null });
        });
      });
    req.on("error", () => resolve({ status: 0, title: null }));
    req.setTimeout(10000, () => { req.destroy(); resolve({ status: 0, title: null }); });
  });
}

async function main() {
  const arts = Object.fromEntries(JSON.parse(fs.readFileSync(ARTISTS, "utf8")).map(a => [a.name, a]));
  const r = (() => { const d = JSON.parse(fs.readFileSync(RANKINGS, "utf8")); return d.rankings || d; })();
  const targets = r.filter(x => !x.spotify_monthly_listeners).map(x => x.name);

  const buckets = { BAD_ID: [], WRONG_ARTIST: [], OK_ID: [], NO_ID: [] };
  console.log(`Auditing ${targets.length} no-listener acts against Spotify…\n`);
  for (const name of targets) {
    const id = arts[name]?.spotify_id;
    if (!id) { buckets.NO_ID.push({ name }); continue; }
    const { status, title } = await head(id);
    if (status === 404) buckets.BAD_ID.push({ name, id });
    else if (status === 200 && title && norm(title) !== norm(name)) buckets.WRONG_ARTIST.push({ name, id, resolvesTo: title });
    else if (status === 200) buckets.OK_ID.push({ name, id });
    else buckets.BAD_ID.push({ name, id, note: `status ${status}` });
    await new Promise(r => setTimeout(r, 250));
  }

  const report = { generated: new Date().toISOString().slice(0, 10), counts: Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, v.length])), buckets };
  fs.writeFileSync(path.join(__dirname, "spotify_id_audit.json"), JSON.stringify(report, null, 2));

  console.log("=== Spotify ID audit ===");
  console.log(`BAD_ID (404, re-resolve):        ${buckets.BAD_ID.length}`);
  console.log(`WRONG_ARTIST (namesake, fix):    ${buckets.WRONG_ARTIST.length}`);
  console.log(`OK_ID (just needs a scrape run): ${buckets.OK_ID.length}`);
  console.log(`NO_ID (no id stored):            ${buckets.NO_ID.length}`);
  if (buckets.BAD_ID.length) console.log(`\nBAD_ID:`, buckets.BAD_ID.map(b => b.name).join(", "));
  if (buckets.WRONG_ARTIST.length) console.log(`\nWRONG_ARTIST:`, buckets.WRONG_ARTIST.map(b => `${b.name}→${b.resolvesTo}`).join(", "));
  console.log(`\nWrote backend/spotify_id_audit.json`);
}
main();
