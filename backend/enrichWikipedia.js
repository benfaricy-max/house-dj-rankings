/**
 * Backfills Wikipedia pageviews. Caches resolved article titles to artists.json
 * (1 fewer request next run). Merge-safe: only writes when an article resolves.
 */
require("dotenv").config({ path: __dirname + "/.env" });
const fs = require("fs");
const path = require("path");
const { getWikipediaViews } = require("./fetchWikipedia");

const RANKINGS = path.join(__dirname, "..", "frontend", "public", "rankings.json");
const ARTISTS  = path.join(__dirname, "artists.json");

const data = JSON.parse(fs.readFileSync(RANKINGS, "utf8"));
const artists = JSON.parse(fs.readFileSync(ARTISTS, "utf8"));
const byName = Object.fromEntries(artists.map(a => [a.name, a]));
const delay = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  console.log(`Fetching Wikipedia pageviews for ${data.rankings.length} artists…`);
  let hits = 0, done = 0;
  for (const dj of data.rankings) {
    const seed = { name: dj.name, wikipedia_title: byName[dj.name]?.wikipedia_title };
    const res = await getWikipediaViews(seed);
    if (res.resolved_title) {                       // only write on a real article match
      dj.wikipedia_pageviews = res.wikipedia_pageviews;
      if (byName[dj.name]) byName[dj.name].wikipedia_title = res.resolved_title;
      hits++;
    }
    done++;
    if (done % 10 === 0) {
      fs.writeFileSync(RANKINGS, JSON.stringify(data));
      fs.writeFileSync(ARTISTS, JSON.stringify(artists, null, 2));
      process.stdout.write(`\r${done}/${data.rankings.length} | ${hits} with articles   `);
    }
    await delay(200);
  }
  fs.writeFileSync(RANKINGS, JSON.stringify(data));
  fs.writeFileSync(ARTISTS, JSON.stringify(artists, null, 2));
  console.log(`\nDone. ${hits}/${data.rankings.length} artists have Wikipedia pageview data.`);
})();
