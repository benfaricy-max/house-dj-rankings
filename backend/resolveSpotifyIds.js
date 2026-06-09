/**
 * Resolves spotify_id for roster artists missing one (e.g. Beatport-discovered
 * adds), via Spotify artist search with exact normalized-name matching. Once an
 * id is set, the normal pipeline (generateStatic) fetches listeners/image/etc.
 * Merge-safe: only writes a real id. Bails cleanly if Spotify is rate-limited.
 */
require("dotenv").config({ path: __dirname + "/.env" });
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const ARTISTS = path.join(__dirname, "artists.json");
const delay = ms => new Promise(r => setTimeout(r, ms));
const norm = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

async function token() {
  const cred = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString("base64");
  const r = await axios.post("https://accounts.spotify.com/api/token", "grant_type=client_credentials",
    { headers: { Authorization: `Basic ${cred}`, "Content-Type": "application/x-www-form-urlencoded" } });
  return r.data.access_token;
}

(async () => {
  const artists = JSON.parse(fs.readFileSync(ARTISTS, "utf8"));
  // Hand-verified ids (Spotify search + kworb-corroborated) — applied directly, even
  // without API creds, since they replace known-bad (404) ids.
  const SEED = { "Eric Prydz": "5sm0jQ1mq0dusiLtDJ2b4R", "Duke Dumont": "61lyPtntblHJvA7FMMhi7E", "Route 94": "1dgdvbogmctybPrGEcnYf6" };
  let seeded = 0;
  for (const a of artists) if (SEED[a.name] && a.spotify_id !== SEED[a.name]) { a.spotify_id = SEED[a.name]; seeded++; }
  if (seeded) { fs.writeFileSync(ARTISTS, JSON.stringify(artists, null, 2)); console.log(`Seeded ${seeded} hand-verified ids.`); }

  if (!process.env.SPOTIFY_CLIENT_ID) { console.log("No Spotify creds — applied seeds only, skipping search."); return; }
  // Re-resolve acts with NO id, PLUS those whose stored id failed validation
  // (spotify_id_audit.json BAD_ID/WRONG_ARTIST) — a bad id is the reason they have
  // no listeners, so "has an id" must NOT mean "skip" for them.
  const bad = new Set();
  try { const au = JSON.parse(fs.readFileSync(path.join(__dirname, "spotify_id_audit.json"), "utf8"));
    for (const b of [...(au.buckets?.BAD_ID || []), ...(au.buckets?.WRONG_ARTIST || [])]) bad.add(b.name); } catch {}
  const todo = artists.filter(a => (!a.spotify_id || bad.has(a.name)) && !SEED[a.name]);
  if (!todo.length) { console.log("Nothing to resolve."); return; }
  console.log(`Resolving spotify_id for ${todo.length} artists (incl. ${bad.size} flagged bad)…`);

  let t = await token(), ok = 0;
  for (let i = 0; i < todo.length; i++) {
    const a = todo[i];
    try {
      const r = await axios.get("https://api.spotify.com/v1/search",
        { headers: { Authorization: `Bearer ${t}` }, params: { q: a.name, type: "artist", limit: 8 }, timeout: 9000 });
      // Prefer the MOST-FOLLOWED exact-name match — the real act beats a namesake
      // (this is what re-resolving a bad id needs; a bare .find() can grab a tiny namesake).
      const m = (r.data.artists?.items || []).filter(x => norm(x.name) === norm(a.name))
        .sort((x, y) => (y.followers?.total || 0) - (x.followers?.total || 0))[0];
      if (m) { a.spotify_id = m.id; if (m.images?.[0]?.url) a.image = m.images[0].url; ok++; }
    } catch (e) {
      if (e.response?.status === 401) { t = await token(); i--; continue; }
      if (e.response?.status === 429) {
        const wait = Number(e.response.headers?.["retry-after"] || 30);
        if (wait > 120) { console.log(`\n429 Retry-After ${wait}s — backing off, resume later.`); break; }
        await delay((wait + 1) * 1000); i--; continue;
      }
    }
    if (ok && ok % 10 === 0) fs.writeFileSync(ARTISTS, JSON.stringify(artists, null, 2));
    await delay(250);
  }
  fs.writeFileSync(ARTISTS, JSON.stringify(artists, null, 2));
  const left = artists.filter(a => !a.spotify_id).length;
  console.log(`\nResolved +${ok}. Still missing: ${left}.`);
})();
