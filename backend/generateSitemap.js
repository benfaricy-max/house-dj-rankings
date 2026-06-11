#!/usr/bin/env node
/**
 * generateSitemap.js — builds sitemap.xml from rankings.json.
 *
 * ⚠️ INERT BY DESIGN. Not wired into CI. Do NOT run/publish until the
 * prerender migration ships real per-page HTML — otherwise the sitemap lists
 * /artist/<slug> URLs that 404 today (hash routing serves only "/").
 * See docs/SEO-ARCHITECTURE.md for the ship order.
 *
 * After migration: `node backend/generateSitemap.js` → frontend/public/sitemap.xml,
 * then uncomment the Sitemap: line in robots.txt and add this step to refresh.yml.
 *
 * Slug logic mirrors frontend/src/ArtistProfile.jsx `slugify` and App.jsx
 * `citySlug` EXACTLY — keep in sync, or sitemap URLs won't match real routes.
 */
const fs = require("fs");
const path = require("path");

const ORIGIN = "https://thedjrankings.com";
const ROOT = path.join(__dirname, "..", "frontend", "public");
const OUT = path.join(ROOT, "sitemap.xml");

// EXACT mirror of slugify (ArtistProfile.jsx) — diacritics stripped, lowercased.
const slugify = (s) =>
  (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const citySlug = (c) =>
  (c || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

function loadRankings() {
  const d = JSON.parse(fs.readFileSync(path.join(ROOT, "rankings.json"), "utf8"));
  return d.rankings || d;
}

function urlEntry(loc, { changefreq = "weekly", priority = 0.6, lastmod } = {}) {
  return [
    "  <url>",
    `    <loc>${ORIGIN}${loc}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority.toFixed(1)}</priority>`,
    "  </url>",
  ].filter(Boolean).join("\n");
}

function build() {
  const artists = loadRankings();
  const today = new Date().toISOString().slice(0, 10);
  const seenMarkets = new Set();
  const seenClubs = new Set();
  const entries = [];

  // Static hubs
  entries.push(urlEntry("/", { changefreq: "daily", priority: 1.0, lastmod: today }));
  entries.push(urlEntry("/methodology", { changefreq: "monthly", priority: 0.5 }));
  entries.push(urlEntry("/blog", { changefreq: "weekly", priority: 0.5 }));

  for (const a of artists) {
    if (!a.name) continue;
    const slug = slugify(a.name);
    const lastmod = (a.timestamp || "").slice(0, 10) || today;
    // Artist profile + the high-intent fair-value/fee page
    entries.push(urlEntry(`/artist/${slug}`, { changefreq: "weekly", priority: 0.7, lastmod }));
    entries.push(urlEntry(`/value/${slug}`, { changefreq: "weekly", priority: 0.8, lastmod }));
    // Markets (best-effort from recent booking cities) — verify against prerender
    for (const c of a.ra_recent_cities || []) {
      const cs = citySlug(c.city);
      if (cs && !seenMarkets.has(cs)) { seenMarkets.add(cs); }
    }
    // Clubs (best-effort from RA top venues) — verify against prerender
    for (const v of a.ra_top_venues || []) {
      const name = typeof v === "string" ? v : (v.venue || v.name);
      const vs = slugify(name);
      if (vs && !seenClubs.has(vs)) { seenClubs.add(vs); }
    }
  }
  for (const cs of seenMarkets) entries.push(urlEntry(`/market/${cs}`, { changefreq: "weekly", priority: 0.6 }));
  for (const vs of seenClubs) entries.push(urlEntry(`/club/${vs}`, { changefreq: "monthly", priority: 0.6 }));

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entries.join("\n"),
    "</urlset>",
    "",
  ].join("\n");

  fs.writeFileSync(OUT, xml);
  console.log(`sitemap.xml written: ${entries.length} URLs (${artists.length} artists ×2 + ${seenMarkets.size} markets + ${seenClubs.size} clubs + 3 static)`);
}

build();
