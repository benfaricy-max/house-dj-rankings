# SEO architecture & migration plan — thedjrankings.com (PEAKTIME)

The site is a client-rendered SPA on **hash routing**, so for search it collapses
to **one indexable URL** (the homepage). 330 artist pages, every Value Gap page,
and the blog are invisible to Google. This is the single biggest SEO problem and
it directly caps the free-ranking funnel in `STRATEGY.md`/`GTM.md`.

This doc is the blueprint to fix it: the target URL scheme, internal-linking
model, and a phased migration. Companion: run the `/seo-audit`, `/schema`, and
`/programmatic-seo` skills against this.

---

## 1 · Target URL taxonomy

| Page type | URL | Source | Index |
|---|---|---|---|
| Home / ranking | `/` | rankings.json | ✅ hub |
| Artist profile | `/artist/<slug>` | `slugify(name)` ×330 | ✅ |
| Fair-value / fee | `/value/<slug>` | `valueSlug` | ✅ highest intent |
| City / market | `/market/<city>` | `citySlug` | ✅ |
| Club / venue | `/club/<slug>` | RA top venues | ✅ |
| Blog index / post | `/blog`, `/blog/<slug>` | reports/ | ✅ |
| Methodology (new real page) | `/methodology` | "How It Works" | ✅ E-E-A-T |
| Pitch link | `/pitch/<token>` | private/expiring | ⛔ noindex + sitemap-excluded |
| Editor journal | `/journal` | editor-only | ⛔ noindex |

Conventions: lowercase, hyphenated, **no trailing slash** (GitHub Pages serves
`artist/<slug>.html` at `/artist/<slug>`). Self-referencing canonical per page.
Optional upgrade: nest the fee page at `/artist/<slug>/value` to inherit the
artist hierarchy/breadcrumb (stronger cluster; bigger routing change).

## 2 · Hierarchy

```
/  (ranking hub — links all 330 artists)
├── /artist/<slug>          ← profile (sub-hub)
│     ├── /value/<slug>     ← "[artist] booking fee" (high intent)
│     ├── → /market/<city>  (where they're booked)
│     └── → /club/<venue>   (rooms they play)
├── /market/<city>          ← city hub → artists booked there
├── /club/<slug>            ← venue hub → artists who play there
├── /blog → /blog/<slug>    ← content hub
├── /methodology            ← linked from every artist (explains the score)
└── /pitch/<token>          ⛔ noindex
```

## 3 · Internal-linking model (the SEO engine)

- **Home = master hub:** ranking rows become real `<a href="/artist/<slug>">`
  (today they're hash links, invisible to crawlers). One change → 330 crawlable
  internal links with artist-name anchors.
- **Artist page = sub-hub:** links to its `/value/<slug>`, its `/market/<city>`
  (`ra_top_regions`/`ra_recent_cities`), its `/club/<venue>` (`ra_top_venues`),
  and **related acts** (same `scene_tags`/cohort). Kills orphans; builds clusters.
- **Market & club pages = reverse hubs** listing artists → bidirectional links.
- **Methodology** linked from every artist and footer → concentrates E-E-A-T.
- **Blog posts** contextually link the artists they discuss.
- Rule: every page ≤2 clicks from home; no orphans.

## 4 · Sitemap & robots

- `robots.txt` (shipped): allow all; disallow `/pitch/`, `/journal`; Sitemap line
  commented until prerender lands.
- `backend/generateSitemap.js` (shipped, **inert**): reads rankings.json → 330×2
  artist+value URLs + markets + clubs + static, with `lastmod` from each artist's
  `timestamp`, priority 1.0 home / 0.8 value / 0.7 artist / 0.6 market·club.
  **Do not run/publish until the prerender migration ships** — a sitemap of path
  URLs before then lists 404s.

## 5 · Migration plan (phased)

### Phase A — quick wins (DONE, non-breaking)
- ✅ `frontend/public/robots.txt`
- ✅ `backend/generateSitemap.js` (inert, ready)
- ✅ This architecture doc
- ☐ **Set up Google Search Console** + verify the domain (currently zero index
  visibility; GA4 is already installed). Do this now — it measures the migration.

### Phase B — crawlable URLs + prerender (the unlock — the real lift)
1. **Routing:** replace manual `window.location.hash` matching in `App.jsx` with
   path-based routing (`/artist/<slug>` …). Keep a hash-catcher in `index.html`
   that `location.replace()`s old `#/artist/x` → `/artist/x` (preserve shared
   links). Add `404.html` (copy of index) for SPA deep-load fallback on GH Pages.
2. **Prerender at build time:** emit one static HTML file per page from
   `rankings.json` (e.g. `vite-react-ssg`, `react-snap`, or a custom prerender in
   the existing build/CI). Each file gets a unique `<title>`, meta description,
   self-canonical, and OG tags. This is the step that makes content indexable.
3. **Per-page meta** (templated — see `/programmatic-seo`):
   - Artist `<title>`: `<Name> — booking demand & ranking | PEAKTIME`
   - Value `<title>`: `How much to book <Name>? Fair-fee demand read | PEAKTIME`
   - Descriptions pull demand tier + value signal, honestly (estimates labelled).
4. **Real internal links** per §3; breadcrumbs.
5. Turn on the sitemap: run `generateSitemap.js` in `refresh.yml`, uncomment the
   `robots.txt` Sitemap line, submit in GSC.

### Phase C — enrichment
- Per-page JSON-LD: artist `MusicGroup`/`Person`, `BreadcrumbList`, `ItemList`
  for the ranking (`/schema` skill).
- Make `/methodology` a real, linkable page (strong E-E-A-T; explains neutrality).
- Run `/ai-seo` — the neutral "what does <artist> cost to book" data is exactly
  what AI answer engines cite.
- Verify Core Web Vitals via PageSpeed Insights; extend code-splitting.

## 6 · Acceptance criteria (Phase B "done")
- `curl https://thedjrankings.com/artist/<slug>` returns **200 with unique
  server-rendered `<title>` and content** (not the homepage title).
- `/sitemap.xml` returns 200 and lists ~660+ URLs, all 200, none `/pitch/`.
- Ranking rows are real `<a href="/artist/...">` in static HTML.
- GSC coverage climbs from ~1 page toward the full set over following weeks.
- Old `#/artist/<slug>` links still resolve (hash-catcher redirect).

## 7 · Risks / notes
- **No server 301s on GitHub Pages** — redirects are client-side (hash-catcher +
  404.html). Equity loss ≈ 0 since hash URLs were never separately indexed.
- The repo runs **multiple concurrent Claude sessions** and `App.jsx` is a
  ~2,700-line monolith — do Phase B as a scoped branch, not an in-place rewrite.
- PERMANENT data rules still apply: the prerender reads `rankings.json`, never
  writes/wipes it.
