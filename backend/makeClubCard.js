/**
 * Top-10 Club Index social card (4:5, 1080x1350) — dark editorial PEAKTIME style.
 *   node makeClubCard.js
 */
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const OUT = path.join(__dirname, "..", "frontend", "public", "reports", "club-index");
fs.mkdirSync(path.join(OUT, "img"), { recursive: true });

const TOP = [
  [1, "Club Space", "Miami", 94.5], [2, "Amnesia", "Ibiza", 93.7], [3, "Berghain / Panorama Bar", "Berlin", 93.6],
  [4, "DC-10", "Ibiza", 91.5], [5, "Tresor", "Berlin", 90.7], [6, "Sub Club", "Glasgow", 90.0],
  [7, "fabric", "London", 89.6], [8, "Smart Bar", "Chicago", 88.7], [9, "Rex Club", "Paris", 88.5],
  [10, "Robert Johnson", "Offenbach", 87.7],
];
const max = TOP[0][3];
const MARK = `<svg viewBox="0 0 32 32"><g fill="#C8F750"><rect x="5.5" y="18.5" width="3.6" height="8" rx="1.3"/><rect x="11.2" y="13" width="3.6" height="13.5" rx="1.3"/><rect x="16.9" y="8" width="3.6" height="18.5" rx="1.3"/><rect x="22.6" y="4" width="3.6" height="22.5" rx="1.3"/></g></svg>`;

const rows = TOP.map(([r, n, c, s]) => `
  <div class="row">
    <div class="rk">${r <= 3 ? ["①","②","③"][r-1] : r}</div>
    <div class="nm">${n}<span class="ct">${c}</span></div>
    <div class="bar"><div class="fill" style="width:${(s / max) * 100}%"></div></div>
    <div class="sc">${s}</div>
  </div>`).join("");

const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Anton&family=IBM+Plex+Mono:wght@500;600&display=swap" rel="stylesheet">
<style>
  *{margin:0;box-sizing:border-box}
  .stage{width:1080px;height:1350px;background:radial-gradient(120% 80% at 50% 0%, #16161b, #0c0c0e 70%);color:#E9E7DF;font-family:'Space Grotesk',sans-serif;padding:78px 70px;position:relative}
  .brand{display:flex;align-items:center;gap:12px}.brand svg{width:30px;height:30px}.brand b{font-family:'IBM Plex Mono';letter-spacing:.24em;font-size:20px}
  .eyebrow{font-family:'IBM Plex Mono';letter-spacing:.18em;text-transform:uppercase;color:#C8F750;font-size:21px;margin:38px 0 10px}
  h1{font-family:'Anton';font-weight:400;font-size:74px;line-height:.94;letter-spacing:.5px;text-transform:uppercase;margin-bottom:8px}
  .sub{color:#a9a8a2;font-size:23px;margin-bottom:22px}
  .row{display:grid;grid-template-columns:64px 1fr 150px 64px;gap:18px;align-items:center;padding:12px 0;border-top:1px solid #1e1f23}
  .rk{font-family:'IBM Plex Mono';font-size:30px;font-weight:600;color:#75767d;text-align:center}
  .nm{font-size:29px;font-weight:600;color:#E9E7DF;display:flex;flex-direction:column}
  .ct{font-family:'IBM Plex Mono';font-size:16px;color:#75767d;font-weight:400;margin-top:2px}
  .bar{height:10px;background:#1a1a1f;border-radius:5px;overflow:hidden}.fill{height:100%;background:#C8F750;border-radius:5px}
  .sc{font-family:'IBM Plex Mono';font-size:26px;font-weight:600;color:#C8F750;text-align:right}
  .ftr{position:absolute;left:70px;right:70px;bottom:54px;display:flex;justify-content:space-between;font-family:'IBM Plex Mono';font-size:20px;color:#75767d}
  .ftr b{color:#C8F750}
  .note{position:absolute;left:70px;right:70px;bottom:96px;font-family:'IBM Plex Mono';font-size:15px;color:#5b5c63}
</style></head><body>
<div class="stage">
  <div class="brand">${MARK}<b>PEAKTIME</b></div>
  <div class="eyebrow">Club Index · Top 10</div>
  <h1>The most legendary<br>house destinations</h1>
  <div class="sub">Ranked on music integrity, heritage &amp; legendary sessions — not hype.</div>
  ${rows}
  <div class="note">Editorial index · north star = music integrity. Fame &amp; bottle service earn nothing.</div>
  <div class="ftr"><span>full 50 + club profiles</span><span><b>thedjrankings.com</b></span></div>
</div></body></html>`;

(async () => {
  const b = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  const pg = await b.newPage();
  await pg.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1 });
  await pg.setContent(html, { waitUntil: "load" });
  await pg.evaluate(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 500));
  await pg.screenshot({ path: path.join(OUT, "img", "club-index-top10.png") });
  await b.close();
  console.log("Wrote /reports/club-index/img/club-index-top10.png");
})();
