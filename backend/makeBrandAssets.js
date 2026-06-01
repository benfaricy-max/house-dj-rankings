// Renders square social brand assets (avatar + a sample post) as PNGs.
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const OUT_DIR = path.join(__dirname, "..", "frontend", "public", "brand");
fs.mkdirSync(OUT_DIR, { recursive: true });

const MARK = `
  <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
    <g fill="#C8F750">
      <rect x="5.5"  y="18.5" width="3.6" height="8"    rx="1.3"/>
      <rect x="11.2" y="13"   width="3.6" height="13.5" rx="1.3"/>
      <rect x="16.9" y="8"    width="3.6" height="18.5" rx="1.3"/>
      <rect x="22.6" y="4"    width="3.6" height="22.5" rx="1.3"/>
    </g>
  </svg>`;

const AVATAR = `<!doctype html><html><head><meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@600&display=swap');
  *{margin:0;box-sizing:border-box}
  html,body{width:1080px;height:1080px}
  .stage{width:1080px;height:1080px;background:#0c0c0e;display:flex;
    flex-direction:column;align-items:center;justify-content:center;gap:60px}
  .mark{width:520px;height:520px}
  .mark svg{width:100%;height:100%}
  .word{font-family:'IBM Plex Mono',monospace;font-weight:600;color:#E9E7DF;
    font-size:58px;letter-spacing:0.18em}
</style></head><body>
  <div class="stage">
    <div class="mark">${MARK}</div>
    <div class="word">THE DJ RANKINGS</div>
  </div>
</body></html>`;

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 1 });
  await page.setContent(AVATAR, { waitUntil: "networkidle0", timeout: 60000 });
  await new Promise(r => setTimeout(r, 400)); // let webfont settle
  const out = path.join(OUT_DIR, "avatar-1080.png");
  await page.screenshot({ path: out, type: "png" });
  console.log("Wrote", out);
  await browser.close();
})();
