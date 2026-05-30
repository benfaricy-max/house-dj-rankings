/**
 * Tour-density backfill via Songkick. Resumable, paced, merge-safe (per CLAUDE.md).
 * Run: node backend/enrichTour.js   (optionally pass a number to cap how many to do)
 */
const fs   = require("fs");
const path = require("path");
const { getTourDensity } = require("./fetchTour");

const RANKINGS = path.join(__dirname, "..", "frontend", "public", "rankings.json");
const STALE_DAYS = 7;
const LIMIT = parseInt(process.argv[2] || "264", 10);

const d = JSON.parse(fs.readFileSync(RANKINGS, "utf8"));
const delay = ms => new Promise(r => setTimeout(r, ms));
const fresh = dj => dj.tour_updated && (Date.now() - new Date(dj.tour_updated).getTime()) < STALE_DAYS * 864e5;

(async () => {
  const todo = d.rankings.filter(dj => !fresh(dj)).slice(0, LIMIT);
  console.log(`Tour density for ${todo.length} artists…`);
  let done = 0, ok = 0, failStreak = 0;
  for (const dj of todo) {
    const t = await getTourDensity(dj.name);
    done++;
    if (t) {
      Object.assign(dj, t, { tour_updated: new Date().toISOString() });
      if (t.tour_upcoming > 0) ok++;
      failStreak = 0;
    } else {
      failStreak++;
      if (failStreak >= 12) { console.log("\nToo many failures — likely throttled. Saving and stopping."); break; }
    }
    if (done % 5 === 0) { fs.writeFileSync(RANKINGS, JSON.stringify(d)); process.stdout.write(`\r${done}/${todo.length} | ${ok} touring   `); }
    await delay(1400 + Math.random() * 1000);
  }
  fs.writeFileSync(RANKINGS, JSON.stringify(d));
  const total = d.rankings.filter(x => x.tour_upcoming > 0).length;
  console.log(`\nDone. ${total} artists with tour data.`);
})();
