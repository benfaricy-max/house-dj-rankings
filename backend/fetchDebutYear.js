/**
 * Fetches each artist's debut year (earliest release) via the iTunes Search API.
 * No auth, no key. Stores debut_year in artists.json + rankings.json.
 * Used to exclude pre-2015 artists from "Ones to Watch".
 */
const axios = require("axios");
const path  = require("path");
const fs    = require("fs");

const ARTISTS  = path.join(__dirname, "artists.json");
const RANKINGS = path.join(__dirname, "..", "frontend", "public", "rankings.json");
const CONCURRENCY = 3;

const artists  = JSON.parse(fs.readFileSync(ARTISTS, "utf8"));
const rankData = JSON.parse(fs.readFileSync(RANKINGS, "utf8"));
const rankByName = Object.fromEntries(rankData.rankings.map(r => [r.name, r]));

const delay = ms => new Promise(r => setTimeout(r, ms));

// Normalize: strip diacritics + punctuation, lowercase, collapse spaces
const norm = s => (s || "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

async function earliestYear(name) {
  try {
    const r = await axios.get("https://itunes.apple.com/search", {
      params: { term: name, entity: "album", limit: 200, media: "music" },
      timeout: 12000,
    });
    const want = norm(name);
    const yrs = r.data.results
      .filter(x => {
        if (!x.releaseDate || !x.artistName) return false;
        const got = norm(x.artistName);
        // exact normalized match, or iTunes name is "<name> & X" / "<name> feat X" style
        return got === want || got.startsWith(want + " ") || want.startsWith(got + " ");
      })
      .map(x => parseInt(x.releaseDate.slice(0, 4)))
      .filter(y => y > 1950 && y <= new Date().getFullYear());
    return yrs.length ? Math.min(...yrs) : null;
  } catch { return null; }
}

let done = 0, found = 0;
function save() {
  fs.writeFileSync(ARTISTS, JSON.stringify(artists, null, 2));
  fs.writeFileSync(RANKINGS, JSON.stringify(rankData));
}

async function worker(queue) {
  while (queue.length) {
    const a = queue.shift();
    const yr = await earliestYear(a.name);
    if (yr) {
      a.debut_year = yr;
      if (rankByName[a.name]) rankByName[a.name].debut_year = yr;
      found++;
    }
    done++;
    if (done % 10 === 0) { save(); process.stdout.write(`\r${done}/${artists.length} | ${found} dated   `); }
    await delay(150);
  }
}

(async () => {
  console.log(`Fetching debut years for ${artists.length} artists via iTunes…`);
  const queue = [...artists];
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)));
  save();
  const pre2015 = artists.filter(a => a.debut_year && a.debut_year < 2015).length;
  console.log(`\nDONE. ${found}/${artists.length} dated. ${pre2015} are pre-2015 (will be excluded from Ones to Watch).`);
  process.exit(0);
})();
