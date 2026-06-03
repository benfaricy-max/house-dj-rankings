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
  const now = () => new Date().toISOString();
  let done = 0, ok = 0, noEvents = 0, errors = 0, failStreak = 0;
  const noMatch = [];
  for (const dj of todo) {
    const res = await getTourDensity(dj.name, { slug: dj.songkick_slug });
    done++;
    if (res.status === "ok") {
      Object.assign(dj, res.data, { tour_updated: now() });
      ok++; failStreak = 0;
    } else if (res.status === "no_events") {
      // matched the right artist, genuinely no upcoming shows → record real zeros
      Object.assign(dj, { tour_upcoming: 0, tour_upcoming_capped: false, tour_countries: 0, tour_cities: 0, tour_next_date: null, tour_next_city: null, tour_next_country: null, tour_score: 0, tour_updated: now() });
      noEvents++; failStreak = 0;
    } else if (res.status === "no_match") {
      // couldn't confidently match — DON'T stamp/overwrite; surface for an alias fix
      noMatch.push(dj.name);
      failStreak = 0;
      console.log(`\n  ⚠ no exact Songkick match: "${dj.name}"${res.candidates?.length ? ` — candidates: ${res.candidates.map(c => c.replace("/artists/", "")).join(", ")}` : " (no results)"}`);
    } else { // error
      errors++; failStreak++;
      console.log(`\n  ✕ error for "${dj.name}": ${res.msg}`);
      if (failStreak >= 12) { console.log("Too many consecutive errors — likely throttled. Saving and stopping."); break; }
    }
    if (done % 5 === 0) { fs.writeFileSync(RANKINGS, JSON.stringify(d)); process.stdout.write(`\r${done}/${todo.length} | ${ok} touring · ${noEvents} no-shows · ${noMatch.length} unmatched   `); }
    await delay(1400 + Math.random() * 1000);
  }
  fs.writeFileSync(RANKINGS, JSON.stringify(d));
  const total = d.rankings.filter(x => x.tour_upcoming > 0).length;
  console.log(`\nDone. ok=${ok} · no-events=${noEvents} · unmatched=${noMatch.length} · errors=${errors}. ${total} artists with upcoming tour data.`);
  if (noMatch.length) {
    console.log(`\nUnmatched (add a "songkick_slug" to artists.json to fix — e.g. the "123456-artist-name" tail from their Songkick URL):\n  ${noMatch.join(", ")}`);
  }
})();
