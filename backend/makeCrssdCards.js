/**
 * CRSSD Fall 2026 — Instagram cards, warm San Diego sunset / festival-poster look
 * (CSS-drawn waterfront scene). Six cards:
 *   1) Budget by % of spend (4:5 table)   4) Market saturation (square)
 *   2) Key wins (square)                  5) Driving ticket sales (square)
 *   3) Watch-outs (square)                6) Top-10 tracked acts (4:5 table)
 * Live data from rankings.json.   node makeCrssdCards.js
 */
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const OUT = path.join(__dirname, "..", "frontend", "public", "reports", "crssd-fall-2026", "img");
fs.mkdirSync(OUT, { recursive: true });
const A = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "frontend", "public", "rankings.json"), "utf8")).rankings;
const norm = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const BY = {}; A.forEach(a => BY[norm(a.name)] = a);
const sig = n => BY[norm(n)] || null;
const ml = n => (sig(n)?.spotify_monthly_listeners) || 0;

// festival booking-fee estimates (USD)
const FEES = {
  "Chris Lake b2b Disclosure": 250000, "Skepta presents Más Tiempo": 95000, "Mochakk": 85000, "Sonny Fodera": 85000,
  "I Hate Models": 75000, "Groove Armada": 60000, "999999999": 55000, "ROSSI. b2b Carlita": 55000, "Ben UFO": 50000,
  "KETTAMA": 48000, "Layton Giordani": 45000, "Mathame": 45000, "Helena Hauff": 45000, "KAS:ST": 45000, "Big Wild": 45000,
  "Prospa": 42000, "Marlon Hoffstadt": 35000, "VTSS": 33000, "salute": 30000, "Sébastien Tellier": 28000, "Torren Foot": 26000,
  "DRAMA": 22000, "AYYBO": 20000, "Jay de Lys": 20000, "Arodes": 18000, "Horsegiirl": 18000, "Jamback": 16000,
  "Chasewest": 14000, "Rafael": 14000, "MPH": 14000, "Balu Brigada": 12000, "Locklead": 12000, "Sam Alfred": 12000,
  "Notion": 11000, "Greg 99": 11000, "Marco Strous": 11000, "Mind Enterprises": 9000, "Genesi": 9000, "Dean Turnley": 9000, "Son of Son": 9000,
  "ROYA": 7000, "beginagain": 7000, "ear": 6000, "oskar med k": 6000,
};
const TOTAL = Object.values(FEES).reduce((s, x) => s + x, 0);
const usd = n => "$" + (n >= 1000 ? Math.round(n / 1000) + "K" : n);
const pctOf = f => (f / TOTAL) * 100;

// ---------- scene + poster styling ----------
const HEAD = `<meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Space+Grotesk:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  :root{--ink:#2a1410;--plum:#43133f;--coral:#FF6B3D;--magenta:#E0457B;--gold:#FFD27A;--green:#1f7a3d}
  .stage{position:relative;overflow:hidden;font-family:'Space Grotesk',system-ui,sans-serif;color:var(--ink);
    background:linear-gradient(176deg,#FFE9B8 0%,#FFC07A 24%,#FF8A5C 44%,#FF6178 62%,#C9468E 80%,#6E3A93 100%)}
  .sun{position:absolute;left:50%;transform:translateX(-50%);border-radius:50%;background:radial-gradient(circle,#FFF3C4 0%,#FFE08A 45%,rgba(255,200,110,0) 72%)}
  .sundisc{position:absolute;left:50%;transform:translateX(-50%);border-radius:50%;background:#FFEFA8}
  .water{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(180deg,rgba(110,58,147,0) 0%,rgba(90,45,130,.35) 40%,rgba(40,20,70,.6) 100%)}
  .skyline{position:absolute;left:0;right:0;bottom:0;width:100%}
  .grain{position:absolute;inset:0;opacity:.45;mix-blend-mode:overlay;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='120' height='120' filter='url(%23n)' opacity='0.5'/></svg>")}
  .pad{position:absolute;inset:0;padding:70px;display:flex;flex-direction:column;z-index:5}
  .brand{display:flex;align-items:center;gap:11px}
  .brand svg{width:26px;height:26px}.brand b{font-family:'IBM Plex Mono';letter-spacing:.22em;font-size:17px;color:var(--ink)}
  .eyebrow{font-family:'IBM Plex Mono';font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--plum);font-size:21px;margin:30px 0 10px}
  h1{font-family:'Anton';font-weight:400;line-height:.92;letter-spacing:.5px;text-transform:uppercase;color:var(--ink)}
  .panel{background:rgba(255,248,234,.94);border:2px solid rgba(42,20,16,.85);border-radius:20px;padding:28px 30px;box-shadow:0 14px 40px rgba(60,20,40,.28)}
  .mono{font-family:'IBM Plex Mono'}
  .big{font-family:'Anton';color:var(--coral);line-height:.9}
  .mid{flex:1;display:flex;flex-direction:column;justify-content:center}
  .ftr{margin-top:auto;display:flex;justify-content:space-between;align-items:center;font-family:'IBM Plex Mono';font-size:20px;color:var(--ink);font-weight:500;z-index:5;padding-top:18px}
  .chip{display:inline-block;font-family:'IBM Plex Mono';font-weight:600;font-size:16px;letter-spacing:.06em;text-transform:uppercase;padding:5px 12px;border-radius:8px}
  .chip-buy{background:var(--green);color:#eafff0}.chip-warn{background:var(--magenta);color:#fff}
  .row{display:flex;justify-content:space-between;align-items:baseline;gap:14px}
  .li{font-size:28px;line-height:1.34;color:var(--ink);margin-bottom:14px}.li b{font-weight:700}
  .li .k{color:var(--plum);font-weight:700}
  table{width:100%;border-collapse:collapse}
  th{font-family:'IBM Plex Mono';font-size:15px;letter-spacing:.05em;text-transform:uppercase;color:var(--plum);text-align:left;padding:6px 8px;border-bottom:2px solid rgba(42,20,16,.3)}
  td{padding:10px 8px;border-bottom:1px solid rgba(42,20,16,.12);color:var(--ink)}
</style>`;
const MARK = `<svg viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#2a1410"/><g fill="#FFD27A"><rect x="5.5" y="18.5" width="3.6" height="8" rx="1.3"/><rect x="11.2" y="13" width="3.6" height="13.5" rx="1.3"/><rect x="16.9" y="8" width="3.6" height="18.5" rx="1.3"/><rect x="22.6" y="4" width="3.6" height="22.5" rx="1.3"/></g></svg>`;
const brand = `<div class="brand">${MARK}<b>PEAKTIME</b></div>`;
const foot = `<div class="ftr"><span>CRSSD FALL 2026 · est.</span><span>thedjrankings.com</span></div>`;

function skyline(H) {
  return `<svg class="skyline" viewBox="0 0 1080 220" preserveAspectRatio="none" style="height:${Math.round(H * 0.2)}px">
    <g fill="#241038"><rect x="0" y="150" width="1080" height="70"/>
      <rect x="120" y="96" width="34" height="70"/><rect x="160" y="70" width="26" height="96"/><rect x="196" y="110" width="40" height="56"/><rect x="250" y="84" width="30" height="82"/>
      <polygon points="300,166 318,40 336,166"/><rect x="352" y="92" width="38" height="74"/><rect x="398" y="116" width="46" height="50"/>
      <rect x="700" y="104" width="34" height="62"/><rect x="740" y="78" width="28" height="88"/><rect x="776" y="120" width="44" height="46"/><rect x="828" y="98" width="32" height="68"/><rect x="868" y="120" width="40" height="46"/></g>
    <g fill="#1c0c2c">
      <path d="M70 220 C66 170 60 130 54 96 C52 130 58 174 60 220 Z"/><path d="M57 98 C30 86 12 92 4 104 C30 96 44 98 57 102 Z"/><path d="M57 98 C78 80 104 80 120 92 C96 84 74 88 57 102 Z"/><path d="M57 96 C50 70 56 46 70 30 C58 52 56 76 60 98 Z"/><path d="M57 98 C40 84 22 64 18 44 C34 70 48 86 60 100 Z"/><path d="M57 98 C74 84 96 72 112 60 C92 80 72 92 60 100 Z"/>
      <path d="M1014 220 C1010 168 1004 126 998 92 C996 128 1002 176 1004 220 Z"/><path d="M1001 94 C974 82 956 88 948 100 C974 92 988 94 1001 98 Z"/><path d="M1001 94 C1022 76 1052 78 1070 90 C1044 80 1018 84 1001 98 Z"/><path d="M1001 92 C994 66 1000 42 1014 26 C1002 48 1000 72 1004 94 Z"/><path d="M1001 94 C1018 80 1044 68 1062 56 C1040 78 1016 90 1004 98 Z"/></g>
  </svg>`;
}
function frame(W, H, content) {
  const sun = Math.round(W * 0.62), disc = Math.round(W * 0.30), top = Math.round(H * 0.28);
  return `<!doctype html><html><head>${HEAD}</head><body>
  <div class="stage" style="width:${W}px;height:${H}px">
    <div class="sun" style="width:${sun}px;height:${sun}px;top:${top}px"></div>
    <div class="sundisc" style="width:${disc}px;height:${disc}px;top:${top + Math.round(sun * 0.18)}px"></div>
    <div class="water" style="height:${Math.round(H * 0.28)}px"></div>${skyline(H)}<div class="grain"></div>
    <div class="pad">${content}</div>
  </div></body></html>`;
}

const cards = [];

// ---------- 1) Budget by % (4:5 table) ----------
const sortedFees = Object.entries(FEES).sort((a, b) => b[1] - a[1]);
const TOPN = 14;
const rest = sortedFees.slice(TOPN);
const restSum = rest.reduce((s, x) => s + x[1], 0);
const maxFee = sortedFees[0][1];
const budgetRows = sortedFees.slice(0, TOPN).map(([n, f]) => `<tr>
  <td style="font-weight:600;max-width:340px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${n}</td>
  <td style="width:300px"><div style="height:16px;background:rgba(42,20,16,.1);border-radius:5px;overflow:hidden"><div style="height:100%;width:${(f / maxFee) * 100}%;background:linear-gradient(90deg,var(--coral),var(--magenta));border-radius:5px"></div></div></td>
  <td class="mono" style="text-align:right;color:var(--plum);font-weight:600;white-space:nowrap">${pctOf(f).toFixed(1)}%</td>
  <td class="mono" style="text-align:right;white-space:nowrap">${usd(f)}</td>
</tr>`).join("");
cards.push(["card-budget-4x5.png", 1080, 1350, `${brand}
  <div class="eyebrow">Where the money went</div>
  <h1 style="font-size:80px">$1.56M, split<br>across the bill</h1>
  <div class="panel" style="margin-top:22px;padding:24px 26px">
    <table style="font-size:21px">
      <thead><tr><th>Act</th><th>Share of budget</th><th style="text-align:right">%</th><th style="text-align:right">Est.</th></tr></thead>
      <tbody>${budgetRows}
        <tr><td style="color:var(--plum);font-style:italic">+ ${rest.length} more acts</td><td></td><td class="mono" style="text-align:right;color:var(--plum);font-weight:600">${pctOf(restSum).toFixed(1)}%</td><td class="mono" style="text-align:right">${usd(restSum)}</td></tr>
      </tbody>
    </table>
    <div class="mono" style="font-size:16px;color:var(--plum);margin-top:14px">Headline b2b alone = ${pctOf(maxFee).toFixed(0)}% · top 3 = ${(sortedFees.slice(0,3).reduce((s,x)=>s+x[1],0)/TOTAL*100).toFixed(0)}%. Fees are estimates.</div>
  </div>
  ${foot}`]);

// ---------- 2) Key wins (square) ----------
cards.push(["card-wins.png", 1080, 1350, `${brand}
  <div class="mid">
  <div class="eyebrow">Key wins</div>
  <h1 style="font-size:104px">Smart money<br>on the bill</h1>
  <div class="panel" style="margin-top:26px">
    <div class="li"><span class="chip chip-buy">★ Strong buy</span>&nbsp; <b>Prospa</b> — #4, momentum <span class="k">56</span>, Beatport <span class="k">95</span>, RA <span class="k">88</span>. Booked ~2 tiers below its demand.</div>
    <div class="li"><b>KETTAMA &amp; Carlita</b> — underpriced mid-card; KETTAMA's <span class="k">68</span> live-conversion means he overdelivers on stage vs. fee.</div>
    <div class="li"><b>Rossi.</b> — momentum <span class="k">75</span>, among the steepest climbs on the whole lineup. Booked early.</div>
  </div>
  </div>
  ${foot}`]);

// ---------- 3) Watch-outs (square) ----------
cards.push(["card-watchouts.png", 1080, 1350, `${brand}
  <div class="mid">
  <div class="eyebrow">Watch-outs</div>
  <h1 style="font-size:104px">Where the<br>risk sits</h1>
  <div class="panel" style="margin-top:26px">
    <div class="li"><span class="chip chip-warn">Priced ahead</span>&nbsp; <b>Chris Lake b2b Disclosure</b> — ${pctOf(250000).toFixed(0)}% of budget on one slot; momentum flat. A name play, not value.</div>
    <div class="li"><b>The streaming trap</b> — Notion (${(ml("Notion")/1e6).toFixed(1)}M) &amp; oskar med k (${(ml("oskar med k")/1e6).toFixed(1)}M) huge on streams, near-zero live conversion.</div>
    <div class="li"><b>Regional fatigue</b> — KETTAMA &amp; Chris Lake have been worked hard on the West Coast (see: saturation).</div>
  </div>
  </div>
  ${foot}`]);

// ---------- 4) Market saturation (square) ----------
cards.push(["card-saturation.png", 1080, 1350, `${brand}
  <div class="mid">
  <div class="eyebrow">Saturation watch</div>
  <h1 style="font-size:96px">Has San Diego<br>seen them?</h1>
  <div class="panel" style="margin-top:24px;border-color:var(--magenta)">
    <div class="li" style="margin-bottom:12px"><b>KETTAMA</b> — 5 shows in SF/Oakland this quarter + already hit San Diego. Real fatigue risk.</div>
    <div class="li" style="margin-bottom:0"><b>Chris Lake</b> — worked hard across the West Coast. Low scarcity for a SoCal crowd.</div>
  </div>
  <div class="panel" style="margin-top:16px;padding:22px 30px">
    <div class="mono" style="font-size:16px;color:var(--green);font-weight:600;letter-spacing:.06em">FRESH FOR SOCAL</div>
    <div style="font-size:27px;color:var(--ink);margin-top:8px;font-weight:600">Prospa · Carlita · I Hate Models · Ben UFO · Helena Hauff</div>
  </div>
  </div>
  ${foot}`]);

// ---------- 5) Driving ticket sales (square) ----------
cards.push(["card-tickets.png", 1080, 1350, `${brand}
  <div class="eyebrow">What sells tickets</div>
  <h1 style="font-size:100px">Three jobs,<br>one lineup</h1>
  <div class="panel" style="margin-top:26px">
    <div class="li"><span class="k">THE MARQUEE</span> — Chris Lake b2b Disclosure, Skepta, Mochakk, Sonny Fodera sell the on-sale.</div>
    <div class="li"><span class="k">SCENE CREDIBILITY</span> — I Hate Models, Ben UFO, Helena Hauff, 999999999, VTSS (high RA demand) convert the hardcore.</div>
    <div class="li" style="margin-bottom:0"><span class="k">VALUE MID-CARD</span> — Prospa, KETTAMA, Carlita, Jamback over-deliver on spend. Live conversion is the hidden engine.</div>
  </div>
  ${foot}`]);

// ---------- 6) Top-10 tracked acts (4:5 table) ----------
// Derived from the FULL lineup, ranked by this site's overall ranking, top 10.
const MEMBERS = { "Chris Lake b2b Disclosure": ["Chris Lake", "Disclosure"], "ROSSI. b2b Carlita": ["Rossi.", "Carlita"], "Skepta presents Más Tiempo": ["Skepta"] };
const trows = Object.keys(FEES).map(n => {
  const ds = (MEMBERS[n] || [n]).map(x => sig(x)).filter(Boolean); if (!ds.length) return null;
  const rank = Math.min(...ds.map(d => d.rank));
  return { n, fee: FEES[n], rank, mom: Math.max(...ds.map(d => d.momentum_score ?? -1)), val: ds.map(d => d.value_signal).find(v => v && v !== "fair") || "", conv: Math.max(...ds.map(d => d.live_conversion_score ?? -1)), bp: Math.max(...ds.map(d => d.beatport_score || 0)), ra: Math.max(...ds.map(d => d.ra_score || 0)) };
}).filter(Boolean).sort((a, b) => a.rank - b.rank).slice(0, 10);
const valChip = v => v === "strong-buy" ? '<span style="color:var(--green);font-weight:700">★Buy</span>' : v === "buy" ? '<span style="color:var(--green)">Buy</span>' : v === "premium" ? '<span style="color:var(--magenta)">Ahead</span>' : "—";
const cell = v => v >= 0 ? v : "—";
const tdm = 'class="mono" style="text-align:center;color:var(--ink)"';
const tableRows = trows.map(r => `<tr>
  <td class="mono" style="color:var(--coral);font-weight:700">#${r.rank}</td>
  <td style="font-weight:600;max-width:230px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.n}</td>
  <td class="mono" style="text-align:right">${usd(r.fee)}</td>
  <td ${tdm}>${cell(r.mom)}</td>
  <td class="mono" style="text-align:center">${valChip(r.val)}</td>
  <td ${tdm}>${cell(r.conv)}</td>
  <td ${tdm}>${r.bp || "—"}</td>
  <td ${tdm}>${r.ra || "—"}</td>
</tr>`).join("");
cards.push(["card-table-4x5.png", 1080, 1350, `${brand}
  <div class="eyebrow">The tracked acts · by the numbers</div>
  <h1 style="font-size:72px">Top 10, decoded</h1>
  <div class="panel" style="margin-top:22px;padding:22px 24px">
    <table style="font-size:21px">
      <thead><tr>
        <th>Rank</th><th>Artist</th><th style="text-align:right">Fee</th><th style="text-align:center">Mom</th><th style="text-align:center">Value</th><th style="text-align:center">Conv</th><th style="text-align:center">BP</th><th style="text-align:center">RA</th>
      </tr></thead><tbody>${tableRows}</tbody>
    </table>
    <div class="mono" style="font-size:15px;color:var(--plum);margin-top:14px;line-height:1.45">Mom = momentum · Conv = live-conversion (RA attendance vs streams) · BP = Beatport · RA = booking demand. Fees est.; live signals from thedjrankings.com.</div>
  </div>
  ${foot}`]);

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  const page = await browser.newPage();
  for (const [name, W, H, content] of cards) {
    await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
    await page.setContent(frame(W, H, content), { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: path.join(OUT, name) });
    console.log("Wrote img/" + name);
  }
  await browser.close();
})();
