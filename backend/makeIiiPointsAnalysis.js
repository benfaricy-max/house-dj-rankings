/**
 * Generates the III Points 2026 lineup-intelligence report (HTML + PDF + feature
 * card), using live PEAKTIME signals where the roster covers an act and editorial
 * festival-fee estimates for the full bill. Mirrors makeCrssdAnalysis.js.
 *   node makeIiiPointsAnalysis.js
 *
 * III Points (Miami, Oct 16–17 2026) is a multi-genre curator festival, so the
 * bill is banded by LANE rather than dance sub-genre:
 *   1 = Electronic / dance   (lime)  — the part PEAKTIME tracks
 *   2 = Live / indie / alt    (blue)
 *   3 = Hip-hop / rap         (orange)
 */
const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "..", "frontend", "public", "reports", "iii-points-2026");
fs.mkdirSync(path.join(OUT_DIR, "img"), { recursive: true });
const A = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "frontend", "public", "rankings.json"), "utf8")).rankings;
const norm = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const BY = {}; A.forEach(a => BY[norm(a.name)] = a);
const sig = name => BY[norm(name)] || null;
const usd = n => "$" + n.toLocaleString();

// Festival booking-fee estimates (USD) — editorial. tier: lane on the poster.
const ACTS = [
  // ── Electronic / dance (lane 1) ──────────────────────────────────────
  { name: "Marco Carola b2b Franky Rizardo", fee: 95000, tier: 1, members: ["Marco Carola", "Franky Rizardo"] },
  { name: "Four Tet", fee: 90000, tier: 1, live: true },
  { name: "Charlotte de Witte", fee: 85000, tier: 1 },
  { name: "Adam Port", fee: 70000, tier: 1 },
  { name: "Vintage Culture b2b Max Styler", fee: 70000, tier: 1, members: ["Vintage Culture", "Max Styler"] },
  { name: "Cloonee", fee: 60000, tier: 1 },
  { name: "Flying Lotus", fee: 55000, tier: 1, live: true },
  { name: "Honey Dijon", fee: 50000, tier: 1 },
  { name: "Floating Points", fee: 50000, tier: 1, live: true },
  { name: "Daphni", fee: 45000, tier: 1 },
  { name: "PAWSA", fee: 45000, tier: 1 },
  { name: "Disco Lines", fee: 45000, tier: 1 },
  { name: "KETTAMA", fee: 40000, tier: 1 },
  { name: "DJ Harvey", fee: 38000, tier: 1 },
  { name: "Seth Troxler", fee: 35000, tier: 1 },
  { name: "Hamdi", fee: 35000, tier: 1 },
  { name: "Odd Mob", fee: 35000, tier: 1 },
  { name: "Beltran b2b Ben Sterling", fee: 35000, tier: 1, members: ["Beltran", "Ben Sterling"] },
  { name: "Ki/Ki", fee: 35000, tier: 1 },
  { name: "999999999", fee: 35000, tier: 1, live: true },
  { name: "Interplanetary Criminal", fee: 30000, tier: 1 },
  { name: "HAAi", fee: 30000, tier: 1 },
  { name: "Tiga", fee: 30000, tier: 1 },
  { name: "VTSS", fee: 28000, tier: 1 },
  { name: "Shanti Celeste b2b Peach", fee: 24000, tier: 1, members: ["Shanti Celeste", "Peach"] },
  { name: "Nick León b2b Safety Trance", fee: 22000, tier: 1, members: ["Nick León", "Safety Trance"] },
  { name: "Max Dean b2b Luke Dean", fee: 22000, tier: 1, members: ["Max Dean", "Luke Dean"] },
  { name: "Roman Flügel", fee: 20000, tier: 1 },
  { name: "Danny Daze", fee: 18000, tier: 1 },
  { name: "Jacques Greene", fee: 18000, tier: 1 },
  { name: "Ahmed Spins b2b Rafael", fee: 16000, tier: 1, members: ["Ahmed Spins", "Rafael"] },
  { name: "Levity b2b Taiki Nulight", fee: 16000, tier: 1, members: ["Levity", "Taiki Nulight"] },
  { name: "Discip", fee: 14000, tier: 1 },
  { name: "Moscoman", fee: 14000, tier: 1 },
  { name: "Rebolledo", fee: 12000, tier: 1 },
  { name: "Sam Alfred", fee: 11000, tier: 1 },
  { name: "Dean Turnley", fee: 10000, tier: 1 },
  { name: "Roddy Lima", fee: 10000, tier: 1 },
  { name: "Brunello", fee: 9000, tier: 1 },
  { name: "Chasewest", fee: 9000, tier: 1 },
  { name: "Marco Strous", fee: 9000, tier: 1 },
  // ── Live / indie / alt (lane 2) ──────────────────────────────────────
  { name: "Underworld", fee: 120000, tier: 2, live: true },
  { name: "Blood Orange", fee: 70000, tier: 2, live: true },
  { name: "Men I Trust", fee: 70000, tier: 2, live: true },
  { name: "Parcels", fee: 60000, tier: 2, live: true },
  { name: "Purity Ring", fee: 45000, tier: 2, live: true },
  { name: "Tricky", fee: 35000, tier: 2, live: true },
  { name: "Connan Mockasin", fee: 30000, tier: 2, live: true },
  { name: "Sunn O)))", fee: 30000, tier: 2, live: true },
  { name: "Machine Girl", fee: 25000, tier: 2, live: true },
  { name: "Jane Remover", fee: 18000, tier: 2, live: true },
  { name: "ML Buch", fee: 14000, tier: 2, live: true },
  { name: "Chanel Beads", fee: 14000, tier: 2, live: true },
  { name: "YHWH Nailgun", fee: 12000, tier: 2, live: true },
  { name: "Mind Enterprises", fee: 9000, tier: 2, live: true },
  // ── Hip-hop / rap (lane 3) ───────────────────────────────────────────
  { name: "Lil' Kim", fee: 75000, tier: 3 },
  { name: "Danny Brown", fee: 50000, tier: 3 },
  { name: "Bone Thugs-N-Harmony", fee: 50000, tier: 3 },
  { name: "GZA performing Liquid Swords", fee: 45000, tier: 3 },
  { name: "Tokischa", fee: 45000, tier: 3 },
  { name: "Kelela", fee: 35000, tier: 3 },
  { name: "Rusowsky", fee: 18000, tier: 3 },
];
const TOTAL = ACTS.reduce((s, a) => s + a.fee, 0);
const pct = f => (f / TOTAL) * 100;
const TIER_COLOR = { 1: "#C8F750", 2: "#7fd4ff", 3: "#ff8a5c" };
const sorted = [...ACTS].sort((a, b) => b.fee - a.fee);

// Pull best available "verdict" data for an act (covers b2b via members).
function actData(act) {
  const names = act.members || [act.name];
  const ds = names.map(sig).filter(Boolean);
  if (!ds.length) return { covered: false };
  return {
    covered: true,
    rank: Math.min(...ds.map(d => d.rank || 999)),
    momentum: Math.max(...ds.map(d => d.momentum_score ?? -1)),
    value: ds.map(d => d.value_signal).find(v => v && v !== "fair") || null,
    conv: Math.max(...ds.map(d => d.live_conversion_score ?? -1)),
    beatport: Math.max(...ds.map(d => d.beatport_score || 0)),
    ra: Math.max(...ds.map(d => d.ra_score || 0)),
    label: ds.map(d => d.label_best).find(Boolean) || null,
  };
}
const ml = name => sig(name)?.spotify_monthly_listeners || 0;
const firstName = a => (a.members ? a.members[0] : a.name);

// ---------- shared style (identical system to the CRSSD report) ----------
const STYLE = `
  :root{--bg:#0c0c0e;--card:#111114;--ink:#E9E7DF;--muted:#75767d;--accent:#C8F750;--blue:#7fd4ff;--orange:#ff8a5c;--line:#1e1f23;--mono:'IBM Plex Mono',monospace}
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--bg);color:var(--ink);font-family:'Space Grotesk',system-ui,sans-serif;line-height:1.6}
  .wrap{max-width:920px;margin:0 auto;padding:0 22px}
  .brand{display:flex;align-items:center;gap:10px;padding:22px 0}
  .brand svg{width:22px;height:22px}.brand b{font-family:var(--mono);letter-spacing:.2em;font-size:13px}
  .brand a{color:var(--muted);text-decoration:none;font-family:var(--mono);font-size:12px;margin-left:auto}
  .hero{padding:26px 0 30px;border-bottom:1px solid var(--line)}
  .eyebrow{font-family:var(--mono);font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--accent);margin-bottom:14px}
  h1{font-size:46px;line-height:1.05;letter-spacing:-1.5px;margin-bottom:14px}
  h2{font-size:26px;letter-spacing:-.5px;margin:38px 0 14px}
  h3{font-size:16px;color:#fff;margin-bottom:4px}
  p{color:#c9c8c2;margin-bottom:12px}.lead{font-size:19px;color:#d6d7df}
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:26px 0}
  .kpi{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px}
  .kpi .n{font-family:var(--mono);font-size:30px;font-weight:600;color:var(--accent)}
  .kpi .n.sm{font-size:22px}
  .kpi .l{font-size:12px;color:var(--muted);margin-top:6px}
  .bars{margin:8px 0 4px}
  .bar-row{display:grid;grid-template-columns:230px 1fr 92px;gap:12px;align-items:center;padding:5px 0}
  .bar-name{font-size:14px;color:#e9e7df;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .bar-name .cov{color:var(--accent);font-size:10px;font-family:var(--mono);margin-left:6px}
  .bar-track{height:18px;background:#15161c;border-radius:5px;overflow:hidden}
  .bar-fill{height:100%;border-radius:5px}
  .bar-val{font-family:var(--mono);font-size:13px;color:var(--muted);text-align:right}
  .legend{display:flex;gap:18px;font-family:var(--mono);font-size:12px;color:var(--muted);margin:6px 0 0;flex-wrap:wrap}
  .dot{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:6px;vertical-align:middle}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}
  .box{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:20px}
  .box.win{border-color:rgba(200,247,80,.4)} .box.warn{border-color:rgba(255,138,92,.4)}
  .tag{font-family:var(--mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;padding:3px 8px;border-radius:6px;display:inline-block;margin-bottom:8px}
  .tag.win{background:rgba(200,247,80,.14);color:var(--accent)} .tag.warn{background:rgba(255,138,92,.14);color:var(--orange)} .tag.sat{background:rgba(223,122,92,.16);color:#df7a5c}
  .box ul{list-style:none;margin-top:8px} .box li{font-size:14px;color:#c9c8c2;padding-left:18px;position:relative;margin-bottom:8px}
  .box li::before{content:"\\203A";position:absolute;left:0;color:var(--accent)} .box li b{color:#fff}
  .note{font-size:12.5px;color:var(--muted);border-top:1px solid var(--line);margin-top:34px;padding:18px 0 50px}
  table{width:100%;border-collapse:collapse;font-size:13.5px;margin-top:10px}
  th{font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);text-align:left;padding:8px 10px;border-bottom:1px solid var(--line)}
  td{padding:9px 10px;border-bottom:1px solid #161619}.tnum{font-family:var(--mono);color:#e9e7df}
  .pill{font-family:var(--mono);font-size:11px;padding:2px 7px;border-radius:5px}
  .p-buy{background:rgba(200,247,80,.15);color:var(--accent)} .p-prem{background:rgba(255,138,92,.15);color:var(--orange)} .p-mo{color:var(--accent)}
  @media(max-width:720px){.kpis{grid-template-columns:1fr 1fr}.grid{grid-template-columns:1fr}.bar-row{grid-template-columns:130px 1fr 70px}h1{font-size:32px}}
`;
const MARK = `<svg viewBox="0 0 32 32"><g fill="#C8F750"><rect x="5.5" y="18.5" width="3.6" height="8" rx="1.3"/><rect x="11.2" y="13" width="3.6" height="13.5" rx="1.3"/><rect x="16.9" y="8" width="3.6" height="18.5" rx="1.3"/><rect x="22.6" y="4" width="3.6" height="22.5" rx="1.3"/></g></svg>`;

// ---------- budget bars ----------
const maxFee = sorted[0].fee;
const barsHTML = sorted.map(a => {
  const d = actData(a);
  return `<div class="bar-row">
    <div class="bar-name">${a.name}${d.covered ? '<span class="cov">●TRACKED</span>' : ''}</div>
    <div class="bar-track"><div class="bar-fill" style="width:${(a.fee / maxFee) * 100}%;background:${TIER_COLOR[a.tier]}"></div></div>
    <div class="bar-val">${usd(a.fee)} · ${pct(a.fee).toFixed(1)}%</div>
  </div>`;
}).join("");

// ---------- covered signals table ----------
const tracked = ACTS.map(a => ({ a, d: actData(a) })).filter(x => x.d.covered).sort((x, y) => x.d.rank - y.d.rank);
const tableHTML = tracked.map(({ a, d }) => `<tr>
  <td>${a.name}</td>
  <td class="tnum">#${d.rank}</td>
  <td class="tnum">${usd(a.fee)}</td>
  <td>${d.momentum >= 0 ? `<span class="p-mo tnum">${d.momentum}</span>` : '<span class="tnum" style="color:#555">—</span>'}</td>
  <td>${d.value === "strong-buy" ? '<span class="pill p-buy">★ Strong buy</span>' : d.value === "buy" ? '<span class="pill p-buy">Underpriced</span>' : d.value === "premium" ? '<span class="pill p-prem">Priced ahead</span>' : '<span style="color:#555">—</span>'}</td>
  <td class="tnum">${d.conv >= 0 ? d.conv : "—"}</td>
  <td class="tnum">${d.beatport || "—"}</td>
  <td class="tnum">${d.ra || "—"}</td>
</tr>`).join("");

const tierTotals = [1, 2, 3].map(t => ACTS.filter(a => a.tier === t).reduce((s, a) => s + a.fee, 0));
const outsideDance = pct(tierTotals[1] + tierTotals[2]).toFixed(0);

// conversion standouts / soft-live (live from the data)
const convStars = ACTS.map(a => ({ a, d: actData(a) })).filter(x => x.d.covered && x.d.conv >= 70)
  .sort((x, y) => y.d.conv - x.d.conv).slice(0, 6);
const softLive = ACTS.map(a => ({ a, d: actData(a), m: ml(firstName(a)) }))
  .filter(x => x.d.covered && x.m >= 3e6 && x.d.conv >= 0 && x.d.conv < 20)
  .sort((x, y) => y.m - x.m).slice(0, 5);

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>III Points 2026 — Lineup Intelligence | PEAKTIME</title>
<meta name="description" content="A data-driven booking analysis of the III Points 2026 lineup — estimated budget, value buys, overpays and Miami market saturation, by PEAKTIME / thedjrankings.com.">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>${STYLE}</style></head><body>
<div class="wrap">
  <div class="brand">${MARK}<b>PEAKTIME</b><a href="https://thedjrankings.com">thedjrankings.com ↗</a></div>
  <div class="hero">
    <div class="eyebrow">Lineup Intelligence · Miami · Oct 16–17 2026</div>
    <h1>III Points 2026:<br>what the lineup is really worth</h1>
    <p class="lead">We ran the III Points 2026 bill through PEAKTIME's demand model — estimating the talent budget, then scoring each act on momentum, value, live conversion and Miami-market freshness. III Points isn't a pure dance festival, so the money splits three ways. Here's where it went, who's underpriced, and who'll actually move tickets.</p>
  </div>

  <div class="kpis">
    <div class="kpi"><div class="n">~${usd(TOTAL)}</div><div class="l">Est. talent budget (curated top ${ACTS.length})</div></div>
    <div class="kpi"><div class="n">${ACTS.length}</div><div class="l">Acts costed (full bill is larger)</div></div>
    <div class="kpi"><div class="n">${outsideDance}%</div><div class="l">Spent outside the dance lane</div></div>
    <div class="kpi"><div class="n sm">${tracked.length} / ${ACTS.length}</div><div class="l">Acts tracked by PEAKTIME</div></div>
  </div>

  <h2>Where the budget went</h2>
  <p>Estimated booking fee per act as a share of the ~${usd(TOTAL)} costed total. III Points buys across three lanes: electronic / dance in lime, live / indie / alt in blue, hip-hop / rap in orange. PEAKTIME tracks the dance lane — the rest is curation.</p>
  <div class="legend">
    <span><span class="dot" style="background:#C8F750"></span>Electronic / dance · ${usd(tierTotals[0])}</span>
    <span><span class="dot" style="background:#7fd4ff"></span>Live / indie / alt · ${usd(tierTotals[1])}</span>
    <span><span class="dot" style="background:#ff8a5c"></span>Hip-hop / rap · ${usd(tierTotals[2])}</span>
  </div>
  <div class="bars">${barsHTML}</div>

  <h2>Key wins &amp; watch-outs</h2>
  <div class="grid">
    <div class="box win"><span class="tag win">Smartest buy</span><h3>KETTAMA — converts, and fresh for Miami</h3>
      <p>Flagged a <b>Strong Buy</b> at ~$40K: live-conversion <b>71</b>, RA <b>76</b> — his room demand dwarfs his streaming. And the saturation math favours this date: he's maxed out in SF/Oakland (5 shows/3mo, saturation 100) but carries <b>no recent Miami play</b>. Value <i>and</i> scarcity in the same booking.</p></div>
    <div class="box win"><span class="tag win">Value mid-card</span><h3>PAWSA &amp; the Carola b2b punch up</h3>
      <p>PAWSA: #${actData(ACTS.find(a=>a.name==='PAWSA')).rank} on the index, momentum <b>72</b>, RA <b>85</b> (top-five on the whole bill) — a <b>Strong Buy</b> at ~$45K. Inside the headline tech-house b2b, <b>Franky Rizardo</b> also reads underpriced (momentum 41, strong-buy), so the Marco Carola slot carries real demand value even with Carola himself outside our roster.</p></div>
    <div class="box warn"><span class="tag warn">Paying for the name</span><h3>The marquee is curation, not a deal</h3>
      <p>The biggest lines — <b>Underworld</b> (${pct(120000).toFixed(0)}% of the costed budget), <b>Lil' Kim</b>, <b>Blood Orange</b>, <b>Men I Trust</b> — sit outside the dance-demand model entirely. They sell III Points' eclectic identity, not booking value. Inside the dance lane, <b>Four Tet</b> reads <b>Priced ahead</b> (premium; momentum cooled to 16).</p></div>
    <div class="box warn"><span class="tag warn">Breakout to watch</span><h3>Discip is the steepest climb on the bill</h3>
      <p>Momentum <b>83</b> — the highest of any tracked act here — booked deep in the undercard at an estimated ~$14K. <b>Dean Turnley</b> (momentum 71) and <b>Roddy Lima</b> (60) are climbing fast too. Early-booked accelerators that look like steals in hindsight if the curve holds.</p></div>
  </div>

  <h2>Market saturation — this is a Miami date</h2>
  <div class="box" style="margin-top:6px"><span class="tag sat">Club-Space fatigue risk</span>
    <ul>
      <li><b>Chasewest</b> carries Miami saturation <b>76</b> (3 shows/3mo) — a Club Space regular, maximally familiar to the local room.</li>
      <li><b>PAWSA</b> (sat 54, 2 Miami shows), <b>Beltran</b> (sat 52, played Miami 2 days out) and Miami-native <b>Danny Daze</b> (sat 52) make the Club Space tech-house lane the most locally-worked part of the bill — great value, lower novelty for this crowd.</li>
      <li><b>Charlotte de Witte</b> played Miami ~8 days before the on-sale read (sat 52) — recent regional presence.</li>
      <li>Upside: <b>KETTAMA, Four Tet, HAAi, Floating Points</b> and the Euro-underground block carry their saturation in <i>other</i> markets — comparatively fresh for South Florida.</li>
    </ul>
  </div>

  <h2>Streaming ≠ tickets</h2>
  <p>The number a streaming chart hides — RA live-conversion relative to streaming reach. On a curator bill like this, the contrast is the whole point:</p>
  <div class="grid">
    <div class="box win"><span class="tag win">Converts above its weight</span>
      <ul>${convStars.map(({ a, d }) => `<li><b>${a.name}</b> — conversion ${d.conv}/100${ml(firstName(a)) ? ` on just ${(ml(firstName(a)) / 1e6).toFixed(1)}M listeners` : ""}</li>`).join("")}</ul>
      <p style="font-size:13px;margin-top:6px">Niche draw &gt; streaming size — the value end of the bill. Seth Troxler turns 0.1M listeners into a 98/100 room read.</p></div>
    <div class="box warn"><span class="tag warn">Big streams, soft live demand</span>
      <ul>${softLive.map(({ a, d, m }) => `<li><b>${a.name}</b> — ${(m / 1e6).toFixed(1)}M listeners but conversion ${d.conv}/100</li>`).join("")}</ul>
      <p style="font-size:13px;margin-top:6px">Plus <b>Disco Lines</b> — ${(ml("Disco Lines") / 1e6).toFixed(1)}M listeners, the bill's biggest streamer, but no RA booking footprint yet. Great for the on-sale headline, riskier as a room-filling underground booking.</p></div>
  </div>

  <h2>Who actually drives ticket sales</h2>
  <p>Three jobs on this bill, and they barely overlap. The <b>marquee / curation</b> (Underworld, Lil' Kim, Four Tet, Blood Orange, Charlotte de Witte) sells the on-sale and the festival's eclectic identity. The <b>Club Space tech-house engine</b> (Marco Carola b2b Franky Rizardo, PAWSA, Cloonee, Beltran, KETTAMA) converts Miami's dance core — the city's home-court genre. And the <b>underground-credibility block</b> (Seth Troxler, Floating Points, HAAi, Roman Flügel, 999999999, VTSS — all high live-conversion) sells the curatorial bona fides and over-delivers in the room. The hidden engine, as always, is live-conversion: Seth Troxler's 98/100 on 0.1M listeners is the exact inverse of Adam Port's 14M-listener / conversion-2 profile — and a discerning buyer wants the former.</p>

  <h2>The tracked acts, by the numbers</h2>
  <table><thead><tr><th>Artist</th><th>Rank</th><th>Est. fee</th><th>Mom.</th><th>Value</th><th>Conv.</th><th>BP</th><th>RA</th></tr></thead>
  <tbody>${tableHTML}</tbody></table>

  <div class="note">
    <b>Method &amp; caveats.</b> Booking fees are PEAKTIME editorial estimates for a US festival booking (USD), not confirmed contracts — actual fees vary with routing, exclusivity and timing. We costed a curated top ${ACTS.length} of the bill; the full III Points lineup (including the Club Space b2b undercard) is larger. b2b and "presents" slots are costed as a single line. Rank, momentum, value, live-conversion, Beatport, RA and Miami-saturation figures are live from thedjrankings.com for the ${tracked.length} acts the roster currently tracks — PEAKTIME covers house/techno/electronic, so the hip-hop and indie lanes show as untracked by design. Demand signals from public sources (Spotify, Beatport, Resident Advisor, Google Trends, Wikipedia). Not affiliated with III Points or its promoters.
    <br><br>PEAKTIME · the demand index for electronic music · <b style="color:var(--accent)">thedjrankings.com</b>
  </div>
</div>
</body></html>`;

fs.writeFileSync(path.join(OUT_DIR, "index.html"), PAGE);
console.log("Wrote report: /reports/iii-points-2026/index.html");
console.log(`Total budget $${TOTAL.toLocaleString()} · ${ACTS.length} acts · ${tracked.length} tracked · ${outsideDance}% outside dance lane`);
console.log(`Lane totals — dance $${tierTotals[0].toLocaleString()} / live $${tierTotals[1].toLocaleString()} / hiphop $${tierTotals[2].toLocaleString()}`);

// ---------- PDF + feature card via puppeteer (optional, best-effort) ----------
(async () => {
  let puppeteer;
  try { puppeteer = require("puppeteer"); } catch { console.log("puppeteer not available — skipped PDF/card"); return; }
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setContent(PAGE, { waitUntil: "networkidle0" });
  await page.pdf({ path: path.join(OUT_DIR, "iii-points-2026-analysis.pdf"), printBackground: true, width: "920px", height: "1600px" });
  // 4:5 feature card — screenshot the hero+kpis region
  await page.setViewport({ width: 920, height: 1150, deviceScaleFactor: 2 });
  await page.screenshot({ path: path.join(OUT_DIR, "img", "card-table-4x5.png"), clip: { x: 0, y: 0, width: 920, height: 1150 } });
  await browser.close();
  // mirror the PDF into the press folder for parity with the CRSSD deliverable
  try {
    const press = "/Users/benjaminfaricy/Desktop/PEAKTIME-press/5-III-Points-2026-Lineup-Analysis.pdf";
    fs.copyFileSync(path.join(OUT_DIR, "iii-points-2026-analysis.pdf"), press);
    console.log("Wrote PDF: " + press);
  } catch (e) { console.log("press copy skipped: " + e.message); }
  console.log("Wrote PDF + feature card.");
})();
