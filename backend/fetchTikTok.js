const puppeteer = require("puppeteer");

const delay = ms => new Promise(r => setTimeout(r, ms));

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

async function getTikTokMentions(tiktokTag) {
  if (!tiktokTag) return { tiktok_post_count: 0 };

  return enqueue(async () => {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const page = await (await getBrowser()).newPage();
      try {
        await page.setUserAgent(
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        );

        await page.goto(`https://www.tiktok.com/tag/${tiktokTag}`, {
          waitUntil: "domcontentloaded",
          timeout: 25000,
        });

        // Wait for post count to appear
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
        await page.close().catch(() => {});
        if (attempt === 2) {
          console.warn(`[TikTok] Failed for #${tiktokTag}:`, err.message?.slice(0, 60));
          return { tiktok_post_count: 0 };
        }
        await delay(2000);
      }
    }
  });
}

process.on("exit", () => browser?.close());

module.exports = { getTikTokMentions };
