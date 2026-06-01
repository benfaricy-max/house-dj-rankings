/**
 * Backfills artist images from the Deezer public API (no auth, no rate-limit
 * penalties — unlike Spotify). Matches on exact normalized artist name to avoid
 * wrong images. Merge-safe: only writes a real image URL, never clears one.
 * Updates rankings.json (and caches to artists.json) by name.
 */
require("dotenv").config({ path: __dirname + "/.env" });
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const RANKINGS = path.join(__dirname, "..", "frontend", "public", "rankings.json");
const ARTISTS  = path.join(__dirname, "artists.json");
const delay = ms => new Promise(r => setTimeout(r, ms));
const norm = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Deezer returns a placeholder URL (empty hash) when it has no real picture.
const isReal = url => !!url && !url.includes("/artist//");

async function deezerImage(name) {
  const r = await axios.get("https://api.deezer.com/search/artist", { params: { q: name, limit: 8 }, timeout: 9000 });
  const results = r.data?.data || [];
  const match = results.find(d => norm(d.name) === norm(name)) || null;
  if (!match) return null;
  const img = match.picture_xl || match.picture_big || match.picture_medium;
  return isReal(img) ? img : null;
}

// Spotify search fallback for artists Deezer can't match. Resolves by name so it
// also corrects stale/wrong spotify_ids. Returns { image, spotify_id } or null.
// Throws { rateLimited:true } so the caller can stop instead of hammering a penalty.
let _spToken = null;
async function spToken() {
  if (_spToken) return _spToken;
  if (!process.env.SPOTIFY_CLIENT_ID) return null;
  const cred = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString("base64");
  const r = await axios.post("https://accounts.spotify.com/api/token", "grant_type=client_credentials",
    { headers: { Authorization: `Basic ${cred}`, "Content-Type": "application/x-www-form-urlencoded" } });
  return (_spToken = r.data.access_token);
}
async function spotifyImage(name) {
  const t = await spToken();
  if (!t) return null;
  try {
    const r = await axios.get("https://api.spotify.com/v1/search",
      { headers: { Authorization: `Bearer ${t}` }, params: { q: name, type: "artist", limit: 8 }, timeout: 9000 });
    const m = (r.data.artists?.items || []).find(a => norm(a.name) === norm(name));
    const img = m?.images?.[0]?.url;
    return img ? { image: img, spotify_id: m.id } : null;
  } catch (e) {
    if (e.response?.status === 429) throw { rateLimited: true };
    return null;
  }
}

(async () => {
  const data = JSON.parse(fs.readFileSync(RANKINGS, "utf8"));
  const artists = JSON.parse(fs.readFileSync(ARTISTS, "utf8"));
  const byName = Object.fromEntries(artists.map(a => [a.name, a]));
  const A = data.rankings;
  const todo = A.filter(a => !a.image || !/^https?:/.test(a.image));
  console.log(`Backfilling images (Deezer) for ${todo.length}/${A.length} artists…`);

  let ok = 0, miss = 0, spOff = false;
  const unresolved = [];
  for (let i = 0; i < todo.length; i++) {
    const a = todo[i];
    try {
      let img = await deezerImage(a.name);
      // Fallback to Spotify search (also fixes stale ids) unless it's throttled.
      if (!img && !spOff) {
        try {
          const sp = await spotifyImage(a.name);
          if (sp) {
            img = sp.image;
            if (sp.spotify_id && sp.spotify_id !== a.spotify_id) {
              a.spotify_id = sp.spotify_id;
              if (byName[a.name]) byName[a.name].spotify_id = sp.spotify_id;
            }
          }
        } catch (se) { if (se.rateLimited) { spOff = true; console.log("\n(Spotify fallback throttled — Deezer only this run)"); } }
      }
      if (img) {
        a.image = img;
        if (byName[a.name]) byName[a.name].image = img;
        ok++;
      } else { miss++; unresolved.push(a.name); }
    } catch (e) {
      if (e.response?.status === 429) { await delay(3000); i--; continue; }
      miss++; unresolved.push(a.name);
    }
    if (ok && ok % 20 === 0) { fs.writeFileSync(RANKINGS, JSON.stringify(data)); process.stdout.write(`\r${ok} set   `); }
    await delay(180);
  }
  fs.writeFileSync(RANKINGS, JSON.stringify(data));
  fs.writeFileSync(ARTISTS, JSON.stringify(artists, null, 2));
  const have = A.filter(a => a.image && /^https?:/.test(a.image)).length;
  console.log(`\nDone: +${ok} (${miss} unmatched). Coverage now ${have}/${A.length}.`);
  if (unresolved.length) console.log("Unmatched (need manual / no exact Deezer name):\n  " + unresolved.join(", "));
})();
