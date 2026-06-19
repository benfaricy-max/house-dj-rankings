// The State of DJ Booking Demand 2026 — flagship report generator.
//
// Renders a STANDALONE, shareable, citeable report at
// frontend/public/reports/state-of-demand-2026/index.html from the live
// rankings.json — same published-report format as rank-2-0 / III Points / CRSSD
// (light theme, PEAKTIME branding, print-ready, its own URL). This is the SEO/PR
// flagship: a data-led read on who is in demand, built to fill the gap left by
// Resident Advisor retiring its DJ poll. Ships Article + ItemList + FAQPage JSON-LD
// (the format answer engines cite) with the Ben Faricy author entity.
//
//   node backend/stateOfDemandReport.js
//
// Read-only: never writes rankings.json, so the NEVER-WIPE-DATA rule doesn't apply
// — this only derives a display artifact. Fee figures are model-implied estimated
// tiers (CLAUDE.md fee honesty), never presented as transacted prices.

const fs   = require("fs");
const path = require("path");

const ORIGIN = "https://thedjrankings.com";
const SLUG   = "state-of-demand-2026";
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const slugify = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const VERDICT = {
  "strong-buy": "underpriced & accelerating",
  buy: "underpriced",
  premium: "priced above demand",
  fair: "priced in line",
};

function buildHtml(rankings, lastUpdated) {
  const named = rankings.filter(r => r.name && Number.isFinite(r.score) && Number.isFinite(r.rank));
  const total = named.length;
  const byRank = (a, b) => a.rank - b.rank;

  const leaders = named.slice().sort(byRank).slice(0, 20);
  const rising = named.filter(r => Number.isFinite(r.momentum_score) && r.momentum_score > 0)
    .sort((a, b) => b.momentum_score - a.momentum_score).slice(0, 10);
  const underpriced = named.filter(r => (r.value_signal === "buy" || r.value_signal === "strong-buy") && Number.isFinite(r.value_gap))
    .sort((a, b) => (b.value_gap - a.value_gap) || ((b.momentum_score || 0) - (a.momentum_score || 0))).slice(0, 12);

  const now = lastUpdated ? new Date(lastUpdated) : new Date();
  const dateHuman = now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const dateISO = now.toISOString().slice(0, 10);

  const leaderRows = leaders.map(r => `<tr>
      <td class="num rk">#${r.rank}</td>
      <td><a href="/artist/${slugify(r.name)}">${esc(r.name)}</a></td>
      <td class="num strong">${Math.round(r.score)}</td>
      <td class="num muted">${Number.isFinite(r.manual_scene_score) ? Math.round(r.manual_scene_score) : "—"}</td>
      <td class="num muted">${Number.isFinite(r.momentum_score) ? Math.round(r.momentum_score) : "—"}</td>
    </tr>`).join("\n");

  const risingRows = rising.map((r, i) => `<tr>
      <td class="num rk">#${i + 1}</td>
      <td><a href="/artist/${slugify(r.name)}">${esc(r.name)}</a></td>
      <td class="num strong">${Math.round(r.momentum_score)}</td>
      <td class="num muted">#${r.rank}</td>
    </tr>`).join("\n");

  const buyRows = underpriced.map(r => `<tr>
      <td><a href="/artist/${slugify(r.name)}">${esc(r.name)}</a></td>
      <td class="num"><span class="dl up">+${r.value_gap}</span></td>
      <td class="muted">${esc(VERDICT[r.value_signal] || "—")}</td>
      <td class="muted">${esc(r.demand_fee_label || "—")}</td>
      <td class="num muted"><a href="/value/${slugify(r.name)}">fee →</a></td>
    </tr>`).join("\n");

  const topName = leaders[0] ? leaders[0].name : "the field";
  const risingName = rising[0] ? rising[0].name : "the field";
  const buyName = underpriced[0] ? underpriced[0].name : "the field";

  // ── AEO schema: Article (author = Ben Faricy) + ItemList (top 20) + FAQPage ──
  const articleLd = {
    "@context": "https://schema.org", "@type": "Article",
    headline: "The State of DJ Booking Demand 2026",
    description: "A data-led read on which house and techno DJs are most in demand in 2026 — the demand leaders, fastest risers, and most underpriced acts to book, from PEAKTIME's daily booking-demand index.",
    datePublished: dateISO, dateModified: dateISO,
    image: `${ORIGIN}/brand/post-top5-1080.png`,
    author: { "@type": "Person", name: "Ben Faricy", url: `${ORIGIN}/about` },
    publisher: { "@type": "Organization", name: "PEAKTIME", url: `${ORIGIN}/`, logo: { "@type": "ImageObject", url: `${ORIGIN}/brand/avatar-1080.png` } },
    mainEntityOfPage: { "@type": "WebPage", "@id": `${ORIGIN}/reports/${SLUG}/` },
  };
  const itemListLd = {
    "@context": "https://schema.org", "@type": "ItemList",
    name: "The most in-demand house & techno DJs, 2026", url: `${ORIGIN}/reports/${SLUG}/`,
    numberOfItems: leaders.length, itemListOrder: "https://schema.org/ItemListOrderDescending",
    itemListElement: leaders.map(r => ({ "@type": "ListItem", position: r.rank,
      url: `${ORIGIN}/artist/${slugify(r.name)}`, item: { "@type": "MusicGroup", name: r.name, url: `${ORIGIN}/artist/${slugify(r.name)}` } })),
  };
  const faq = [
    { q: "Who is the most in-demand DJ in 2026?", a: `As of ${dateHuman}, ${topName} leads PEAKTIME's booking-demand index of ${total} house and techno acts. The index measures booking demand — live booking, scene credibility, Beatport and DJ-support signal, search and social velocity — not follower counts or streams.` },
    { q: "Which DJs are rising fastest in 2026?", a: `${risingName} tops PEAKTIME's momentum ranking — the acts whose demand is accelerating fastest, scored on rate-of-change across search interest, listener growth, Beatport movement and tour velocity.` },
    { q: "Which DJs are underpriced to book right now?", a: `${buyName} leads the value-gap list — acts whose measured demand outpaces their estimated booking-fee tier. These are model-implied estimates, not transacted prices.` },
    { q: "How is booking demand measured?", a: "Each act blends independent demand signals — live booking (Resident Advisor venue tier, attendance and touring), editorial scene credibility, Beatport chart credibility, 1001Tracklists DJ support, search interest and social velocity — into one demand score, refreshed daily and normalised across the whole field." },
  ];
  const faqLd = { "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: faq.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) };
  const jsonld = JSON.stringify([articleLd, itemListLd, faqLd]);

  const desc = "A data-led read on which house and techno DJs are most in demand in 2026 — the demand leaders, the fastest risers, and the most underpriced acts to book, from PEAKTIME's daily booking-demand index.";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>The State of DJ Booking Demand 2026 | The DJ Rankings</title>
<meta name="description" content="${esc(desc)}" />
<link rel="canonical" href="${ORIGIN}/reports/${SLUG}/" />
<meta property="og:title" content="The State of DJ Booking Demand 2026" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:image" content="${ORIGIN}/brand/post-top5-1080.png" />
<meta property="og:url" content="${ORIGIN}/reports/${SLUG}/" />
<meta property="og:type" content="article" />
<meta name="twitter:card" content="summary_large_image" />
<script type="application/ld+json">${jsonld}</script>
<style>
  :root { --ink:#15151c; --muted:#6b6b78; --line:#e7e7ee; --up:#1a8f4c; --dn:#c0492a; --accent:#3b3bdb; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, "Segoe UI", Inter, Arial, sans-serif; color: var(--ink); background: #f3f3f6; padding: 28px; }
  .page { max-width: 820px; margin: 0 auto; background: #fff; border-radius: 14px; box-shadow: 0 6px 30px rgba(0,0,0,.08); overflow: hidden; }
  .top { background: linear-gradient(120deg,#15151c,#23233a); color: #fff; padding: 26px 34px; display: flex; justify-content: space-between; align-items: center; }
  .brand { font-size: 12px; letter-spacing: .18em; color: #a8e00f; font-weight: 700; }
  .doc-title { font-size: 13px; color: #aaa; margin-top: 2px; }
  .top .date { font-size: 12px; color: #9a9aac; text-align: right; }
  .hero { padding: 28px 34px 22px; border-bottom: 1px solid var(--line); }
  .hero .tag { display:inline-block; font-size:11px; letter-spacing:.08em; text-transform:uppercase; font-weight:700; color:var(--accent); background:#edeefe; border-radius:20px; padding:3px 11px; margin-bottom:12px; }
  .hero h1 { font-size: 31px; line-height: 1.1; }
  .hero .sub { color: var(--muted); font-size: 14.5px; margin-top: 12px; max-width: 64ch; line-height: 1.55; }
  .hero .byline { color: var(--muted); font-size: 12.5px; margin-top: 14px; }
  .section { padding: 22px 34px; border-bottom: 1px solid var(--line); }
  .section h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .1em; color: var(--muted); margin-bottom: 8px; }
  .section .lede { font-size: 14px; color: #333; line-height: 1.55; margin-bottom: 16px; max-width: 64ch; }
  table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  th { text-align: left; color: var(--muted); font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; padding: 6px 8px; border-bottom: 1px solid var(--line); }
  td { padding: 7px 8px; border-bottom: 1px solid #f1f1f5; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  td.strong { font-weight: 700; }
  td.muted, .muted { color: var(--muted); }
  td.rk { font-weight: 700; }
  .dl { font-weight: 700; } .dl.up { color: var(--up); }
  a { color: var(--accent); text-decoration: none; } a:hover { text-decoration: underline; }
  .faq dt { font-weight: 700; font-size: 14.5px; margin-top: 14px; }
  .faq dd { color: #333; font-size: 14px; line-height: 1.55; margin-top: 5px; }
  .note { font-size: 12px; color: var(--muted); margin-top: 14px; line-height: 1.5; }
  .foot { padding: 16px 34px; font-size: 11px; color: var(--muted); display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
  .foot b { color: #15151c; }
  @media (max-width: 560px) { body { padding: 12px; } .section, .hero, .top, .foot { padding-left: 18px; padding-right: 18px; } }
  @media print { body { background:#fff; padding:0; } .page { box-shadow:none; border-radius:0; } @page { margin: 12mm; } }
</style>
</head>
<body>
<div class="page">
  <div class="top">
    <div><div class="brand">THE DJ RANKINGS</div><div class="doc-title">PEAKTIME · State of Demand</div></div>
    <div class="date">Updated ${dateHuman}<br/>${total} acts ranked</div>
  </div>

  <div class="hero">
    <span class="tag">The Index · 2026</span>
    <h1>The State of DJ Booking Demand 2026</h1>
    <p class="sub">Resident Advisor retired its DJ poll and DJ Mag's Top 100 is a fan vote — so there is no neutral, data-led read on which house and techno DJs are actually <b>in demand</b>. This is that read: ${total} acts ranked by booking demand, refreshed daily. Not popularity, not reach — demand. Data, not hype.</p>
    <p class="byline">By Ben Faricy, Founder &amp; Editor · <a href="/methodology">methodology</a> · <a href="/about">about</a></p>
  </div>

  <div class="section">
    <h2>The demand leaders</h2>
    <p class="lede">The top of the index — ranked by booking demand, with each act's scene-credibility and momentum reads alongside. ${esc(topName)} leads the field.</p>
    <table>
      <thead><tr><th class="num">Rank</th><th>Artist</th><th class="num">Demand</th><th class="num">Scene</th><th class="num">Momentum</th></tr></thead>
      <tbody>
${leaderRows}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>Fastest-rising</h2>
    <p class="lede">Who's accelerating — ranked by momentum, the rate of change across search interest, listener growth, Beatport movement and tour velocity. These are the acts to book before the fee catches up.</p>
    <table>
      <thead><tr><th class="num">#</th><th>Artist</th><th class="num">Momentum</th><th class="num">Overall</th></tr></thead>
      <tbody>
${risingRows}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>The most underpriced acts to book</h2>
    <p class="lede">Acts whose measured demand outpaces their estimated booking-fee tier — the buy signals. ${esc(buyName)} tops the list.</p>
    <table>
      <thead><tr><th>Artist</th><th class="num">Value gap</th><th>Read</th><th>Est. fee tier</th><th class="num"></th></tr></thead>
      <tbody>
${buyRows}
      </tbody>
    </table>
    <p class="note">Fee tiers are demand-led, model-implied estimates — not transacted prices. The value gap compares an act's demand against that estimate; a positive gap flags an act priced below current booking demand.</p>
  </div>

  <div class="section faq">
    <h2>Frequently asked</h2>
    <dl>
${faq.map(f => `      <dt>${esc(f.q)}</dt>\n      <dd>${esc(f.a)}</dd>`).join("\n")}
    </dl>
  </div>

  <div class="section">
    <h2>How this is built</h2>
    <p class="lede">Every act is scored on the same blend of independent demand signals — live booking (Resident Advisor venue tier, attendance and touring), editorial scene credibility, Beatport chart credibility, 1001Tracklists DJ support, search interest and social velocity — refreshed daily and normalised across the whole field. PEAKTIME is independent and not a booking agency.</p>
    <p class="note"><a href="/methodology">Read the full methodology →</a> · <a href="/">see the live index →</a> · <a href="/about/editorial-policy">editorial policy →</a></p>
  </div>

  <div class="foot">
    <span><b>The DJ Rankings</b> · thedjrankings.com — the demand index for electronic music</span>
    <span>State of Demand 2026 · ${esc(dateHuman)}</span>
  </div>
</div>
</body>
</html>
`;
}

function generate(rankingsPath, outPath) {
  const raw = JSON.parse(fs.readFileSync(rankingsPath, "utf8"));
  const rankings = Array.isArray(raw) ? raw : raw.rankings;
  const lastUpdated = Array.isArray(raw) ? null : raw.lastUpdated;
  if (!Array.isArray(rankings) || !rankings.some(r => Number.isFinite(r.rank))) {
    console.warn("[stateOfDemand] no ranked data found, skipping.");
    return false;
  }
  const html = buildHtml(rankings, lastUpdated);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, html);
  console.log(`[stateOfDemand] wrote ${outPath} (${rankings.filter(r => Number.isFinite(r.rank)).length} acts)`);
  return true;
}

if (require.main === module) {
  const root = path.resolve(__dirname, "..");
  generate(
    path.join(root, "frontend/public/rankings.json"),
    path.join(root, `frontend/public/reports/${SLUG}/index.html`)
  );
}

module.exports = { generate, buildHtml };
