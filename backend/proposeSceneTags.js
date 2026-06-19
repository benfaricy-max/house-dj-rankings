/**
 * Scene-tag proposer — backfills credential evidence for the Scene Score.
 *
 * The Scene Score rubric (institution booking, festival slot, label home, Ibiza
 * residency, Boiler Room, Essential Mix, press) is hand-keyed, and only ~50 of 330
 * acts carry `scene_tags`. That thin coverage is what limits the reliability audit
 * (sceneReliability.js) and blocks adopting a computed diminishing-returns score.
 *
 * This proposes the credentials the DATA can actually evidence — from RA's most-played
 * venues, venue-capacity tier and label score — with the evidence attached, for human
 * review. It deliberately does NOT invent the credentials data can't see (Boiler Room /
 * HÖR / Cercle, Essential Mix, press covers): those are listed as `needs_human` per act.
 *
 * Output (for review, NOT live data):
 *   backend/scene_tags_proposed.json  — per act: proposed tags + evidence + rubric score
 *   backend/scene_tags_proposed.csv   — same, eyeball-friendly
 * Nothing is written to artists.json. After review, approved tags get merged by hand.
 *
 *   node backend/proposeSceneTags.js
 */
const fs = require("fs");
const path = require("path");
const RANKINGS = path.join(__dirname, "..", "frontend", "public", "rankings.json");

// Credibility institutions → the rubric's "institutional venue" credential (20).
const INSTITUTIONS = ["berghain", "panorama bar", "fabric", "dc-10", "dc10", "tresor", "sub club",
  "robert johnson", "bassiani", "khidi", "de school", "concrete", "rex club", "smart bar",
  "fold", "nowadays", "basement", "about blank", "watergate", "rye wax", "corsica"];
// Ibiza superclubs → "Ibiza residency" credential (10) — flagged REVIEW (booking ≠ residency).
const IBIZA_CLUBS = ["pacha", "amnesia", "dc-10", "dc10", "hï", "hi ibiza", "ushuaïa", "ushuaia",
  "eden", "[unvrs]", "unvrs", "privilege", "es paradis", "lío", "octan", "club chinois"];
// Festival / main-stage venues → "festival closing/main-stage" credential (15).
const FESTIVALS = ["tomorrowland", "awakenings", "time warp", "movement", "exit", "crssd", "sónar",
  "sonar", "warehouse project", "factory town", "dgtl", "parklife", "glastonbury", "coachella",
  "ultra", "creamfields", "junction 2", "lost village", "the brooklyn mirage", "brooklyn storehouse"];

const norm = s => (s || "").toLowerCase();
const hasVenue = (venues, list) => {
  const hits = [];
  for (const v of venues) { const n = norm(v.name); for (const k of list) if (n.includes(k)) { hits.push(v.name); break; } }
  return [...new Set(hits)];
};

// Diminishing-returns score (mirror of sceneReliability.js): 100*(1-e^(-0.029*S)).
const CREDIT_PTS = { institution: 20, festival: 15, label: 15, ibiza: 10, tastemaker: 20, press: 10, mix: 10 };
const score = cats => Math.round(100 * (1 - Math.exp(-0.029 * cats.reduce((s, c) => s + (CREDIT_PTS[c] || 0), 0))));

function propose(a) {
  const venues = (a.ra_top_venues || []).filter(v => v && v.name);
  const regions = (a.ra_top_regions || []).map(r => norm(r.name || r));
  const ev = {}, cats = new Set();

  const inst = hasVenue(venues, INSTITUTIONS);
  if (inst.length) { cats.add("institution"); ev.institution = inst; }

  const fest = hasVenue(venues, FESTIVALS);
  if (fest.length) { cats.add("festival"); ev.festival = fest; }
  else if (a.ra_venue_tier >= 5) { cats.add("festival"); ev.festival = [`venue tier ${a.ra_venue_tier}/5 (5,000+ cap)`]; }

  const ibizaV = hasVenue(venues, IBIZA_CLUBS);
  if (ibizaV.length && regions.some(r => r.includes("ibiza"))) { cats.add("ibiza"); ev.ibiza = ibizaV; }

 if (a.label_score >= 70) { cats.add("label"); ev.label = [`label_score ${a.label_score}/100 (name not stored, confirm)`]; }

  return { cats: [...cats], evidence: ev };
}

function main() {
  const d = JSON.parse(fs.readFileSync(RANKINGS, "utf8"));
  const r = d.rankings || d;
  const out = [];
  let gained = 0;
  for (const a of r) {
    const existing = Array.isArray(a.scene_tags) ? a.scene_tags : [];
    const p = propose(a);
    if (p.cats.length && !existing.length) gained++;
    out.push({
      name: a.name, rank: a.rank, hand_scene: a.manual_scene_score,
      existing_tags: existing,
      proposed_credits: p.cats,
      evidence: p.evidence,
      proposed_rubric_score: p.cats.length ? score(p.cats) : null,
      needs_human: ["tastemaker (Boiler Room/HÖR/Cercle)", "press cover", "Essential Mix / podcast"],
    });
  }
  fs.writeFileSync(path.join(__dirname, "scene_tags_proposed.json"), JSON.stringify(out, null, 2));

  const esc = v => { const s = Array.isArray(v) ? v.join("; ") : (v == null ? "" : String(v)); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const cols = ["rank", "name", "hand_scene", "proposed_rubric_score", "proposed_credits", "evidence_institution", "evidence_festival", "evidence_ibiza", "evidence_label", "existing_tags"];
  const rows = out.sort((a, b) => (a.rank || 999) - (b.rank || 999)).map(o => [
    o.rank, o.name, o.hand_scene, o.proposed_rubric_score, o.proposed_credits,
    o.evidence.institution, o.evidence.festival, o.evidence.ibiza, o.evidence.label, o.existing_tags,
  ].map(esc).join(","));
  fs.writeFileSync(path.join(__dirname, "scene_tags_proposed.csv"), [cols.join(","), ...rows].join("\n"));

  const withProp = out.filter(o => o.proposed_credits.length).length;
  console.log(`\n=== Scene-tag proposal ===`);
  console.log(`${r.length} acts | ${withProp} got >=1 data-evidenced credential | ${gained} previously-untagged acts now have evidence`);
  console.log(`Tag coverage would rise from ~${out.filter(o => o.existing_tags.length).length} to ~${withProp} (data-evidenced credentials only).`);
  console.log(`Still needs human review per act: Boiler Room/HÖR, Essential Mix, press covers (not in any data field).`);
 console.log(`\nWrote backend/scene_tags_proposed.json +.csv: review, then merge approved tags into artists.json scene_tags.\n`);
  console.log(`Sample (top 10):`);
 for (const o of out.slice(0, 10)) console.log(` #${o.rank} ${o.name.padEnd(18)} hand ${o.hand_scene} → proposed ${o.proposed_rubric_score ?? "—"} [${o.proposed_credits.join(", ") || "no data evidence"}]`);
}
main();
