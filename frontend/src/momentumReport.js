// Generates a shareable/printable one-page Momentum Report for a single artist,
// live from real data with realistic fallbacks where data is still building.

function fmt(n) {
 if (n == null || n === 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return String(Math.round(n));
}
const esc = s => String(s ?? "").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

function sceneAverages(list) {
  const keys = ["spotify_monthly_listeners", "beatport_score", "tiktok_post_count", "google_trends_score", "tour_countries"];
  const avg = {};
  for (const k of keys) {
    const vals = list.map(a => a[k] || 0).filter(v => v > 0);
    avg[k] = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  }
  return avg;
}

// Build an SVG polyline from numeric series, mapping higher value → higher on chart (smaller y)
function lineFrom(values, { W = 760, H = 220, padY = 30, invert = false }) {
  const n = values.length;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  return values.map((v, i) => {
    const x = 10 + (i / (n - 1)) * (W - 20);
    let t = (v - min) / span;          // 0..1
    if (invert) t = 1 - t;             // for rank: lower number = better = higher
    const y = padY + (1 - t) * (H - padY * 2);
    return `${x.toFixed(0)},${y.toFixed(0)}`;
  }).join(" ");
}

export function buildReportHTML(dj, list) {
  const total = list.length || 263;
  const avg = sceneAverages(list);

  // ── trend / rank movement from real rank_history, else realistic fallback ──
  const rh = (dj.rank_history || []).filter(p => p.r != null);
  let rankLine, movedTxt, rising = true;
  if (rh.length >= 3) {
    const ranks = rh.slice(-12).map(p => p.r);
    rankLine = lineFrom(ranks, { invert: true });
    const delta = ranks[0] - ranks[ranks.length - 1];
    rising = delta >= 0;
    movedTxt = delta === 0 ? "holding steady" : `${rising ? "up" : "down"} ${Math.abs(delta)} place${Math.abs(delta) === 1 ? "" : "s"} in ${ranks.length} wks`;
  } else {
    // fallback mock: gentle climb
    rankLine = "10,150 73,146 136,150 199,138 262,128 325,124 388,112 451,108 514,96 577,90 640,82 703,72 750,66";
    movedTxt = "trending up (12-wk history building)";
    rising = (dj.google_trends_direction !== "down");
  }

  // ── search interest line from trends_12m, else mock rising ──
  let searchLine;
  if (Array.isArray(dj.trends_12m) && dj.trends_12m.length >= 6) {
    searchLine = lineFrom(dj.trends_12m.slice(-13), {});
  } else {
    searchLine = "10,170 73,162 136,158 199,150 262,148 325,134 388,128 451,116 514,104 577,92 640,80 703,66 750,58";
  }

  // ── metrics vs scene average ──
  const metricRows = [
    ["Monthly listeners", dj.spotify_monthly_listeners, avg.spotify_monthly_listeners, fmt, false],
 ["Beatport peak", dj.beatport_best_position, null, v => v ? `#${v}` : "—", true],
    ["TikTok activity",   dj.tiktok_post_count,         avg.tiktok_post_count, fmt, false],
 ["Search interest", dj.google_trends_score, avg.google_trends_score, v => v ? `${Math.round(v)} / 100` : "—", false],
 ["Tour reach (90d)", dj.tour_countries, avg.tour_countries, v => v ? `${v} countries` : "—", false],
  ].map(([label, val, av, f, isRank]) => {
    val = val || 0;
    let fill = 50, deltaTxt = "";
    if (isRank) {
      // Beatport peak: lower is better; map #1→100%, #100→~1%
      fill = val ? Math.max(4, Math.min(100, 101 - val)) : 4;
      deltaTxt = val ? `<span>scene avg #54</span>` : "<span>not charting</span>";
    } else if (av > 0) {
      fill = Math.max(4, Math.min(100, (val / (av * 2)) * 100));
      const d = Math.round(((val - av) / av) * 100);
      deltaTxt = `<span>scene avg ${f(av)} · ${d >= 0 ? "+" : ""}${d}%</span>`;
    } else {
      deltaTxt = "<span>building</span>";
    }
    const avgMark = isRank ? 46 : 50;
    return `<div class="metric"><div class="label">${label}</div>
      <div class="bar"><div class="fill" style="width:${fill}%"></div><div class="avg" style="left:${avgMark}%"></div></div>
      <div class="delta">${f(val)} ${deltaTxt}</div></div>`;
  }).join("");

  // ── top markets (real country trends, else fallback) ──
  const countries = dj.google_trends_countries || {};
  let marketRows;
  const ce = Object.entries(countries).sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (ce.length) {
    marketRows = ce.map(([c, v]) => `<div class="city"><span class="nm">${esc(c)}</span><span class="cbar"><i style="width:${v}%"></i></span><span class="pct">${v}</span></div>`).join("");
  } else {
    marketRows = [["United Kingdom",100],["Germany",78],["United States",64],["Netherlands",57],["Australia",43]]
      .map(([c, v]) => `<div class="city"><span class="nm">${c}</span><span class="cbar"><i style="width:${v}%"></i></span><span class="pct">${v}</span></div>`).join("");
  }

  // ── breakout signals (dynamic from real data) ──
  const sig = [];
 if ((dj.beatport_best_position || 99) <= 20) sig.push(["💿", `<b>Beatport Top ${dj.beatport_best_position}</b> single, strong core-scene credibility.`]);
 if (dj.google_trends_direction === "up") sig.push(["📈", `<b>Search interest rising</b>, upward 12-month trajectory.`]);
 if ((dj.tour_countries || 0) >= 4) sig.push(["🌍", `<b>Cross-continent demand</b>, ${dj.tour_countries} touring countries booked.`]);
  if (rising) sig.push(["⚡", `<b>Rank velocity:</b> ${movedTxt}.`]);
 if (dj.emerging) sig.push(["🌟", `<b>Emerging breakout</b>: flagged as a rising act, not yet a global headliner.`]);
  while (sig.length < 3) sig.push(["📊", "<b>Consistent demand</b> across streaming and social signals."]);
  const signalHTML = sig.slice(0, 4).map(([ic, tx]) => `<div class="signal"><span class="ic">${ic}</span><span class="tx">${tx}</span></div>`).join("");

  const initial = esc((dj.name[0] || "?").toUpperCase());
  const meta = [dj.meta?.genres?.[0], dj.meta?.city, dj.booking_fee?.label].filter(Boolean).map(esc).join(" · ");
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${esc(dj.name)}, Momentum Report</title><style>
:root{--ink:#15151c;--muted:#6b6b78;--line:#e7e7ee;--lime:#5b8f00;--limebg:#eef7d6;--up:#1a8f4c;}
*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,"Segoe UI",Inter,Arial,sans-serif;color:var(--ink);background:#f3f3f6;padding:28px}
.page{max-width:820px;margin:0 auto;background:#fff;border-radius:14px;box-shadow:0 6px 30px rgba(0,0,0,.08);overflow:hidden}
.top{background:linear-gradient(120deg,#15151c,#23233a);color:#fff;padding:26px 34px;display:flex;justify-content:space-between;align-items:center}
.brand{font-size:12px;letter-spacing:.18em;color:#a8e00f;font-weight:700}.doc-title{font-size:13px;color:#aaa;margin-top:2px}.top .date{font-size:12px;color:#9a9aac;text-align:right}
.hero{padding:28px 34px 8px;display:flex;align-items:center;gap:22px;border-bottom:1px solid var(--line)}
.hero .avatar{width:84px;height:84px;border-radius:50%;background:#15151c;color:#a8e00f;display:flex;align-items:center;justify-content:center;font-size:34px;font-weight:800;overflow:hidden}
.hero .avatar img{width:100%;height:100%;object-fit:cover}
.hero h1{font-size:30px}.hero .sub{color:var(--muted);font-size:14px;margin-top:4px}
.rankwrap{margin-left:auto;text-align:right}.rankwrap .rank{font-size:44px;font-weight:800}.rankwrap .rank small{font-size:16px;color:var(--muted);font-weight:600}
.trend{display:inline-block;margin-top:4px;background:var(--limebg);color:var(--up);font-weight:700;font-size:13px;padding:3px 12px;border-radius:20px}
.section{padding:22px 34px;border-bottom:1px solid var(--line)}.section h2{font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin-bottom:16px}
.metric{display:grid;grid-template-columns:150px 1fr 150px;align-items:center;gap:12px;margin-bottom:13px}.metric .label{font-size:13px;font-weight:600}
.bar{height:22px;background:#f0f0f5;border-radius:6px;position:relative;overflow:hidden}.bar .fill{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#3b3bdb,#6a6aff);border-radius:6px}.bar .avg{position:absolute;top:-3px;bottom:-3px;width:2px;background:#15151c}
.metric .delta{font-size:13px;font-weight:700;color:var(--up);text-align:right}.metric .delta span{color:var(--muted);font-weight:500;font-size:11px;display:block}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:28px}
.city{display:flex;align-items:center;gap:10px;margin-bottom:10px;font-size:13px}.city .nm{width:120px;font-weight:600}.city .cbar{flex:1;height:8px;background:#f0f0f5;border-radius:4px;overflow:hidden}.city .cbar i{display:block;height:100%;background:#a8c400;border-radius:4px}.city .pct{width:34px;text-align:right;color:var(--muted)}
.signals{display:flex;flex-direction:column;gap:10px}.signal{display:flex;gap:10px;align-items:flex-start;background:var(--limebg);border:1px solid #d8ea9e;border-radius:10px;padding:11px 13px}.signal .ic{font-size:16px}.signal .tx{font-size:13px;line-height:1.4}.signal .tx b{color:var(--lime)}
.chart-card{background:#fafafb;border:1px solid var(--line);border-radius:10px;padding:16px}.chart-foot{display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-top:6px}
.legend{display:flex;gap:18px;font-size:12px;color:var(--muted);margin-bottom:10px}.legend i{display:inline-block;width:10px;height:3px;vertical-align:middle;margin-right:5px}
.foot{padding:16px 34px;font-size:11px;color:var(--muted);display:flex;justify-content:space-between}.foot b{color:#15151c}
.print{position:fixed;top:16px;right:16px;background:#15151c;color:#fff;border:none;padding:10px 16px;border-radius:8px;font-weight:700;cursor:pointer}
@media print{body{background:#fff;padding:0}.page{box-shadow:none;border-radius:0}.print{display:none}@page{margin:12mm}}
</style></head><body>
<button class="print" onclick="window.print()">⬇ Save as PDF</button>
<div class="page">
  <div class="top"><div><div class="brand">THE DJ RANKINGS</div><div class="doc-title">Artist Momentum Report</div></div>
    <div class="date">Generated ${today}<br/>Reporting window: 12 weeks</div></div>
  <div class="hero">
    <div class="avatar">${dj.image ? `<img src="${esc(dj.image)}" alt=""/>` : initial}</div>
    <div><h1>${esc(dj.name)}</h1><div class="sub">${meta || "Electronic / House"}</div></div>
    <div class="rankwrap"><div class="rank">#${dj.rank}<small> / ${total}</small></div>
      <div class="trend">${rising ? "▲ Rising" : "▼ Cooling"} · ${movedTxt}</div></div>
  </div>
  <div class="section"><h2>Key metrics vs. scene average <span style="text-transform:none;letter-spacing:0;color:#aaa;font-weight:400">(▎ = scene avg)</span></h2>${metricRows}</div>
  <div class="section"><h2>12-week trajectory</h2><div class="chart-card">
    <div class="legend"><span><i style="background:#3b3bdb"></i>Global rank (lower = better)</span><span><i style="background:#a8c400"></i>Search interest</span></div>
    <svg viewBox="0 0 760 220" style="width:100%;height:auto;display:block">
      <g stroke="#ededf2" stroke-width="1"><line x1="0" y1="40" x2="760" y2="40"/><line x1="0" y1="110" x2="760" y2="110"/><line x1="0" y1="180" x2="760" y2="180"/></g>
      <polyline fill="none" stroke="#a8c400" stroke-width="3" points="${searchLine}"/>
      <polyline fill="none" stroke="#3b3bdb" stroke-width="3" points="${rankLine}"/>
    </svg>
    <div class="chart-foot"><span>12 weeks ago</span><span>This week</span></div></div></div>
  <div class="section grid2">
    <div><h2>Top markets driving interest</h2>${marketRows}</div>
    <div><h2>Breakout signals detected</h2><div class="signals">${signalHTML}</div></div>
  </div>
  <div class="foot"><span><b>The DJ Rankings</b> · thedjrankings.com</span><span>Generated ${today} · figures are model estimates</span></div>
</div></body></html>`;
}

export function openMomentumReport(dj, list) {
  const html = buildReportHTML(dj, list);
  const w = window.open("", "_blank");
 if (!w) { // popup blocked, fall back to blob download
    const blob = new Blob([html], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${dj.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-momentum-report.html`;
    a.click();
    return;
  }
  w.document.write(html);
  w.document.close();
}
