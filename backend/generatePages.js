#!/usr/bin/env node
/**
 * generatePages.js — build-time prerender for SEO (Phase B).
 *
 * Runs AFTER `vite build`, operating on frontend/dist. For each artist it emits a
 * real static HTML file at /artist/<slug> and (when the artist has defensible fee
 * data) /value/<slug>, each with a unique <title>, meta description, canonical, OG
 * tags, baked above-the-fold content, and JSON-LD. Also writes 404.html (SPA
 * fallback) and a sitemap.xml listing exactly the pages that exist (no 404s).
 *
 * The SPA still owns interactivity: index uses createRoot().render(), which wipes
 * #root on mount, so the baked content is crawler-only — no hydration mismatch.
 *
 * READ-ONLY w.r.t. rankings.json (PERMANENT RULE #1): this never writes data.
 *
 * Fee honesty (CLAUDE.md): fees are model-implied. Value pages label bands as
 * "estimated" unless booking_fee.basis === "anchored" ("verified fee"), and never
 * present a number as a transacted price.
 *
 * Slug logic mirrors ArtistProfile.jsx `slugify` EXACTLY — keep in sync.
 */
const fs = require("fs");
const path = require("path");

const ORIGIN = "https://thedjrankings.com";
const DIST = path.join(__dirname, "..", "frontend", "dist");
const TEMPLATE = path.join(DIST, "index.html");
const DATA = path.join(DIST, "rankings.json"); // vite copies public/ → dist/

const slugify = (s) =>
  (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// ── meta / content helpers ──────────────────────────────────────────────────
const VERDICT = {
  "strong-buy": "is underpriced relative to current booking demand — and accelerating",
  buy: "is modestly underpriced relative to current booking demand",
  premium: "is priced above current booking demand",
  fair: "is priced broadly in line with current booking demand",
};

function artistMeta(a, total) {
  const r = Number.isFinite(a.rank) ? a.rank : null;
  const title = `${a.name} — Booking Demand & Ranking${r ? ` #${r}` : ""} | PEAKTIME`;
  const desc = `${a.name}${r ? ` ranks #${r} of ${total}` : ""} by booking demand on PEAKTIME — `
    + `scene credibility, Resident Advisor & Beatport signals, routing and streaming. Data, not hype.`;
  return { title, desc };
}

function valueMeta(a) {
  const verdict = VERDICT[a.value_signal] || "fair-value read";
  const title = `${a.name} Booking Fee — Fair Value Benchmark | PEAKTIME`;
  const desc = `What does it cost to book ${a.name}? A neutral, demand-led fair-value fee benchmark — `
    + `${a.name} ${verdict.replace(/—.*/, "").trim()}. Estimated tiers, not transacted prices. Data, not hype.`;
  return { title, desc: desc.replace(/\s+/g, " ").trim() };
}

// Baked, crawler-visible content (replaced by React on mount).
function artistBody(a, total) {
  const r = Number.isFinite(a.rank) ? a.rank : null;
  const signals = [
    ["Scene score", a.manual_scene_score],
    ["Live demand", a.live_demand_score],
    ["Beatport", a.beatport_score],
    ["Resident Advisor", a.ra_score],
    ["DJ support (1001TL)", a.tl_support_score],
    ["Momentum", a.momentum_score],
  ].filter(([, v]) => Number.isFinite(v));
  const tags = Array.isArray(a.scene_tags) ? a.scene_tags.slice(0, 8) : [];
  return `
    <main class="seo-prerender" style="max-width:720px;margin:0 auto;padding:24px;font-family:system-ui,sans-serif">
      <nav aria-label="Breadcrumb"><a href="/">PEAKTIME Rankings</a> › ${esc(a.name)}</nav>
      <h1>${esc(a.name)}</h1>
      ${r ? `<p><strong>#${r}</strong> of ${total} by booking demand.</p>` : ""}
      ${signals.length ? `<h2>Demand signals</h2><ul>${signals.map(([k, v]) => `<li>${esc(k)}: ${Math.round(v)}</li>`).join("")}</ul>` : ""}
      ${tags.length ? `<h2>Scene credentials</h2><p>${tags.map(esc).join(" · ")}</p>` : ""}
      ${Number.isFinite(a.value_gap) ? `<p><a href="/value/${slugify(a.name)}">How much does it cost to book ${esc(a.name)}? — Fair Value benchmark →</a></p>` : ""}
      <p><a href="/methodology">How the demand score is built</a></p>
    </main>`;
}

function valueBody(a) {
  const verdict = VERDICT[a.value_signal] || "Priced in line with demand";
  const fee = a.booking_fee || {};
  const band = fee.label || a.demand_fee_label || null;
  const verified = fee.basis === "anchored";
  const cities = (a.ra_recent_cities || []).map((c) => c.city).filter(Boolean).slice(0, 6);
  return `
    <main class="seo-prerender" style="max-width:720px;margin:0 auto;padding:24px;font-family:system-ui,sans-serif">
      <nav aria-label="Breadcrumb"><a href="/">PEAKTIME</a> › <a href="/artist/${slugify(a.name)}">${esc(a.name)}</a> › Fair value</nav>
      <h1>How much does it cost to book ${esc(a.name)}?</h1>
      <p>${esc(a.name)} ${esc(verdict)}.${band ? ` Fair-value benchmark: <strong>${esc(band)}</strong> (${verified ? "verified fee" : "estimated tier"}).` : ""}</p>
      ${Number.isFinite(a.demand_index) ? `<p>Demand index: ${Math.round(a.demand_index)} / 100${Number.isFinite(a.value_gap) ? `, value gap ${a.value_gap > 0 ? "+" : ""}${a.value_gap}` : ""}.</p>` : ""}
      ${cities.length ? `<h2>Recent routing</h2><p>${cities.map(esc).join(" · ")}</p>` : ""}
      <p><a href="/artist/${slugify(a.name)}">Full ${esc(a.name)} demand profile →</a> · <a href="/methodology">How this is calculated</a></p>
      <p style="color:#888;font-size:13px">Benchmark is demand-led and model-implied — an estimated tier, not a transacted price.</p>
    </main>`;
}

function breadcrumbLd(items) {
  return {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem", position: i + 1, name: it.name, item: ORIGIN + it.path,
    })),
  };
}

// ── template surgery ────────────────────────────────────────────────────────
function renderPage(tpl, { url, title, desc, jsonld, body }) {
  let html = tpl;
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`);
  html = html.replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(desc)}" />`);
  html = html.replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${esc(title)}" />`);
  html = html.replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${esc(desc)}" />`);
  html = html.replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${ORIGIN}${url}" />`);
  html = html.replace(/<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${esc(title)}" />`);
  html = html.replace(/<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${esc(desc)}" />`);
  const head = `    <link rel="canonical" href="${ORIGIN}${url}" />\n`
    + `    <script type="application/ld+json">${JSON.stringify(jsonld)}</script>\n  </head>`;
  html = html.replace("</head>", head);
  html = html.replace('<div id="root"></div>', `<div id="root">${body}</div>`);
  return html;
}

function writePage(relPath, html) {
  const full = path.join(DIST, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, html);
}

// ── indexation gates (defensible data only) ─────────────────────────────────
const artistIndexable = (a) => !!a.name && Number.isFinite(a.score);
const valueIndexable = (a) =>
  !!a.name && Number.isFinite(a.value_gap) && !!a.value_signal &&
  !!(a.booking_fee?.label || a.demand_fee_label);

function build() {
  if (!fs.existsSync(TEMPLATE)) { console.error("generatePages: dist/index.html missing — run vite build first."); process.exit(1); }
  const tpl = fs.readFileSync(TEMPLATE, "utf8");
  const d = JSON.parse(fs.readFileSync(DATA, "utf8"));
  const artists = (d.rankings || d).filter((a) => a && a.name);
  const total = artists.length;
  const today = new Date().toISOString().slice(0, 10);
  const urls = [{ loc: "/", priority: 1.0, changefreq: "daily", lastmod: today }];
  let nArtist = 0, nValue = 0;

  for (const a of artists) {
    const slug = slugify(a.name);
    if (!slug) continue;
    const lastmod = (a.value_gap_updated || a.timestamp || "").slice(0, 10) || today;

    if (artistIndexable(a)) {
      const { title, desc } = artistMeta(a, total);
      const jsonld = [
        { "@context": "https://schema.org", "@type": "MusicGroup", name: a.name, url: `${ORIGIN}/artist/${slug}`, genre: ["House", "Techno"] },
        breadcrumbLd([{ name: "Rankings", path: "/" }, { name: a.name, path: `/artist/${slug}` }]),
      ];
      writePage(`artist/${slug}.html`, renderPage(tpl, { url: `/artist/${slug}`, title, desc, jsonld, body: artistBody(a, total) }));
      urls.push({ loc: `/artist/${slug}`, priority: 0.7, changefreq: "weekly", lastmod });
      nArtist++;
    }

    if (valueIndexable(a)) {
      const { title, desc } = valueMeta(a);
      const fee = a.booking_fee || {};
      const band = fee.label || a.demand_fee_label;
      const answer = `${a.name} ${(VERDICT[a.value_signal] || "is priced in line with demand")}. `
        + `Fair-value benchmark: ${band} (${fee.basis === "anchored" ? "verified fee" : "estimated tier"}). `
        + `Demand-led and model-implied — an estimated tier, not a transacted price.`;
      const jsonld = [
        { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: [{
          "@type": "Question", name: `How much does it cost to book ${a.name}?`,
          acceptedAnswer: { "@type": "Answer", text: answer } }] },
        breadcrumbLd([{ name: "Rankings", path: "/" }, { name: a.name, path: `/artist/${slug}` }, { name: "Fair value", path: `/value/${slug}` }]),
      ];
      writePage(`value/${slug}.html`, renderPage(tpl, { url: `/value/${slug}`, title, desc, jsonld, body: valueBody(a) }));
      urls.push({ loc: `/value/${slug}`, priority: 0.8, changefreq: "weekly", lastmod });
      nValue++;
    }
  }

  // SPA fallback for any unmatched path (markets/clubs/blog still client-routed).
  fs.writeFileSync(path.join(DIST, "404.html"), tpl);

  // Sitemap — only pages that exist (all 200). markets/clubs/blog deferred to B.2.
  const xml = ['<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((u) => `  <url>\n    <loc>${ORIGIN}${u.loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority.toFixed(1)}</priority>\n  </url>`),
    "</urlset>", ""].join("\n");
  fs.writeFileSync(path.join(DIST, "sitemap.xml"), xml);

  console.log(`generatePages: ${nArtist} artist + ${nValue} value pages, 404.html, sitemap.xml (${urls.length} URLs).`);
}

build();
