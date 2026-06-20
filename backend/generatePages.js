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

// ── entity / E-E-A-T constants ───────────────────────────────────────────────
// Named editor + publisher entity. EDITOR is the human E-E-A-T signal Google
// weights on commercial-data pages; it's emitted standalone on /about and nested
// as the Organization `founder` on the homepage + trust pages. No sameAs: we link
// no unverified profiles (same honesty as the homepage Organization). Contact reuses
// the site's existing hello@ forwarding alias (already live on Namecheap) — swap
// CONTACT_EMAIL if a dedicated editorial@ alias is added later.
const CONTACT_EMAIL = "benfaricy@gmail.com";
const EDITOR = {
  "@type": "Person", name: "Ben Faricy", jobTitle: "Founder & Editor",
  url: `${ORIGIN}/about`, email: `mailto:${CONTACT_EMAIL}`,
  worksFor: { "@type": "Organization", name: "PEAKTIME", url: `${ORIGIN}/` },
  description: "Founder and editor of PEAKTIME, the booking-demand index for house and techno.",
};
const ORG_NODE = {
  "@type": "Organization", name: "PEAKTIME", alternateName: "The DJ Rankings",
  url: `${ORIGIN}/`, logo: `${ORIGIN}/brand/avatar-1080.png`,
  email: `mailto:${CONTACT_EMAIL}`, founder: EDITOR,
 description: "PEAKTIME is the demand index for electronic music, multi-signal rankings of "
    + "house and techno DJs by booking demand. Independent; not a booking agency.",
};
const withCtx = (node) => ({ "@context": "https://schema.org", ...node });

// ── meta / content helpers ──────────────────────────────────────────────────
const VERDICT = {
 "strong-buy": "is underpriced relative to current booking demand: and accelerating",
  buy: "is modestly underpriced relative to current booking demand",
  premium: "is priced above current booking demand",
  fair: "is priced broadly in line with current booking demand",
};

function artistMeta(a, total) {
  const r = Number.isFinite(a.rank) ? a.rank : null;
 const title = `${a.name}, Booking Demand & Ranking${r ? ` #${r}` : ""} | PEAKTIME`;
 const desc = `${a.name}${r ? ` ranks #${r} of ${total}` : ""} by booking demand on PEAKTIME, `
    + `scene credibility, Resident Advisor & Beatport signals, routing and streaming. Data, not hype.`;
  return { title, desc };
}

function valueMeta(a) {
  const verdict = VERDICT[a.value_signal] || "fair-value read";
 const title = `${a.name} Booking Fee, Fair Value Benchmark | PEAKTIME`;
 const desc = `What does it cost to book ${a.name}? A neutral, demand-led fair-value fee benchmark, `
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
 ${Number.isFinite(a.value_gap) ? `<p><a href="/value/${slugify(a.name)}">How much does it cost to book ${esc(a.name)}?, Fair Value benchmark →</a></p>` : ""}
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
 <p style="color:#888;font-size:13px">Benchmark is demand-led and model-implied: an estimated tier, not a transacted price.</p>
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

// ── homepage (crawler-visible + first-paint) ────────────────────────────────
function homeMeta() {
  return {
 title: "PEAKTIME: The DJ Rankings | Demand index for electronic music",
 desc: "PEAKTIME is the demand index for electronic music, multi-signal rankings of "
      + "house and techno DJs across streams, Beatport charts, tours, search and social "
      + "velocity. Before the industry catches on.",
  };
}

// Organization + WebSite (SearchAction) + Dataset + ItemList entity schema for the
// homepage. sameAs omitted deliberately — no verified social profiles on file.
// The ItemList exposes the ranking as a machine-readable ORDERED list (position +
// artist), which is what answer engines (ChatGPT/Perplexity/AI Overviews) parse into
// "the #1 most in-demand techno DJ is X". `dateModified` advertises the daily refresh
// — AI engines preferentially cite fresh sources, and a daily-updated ranking beats a
// stale listicle. `lastUpdated` comes from rankings.json (generateStatic); falls back to today.
function homeJsonLd(artists = [], total = 0, lastUpdated = "") {
  const modified = (lastUpdated || new Date().toISOString()).slice(0, 10);
  const ranked = artists
    .filter((a) => a.name && Number.isFinite(a.score))
    .sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9))
    .slice(0, 25);
  const itemList = {
    "@context": "https://schema.org", "@type": "ItemList",
 name: "PEAKTIME DJ Booking-Demand Index: Top 25",
    description: "House and techno DJs ranked by booking demand, refreshed daily.",
    url: `${ORIGIN}/`, numberOfItems: total,
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    itemListElement: ranked.map((a, i) => {
      const slug = slugify(a.name);
      return { "@type": "ListItem", position: Number.isFinite(a.rank) ? a.rank : i + 1,
        url: `${ORIGIN}/artist/${slug}`,
        item: { "@type": "MusicGroup", name: a.name, url: `${ORIGIN}/artist/${slug}` } };
    }),
  };
  return [
    { "@context": "https://schema.org", "@type": "Organization", name: "PEAKTIME",
      alternateName: "The DJ Rankings", url: `${ORIGIN}/`, logo: `${ORIGIN}/brand/avatar-1080.png`,
      founder: EDITOR, email: `mailto:${CONTACT_EMAIL}`,
 description: "PEAKTIME is the demand index for electronic music, multi-signal rankings of "
        + "house and techno DJs across streams, Beatport charts, tours, search and social velocity." },
    { "@context": "https://schema.org", "@type": "WebSite", name: "PEAKTIME", url: `${ORIGIN}/`,
      potentialAction: { "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: `${ORIGIN}/?q={search_term_string}` },
        "query-input": "required name=search_term_string" } },
    { "@context": "https://schema.org", "@type": "Dataset",
      name: "PEAKTIME DJ Booking-Demand Index", url: `${ORIGIN}/`,
      description: "A multi-signal ranking of house and techno DJs by booking demand, combining "
        + "streams, Beatport and Resident Advisor signal, touring activity, search interest and social velocity.",
      creator: { "@type": "Organization", name: "PEAKTIME" }, isAccessibleForFree: true,
      dateModified: modified,
      keywords: ["DJ rankings", "booking demand", "house music", "techno", "electronic music", "demand index"] },
    itemList,
  ];
}

// Top-N ranking rows baked as static HTML, mirroring the live .dj-* layout so the
// createRoot() re-render swaps in without a visible reflow. Crawler-visible content +
// the homepage's only internal links to artist pages (the SPA list isn't crawlable).
function homeBody(artists, total, lastUpdated = "", n = 25) {
  const updated = new Date((lastUpdated || new Date().toISOString()))
    .toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const ranked = artists
    .filter((a) => a.name && Number.isFinite(a.score))
    .sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9))
    .slice(0, n);
  const rows = ranked.map((a, i) => {
    const slug = slugify(a.name);
    const r = Number.isFinite(a.rank) ? a.rank : i + 1;
    const avatar = a.image
      ? `<div class="dj-avatar-wrap"><img src="${esc(a.image)}" alt="${esc(a.name)}" class="dj-avatar" loading="lazy" decoding="async" width="44" height="44" /></div>`
      : `<div class="dj-avatar-wrap"><div class="dj-avatar dj-avatar--placeholder">${esc(a.name[0])}</div></div>`;
    return `<li class="dj-card-main">`
      + `<div class="dj-rank"><span class="rank-num">#${r}</span></div>`
      + avatar
      + `<div class="dj-info"><div class="dj-name-row">`
      + `<span class="dj-name"><a href="/artist/${slug}">${esc(a.name)}</a></span>`
      + `<span class="dj-score-badge">${Math.round(a.score)} pts</span>`
      + `</div></div></li>`;
  }).join("");
  return `
    <main class="seo-prerender" style="max-width:760px;margin:0 auto;padding:24px;font-family:system-ui,sans-serif">
 <h1>PEAKTIME, the demand index for electronic music</h1>
 <p>Multi-signal rankings of house and techno DJs by booking demand: streams, Beatport
        charts, Resident Advisor signal, touring and search velocity. Before the industry catches on.</p>
      <p class="seo-updated" style="color:#75767d;font-size:13px">Ranking of ${total} DJs · updated daily · last updated ${esc(updated)}</p>
      <h2>Top ${ranked.length} by booking demand</h2>
      <ol class="dj-list-prerender" style="list-style:none;padding:0">${rows}</ol>
      <nav class="seo-cuts" aria-label="Ranking cuts">
        <h2>Explore the rankings</h2>
        <ul>
          <li><a href="/rankings/techno">Most in-demand techno DJs</a></li>
          <li><a href="/rankings/house">Most in-demand house DJs</a></li>
          <li><a href="/rankings/rising">Fastest-rising DJs (momentum)</a></li>
          <li><a href="/rankings/value">Most underpriced DJs to book</a></li>
        </ul>
      </nav>
      <nav class="seo-scenes" aria-label="Scenes">
        <h2>By scene</h2>
        <ul>
          <li><a href="/scene/berlin">DJs booked in Berlin</a></li>
          <li><a href="/scene/london">DJs booked in London</a></li>
          <li><a href="/scene/amsterdam">DJs booked in Amsterdam</a></li>
          <li><a href="/scene/ibiza">DJs booked in Ibiza</a></li>
          <li><a href="/scene/new-york">DJs booked in New York</a></li>
        </ul>
      </nav>
      <p><a href="/methodology">How the demand score is built</a> · <a href="/about">About PEAKTIME</a> · <a href="/about/editorial-policy">Editorial policy</a> · <a href="/about/corrections">Corrections</a></p>
    </main>`;
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

// ── club pages (prerendered from clubsData + CLUB_PROFILES) ──────────────────
function clubMeta(c, total) {
 const title = `${c.name}, ${c.city} Club Profile & Ranking #${c.rank} | PEAKTIME`;
  const desc = `${c.name} in ${c.city}, ${c.country} ranks #${c.rank} of ${total} on PEAKTIME's `
    + `music-integrity Club Index. ${c.note}`;
  return { title, desc: desc.replace(/\s+/g, " ").slice(0, 300) };
}

function clubBody(c, p, total) {
  const sec = (title, body) => body ? `<h2>${esc(title)}</h2><p>${esc(body)}</p>` : "";
  return `
    <main class="seo-prerender" style="max-width:720px;margin:0 auto;padding:24px;font-family:system-ui,sans-serif">
      <nav aria-label="Breadcrumb"><a href="/">PEAKTIME</a> › Club Index › ${esc(c.name)}</nav>
      <h1>${esc(c.name)}</h1>
      <p><strong>#${c.rank}</strong> of ${total} on the PEAKTIME Club Index · ${esc(c.city)}, ${esc(c.country)} · est. ${c.opened} · index score ${c.score}/100.</p>
      <p>${esc(c.note)}</p>
      ${p ? sec("The room", p.lore) : ""}
      ${p ? sec("Reputation", p.reputation) : ""}
      ${p ? sec("What makes it singular", p.unique) : ""}
      ${p && p.residencies ? `<h2>Signature nights</h2><p>${esc(p.residencies)}</p>` : ""}
      ${p && p.iconicSets ? `<h2>Iconic sets</h2><p>${esc(p.iconicSets)}</p>` : ""}
      ${p && p.capacity ? `<p>Capacity: ${esc(p.capacity)}${p.founders ? ` · Origin: ${esc(p.founders)}` : ""}</p>` : ""}
      <p><a href="/">← PEAKTIME rankings</a> · <a href="/methodology">How clubs are scored</a></p>
    </main>`;
}

function clubJsonLd(c, slug) {
  return [
    { "@context": "https://schema.org", "@type": "NightClub", name: c.name,
      address: { "@type": "PostalAddress", addressLocality: c.city, addressCountry: c.country },
      foundingDate: String(c.opened), description: c.note, url: `${ORIGIN}/club/${slug}` },
    breadcrumbLd([{ name: "PEAKTIME", path: "/" }, { name: c.name, path: `/club/${slug}` }]),
  ];
}

// ── Ranking landing pages (/rankings/<cut>) ─────────────────────────────────
// Standalone, branded, static SEO/AEO pages that own the head-on query space
// ("best techno DJs", "rising house DJs", "underpriced DJs to book"). Built as
// self-contained HTML (NOT the SPA #root template) because the SPA has no
// /rankings/* route — standalone avoids any hydration/routing mismatch and gives
// crawlers a fully-rendered, text-rich page. Each ships ItemList (the ranking as a
// machine-readable ordered list, for AI answer engines) + FAQPage (the literal
// questions users ask assistants) + BreadcrumbList + a CollectionPage carrying
// dateModified (advertises the daily refresh). Light theme matches the published reports.
function landingRows(ranked) {
  return ranked.map((a, i) => {
    const slug = slugify(a.name);
    const lean = a._lean ? `<span class="g g-${a._lean}">${a._lean}</span>` : "";
    const metric = a._metric != null ? `<td class="num muted">${esc(String(a._metric))}</td>` : `<td class="num muted">${Math.round(a.score)}</td>`;
    return `<tr>
      <td class="num rk">#${i + 1}</td>
      <td><a href="/artist/${slug}">${esc(a.name)}</a> ${lean}</td>
      ${metric}
    </tr>`;
  }).join("\n");
}

function renderLanding({ slug, h1, lede, metricLabel, faq, ranked, total, lastUpdated }) {
  const modified = (lastUpdated || new Date().toISOString()).slice(0, 10);
  const updatedHuman = new Date(lastUpdated || new Date().toISOString())
    .toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const url = `${ORIGIN}/rankings/${slug}`;
  const top = ranked.slice(0, 50);
 const title = `${h1}, ${updatedHuman} | PEAKTIME`;
 const desc = `${lede} Ranked by booking demand on PEAKTIME, updated daily. ${total} acts tracked.`.replace(/\s+/g, " ").trim();

  const itemList = {
    "@context": "https://schema.org", "@type": "ItemList", name: h1, url,
    numberOfItems: top.length, itemListOrder: "https://schema.org/ItemListOrderDescending",
    itemListElement: top.map((a, i) => {
      const s = slugify(a.name);
      return { "@type": "ListItem", position: i + 1, url: `${ORIGIN}/artist/${s}`,
        item: { "@type": "MusicGroup", name: a.name, url: `${ORIGIN}/artist/${s}` } };
    }),
  };
  const faqLd = { "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a } })) };
  const collectionLd = { "@context": "https://schema.org", "@type": "CollectionPage",
    name: h1, url, description: desc, dateModified: modified, isPartOf: { "@type": "WebSite", name: "PEAKTIME", url: `${ORIGIN}/` } };
  const crumbs = breadcrumbLd([{ name: "Rankings", path: "/" }, { name: h1, path: `/rankings/${slug}` }]);
  const jsonld = [collectionLd, itemList, faqLd, crumbs];

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<link rel="canonical" href="${url}" />
<meta property="og:title" content="${esc(h1)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:url" content="${url}" />
<meta property="og:type" content="website" />
<meta property="og:image" content="${ORIGIN}/brand/post-top5-1080.png" />
<meta name="twitter:card" content="summary_large_image" />
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
<style>
  :root { --ink:#15151c; --muted:#6b6b78; --line:#e7e7ee; --accent:#3b3bdb; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:-apple-system,"Segoe UI",Inter,Arial,sans-serif; color:var(--ink); background:#f3f3f6; padding:28px; }
  .page { max-width:820px; margin:0 auto; background:#fff; border-radius:14px; box-shadow:0 6px 30px rgba(0,0,0,.08); overflow:hidden; }
  .top { background:linear-gradient(120deg,#15151c,#23233a); color:#fff; padding:24px 34px; display:flex; justify-content:space-between; align-items:center; }
  .brand { font-size:12px; letter-spacing:.18em; color:#a8e00f; font-weight:700; }
  .doc-title { font-size:13px; color:#aaa; margin-top:2px; }
  .top .date { font-size:12px; color:#9a9aac; text-align:right; }
  .hero { padding:26px 34px 18px; border-bottom:1px solid var(--line); }
  .hero h1 { font-size:28px; line-height:1.12; }
  .hero .sub { color:var(--muted); font-size:14.5px; margin-top:10px; max-width:60ch; line-height:1.5; }
  .hero .upd { color:var(--muted); font-size:12.5px; margin-top:10px; }
  .section { padding:20px 34px; border-bottom:1px solid var(--line); }
  .section h2 { font-size:12px; text-transform:uppercase; letter-spacing:.1em; color:var(--muted); margin-bottom:14px; }
  table { width:100%; border-collapse:collapse; font-size:14px; }
  th { text-align:left; color:var(--muted); font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:.05em; padding:6px 8px; border-bottom:1px solid var(--line); }
  td { padding:7px 8px; border-bottom:1px solid #f1f1f5; }
  td.num, th.num { text-align:right; font-variant-numeric:tabular-nums; }
  td.rk { font-weight:700; width:52px; }
  td.muted, .muted { color:var(--muted); }
  a { color:var(--accent); text-decoration:none; } a:hover { text-decoration:underline; }
  .g { font-size:10px; text-transform:uppercase; letter-spacing:.04em; padding:1px 6px; border-radius:10px; margin-left:6px; vertical-align:middle; }
  .g-house { background:#eef7d6; color:#5b7a00; } .g-techno { background:#efe7ff; color:#6a3bdb; } .g-crossover { background:#e0f7fb; color:#1d8fa0; }
  .faq dt { font-weight:700; font-size:14.5px; margin-top:14px; }
  .faq dd { color:#333; font-size:14px; line-height:1.55; margin-top:5px; }
  .foot { padding:16px 34px; font-size:12px; color:var(--muted); display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px; }
  .foot b { color:#15151c; }
  @media (max-width:560px){ body{padding:12px;} .top,.hero,.section,.foot{padding-left:18px;padding-right:18px;} }
</style>
</head>
<body>
<div class="page">
  <div class="top">
    <div><div class="brand">THE DJ RANKINGS</div><div class="doc-title">PEAKTIME · demand index</div></div>
    <div class="date">Updated daily<br/>${esc(updatedHuman)}</div>
  </div>
  <div class="hero">
    <h1>${esc(h1)}</h1>
 <p class="sub">${esc(lede)} Ranked by booking demand: scene credibility, Resident Advisor &amp; Beatport signal, touring, search and social velocity.</p>
    <p class="upd">${top.length} acts · refreshed daily · last updated ${esc(updatedHuman)} · <a href="/">see the full live index →</a></p>
  </div>
  <div class="section">
    <h2>Ranked by booking demand</h2>
    <table>
      <thead><tr><th class="num">#</th><th>Artist</th><th class="num">${esc(metricLabel)}</th></tr></thead>
      <tbody>
${landingRows(top)}
      </tbody>
    </table>
  </div>
  <div class="section faq">
    <h2>Frequently asked</h2>
    <dl>
${faq.map((f) => `      <dt>${esc(f.q)}</dt>\n      <dd>${esc(f.a)}</dd>`).join("\n")}
    </dl>
  </div>
  <div class="foot">
 <span><b>PEAKTIME</b> · thedjrankings.com, the demand index for electronic music</span>
    <span><a href="/methodology">How the demand score is built →</a></span>
  </div>
</div>
</body>
</html>
`;
}

// Shared standalone-page shell (light theme, branded) for /compare and /scene pages,
// same look as the ranking landings + reports. jsonld is an array; inner is body HTML.
const STANDALONE_CSS = `
  :root { --ink:#15151c; --muted:#6b6b78; --line:#e7e7ee; --accent:#3b3bdb; --win:#1a8f4c; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:-apple-system,"Segoe UI",Inter,Arial,sans-serif; color:var(--ink); background:#f3f3f6; padding:28px; }
  .page { max-width:820px; margin:0 auto; background:#fff; border-radius:14px; box-shadow:0 6px 30px rgba(0,0,0,.08); overflow:hidden; }
  .top { background:linear-gradient(120deg,#15151c,#23233a); color:#fff; padding:24px 34px; display:flex; justify-content:space-between; align-items:center; }
  .brand { font-size:12px; letter-spacing:.18em; color:#a8e00f; font-weight:700; }
  .doc-title { font-size:13px; color:#aaa; margin-top:2px; }
  .top .date { font-size:12px; color:#9a9aac; text-align:right; }
  .hero { padding:26px 34px 18px; border-bottom:1px solid var(--line); }
  .hero h1 { font-size:27px; line-height:1.12; }
  .hero .sub { color:var(--muted); font-size:14.5px; margin-top:10px; max-width:62ch; line-height:1.5; }
  .hero .upd { color:var(--muted); font-size:12.5px; margin-top:10px; }
  .section { padding:20px 34px; border-bottom:1px solid var(--line); }
  .section h2 { font-size:12px; text-transform:uppercase; letter-spacing:.1em; color:var(--muted); margin-bottom:14px; }
  table { width:100%; border-collapse:collapse; font-size:14px; }
  th { text-align:left; color:var(--muted); font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:.05em; padding:6px 8px; border-bottom:1px solid var(--line); }
  td { padding:7px 8px; border-bottom:1px solid #f1f1f5; }
  td.num, th.num { text-align:right; font-variant-numeric:tabular-nums; }
  td.rk { font-weight:700; width:52px; }
  td.muted, .muted { color:var(--muted); }
  td.win { font-weight:700; color:var(--win); }
  a { color:var(--accent); text-decoration:none; } a:hover { text-decoration:underline; }
  .faq dt { font-weight:700; font-size:14.5px; margin-top:14px; }
  .faq dd { color:#333; font-size:14px; line-height:1.55; margin-top:5px; }
  .foot { padding:16px 34px; font-size:12px; color:var(--muted); display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px; }
  .foot b { color:#15151c; }
  @media (max-width:560px){ body{padding:12px;} .top,.hero,.section,.foot{padding-left:18px;padding-right:18px;} }`;

function pageShell({ title, desc, canonical, ogImage, jsonld, docTitle, updatedHuman, inner }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<link rel="canonical" href="${canonical}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:url" content="${canonical}" />
<meta property="og:type" content="website" />
<meta property="og:image" content="${ORIGIN}${ogImage}" />
<meta name="twitter:card" content="summary_large_image" />
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
<style>${STANDALONE_CSS}</style>
</head>
<body>
<div class="page">
  <div class="top">
    <div><div class="brand">THE DJ RANKINGS</div><div class="doc-title">${esc(docTitle)}</div></div>
    <div class="date">Updated daily<br/>${esc(updatedHuman)}</div>
  </div>
${inner}
  <div class="foot">
 <span><b>PEAKTIME</b> · thedjrankings.com, the demand index for electronic music</span>
    <span><a href="/methodology">How the demand score is built →</a></span>
  </div>
</div>
</body>
</html>
`;
}

// Dark shell for the trust pages — matches the live SPA's dark theme (near-black
// #0c0c0e, acid-lime #C8F750 accents, Space Grotesk) rather than the light report
// look of pageShell. Same class structure as pageShell so the trust renderers'
// inner markup works unchanged. Kept separate so /compare and /scene stay light.
function darkShell({ title, desc, canonical, ogImage, jsonld, docTitle, updatedHuman, inner }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="theme-color" content="#0c0c0e" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<link rel="canonical" href="${canonical}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:url" content="${canonical}" />
<meta property="og:type" content="website" />
<meta property="og:image" content="${ORIGIN}${ogImage}" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet" />
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
<style>
  :root { --bg:#0c0c0e; --card:#111114; --ink:#E9E7DF; --text:#a9a8a2; --muted:#8a8b92; --line:#1e1f23; --accent:#C8F750; --accent-bg:rgba(200,247,80,.10); }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Space Grotesk',system-ui,sans-serif; color:var(--text); background:var(--bg); padding:28px; }
  .page { max-width:820px; margin:0 auto; background:var(--card); border:1px solid var(--line); border-radius:14px; overflow:hidden; }
  .top { background:#08080a; border-bottom:1px solid var(--line); padding:22px 34px; display:flex; justify-content:space-between; align-items:center; }
  .brand { font-size:12px; letter-spacing:.18em; color:var(--accent); font-weight:700; }
  .doc-title { font-size:13px; color:var(--muted); margin-top:2px; }
  .top .date { font-size:12px; color:var(--muted); text-align:right; }
  .hero { padding:30px 34px 22px; border-bottom:1px solid var(--line); }
  .hero h1 { font-size:30px; line-height:1.12; color:var(--accent); font-weight:700; }
  .hero .sub { color:var(--text); font-size:15px; margin-top:12px; max-width:64ch; line-height:1.6; }
  .hero .upd { color:var(--muted); font-size:12.5px; margin-top:12px; }
  .section { padding:22px 34px; border-bottom:1px solid var(--line); }
  .section h2 { font-size:12px; text-transform:uppercase; letter-spacing:.1em; color:var(--accent); margin-bottom:14px; font-weight:700; }
  .section p { color:var(--text); font-size:14.5px; line-height:1.65; margin-bottom:10px; }
  .section p strong, .section strong { color:var(--ink); }
  a { color:var(--accent); text-decoration:none; } a:hover { text-decoration:underline; }
  .faq dt { font-weight:700; font-size:14.5px; margin-top:14px; color:var(--ink); }
  .faq dd { color:var(--text); font-size:14px; line-height:1.6; margin-top:5px; }
  .foot { padding:16px 34px; font-size:12px; color:var(--muted); display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px; }
  .foot b { color:var(--ink); }
  @media (max-width:560px){ body{padding:12px;} .top,.hero,.section,.foot{padding-left:18px;padding-right:18px;} }
</style>
</head>
<body>
<div class="page">
  <div class="top">
    <div><div class="brand">THE DJ RANKINGS</div><div class="doc-title">${esc(docTitle)}</div></div>
    <div class="date">Updated daily<br/>${esc(updatedHuman)}</div>
  </div>
${inner}
  <div class="foot">
    <span><b>PEAKTIME</b> · thedjrankings.com — the demand index for electronic music</span>
    <span><a href="/methodology">How the demand score is built →</a></span>
  </div>
</div>
</body>
</html>
`;
}

// ── Trust pages (E-E-A-T): /about, /about/editorial-policy, /about/corrections ─
// Static, dark-themed (darkShell, matches the live site), indexable. They carry the
// named editor + publisher entity and state independence, fee honesty, the never-wipe
// data rule, and how to report errors — the trust signals Google weights on
// commercial-data pages. Built standalone (no SPA route needed) and listed in the sitemap.
function renderAbout(updatedHuman) {
  const url = `${ORIGIN}/about`;
 const title = "About PEAKTIME | The booking-demand index for house & techno";
 const desc = "PEAKTIME is an independent, daily booking-demand index for house and techno DJs, "
    + "founded and edited by Ben Faricy. Not a booking agency. Data, not hype.";
  const jsonld = [
    withCtx({ "@type": "AboutPage", name: title, url, description: desc, about: ORG_NODE }),
    withCtx(EDITOR),
    breadcrumbLd([{ name: "PEAKTIME", path: "/" }, { name: "About", path: "/about" }]),
  ];
  const inner = `  <div class="hero">
    <h1>About PEAKTIME</h1>
 <p class="sub">PEAKTIME is the booking-demand index for house and techno: a daily, multi-signal read on which DJs are in demand, built for the people who book and sell them. Data, not hype.</p>
    <p class="upd">Independent · refreshed daily · last updated ${esc(updatedHuman)}</p>
  </div>
  <div class="section">
    <h2>What this is</h2>
 <p>Most DJ rankings measure popularity: followers, streams, fan votes. PEAKTIME measures booking demand: how often and how widely an act is booked, and how their scene credibility, chart, touring and search signals move. It is refreshed every day. The aim is a neutral benchmark that both sides of a booking, the agent selling and the promoter buying, can cite.</p>
  </div>
  <div class="section">
    <h2>Who is behind it</h2>
 <p>PEAKTIME is founded and edited by <strong>Ben Faricy</strong>. The index, its methodology and the editorial reports are produced independently. PEAKTIME is not a booking agency and does not represent, manage or sell any artist, so the demand read has no commercial stake in the outcome.</p>
    <p>Editorial and corrections: <a href="mailto:${esc(CONTACT_EMAIL)}">${esc(CONTACT_EMAIL)}</a>.</p>
  </div>
  <div class="section">
    <h2>How it is built</h2>
 <p>Every ranking blends independent demand signals: live booking (Resident Advisor venue tier, attendance and touring), editorial scene credibility, Beatport chart credibility, 1001Tracklists DJ support, search interest and social velocity, into a single demand score. The full method is public.</p>
    <p><a href="/methodology">How the demand score is built →</a> · <a href="/about/editorial-policy">Editorial policy →</a> · <a href="/about/corrections">Corrections →</a></p>
  </div>`;
  return darkShell({ title, desc, canonical: url, ogImage: "/brand/avatar-1080.png",
    jsonld, docTitle: "PEAKTIME · about", updatedHuman, inner });
}

function renderEditorialPolicy(updatedHuman, modified) {
  const url = `${ORIGIN}/about/editorial-policy`;
 const title = "Editorial Policy | PEAKTIME";
  const desc = "How PEAKTIME stays independent: no pay-to-rank, model-implied fee benchmarks "
    + "(not transacted prices), a strict never-wipe data rule, and a published methodology.";
  const jsonld = [
    withCtx({ "@type": "WebPage", name: title, url, description: desc,
      lastReviewed: modified, publisher: ORG_NODE,
      mainEntityOfPage: { "@type": "WebPage", "@id": url } }),
    withCtx(EDITOR),
    breadcrumbLd([{ name: "PEAKTIME", path: "/" }, { name: "About", path: "/about" }, { name: "Editorial policy", path: "/about/editorial-policy" }]),
  ];
  const inner = `  <div class="hero">
    <h1>Editorial policy</h1>
    <p class="sub">PEAKTIME exists to be a neutral, citeable read on booking demand. These are the rules that keep it that way.</p>
    <p class="upd">Maintained by Ben Faricy, Founder &amp; Editor · last reviewed ${esc(updatedHuman)}</p>
  </div>
  <div class="section">
    <h2>Independence</h2>
 <p>PEAKTIME is not a booking agency and does not represent, manage or sell any artist, venue or festival. We take no payment to add, rank, raise or remove an act. Rankings are produced from data on a published method, they cannot be bought.</p>
  </div>
  <div class="section">
    <h2>How rankings are produced</h2>
    <p>Each act is scored on the same blend of independent demand signals, refreshed daily, and normalised across the whole field. The weights and rubric are public and dated. We change the model when the data or our review of it justifies it, and we note material changes.</p>
    <p><a href="/methodology">Read the full methodology →</a></p>
  </div>
  <div class="section">
    <h2>How we handle booking fees</h2>
 <p>PEAKTIME holds no transacted fees. Fee figures are <strong>model-implied estimates</strong>, derived from demand signals or hand-tiered, and are labelled as estimated tiers, never as a quoted or contracted price. The "Value Gap" compares an act's demand against that estimate; it is a benchmark, not an offer. Where a real, sourced fee has been verified it is labelled as such. If you can confirm or correct a fee, tell us.</p>
  </div>
  <div class="section">
    <h2>Data integrity</h2>
    <p>A fabricated or wiped statistic is the one thing that would break a "data, not hype" index, so the pipeline is built to never do it: a failed or empty data fetch keeps the last known good value rather than overwriting it, and obviously broken figures are suppressed rather than shown. We would rather show nothing than show a number we do not trust.</p>
  </div>
  <div class="section">
    <h2>Freshness &amp; conflicts</h2>
    <p>The index is a point-in-time reading, refreshed daily, with the last-updated date shown on every page. Booking demand is seasonal, so readings months apart are not directly comparable. Any conflict of interest that could affect coverage will be disclosed on the relevant page.</p>
  </div>
  <div class="section">
    <h2>Corrections</h2>
    <p>We fix errors promptly and openly. See the <a href="/about/corrections">corrections policy</a>, or email <a href="mailto:${esc(CONTACT_EMAIL)}">${esc(CONTACT_EMAIL)}</a>.</p>
  </div>`;
  return darkShell({ title, desc, canonical: url, ogImage: "/brand/avatar-1080.png",
    jsonld, docTitle: "PEAKTIME · editorial policy", updatedHuman, inner });
}

function renderCorrections(updatedHuman, modified) {
  const url = `${ORIGIN}/about/corrections`;
 const title = "Corrections Policy | PEAKTIME";
  const desc = "How to report an error in a PEAKTIME ranking, profile or fee benchmark, "
    + "what we correct, and our commitment to fixing mistakes openly.";
  const jsonld = [
    withCtx({ "@type": "WebPage", name: title, url, description: desc,
      lastReviewed: modified, publisher: ORG_NODE,
      mainEntityOfPage: { "@type": "WebPage", "@id": url } }),
    breadcrumbLd([{ name: "PEAKTIME", path: "/" }, { name: "About", path: "/about" }, { name: "Corrections", path: "/about/corrections" }]),
  ];
  const inner = `  <div class="hero">
    <h1>Corrections</h1>
    <p class="sub">PEAKTIME is only as useful as it is accurate. If something is wrong, we want to fix it.</p>
    <p class="upd">Maintained by Ben Faricy, Founder &amp; Editor · last reviewed ${esc(updatedHuman)}</p>
  </div>
  <div class="section">
    <h2>How to report an error</h2>
    <p>Email <a href="mailto:${esc(CONTACT_EMAIL)}">${esc(CONTACT_EMAIL)}</a> with the page URL, what is wrong, and a source if you have one. Artists, managers and agents are welcome to flag a profile, a signal, or a fee benchmark; promoters can confirm or correct a fee directly.</p>
  </div>
  <div class="section">
    <h2>What we correct</h2>
 <p>Factual errors in an artist profile, a misattributed namesake or wrong identity, a mis-sourced or out-of-date booking-fee figure, a broken or misclassified signal, and any data point we cannot stand behind. We do not change a ranking simply because someone disagrees with where the model places them, but we will explain how the score was reached.</p>
  </div>
  <div class="section">
    <h2>Our commitment</h2>
    <p>We aim to acknowledge a correction request quickly and to fix confirmed errors promptly. Where a correction materially changes what a page said, we note it. Because the index is rebuilt daily from source data, most data corrections take effect on the next refresh.</p>
    <p><a href="/about/editorial-policy">Read the editorial policy →</a></p>
  </div>`;
  return darkShell({ title, desc, canonical: url, ogImage: "/brand/avatar-1080.png",
    jsonld, docTitle: "PEAKTIME · corrections", updatedHuman, inner });
}

const fmtReach = (n) => (!Number.isFinite(n) || n <= 0 ? "—" : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n));

// ── Head-to-head comparison pages (/compare/<a>-vs-<b>) ──────────────────────
function renderComparison({ a, b, total, lastUpdated }) {
  // a is the better-ranked act (caller guarantees a.rank <= b.rank).
  const modified = (lastUpdated || new Date().toISOString()).slice(0, 10);
  const updatedHuman = new Date(lastUpdated || new Date().toISOString())
    .toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const sa = slugify(a.name), sb = slugify(b.name);
  const url = `${ORIGIN}/compare/${sa}-vs-${sb}`;
  const gap = (b.rank ?? 0) - (a.rank ?? 0);
  const h1 = `${a.name} vs ${b.name}`;
  const verdict = `${a.name} ranks #${a.rank} and ${b.name} ranks #${b.rank} of ${total} on PEAKTIME's `
 + `booking-demand index, ${a.name} sits ${gap} place${gap === 1 ? "" : "s"} higher as of ${updatedHuman}.`;
  const title = `${a.name} vs ${b.name}: Who's More in Demand? | PEAKTIME`;
  const desc = `${verdict} A signal-by-signal booking-demand comparison.`.replace(/\s+/g, " ").trim();

  const ROWS = [
    ["PEAKTIME rank", a.rank, b.rank, false, (v) => `#${v}`],
    ["Demand score", a.score, b.score, true, (v) => Math.round(v)],
    ["Scene score", a.manual_scene_score, b.manual_scene_score, true, (v) => Math.round(v)],
    ["Live demand", a.live_demand_score, b.live_demand_score, true, (v) => Math.round(v)],
    ["Beatport", a.beatport_score, b.beatport_score, true, (v) => Math.round(v)],
    ["DJ support (1001TL)", a.tl_support_score, b.tl_support_score, true, (v) => Math.round(v)],
    ["Momentum", a.momentum_score, b.momentum_score, true, (v) => Math.round(v)],
    ["Monthly listeners", a.spotify_monthly_listeners, b.spotify_monthly_listeners, true, fmtReach],
  ];
  const rowsHtml = ROWS.filter(([, av, bv]) => Number.isFinite(av) || Number.isFinite(bv)).map(([label, av, bv, hib, fmt]) => {
    const aFin = Number.isFinite(av), bFin = Number.isFinite(bv);
    let aWin = false, bWin = false;
    if (aFin && bFin && av !== bv) { const aBetter = hib ? av > bv : av < bv; aWin = aBetter; bWin = !aBetter; }
    return `<tr><td>${esc(label)}</td>`
 + `<td class="num ${aWin ? "win" : ""}">${aFin ? esc(String(fmt(av))) : "—"}</td>`
 + `<td class="num ${bWin ? "win" : ""}">${bFin ? esc(String(fmt(bv))) : "—"}</td></tr>`;
  }).join("\n");

  const faq = [
 { q: `Who is more in demand, ${a.name} or ${b.name}?`, a: `${a.name}. On PEAKTIME's booking-demand index, ${a.name} ranks #${a.rank} versus ${b.name} at #${b.rank} as of ${updatedHuman}, a gap of ${gap} place${gap === 1 ? "" : "s"}. The ranking measures booking demand, not reach or follower counts.` },
 { q: `How is ${a.name} vs ${b.name} compared?`, a: `Both acts are scored on the same blend of independent demand signals: live booking (Resident Advisor venue tier, attendance and touring), editorial scene credibility, Beatport chart credibility, 1001Tracklists DJ support, search interest and social velocity, refreshed daily.` },
  ];
  const itemList = { "@context": "https://schema.org", "@type": "ItemList", name: h1, url, numberOfItems: 2,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    itemListElement: [a, b].map((x) => ({ "@type": "ListItem", position: x.rank,
      url: `${ORIGIN}/artist/${slugify(x.name)}`, item: { "@type": "MusicGroup", name: x.name, url: `${ORIGIN}/artist/${slugify(x.name)}` } })) };
  const faqLd = { "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) };
  const collectionLd = { "@context": "https://schema.org", "@type": "WebPage", name: h1, url, description: desc, dateModified: modified };
  const crumbs = breadcrumbLd([{ name: "Rankings", path: "/" }, { name: h1, path: `/compare/${sa}-vs-${sb}` }]);

  const inner = `  <div class="hero">
    <h1>${esc(a.name)} <span style="color:#999">vs</span> ${esc(b.name)}</h1>
    <p class="sub">${esc(verdict)}</p>
    <p class="upd">refreshed daily · last updated ${esc(updatedHuman)} · <a href="/artist/${sa}">${esc(a.name)}</a> · <a href="/artist/${sb}">${esc(b.name)}</a></p>
  </div>
  <div class="section">
    <h2>Signal by signal</h2>
    <table>
      <thead><tr><th>Signal</th><th class="num">${esc(a.name)}</th><th class="num">${esc(b.name)}</th></tr></thead>
      <tbody>
${rowsHtml}
      </tbody>
    </table>
  </div>
  <div class="section faq">
    <h2>Frequently asked</h2>
    <dl>
${faq.map((f) => `      <dt>${esc(f.q)}</dt>\n      <dd>${esc(f.a)}</dd>`).join("\n")}
    </dl>
  </div>`;

  return pageShell({ title, desc, canonical: url, ogImage: "/brand/post-top5-1080.png",
    jsonld: [collectionLd, itemList, faqLd, crumbs], docTitle: "PEAKTIME · head-to-head", updatedHuman, inner });
}

// ── Scene / city pages (/scene/<city>) ───────────────────────────────────────
// Who's booked in a market, ranked by PEAKTIME demand. Built from ra_recent_cities.
function renderScene({ city, country, acts, total, lastUpdated }) {
  const modified = (lastUpdated || new Date().toISOString()).slice(0, 10);
  const updatedHuman = new Date(lastUpdated || new Date().toISOString())
    .toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const slug = citySlugLocal(city);
  const url = `${ORIGIN}/scene/${slug}`;
  const top = acts.slice(0, 40);
  const h1 = `The most in-demand DJs booked in ${city}`;
  const lede = `House and techno DJs with recent ${city} bookings, ranked by PEAKTIME booking demand.`;
 const title = `DJs Booked in ${city}, Demand Ranking | PEAKTIME`;
  const desc = `${lede} ${top.length} acts, updated daily.`.replace(/\s+/g, " ").trim();

  const rows = top.map((a) => {
    const s = slugify(a.name);
    return `<tr><td class="num rk">#${a.rank}</td><td><a href="/artist/${s}">${esc(a.name)}</a></td>`
 + `<td class="num muted">${a._shows ? `${a._shows} show${a._shows === 1 ? "" : "s"}` : "—"}</td></tr>`;
  }).join("\n");

  const faq = [
 { q: `Who is the most in-demand DJ booked in ${city}?`, a: `${top[0] ? top[0].name : "—"} is the highest-ranked act with recent ${city} bookings on PEAKTIME (overall #${top[0] ? top[0].rank : "—"}), as of ${updatedHuman}.` },
    { q: `Which DJs play ${city}?`, a: `PEAKTIME tracks ${top.length}+ ranked house and techno acts with recent ${city} dates (from Resident Advisor booking data). The list is ordered by each act's overall booking-demand rank and refreshed daily.` },
  ];
  const itemList = { "@context": "https://schema.org", "@type": "ItemList", name: h1, url, numberOfItems: top.length,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    itemListElement: top.map((a, i) => ({ "@type": "ListItem", position: i + 1, url: `${ORIGIN}/artist/${slugify(a.name)}`,
      item: { "@type": "MusicGroup", name: a.name, url: `${ORIGIN}/artist/${slugify(a.name)}` } })) };
  const faqLd = { "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) };
  const collectionLd = { "@context": "https://schema.org", "@type": "CollectionPage", name: h1, url, description: desc,
    dateModified: modified, about: { "@type": "Place", name: `${city}${country ? `, ${country}` : ""}` } };
  const crumbs = breadcrumbLd([{ name: "Rankings", path: "/" }, { name: city, path: `/scene/${slug}` }]);

  const inner = `  <div class="hero">
    <h1>${esc(h1)}</h1>
    <p class="sub">${esc(lede)} Demand is measured from live booking, scene credibility, Beatport, DJ support, search and social velocity.</p>
    <p class="upd">${top.length} acts · refreshed daily · last updated ${esc(updatedHuman)} · <a href="/">see the full live index →</a></p>
  </div>
  <div class="section">
    <h2>Ranked by booking demand</h2>
    <table>
      <thead><tr><th class="num">Rank</th><th>Artist</th><th class="num">Recent ${esc(city)} dates</th></tr></thead>
      <tbody>
${rows}
      </tbody>
    </table>
  </div>
  <div class="section faq">
    <h2>Frequently asked</h2>
    <dl>
${faq.map((f) => `      <dt>${esc(f.q)}</dt>\n      <dd>${esc(f.a)}</dd>`).join("\n")}
    </dl>
  </div>`;

  return pageShell({ title, desc, canonical: url, ogImage: "/brand/post-top5-1080.png",
    jsonld: [collectionLd, itemList, faqLd, crumbs], docTitle: `PEAKTIME · ${city} scene`, updatedHuman, inner });
}

// Curated booking markets + city matching — MIRRORS App.jsx BOOKING_MARKETS / citySlug /
// cityMatch (App.jsx is JSX, not Node-importable). Keep in sync if those change.
const BOOKING_MARKETS = [
  { city: "Amsterdam", country: "Netherlands" }, { city: "Berlin", country: "Germany" },
  { city: "London", country: "United Kingdom" }, { city: "Ibiza", country: "Spain" },
  { city: "Paris", country: "France" }, { city: "Miami", country: "United States" },
  { city: "New York", country: "United States" }, { city: "Los Angeles", country: "United States" },
  { city: "Las Vegas", country: "United States" }, { city: "Melbourne", country: "Australia" },
  { city: "Sydney", country: "Australia" }, { city: "Toronto", country: "Canada" },
  { city: "Mexico City", country: "Mexico" },
];
const citySlugLocal = (c) => c.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const cityMatchLocal = (raCity, marketCity) => {
  const a = (raCity || "").toLowerCase().split("/")[0].trim();
  const b = marketCity.toLowerCase();
  return a && (a.includes(b) || b.includes(a));
};

async function build() {
 if (!fs.existsSync(TEMPLATE)) { console.error("generatePages: dist/index.html missing, run vite build first."); process.exit(1); }
  const tpl = fs.readFileSync(TEMPLATE, "utf8");
  const d = JSON.parse(fs.readFileSync(DATA, "utf8"));
  const artists = (d.rankings || d).filter((a) => a && a.name);
  const total = artists.length;
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: "/", priority: 1.0, changefreq: "daily", lastmod: today },
    { loc: "/press", priority: 0.5, changefreq: "monthly", lastmod: today },
    { loc: "/about", priority: 0.4, changefreq: "monthly", lastmod: today },
    { loc: "/about/editorial-policy", priority: 0.4, changefreq: "yearly", lastmod: today },
    { loc: "/about/corrections", priority: 0.4, changefreq: "yearly", lastmod: today },
  ];

  // Trust pages (E-E-A-T) — named editor + independence/corrections policy. Static,
  // indexable, linked from the homepage footer. updatedHuman mirrors the home format.
  {
    const updatedHuman = new Date(d.lastUpdated || new Date().toISOString())
      .toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    writePage("about.html", renderAbout(updatedHuman));
    writePage("about/editorial-policy.html", renderEditorialPolicy(updatedHuman, today));
    writePage("about/corrections.html", renderCorrections(updatedHuman, today));
  }

  // Published reports — real static HTML under public/reports (shipped to dist/),
  // previously orphaned from the sitemap. Listed only if the built file exists, so a
  // renamed/removed report never leaves a 404 in the sitemap. Mirrors the REPORTS
  // array in App.jsx; the daily Rank 2.0 report changes most, hence changefreq daily.
  const REPORT_PAGES = [
    { loc: "/reports/state-of-demand-2026/", file: "reports/state-of-demand-2026/index.html", changefreq: "weekly" },
    { loc: "/reports/rank-2-0/",          file: "reports/rank-2-0/index.html",          changefreq: "daily" },
    { loc: "/reports/iii-points-2026/",   file: "reports/iii-points-2026/index.html",   changefreq: "monthly" },
    { loc: "/reports/crssd-fall-2026/",   file: "reports/crssd-fall-2026/index.html",   changefreq: "monthly" },
    { loc: "/reports/the-index-launch.html", file: "reports/the-index-launch.html",     changefreq: "monthly" },
    { loc: "/reports/mau-p.html",         file: "reports/mau-p.html",                   changefreq: "monthly" },
  ];
  for (const r of REPORT_PAGES) {
    if (fs.existsSync(path.join(DIST, r.file))) {
      urls.push({ loc: r.loc, priority: 0.6, changefreq: r.changefreq, lastmod: today });
    }
  }
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
 + `Demand-led and model-implied: an estimated tier, not a transacted price.`;
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

  // Club Index pages — prerendered from clubsData.js (same source of truth as the SPA's
  // ClubsPage, so no drift). Wrapped in try/catch: a data-import failure degrades gracefully
  // (skips clubs, rest of the build still ships) rather than breaking the whole deploy.
  let nClub = 0;
  try {
    const { pathToFileURL } = require("url");
    const imp = (rel) => import(pathToFileURL(path.join(__dirname, rel)).href);
    const { RANKED, clubSlug } = await imp("../frontend/src/clubsData.js");
    const { CLUB_PROFILES } = await imp("../frontend/src/clubProfiles.js");
    const clubTotal = RANKED.length;
    for (const c of RANKED) {
      const slug = clubSlug(c.name);
      if (!slug) continue;
      const { title, desc } = clubMeta(c, clubTotal);
      const body = clubBody(c, CLUB_PROFILES[c.name], clubTotal);
      writePage(`club/${slug}.html`, renderPage(tpl, { url: `/club/${slug}`, title, desc, jsonld: clubJsonLd(c, slug), body }));
      urls.push({ loc: `/club/${slug}`, priority: 0.6, changefreq: "monthly", lastmod: today });
      nClub++;
    }
  } catch (e) {
 console.warn("generatePages: club prerender skipped —", e.message);
  }

  // Ranking landing pages — the head-on SEO/AEO query space. Genre cuts reuse the
  // SPA's own classifier (genre.js, single source of truth — no drift). try/catch:
  // a classifier import failure skips landings without breaking the deploy.
  let nLanding = 0;
  try {
    const { pathToFileURL } = require("url");
    const { matchesGenre, genreLean } = await import(pathToFileURL(path.join(__dirname, "../frontend/src/genre.js")).href);
    const fmtN = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n));
    const named = artists.filter((a) => a.name && Number.isFinite(a.score));
    const byRank = (a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9);

    // Genre cuts — renumbered within the cut, genre pill shown.
    const techno = named.filter((a) => matchesGenre(a, "techno")).sort(byRank).map((a) => ({ ...a, _lean: genreLean(a) || "techno" }));
    const house = named.filter((a) => matchesGenre(a, "house")).sort(byRank).map((a) => ({ ...a, _lean: genreLean(a) || "house" }));
    // Rising — momentum-led. Gate to acts with a real momentum read (mirrors the app's Momentum sort).
    const rising = named.filter((a) => Number.isFinite(a.momentum_score) && a.momentum_score > 0)
      .sort((a, b) => b.momentum_score - a.momentum_score).map((a) => ({ ...a, _metric: Math.round(a.momentum_score) }));
    // Value — underpriced buys, by value gap (mirrors the Value Gap tab's buy filter).
    const value = named.filter((a) => (a.value_signal === "buy" || a.value_signal === "strong-buy") && Number.isFinite(a.value_gap))
      .sort((a, b) => (b.value_gap - a.value_gap) || ((b.momentum_score || 0) - (a.momentum_score || 0)))
      .map((a) => ({ ...a, _metric: a.value_gap > 0 ? `+${a.value_gap}` : String(a.value_gap) }));

    const topName = (arr) => (arr[0] ? arr[0].name : "the field");
    const LANDINGS = [
      { slug: "techno", ranked: techno, metricLabel: "Demand",
        h1: "The most in-demand techno DJs right now",
 lede: "The house-anchored index's techno cut: peak-time, melodic and crossover techno acts.",
        faq: [
          { q: "Who is the most in-demand techno DJ right now?", a: `As of the latest daily update, ${topName(techno)} leads PEAKTIME's techno cut, ranked by booking demand across scene credibility, Resident Advisor and Beatport signal, touring and search velocity.` },
 { q: "How is the techno ranking calculated?", a: "Each act blends multiple independent demand signals: live booking (Resident Advisor venue tier and attendance, plus touring), editorial scene credibility, Beatport chart credibility, 1001Tracklists DJ support, search interest and social velocity: into one demand score, refreshed daily." },
          { q: "Is this a pure techno chart?", a: "No. PEAKTIME is a house-anchored index; the techno cut surfaces techno-leaning and crossover acts (plus pure-techno names kept out of the main house view), classified by where Beatport charts them. It's a lens on the index, not a comprehensive techno chart." },
        ] },
      { slug: "house", ranked: house, metricLabel: "Demand",
        h1: "The most in-demand house DJs right now",
 lede: "House, tech house and the melodic crossover middle, the anchor of the index.",
        faq: [
          { q: "Who is the most in-demand house DJ right now?", a: `As of the latest daily update, ${topName(house)} leads PEAKTIME's house cut, ranked by measured booking demand rather than reach or follower counts.` },
          { q: "How is the house ranking calculated?", a: "It blends live booking demand (Resident Advisor venue tier, attendance and touring), editorial scene credibility, Beatport chart credibility, 1001Tracklists DJ support, search interest and social velocity into one daily-refreshed demand score." },
          { q: "What counts as house here?", a: "House, tech house and the melodic 'crossover' middle, classified by where Beatport charts each act and their primary label. Pure-techno acts live under the techno cut instead." },
        ] },
      { slug: "rising", ranked: rising, metricLabel: "Momentum",
        h1: "The fastest-rising DJs right now",
 lede: "Who's accelerating: ranked by momentum, not by who's already biggest.",
        faq: [
 { q: "Which DJs are gaining demand the fastest right now?", a: `As of the latest daily update, ${topName(rising)} tops PEAKTIME's momentum ranking, the acts whose demand is accelerating fastest.` },
 { q: "How does PEAKTIME measure momentum?", a: "Momentum is a 0–100 score blending the rate of change across signals: search-interest slope, monthly-listener growth, Wikipedia trend, Beatport week-over-week movement and tour velocity: so it ranks who's accelerating, not who's largest." },
          { q: "How often does the rising ranking update?", a: "Daily. Momentum is recomputed every refresh from the latest signal deltas." },
        ] },
      { slug: "value", ranked: value, metricLabel: "Value gap",
        h1: "The most underpriced DJs to book right now",
 lede: "Acts whose measured demand outpaces their estimated booking fee, the buy signals.",
        faq: [
 { q: "Which DJs are underpriced to book?", a: `As of the latest daily update, ${topName(value)} tops PEAKTIME's value-gap ranking, acts whose demand outpaces their fee tier. These are model-implied estimates, not transacted prices.` },
 { q: "What is the Value Gap?", a: "The Value Gap compares an act's demand-implied fee tier against their known fee tier. A positive gap flags an act priced below current booking demand, a potential buy. Fees are model-implied estimates, not transacted prices." },
 { q: "What does 'strong-buy' mean?", a: "A strong-buy is an act that is both underpriced (positive value gap) and surging in momentum, underpriced and accelerating at the same time." },
        ] },
    ];

    for (const l of LANDINGS) {
      if (!l.ranked.length) continue; // never ship an empty cut
      const html = renderLanding({ ...l, total, lastUpdated: d.lastUpdated });
      writePage(`rankings/${l.slug}.html`, html);
      urls.push({ loc: `/rankings/${l.slug}`, priority: 0.8, changefreq: "daily", lastmod: today });
      nLanding++;
    }
    void fmtN; // reserved for future reach-based cuts
  } catch (e) {
 console.warn("generatePages: ranking landings skipped —", e.message);
  }

  // Comparison pages — /compare/<a>-vs-<b> for same-genre adjacent-rank rivalry pairs
  // (high-intent, near-zero competition, the format AI engines cite most). Reuses the
  // genre classifier (genre.js). Own try/catch so a comparison bug can't break the rest.
  let nCompare = 0;
  try {
    const { pathToFileURL } = require("url");
    const { matchesGenre } = await import(pathToFileURL(path.join(__dirname, "../frontend/src/genre.js")).href);
    const named = artists.filter((a) => a.name && Number.isFinite(a.score) && Number.isFinite(a.rank));
    const byRank = (a, b) => a.rank - b.rank;
    const technoCut = named.filter((a) => matchesGenre(a, "techno")).sort(byRank);
    const houseCut = named.filter((a) => matchesGenre(a, "house")).sort(byRank);
    const overall = named.slice().sort(byRank);

    const seen = new Set();
    const pairs = [];
    const addPair = (x, y) => {
      if (!x || !y || x.name === y.name) return;
      const [a, b] = x.rank <= y.rank ? [x, y] : [y, x];   // better rank first
      const key = `${slugify(a.name)}-vs-${slugify(b.name)}`;
      if (seen.has(key)) return;
      seen.add(key);
      pairs.push({ a, b });
    };
    for (const cut of [technoCut, houseCut]) {
      for (let i = 0; i < cut.length - 1; i++) addPair(cut[i], cut[i + 1]);            // consecutive
      for (let i = 0; i < Math.min(cut.length - 2, 25); i++) addPair(cut[i], cut[i + 2]); // skip-one, top 25
    }
    for (let i = 0; i < Math.min(overall.length - 1, 16); i++) addPair(overall[i], overall[i + 1]); // marquee top pairs
    for (const { a, b } of pairs.slice(0, 220)) {
      writePage(`compare/${slugify(a.name)}-vs-${slugify(b.name)}.html`, renderComparison({ a, b, total, lastUpdated: d.lastUpdated }));
      urls.push({ loc: `/compare/${slugify(a.name)}-vs-${slugify(b.name)}`, priority: 0.5, changefreq: "weekly", lastmod: today });
      nCompare++;
    }
  } catch (e) {
 console.warn("generatePages: comparison pages skipped —", e.message);
  }

  // Scene / city pages — /scene/<city> for the curated booking markets. Aggregates
  // ra_recent_cities, ranks by overall demand. Completes the "market" page type the
  // SEO audit deferred (built standalone, not the hash-routed /market SPA view).
  let nScene = 0;
  try {
    for (const m of BOOKING_MARKETS) {
      const acts = [];
      for (const a of artists) {
        if (!a.name || !Number.isFinite(a.rank)) continue;
        const hit = (a.ra_recent_cities || []).find((c) => cityMatchLocal(c.city, m.city));
        if (hit) acts.push({ ...a, _shows: hit.shows || hit.shows_3m || 0 });
      }
      if (acts.length < 5) continue;            // skip thin cities (no substantive page)
      acts.sort((x, y) => x.rank - y.rank);
      writePage(`scene/${citySlugLocal(m.city)}.html`, renderScene({ city: m.city, country: m.country, acts, total, lastUpdated: d.lastUpdated }));
      urls.push({ loc: `/scene/${citySlugLocal(m.city)}`, priority: 0.6, changefreq: "weekly", lastmod: today });
      nScene++;
    }
  } catch (e) {
 console.warn("generatePages: scene pages skipped —", e.message);
  }

  // Homepage — bake content + canonical + entity schema into dist/index.html.
  // createRoot() wipes #root on mount, so this is crawler/first-paint only (no hydration).
  {
    const { title, desc } = homeMeta();
    const html = renderPage(tpl, { url: "/", title, desc,
      jsonld: homeJsonLd(artists, total, d.lastUpdated), body: homeBody(artists, total, d.lastUpdated) });
    fs.writeFileSync(TEMPLATE, html); // dist/index.html
  }

  // SPA fallback for any unmatched path (markets/clubs/blog still client-routed).
  // Use the ORIGINAL template (bare shell), not the prerendered homepage.
  fs.writeFileSync(path.join(DIST, "404.html"), tpl);

  // Sitemap — only pages that exist (all 200). markets/clubs/blog deferred to B.2.
  const xml = ['<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((u) => `  <url>\n    <loc>${ORIGIN}${u.loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority.toFixed(1)}</priority>\n  </url>`),
    "</urlset>", ""].join("\n");
  fs.writeFileSync(path.join(DIST, "sitemap.xml"), xml);

  console.log(`generatePages: ${nArtist} artist + ${nValue} value + ${nClub} club + ${nLanding} landing + ${nCompare} compare + ${nScene} scene pages, 404.html, sitemap.xml (${urls.length} URLs).`);
}

build().catch((e) => { console.error("generatePages failed:", e); process.exit(1); });
