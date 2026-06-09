/**
 * Scene Score: diminishing-returns rubric + reliability audit.
 *
 * Addresses two review findings on manual_scene_score:
 *  1. ADDITIVE-TO-CAP compresses elite acts (a Berghain resident who adds a Boiler
 *     Room gains nothing once capped at 100). Fix: a SATURATING curve — each
 *     credential still counts, but with diminishing marginal value, so the score
 *     never hits a hard 100 and ordering is preserved at the top.
 *  2. SINGLE-RATER, no reliability number. Fix: an INDEPENDENT, automated re-score
 *     from the published rubric (a stand-in second rater — not a human, labelled as
 *     such), compared against the hand scores to produce an agreement metric.
 *
 * Output:
 *  - backend/scene_scores.json  — versioned, dated ledger of scene scores.
 *  - console report             — reliability (Pearson r, MAE, % within ±15) +
 *                                 the biggest hand-vs-rubric disagreements to review.
 *
 * This re-scores only acts that carry `scene_tags` (the credential evidence). It does
 * NOT overwrite the live hand scores — it's an audit + a proposed go-forward scorer.
 *
 *   node backend/sceneReliability.js
 */
const fs = require("fs");
const path = require("path");

const ARTISTS = path.join(__dirname, "artists.json");
const LEDGER = path.join(__dirname, "scene_scores.json");
const SCENE_VERSION = "2026.06.1";

// Published rubric → credential categories + base points (mirror of SCENE_RUBRIC).
// Each category contributes its points AT MOST ONCE (two festivals isn't 30).
const CREDIT = {
  tastemaker: { pts: 20, match: t => /(boiler ?room|hör|hor\b|cercle)/i.test(t) },
  institution:{ pts: 20, match: t => /(berghain|panorama bar|fabric|dc.?10|tresor|sub ?club)/i.test(t) },
  festival:   { pts: 15, match: t => /(festival|coachella|awakenings|time ?warp|tomorrowland|movement|dgtl|sónar|sonar|edc|closing|main.?stage|headliner)/i.test(t) },
  label:      { pts: 15, match: t => /(own label|own imprint|\blabel\b|drumcode|ninja tune|hessle|dystopian|diynamic|kompakt|defected|relief|cajual|catch ?& ?release|black book|off the grid|no art|perlon|innervisions|afterlife|crosstown|hot creations|repopulate|desolat)/i.test(t) },
  press:      { pts: 10, match: t => /(press cover|\bcover\b|mixmag|dj ?mag|resident advisor|\bra\b feature)/i.test(t) },
  ibiza:      { pts: 10, match: t => /(ibiza residency|residency)/i.test(t) },
  mix:        { pts: 10, match: t => /(essential mix|podcast)/i.test(t) },
};

// SATURATING score: 100 * (1 - e^(-k*S)) over summed credential points S.
// k tuned so ~3 credentials (S≈50) → ~77 and the full panel (S=100) → ~95, with
// every extra credential still nudging the score up (no flat cap).
const K = 0.029;
function rubricScore(tags) {
  if (!Array.isArray(tags) || !tags.length) return null;
  const hit = new Set();
  for (const tag of tags) for (const [cat, c] of Object.entries(CREDIT)) if (c.match(tag)) hit.add(cat);
  if (!hit.size) return null;
  const S = [...hit].reduce((sum, cat) => sum + CREDIT[cat].pts, 0);
  return { score: Math.round(100 * (1 - Math.exp(-K * S))), credits: [...hit], S };
}

const pearson = (xs, ys) => {
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2; }
  return dx && dy ? num / Math.sqrt(dx * dy) : 0;
};

function main() {
  const artists = JSON.parse(fs.readFileSync(ARTISTS, "utf8"));
  const scored = artists.filter(a => Number.isFinite(a.manual_scene_score));
  const ledger = { version: SCENE_VERSION, generated: new Date().toISOString().slice(0, 10),
    method: "Editorial rubric, single rater. Reliability checked against an automated independent rubric re-score (see sceneReliability.js).",
    scores: {} };

  const pairs = [];
  for (const a of scored) {
    const r = rubricScore(a.scene_tags);
    ledger.scores[a.name] = { hand: a.manual_scene_score, version: SCENE_VERSION,
      rubric: r ? r.score : null, credits: r ? r.credits : [] };
    if (r) pairs.push({ name: a.name, hand: a.manual_scene_score, rubric: r.score, diff: a.manual_scene_score - r.score, credits: r.credits });
  }
  fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 2));

  const hand = pairs.map(p => p.hand), rub = pairs.map(p => p.rubric);
  const r = pearson(hand, rub);
  const abs = pairs.map(p => Math.abs(p.diff)).sort((a, b) => a - b);
  const mae = abs.reduce((a, b) => a + b, 0) / (abs.length || 1);
  const within15 = pairs.filter(p => Math.abs(p.diff) <= 15).length / (pairs.length || 1) * 100;

  console.log(`\n=== Scene Score reliability (hand vs independent rubric re-score) ===`);
  console.log(`Version ${SCENE_VERSION} · ${ledger.generated} · ${scored.length} scored, ${pairs.length} with credential tags\n`);
  console.log(`Pearson r:           ${r.toFixed(2)}   (1.0 = perfect agreement)`);
  console.log(`Mean abs difference: ${mae.toFixed(1)} points`);
  console.log(`Within ±15 points:   ${within15.toFixed(0)}%`);
  console.log(`\nBiggest disagreements to review (hand − rubric):`);
  pairs.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  for (const p of pairs.slice(0, 10))
    console.log(`  ${p.name.padEnd(20)} hand ${String(p.hand).padStart(3)}  rubric ${String(p.rubric).padStart(3)}  Δ${p.diff > 0 ? "+" : ""}${p.diff}  [${p.credits.join(", ")}]`);
  console.log(`\nLedger written: ${path.relative(process.cwd(), LEDGER)}`);
  console.log(`Reliability numbers (r, MAE, within-15) → surface in How It Works.\n`);
}
main();
