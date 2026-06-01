/**
 * Price/Demand Gap — the buy signal. Estimates where an artist's booking fee
 * SHOULD sit based on demand data, then flags artists whose demand has outpaced
 * their known fee tier (undervalued = book them before the price catches up).
 *
 * Method (transparent, no black box):
 *  1. demand_index (0-100) from booking-relevant proxies — reach, live booking
 *     demand (RA venue tier/attendance), chart credibility, YouTube, search.
 *  2. Calibrate to fee tiers using the ACTUAL fee distribution: we assign
 *     demand-implied tiers in the same proportions as real tiers, so a gap means
 *     genuine misalignment (demand ranks you higher than your fee), not a scale
 *     artefact. Sum of gaps across the field is ~0 — it's a relative repricing.
 *  3. value_gap = demand_tier − actual_tier. Positive = underpriced. A "buy"
 *     signal pairs an underpriced tier with positive momentum (demand surging).
 *
 * Run after computeFees.js + enrichMomentum.js (needs fees + momentum_score).
 */
const fs = require("fs");
const path = require("path");
const RANKINGS = path.join(__dirname, "..", "frontend", "public", "rankings.json");
const ARTISTS  = path.join(__dirname, "artists.json");

// tier → band (mirror of computeFees BANDS)
const TIER_BAND = { 6: "A", 5: "B", 4: "C", 3: "D", 2: "E", 1: "F" };
const BAND_LABEL = { A: "£70K–£150K", B: "£35K–£70K", C: "£18K–£40K", D: "£8K–£18K", E: "£4K–£10K", F: "£1.5K–£5K" };
const TIER_MID = { 6: 100000, 5: 50000, 4: 28000, 3: 12000, 2: 6500, 1: 3000 };

// Booking-relevant demand signals and their weight in the demand index.
// (Reach + live booking demand dominate what a fee is actually built on.)
const SIGNALS = [
  { key: "reach",    weight: 0.40, get: a => a.spotify_monthly_listeners > 0 ? Math.log10(1 + a.spotify_monthly_listeners) : null },
  { key: "ra",       weight: 0.22, get: a => a.ra_score > 0 ? a.ra_score : null },          // venue tier, attendance, geo spread
  { key: "beatport", weight: 0.18, get: a => a.beatport_score > 0 ? a.beatport_score : null },
  { key: "youtube",  weight: 0.10, get: a => a.youtube_subscribers > 0 ? Math.log10(1 + a.youtube_subscribers) : null },
  { key: "trends",   weight: 0.10, get: a => a.google_trends_score > 0 ? a.google_trends_score : null },
];

function computeValueGap(A) {
  // 1. demand_index, self-healing per-artist over signals it has.
  const ranges = {};
  for (const s of SIGNALS) {
    const vals = A.map(s.get).filter(v => v != null);
    ranges[s.key] = vals.length >= 5 ? { min: Math.min(...vals), max: Math.max(...vals), live: true } : { live: false };
  }
  for (const a of A) {
    let sum = 0, w = 0;
    for (const s of SIGNALS) {
      if (!ranges[s.key].live) continue;
      const v = s.get(a); if (v == null) continue;
      const { min, max } = ranges[s.key];
      const n = max === min ? 50 : ((v - min) / (max - min)) * 100;
      sum += n * s.weight; w += s.weight;
    }
    a.demand_index = w > 0 ? Math.round(sum / w) : null;
  }

  // 2. Calibrate demand → tier using the real fee-tier distribution.
  // Only judge artists whose fee is actually KNOWN (curated/anchored). A gap
  // against a fallback ESTIMATE just measures the estimate's staleness, not true
  // underpricing — so those are excluded to keep the buy signal honest.
  const withFee = A.filter(a => a.booking_fee?.tier && a.demand_index != null
    && (a.booking_fee.basis === "curated" || a.booking_fee.basis === "anchored"));
  const tierCounts = {};
  for (const a of withFee) tierCounts[a.booking_fee.tier] = (tierCounts[a.booking_fee.tier] || 0) + 1;
  const ranked = [...withFee].sort((x, y) => y.demand_index - x.demand_index);
  let i = 0;
  for (let tier = 6; tier >= 1; tier--) {           // assign highest-demand artists the top tiers
    const n = tierCounts[tier] || 0;
    for (let k = 0; k < n && i < ranked.length; k++, i++) ranked[i].demand_tier = tier;
  }
  while (i < ranked.length) ranked[i++].demand_tier = 1; // safety

  // 3. Gap + labels.
  let buys = 0;
  for (const a of withFee) {
    const gap = a.demand_tier - a.booking_fee.tier;     // +ve = underpriced
    a.value_gap = gap;
    a.demand_band = TIER_BAND[a.demand_tier];
    a.demand_fee_label = BAND_LABEL[a.demand_band];
    a.value_gap_pct = Math.round(((TIER_MID[a.demand_tier] - TIER_MID[a.booking_fee.tier]) / TIER_MID[a.booking_fee.tier]) * 100);
    const surging = Number.isFinite(a.momentum_score) && a.momentum_score >= 40;
    // The TRUE buy signal = underpriced AND demand surging (momentum). A gap with
    // no momentum is "underpriced on static demand" (often a stale fee estimate).
    a.value_signal = gap >= 1 && surging ? "strong-buy"
                   : gap >= 1            ? "buy"
                   : gap <= -1           ? "premium"
                   : "fair";
    if (a.value_signal === "buy" || a.value_signal === "strong-buy") buys++;
  }
  // Clear value fields for every artist we did NOT judge (no known fee, or no
  // usable demand index) so stale values from a prior run never linger.
  const judged = new Set(withFee);
  for (const a of A) if (!judged.has(a)) {
    a.value_gap = null; a.value_signal = null; a.demand_band = null;
    a.demand_fee_label = null; a.value_gap_pct = null; a.demand_tier = null;
  }
  return { withFee, buys };
}

if (require.main === module) {
  const data = JSON.parse(fs.readFileSync(RANKINGS, "utf8"));
  const artists = JSON.parse(fs.readFileSync(ARTISTS, "utf8"));
  const byName = Object.fromEntries(artists.map(a => [a.name, a]));
  const { withFee, buys } = computeValueGap(data.rankings);
  // cache the editorial-relevant fields back to artists.json too
  for (const a of data.rankings) if (byName[a.name]) {
    Object.assign(byName[a.name], { demand_index: a.demand_index, demand_tier: a.demand_tier, value_gap: a.value_gap, value_signal: a.value_signal });
  }
  fs.writeFileSync(RANKINGS, JSON.stringify(data));
  fs.writeFileSync(ARTISTS, JSON.stringify(artists, null, 2));
  console.log(`Value gap computed for ${withFee.length} artists. ${buys} buy signals.`);
  const top = withFee.filter(a => a.value_gap > 0).sort((x, y) => (y.value_gap - x.value_gap) || (y.momentum_score || 0) - (x.momentum_score || 0)).slice(0, 14);
  console.log("\nMost underpriced (demand-implied tier vs actual fee):");
  top.forEach(a => console.log(`  +${a.value_gap} | ${a.name.padEnd(22)} fee ${a.booking_fee.label.padEnd(11)} → demand ${a.demand_fee_label.padEnd(11)} | mom ${a.momentum_score ?? "—"} | ${a.value_signal}`));
}

module.exports = { computeValueGap };
