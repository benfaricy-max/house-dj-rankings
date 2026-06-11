/**
 * Reusable Lineup Intelligence generator.
 *
 * The III Points and CRSSD reports were each a hand-coded ~300-line script with a
 * bolted-on ACTS array and prose picks written by hand. This turns that into a
 * function: feed a lineup config, and it pulls live PEAKTIME signals, AUTO-DERIVES
 * the picks (smartest buy, value mid-card, priced-ahead, breakout, saturation,
 * conversion standouts) from the data, and writes the same branded report. A new
 * festival is now a JSON config, not a coding session.
 *
 *   node backend/makeLineupReport.js backend/lineups/<slug>.json
 *
 * Config shape (see backend/lineups/README.md):
 *   { slug, title, eyebrow, lead?, region?, currency?, lanes[], acts[], editorial? }
 *   acts[]:  { name, fee, lane, members?, live? }
 *   region?: { label, countries?[], cities?[] }   // for the saturation read
 *
 * Honesty: fees are editorial estimates, never transacted — the report says so in
 * the method note. Demand-side signals (rank, momentum, value, conversion, RA,
 * Beatport, saturation) are live from rankings.json. Acts the roster doesn't cover
 * render as untracked by design (PEAKTIME is house/techno/electronic).
 */
const fs = require("fs");
const path = require("path");

const RANKINGS = path.join(__dirname, "..", "frontend", "public", "rankings.json");
const norm = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

// ── visual system (shared with the two original reports) ─────────────────────
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
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function generateLineupReport(config) {
  const {
    slug, title, eyebrow = "Lineup Intelligence", lead, region,
    currency = "USD", lanes = [], acts = [], editorial = {},
    outDir = path.join(__dirname, "..", "frontend", "public", "reports", slug),
  } = config;
  if (!slug || !title || !acts.length) throw new Error("config needs slug, title, and acts[]");

  const A = JSON.parse(fs.readFileSync(RANKINGS, "utf8")).rankings;
  const BY = {}; A.forEach(a => { BY[norm(a.name)] = a; });
  const sig = name => BY[norm(name)] || null;
  const sym = currency === "GBP" ? "£" : "$";
  const money = n => sym + Number(n).toLocaleString();
  const ml = name => sig(name)?.spotify_monthly_listeners || 0;
  const firstName = a => (a.members ? a.members[0] : a.name);

  // Best available verdict data for an act (covers b2b via members).
  const actData = act => {
    const ds = (act.members || [act.name]).map(sig).filter(Boolean);
    if (!ds.length) return { covered: false };
    return {
      covered: true,
      rank: Math.min(...ds.map(d => d.rank || 999)),
      momentum: Math.max(...ds.map(d => d.momentum_score ?? -1)),
      value: ds.map(d => d.value_signal).find(v => v && v !== "fair") || null,
      conv: Math.max(...ds.map(d => d.live_conversion_score ?? -1)),
      beatport: Math.max(...ds.map(d => d.beatport_score || 0)),
      ra: Math.max(...ds.map(d => d.ra_score || 0)),
    };
  };

  // Recent shows in the festival's region (saturation read), from ra_recent_cities.
  const regionShows = act => {
    if (!region) return null;
    const cs = (region.countries || []).map(norm), cities = (region.cities || []).map(norm);
    let shows = 0, sat = 0;
    (act.members || [act.name]).map(sig).filter(Boolean).forEach(d => {
      (d.ra_recent_cities || []).forEach(c => {
        const inRegion = cs.includes(norm(c.country)) || cities.some(x => norm(c.city).includes(x) || x.includes(norm(c.city)));
        if (inRegion) { shows += c.shows_3m || c.shows || 0; sat = Math.max(sat, c.saturation || 0); }
      });
    });
    return { shows, sat };
  };

  const rows = acts.map(a => ({ a, d: actData(a), region: regionShows(a) }));
  const TOTAL = acts.reduce((s, a) => s + a.fee, 0);
  const pct = f => (f / TOTAL) * 100;
  const laneColor = {}; lanes.forEach((l, i) => { laneColor[l.id] = l.color || ["#C8F750", "#7fd4ff", "#ff8a5c"][i] || "#C8F750"; });
  const sorted = [...rows].sort((x, y) => y.a.fee - x.a.fee);
  const maxFee = sorted[0].a.fee;
  const tracked = rows.filter(r => r.d.covered).sort((x, y) => x.d.rank - y.d.rank);
  const dance = lanes[0]?.id;
  const trackedDance = tracked.filter(r => dance == null || r.a.lane === dance);

  // ── auto-derived picks ─────────────────────────────────────────────────────
  const buys = trackedDance.filter(r => r.d.value === "strong-buy" || r.d.value === "buy");
  // Smartest buy: strong-buy outranks buy, then best live-conversion, then rank.
  const vrank = v => (v === "strong-buy" ? 0 : v === "buy" ? 1 : 2);
  const smartest = [...buys].sort((x, y) => vrank(x.d.value) - vrank(y.d.value) || y.d.conv - x.d.conv || x.d.rank - y.d.rank)[0];
  const midcard = buys.filter(r => r !== smartest).sort((x, y) => y.d.momentum - x.d.momentum).slice(0, 2);
  // Breakout: a cheaply-booked accelerator, not just the highest-momentum headliner.
  // Restrict to the lower-fee half of the tracked lane, then highest momentum.
  const feesAsc = [...trackedDance].map(r => r.a.fee).sort((a, b) => a - b);
  const medianFee = feesAsc[Math.floor(feesAsc.length / 2)] || Infinity;
  const breakoutPool = trackedDance.filter(r => r.a.fee <= medianFee && r.d.momentum >= 0);
  const breakout = [...breakoutPool].sort((x, y) => y.d.momentum - x.d.momentum)[0];
  const topMomentum = breakout && trackedDance.every(r => r.d.momentum <= breakout.d.momentum);
  const pricedAhead = sorted.filter(r => r.d.covered && r.d.value === "premium").slice(0, 3);
  const bigUntracked = sorted.filter(r => !r.d.covered).slice(0, 3);
  const satList = region ? rows.filter(r => r.region && r.region.shows > 0)
    .sort((x, y) => y.region.sat - x.region.sat || y.region.shows - x.region.shows).slice(0, 5) : [];
  const fresh = region ? trackedDance.filter(r => r.region && r.region.shows === 0)
    .sort((x, y) => x.d.rank - y.d.rank).slice(0, 4) : [];
  const convStars = rows.filter(r => r.d.covered && r.d.conv >= 70).sort((x, y) => y.d.conv - x.d.conv).slice(0, 6);
  const softLive = rows.filter(r => r.d.covered && ml(firstName(r.a)) >= 3e6 && r.d.conv >= 0 && r.d.conv < 20)
    .sort((x, y) => ml(firstName(y.a)) - ml(firstName(x.a))).slice(0, 5);

  // ── prose (auto, with optional editorial overrides) ─────────────────────────
  const nm = r => esc(r.a.name);
  const buyVerb = r => (r.d.value === "strong-buy" ? "Strong Buy" : "underpriced");
  const smartestNote = editorial.smartestBuy || (smartest ? (() => {
    const scarce = region && smartest.region && smartest.region.shows === 0
      ? ` And it's fresh for ${esc(region.label)} — no recent local play, so the date carries novelty as well as value.` : "";
    return `Flagged a <b>${buyVerb(smartest)}</b> at ~${money(smartest.a.fee)}: live-conversion <b>${smartest.d.conv}</b>, RA <b>${smartest.d.ra}</b> — room demand running ahead of streaming.${scarce}`;
  })() : "");
  const midcardNote = editorial.valueMidcard || (midcard.length ? midcard.map(r =>
    `<b>${nm(r)}</b> (#${r.d.rank}, momentum ${r.d.momentum}, ${buyVerb(r)} at ~${money(r.a.fee)})`).join(", ") + " read as margin bookings — demand ahead of the fee." : "");
  const pricedNote = editorial.pricedAhead || (() => {
    const big = bigUntracked.length ? `The biggest lines — ${bigUntracked.map(r => `<b>${nm(r)}</b>`).join(", ")} — sit outside the dance-demand model: they sell identity, not booking value. ` : "";
    const prem = pricedAhead.length ? `Inside the tracked lane, ${pricedAhead.map(r => `<b>${nm(r)}</b>`).join(", ")} read <b>Priced ahead</b> — fee hotter than current momentum.` : "";
    return (big + prem) || "No clear overpays in the tracked lane — the bill prices in line with demand.";
  })();
  const breakoutNote = editorial.breakout || (breakout ? `<b>${nm(breakout)}</b> carries momentum <b>${breakout.d.momentum}</b>${topMomentum ? " — the highest of any tracked act here" : " — among the steepest on the bill"}, booked at an estimated ~${money(breakout.a.fee)}. An early-booked accelerator that looks like a steal in hindsight if the curve holds.` : "");

  // ── HTML ────────────────────────────────────────────────────────────────────
  const barsHTML = sorted.map(({ a, d }) => `<div class="bar-row">
    <div class="bar-name">${esc(a.name)}${d.covered ? '<span class="cov">●TRACKED</span>' : ''}</div>
    <div class="bar-track"><div class="bar-fill" style="width:${(a.fee / maxFee) * 100}%;background:${laneColor[a.lane] || "#C8F750"}"></div></div>
    <div class="bar-val">${money(a.fee)} · ${pct(a.fee).toFixed(1)}%</div>
  </div>`).join("");

  const legendHTML = lanes.map(l => {
    const tot = acts.filter(a => a.lane === l.id).reduce((s, a) => s + a.fee, 0);
    return `<span><span class="dot" style="background:${laneColor[l.id]}"></span>${esc(l.label)} · ${money(tot)}</span>`;
  }).join("");

  const tableHTML = tracked.map(({ a, d }) => `<tr>
    <td>${esc(a.name)}</td><td class="tnum">#${d.rank}</td><td class="tnum">${money(a.fee)}</td>
    <td>${d.momentum >= 0 ? `<span class="p-mo tnum">${d.momentum}</span>` : '<span class="tnum" style="color:#555">—</span>'}</td>
    <td>${d.value === "strong-buy" ? '<span class="pill p-buy">★ Strong buy</span>' : d.value === "buy" ? '<span class="pill p-buy">Underpriced</span>' : d.value === "premium" ? '<span class="pill p-prem">Priced ahead</span>' : '<span style="color:#555">—</span>'}</td>
    <td class="tnum">${d.conv >= 0 ? d.conv : "—"}</td><td class="tnum">${d.beatport || "—"}</td><td class="tnum">${d.ra || "—"}</td>
  </tr>`).join("");

  const satHTML = satList.length ? `
  <h2>Market saturation — this is a ${esc(region.label)} date</h2>
  <div class="box" style="margin-top:6px"><span class="tag sat">Local-fatigue risk</span><ul>
    ${satList.map(r => `<li><b>${nm(r)}</b> — local saturation <b>${r.region.sat}</b> (${r.region.shows} ${r.region.shows === 1 ? "show" : "shows"}/~90d), familiar to the ${esc(region.label)} room.</li>`).join("")}
    ${fresh.length ? `<li>Upside: <b>${fresh.map(nm).join(", ")}</b> carry their saturation in other markets — comparatively fresh for ${esc(region.label)}.</li>` : ""}
  </ul></div>` : "";

  const laneTotals = lanes.map(l => acts.filter(a => a.lane === l.id).reduce((s, a) => s + a.fee, 0));
  const outsideLead = lanes.length > 1 ? ((TOTAL - laneTotals[0]) / TOTAL * 100).toFixed(0) : "0";

  const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} — Lineup Intelligence | PEAKTIME</title>
<meta name="description" content="A data-driven booking analysis of the ${esc(title)} lineup — estimated budget, value buys, overpays and market saturation, by PEAKTIME / thedjrankings.com.">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>${STYLE}</style></head><body>
<div class="wrap">
  <div class="brand">${MARK}<b>PEAKTIME</b><a href="https://thedjrankings.com">thedjrankings.com ↗</a></div>
  <div class="hero">
    <div class="eyebrow">${esc(eyebrow)}</div>
    <h1>${esc(title)}:<br>what the lineup is really worth</h1>
    <p class="lead">${esc(lead || `We ran the ${title} bill through PEAKTIME's demand model — estimating the talent budget, then scoring each act on momentum, value, live conversion and market freshness. Here's where the money went, who's underpriced, and who'll actually move tickets.`)}</p>
  </div>

  <div class="kpis">
    <div class="kpi"><div class="n">~${money(TOTAL)}</div><div class="l">Est. talent budget (costed ${acts.length})</div></div>
    <div class="kpi"><div class="n">${acts.length}</div><div class="l">Acts costed (full bill is larger)</div></div>
    <div class="kpi"><div class="n">${outsideLead}%</div><div class="l">Spent outside the lead lane</div></div>
    <div class="kpi"><div class="n sm">${tracked.length} / ${acts.length}</div><div class="l">Acts tracked by PEAKTIME</div></div>
  </div>

  <h2>Where the budget went</h2>
  <p>Estimated booking fee per act as a share of the ~${money(TOTAL)} costed total. PEAKTIME tracks the electronic / dance lane — the rest is curation.</p>
  <div class="legend">${legendHTML}</div>
  <div class="bars">${barsHTML}</div>

  <h2>Key wins &amp; watch-outs</h2>
  <div class="grid">
    ${smartest ? `<div class="box win"><span class="tag win">Smartest buy</span><h3>${nm(smartest)} — converts, and underpriced</h3><p>${smartestNote}</p></div>` : ""}
    ${midcard.length ? `<div class="box win"><span class="tag win">Value mid-card</span><h3>Margin bookings on the bill</h3><p>${midcardNote}</p></div>` : ""}
    <div class="box warn"><span class="tag warn">Paying for the name</span><h3>Where the marquee is curation, not a deal</h3><p>${pricedNote}</p></div>
    ${breakout ? `<div class="box warn"><span class="tag warn">Breakout to watch</span><h3>${nm(breakout)} is climbing fast</h3><p>${breakoutNote}</p></div>` : ""}
  </div>
  ${satHTML}

  <h2>Streaming ≠ tickets</h2>
  <p>The number a streaming chart hides — RA live-conversion relative to streaming reach. On a curator bill, the contrast is the whole point:</p>
  <div class="grid">
    <div class="box win"><span class="tag win">Converts above its weight</span>
      <ul>${convStars.map(({ a, d }) => `<li><b>${esc(a.name)}</b> — conversion ${d.conv}/100${ml(firstName(a)) ? ` on just ${(ml(firstName(a)) / 1e6).toFixed(1)}M listeners` : ""}</li>`).join("") || "<li>No standout over-converters in this bill.</li>"}</ul>
      <p style="font-size:13px;margin-top:6px">Niche draw &gt; streaming size — the value end of the bill.</p></div>
    <div class="box warn"><span class="tag warn">Big streams, soft live demand</span>
      <ul>${softLive.map(({ a, d }) => `<li><b>${esc(a.name)}</b> — ${(ml(firstName(a)) / 1e6).toFixed(1)}M listeners but conversion ${d.conv}/100</li>`).join("") || "<li>No big-stream / soft-live mismatches flagged.</li>"}</ul>
      <p style="font-size:13px;margin-top:6px">Great for the on-sale headline, riskier as room-filling bookings.</p></div>
  </div>

  ${editorial.closing ? `<h2>Who actually drives ticket sales</h2><p>${editorial.closing}</p>` : ""}

  <h2>The tracked acts, by the numbers</h2>
  <table><thead><tr><th>Artist</th><th>Rank</th><th>Est. fee</th><th>Mom.</th><th>Value</th><th>Conv.</th><th>BP</th><th>RA</th></tr></thead>
  <tbody>${tableHTML}</tbody></table>

  <div class="note">
    <b>Method &amp; caveats.</b> Booking fees are PEAKTIME editorial estimates for a festival booking (${currency}), not confirmed contracts — actual fees vary with routing, exclusivity and timing. We costed ${acts.length} of the bill; the full lineup is larger. b2b and "presents" slots are costed as a single line. Rank, momentum, value, live-conversion, Beatport, RA and saturation figures are live from thedjrankings.com for the ${tracked.length} acts the roster currently tracks — PEAKTIME covers house/techno/electronic, so other lanes show as untracked by design. Demand signals from public sources (Spotify, Beatport, Resident Advisor, Google Trends, Wikipedia). Not affiliated with the festival or its promoters.
    <br><br>PEAKTIME · the demand index for electronic music · <b style="color:var(--accent)">thedjrankings.com</b>
  </div>
</div>
</body></html>`;

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), PAGE);
  return {
    path: path.join(outDir, "index.html"),
    total: TOTAL, acts: acts.length, tracked: tracked.length,
    smartest: smartest ? smartest.a.name : null,
    breakout: breakout ? breakout.a.name : null,
  };
}

module.exports = { generateLineupReport };
