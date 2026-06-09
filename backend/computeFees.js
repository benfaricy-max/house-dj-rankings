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

function fallbackBand(a) {
  const L = a.spotify_monthly_listeners || 0;
  if (a.emerging) { if (L > 3_000_000) return "D"; if (L > 800_000) return "E"; return "F"; }
  if (L > 2_000_000) return "C"; if (L > 500_000) return "D"; return "E";
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

let changed = 0, anchored = 0;
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
      fee_source: anchor.source || "anchor",
      fee_source_url: anchor.source_url || null,
      fee_date: anchor.date || null,
    };
    anchored++;
  } else {
    const band = CURATED[dj.name] || fallbackBand(dj);
    fee = { ...BANDS[band], band, basis: CURATED[dj.name] ? "curated" : "estimate" };
  }
  const before = dj.booking_fee?.label;
  dj.booking_fee = fee;
  if (byName[dj.name]) byName[dj.name].booking_fee = fee;
  if (before !== fee.label) changed++;
}
console.log(`Fee anchors applied: ${anchored} verified, ${rankData.rankings.length - anchored} estimated.`);

fs.writeFileSync(RANKINGS, JSON.stringify(rankData));
fs.writeFileSync(ARTISTS, JSON.stringify(artists, null, 2));
console.log(`Recomputed fees. ${changed} changed.`);
for (const n of ["Prospa","Cloonee","KETTAMA","Massano","Josh Baker"]) {
  const a = rankData.rankings.find(x => x.name === n);
  console.log(`  ${n}: ${a?.booking_fee?.label} (${a?.booking_fee?.basis})`);
}
