// Renders PEAKTIME social brand assets (avatar + post templates) as 1080x1080 PNGs.
// Data-driven from frontend/public/rankings.json so posts use real artists/numbers.
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const OUT_DIR = path.join(__dirname, "..", "frontend", "public", "brand");
fs.mkdirSync(OUT_DIR, { recursive: true });

const raw = require("../frontend/public/rankings.json");
const ARTISTS = Array.isArray(raw) ? raw : raw.artists || raw.rankings;
const fmtML = n => (n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : Math.round(n / 1e3) + "K");

// ---- shared chrome ----------------------------------------------------------
const MARK = `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
  <g fill="#C8F750">
    <rect x="5.5" y="18.5" width="3.6" height="8" rx="1.3"/>
    <rect x="11.2" y="13" width="3.6" height="13.5" rx="1.3"/>
    <rect x="16.9" y="8" width="3.6" height="18.5" rx="1.3"/>
    <rect x="22.6" y="4" width="3.6" height="22.5" rx="1.3"/>
  </g></svg>`;

const shell = (body, { pad = true } = {}) => `<!doctype html><html><head><meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
  *{margin:0;box-sizing:border-box}
  :root{--bg:#0c0c0e;--card:#111114;--text-h:#E9E7DF;--text:#a9a8a2;--muted:#75767d;
    --border:#1e1f23;--accent:#C8F750;--on-accent:#0c0c0e;
    --sans:'Space Grotesk',system-ui,sans-serif;--mono:'IBM Plex Mono',monospace}
  html,body{width:1080px;height:1080px}
  .stage{width:1080px;height:1080px;background:var(--bg);color:var(--text-h);
    font-family:var(--sans);position:relative;overflow:hidden;${pad ? "padding:84px" : ""}}
  .topbar{display:flex;align-items:center;gap:14px;position:absolute;top:64px;left:84px}
  .topbar svg{width:40px;height:40px;display:block}
  .topbar .wm{font-family:var(--mono);font-weight:600;font-size:24px;letter-spacing:0.22em;color:var(--text-h)}
  .foot{position:absolute;bottom:60px;left:84px;right:84px;display:flex;justify-content:space-between;
    align-items:center;font-family:var(--mono);font-size:20px;color:var(--muted);letter-spacing:0.04em}
  .foot .dot{color:var(--accent)}
  .eyebrow{font-family:var(--mono);font-size:24px;font-weight:600;letter-spacing:0.18em;
    text-transform:uppercase;color:var(--accent)}
</style></head><body><div class="stage">${body}</div></body></html>`;

// ---- 1. avatar --------------------------------------------------------------
const avatar = () => `<!doctype html><html><head><meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@600&display=swap');
  *{margin:0;box-sizing:border-box}html,body{width:1080px;height:1080px}
  .stage{width:1080px;height:1080px;background:#0c0c0e;display:flex;flex-direction:column;
    align-items:center;justify-content:center;gap:64px}
  .mark{width:480px;height:480px}.mark svg{width:100%;height:100%}
  .word{font-family:'IBM Plex Mono',monospace;font-weight:600;color:#E9E7DF;font-size:76px;letter-spacing:0.16em}
</style></head><body><div class="stage"><div class="mark">${MARK}</div>
<div class="word">PEAKTIME</div></div></body></html>`;

// ---- 2. Demand Index Top 5 --------------------------------------------------
const top5 = () => {
  const rows = ARTISTS.slice(0, 5).map(a => `
    <div class="row">
      <div class="rk">${String(a.rank).padStart(2, "0")}</div>
      <div class="nm">${a.name}</div>
      <div class="sc">${a.score.toFixed(1)}</div>
    </div>`).join("");
  return shell(`
    <div class="topbar">${MARK}<span class="wm">PEAKTIME</span></div>
    <div style="position:absolute;top:200px;left:84px;right:84px">
      <div class="eyebrow">Demand Index · Top 5</div>
      <h1 style="font-size:62px;font-weight:700;letter-spacing:-1.6px;margin:18px 0 46px;line-height:1.02">
        Who's earning peak time</h1>
      <style>
        .row{display:grid;grid-template-columns:120px 1fr 160px;align-items:baseline;
          padding:26px 0;border-top:1px solid var(--border)}
        .row:last-child{border-bottom:1px solid var(--border)}
        .rk{font-family:var(--mono);font-size:34px;color:var(--muted)}
        .nm{font-size:40px;font-weight:500;color:var(--text-h)}
        .sc{font-family:var(--mono);font-size:40px;font-weight:600;color:var(--accent);text-align:right}
      </style>
      ${rows}
    </div>
    <div class="foot"><span>house &amp; techno · 263 DJs ranked</span><span><span class="dot">●</span> thedjrankings.com</span></div>
  `);
};

// ---- 3. Breakout of the week ------------------------------------------------
const breakout = () => {
  const a = ARTISTS.find(x => x.name === "BLOND:ISH");
  return shell(`
    <div class="topbar">${MARK}<span class="wm">PEAKTIME</span></div>
    <div style="position:absolute;top:210px;left:84px;right:84px">
      <div class="eyebrow">Breakout of the week</div>
      <h1 style="font-size:92px;font-weight:700;letter-spacing:-2.4px;margin:26px 0 8px;line-height:0.98">${a.name}</h1>
      <div style="font-family:var(--mono);font-size:26px;color:var(--muted);margin-bottom:56px">
        currently #${a.rank} on the index</div>
      <div style="display:flex;gap:56px;margin-bottom:54px">
        <div><div class="big">+${a.trends_mom_12w}%</div><div class="cap">search demand · 12 wks</div></div>
        <div><div class="big">${fmtML(a.spotify_monthly_listeners)}</div><div class="cap">monthly listeners</div></div>
        <div><div class="big">${a.tour_upcoming}</div><div class="cap">shows · ${a.tour_countries} countries</div></div>
      </div>
      <p style="font-size:36px;line-height:1.32;color:var(--text);max-width:840px">
        Search interest is accelerating faster than the streams —
        the rooms are moving before the algorithm catches up.</p>
      <style>.big{font-family:var(--mono);font-size:76px;font-weight:600;color:var(--accent);line-height:1}
        .cap{font-family:var(--mono);font-size:21px;color:var(--muted);margin-top:12px;letter-spacing:0.03em}</style>
    </div>
    <div class="foot"><span>signal: Google Trends momentum</span><span><span class="dot">●</span> thedjrankings.com</span></div>
  `);
};

// ---- 4. Reach vs Credibility scatter ----------------------------------------
const reachCred = () => {
  const pick = ["Disclosure", "John Summit", "Cloonee", "ANOTR", "Kolter", "Nick Curly"];
  const pts = pick.map(n => ARTISTS.find(a => a.name === n)).filter(Boolean);
  const W = 560, H = 330, x0 = 120, y0 = 50;
  const maxML = 26e6, maxB = 100;
  const sx = ml => x0 + (ml / maxML) * W;
  const sy = b => y0 + (1 - b / maxB) * H;
  const highlight = "Kolter";
  const dots = pts.map(p => {
    const hi = p.name === highlight;
    const cx = sx(p.spotify_monthly_listeners), cy = sy(p.beatport_score);
    return `<circle cx="${cx}" cy="${cy}" r="${hi ? 13 : 9}" fill="${hi ? "#C8F750" : "#75767d"}"/>
      <text x="${cx + 18}" y="${cy + 7}" font-family="IBM Plex Mono" font-size="22"
        fill="${hi ? "#E9E7DF" : "#a9a8a2"}">${p.name}</text>`;
  }).join("");
  return shell(`
    <div class="topbar">${MARK}<span class="wm">PEAKTIME</span></div>
    <div style="position:absolute;top:178px;left:84px;right:84px">
      <div class="eyebrow">Reach vs. Credibility</div>
      <h1 style="font-size:52px;font-weight:700;letter-spacing:-1.4px;margin:16px 0 26px;line-height:1.04">
        Big numbers aren't the same<br/>as scene respect</h1>
      <svg viewBox="0 0 ${x0 + W + 230} ${y0 + H + 90}" width="690">
        <line x1="${x0}" y1="${y0}" x2="${x0}" y2="${y0 + H}" stroke="#1e1f23"/>
        <line x1="${x0}" y1="${y0 + H}" x2="${x0 + W}" y2="${y0 + H}" stroke="#1e1f23"/>
        <text x="${x0 - 14}" y="${y0 + 6}" text-anchor="end" font-family="IBM Plex Mono" font-size="20" fill="#75767d">100</text>
        <text x="${x0 - 14}" y="${y0 + H}" text-anchor="end" font-family="IBM Plex Mono" font-size="20" fill="#75767d">0</text>
        <text x="${x0 - 70}" y="${y0 + H / 2}" font-family="IBM Plex Mono" font-size="22" fill="#a9a8a2"
          transform="rotate(-90 ${x0 - 70} ${y0 + H / 2})" text-anchor="middle">Beatport credibility →</text>
        <text x="${x0 + W / 2}" y="${y0 + H + 50}" text-anchor="middle" font-family="IBM Plex Mono" font-size="22" fill="#a9a8a2">Spotify reach →</text>
        ${dots}
      </svg>
      <p style="font-size:30px;line-height:1.3;color:var(--text);max-width:900px;margin-top:22px">
        <b style="color:var(--accent)">Kolter</b> sits near the top for chart credibility on a fraction
        of the streams — a DJ's DJ the mainstream hasn't priced in yet.</p>
    </div>
    <div class="foot"><span>axes: Beatport score × monthly listeners</span><span><span class="dot">●</span> thedjrankings.com</span></div>
  `);
};

// ---- render -----------------------------------------------------------------
const JOBS = [
  ["avatar-1080.png", avatar()],
  ["post-top5-1080.png", top5()],
  ["post-breakout-1080.png", breakout()],
  ["post-reach-cred-1080.png", reachCred()],
];

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 1 });
  for (const [name, html] of JOBS) {
    await page.setContent(html, { waitUntil: "load", timeout: 60000 });
    await page.evaluate(() => document.fonts.ready);
    await new Promise(r => setTimeout(r, 600));
    const out = path.join(OUT_DIR, name);
    await page.screenshot({ path: out, type: "png" });
    console.log("Wrote", out);
  }
  await browser.close();
})();
