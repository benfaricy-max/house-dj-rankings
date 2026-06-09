/**
 * Diagnostic: surfaces RA data problems so ra_slug overrides can be added.
 * Two passes:
 *   1. MISMATCH AUDIT (static, instant) — artists that DO have an ra_slug but
 *      whose RA profile looks like the wrong namesake (a prominent act mapped to
 *      a near-empty RA profile). This is the class the presence-only check below
 *      can't see: a wrong-but-populated slug (e.g. "fisher" → Mike Fisher, 20
 *      followers, while the real FISHER is at "fisheroz"). No network calls.
 *   2. MISS FINDER (network) — artists with no ra_slug at all; tries slug
 *      variants against RA and prints suggestions.
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

// ── Pass 1: mismatch audit (static) ──────────────────────────────────────────
// A wrong-namesake slug resolves to a real-but-tiny RA profile: very few
// followers and/or ra_score 0, on an artist who is otherwise prominent (big
// streaming reach or a strong editorial scene score). Flag those for review.
const FOLLOWER_FLOOR = 100;     // RA profiles below this are almost always ghosts/namesakes
const LISTENERS_HINT = 1e6;     // "prominent" if ≥1M monthly listeners…
const SCENE_HINT     = 60;      // …or a hand-scored scene credibility ≥60
const suspects = d.rankings
  .filter(dj => dj.ra_slug)
  .map(dj => {
    const prominent = (dj.spotify_monthly_listeners || 0) >= LISTENERS_HINT
                   || (dj.manual_scene_score || 0) >= SCENE_HINT;
    const reasons = [];
    if ((dj.ra_followers || 0) < FOLLOWER_FLOOR) reasons.push(`only ${dj.ra_followers || 0} RA followers`);
    if (!dj.ra_score && prominent)               reasons.push(`ra_score 0 but prominent`);
    // High confidence: a prominent act sitting on a near-empty RA profile.
    const hot = prominent && (dj.ra_followers || 0) < FOLLOWER_FLOOR;
    return reasons.length ? { dj, reasons, hot } : null;
  })
  .filter(Boolean)
  .sort((a, b) => (b.hot - a.hot) || ((b.dj.spotify_monthly_listeners||0) - (a.dj.spotify_monthly_listeners||0)));

if (suspects.length) {
  console.log(`\n⚠️  MISMATCH AUDIT — ${suspects.length} artist(s) with a suspicious ra_slug (likely wrong namesake):\n`);
  for (const { dj, reasons, hot } of suspects) {
    const reach = dj.spotify_monthly_listeners ? `${(dj.spotify_monthly_listeners/1e6).toFixed(1)}M listeners` : "—";
    const scene = dj.manual_scene_score != null ? `scene ${dj.manual_scene_score}` : "scene —";
    console.log(`  ${hot ? "‼️ " : "•  "}${dj.name}  [slug="${dj.ra_slug}", ${reach}, ${scene}]  → ${reasons.join("; ")}`);
  }
  console.log(`\n  Fix: search RA for the correct profile and set ra_slug in artists.json, then re-run enrichRA (or targeted-apply).\n`);
} else {
  console.log("\n✅ MISMATCH AUDIT — no suspicious slugs.\n");
}

// ── Pass 2: miss finder (network) ─────────────────────────────────────────────
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
