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
  if (!process.env.SPOTIFY_CLIENT_ID) { console.log("No Spotify creds — skipping."); return; }
  const artists = JSON.parse(fs.readFileSync(ARTISTS, "utf8"));
  const todo = artists.filter(a => !a.spotify_id);
  if (!todo.length) { console.log("All artists already have a spotify_id."); return; }
  console.log(`Resolving spotify_id for ${todo.length} artists…`);

  let t = await token(), ok = 0;
  for (let i = 0; i < todo.length; i++) {
    const a = todo[i];
    try {
      const r = await axios.get("https://api.spotify.com/v1/search",
        { headers: { Authorization: `Bearer ${t}` }, params: { q: a.name, type: "artist", limit: 8 }, timeout: 9000 });
      const m = (r.data.artists?.items || []).find(x => norm(x.name) === norm(a.name));
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
