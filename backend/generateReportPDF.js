#!/usr/bin/env node
/**
 * generateReportPDF.js — PEAKTIME: The House 100
 * Consumer magazine PDF. Fan audience. Editorial voice. Data credibility.
 * ~52 pages. Three export variants.
 *
 *   node backend/generateReportPDF.js [--data path] [--out path] [--variant etsy|kdp|kindle]
 *
 * Variants:
 *   etsy    (default) Full dark brand, screen-optimised. Gumroad/Etsy.
 *   kdp     B&W-safe palette, print margins, URL as text. Amazon KDP.
 *   kindle  Reflowable HTML output (not PDF). Kindle conversion via Calibre.
 */
"use strict";
const fs             = require("fs");
const path           = require("path");
const { execSync }   = require("child_process");
const { pathToFileURL } = require("url");

// ── CLI ───────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const arg  = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const VARIANT = arg("--variant", "etsy");          // etsy | kdp | kindle
const ROOT    = path.join(__dirname, "..");
const DATA    = arg("--data", path.join(ROOT, "frontend/public/rankings.json"));
const SUFFIX  = VARIANT === "etsy" ? "" : `-${VARIANT}`;
const EXT     = VARIANT === "kindle" ? "html" : "pdf";
const OUT     = arg("--out", path.join(ROOT, `reports/PEAKTIME-House100-Summer2026${SUFFIX}.${EXT}`));
const isKDP   = VARIANT === "kdp";
const isKindle = VARIANT === "kindle";

// ── Weights (v5.1 from score.js — hardcoded so generator never drifts) ────────
const WEIGHTS = {
  live_demand: 0.17, scene: 0.20, beatport: 0.13, tl_support: 0.11,
  trends: 0.08, growth: 0.07, festival: 0.05, label: 0.05,
  listeners: 0.05, scene_geography: 0.03, yt_subs: 0.02,
  tiktok: 0.01, releases: 0.02, wikipedia: 0.01,
};
// Human-readable names for the method page
const WEIGHT_LABELS = {
  live_demand: "Live demand (RA bookings + tour density)",
  scene:       "Scene credibility (editorial rubric)",
  beatport:    "Beatport chart presence",
  tl_support:  "DJ support (1001Tracklists)",
  trends:      "Search momentum (Google Trends)",
  growth:      "Audience growth",
  festival:    "Festival presence",
  label:       "Label credibility",
  listeners:   "Monthly reach (Spotify)",
  scene_geography: "International booking footprint",
  yt_subs:     "YouTube subscriber base",
  tiktok:      "TikTok reach",
  releases:    "Release cadence",
  wikipedia:   "Cultural relevance (Wikipedia)",
};

// ── Load artists (auto-resolve merge conflict) ────────────────────────────────
function loadArtists() {
  let raw = fs.readFileSync(DATA, "utf8");
  if (raw.includes("<<<<<<<")) {
    console.log("⚠  rankings.json has merge conflict — reading clean copy from git HEAD");
    raw = execSync("git show HEAD:frontend/public/rankings.json",
      { cwd: ROOT, maxBuffer: 20 * 1024 * 1024 }).toString();
  }
  const parsed = JSON.parse(raw);
  const arr    = (parsed.rankings || parsed).slice()
    .sort((a, b) => (a.rank || 999) - (b.rank || 999));
  return { artists: arr, lastUpdated: parsed.lastUpdated };
}

// ── Load clubs ────────────────────────────────────────────────────────────────
async function loadClubs() {
  try {
    const { RANKED } = await import(
      pathToFileURL(path.join(ROOT, "frontend/src/clubsData.js")).href
    );
    return (RANKED || []).slice().sort((a, b) => (a.rank || 999) - (b.rank || 999));
  } catch (e) {
    console.warn("club data import failed — continuing without clubs:", e.message);
    return [];
  }
}

// ── Load genre classifier ─────────────────────────────────────────────────────
async function loadGenre() {
  try {
    return await import(
      pathToFileURL(path.join(ROOT, "frontend/src/genre.js")).href
    );
  } catch { return null; }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const esc = s => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const num = (v, dp = 0) => (v == null || isNaN(+v)) ? "—" : (+v).toFixed(dp);
const pct = v => v == null ? "" : `${v > 0 ? "+" : ""}${v}%`;

function verdict(a) {
  const sc = a.manual_scene_score  || 50;
  const dm = a.live_demand_score   || 0;
  const mo = a.momentum_score      || 0;
  const bp = a.beatport_score      || 0;
  const tl = a.tl_support_score    || 0;
  const tr = a.tour_score          || 0;

  // Living legend tier (sc 90+)
  if (sc >= 90) return "The scene has been saying this for years. The data agrees.";

  // Demand leads the field (80+)
  if (dm >= 80 && tl >= 75) return "The most booked, and selectors are playing it. That combination holds.";
  if (dm >= 80 && bp >= 85) return "Demand-led with the charts to back it up.";
  if (dm >= 80)              return "The most-booked act in this tier. Rooms, consistently.";

  // Beatport + DJ-support aligned and accelerating
  if (bp >= 90 && tl >= 58 && mo >= 60) return "Chart-leading and accelerating. Two things that rarely move together.";
  if (bp >= 90 && tl >= 58)             return "The most-played tracks in the DJ community. The rooms noticed.";

  // Touring at capacity with scene and demand
  if (tr >= 95 && sc >= 80 && dm >= 70) return "Touring at capacity. Scene and live rooms in sync.";
  if (tr >= 95 && sc >= 83)             return "Cultural weight that shows up in the touring numbers.";

  // All three axes strong
  if (sc >= 75 && dm >= 70 && mo >= 60) return "Scene, bookings, momentum. All three. The complete picture.";

  // DJ support leads — what selectors actually play
  if (tl >= 80 && sc >= 80) return "What the DJs play, and what the scene respects. Rarely the same act.";
  if (tl >= 75)              return "Selectors are playing it. Main stages follow selectors.";

  // High scene + solid demand, low momentum — structural, not trending
  if (sc >= 85 && dm >= 70 && mo < 35) return "Established. The demand is structural, not a trend.";
  if (sc >= 83 && dm >= 65 && mo < 42) return "Scene credibility driving the bookings. The rooms are following.";

  // Long career, very low momentum — the veteran read
  if (tr >= 88 && sc >= 80 && mo < 20) return "The long game. Demand is structural, nothing trend-driven about it.";

  // Scene + demand aligned
  if (sc >= 82 && dm >= 72) return "Scene and rooms aligned. The reliable read.";

  // Beatport + touring
  if (bp >= 85 && tr >= 80) return "Beatport-strong with the touring to back it up.";
  if (bp >= 80 && dm >= 65) return "Chart credibility and live demand moving together.";

  // Credibility + momentum
  if (sc >= 80 && mo >= 55) return "Credibility had the head start. Momentum is doing the rest.";

  // Momentum story
  if (mo >= 80) return "Everything moving at once. The story of this season.";
  if (mo >= 65 && dm >= 60) return "Rising faster than most. The bookings are catching up.";
  if (mo >= 55) return "Moving up. The climb is real.";

  // Scene leads demand
  if (sc >= 80 && dm >= 55) return "The scene rates this highly. Live demand is following.";
  if (sc >= 75 && dm >= 62) return "Scene and live rooms in sync.";
  if (sc >= 75)              return "The scene rates this higher than the algorithm. Note it.";

  // Tour confirms
  if (tr >= 80 && dm >= 65) return "The touring confirms what the demand data implies.";

  // Steady demand
  if (dm >= 70) return "Consistent live demand. Rooms, consistently.";

  // Beatport only
  if (bp >= 65) return "Beatport signals the DJ community is paying attention.";

  return "No single standout signal. No weak spots either.";
}

function leadSignalLabel(a) {
  const cands = [
    { lbl: "Live demand",   v: a.live_demand_score   || 0 },
    { lbl: "Scene cred",    v: a.manual_scene_score  || 0 },
    { lbl: "Momentum",      v: a.momentum_score      || 0 },
    { lbl: "Beatport",      v: a.beatport_score      || 0 },
    { lbl: "DJ support",    v: a.tl_support_score    || 0 },
    { lbl: "Tour density",  v: a.tour_score          || 0 },
  ].sort((a, b) => b.v - a.v);
  return cands[0].lbl;
}

function deltaTag(a) {
  const prev = a.rank_prev || a.prior_rank;
  if (prev == null) return "";
  const d = prev - (a.rank || 0);
  if (d > 0) return `<span class="delta up">▲${d}</span>`;
  if (d < 0) return `<span class="delta dn">▼${Math.abs(d)}</span>`;
  return `<span class="delta fl">—</span>`;
}

function actRegions(a) {
  const out = [];
  for (const r of (Array.isArray(a.ra_top_regions) ? a.ra_top_regions : [])) {
    const name = r && typeof r === "object" ? r.name : r;
    if (name) out.push(String(name).trim());
  }
  for (const r of (Array.isArray(a.ra_country_list) ? a.ra_country_list : [])) {
    if (r) out.push(String(r).trim());
  }
  return out;
}

// ── CSS (variant-aware) ───────────────────────────────────────────────────────
function css() {
  const dark = !isKDP;
  return `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
:root {
  ${dark ? `
  --bg:     #0c0c0e;
  --card:   #111114;
  --text-h: #E9E7DF;
  --text:   #a9a8a2;
  --muted:  #75767d;
  --border: #1e1f23;
  --accent: #C8F750;
  --accent2:#4fd6e8;
  --sub:    #1a1b20;
  ` : `
  --bg:     #f8f7f4;
  --card:   #ffffff;
  --text-h: #1a1a1a;
  --text:   #444444;
  --muted:  #888888;
  --border: #d8d6d0;
  --accent: #1a1a1a;
  --accent2:#555555;
  --sub:    #eeece8;
  `}
}
*, *::before, *::after { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { margin: 0; background: var(--bg); color: var(--text); font-family: 'Space Grotesk','Helvetica Neue',Arial,sans-serif; font-size: 11px; line-height: 1.5; }
.mono { font-family: 'IBM Plex Mono','SF Mono',Menlo,monospace; }
h1,h2,h3 { color: var(--text-h); font-weight: 700; letter-spacing: -.015em; margin: 0; }

/* Page structure */
.page { page-break-after: always; break-after: page; }
.section { padding: 22px 26px 14px; page-break-before: always; break-before: page; }
.section-cont { padding: 14px 26px; }
.eyebrow { font-family:'IBM Plex Mono',monospace; font-size:8.5px; letter-spacing:.22em; text-transform:uppercase; color:var(--accent); margin-bottom:6px; }
.section-head { margin-bottom: 16px; }
.section-head h2 { font-size: 26px; margin-bottom: 6px; }
.section-head p { color:var(--text); max-width:580px; font-size:11px; margin:0; }
.rule { width:40px; height:3px; background:var(--accent); border-radius:2px; margin: 10px 0; }

/* Cover */
.cover {
  height: ${isKDP ? "254mm" : "297mm"};
  display: flex; flex-direction: column;
  justify-content: flex-end; align-items: flex-start;
  padding: 0 0 40px 36px;
  position: relative; overflow: hidden;
}
.cover-bg {
  position:absolute; top:0; left:0; right:0; bottom:0; z-index:0;
  ${dark ? `background: linear-gradient(165deg, #0c0c0e 0%, #111822 60%, #0c0c0e 100%);` : `background: linear-gradient(165deg, #f0ede8 0%, #e8e4de 60%, #f0ede8 100%);`}
}
.cover-grid {
  position:absolute; top:0; left:0; right:0; bottom:0; z-index:1; opacity:${dark?'.04':'.06'};
  background-image: repeating-linear-gradient(0deg, var(--accent) 0, var(--accent) 1px, transparent 1px, transparent 32px),
    repeating-linear-gradient(90deg, var(--accent) 0, var(--accent) 1px, transparent 1px, transparent 32px);
}
.cover-content { position:relative; z-index:2; }
.cover-logo { width:48px; height:48px; margin-bottom:28px; }
.cover-brandword { font-family:'IBM Plex Mono',monospace; font-weight:600; letter-spacing:.32em; font-size:12px; color:var(--accent); margin-bottom:14px; }
.cover-title { font-size:72px; line-height:.95; letter-spacing:-.04em; color:var(--text-h); margin-bottom:18px; font-weight:700; }
.cover-title span { display:block; }
.cover-hl { color:var(--accent); }
.cover-strap { font-size:14px; color:var(--text); max-width:440px; line-height:1.4; margin-bottom:32px; }
.cover-meta { font-family:'IBM Plex Mono',monospace; font-size:9px; letter-spacing:.18em; color:var(--muted); text-transform:uppercase; }
.cover-url { position:absolute; bottom:36px; right:36px; font-family:'IBM Plex Mono',monospace; font-size:10px; color:var(--accent); letter-spacing:.1em; z-index:2; }
.cover-rule { width:52px; height:3px; background:var(--accent); margin-bottom:22px; border-radius:2px; }

/* Contents page */
.toc { list-style:none; margin:0; padding:0; margin-top:18px; }
.toc li { display:flex; justify-content:space-between; align-items:baseline; padding:9px 0; border-bottom:1px solid var(--border); font-size:13px; }
.toc li .toc-title { color:var(--text-h); font-weight:500; }
.toc li .toc-pg { font-family:'IBM Plex Mono',monospace; color:var(--muted); font-size:10px; }
.toc-section { font-family:'IBM Plex Mono',monospace; font-size:8px; letter-spacing:.18em; color:var(--muted); text-transform:uppercase; padding:14px 0 6px; }

/* Editor's note */
.editors-body { font-size:13px; line-height:1.72; color:var(--text); max-width:560px; margin-top:14px; }
.editors-body p { margin:0 0 1em; }
.editors-body em { color:var(--text-h); font-style:normal; font-weight:600; }
.editors-sig { margin-top:28px; font-family:'IBM Plex Mono',monospace; font-size:9px; letter-spacing:.15em; color:var(--muted); text-transform:uppercase; }

/* Method page */
.method-signals { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:16px; }
.method-row { display:flex; align-items:center; gap:10px; background:var(--card); border:1px solid var(--border); border-radius:8px; padding:10px 12px; }
.method-pct { font-family:'IBM Plex Mono',monospace; font-weight:600; color:var(--accent); font-size:14px; min-width:36px; }
.method-label { color:var(--text-h); font-size:11px; font-weight:500; }
.method-bar-wrap { flex:1; height:3px; background:var(--border); border-radius:2px; }
.method-bar { height:3px; background:var(--accent); border-radius:2px; }
.method-note { background:rgba(200,247,80,.05); border:1px solid rgba(200,247,80,.2); border-radius:8px; padding:12px 14px; margin-top:18px; font-size:10px; line-height:1.6; color:var(--text); }
.method-note b { color:var(--text-h); }

/* Full profile cards (top 10) */
.profile-page { padding:28px 30px 24px; display:flex; flex-direction:column; }
.profile-header { display:flex; align-items:flex-start; gap:0; margin-bottom:18px; border-bottom:1px solid var(--border); padding-bottom:18px; }
.profile-rank { font-family:'IBM Plex Mono',monospace; font-size:80px; font-weight:600; line-height:.9; color:var(--accent); letter-spacing:-.03em; margin-right:22px; flex-shrink:0; }
.profile-rank small { font-size:28px; color:var(--muted); display:block; margin-bottom:2px; }
.profile-header-text { flex:1; }
.profile-name { font-size:34px; font-weight:700; color:var(--text-h); letter-spacing:-.02em; line-height:1; margin-bottom:8px; }
.profile-verdict { font-size:13px; color:var(--text); line-height:1.6; max-width:500px; }
.profile-badge { font-family:'IBM Plex Mono',monospace; font-size:8px; letter-spacing:.16em; text-transform:uppercase; color:var(--accent); border:1px solid rgba(200,247,80,.35); border-radius:4px; padding:3px 8px; display:inline-block; margin-top:10px; }
.profile-body { display:grid; grid-template-columns:1fr 1fr; gap:24px; flex:1; }
.profile-signals { }
.profile-signals h4 { font-family:'IBM Plex Mono',monospace; font-size:8px; letter-spacing:.18em; text-transform:uppercase; color:var(--muted); margin:0 0 12px; }
.sig-row { display:flex; align-items:center; gap:10px; margin-bottom:9px; }
.sig-label { font-size:10px; color:var(--text); min-width:100px; }
.sig-bar-wrap { flex:1; height:4px; background:rgba(255,255,255,.07); border-radius:2px; }
.sig-bar { height:4px; border-radius:2px; background:var(--accent); }
.sig-val { font-family:'IBM Plex Mono',monospace; font-size:10px; color:var(--text-h); min-width:24px; text-align:right; }
.profile-right { display:flex; flex-direction:column; gap:16px; }
.profile-stats { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.stat-box { background:var(--sub); border:1px solid var(--border); border-radius:8px; padding:10px 12px; }
.stat-box .st-val { font-family:'IBM Plex Mono',monospace; font-size:16px; font-weight:600; color:var(--accent); line-height:1.2; }
.stat-box .st-lbl { font-size:9px; color:var(--muted); margin-top:3px; }
.profile-section { }
.profile-section h4 { font-family:'IBM Plex Mono',monospace; font-size:8px; letter-spacing:.18em; text-transform:uppercase; color:var(--muted); margin:0 0 8px; }
.profile-tags { display:flex; flex-wrap:wrap; gap:5px; }
.profile-tag { font-size:9.5px; color:var(--text); background:rgba(255,255,255,.04); border:1px solid var(--border); border-radius:4px; padding:3px 7px; }
.profile-venues { list-style:none; margin:0; padding:0; }
.profile-venues li { font-size:10px; color:var(--text); padding:4px 0; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; }
.profile-venues li:last-child { border-bottom:none; }
.profile-venues .v-loc { color:var(--muted); font-size:9px; }
.profile-anecdote { margin-top:18px; padding-top:16px; border-top:1px solid var(--border); font-size:11px; color:var(--text); line-height:1.65; font-style:italic; }
.profile-anecdote em { color:var(--text-h); font-style:normal; font-weight:600; }
.profile-footer { display:flex; gap:20px; margin-top:14px; padding-top:12px; border-top:1px solid var(--border); }
.profile-footer .pf-item { display:flex; flex-direction:column; }
.profile-footer .pf-val { font-family:'IBM Plex Mono',monospace; font-size:11px; color:var(--text-h); }
.profile-footer .pf-lbl { font-size:8.5px; color:var(--muted); margin-top:2px; }

/* Standard entry rows (11-100) */
.entry-table { width:100%; border-collapse:collapse; margin-top:6px; }
.entry-table thead th { font-family:'IBM Plex Mono',monospace; font-size:8px; letter-spacing:.13em; text-transform:uppercase; color:var(--muted); padding:0 8px 7px; border-bottom:1px solid var(--border); font-weight:500; }
.entry-table thead th:first-child { text-align:left; }
.entry-table thead th.l { text-align:left; }
.entry-row { border-bottom:1px solid var(--border); break-inside:avoid; }
.entry-row:nth-child(even) { background:rgba(255,255,255,.008); }
.entry-row td { padding:8px 8px; vertical-align:top; }
.e-rank { font-family:'IBM Plex Mono',monospace; font-size:10px; color:var(--muted); width:36px; white-space:nowrap; }
.e-name { font-size:12px; font-weight:600; color:var(--text-h); min-width:120px; }
.e-verdict { font-size:10px; color:var(--text); line-height:1.45; }
.e-signal { font-family:'IBM Plex Mono',monospace; font-size:8px; color:var(--accent); white-space:nowrap; letter-spacing:.05em; }
.e-delta { text-align:right; width:32px; }
.delta { font-family:'IBM Plex Mono',monospace; font-size:9px; }
.delta.up { color:#4fd6e8; }
.delta.dn { color:#e67e6e; }
.delta.fl { color:var(--muted); }

/* Club rows */
.club-row td { padding:7px 8px; vertical-align:middle; border-bottom:1px solid var(--border); }
.club-row:nth-child(even) { background:rgba(255,255,255,.008); }
.c-rank { font-family:'IBM Plex Mono',monospace; font-size:10px; color:var(--muted); width:36px; }
.c-name { font-size:12px; font-weight:600; color:var(--text-h); }
.c-city { font-size:9.5px; color:var(--muted); }
.c-score { font-family:'IBM Plex Mono',monospace; text-align:right; color:var(--accent); font-size:11px; width:44px; }
.medal { color:var(--accent); font-size:15px; font-family:'IBM Plex Mono',monospace; }

/* Scene cuts */
.cut-grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-top:14px; }
.cut-card { background:var(--card); border:1px solid var(--border); border-radius:10px; padding:16px; break-inside:avoid; }
.cut-card h3 { font-size:15px; margin-bottom:4px; }
.cut-card .cut-sub { font-size:10px; color:var(--text); margin-bottom:12px; }
.cut-list { list-style:none; margin:0; padding:0; }
.cut-list li { display:flex; align-items:baseline; gap:8px; padding:5px 0; border-bottom:1px solid var(--border); font-size:11px; }
.cut-list li:last-child { border-bottom:none; }
.cut-n { font-family:'IBM Plex Mono',monospace; font-size:9px; color:var(--muted); min-width:22px; }
.cut-name { color:var(--text-h); font-weight:500; }
.cut-stat { font-family:'IBM Plex Mono',monospace; font-size:9px; color:var(--accent); margin-left:auto; }

/* Movers / Breakouts */
.movers-grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-top:14px; }
.movers-col h3 { font-size:16px; margin-bottom:12px; }
.movers-col h3 span { color:var(--accent); }
.mover-row { display:flex; align-items:center; gap:10px; padding:7px 0; border-bottom:1px solid var(--border); break-inside:avoid; }
.mover-rank { font-family:'IBM Plex Mono',monospace; font-size:10px; color:var(--muted); min-width:28px; }
.mover-name { font-size:11.5px; font-weight:600; color:var(--text-h); flex:1; }
.mover-val { font-family:'IBM Plex Mono',monospace; font-size:10px; }
.mover-val.up { color:#4fd6e8; }
.mover-val.dn { color:#e67e6e; }

/* Full index */
.index-wrap { display:grid; grid-template-columns:1fr 1fr 1fr; gap:0 20px; margin-top:12px; }
.index-col { break-inside:avoid-column; }
.index-row { display:flex; gap:6px; align-items:baseline; padding:2.5px 0; border-bottom:1px solid rgba(30,31,35,.5); font-size:9px; break-inside:avoid; }
.idx-n { font-family:'IBM Plex Mono',monospace; color:var(--muted); min-width:24px; }
.idx-name { color:var(--text-h); flex:1; }
.idx-score { font-family:'IBM Plex Mono',monospace; color:var(--muted); font-size:8px; }

/* Back matter */
.back-page { display:flex; flex-direction:column; justify-content:space-between; height:${isKDP ? "254mm" : "297mm"}; padding:44px 40px; }
.back-headline { font-size:38px; line-height:1.1; font-weight:700; color:var(--text-h); max-width:520px; }
.back-headline span { color:var(--accent); }
.back-cta { margin-top:28px; font-size:14px; color:var(--text); }
.back-cta strong { color:var(--text-h); }
.back-footer { font-family:'IBM Plex Mono',monospace; font-size:8.5px; letter-spacing:.1em; color:var(--muted); border-top:1px solid var(--border); padding-top:14px; }

/* Running footer (printed on every page via puppeteer header/footer template) */
/* Borders + value sidebar */
.vs-sidebar { background:var(--sub); border:1px solid var(--border); border-radius:10px; padding:14px 16px; margin-top:16px; break-inside:avoid; }
.vs-sidebar h3 { font-size:13px; margin-bottom:8px; }
.vs-row { display:flex; gap:10px; align-items:baseline; padding:5px 0; border-bottom:1px solid var(--border); font-size:11px; }
.vs-row:last-child { border-bottom:none; }
.vs-rank { font-family:'IBM Plex Mono',monospace; font-size:9px; color:var(--muted); min-width:24px; }
.vs-name { color:var(--text-h); font-weight:500; flex:1; }
.vs-gap { font-family:'IBM Plex Mono',monospace; font-size:10px; color:var(--accent); }
</style>
`;}

// ── LOGO SVG ──────────────────────────────────────────────────────────────────
const LOGO = `<svg class="cover-logo" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect width="30" height="30" rx="7" fill="#0c0c0e"/>
  <g fill="#C8F750">
    <rect x="5.5" y="19" width="3.6" height="7.5" rx="1.3"/>
    <rect x="11.2" y="13.5" width="3.6" height="13" rx="1.3"/>
    <rect x="16.9" y="8" width="3.6" height="18.5" rx="1.3"/>
    <rect x="22.6" y="4" width="3.6" height="22.5" rx="1.3"/>
  </g></svg>`;

// ── Section: Cover ────────────────────────────────────────────────────────────
function buildCover(artists, snapStr) {
  return `<div class="cover page">
  <div class="cover-bg"></div>
  <div class="cover-grid"></div>
  <div class="cover-content">
    ${LOGO}
    <div class="cover-brandword">PEAKTIME</div>
    <div class="cover-rule"></div>
    <h1 class="cover-title">
      <span>THE</span>
      <span class="cover-hl">HOUSE</span>
      <span>100</span>
    </h1>
    <p class="cover-strap">100 house and techno DJs. 50 clubs. Ranked by booking demand, not Spotify followers.</p>
    <div class="cover-meta">Summer 2026 · ${artists.length} artists measured · 5 demand signals · 1 ranking</div>
  </div>
  <div class="cover-url">thedjrankings.com</div>
</div>`;
}

// ── Section: Contents ─────────────────────────────────────────────────────────
const CONTENTS = [
  { section: true, label: "The case for this ranking" },
  { title: "The Read",           pg: 3 },
  { title: "The Method",         pg: 4 },
  { section: true, label: "The rankings" },
  { title: "The House 100",      pg: 5, sub: "The full ranking, #1–#100" },
  { title: "The Club Top 50",    pg: 27, sub: "The rooms that define the scene" },
  { section: true, label: "The analysis" },
  { title: "Breakouts",          pg: 35, sub: "Who's accelerating this season" },
  { title: "Scene Cuts",         pg: 38, sub: "By city · by sound · the discoveries" },
  { section: true, label: "The full field" },
  { title: "The Full Index",     pg: 46, sub: "All 342 artists ranked and scored" },
  { title: "Next Edition",       pg: 56 },
];

function buildContents() {
  const rows = CONTENTS.map(item => {
    if (item.section) {
      return `<li class="toc-section">${esc(item.label)}</li>`;
    }
    return `<li>
      <span class="toc-title">${esc(item.title)}${item.sub ? `<span style="color:var(--muted);font-weight:400;font-size:10.5px"> — ${esc(item.sub)}</span>` : ""}</span>
      <span class="toc-pg">${item.pg}</span>
    </li>`;
  }).join("");
  return `<div class="section page">
  <div class="eyebrow">Contents</div>
  <h2 style="font-size:28px">Summer 2026</h2>
  <ul class="toc">${rows}</ul>
</div>`;
}

// ── Section: Editor's Note ────────────────────────────────────────────────────
function buildEditorsNote(artists) {
  const top1    = artists[0];
  const top5    = artists.slice(0, 5);
  const momKing = artists.filter(a => (a.rank||999) > 3)
    .sort((a, b) => (b.momentum_score||0) - (a.momentum_score||0))[0];
  const sceneKing = artists.slice(0, 20)
    .sort((a, b) => (b.manual_scene_score||0) - (a.manual_scene_score||0))[0];
  const total   = artists.length;
  const momCount = artists.filter(a => (a.momentum_score||0) > 0).length;

  return `<div class="section page">
  <div class="eyebrow">The read</div>
  <h2 style="font-size:26px">Where things stand</h2>
  <div class="editors-body">
    <p>The names change every season. Acts that were everywhere a year ago lose bookings to artists most people haven't heard of yet. This ranking exists because that movement is measurable. Not perfectly, but close enough to be useful.</p>
    <p>This edition covers <em>${total} artists</em>, graded on five demand signals and an editorial scene score. <em>${top1.name}</em> leads. Live demand at ${num(top1.live_demand_score)}, scene credibility at ${num(top1.manual_scene_score)}, and momentum at ${num(top1.momentum_score)} put them there. All three aligned at #1 is unusual. <em>${sceneKing.name}</em>, ranked #${sceneKing.rank}, has the highest scene score in the top 20 at ${num(sceneKing.manual_scene_score)}. That is not the same thing as the most in-demand. It rarely is.</p>
    <p><em>${momKing.name}</em> sits at #${momKing.rank} with the highest momentum score outside the top three, at ${num(momKing.momentum_score)}. The bookings are catching up with the data. By autumn, #${momKing.rank} will look too low.</p>
    <p>London leads booking geography with 247 RA-tracked bookings. Ibiza follows at 188, Amsterdam at 179. Berlin reads at 104, which looks low until you consider what gets counted there. Fewer bookings, smaller club capacities, harder rooms to get. The number undersells the weight.</p>
    <p style="margin-bottom:0">The method is on the next page. Check our work. That is the point of publishing it.</p>
  </div>
  <div class="editors-sig">PEAKTIME · Summer 2026 · thedjrankings.com</div>
</div>`;
}

// ── Section: Method ───────────────────────────────────────────────────────────
function buildMethod() {
  const maxW = Math.max(...Object.values(WEIGHTS));
  const rows = Object.entries(WEIGHTS)
    .sort((a, b) => b[1] - a[1])
    .map(([k, w]) => `
      <div class="method-row">
        <div class="method-pct">${Math.round(w * 100)}%</div>
        <div style="flex:1">
          <div class="method-label">${esc(WEIGHT_LABELS[k] || k)}</div>
          <div class="method-bar-wrap"><div class="method-bar" style="width:${Math.round((w/maxW)*100)}%"></div></div>
        </div>
      </div>`).join("");

  return `<div class="section page">
  <div class="eyebrow">The method</div>
  <h2 style="font-size:26px">One rule: demand, not popularity</h2>
  <p style="color:var(--text);margin:8px 0 16px;max-width:560px;font-size:11px;line-height:1.6">
    Spotify followers don't fill rooms. This ranking measures the signals that do: booking density, venue tier, chart credibility among DJs, and the editorial scene weight that makes a booking mean something.
  </p>
  <div class="method-signals">${rows}</div>
  <div class="method-note">
    <b>What we don't measure:</b> streams, social following, press coverage, or label budget. A DJ with 10 million followers who fills 500-capacity rooms is not in this top 100. That is the point.
    <br><br>
    <b>The credibility multiplier:</b> the raw composite score is scaled by an editorial credibility score built on Boiler Room appearances, Berghain bookings, festival closes, Essential Mix credits, and label standing. It demotes a streaming-pop crossover with no scene credibility. It does not give heritage names a second bonus on top of their score. The full method is at <strong>thedjrankings.com/methodology</strong>.
  </div>
</div>`;
}

// ── Artist anecdotes (editorially grounded in real signal data) ───────────────
const ANECDOTES = {
  "ANOTR": `<em>15.4 million</em> monthly Spotify listeners, <em>30,600</em> YouTube subscribers. The ratio is the point. ANOTR built their audience inside clubs and on record store shelves before the algorithm had time to catch up. Their Google Trends index peaks in the Netherlands at 100 — home market dominance — but Italy at 85 and the UK at 77 show the first full European routing cycle is already underway. This is what a DJ-first career looks like when the data finally starts to reflect it.`,

  "Charlotte de Witte": `With <em>974,000</em> YouTube subscribers, she has the largest video audience of the top 10 by a wide margin. She doesn't appear on a single 1001Tracklists chart — selector support score: zero — yet her tour density score hits <em>100</em>, the ceiling. Privilege Ibiza, capacity 10,000, sits in her recent venue history. The rooms are filling without the DJ-chart pipeline that lifts most acts at this level. That path is harder to build and harder to lose.`,

  "Prospa": `<em>14 Beatport charting tracks</em> — more than anyone else in the top 10. "Baby" and "Free Your Mind" have been in DJ sets for <em>19 consecutive weeks</em>. Their Google Trends interest reads: UK at 96, New Zealand at 71, Australia at 54. That Commonwealth pattern is unusual for a house act — it maps a touring footprint built city by city through UK club culture before the festival-circuit phase even began.`,

  "Peggy Gou": `<em>141,232</em> RA followers — the largest audience of the top 10, and it isn't close. Yet her RA average attendance figure is 61 per event, one of the lower conversion rates here. She draws more followers than any act in this ranking, but those followers are spread across more cities and more demographics than a typical house act. Beatport places her in Indie Dance. This index places her at #4 on booking demand. The gap between those two classifications tells you something about where the genre is going.`,

  "Black Coffee": `Debut year: <em>1996</em>. The oldest career in the top 10 by two full decades. His top Spotify city is <em>Johannesburg</em> at 120,000 monthly listeners — the only act in the top 10 whose home country leads their own streaming geography. His Grammy win came in 2022, 26 years into the career. The Hï Ibiza residency followed. At this point the data is just confirming what the rooms already knew.`,

  "Chris Stussy": `His own label, <em>Up The Stuss</em>, sits in the top-four label tier. His Google Trends peak country: <em>Chile</em>, index 100. Ireland comes second at 42, the Netherlands third at 39. A Dutch deep house act trending hardest in South America is a geographic fingerprint with no clean explanation — except that certain sounds move through nightlife circuits that bypass traditional media entirely, and Chile has one of the strongest underground club scenes in the Americas.`,

  "Mau P": `Career debut: <em>2022</em>. The youngest career in the top 10 by four years. Top venues this season include Pacha Ibiza, Ushuaia Ibiza, and Hï Ibiza simultaneously — that triple Ibiza placement in a single season is unusual even for acts a decade older. His 1001Tracklists chart has been running for <em>21 weeks</em> with a best position of #1. The selectors locked in before the mainstream had finished deciding what to make of him.`,

  "Carl Cox": `<em>260,038</em> Mixcloud followers — more than any other act in this entire index of 342. His Beatport chart position improved <em>13 places</em> in a single tracking window, the biggest movement in the top 10. His live conversion rate on RA sits at 18.5%: when someone looks him up, they attend. That number is driven by a career built before social media existed, which means the people following him on platforms are the ones who were already going to shows. The scene score of <em>92</em> is the highest in the top 10. The algorithm agrees with the rooms, for once.`,

  "Chris Lake": `Google Trends interest: <em>USA 100, Canada 58</em>. Every other country is in single figures. He is, by search data, almost entirely a North American phenomenon — yet his bookings span three continents and his Spotify top cities include London, Sydney, Melbourne, and Mexico City. His track "Make You Fight" has been charting on 1001Tracklists for <em>18 consecutive weeks</em>. Black Book Records, his own label, means he controls the release cadence that keeps that chart position warm.`,

  "Josh Baker": `Live conversion rate: <em>41.4%</em>. The highest in the top 10 by a margin that doesn't make sense until you look at the venue data — RA records average attendance of <em>799 people</em> per event, with a top attendance of 7,146. His booking fee sits at £8K–18K. That is the largest demand-to-fee gap in the top 10, and the data has been flagging it since the first tracking window. The people who know, know.`,
};

function buildProfileCard(a, isFirst) {
  const signals = [
    { label: "Scene credibility",  val: a.manual_scene_score || 0 },
    { label: "Live demand",        val: a.live_demand_score  || 0 },
    { label: "Beatport charts",    val: a.beatport_score     || 0 },
    { label: "DJ support (1001T)", val: a.tl_support_score   || 0 },
    { label: "Tour density",       val: a.tour_score         || 0 },
    { label: "Momentum",           val: a.momentum_score     || 0 },
  ];

  const sigBars = signals.map(s => `
    <div class="sig-row">
      <div class="sig-label">${esc(s.label)}</div>
      <div class="sig-bar-wrap"><div class="sig-bar" style="width:${s.val}%"></div></div>
      <div class="sig-val">${num(s.val)}</div>
    </div>`).join("");

  function fmtListeners(n) {
    if (!n) return "—";
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return Math.round(n / 1e3) + "K";
    return String(n);
  }
  function fmtNum(n) {
    if (!n) return "—";
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(n >= 100000 ? 0 : 1) + "K";
    return String(n);
  }

  const stats = [
    { val: fmtListeners(a.spotify_monthly_listeners), lbl: "Spotify listeners / mo" },
    { val: fmtNum(a.youtube_subscribers), lbl: "YouTube subscribers" },
    { val: a.beatport_best_position ? `#${a.beatport_best_position}` : "—", lbl: "Best Beatport position" },
    { val: a.tl_weeks_charted ? `${a.tl_weeks_charted}w` : "—", lbl: "Weeks on 1001T chart" },
  ].map(s => `<div class="stat-box"><div class="st-val">${esc(s.val)}</div><div class="st-lbl">${esc(s.lbl)}</div></div>`).join("");

  const topVenues = (a.ra_top_venues || []).slice(0, 4).map(v => `
    <li><span>${esc(v.name)}</span><span class="v-loc">${esc(v.country)}</span></li>`).join("");

  const tags = (a.scene_tags || []).map(t => `<span class="profile-tag">${esc(t)}</span>`).join("");

  const topCities = (a.spotify_top_cities || []).slice(0, 3)
    .map(c => `<li><span>${esc(c.city)}, ${esc(c.country)}</span><span class="v-loc">${fmtListeners(c.listeners)}</span></li>`).join("");

  const anecdote = ANECDOTES[a.name] || "";

  const fee   = a.booking_fee ? esc(a.booking_fee.label) : "—";
  const debut = a.debut_year  ? String(a.debut_year) : "N/A";
  const label = esc(a.label_best || a.beatport_labels?.[0] || "—");
  const countries = a.ra_countries ? `${a.ra_countries} countries` : "—";

  return `<div class="profile-page page">
    ${isFirst ? `<div class="eyebrow" style="margin-bottom:14px">The House 100 — Top 10 profiles</div>` : ""}
    <div class="profile-header">
      <div class="profile-rank"><small>#</small>${a.rank}</div>
      <div class="profile-header-text">
        <div class="profile-name">${esc(a.name)}</div>
        <div class="profile-verdict">${verdict(a)}</div>
        <div class="profile-badge">${esc(leadSignalLabel(a))} · Score ${(a.score||0).toFixed(1)}</div>
      </div>
    </div>
    <div class="profile-body">
      <div class="profile-signals">
        <h4>Signal breakdown</h4>
        ${sigBars}
        ${tags ? `<div class="profile-section" style="margin-top:16px"><h4>Scene credentials</h4><div class="profile-tags">${tags}</div></div>` : ""}
      </div>
      <div class="profile-right">
        <div class="profile-section">
          <h4>Key numbers</h4>
          <div class="profile-stats">${stats}</div>
        </div>
        ${topVenues ? `<div class="profile-section"><h4>Top venues</h4><ul class="profile-venues">${topVenues}</ul></div>` : ""}
        ${topCities ? `<div class="profile-section"><h4>Top Spotify cities</h4><ul class="profile-venues">${topCities}</ul></div>` : ""}
      </div>
    </div>
    ${anecdote ? `<div class="profile-anecdote">${anecdote}</div>` : ""}
    <div class="profile-footer">
      <div class="pf-item"><div class="pf-val">${fee}</div><div class="pf-lbl">Booking fee</div></div>
      <div class="pf-item"><div class="pf-val">${debut}</div><div class="pf-lbl">Debut year</div></div>
      <div class="pf-item"><div class="pf-val">${label}</div><div class="pf-lbl">Lead label</div></div>
      <div class="pf-item"><div class="pf-val">${countries}</div><div class="pf-lbl">Routing this season</div></div>
    </div>
  </div>`;
}

// ── Section: The House 100 ────────────────────────────────────────────────────
function buildHouse100(artists) {
  const top10  = artists.slice(0, 10);
  const rest   = artists.slice(10, 100);

  // Top 10: one full-page profile per artist
  const heroHtml = top10.map((a, i) => buildProfileCard(a, i === 0)).join("");

  // #11–100: 5 per page
  const chunkSize = 5;
  const chunks = [];
  for (let i = 0; i < rest.length; i += chunkSize) chunks.push(rest.slice(i, i + chunkSize));

  const tableRows = chunks.map((chunk, ci) => `
  <div class="section-cont${ci % 4 === 0 ? " page" : ""}">
    ${ci % 4 === 0 ? `<div class="eyebrow" style="margin-bottom:4px">The House 100 · #${chunk[0].rank}–#${chunk[chunk.length-1].rank}</div>` : ""}
    <table class="entry-table">
      ${ci % 4 === 0 ? `<thead><tr>
        <th>#</th><th class="l">Artist</th><th class="l">Lead signal</th><th class="l">Verdict</th><th>Δ</th>
      </tr></thead>` : ""}
      <tbody>
        ${chunk.map(a => `<tr class="entry-row">
          <td class="e-rank">${a.rank}</td>
          <td class="e-name">${esc(a.name)}</td>
          <td class="e-signal">${leadSignalLabel(a)}</td>
          <td class="e-verdict">${verdict(a)}</td>
          <td class="e-delta">${deltaTag(a)}</td>
        </tr>`).join("")}
      </tbody>
    </table>
  </div>`).join("");

  return heroHtml + tableRows;
}

// ── Section: Club Top 50 ──────────────────────────────────────────────────────
function buildClubs(clubs) {
  if (!clubs.length) return "";
  const perPage = 8;
  const chunks  = [];
  for (let i = 0; i < clubs.length && i < 50; i += perPage) chunks.push(clubs.slice(i, i + perPage));

  function clubWhy(c) {
    if (c.why) return esc(c.why);
    if (c.description) return esc(String(c.description).slice(0, 80));
    const parts = [];
    if (c.opened)   parts.push(`Est. ${c.opened}`);
    if (c.capacity) parts.push(`Cap. ${c.capacity}`);
    if (c.genres)   parts.push(esc(Array.isArray(c.genres) ? c.genres.slice(0,2).join(" · ") : c.genres));
    return parts.join(" · ") || "Defining room.";
  }

  return chunks.map((chunk, ci) => `
  <div class="section${ci > 0 ? "-cont" : ""} page">
    ${ci === 0 ? `<div class="eyebrow">The Club Top 50</div>
    <div class="section-head"><h2 style="font-size:24px">The rooms that count</h2>
    <p>The rooms where a booking is a credential. Where the artists in this ranking want to play.</p></div>` : `<div class="eyebrow">Club Top 50, continued</div>`}
    <table class="entry-table">
      <thead><tr><th>#</th><th class="l">Club</th><th class="l">City</th><th class="l">Why it matters</th><th>Score</th></tr></thead>
      <tbody>
        ${chunk.map(c => `<tr class="club-row">
          <td class="c-rank">${c.rank <= 3 ? `<span class="medal">${["①","②","③"][c.rank-1]}</span>` : `#${c.rank}`}</td>
          <td class="c-name">${esc(c.name)}</td>
          <td class="c-city">${esc([c.city, c.country].filter(Boolean).join(", "))}</td>
          <td class="e-verdict">${clubWhy(c)}</td>
          <td class="c-score">${num(c.score)}</td>
        </tr>`).join("")}
      </tbody>
    </table>
  </div>`).join("");
}

// ── Section: Breakouts (first edition — no rank_prev) ────────────────────────
function buildBreakouts(artists) {
  const breakouts = artists
    .filter(a => (a.rank||999) > 10 && (a.rank||999) <= 100 && (a.momentum_score||0) >= 55)
    .sort((a, b) => (b.momentum_score||0) - (a.momentum_score||0))
    .slice(0, 10);

  const stealth = artists
    .filter(a => (a.rank||999) > 10 && (a.rank||999) <= 100 && (a.momentum_score||0) < 30 && (a.manual_scene_score||0) >= 70)
    .sort((a, b) => (b.manual_scene_score||0) - (a.manual_scene_score||0))
    .slice(0, 8);

  const makeRow = (a, valKey, valLabel) => `
    <div class="mover-row">
      <div class="mover-rank">#${a.rank}</div>
      <div class="mover-name">${esc(a.name)}</div>
      <div class="mover-val up">${valLabel} ${num(a[valKey])}</div>
    </div>`;

  return `<div class="section page">
  <div class="eyebrow">Breakouts</div>
  <h2 style="font-size:26px;margin-bottom:6px">The 10 accelerating right now</h2>
  <p style="color:var(--text);font-size:11px;max-width:560px;margin:0 0 16px;line-height:1.5">
    Future editions will show rank changes between seasons. This first one does not have that data yet. Instead, this page shows the momentum leaders: acts ranked outside the top 10 with the fastest-moving demand signals. Watch them.
  </p>
  <div class="movers-grid">
    <div class="movers-col">
      <h3>Momentum leaders <span>↑</span></h3>
      ${breakouts.map(a => makeRow(a, "momentum_score", "Mom.")).join("")}
    </div>
    <div class="movers-col">
      <h3>Credibility picks</h3>
      <p style="font-size:10px;color:var(--muted);margin:0 0 10px">High scene score, ranked outside the top 10. The rooms tend to know before the data does.</p>
      ${stealth.map(a => makeRow(a, "manual_scene_score", "Scene")).join("")}
    </div>
  </div>
</div>`;
}

// ── Section: Scene Cuts ───────────────────────────────────────────────────────
async function buildSceneCuts(artists, genreMod) {
  const top100 = artists.slice(0, 100);

  // By City — top 4 cities by RA booking density
  const cities = ["London", "Berlin", "Amsterdam", "Ibiza"];
  const cityActs = cities.map(city => ({
    city,
    acts: top100.filter(a => actRegions(a).includes(city)).slice(0, 8),
  }));

  const cityHtml = cityActs.filter(c => c.acts.length >= 3).map(c => `
    <div class="cut-card">
      <h3>${esc(c.city)}</h3>
      <div class="cut-sub">${c.acts.length} in the top 100 regularly booked here</div>
      <ul class="cut-list">
        ${c.acts.slice(0,6).map(a => `<li>
          <span class="cut-n">#${a.rank}</span>
          <span class="cut-name">${esc(a.name)}</span>
          <span class="cut-stat">${leadSignalLabel(a)}</span>
        </li>`).join("")}
      </ul>
    </div>`).join("");

  // By Sound — house vs techno (using genre.js classifier)
  let soundHtml = "";
  if (genreMod) {
    const { genreLean, isPureTechno } = genreMod;
    const houseActs  = top100.filter(a => !isPureTechno(a) && (genreLean(a) === "house" || genreLean(a) === "crossover")).slice(0, 8);
    const technoActs = top100.filter(a => isPureTechno(a) || genreLean(a) === "techno").slice(0, 8);
    if (houseActs.length >= 4 && technoActs.length >= 4) {
      soundHtml = `
        <div class="cut-card">
          <h3>House &amp; crossover</h3>
          <div class="cut-sub">Top ranked house-leaning acts this season</div>
          <ul class="cut-list">
            ${houseActs.slice(0,6).map(a => `<li>
              <span class="cut-n">#${a.rank}</span>
              <span class="cut-name">${esc(a.name)}</span>
            </li>`).join("")}
          </ul>
        </div>
        <div class="cut-card">
          <h3>Techno</h3>
          <div class="cut-sub">Peak-time and raw techno acts in the top 100</div>
          <ul class="cut-list">
            ${technoActs.slice(0,6).map(a => `<li>
              <span class="cut-n">#${a.rank}</span>
              <span class="cut-name">${esc(a.name)}</span>
            </li>`).join("")}
          </ul>
        </div>`;
    }
  }

  // Discovery flex — ranks 20-100, high momentum
  const discoveries = artists
    .filter(a => (a.rank||999) >= 20 && (a.rank||999) <= 100 && (a.momentum_score||0) >= 55)
    .sort((a, b) => (b.momentum_score||0) - (a.momentum_score||0))
    .slice(0, 10);

  const discoveryHtml = `
    <div class="cut-card" style="grid-column:1/-1">
      <h3>10 names to argue about by autumn</h3>
      <div class="cut-sub">Ranked in the 100, momentum leading their tier. These are the ones.</div>
      <ul class="cut-list" style="columns:2;gap:20px">
        ${discoveries.map(a => `<li>
          <span class="cut-n">#${a.rank}</span>
          <span class="cut-name">${esc(a.name)}</span>
          <span class="cut-stat">Mom. ${num(a.momentum_score)}</span>
        </li>`).join("")}
      </ul>
    </div>`;

  // Best Value sidebar (for fans: "punching above their billing")
  const strongBuys = artists.filter(a => a.value_signal === "strong-buy").slice(0, 5);
  const valueHtml = strongBuys.length >= 3 ? `
    <div class="vs-sidebar" style="margin-top:22px">
      <div class="eyebrow">Punching above their billing</div>
      <h3 style="font-size:14px;margin-bottom:4px">Underrated this season</h3>
      <p style="font-size:10px;color:var(--muted);margin:0 0 10px">Acts where demand outpaces their market position. The room knows before the rate card does.</p>
      ${strongBuys.map(a => `<div class="vs-row">
        <span class="vs-rank">#${a.rank}</span>
        <span class="vs-name">${esc(a.name)}</span>
        ${a.value_gap_pct != null ? `<span class="vs-gap">+${a.value_gap_pct}% demand gap</span>` : ""}
      </div>`).join("")}
    </div>` : "";

  return `<div class="section page">
  <div class="eyebrow">Scene cuts</div>
  <h2 style="font-size:26px;margin-bottom:14px">The same data, cut differently</h2>
  <div class="eyebrow" style="margin-bottom:8px">By city</div>
  <div class="cut-grid">${cityHtml}</div>
</div>
<div class="section-cont page">
  <div class="eyebrow">By sound</div>
  <div class="cut-grid" style="margin-top:10px">${soundHtml || `<p style="color:var(--muted);font-size:11px">Genre classification in progress. Full sound breakdown in the next edition.</p>`}</div>
</div>
<div class="section-cont page">
  <div class="eyebrow">Discovery picks</div>
  <div class="cut-grid" style="margin-top:10px">${discoveryHtml}</div>
  ${valueHtml}
</div>`;
}

// ── Section: Full Index ───────────────────────────────────────────────────────
function buildFullIndex(artists) {
  const perPage = 45;
  const chunks  = [];
  for (let i = 0; i < artists.length; i += perPage) chunks.push(artists.slice(i, i + perPage));

  // Split each chunk into 3 columns
  function threeCol(chunk) {
    const colSize = Math.ceil(chunk.length / 3);
    const cols = [chunk.slice(0, colSize), chunk.slice(colSize, colSize * 2), chunk.slice(colSize * 2)];
    return cols.map(col => `<div class="index-col">${col.map(a => `
      <div class="index-row">
        <span class="idx-n">${a.rank}</span>
        <span class="idx-name">${esc(a.name)}</span>
        ${a.composite_score != null ? `<span class="idx-score">${num(a.composite_score, 1)}</span>` : ""}
      </div>`).join("")}</div>`).join("");
  }

  return chunks.map((chunk, ci) => `
  <div class="section${ci > 0 ? "-cont" : ""} page">
    ${ci === 0 ? `<div class="eyebrow">The full index</div>
    <div class="section-head">
      <h2 style="font-size:24px">All ${artists.length} artists, ranked</h2>
      <p>The 100 came from a real field of ${artists.length}. Every act in this index was measured on the same signals. No one was invented or left out for a reason we cannot explain.</p>
    </div>` : `<div class="eyebrow" style="margin-bottom:8px">Full index, continued</div>`}
    <div class="index-wrap">${threeCol(chunk)}</div>
  </div>`).join("");
}

// ── Section: Back matter ──────────────────────────────────────────────────────
function buildBack(snapStr) {
  const urlNote = isKDP
    ? `<strong>thedjrankings.com</strong>`
    : `<strong><a href="https://thedjrankings.com" style="color:var(--accent)">thedjrankings.com</a></strong>`;
  return `<div class="back-page page">
  <div>
    <div class="eyebrow">Summer 2026</div>
    <h1 class="back-headline">This is a snapshot.<br><span>The scene already moved.</span></h1>
    <p class="back-cta">The live index refreshes daily at ${urlNote}. Every rank, every signal, updated. The next edition covers Autumn 2026.<br><br>
      <strong>Bookmark the live site. Buy the next edition. Argue with the ranking.</strong></p>
  </div>
  <div class="back-footer">
    PEAKTIME: The House 100 · Summer 2026 · Snapshot ${snapStr} · thedjrankings.com<br>
    Rankings are generated from public signals and an editorial scene rubric. Full methodology published at thedjrankings.com/methodology.<br>
    © 2026 PEAKTIME. Not affiliated with any artist, agency, or booking platform.
  </div>
</div>`;
}

// ── Kindle: simplified reflowable HTML ───────────────────────────────────────
function buildKindleHTML(artists, clubs, genreMod, snapStr) {
  const top100 = artists.slice(0, 100);
  const kindleCss = `
    body { font-family: serif; max-width: 680px; margin: 0 auto; padding: 20px; color: #1a1a1a; }
    h1, h2, h3 { font-family: sans-serif; }
    .eyebrow { font-family: monospace; font-size: 0.75em; text-transform: uppercase; letter-spacing: 0.15em; color: #666; }
    table { width: 100%; border-collapse: collapse; margin: 1em 0; }
    th { text-align: left; font-family: monospace; font-size: 0.7em; text-transform: uppercase; padding: 4px 6px; border-bottom: 2px solid #ccc; }
    td { padding: 6px 6px; border-bottom: 1px solid #eee; font-size: 0.9em; }
    .rank { font-family: monospace; color: #666; }
    .verdict { font-style: italic; color: #444; }
    hr { border: none; border-top: 2px solid #1a1a1a; margin: 2em 0; }
  `;
  const rows = top100.map(a => `<tr>
    <td class="rank">#${a.rank}</td>
    <td><strong>${esc(a.name)}</strong><br><span class="verdict">${verdict(a)}</span></td>
    <td>${leadSignalLabel(a)}</td>
  </tr>`).join("");

  const indexRows = artists.map(a => `<tr>
    <td class="rank">${a.rank}</td>
    <td>${esc(a.name)}</td>
  </tr>`).join("");

  return `<!doctype html><html><head><meta charset="utf-8">
    <title>PEAKTIME: The House 100 — Summer 2026</title>
    <style>${kindleCss}</style>
  </head><body>
    <h1>PEAKTIME: The House 100</h1>
    <p class="eyebrow">Summer 2026 · thedjrankings.com</p>
    <hr>
    <h2>The Read</h2>
    <p>342 artists measured. 5 demand signals. 1 ranking. The rooms don't lie.</p>
    <hr>
    <h2>The House 100</h2>
    <table><thead><tr><th>#</th><th>Artist</th><th>Lead signal</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <hr>
    ${clubs.length ? `<h2>The Club Top 50</h2>
    <table><thead><tr><th>#</th><th>Club</th><th>City</th></tr></thead>
    <tbody>${clubs.slice(0,50).map(c => `<tr><td class="rank">#${c.rank}</td><td>${esc(c.name)}</td><td>${esc([c.city,c.country].filter(Boolean).join(", "))}</td></tr>`).join("")}</tbody></table><hr>` : ""}
    <h2>The Full Index — all ${artists.length} artists</h2>
    <table><thead><tr><th>#</th><th>Artist</th></tr></thead>
    <tbody>${indexRows}</tbody></table>
    <hr>
    <p><em>PEAKTIME: The House 100 · Summer 2026. Live index at thedjrankings.com.</em></p>
  </body></html>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n● PEAKTIME: The House 100 — ${VARIANT.toUpperCase()} variant`);

  const { artists, lastUpdated } = loadArtists();
  const clubs    = await loadClubs();
  const genreMod = await loadGenre();

  const today   = new Date();
  const snapStr = lastUpdated
    ? new Date(lastUpdated).toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" })
    : today.toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" });

  console.log(`  ${artists.length} artists · ${clubs.length} clubs · genre module: ${genreMod ? "✓" : "×"}`);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });

  // Kindle: write HTML and exit
  if (isKindle) {
    const html = buildKindleHTML(artists, clubs, genreMod, snapStr);
    fs.writeFileSync(OUT, html, "utf8");
    console.log(`✓ Kindle HTML written: ${OUT}`);
    console.log(`  → Convert with: ebook-convert "${OUT}" "${OUT.replace(".html",".epub")}" --title "PEAKTIME: The House 100" --authors "PEAKTIME"`);
    return;
  }

  // Build HTML sections
  const sections = [
    buildCover(artists, snapStr),
    buildContents(),
    buildEditorsNote(artists),
    buildMethod(),
    buildHouse100(artists),
    buildClubs(clubs),
    buildBreakouts(artists),
    await buildSceneCuts(artists, genreMod),
    buildFullIndex(artists),
    buildBack(snapStr),
  ].join("\n");

  const html = `<!doctype html><html><head><meta charset="utf-8">
<style>${css()}</style>
</head><body>${sections}</body></html>`;

  // Render PDF via puppeteer
  const puppeteer = require(path.join(__dirname, "node_modules/puppeteer"));
  const browser   = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0", timeout: 90000 })
    .catch(() => page.setContent(html, { waitUntil: "load" }));
  try { await page.evaluateHandle("document.fonts.ready"); } catch {}

  const format = isKDP ? undefined : "A4";
  const width  = isKDP ? "8.5in" : undefined;
  const height = isKDP ? "11in"  : undefined;

  await page.pdf({
    path: OUT,
    format, width, height,
    printBackground: true,
    margin: isKDP
      ? { top: "0.75in", bottom: "0.9in", left: "0.875in", right: "0.875in" }
      : { top: "0", bottom: "14mm", left: "0", right: "0" },
    displayHeaderFooter: true,
    headerTemplate: "<div></div>",
    footerTemplate: `<div style="width:100%;font-family:'IBM Plex Mono',monospace;font-size:6.5px;color:${isKDP?"#888":"#75767d"};letter-spacing:.1em;padding:0 ${isKDP?"0.875in":"12mm"};display:flex;justify-content:space-between;">
      <span>PEAKTIME · THE HOUSE 100 · SUMMER 2026</span>
      <span>thedjrankings.com · <span class="pageNumber"></span></span>
    </div>`,
  });
  await browser.close();

  const kb = Math.round(fs.statSync(OUT).size / 1024);
  console.log(`✓ PDF written: ${OUT} (${kb} KB)`);
  console.log(`  ${artists.length} artists · ${clubs.length} clubs`);
}

main().catch(e => { console.error("FAILED:", e); process.exit(1); });
