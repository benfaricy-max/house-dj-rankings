/**
 * Real listener-growth signal from kworb.net (no key).
 * kworb's global top-2500 monthly-listeners table includes a daily +/- delta.
 * We match by Spotify ID and derive a weekly listener-growth %% for the artists
 * it covers (the bigger names). Merge-safe: only writes on a match, never wipes.
 */
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const RANKINGS = path.join(__dirname, "..", "frontend", "public", "rankings.json");
const ARTISTS  = path.join(__dirname, "artists.json");
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36";
const int = s => parseInt((s || "0").replace(/,/g, ""), 10) || 0;

(async () => {
  const rankData = JSON.parse(fs.readFileSync(RANKINGS, "utf8"));
  const artists  = JSON.parse(fs.readFileSync(ARTISTS, "utf8"));
  const byIdRank = Object.fromEntries(rankData.rankings.map(a => [a.spotify_id, a]));

  const r = await axios.get("https://kworb.net/spotify/listeners.html", { headers: { "User-Agent": UA }, timeout: 20000 });
  const rows = [...r.data.matchAll(/artist\/([A-Za-z0-9]+)_songs\.html">([^<]+)<\/a><\/div><\/td><td>([\d,]+)<\/td><td>(-?[\d,]+)<\/td>/g)];

  let hits = 0;
  for (const m of rows) {
    const id = m[1], listeners = int(m[3]), daily = int(m[4]);
    const dj = byIdRank[id];
    if (!dj || listeners <= 0) continue;
    const weeklyPct = Math.round((daily / listeners) * 7 * 1000) / 10; // weekly growth %
    dj.spotify_monthly_listeners = listeners;           // refresh (kworb agrees with our scrape)
    dj.listener_daily_delta = daily;
    dj.spotify_follower_growth_rate = weeklyPct;         // repurposed: now Listener Growth (%/wk)
    dj.listener_growth_source = "kworb";
    dj.spotify_listeners_updated = new Date().toISOString();
    hits++;
  }

  fs.writeFileSync(RANKINGS, JSON.stringify(rankData));
  console.log(`kworb: listener-growth set for ${hits}/${rankData.rankings.length} artists.`);
  rankData.rankings.filter(a => a.listener_growth_source === "kworb")
    .sort((a, b) => b.spotify_follower_growth_rate - a.spotify_follower_growth_rate).slice(0, 8)
    .forEach(a => console.log(`  ${a.name}: ${a.spotify_follower_growth_rate > 0 ? "+" : ""}${a.spotify_follower_growth_rate}%/wk (${a.listener_daily_delta > 0 ? "+" : ""}${a.listener_daily_delta}/day)`));
})();
