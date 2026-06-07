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

// LIVE-LED demand index. Bookers told us global digital metrics are noise until
// they line up with local ticket velocity, venue size and tour routing — so the
// index is anchored to live demand (venue tier the artist commands, actual draw
// per show, streaming→live conversion, routing breadth), with digital reach as a
// supporting tiebreaker, not the driver. Live/local signals carry ~0.66 of weight.
const SIGNALS = [
  { key: "venue",      weight: 0.24, get: a => a.ra_venue_tier > 0 ? (a.ra_venue_tier / 5) * 100 : null },                 // room size they command = the fee anchor
  { key: "attendance", weight: 0.22, get: a => a.ra_avg_attending > 0 ? Math.log10(1 + a.ra_avg_attending) : null },        // actual draw/show = local ticket velocity
  { key: "conversion", weight: 0.12, get: a => Number.isFinite(a.live_conversion_score) ? a.live_conversion_score : null },  // streaming→live conversion
  { key: "routing",    weight: 0.08, get: a => (a.tour_countries || a.ra_countries) > 0 ? (a.tour_countries || a.ra_countries) : null }, // tour routing breadth
  { key: "reach",      weight: 0.16, get: a => a.spotify_monthly_listeners > 0 ? Math.log10(1 + a.spotify_monthly_listeners) : null },   // global reach, supporting
  { key: "beatport",   weight: 0.12, get: a => a.beatport_score > 0 ? a.beatport_score : null },                            // scene credibility
  { key: "trends",     weight: 0.03, get: a => a.google_trends_score > 0 ? a.google_trends_score : null },
  { key: "youtube",    weight: 0.03, get: a => a.youtube_subscribers > 0 ? Math.log10(1 + a.youtube_subscribers) : null },
];

// A fee is bounded by the rooms you fill. Cap the demand-implied tier at the
// venue tier the artist actually commands (+1 for headroom) so we never claim
// arena fees for a club act — the #1 reason a booker stops trusting the number.
const venueCeiling = vt => (vt > 0 ? Math.min(6, Math.round(vt) + 1) : 6);

// RA "attending" is an RSVP count that skews underground — it structurally
// UNDER-represents festival/commercial acts whose crowd isn't on RA. Judging an
// artist off an unrepresentative sample produces false "overpriced" calls on famous
// acts (e.g. a tier-4 venue act showing 16 RSVPs) — the single fastest way to lose a
// booker's trust, and exactly what PERMANENT RULE #1 forbids. So we only publish a
// verdict when the RA draw is substantial enough to represent the rooms the act commands.
const attendFloor = vt => (vt >= 5 ? 120 : vt >= 4 ? 60 : vt >= 3 ? 30 : 0);
const liveAnchorOk = a => {
  if (!(a.ra_venue_tier > 0) || !(a.ra_avg_attending > 0)) return false;
  // attendance must be plausible for the venue tier the act commands
  if (a.ra_avg_attending < attendFloor(a.ra_venue_tier)) return false;
  // a top-fee act (curated A/B, £35k+) with a thin RA draw = RA simply doesn't see
  // their audience — its demand reading is noise, not evidence of weak demand.
  if (a.booking_fee.tier >= 5 && a.ra_avg_attending < 120) return false;
  // REACH MISMATCH — a big-reach act (≥1M monthly listeners) whose RA draw is a
  // negligible slice of its real audience (<4 attending per 100k listeners) is the
  // same under-coverage problem even when RA also depresses its venue tier. This
  // catches the festival/commercial acts the venue-tier floor misses because RA
  // logs them in small rooms (e.g. a 1M+ act at venue T3 with ~34 RSVPs).
  if (a.spotify_monthly_listeners >= 1e6 && Number.isFinite(a.live_conversion) && a.live_conversion < 4) return false;
  return true;
};

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

  // 1b. Streaming-to-Live Conversion — RA live intent per 100k streaming fans.
  // The number pure streaming hides: a niche act with 200k listeners + strong RA
  // attendance converts better than a 2M-listener act with weak live demand.
  const convVals = [];
  for (const a of A) {
    // Use AVG attending (typical headline draw), not peak — peak is often a
    // shared festival total and over-credits anyone who played that festival.
    const live = a.ra_avg_attending || 0;   // RA "attending" intent, per typical show
    const reach = a.spotify_monthly_listeners || 0;
    if (live > 0 && reach >= 50000) {
      a.live_conversion = Math.round((live / (reach / 100000)) * 10) / 10;   // attending per 100k listeners
      convVals.push(a.live_conversion);
    } else { a.live_conversion = null; }
  }
  // percentile-based 0-100 score so "high conversion" is comparable across the field
  if (convVals.length >= 5) {
    const sorted = [...convVals].sort((x, y) => x - y);
    for (const a of A) {
      if (a.live_conversion == null) { a.live_conversion_score = null; continue; }
      const below = sorted.filter(v => v < a.live_conversion).length;
      a.live_conversion_score = Math.round((below / sorted.length) * 100);
    }
  }

  // 2. Calibrate demand → tier using the real fee-tier distribution.
  // Only judge artists whose fee is actually KNOWN (curated/anchored) AND who have
  // a LIVE ANCHOR — a venue tier they command and a real attendance figure. Without
  // live data the verdict is just global-digital noise, which is exactly what
  // bookers don't trust. No live anchor → no published verdict.
  const withFee = A.filter(a => a.booking_fee?.tier && a.demand_index != null
    && (a.booking_fee.basis === "curated" || a.booking_fee.basis === "anchored")
    && liveAnchorOk(a));
  const tierCounts = {};
  for (const a of withFee) tierCounts[a.booking_fee.tier] = (tierCounts[a.booking_fee.tier] || 0) + 1;
  const ranked = [...withFee].sort((x, y) => y.demand_index - x.demand_index);
  let i = 0;
  for (let tier = 6; tier >= 1; tier--) {           // assign highest-demand artists the top tiers
    const n = tierCounts[tier] || 0;
    for (let k = 0; k < n && i < ranked.length; k++, i++) ranked[i].demand_tier = tier;
  }
  while (i < ranked.length) ranked[i++].demand_tier = 1; // safety

  // 2b. VENUE CAP — a fee can't outrun the rooms you fill. Cap the demand-implied
  // tier at the artist's venue ceiling so we never claim arena fees for a club act.
  for (const a of withFee) a.demand_tier = Math.min(a.demand_tier, venueCeiling(a.ra_venue_tier));

  // 3. Gap + labels.
  let buys = 0;
  const VENUE_LABEL = { 5: "5,000+", 4: "1,500–5,000", 3: "700–1,500", 2: "300–700", 1: "<300" };
  for (const a of withFee) {
    const gap = a.demand_tier - a.booking_fee.tier;     // +ve = underpriced
    a.value_gap = gap;
    a.value_gap_updated = new Date().toISOString();
    a.demand_band = TIER_BAND[a.demand_tier];
    a.demand_fee_label = BAND_LABEL[a.demand_band];
    a.value_gap_pct = Math.round(((TIER_MID[a.demand_tier] - TIER_MID[a.booking_fee.tier]) / TIER_MID[a.booking_fee.tier]) * 100);
    // The live/local anchor the verdict rests on — surfaced in the Fair Value Report
    // so a booker sees ticket velocity + venue size + routing, not vanity metrics.
    a.value_anchor = {
      venue_tier: a.ra_venue_tier,
      venue_label: VENUE_LABEL[Math.round(a.ra_venue_tier)] || null,
      avg_attending: a.ra_avg_attending || null,
      conversion: Number.isFinite(a.live_conversion_score) ? a.live_conversion_score : null,
      routing_countries: a.tour_countries || a.ra_countries || null,
      top_regions: Array.isArray(a.ra_top_regions) ? a.ra_top_regions.slice(0, 4).map(r => r.name) : [],
      capped_by_venue: a.demand_tier === venueCeiling(a.ra_venue_tier),
    };
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
    a.demand_fee_label = null; a.value_gap_pct = null; a.demand_tier = null; a.value_anchor = null;
    a.value_gap_updated = null;
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
  top.forEach(a => console.log(`  +${a.value_gap} | ${a.name.padEnd(22)} fee ${(a.booking_fee.label||"?").padEnd(11)} → demand ${(a.demand_fee_label||"?").padEnd(11)} | venue T${a.value_anchor?.venue_tier} ${a.value_anchor?.avg_attending}/show | mom ${a.momentum_score ?? "—"} | ${a.value_signal}`));
}

module.exports = { computeValueGap };
