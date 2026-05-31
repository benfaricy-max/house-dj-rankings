// Renders the HTML deck to a PDF (dark theme, one slide per page, landscape).
const puppeteer = require("puppeteer");
const path = require("path");

const DECK = "file://" + path.join(__dirname, "..", "frontend", "public", "deck", "index.html");
const OUT  = path.join(__dirname, "..", "frontend", "public", "deck", "the-dj-rankings.pdf");

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  const page = await browser.newPage();
  await page.goto(DECK, { waitUntil: "networkidle0", timeout: 60000 });
  await page.emulateMediaType("print");
  await page.pdf({
    path: OUT,
    landscape: true,
    format: "A4",
    printBackground: true,
    margin: { top: "0", bottom: "0", left: "0", right: "0" },
  });
  await browser.close();
  console.log("PDF written:", OUT);
})();
