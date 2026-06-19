/**
 * backtestValueCalls.js — grade PEAKTIME's Value Gap calls against ground truth.
 *
 * THE POINT (per CLAUDE.md "Predictive-validation history"):
 *   A ranking that can PROVE it was right is a different product than one that
 *   only looks plausible. We froze each Value Gap call at the date it was made
 *   (value_call_history), and we accrue the OUTCOME independently (fee_history =
 *   fee-tier moves, venue_history = room-size moves). This script reads a call at
 *   time T and grades it against the fee/venue movement that happened AFTER T.
 *
 * HONESTY RULES (do not break — they're what makes the backtest meaningful):
 *   1. Grade outcomes against fee_history / venue_history MOVEMENT, never against
 *      the current model's own re-scored signal (that would be circular).
 *   2. Only grade calls older than MIN_HORIZON_DAYS. Fee/room tiers move slowly;
 *      grading a 2-day-old call is noise, not validation. Default 180 days.
 *   3. If no call meets the horizon yet, SAY SO plainly. An empty-but-honest
 *      backtest is the correct output today — the framework is what's being
 *      delivered, the verdict comes when the history matures.
 *
 * Grading logic:
 *   - "strong-buy" / "buy"  → correct if fee tier OR venue tier ROSE after T.
 *   - "premium"             → correct if fee tier did NOT rise (held/fell) after T
 *                             (we called it overpriced; a rise would be a miss).
 *   - "fair"                → excluded from accuracy (no directional claim).
 *
 * Usage:
 *   node backend/backtestValueCalls.js                 # grade at 180d horizon
 *   node backend/backtestValueCalls.js --horizon 90    # custom horizon (days)
 *   node backend/backtestValueCalls.js --leading       # also print the early read
 *   node backend/backtestValueCalls.js --write         # write docs/BACKTEST.md
 */
const fs = require("fs");
const path = require("path");

const RANKINGS = path.join(__dirname, "..", "frontend", "public", "rankings.json");
const REPORT = path.join(__dirname, "..", "docs", "BACKTEST.md");

const args = process.argv.slice(2);
const HORIZON = (() => {
  const i = args.indexOf("--horizon");
  return i >= 0 ? Number(args[i + 1]) : 180;
})();
const WANT_LEADING = args.includes("--leading");
const WANT_WRITE = args.includes("--write");

const DAY = 86400000;
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / DAY);

const data = JSON.parse(fs.readFileSync(RANKINGS, "utf8"));
const rankings = data.rankings || [];
const asOf = data.lastUpdated ? data.lastUpdated.slice(0, 10) : new Date().toISOString().slice(0, 10);

/** Read a change-compressed history [{d, ...}] and return the entry in effect at date `on`. */
function valueAt(history, field, on) {
  if (!Array.isArray(history) || !history.length) return null;
  let best = null;
  for (const pt of history) {
    if (pt.d <= on) best = pt;
  }
  return best ? best[field] : null;
}

/** Latest value of a field in a history. */
function latest(history, field) {
  if (!Array.isArray(history) || !history.length) return null;
  return history[history.length - 1][field];
}

// ---------------------------------------------------------------------------
// 1. THE BACKTEST — grade matured calls
// ---------------------------------------------------------------------------
const graded = [];
const pending = []; // calls that exist but haven't matured to the horizon yet

for (const a of rankings) {
  const calls = a.value_call_history || [];
  for (const call of calls) {
    const age = daysBetween(call.d, asOf);
    const directional = call.s === "strong-buy" || call.s === "buy" || call.s === "premium";
    if (!directional) continue;

    if (age < HORIZON) {
      pending.push({ name: a.name, signal: call.s, date: call.d, age });
      continue;
    }

    // Fee tier at call vs latest after the call.
    const feeAtCall = valueAt(a.fee_history, "t", call.d);
    const feeNow = latest(a.fee_history, "t");
    const venueAtCall = valueAt(a.venue_history, "vt", call.d);
    const venueNow = latest(a.venue_history, "vt");

    const feeRose = feeAtCall != null && feeNow != null && feeNow > feeAtCall;
    const venueRose = venueAtCall != null && venueNow != null && venueNow > venueAtCall;
    const rose = feeRose || venueRose;

    let verdict;
    if (call.s === "premium") verdict = rose ? "miss" : "hit";
    else verdict = rose ? "hit" : "miss"; // strong-buy / buy

    graded.push({
      name: a.name, signal: call.s, date: call.d, age,
      feeAtCall, feeNow, venueAtCall, venueNow, feeRose, venueRose, verdict,
    });
  }
}

const hits = graded.filter(g => g.verdict === "hit").length;
const accuracy = graded.length ? Math.round((hits / graded.length) * 100) : null;

// ---------------------------------------------------------------------------
// 2. LEADING-INDICATOR READ — NOT a backtest, an early sanity check
//    Over whatever rank_history we have, are "strong-buy" acts out-moving the field?
// ---------------------------------------------------------------------------
function rankSeries(a) {
  // rank_history may be [{d, r}] or similar; be defensive.
  const h = a.rank_history || [];
  return h.map(p => (typeof p === "object" ? { d: p.d, r: p.r ?? p.rank ?? p.value } : null)).filter(Boolean);
}
let leading = null;
if (WANT_LEADING || WANT_WRITE) {
  const buckets = { "strong-buy": [], buy: [], premium: [], fair: [] };
  for (const a of rankings) {
    const s = a.value_signal;
    if (!buckets[s]) continue;
    const rs = rankSeries(a);
    if (rs.length < 2) continue;
    const first = rs[0], last = rs[rs.length - 1];
    if (first.r == null || last.r == null) continue;
    // rank improvement = positive when the number goes DOWN (1 is best)
    buckets[s].push(first.r - last.r);
  }
  const avg = arr => (arr.length ? (arr.reduce((x, y) => x + y, 0) / arr.length) : null);
  leading = {
    window: (() => {
      const ds = new Set();
      rankings.forEach(a => rankSeries(a).forEach(p => ds.add(p.d)));
      const sorted = [...ds].sort();
      return sorted.length ? `${sorted[0]} → ${sorted[sorted.length - 1]} (${sorted.length} snapshots)` : "n/a";
    })(),
    avgRankDelta: {
      "strong-buy": avg(buckets["strong-buy"]),
      buy: avg(buckets.buy),
      premium: avg(buckets.premium),
      fair: avg(buckets.fair),
    },
    counts: Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, v.length])),
  };
}

// ---------------------------------------------------------------------------
// 3. OUTPUT
// ---------------------------------------------------------------------------
const oldestPending = pending.length ? Math.max(...pending.map(p => p.age)) : 0;
const firstCallDate = (() => {
  const ds = [];
  rankings.forEach(a => (a.value_call_history || []).forEach(c => ds.push(c.d)));
  return ds.length ? ds.sort()[0] : null;
})();

const lines = [];
lines.push(`# PEAKTIME, Value-Call Backtest`);
lines.push("");
lines.push(`*Generated ${asOf} · horizon ${HORIZON}d · grades Value Gap calls against fee/venue-tier movement (CLAUDE.md predictive-validation history). Outcomes graded against ground-truth tier MOVES, never the model's own re-score.*`);
lines.push("");
lines.push(`## Verdict`);
lines.push("");
if (graded.length === 0) {
 lines.push(`**Not yet gradable: and that is the honest, correct state today.**`);
  lines.push("");
  lines.push(`- Call-grading history (\`value_call_history\`) began **${firstCallDate || "n/a"}**.`);
  lines.push(`- Oldest directional call is **${oldestPending} day(s)** old; the horizon to grade a fee/room-tier move is **${HORIZON} days**.`);
  lines.push(`- **${pending.length}** directional calls are accruing and will become gradable on a rolling basis. First results land ~**${HORIZON - oldestPending} days** from now.`);
  lines.push("");
 lines.push(`The framework is built and running. Fee/room tiers move slowly (a booking re-prices over months, not days), so grading now would measure noise. The backtest *proves itself* only with time, this script is the instrument; re-run it on a schedule.`);
} else {
  lines.push(`**${accuracy}% directional accuracy** across **${graded.length}** matured calls (${hits} hit / ${graded.length - hits} miss).`);
  lines.push("");
  lines.push(`A call is a *hit* when the ground truth moved the way the call predicted: a \`strong-buy\`/\`buy\` act's fee tier or room tier rose after we flagged it; a \`premium\` act's did not.`);
}
lines.push("");

if (graded.length) {
  lines.push(`## Graded calls`);
  lines.push("");
  lines.push(`| Artist | Call | Date | Age (d) | Fee tier Δ | Room tier Δ | Verdict |`);
  lines.push(`|---|---|---|--:|---|---|---|`);
  for (const g of graded.sort((a, b) => a.date.localeCompare(b.date))) {
 const fΔ = g.feeAtCall != null ? `${g.feeAtCall}→${g.feeNow}` : "—";
 const vΔ = g.venueAtCall != null ? `${g.venueAtCall}→${g.venueNow}` : "—";
    lines.push(`| ${g.name} | ${g.signal} | ${g.date} | ${g.age} | ${fΔ} | ${vΔ} | ${g.verdict === "hit" ? "✅ hit" : "❌ miss"} |`);
  }
  lines.push("");
}

if (leading) {
  lines.push(`## Leading-indicator read (NOT a backtest)`);
  lines.push("");
 lines.push(`*A 12-day rank-movement sanity check while the real backtest matures. Avg rank Δ is positive when an act climbed (rank number fell). This is a directional smell test, not validation: too short a window, and rank movement is partly the model re-scoring itself.*`);
  lines.push("");
  lines.push(`Window: ${leading.window}`);
  lines.push("");
  lines.push(`| Signal | Acts | Avg rank Δ (↑ = climbed) |`);
  lines.push(`|---|--:|--:|`);
  for (const s of ["strong-buy", "buy", "premium", "fair"]) {
    const v = leading.avgRankDelta[s];
 lines.push(`| ${s} | ${leading.counts[s]} | ${v == null ? "—" : (v > 0 ? "+" : "") + v.toFixed(1)} |`);
  }
  lines.push("");
 lines.push(`**Read it loosely:** if \`strong-buy\` acts climb and \`premium\` acts slip over time, the signal has directional life. Do not quote this as accuracy, quote the matured backtest above once it exists.`);
  lines.push("");
}

lines.push(`## How to use this`);
lines.push("");
lines.push(`- Re-run weekly: \`node backend/backtestValueCalls.js --leading --write\`.`);
lines.push(`- The first real, quotable number ("of acts we flagged strong-buy N months ago, X% rose a fee or room tier") arrives once calls cross the ${HORIZON}-day horizon.`);
lines.push(`- That single number is what the talent-buyer persona said would move them more than any feature, it converts "looks plausible" into "proven."`);
lines.push("");

const out = lines.join("\n");

// Console summary
console.log(`\n=== Value-Call Backtest (horizon ${HORIZON}d, as of ${asOf}) ===`);
if (graded.length === 0) {
  console.log(`Gradable calls: 0 (history began ${firstCallDate}, oldest call ${oldestPending}d < ${HORIZON}d horizon).`);
  console.log(`Pending directional calls accruing: ${pending.length}. Framework ready; verdict matures with time.`);
} else {
  console.log(`Directional accuracy: ${accuracy}% (${hits}/${graded.length}).`);
}
if (leading) {
  console.log(`Leading read (${leading.window}):`);
  for (const s of ["strong-buy", "buy", "premium", "fair"]) {
    const v = leading.avgRankDelta[s];
 console.log(` ${s.padEnd(11)} n=${String(leading.counts[s]).padStart(3)} avgRankΔ ${v == null ? "—" : (v > 0 ? "+" : "") + v.toFixed(1)}`);
  }
}

if (WANT_WRITE) {
  fs.writeFileSync(REPORT, out);
  console.log(`\nWrote ${path.relative(path.join(__dirname, ".."), REPORT)}`);
}
