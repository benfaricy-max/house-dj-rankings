/**
 * Label & Release Trajectory. Scores each artist on the tier of labels they're
 * charting on (labelIndex.js), and tracks whether that tier is ASCENDING over
 * time — moving onto bigger labels (Drumcode, Kompakt, Defected…) is a
 * credibility signal that tends to precede booking-fee increases. Useful to A&R.
 *
 * Run after enrichBeatport.js (needs beatport_labels). Inline label_tier_history
 * survives the CI commit, so the ascending/slipping read builds over time.
 */
const fs = require("fs");
const path = require("path");
const { scoreLabels } = require("./labelIndex");

const RANKINGS = path.join(__dirname, "..", "frontend", "public", "rankings.json");
const ARTISTS  = path.join(__dirname, "artists.json");
const today = new Date().toISOString().slice(0, 10);
const KEEP = 12;

(async () => {
  const data = JSON.parse(fs.readFileSync(RANKINGS, "utf8"));
  const artists = JSON.parse(fs.readFileSync(ARTISTS, "utf8"));
  const byName = Object.fromEntries(artists.map(a => [a.name, a]));
  let scored = 0;

  for (const a of data.rankings) {
    const { label_best, label_tier, label_score } = scoreLabels(a.beatport_labels);
    if (label_score == null) { a.label_score = null; a.label_trajectory = null; continue; }
    a.label_best = label_best;
    a.label_tier = label_tier;
    a.label_score = label_score;
    scored++;

    // best-tier history → ascending detection
    const h = a.label_tier_history ?? [];
    if (h[h.length - 1]?.d === today) h[h.length - 1] = { d: today, t: label_tier };
    else h.push({ d: today, t: label_tier });
    a.label_tier_history = h.slice(-KEEP);
    if (a.label_tier_history.length >= 2) {
      const first = a.label_tier_history[0].t;
      a.label_trajectory = label_tier > first ? "ascending" : label_tier < first ? "slipping" : "stable";
    } else {
      a.label_trajectory = "new";
    }
    if (byName[a.name]) Object.assign(byName[a.name], { label_best, label_tier, label_score });
  }

  fs.writeFileSync(RANKINGS, JSON.stringify(data));
  fs.writeFileSync(ARTISTS, JSON.stringify(artists, null, 2));
  console.log(`Label trajectory computed for ${scored} artists.`);
  const top = data.rankings.filter(a => a.label_score != null)
    .sort((x, y) => y.label_score - x.label_score).slice(0, 12);
  top.forEach(a => console.log(`  ${String(a.label_score).padStart(3)} | ${a.name.padEnd(20)} best: ${a.label_best} (tier ${a.label_tier}) ${a.label_trajectory}`));
})();
