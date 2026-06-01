/**
 * Diagnostic: shows which artists have no RA data after enrichRA.js runs.
 * For each miss, tries a few slug variants and prints suggestions.
 * Run: node backend/checkRASlugs.js
 * Then add ra_slug overrides to artists.json as needed.
 */
const fs   = require("fs");
const path = require("path");
const axios = require("axios");
const { generateSlug } = require("./fetchRA");

const RANKINGS = path.join(__dirname, "..", "frontend", "public", "rankings.json");
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36";

const d = JSON.parse(fs.readFileSync(RANKINGS, "utf8"));
const misses = d.rankings.filter(dj => dj.ra_updated && !dj.ra_slug);

async function trySlug(slug) {
  try {
    const r = await axios.post(
      "https://ra.co/graphql",
      { query: `{ artist(slug: "${slug}") { id name urlSafeName followerCount } }` },
      { headers: { "User-Agent": UA, "Referer": "https://ra.co/", "Content-Type": "application/json" }, timeout: 8000 }
    );
    return r.data?.data?.artist ?? null;
  } catch { return null; }
}

const delay = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  console.log(`Checking ${misses.length} artists with no RA match…\n`);
  for (const dj of misses) {
    const base = generateSlug(dj.name);
    // Try: base, base+"dj", base without numbers, first word only
    const variants = [
      base,
      base + "dj",
      base.replace(/\d/g, ""),
      base.split("").slice(0, Math.ceil(base.length * 0.7)).join(""),
    ].filter((v, i, a) => v.length > 2 && a.indexOf(v) === i);

    let found = null;
    for (const slug of variants) {
      const a = await trySlug(slug);
      if (a) { found = { slug, ...a }; break; }
      await delay(400);
    }
    if (found) {
      console.log(`  ${dj.name} → try ra_slug: "${found.slug}" (RA: "${found.name}", ${found.followerCount} followers)`);
    } else {
      console.log(`  ${dj.name} → not found on RA (tried: ${variants.join(", ")})`);
    }
    await delay(600);
  }
})();
