/**
 * Recomputes club/festival booking-fee estimates from current data.
 * Curated bands for known artists + listener-based fallback for the tail.
 * Run after listener data changes so fees never go stale. Writes booking_fee
 * into rankings.json + artists.json.
 */
const fs = require("fs");
const path = require("path");
const RANKINGS = path.join(__dirname, "..", "frontend", "public", "rankings.json");
const ARTISTS  = path.join(__dirname, "artists.json");

const BANDS = {
  A: { label: "£70K–£150K", mid: 100000, tier: 6, color: "#f59e0b" },
  B: { label: "£35K–£70K",  mid: 50000,  tier: 5, color: "#f59e0b" },
  C: { label: "£18K–£40K",  mid: 28000,  tier: 4, color: "#3b82f6" },
  D: { label: "£8K–£18K",   mid: 12000,  tier: 3, color: "#8b5cf6" },
  E: { label: "£4K–£10K",   mid: 6500,   tier: 2, color: "var(--accent)" },
  F: { label: "£1.5K–£5K",  mid: 3000,   tier: 1, color: "var(--muted)" },
};

const CURATED = {
  "FISHER":"A","Fred again..":"A","John Summit":"A","Dom Dolla":"A","Disclosure":"A","Peggy Gou":"A","Black Coffee":"A","Eric Prydz":"A",
  "Carl Cox":"B","Solomun":"B","Four Tet":"B","Charlotte de Witte":"B","Amelie Lens":"B","Richie Hawtin":"B","Sven Väth":"B","Tale Of Us":"B","Adam Beyer":"B","BICEP":"B","Bonobo":"B","James Hype":"B","Maceo Plex":"B","Anyma":"B","Honey Dijon":"B","Jamie Jones":"B","Chris Lake":"B","Sasha":"B","John Digweed":"B","MK":"B","Duke Dumont":"B",
  "The Martinez Brothers":"C","Hot Since 82":"C","Seth Troxler":"C","Loco Dice":"C","Joseph Capriati":"C","Ben Böhmer":"C","Nora En Pure":"C","Stephan Bodzin":"C","Adriatique":"C","Gorgon City":"C","Mall Grab":"C","Skream":"C","DJ Koze":"C","Maya Jane Coles":"C","Patrick Topping":"C","Luciano":"C","Trentemøller":"C","Joris Voorn":"C","Green Velvet":"C","Claude VonStroke":"C","Kerri Chandler":"C","Laurent Garnier":"C","Ricardo Villalobos":"C","Floating Points":"C","Mind Against":"C","Monolink":"C","Deborah De Luca":"C","Dimitri From Paris":"C","Bob Sinclar":"C","Michael Bibi":"C","Mau P":"C","Cloonee":"C","Mark Farina":"C","Chris Stussy":"C","ANOTR":"C","Disco Lines":"C","Prospa":"C",
  "Josh Baker":"D","Ben Sterling":"D","East End Dubs":"D","Cristoph":"D","WEISS":"D","Walker & Royce":"D","PAWSA":"D","Dennis Cruz":"D","Franky Rizardo":"D","KETTAMA":"D","SIDEPIECE":"D","Eli Brown":"D","Mathame":"D","Yotto":"D","Carlita":"D","Job Jobse":"D","Mano Le Tough":"D","WhoMadeWho":"D","Louie Vega":"D","David Morales":"D","Roger Sanchez":"D","Armand Van Helden":"D","Todd Terry":"D","Danny Tenaglia":"D","Kevin Saunderson":"D","Luigi Madonna":"D","Marco Faraone":"D","Hannah Wants":"D","Lee Foss":"D","Richy Ahmed":"D","Paco Osuna":"D","Alan Fitzpatrick":"D","Wehbba":"D","Sam Paganini":"D","Dax J":"D","Len Faki":"D","Surgeon":"D","Helena Hauff":"D","Jayda G":"D","HAAi":"D","TSHA":"D","Massano":"D","Innellea":"D","Agents Of Time":"D","Henry Saiz":"D","Kollektiv Turmstrasse":"D","Booka Shade":"D","Gui Boratto":"D","Tiga":"D","Mark Knight":"D","Steve Lawler":"D","Roman Flügel":"D","Gerd Janson":"D","Michael Mayer":"D","Marshall Jefferson":"D","DJ Sneak":"D","Larry Heard":"D","DJ Pierre":"D","Stacey Pullen":"D","Kenny Larkin":"D","Slam":"D","Miss Kittin":"D","Guy Gerber":"D","Move D":"D","Midland":"D","Justin Martin":"D","Tiefschwarz":"D","DJ Rush":"D","Blawan":"D","Objekt":"D","Special Request":"D","Latmun":"D",
};

// ── Listeners→fee ladder, calibrated to the curated tiers ──────────────────
// The curated hand-tiers are our highest-fidelity knowledge (real anchors are
// rarer still). Rather than a crude listener step-function, we FIT a log-log
// curve through the curated acts (listeners → band mid) and use it to ladder
// the un-curated tail DOWN from that known structure. Listeners is the single
// best fee predictor we have (R²≈0.23 vs curated, beating demand_index/score/
// live_demand — fees track reach more than the credibility index does), but it
// is weak alone, so the curve is PAIRED with the methodology three ways:
//   1. calibrated on curated tiers (not invented),
//   2. clamped so an estimated tail act can't out-rank the known headliners
//      (tail capped at band B; A is reserved for curated/anchored),
//   3. discounted for `emerging` acts (they under-monetise their reach), reusing
//      the reputation flag the methodology already tracks.
// Real anchors, when we have enough to trust (≥3, so one outlier can't swing it),
// re-level the curve's intercept to pass through ground truth.
const BAND_MID = Object.fromEntries(Object.entries(BANDS).map(([k, b]) => [k, b.mid]));
const EMERGING_DISCOUNT = 0.45; // unknown acts under-price their listeners vs established curated peers
let byNameGlobal = {}; // set after load; used by relevelToAnchors to look up anchor listeners

function fitCuratedCurve(djs) {
  const pts = [];
  for (const d of djs) {
    const band = CURATED[d.name];
    const L = d.spotify_monthly_listeners || 0;
    if (band && L > 0) pts.push([Math.log10(L), Math.log10(BAND_MID[band])]);
  }
  const n = pts.length;
  const sx = pts.reduce((a, p) => a + p[0], 0), sy = pts.reduce((a, p) => a + p[1], 0);
  const sxx = pts.reduce((a, p) => a + p[0] * p[0], 0), sxy = pts.reduce((a, p) => a + p[0] * p[1], 0);
  const b = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  const a = (sy - b * sx) / n;
  return { a, b, n };
}

// Re-level the intercept so the calibrated curve passes through real anchors —
// only once ≥3 anchors exist (a single outlier like a press-reported top fee
// must not be allowed to swing the whole field; see the BC distortion test).
function relevelToAnchors(fit, anchors) {
  const real = Object.values(anchors).filter(e => byNameGlobal[e.name]?.spotify_monthly_listeners > 0);
  if (real.length < 3) return fit;
  let shift = 0;
  for (const e of real) {
    const L = byNameGlobal[e.name].spotify_monthly_listeners;
    shift += Math.log10(e.fee_gbp) - (fit.a + fit.b * Math.log10(L));
  }
  return { ...fit, a: fit.a + shift / real.length, releveled: real.length };
}

function estimateBand(a, fit) {
  const L = a.spotify_monthly_listeners || 0;
  if (!L) return a.emerging ? "F" : "E"; // no reach data → conservative
  let gbp = Math.pow(10, fit.a + fit.b * Math.log10(L));
  if (a.emerging) gbp *= EMERGING_DISCOUNT;
  let band = bandFromFee(gbp);
  if (band === "A") band = "B"; // top tier reserved for curated/anchored
  return band;
}

// Map a real fee (GBP) to the closest band by mid-point — so a verified anchor
// still slots into the same tier scale the demand model is calibrated against.
function bandFromFee(gbp) {
  let best = "F", bestD = Infinity;
  for (const [k, b] of Object.entries(BANDS)) {
    const d = Math.abs(b.mid - gbp);
    if (d < bestD) { bestD = d; best = k; }
  }
  return best;
}

// Real, sourced fee anchors (actual quoted/contracted/published fees). These
// OVERRIDE the curated/listener estimates and are surfaced as verified, not
// modelled — the one thing in the fee model that isn't demand-derived. Optional
// file; absent or empty = pure estimates (today's state). Never seed with guesses.
let ANCHORS = {};
try {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "fee_anchors.json"), "utf8"));
  for (const e of (raw.anchors || [])) {
    if (e && e.name && Number.isFinite(e.fee_gbp)) ANCHORS[e.name] = e;
  }
} catch { /* no anchors file yet — estimates only */ }

const rankData = JSON.parse(fs.readFileSync(RANKINGS, "utf8"));
const artists  = JSON.parse(fs.readFileSync(ARTISTS, "utf8"));
const byName   = Object.fromEntries(artists.map(a => [a.name, a]));
byNameGlobal   = Object.fromEntries(rankData.rankings.map(d => [d.name, d]));

// Fit the listeners→fee ladder to the curated tiers, then re-level to real
// anchors if we have enough of them to trust (≥3). This is the "paired" model:
// known tiers shape the curve, listeners ladder the tail, real fees pin the level.
const fit = relevelToAnchors(fitCuratedCurve(rankData.rankings), ANCHORS);

// Confidence is explicit per fee so the UI can show how firm each number is.
const CONFIDENCE = { anchored: "high", curated: "medium", estimate: "low" };

let changed = 0, anchored = 0, estimated = 0;
for (const dj of rankData.rankings) {
  const anchor = ANCHORS[dj.name];
  let fee;
  if (anchor) {
    // Verified real fee — overrides the estimate, carries its provenance.
    const band = bandFromFee(anchor.fee_gbp);
    fee = {
      ...BANDS[band], band,
      label: anchor.fee_label || BANDS[band].label,
      mid: anchor.fee_gbp,
      basis: "anchored",
      fee_confidence: CONFIDENCE.anchored,
      fee_source: anchor.source || "anchor",
      fee_source_url: anchor.source_url || null,
      fee_date: anchor.date || null,
    };
    anchored++;
  } else if (CURATED[dj.name]) {
    const band = CURATED[dj.name];
    fee = { ...BANDS[band], band, basis: "curated", fee_confidence: CONFIDENCE.curated };
  } else {
    const band = estimateBand(dj, fit);
    fee = { ...BANDS[band], band, basis: "estimate", fee_confidence: CONFIDENCE.estimate };
    estimated++;
  }
  const before = dj.booking_fee?.label;
  dj.booking_fee = fee;
  if (byName[dj.name]) byName[dj.name].booking_fee = fee;
  if (before !== fee.label) changed++;
}
const reLvl = fit.releveled ? `re-leveled to ${fit.releveled} anchors` : `curated-calibrated (no anchor re-level yet)`;
console.log(`Ladder fit: log10(fee) = ${fit.a.toFixed(3)} + ${fit.b.toFixed(3)}·log10(listeners) from ${fit.n} curated tiers, ${reLvl}.`);
console.log(`Fees: ${anchored} anchored (verified), ${rankData.rankings.length - anchored - estimated} curated, ${estimated} laddered estimate.`);

fs.writeFileSync(RANKINGS, JSON.stringify(rankData));
fs.writeFileSync(ARTISTS, JSON.stringify(artists, null, 2));
console.log(`Recomputed fees. ${changed} changed.`);
for (const n of ["Prospa","Cloonee","KETTAMA","Massano","Josh Baker"]) {
  const a = rankData.rankings.find(x => x.name === n);
  console.log(`  ${n}: ${a?.booking_fee?.label} (${a?.booking_fee?.basis}/${a?.booking_fee?.fee_confidence})`);
}
