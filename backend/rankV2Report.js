// Rank 2.0 — published report generator.
//
// Renders the parallel alternate-weighting ranking (score_v2 / rank_v2, baked into
// rankings.json by generateStatic via WEIGHTS_V2 in score.js) as a STANDALONE,
// shareable HTML report at frontend/public/reports/rank-2-0/index.html — same
// published-report format as the III Points / CRSSD / launch briefs (light theme,
// PEAKTIME branding, print-ready, its own URL). Re-run every build so the
// leaderboard stays current. Read-only: never writes rankings.json, so the
// NEVER-WIPE-DATA rule doesn't apply — this only derives a display artifact.
//
//   node backend/rankV2Report.js
//
// Called from generateStatic.js after the v2 scoring pass so it refreshes in CI.

const fs   = require("fs");
const path = require("path");

// Display weight table — face-value intent weights (the 12 requested) vs the live
// index, with festival shown as dropped. The actual scoring vector (WEIGHTS_V2) is
// these scaled by 0.93 + growth .07; the report explains the rescale in a footnote.
const WEIGHT_ROWS = [
  ["Scene score",          20, 20],
  ["DJ support (1001TL)",  15, 11],
  ["Google Trends",        10, 8],
  ["Monthly listeners",    8,  5],
  ["TikTok",               8,  1],
  ["Wikipedia views",      8,  1],
  ["Release / catalog",    7,  2],
  ["Live booking",         6,  17],
  ["Beatport chart",       6,  13],
  ["YouTube subscribers",  5,  2],
  ["International appeal",  4,  3],
  ["Label trajectory",     3,  5],
];

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function deltaPill(d) {
  if (d > 0) return `<span class="dl up">▲ ${d}</span>`;
  if (d < 0) return `<span class="dl dn">▼ ${Math.abs(d)}</span>`;
  return `<span class="dl flat">—</span>`;
}

function buildHtml(rankings) {
  const v2 = rankings
    .filter(r => Number.isFinite(r.rank_v2))
    .slice()
    .sort((a, b) => a.rank_v2 - b.rank_v2);

  const movers = v2.map(r => ({ name: r.name, prod: r.rank, v2: r.rank_v2, d: r.rank - r.rank_v2 }));
  const risers  = movers.slice().sort((a, b) => b.d - a.d).slice(0, 6);
  const fallers = movers.slice().sort((a, b) => a.d - b.d).slice(0, 6);

  const now = new Date();
  const dateHuman = now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const weightRows = WEIGHT_ROWS.map(([label, v2w, prodw]) => {
    const d = v2w - prodw;
    const dCol = d > 0 ? "up" : d < 0 ? "dn" : "flat";
    return `<tr>
      <td class="wl">${esc(label)}</td>
      <td class="num strong">${v2w}%</td>
      <td class="num muted">${prodw}%</td>
      <td class="num"><span class="dl ${dCol}">${d > 0 ? "+" : ""}${d}</span></td>
    </tr>`;
  }).join("\n");

  const moverCol = arr => arr.map(m => `<div class="mv">
      <span class="mv-n">${esc(m.name)}</span>
      <span class="mv-r">#${m.prod} → #${m.v2} ${deltaPill(m.d)}</span>
    </div>`).join("\n");

  const leaderRows = v2.slice(0, 50).map(r => `<tr>
      <td class="num rk">#${r.rank_v2}</td>
      <td>${esc(r.name)}</td>
      <td class="num">${r.score_v2}</td>
      <td class="num muted">#${r.rank}</td>
      <td class="num">${deltaPill(r.rank - r.rank_v2)}</td>
    </tr>`).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Rank 2.0 — An Alternate Weighting | The DJ Rankings</title>
<meta name="description" content="The same signals, reweighted toward scene credibility, DJ support, search and reach instead of booking demand. The weight diff, the new leaderboard, and who moves most between the two rankings." />
<meta property="og:title" content="Rank 2.0 — An Alternate Weighting" />
<meta property="og:description" content="The same signals, reweighted toward scene credibility, DJ support, search and reach instead of booking demand." />
<meta property="og:image" content="https://thedjrankings.com/brand/post-methodology-1080.png" />
<meta property="og:type" content="article" />
<style>
  :root { --ink:#15151c; --muted:#6b6b78; --line:#e7e7ee; --lime:#5b8f00; --limebg:#eef7d6; --up:#1a8f4c; --dn:#c0492a; --accent:#3b3bdb; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, "Segoe UI", Inter, Arial, sans-serif; color: var(--ink); background: #f3f3f6; padding: 28px; }
  .page { max-width: 820px; margin: 0 auto; background: #fff; border-radius: 14px; box-shadow: 0 6px 30px rgba(0,0,0,.08); overflow: hidden; }
  .top { background: linear-gradient(120deg,#15151c,#23233a); color: #fff; padding: 26px 34px; display: flex; justify-content: space-between; align-items: center; }
  .brand { font-size: 12px; letter-spacing: .18em; color: #a8e00f; font-weight: 700; }
  .doc-title { font-size: 13px; color: #aaa; margin-top: 2px; }
  .top .date { font-size: 12px; color: #9a9aac; text-align: right; }
  .hero { padding: 28px 34px 22px; border-bottom: 1px solid var(--line); }
  .hero .tag { display:inline-block; font-size:11px; letter-spacing:.08em; text-transform:uppercase; font-weight:700; color:var(--accent); background:#edeefe; border-radius:20px; padding:3px 11px; margin-bottom:12px; }
  .hero h1 { font-size: 30px; line-height: 1.1; }
  .hero .sub { color: var(--muted); font-size: 14.5px; margin-top: 10px; max-width: 62ch; line-height: 1.5; }
  .section { padding: 22px 34px; border-bottom: 1px solid var(--line); }
  .section h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .1em; color: var(--muted); margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  th { text-align: left; color: var(--muted); font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; padding: 6px 8px; border-bottom: 1px solid var(--line); }
  td { padding: 7px 8px; border-bottom: 1px solid #f1f1f5; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  td.strong { font-weight: 700; }
  td.muted, .muted { color: var(--muted); }
  td.wl { font-weight: 600; }
  td.rk { font-weight: 700; }
  .dl { font-weight: 700; }
  .dl.up { color: var(--up); }
  .dl.dn { color: var(--dn); }
  .dl.flat { color: var(--muted); font-weight: 500; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
  .mv-h { font-size: 12px; font-weight: 700; margin-bottom: 10px; }
  .mv-h.up { color: var(--up); }
  .mv-h.dn { color: var(--dn); }
  .mv { display: flex; justify-content: space-between; align-items: baseline; padding: 6px 0; border-bottom: 1px solid #f1f1f5; font-size: 13.5px; }
  .mv-n { font-weight: 600; }
  .mv-r { color: var(--muted); font-variant-numeric: tabular-nums; }
  .note { font-size: 12px; color: var(--muted); margin-top: 12px; line-height: 1.5; }
  .foot { padding: 16px 34px; font-size: 11px; color: var(--muted); display: flex; justify-content: space-between; }
  .foot b { color: #15151c; }
  @media (max-width: 560px) { .grid2 { grid-template-columns: 1fr; gap: 18px; } body { padding: 12px; } .section, .hero, .top { padding-left: 18px; padding-right: 18px; } }
  @media print { body { background:#fff; padding:0; } .page { box-shadow:none; border-radius:0; } @page { margin: 12mm; } }
</style>
</head>
<body>
<div class="page">
  <div class="top">
    <div><div class="brand">THE DJ RANKINGS</div><div class="doc-title">Methodology Report · Experimental</div></div>
    <div class="date">Updated ${dateHuman}<br/>${esc(String(v2.length))} acts ranked</div>
  </div>

  <div class="hero">
    <span class="tag">Rank 2.0</span>
    <h1>An alternate weighting</h1>
    <p class="sub">The same signals, reweighted. Where the live index leads on <b>booking demand</b>, Rank 2.0 leans toward <b>scene credibility, DJ support, search and reach</b> — a discovery-first cut of the same data. This is a comparison brief; the live ranking on the site is unchanged.</p>
  </div>

  <div class="section">
    <h2>How the weights change</h2>
    <table>
      <thead><tr><th class="wl">Signal</th><th class="num">Rank 2.0</th><th class="num">Live index</th><th class="num">Δ</th></tr></thead>
      <tbody>
${weightRows}
      </tbody>
    </table>
    <p class="note">The 12 weights above are scaled to 93% so growth (7%) keeps its live weight; the vector sums to 100%. Festival presence — weighted 5% on the live index — is dropped from Rank 2.0 for a simpler methodology. Self-healing, the credibility floor and the coverage penalty are applied identically to both rankings.</p>
  </div>

  <div class="section">
    <h2>Biggest divergences</h2>
    <div class="grid2">
      <div>
        <div class="mv-h up">Ranks higher in 2.0</div>
${moverCol(risers)}
      </div>
      <div>
        <div class="mv-h dn">Ranks lower in 2.0</div>
${moverCol(fallers)}
      </div>
    </div>
  </div>

  <div class="section">
    <h2>The Rank 2.0 leaderboard</h2>
    <table>
      <thead><tr><th class="num">2.0</th><th>Artist</th><th class="num">Score</th><th class="num">Live</th><th class="num">Move</th></tr></thead>
      <tbody>
${leaderRows}
      </tbody>
    </table>
    <p class="note">Top 50 shown, ranked over the full database (house + techno) — the same pool as the live index before its house-anchored display filter.</p>
  </div>

  <div class="foot">
    <span><b>The DJ Rankings</b> · thedjrankings.com</span>
    <span>Rank 2.0 · experimental alternate weighting · refreshed daily</span>
  </div>
</div>
</body>
</html>
`;
}

function generate(rankingsPath, outPath) {
  const raw = JSON.parse(fs.readFileSync(rankingsPath, "utf8"));
  const rankings = Array.isArray(raw) ? raw : raw.rankings;
  if (!Array.isArray(rankings) || !rankings.some(r => Number.isFinite(r.rank_v2))) {
    console.warn("[rankV2Report] no rank_v2 data found — skipping (run after the v2 scoring pass).");
    return false;
  }
  const html = buildHtml(rankings);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, html);
  console.log(`[rankV2Report] wrote ${outPath} (${rankings.filter(r => Number.isFinite(r.rank_v2)).length} acts)`);
  return true;
}

// CLI / direct-call entry
if (require.main === module) {
  const root = path.resolve(__dirname, "..");
  generate(
    path.join(root, "frontend/public/rankings.json"),
    path.join(root, "frontend/public/reports/rank-2-0/index.html")
  );
}

module.exports = { generate, buildHtml };
