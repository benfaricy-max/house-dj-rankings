// PEAKTIME data freshness + coverage dashboard.
//
// WHY THIS EXISTS: every writer is merge-safe (PERMANENT RULE #1) — it keeps the
// last good value rather than wiping it. That protects uptime but HIDES rot: a
// signal can silently stop updating while the file keeps regenerating daily, so
// the site serves frozen numbers that still *look* alive. This script makes that
// visible. It separates three things the brand depends on:
//   1. FRESHNESS  — for signals that stamp their own *_updated, how old is it?
//   2. COVERAGE   — what % of the roster actually has a real (non-zero) value?
//   3. BLIND SPOTS— signals with no freshness stamp at all (can't be verified).
//
// Run:  node backend/freshness.js            (human table)
//       node backend/freshness.js --json     (machine output only)
//       node backend/freshness.js --ci       (exit 1 if anything is STALE/empty)
//
// Writes backend/data/freshness.json each run so you can chart drift over time.

const fs = require("fs");
const path = require("path");

const raw = require("../frontend/public/rankings.json");
const ARTISTS = Array.isArray(raw) ? raw : raw.artists || raw.rankings;

const FLAGS = process.argv.slice(2);
const JSON_ONLY = FLAGS.includes("--json");
const CI = FLAGS.includes("--ci");

const DAY = 86400000;
const now = Date.now();
const ageDays = iso => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? (now - t) / DAY : null;
};
const median = arr => {
  const v = arr.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};
const pct = (n, d) => (d ? Math.round((100 * n) / d) : 0);
const d1 = n => (n == null ? "—" : n.toFixed(1));

// Newest per-artist generation timestamp = when the file was last rebuilt.
const genAge = median(ARTISTS.map(a => ageDays(a.timestamp)));
const newestGen = Math.min(...ARTISTS.map(a => ageDays(a.timestamp)).filter(Number.isFinite));

// Signals. `real` defines a genuine (non-zero/non-null) value for coverage.
// `stamp` returns the signal's own freshness timestamp if it has one (else null).
// `maxDays` is the staleness threshold (matches CLAUDE.md where defined).
const SIGNALS = [
  { label: "Spotify listeners", real: a => a.spotify_monthly_listeners > 0, stamp: a => a.spotify_listeners_updated, maxDays: 7 },
  { label: "Beatport",          real: a => a.beatport_score > 0,            stamp: a => a.beatport_updated,          maxDays: 10 },
  { label: "Resident Advisor",  real: a => a.ra_score > 0,                  stamp: a => a.ra_updated,                maxDays: 14 },
  { label: "Tour density",      real: a => a.tour_score > 0,                stamp: a => a.tour_updated,              maxDays: 21 },
  { label: "Google Trends",     real: a => a.google_trends_score > 0,       stamp: a => a.google_trends_updated,     maxDays: 30 },
  { label: "YouTube subs",      real: a => a.youtube_subscribers > 0,       stamp: a => a.youtube_updated,           maxDays: 30 },
  { label: "TikTok",            real: a => a.tiktok_post_count > 0,         stamp: a => a.tiktok_updated,            maxDays: 30 },
  { label: "SoundCloud",        real: a => a.soundcloud_followers > 0,      stamp: null,                            maxDays: 30 },
  { label: "Momentum",          real: a => Number.isFinite(a.momentum_score) && a.momentum_score > 0, stamp: a => a.momentum_updated, maxDays: 7 },
  { label: "Value gap",         real: a => Number.isFinite(a.value_gap),    stamp: a => a.value_gap_updated,        maxDays: 7 },
];

const N = ARTISTS.length;
const rows = SIGNALS.map(s => {
  const covered = ARTISTS.filter(s.real).length;
  const coverage = pct(covered, N);
  let medAge = null, oldest = null, verifiable = false;
  if (s.stamp) {
    const ages = ARTISTS.filter(s.real).map(a => ageDays(s.stamp(a))).filter(Number.isFinite);
    // Only "verifiable" once the stamp field actually exists on the data — until
    // the next enrich run populates it, treat the signal as unverified, not OK.
    verifiable = ages.length > 0;
    if (verifiable) { medAge = median(ages); oldest = Math.max(...ages); }
  }
  // Status. A signal with its own stamp can be truly judged STALE.
  // One without a stamp can only be judged on coverage + the global gen age.
  let status;
  if (coverage === 0) status = "EMPTY";
  else if (verifiable && medAge != null && medAge > s.maxDays) status = "STALE";
  else if (!verifiable && genAge != null && genAge > s.maxDays) status = "UNVERIFIED·OLD";
  else if (!verifiable) status = "UNVERIFIED";
  else if (coverage < 50) status = "THIN";
  else status = "OK";
  return { label: s.label, coverage, covered, medAge, oldest, verifiable, maxDays: s.maxDays, status };
});

const report = {
  generatedAt: new Date().toISOString(),
  roster: N,
  generationAgeDaysMedian: genAge,
  generationAgeDaysNewest: Number.isFinite(newestGen) ? newestGen : null,
  signals: rows,
};

fs.mkdirSync(path.join(__dirname, "data"), { recursive: true });
fs.writeFileSync(path.join(__dirname, "data", "freshness.json"), JSON.stringify(report, null, 2));

if (JSON_ONLY) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const C = { dim: "\x1b[2m", red: "\x1b[31m", yellow: "\x1b[33m", green: "\x1b[32m", bold: "\x1b[1m", off: "\x1b[0m" };
  const color = st =>
    st === "OK" ? C.green :
    st === "STALE" || st === "EMPTY" ? C.red :
    st === "UNVERIFIED·OLD" || st === "THIN" ? C.yellow : C.dim;

  console.log(`\n${C.bold}PEAKTIME · data freshness${C.off}  ${C.dim}(${N} artists)${C.off}`);
  const ga = report.generationAgeDaysNewest;
  const genColor = ga == null ? C.dim : ga > 2 ? C.red : ga > 1 ? C.yellow : C.green;
  console.log(`Last full rebuild: ${genColor}${d1(ga)}d ago${C.off} ${C.dim}(newest row); median row ${d1(genAge)}d${C.off}`);
  if (ga != null && ga > 2)
 console.log(`${C.red} ⚠ stale rebuild, run enrichLocal.js; the site is serving ${Math.round(ga)}-day-old numbers.${C.off}`);

  console.log(`\n${C.dim}signal              cover   age(med)  oldest   thresh  status${C.off}`);
  for (const r of rows) {
    const pad = (s, n) => String(s).padEnd(n);
    const padl = (s, n) => String(s).padStart(n);
    const age = r.verifiable ? padl(d1(r.medAge) + "d", 8) : padl("no-stamp", 8);
 const old = r.verifiable ? padl(d1(r.oldest) + "d", 7) : padl("—", 7);
    console.log(
      `${pad(r.label, 18)}  ${padl(r.coverage + "%", 4)}  ${age}  ${old}  ${padl(r.maxDays + "d", 6)}  ${color(r.status)}${r.status}${C.off}`
    );
  }

  const blind = rows.filter(r => !r.verifiable && r.coverage > 0);
  if (blind.length) {
 console.log(`\n${C.yellow}Blind spots${C.off} ${C.dim}— these carry no *_updated stamp, so freshness can't be verified.`);
    console.log(`Merge-safety means a frozen one looks identical to a live one. Fix: have each`);
    console.log(`enrich* writer stamp a <signal>_updated field, then this turns green/red honestly.${C.off}`);
    console.log(`  ${blind.map(b => b.label).join(", ")}`);
  }
  console.log("");
}

if (CI) {
  const bad = rows.some(r => r.status === "STALE" || r.status === "EMPTY") ||
    (report.generationAgeDaysNewest != null && report.generationAgeDaysNewest > 3);
  if (bad) {
 console.error("freshness: FAIL, stale/empty signal or rebuild older than 3 days.");
    process.exit(1);
  }
}
