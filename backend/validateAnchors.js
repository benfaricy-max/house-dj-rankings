/**
 * validateAnchors.js — guard rail + flight plan for the fee-anchor program.
 *
 * WHY: 0 verified fee anchors is the single highest-leverage gap (STRATEGY.md §6).
 * Every Value Gap is currently demand-vs-ESTIMATE. The whole wedge, USP, pricing,
 * and the neutrality moat rest on fee accuracy that is unproven. Goal: 30–40 real
 * anchors. This script does two jobs:
 *
 *   1. VALIDATE  — every anchor in fee_anchors.json is schema-clean, name-matches
 *      the roster, has real provenance, and isn't an outlier that smells like an
 *      error. Plus the ANTI-LOWBALL check: a fee model fed only by promoters
 *      (who want low comps) drifts DOWN. Neutrality dies if buyers set the anchors.
 *      We flag source-side balance so the dataset stays two-sided and honest.
 *
 *   2. TARGET    — print the prioritized list of which ~30–40 anchors to collect
 *      FIRST, so the founder's calls (GTM.md) double as anchor collection on the
 *      highest-leverage acts: the strong-buy reads being pitched + a calibration
 *      spread across every fee tier (so the tier scale itself is grounded).
 *
 * Usage:
 *   node backend/validateAnchors.js            # validate + coverage + targets
 *   node backend/validateAnchors.js --targets  # just the collection target list
 *   node backend/validateAnchors.js --strict   # exit 1 if any anchor is invalid (CI)
 */
const fs = require("fs");
const path = require("path");

const RANKINGS = path.join(__dirname, "..", "frontend", "public", "rankings.json");
const ANCHORS = path.join(__dirname, "fee_anchors.json");

const args = process.argv.slice(2);
const ONLY_TARGETS = args.includes("--targets");
const STRICT = args.includes("--strict");

const GOAL = 35; // midpoint of the 30–40 calibration goal
const VALID_SOURCES = ["promoter-quote", "agency-ratecard", "contract", "press"];
// Source "side": who the number comes from. A healthy dataset is balanced so it
// can't be dragged down by buyers or up by sellers.
const SOURCE_SIDE = {
  "promoter-quote": "buy",   // promoter reports what they paid → buy-side incentive: low
  "agency-ratecard": "sell", // agency rate card → sell-side incentive: high
  "contract": "neutral",     // a signed contract is ground truth
  "press": "neutral",        // published fee, no party controls it
};

const data = JSON.parse(fs.readFileSync(RANKINGS, "utf8"));
const rankings = data.rankings || [];
const byName = Object.fromEntries(rankings.map(a => [a.name, a]));

let anchorsRaw;
try { anchorsRaw = JSON.parse(fs.readFileSync(ANCHORS, "utf8")); }
catch { anchorsRaw = { anchors: [] }; }
const anchors = anchorsRaw.anchors || [];

// ---------------------------------------------------------------------------
// 1. VALIDATE
// ---------------------------------------------------------------------------
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || "");
const problems = [];
const sideCount = { buy: 0, sell: 0, neutral: 0 };

for (const [i, a] of anchors.entries()) {
  const where = `anchor[${i}] ${a && a.name ? `"${a.name}"` : ""}`;
  if (!a || typeof a !== "object") { problems.push(`${where}: not an object`); continue; }
  if (!a.name) problems.push(`${where}: missing name`);
  else if (!byName[a.name]) problems.push(`${where}: name "${a.name}" not found in rankings.json (must match exactly)`);
  if (!Number.isFinite(a.fee_gbp)) problems.push(`${where}: fee_gbp must be a number`);
  else if (a.fee_gbp < 500 || a.fee_gbp > 500000) problems.push(`${where}: fee_gbp ${a.fee_gbp} outside sane £500–£500k range — typo?`);
  if (!VALID_SOURCES.includes(a.source)) problems.push(`${where}: source "${a.source}" not one of ${VALID_SOURCES.join(" | ")}`);
  if (!isDate(a.date)) problems.push(`${where}: date "${a.date}" must be YYYY-MM-DD`);
  if ((a.source === "press" || a.source === "agency-ratecard") && !a.source_url)
    problems.push(`${where}: ${a.source} anchors should carry a source_url for auditability`);

  // Outlier smell test — anchor wildly off the current estimate may be an error.
  const dj = byName[a.name];
  if (dj && Number.isFinite(a.fee_gbp) && dj.booking_fee && dj.booking_fee.mid) {
    const ratio = a.fee_gbp / dj.booking_fee.mid;
    if (ratio > 4 || ratio < 0.25)
      problems.push(`${where}: fee £${a.fee_gbp} is ${ratio.toFixed(1)}× the current estimate (£${dj.booking_fee.mid}). Verify it's not a typo or a different artist.`);
  }

  const side = SOURCE_SIDE[a.source];
  if (side) sideCount[side]++;
}

// ANTI-LOWBALL / neutrality balance check.
const balanceWarnings = [];
if (anchors.length >= 5) {
  const buyShare = sideCount.buy / anchors.length;
  if (buyShare > 0.7)
    balanceWarnings.push(`⚠ ${Math.round(buyShare * 100)}% of anchors are promoter-quoted (buy-side). A buyer-fed fee model drifts DOWN and quietly lowers market fees — the exact failure the artist-manager persona warned about, and it erodes the neutrality moat. Balance with agency rate cards / contracts / press.`);
  if (sideCount.neutral === 0)
    balanceWarnings.push(`⚠ Zero ground-truth anchors (contract / press). At least a few neutral anchors are needed to calibrate the buy-vs-sell spread.`);
}

// ---------------------------------------------------------------------------
// 2. COVERAGE
// ---------------------------------------------------------------------------
const valid = anchors.filter((_, i) => !problems.some(p => p.startsWith(`anchor[${i}]`)));
const coverage = valid.length;
const pct = Math.round((coverage / GOAL) * 100);

// ---------------------------------------------------------------------------
// 3. TARGETS — which anchors to collect first
// ---------------------------------------------------------------------------
// Priority A: the strong-buy/buy reads (biggest £-hook, already being pitched in GTM).
// Priority B: a calibration spread — at least ~5 anchors per fee tier so the tier
//             scale the demand model is calibrated against is itself grounded.
const have = new Set(valid.map(a => a.name));
const directional = rankings.filter(a => (a.value_signal === "strong-buy" || a.value_signal === "buy") && !have.has(a.name));
directional.sort((a, b) => (b.value_gap_pct || 0) - (a.value_gap_pct || 0));

const tierTargets = {}; // tier -> {have, names[]}
for (const a of rankings) {
  const t = a.booking_fee && a.booking_fee.tier;
  if (!t) continue;
  tierTargets[t] = tierTargets[t] || { have: 0, candidates: [] };
  if (have.has(a.name)) tierTargets[t].have++;
  else tierTargets[t].candidates.push(a.name);
}

// ---------------------------------------------------------------------------
// OUTPUT
// ---------------------------------------------------------------------------
if (!ONLY_TARGETS) {
  console.log(`\n=== Fee-Anchor Validation ===`);
  console.log(`Anchors in file: ${anchors.length}  ·  valid: ${valid.length}  ·  goal: ${GOAL}`);
  console.log(`Coverage toward goal: ${coverage}/${GOAL} (${pct}%)  ${"█".repeat(Math.round(pct / 5)).padEnd(20, "░")}`);
  console.log(`Source balance — buy-side: ${sideCount.buy}  sell-side: ${sideCount.sell}  ground-truth: ${sideCount.neutral}`);
  if (problems.length) {
    console.log(`\n❌ ${problems.length} problem(s):`);
    problems.forEach(p => console.log(`   - ${p}`));
  } else {
    console.log(`\n✅ No schema/provenance problems.`);
  }
  if (balanceWarnings.length) {
    console.log(`\nNeutrality / anti-lowball:`);
    balanceWarnings.forEach(w => console.log(`   ${w}`));
  }
}

console.log(`\n=== Collection Targets (highest-leverage first) ===`);
console.log(`\nPriority A — strong-buy/buy reads already in the pitch pipeline (the £-hook is biggest, and the call is on the line until a real fee grounds it):`);
directional.slice(0, 12).forEach((a, i) => {
  const f = a.booking_fee || {};
  console.log(`  ${String(i + 1).padStart(2)}. ${a.name.padEnd(22)} ${(f.label || "?").padEnd(12)} ${a.value_signal}  gap ${a.value_gap_pct != null ? "+" + a.value_gap_pct + "%" : "?"}  [${f.basis}]`);
});

console.log(`\nPriority B — calibration spread (aim ≥5 grounded anchors per fee tier so the tier scale is real, not assumed):`);
for (const t of [6, 5, 4, 3, 2, 1]) {
  const tt = tierTargets[t];
  if (!tt) continue;
  const band = (rankings.find(a => a.booking_fee && a.booking_fee.tier === t) || {}).booking_fee?.label || "?";
  const need = Math.max(0, 5 - tt.have);
  console.log(`  Tier ${t} (${band}): have ${tt.have}, need ~${need}.  e.g. ${tt.candidates.slice(0, 4).join(", ")}`);
}

console.log(`\nNext: every founder call in GTM.md §1 should END by asking the buyer for ONE real number ("what did the last comparable booking actually cost?"). Log it to backend/fee_anchors.json. Re-run this to watch coverage climb and the balance stay two-sided.`);

if (STRICT && problems.length) process.exit(1);
