const puppeteer = require("puppeteer");

const delay = ms => new Promise(r => setTimeout(r, ms));

// One browser instance, one page at a time — avoids detection and memory bloat
let queue = Promise.resolve();
function enqueue(fn) {
  queue = queue.then(fn);
  return queue;
}

let browser = null;

async function getBrowser() {
  if (!browser || !browser.connected) {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  return browser;
}

async function scrapeMonthlyListeners(spotifyId) {
  return enqueue(async () => {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const page = await (await getBrowser()).newPage();
      try {
        await page.setUserAgent(
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        );

        await page.goto(`https://open.spotify.com/artist/${spotifyId}`, {
          waitUntil: "domcontentloaded",
          timeout: 25000,
        });

        await page.waitForFunction(
          () => document.body.innerText.includes("monthly listeners"),
          { timeout: 15000 }
        );

        const text = await page.evaluate(() => document.body.innerText);
        const match = text.match(/([\d,]+)\s*monthly listeners/i);
        const monthly_listeners = parseInt(match?.[1]?.replace(/,/g, "") ?? "0", 10);

        await page.close();
        await delay(1200);
        return monthly_listeners;
      } catch (err) {
        await page.close().catch(() => {});
        if (attempt === 2) {
          console.warn(`[Scrape] Failed for ${spotifyId}:`, err.message?.slice(0, 60));
          return 0;
        }
        await delay(2000); // wait before retry
      }
    }
  });
}

process.on("exit", () => browser?.close());

module.exports = { scrapeMonthlyListeners };
