/**
 * Computes the Momentum Score and the rate-of-change signals that feed it.
 *
 * Beatport position change and touring velocity are TRUE deltas — they need
 * history. We store that history inline on each artist (like rank_history) so it
 * survives the CI commit (the data/ dir is gitignored and wouldn't persist).
 * Each run appends today's point; deltas activate once ≥2 points (~a week) exist.
 *
 * Run after generateStatic.js (so beatport/tour fields are fresh).
 */
const fs = require("fs");
const path = require("path");
const { computeMomentum } = require("./momentum");

const RANKINGS = path.join(__dirname, "..", "frontend", "public", "rankings.json");
const today = new Date().toISOString().slice(0, 10);
const KEEP = 10;                          // ~10 daily points of history
const pushCapped = (arr, pt) => { const a = arr ?? []; if (a[a.length - 1]?.d === today) a[a.length - 1] = pt; else a.push(pt); return a.slice(-KEEP); };

(async () => {
  const data = JSON.parse(fs.readFileSync(RANKINGS, "utf8"));
  const A = data.rankings;

  for (const a of A) {
    // --- Beatport position history → week-over-week change (lower = better) ---
    if (a.beatport_best_position > 0) {
      a.beatport_history = pushCapped(a.beatport_history, { d: today, p: a.beatport_best_position });
      const h = a.beatport_history;
      if (h.length >= 2) {
        const past = h[0].p;                 // oldest point in window
        a.beatport_pos_change = past - a.beatport_best_position;   // +ve = climbed
      }
    }
    // --- Touring breadth history → velocity (more cities/countries over time) ---
    const cities = a.tour_cities || a.ra_countries || 0;
    const upcoming = a.tour_upcoming || a.ra_upcoming || 0;
    if (cities > 0 || upcoming > 0) {
      a.tour_history = pushCapped(a.tour_history, { d: today, c: cities, u: upcoming });
      const h = a.tour_history;
      if (h.length >= 2) {
        // velocity = growth in distinct cities + upcoming shows vs the oldest point
        a.tour_velocity = (cities - h[0].c) + (upcoming - h[0].u);
      }
    }
  }

  computeMomentum(A);

  fs.writeFileSync(RANKINGS, JSON.stringify(data));
  const scored = A.filter(a => a.momentum_score != null);
  console.log(`Momentum computed for ${scored.length}/${A.length} artists (rest lack rate-of-change data).`);
  const top = [...scored].sort((x, y) => y.momentum_score - x.momentum_score).slice(0, 12);
  console.log("\nTop momentum:");
  top.forEach(a => console.log(`  ${String(a.momentum_score).padStart(3)} | ${a.name.padEnd(22)} (rank #${a.rank})  parts: ${JSON.stringify(a.momentum_parts)}`));
})();
