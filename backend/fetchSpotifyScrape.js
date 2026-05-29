const delay = ms => new Promise(r => setTimeout(r, ms));

// Skip headless Chrome on Railway (low-RAM containers) or if explicitly disabled.
// Railway automatically sets RAILWAY_ENVIRONMENT — no manual env var needed.
const SKIP_PUPPETEER =
  process.env.SKIP_PUPPETEER === "true" ||
  !!process.env.RAILWAY_ENVIRONMENT ||
  !!process.env.RAILWAY_PROJECT_ID;

let puppeteer = null;
let browser   = null;

function getPuppeteer() {
  if (!puppeteer) puppeteer = require("puppeteer");
  return puppeteer;
}

async function getBrowser() {
  if (!browser || !browser.connected) {
    browser = await getPuppeteer().launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
  }
  return browser;
}

async function scrapeMonthlyListeners(spotifyId) {
  if (SKIP_PUPPETEER) return 0;

  for (let attempt = 1; attempt <= 2; attempt++) {
    let page;
    try {
      page = await (await getBrowser()).newPage();
      await page.setUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
      );
      await page.goto(`https://open.spotify.com/artist/${spotifyId}`, {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      await page.waitForFunction(
        () => document.body.innerText.includes("monthly listeners"),
        { timeout: 12000 }
      );
      const text = await page.evaluate(() => document.body.innerText);
      const match = text.match(/([\d,]+)\s*monthly listeners/i);
      const listeners = parseInt(match?.[1]?.replace(/,/g, "") ?? "0", 10);
      await page.close();
      await delay(1200);
      return listeners;
    } catch (err) {
      await page?.close().catch(() => {});
      if (attempt === 2) {
        console.warn(`[Scrape] Failed for ${spotifyId}:`, err.message?.slice(0, 60));
        return 0;
      }
      await delay(2000);
    }
  }
  return 0;
}

process.on("exit", () => browser?.close());

module.exports = { scrapeMonthlyListeners };
