/**
 * Writes VERIFIED Instagram / TikTok profile handles from socials.json onto each
 * artist (rankings.json + artists.json). The frontend renders a direct profile
 * link when a handle is present, and a platform-search fallback when it isn't —
 * so we never guess a handle (a wrong link sends a booker to an impostor account).
 *
 * Merge-safe & idempotent: only sets a handle when socials.json has a real one;
 * never clears an existing handle. Handles also survive CI refreshes via the
 * `...prev` spread in generateStatic.js, so this only needs to run when
 * socials.json changes. Run: node backend/applySocials.js
 */
const fs = require("fs");
const path = require("path");
const RANKINGS = path.join(__dirname, "..", "frontend", "public", "rankings.json");
const ARTISTS  = path.join(__dirname, "artists.json");

let handles = {};
try {
  handles = JSON.parse(fs.readFileSync(path.join(__dirname, "socials.json"), "utf8")).handles || {};
} catch { console.error("No socials.json — nothing to apply."); process.exit(0); }

const clean = h => (typeof h === "string" ? h.trim().replace(/^@/, "") : null) || null;

const rankData = JSON.parse(fs.readFileSync(RANKINGS, "utf8"));
const artists  = JSON.parse(fs.readFileSync(ARTISTS, "utf8"));
const byName   = Object.fromEntries(artists.map(a => [a.name, a]));

let ig = 0, tt = 0;
for (const dj of rankData.rankings) {
  const h = handles[dj.name];
  if (!h) continue;
  const insta = clean(h.instagram), tik = clean(h.tiktok);
  if (insta) { dj.instagram_handle = insta; if (byName[dj.name]) byName[dj.name].instagram_handle = insta; ig++; }
  if (tik)   { dj.tiktok_handle    = tik;   if (byName[dj.name]) byName[dj.name].tiktok_handle    = tik;   tt++; }
}

fs.writeFileSync(RANKINGS, JSON.stringify(rankData, null, 2));
fs.writeFileSync(ARTISTS, JSON.stringify(artists, null, 2));
console.log(`Applied socials: ${ig} Instagram, ${tt} TikTok handles across ${Object.keys(handles).length} curated acts.`);
