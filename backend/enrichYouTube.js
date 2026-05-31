/**
 * Focused YouTube resolver. Accurate search-first resolution, caches verified
 * channel IDs to artists.json (1 unit next time). Merge-safe: only writes a real
 * value, never wipes. Stops after repeated quota errors; resume next reset.
 * Processes artists missing YouTube data first, in rank order.
 */
require("dotenv").config({ path: __dirname + "/.env" });
const fs = require("fs");
const path = require("path");
const { getYouTubeData } = require("./fetchArtist");

const RANKINGS = path.join(__dirname, "..", "frontend", "public", "rankings.json");
const ARTISTS  = path.join(__dirname, "artists.json");

const data = JSON.parse(fs.readFileSync(RANKINGS, "utf8"));
const artists = JSON.parse(fs.readFileSync(ARTISTS, "utf8"));
const byName = Object.fromEntries(artists.map(a => [a.name, a]));
const delay = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  // resolve those still missing subs, biggest first
  const todo = data.rankings.filter(a => !(a.youtube_subscribers > 0));
  console.log(`Resolving YouTube for ${todo.length} artists (search-first, cached after)…`);
  let ok = 0, idCached = 0, failStreak = 0;

  for (const dj of todo) {
    const yt = await getYouTubeData(dj, { allowSearch: true });
    if (yt && yt.youtube_subscribers > 0) {
      dj.youtube_subscribers = yt.youtube_subscribers;
      dj.youtube_total_views = yt.youtube_total_views;
      if (yt.resolved_channel_id && yt.resolved_channel_id !== dj.youtube_channel_id) {
        dj.youtube_channel_id = yt.resolved_channel_id;
        if (byName[dj.name]) byName[dj.name].youtube_channel_id = yt.resolved_channel_id;
        idCached++;
      }
      ok++; failStreak = 0;
      if (ok % 5 === 0) {
        fs.writeFileSync(RANKINGS, JSON.stringify(data));
        fs.writeFileSync(ARTISTS, JSON.stringify(artists, null, 2));
        process.stdout.write(`\r${ok} resolved, ${idCached} ids cached   `);
      }
    } else {
      failStreak++;
      if (failStreak >= 6) { console.log("\nQuota exhausted / repeated failures — stopping. Resume next reset."); break; }
    }
    await delay(400);
  }

  fs.writeFileSync(RANKINGS, JSON.stringify(data));
  fs.writeFileSync(ARTISTS, JSON.stringify(artists, null, 2));
  const total = data.rankings.filter(a => a.youtube_subscribers > 0).length;
  console.log(`\nDone this run: +${ok}. Total YouTube coverage: ${total}/${data.rankings.length}.`);
})();
