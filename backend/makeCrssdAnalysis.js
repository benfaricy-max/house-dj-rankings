/**
 * Generates the CRSSD Fall 2026 lineup-intelligence report (HTML) + Instagram
 * social cards, using live PEAKTIME signals where the roster covers an act and
 * editorial festival-fee estimates for the full bill.
 *   node makeCrssdAnalysis.js
 */
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const OUT_DIR = path.join(__dirname, "..", "frontend", "public", "reports", "crssd-fall-2026");
fs.mkdirSync(path.join(OUT_DIR, "img"), { recursive: true });
const A = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "frontend", "public", "rankings.json"), "utf8")).rankings;
const norm = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const BY = {}; A.forEach(a => BY[norm(a.name)] = a);
const sig = name => BY[norm(name)] || null;
const usd = n => "$" + n.toLocaleString();

// Festival booking-fee estimates (USD) — editorial. tier: stage band on the poster.
const ACTS = [
  { name: "Chris Lake b2b Disclosure", fee: 250000, tier: 1, members: ["Chris Lake", "Disclosure"] },
  { name: "Mochakk", fee: 85000, tier: 1 },
  { name: "Big Wild", fee: 45000, tier: 1, live: true },
  { name: "Sébastien Tellier", fee: 28000, tier: 1, live: true },
  { name: "DRAMA", fee: 22000, tier: 1, live: true },
  { name: "AYYBO", fee: 20000, tier: 1 },
  { name: "Balu Brigada", fee: 12000, tier: 1, live: true },
  { name: "Notion", fee: 11000, tier: 1 },
  { name: "Mind Enterprises", fee: 9000, tier: 1, live: true },
  { name: "ROYA", fee: 7000, tier: 1, live: true },
  { name: "beginagain", fee: 7000, tier: 1, live: true },
  { name: "ear", fee: 6000, tier: 1, live: true },
  { name: "oskar med k", fee: 6000, tier: 1 },
  { name: "Skepta presents Más Tiempo", fee: 95000, tier: 2, members: ["Skepta"] },
  { name: "Sonny Fodera", fee: 85000, tier: 2 },
  { name: "ROSSI. b2b Carlita", fee: 55000, tier: 2, members: ["Rossi.", "Carlita"] },
  { name: "KETTAMA", fee: 48000, tier: 2 },
  { name: "Layton Giordani", fee: 45000, tier: 2 },
  { name: "Prospa", fee: 42000, tier: 2 },
  { name: "Torren Foot", fee: 26000, tier: 2 },
  { name: "Jay de Lys", fee: 20000, tier: 2 },
  { name: "Horsegiirl", fee: 18000, tier: 2 },
  { name: "Jamback", fee: 16000, tier: 2 },
  { name: "Chasewest", fee: 14000, tier: 2 },
  { name: "Rafael", fee: 14000, tier: 2 },
  { name: "Locklead", fee: 12000, tier: 2 },
  { name: "Sam Alfred", fee: 12000, tier: 2 },
  { name: "Greg 99", fee: 11000, tier: 2 },
  { name: "Marco Strous", fee: 11000, tier: 2 },
  { name: "Genesi", fee: 9000, tier: 2 },
  { name: "Dean Turnley", fee: 9000, tier: 2 },
  { name: "I Hate Models", fee: 75000, tier: 3 },
  { name: "Groove Armada", fee: 60000, tier: 3 },
  { name: "999999999", fee: 55000, tier: 3 },
  { name: "Ben UFO", fee: 50000, tier: 3 },
  { name: "Mathame", fee: 45000, tier: 3 },
  { name: "Helena Hauff", fee: 45000, tier: 3 },
  { name: "KAS:ST", fee: 45000, tier: 3 },
  { name: "Marlon Hoffstadt", fee: 35000, tier: 3 },
  { name: "VTSS", fee: 33000, tier: 3 },
  { name: "salute", fee: 30000, tier: 3 },
  { name: "Arodes", fee: 18000, tier: 3 },
  { name: "MPH", fee: 14000, tier: 3 },
  { name: "Son of Son", fee: 9000, tier: 3 },
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
  const best = ds.sort((x, y) => (x.rank || 999) - (y.rank || 999))[0];
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

// ---------- shared style ----------
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
  .legend{display:flex;gap:18px;font-family:var(--mono);font-size:12px;color:var(--muted);margin:6px 0 0}
  .dot{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:6px;vertical-align:middle}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}
  .box{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:20px}
  .box.win{border-color:rgba(200,247,80,.4)} .box.warn{border-color:rgba(255,138,92,.4)}
  .tag{font-family:var(--mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;padding:3px 8px;border-radius:6px;display:inline-block;margin-bottom:8px}
  .tag.win{background:rgba(200,247,80,.14);color:var(--accent)} .tag.warn{background:rgba(255,138,92,.14);color:var(--orange)} .tag.sat{background:rgba(223,122,92,.16);color:#df7a5c}
  .box ul{list-style:none;margin-top:8px} .box li{font-size:14px;color:#c9c8c2;padding-left:18px;position:relative;margin-bottom:8px}
  .box li::before{content:"›";position:absolute;left:0;color:var(--accent)} .box li b{color:#fff}
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

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CRSSD Fall 2026 — Lineup Intelligence | PEAKTIME</title>
<meta name="description" content="A data-driven booking analysis of the CRSSD Fall 2026 lineup — estimated budget, value buys, overpays and market saturation, by PEAKTIME / thedjrankings.com.">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>${STYLE}</style></head><body>
<div class="wrap">
  <div class="brand">${MARK}<b>PEAKTIME</b><a href="https://thedjrankings.com">thedjrankings.com ↗</a></div>
  <div class="hero">
    <div class="eyebrow">Lineup Intelligence · San Diego · Sept 26–27 2026</div>
    <h1>CRSSD Fall 2026:<br>what the lineup is really worth</h1>
    <p class="lead">We ran the CRSSD Fall 2026 bill through PEAKTIME's demand model — estimating the talent budget, then scoring each act on momentum, value, live conversion and market freshness. Here's where the money went, who's underpriced, and who'll actually move tickets.</p>
  </div>

  <div class="kpis">
    <div class="kpi"><div class="n">~${usd(TOTAL)}</div><div class="l">Est. talent budget (2 days)</div></div>
    <div class="kpi"><div class="n">${ACTS.length}</div><div class="l">Billed acts / slots</div></div>
    <div class="kpi"><div class="n">${pct(sorted[0].fee).toFixed(0)}%</div><div class="l">On the headline b2b alone</div></div>
    <div class="kpi"><div class="n sm">${tracked.length} / ${ACTS.length}</div><div class="l">Acts tracked by PEAKTIME</div></div>
  </div>

  <h2>Where the budget went</h2>
  <p>Estimated booking fee per act as a share of the ~${usd(TOTAL)} total. House/pop main stage in lime, melodic/tech-house in blue, techno in orange.</p>
  <div class="legend">
    <span><span class="dot" style="background:#C8F750"></span>Main / house · ${usd(tierTotals[0])}</span>
    <span><span class="dot" style="background:#7fd4ff"></span>Tech house · ${usd(tierTotals[1])}</span>
    <span><span class="dot" style="background:#ff8a5c"></span>Techno · ${usd(tierTotals[2])}</span>
  </div>
  <div class="bars">${barsHTML}</div>

  <h2>Key wins &amp; watch-outs</h2>
  <div class="grid">
    <div class="box win"><span class="tag win">Smartest buy</span><h3>Prospa — booked low, demand high</h3>
      <p>#4 on the index, momentum <b>56</b>, Beatport <b>95</b>, RA <b>88</b> — flagged a <b>Strong Buy</b> (demand implies a £70–150K tier vs an estimated ~$42K here). The fee almost certainly jumps before the next CRSSD.</p></div>
    <div class="box win"><span class="tag win">Value mid-card</span><h3>KETTAMA &amp; Carlita punch up</h3>
      <p>KETTAMA carries a <b>66</b> live-conversion score — his RA crowd dwarfs his streaming, so he overdelivers on a festival stage relative to a ~$48K fee. Carlita flags underpriced too. Classic margin bookings.</p></div>
    <div class="box warn"><span class="tag warn">Paying for the name</span><h3>The headline b2b is a marquee, not a deal</h3>
      <p>Chris Lake b2b Disclosure eats <b>${pct(250000).toFixed(0)}%</b> of the budget, and both read <b>Priced ahead</b> — fees hotter than current momentum (Disclosure 20, Chris Lake 5, both flat). It sells the festival; it isn't a value play.</p></div>
    <div class="box warn"><span class="tag warn">Breakout to watch</span><h3>Rossi. is accelerating fast</h3>
      <p>Momentum <b>75</b> — among the steepest on the whole bill — at an estimated b2b-shared fee. Booked early enough that the b2b-with-Carlita slot looks like a steal in hindsight if the climb continues.</p></div>
  </div>

  <h2>Market saturation — this is a San Diego date</h2>
  <div class="box" style="margin-top:6px"><span class="tag sat">West-coast fatigue risk</span>
    <ul>
      <li><b>Chris Lake</b> is heavily worked on the US West Coast — Las Vegas (2 shows/3mo) and SF/Oakland — so the "event" scarcity is low for a SoCal crowd.</li>
      <li><b>KETTAMA</b> is maxed in SF/Oakland (5 shows/3mo, saturation 100) and has already hit San Diego this quarter — some local-fatigue risk despite the value.</li>
      <li><b>Mathame</b> recently played both San Diego and LA — regionally present.</li>
      <li>Upside: <b>Disclosure, Prospa, Carlita, I Hate Models, Ben UFO, Helena Hauff</b> carry their saturation in <i>other</i> markets — comparatively fresh for Southern California.</li>
    </ul>
  </div>

  <h2>Streaming ≠ tickets</h2>
  <p>The number a streaming chart hides — RA live-attendance relative to streaming reach. The contrast on this bill is stark:</p>
  <div class="grid">
    <div class="box win"><span class="tag win">Converts above its weight</span>
      <ul>${ACTS.map(a => ({ a, d: actData(a) })).filter(x => x.d.covered && x.d.conv >= 70)
        .sort((x, y) => y.d.conv - x.d.conv).slice(0, 5)
        .map(({ a, d }) => `<li><b>${a.name}</b> — conversion ${d.conv}/100${sig(a.members ? a.members[0] : a.name)?.spotify_monthly_listeners ? ` on just ${(sig(a.members ? a.members[0] : a.name).spotify_monthly_listeners / 1e6).toFixed(1)}M listeners` : ""}</li>`).join("")}</ul>
      <p style="font-size:13px;margin-top:6px">Niche draw &gt; streaming size — the value end of the bill.</p></div>
    <div class="box warn"><span class="tag warn">Big streams, soft live demand</span>
      <ul>${ACTS.map(a => ({ a, d: actData(a), ml: sig(a.members ? a.members[0] : a.name)?.spotify_monthly_listeners || 0 }))
        .filter(x => x.d.covered && x.ml >= 3e6 && x.d.conv >= 0 && x.d.conv < 20)
        .sort((x, y) => y.ml - x.ml).slice(0, 5)
        .map(({ a, d, ml }) => `<li><b>${a.name}</b> — ${(ml / 1e6).toFixed(1)}M listeners but conversion ${d.conv}/100</li>`).join("")}</ul>
      <p style="font-size:13px;margin-top:6px">Great for the on-sale headline, riskier as a room-filling booking.</p></div>
  </div>

  <h2>Who actually drives ticket sales</h2>
  <p>Three different jobs on this bill: the <b>marquee</b> (Chris Lake b2b Disclosure, Skepta, Mochakk, Sonny Fodera) sells the on-sale; the <b>scene-credibility</b> techno block (I Hate Models, Ben UFO, Helena Hauff, 999999999, VTSS — all high RA booking demand) sells the festival's underground bona fides and converts the hardcore; and the <b>value mid-card</b> (Prospa, KETTAMA, Carlita, Jamback) over-delivers relative to spend. The hidden engine is live-conversion: acts like KETTAMA and Helena Hauff turn modest streaming into outsized room demand — exactly what a discerning buyer wants.</p>

  <h2>The tracked acts, by the numbers</h2>
  <table><thead><tr><th>Artist</th><th>Rank</th><th>Est. fee</th><th>Mom.</th><th>Value</th><th>Conv.</th><th>BP</th><th>RA</th></tr></thead>
  <tbody>${tableHTML}</tbody></table>

  <div class="note">
    <b>Method &amp; caveats.</b> Booking fees are PEAKTIME editorial estimates for a US festival booking (USD), not confirmed contracts — actual fees vary with routing, exclusivity and timing. b2b and "presents" slots are costed as a single line. Rank, momentum, value, live-conversion, Beatport and RA figures are live from thedjrankings.com for the ${tracked.length} acts the roster currently tracks; blanks are acts/data we don't yet cover. Demand signals from public sources (Spotify, Beatport, Resident Advisor, Google Trends, Wikipedia). Not affiliated with CRSSD or FNGRS CRSSD.
    <br><br>PEAKTIME · the demand index for electronic music · <b style="color:var(--accent)">thedjrankings.com</b>
  </div>
</div>
</body></html>`;

fs.writeFileSync(path.join(OUT_DIR, "index.html"), PAGE);
console.log("Wrote report: /reports/crssd-fall-2026/index.html");
console.log(`Total budget $${TOTAL.toLocaleString()} · ${ACTS.length} acts · ${tracked.length} tracked`);

// ---------- social cards (1080x1080) ----------
const card = (body) => `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>${STYLE}
  html,body{width:1080px;height:1080px}
  .stage{width:1080px;height:1080px;background:var(--bg);padding:70px;position:relative;overflow:hidden}
  .stage .brand{position:absolute;top:46px;left:70px;padding:0}
  .stage h1{font-size:62px;margin:0 0 8px}
  .ftr{position:absolute;bottom:54px;left:70px;right:70px;display:flex;justify-content:space-between;font-family:var(--mono);font-size:20px;color:var(--muted)}
  .big{font-family:var(--mono);font-weight:600;color:var(--accent);line-height:1}
</style></head><body><div class="stage">${body}<div class="ftr"><span>CRSSD Fall 2026 · est.</span><span style="color:var(--accent)">● thedjrankings.com</span></div></div></body></html>`;

const c1 = card(`<div class="brand">${MARK}<b style="font-family:'IBM Plex Mono';letter-spacing:.2em">PEAKTIME</b></div>
  <div style="margin-top:150px"><div class="eyebrow" style="font-size:22px">CRSSD Fall 2026 · by the numbers</div>
  <h1>We priced the<br>whole lineup.</h1></div>
  <div style="display:flex;gap:70px;margin-top:60px">
    <div><div class="big" style="font-size:96px">~$1.56M</div><div style="color:var(--muted);font-family:var(--mono);font-size:24px;margin-top:10px">est. talent budget</div></div>
  </div>
  <div style="display:flex;gap:70px;margin-top:54px">
    <div><div class="big" style="font-size:60px">16%</div><div style="color:var(--muted);font-family:var(--mono);font-size:20px;margin-top:8px">on the headline b2b</div></div>
    <div><div class="big" style="font-size:60px">44</div><div style="color:var(--muted);font-family:var(--mono);font-size:20px;margin-top:8px">acts / slots</div></div>
    <div><div class="big" style="font-size:60px">27%</div><div style="color:var(--muted);font-family:var(--mono);font-size:20px;margin-top:8px">on the top 3</div></div>
  </div>`);

const c2 = card(`<div class="brand">${MARK}<b style="font-family:'IBM Plex Mono';letter-spacing:.2em">PEAKTIME</b></div>
  <div style="margin-top:150px"><div class="eyebrow" style="font-size:22px">CRSSD Fall 2026 · the value read</div>
  <h1>The smart buy vs.<br>the marquee.</h1></div>
  <div class="box win" style="margin-top:56px;padding:34px"><div class="tag win" style="font-size:16px">★ Strong buy</div>
    <div style="font-size:40px;color:#fff;margin:10px 0 6px">Prospa</div>
    <div style="font-size:24px;color:#c9c8c2">#4 index · momentum 56 · Beatport 95 · RA 88 — booked well below where demand says the fee should sit.</div></div>
  <div class="box warn" style="margin-top:24px;padding:34px"><div class="tag warn" style="font-size:16px">Priced ahead</div>
    <div style="font-size:40px;color:#fff;margin:10px 0 6px">Chris Lake b2b Disclosure</div>
    <div style="font-size:24px;color:#c9c8c2">~16% of the entire budget. Sells the festival — but momentum's flat and the model says you're paying for the name.</div></div>`);

const c3 = card(`<div class="brand">${MARK}<b style="font-family:'IBM Plex Mono';letter-spacing:.2em">PEAKTIME</b></div>
  <div style="margin-top:140px"><div class="eyebrow" style="font-size:22px">CRSSD Fall 2026 · saturation watch</div>
  <h1>Has San Diego<br>already seen them?</h1></div>
  <div style="margin-top:50px">
    <div class="box warn" style="padding:30px;margin-bottom:20px"><div style="font-size:34px;color:#fff">KETTAMA</div><div style="font-size:23px;color:#c9c8c2;margin-top:6px">5 shows in SF/Oakland this quarter (saturation 100) + already hit San Diego. Great value, real fatigue risk.</div></div>
    <div class="box warn" style="padding:30px;margin-bottom:20px"><div style="font-size:34px;color:#fff">Chris Lake</div><div style="font-size:23px;color:#c9c8c2;margin-top:6px">Heavily worked on the West Coast — Vegas + SF/Oakland. Low scarcity for a SoCal crowd.</div></div>
    <div class="box win" style="padding:30px"><div style="font-size:30px;color:#fff">Fresh for SoCal</div><div style="font-size:23px;color:#c9c8c2;margin-top:6px">Prospa · Carlita · I Hate Models · Ben UFO · Helena Hauff — saturated elsewhere, not here.</div></div>
  </div>`);

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 1 });
  for (const [name, html] of [["card-numbers.png", c1], ["card-value.png", c2], ["card-saturation.png", c3]]) {
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: path.join(OUT_DIR, "img", name) });
    console.log("Wrote img/" + name);
  }
  await browser.close();
})();
