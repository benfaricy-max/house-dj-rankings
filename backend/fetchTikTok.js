const delay = ms => new Promise(r => setTimeout(r, ms));

// Skip Puppeteer on Railway — same detection as fetchSpotifyScrape
const SKIP_PUPPETEER =
  process.env.SKIP_PUPPETEER === "true" ||
  !!process.env.RAILWAY_ENVIRONMENT ||
  !!process.env.RAILWAY_PROJECT_ID;

// Parse TikTok's abbreviated numbers: "223K" → 223000, "1.2M" → 1200000
function parseCount(str) {
  if (!str) return 0;
  const clean = str.replace(/,/g, "").trim();
  const num = parseFloat(clean);
  if (clean.endsWith("B")) return Math.round(num * 1_000_000_000);
  if (clean.endsWith("M")) return Math.round(num * 1_000_000);
  if (clean.endsWith("K")) return Math.round(num * 1_000);
  return Math.round(num) || 0;
}

let puppeteer = null;
let browser   = null;

function getPuppeteer() {
  if (!puppeteer) {
    try { puppeteer = require("puppeteer"); }
    catch { return null; }
  }
  return puppeteer;
}

async function getBrowser() {
  const p = getPuppeteer();
  if (!p) throw new Error("Puppeteer not installed");
  if (!browser || !browser.connected) {
    browser = await p.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
  }
  return browser;
}

async function getTikTokMentions(tiktokTag) {
  if (!tiktokTag || SKIP_PUPPETEER) return { tiktok_post_count: 0 };

  for (let attempt = 1; attempt <= 2; attempt++) {
    let page;
    try {
      page = await (await getBrowser()).newPage();
      await page.setUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
      );
      await page.goto(`https://www.tiktok.com/tag/${tiktokTag}`, {
        waitUntil: "domcontentloaded",
        timeout: 25000,
      });
      await page.waitForFunction(
        () => /\d[\d.,]*[KMB]?\s*posts/i.test(document.body.innerText),
        { timeout: 10000 }
      ).catch(() => {});

      const text = await page.evaluate(() => document.body.innerText);
      const match = text.match(/([\d.,]+[KMB]?)\s*posts/i);
      const tiktok_post_count = parseCount(match?.[1]);

      await page.close();
      await delay(1500);
      return { tiktok_post_count };
    } catch (err) {
      await page?.close().catch(() => {});
      if (attempt === 2) {
        console.warn(`[TikTok] Failed for #${tiktokTag}:`, err.message?.slice(0, 60));
        return { tiktok_post_count: 0 };
      }
      await delay(2000);
    }
  }
  return { tiktok_post_count: 0 };
}

process.on("exit", () => browser?.close());

module.exports = { getTikTokMentions };
