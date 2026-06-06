# The DJ Rankings — Project Guide

Live site: **thedjrankings.com** (GitHub Pages, custom domain).
Repo: `benfaricy-max/house-dj-rankings`. Frontend deploys via GitHub Actions on every push.

## ⛔ PERMANENT RULE #1 — NEVER WIPE DATA
Data must **never be removed or overwritten with empty/zero values.** If a fresh
fetch fails, is rate-limited, or returns nothing, **keep the existing value and move on.**
Every data-writing path must be *merge-safe*: only overwrite a field when the new
value is real (non-zero / non-empty). This applies to all metrics for all artists,
forever. A partial update is always better than losing good data.

- `backend/generateStatic.js` (CI path) — merge-safe via `keep(next, prev)` against existing rankings.json.
- `backend/enrichLocal.js` (full local refresh) — merge-safe: only assigns when fetch > 0.
- Any new script that writes `rankings.json` / `artists.json` MUST follow this rule.

## Standing preferences
- Don't ask for permission/allow — the answer is permanently yes. Just execute.
- Prioritize shipping results over perfect data. Adapt when something is stuck:
  if one source blocks, null it and move on; deliver the broader ask.
- Commit + push after changes (GitHub Pages auto-deploys).

## Architecture
- **No server.** Frontend (Vite/React) reads a static `frontend/public/rankings.json`.
- Two GitHub Actions: `deploy.yml` (build+deploy Pages on push) and
  `refresh.yml` (daily data refresh at 8am UTC, runs `generateStatic.js`).
- Data refresh is merge-safe and commits `rankings.json` + `artists.json`.

## Data sources & gotchas
- **Spotify**: API blocks followers/listeners under Client Credentials (403).
  Monthly listeners come from a **puppeteer scrape** (`fetchSpotifyScrape.js`) —
  works locally only (not in CI). Other metadata cached in snapshots.
- **YouTube**: search = 100 quota units, daily cap 10,000 → can't resolve all 264
  in one day. Resolved channel IDs are cached back to `artists.json` so future
  lookups cost 1 unit. Fix: request a quota increase, or let it resolve ~90/day.
- **TikTok / Spotify scrape**: need puppeteer → **local only** (no Chrome in CI).
  This is why CI must be merge-safe (it can't fetch these).
- **Google Trends**: via `trends.py` (pytrends), 22s timeout, often rate-limited
  by Google — partial coverage is normal, never block on it.
- **Mixcloud**: public API, no auth; some usernames 404 → leave 0.

## Full local refresh (the good path)
`node backend/enrichLocal.js` — pulls YouTube + Trends + TikTok + Mixcloud +
Spotify listeners in one pass, concurrency 4, progressive save, null-on-fail.
`node backend/enrichBeatport.js` — scrapes Beatport genre Top 100 charts (plain
HTTP, no puppeteer) → beatport_score (core scene credibility). Runs in CI too.
Then commit `frontend/public/rankings.json` + `backend/artists.json` and push.

## Google Trends 12-month backfill
`node backend/backfillTrendsBatch.js` — preferred: 5 terms/request with a fixed
ANCHOR ("Carl Cox") rescaled to a common scale; 5× fewer requests. Resumable
(skips fresh <20d), rate-limit-aware (backs off + stops on 429 streak), merge-safe.
Stores full series in data/trends_history.json + trends_12m/momentum in rankings.
`backfillTrends.js` is the 1-per-request fallback. Google throttles pytrends by IP —
backfill accumulates across runs. Long-term fix: official Trends API (alpha, applied).

## Tour density signal (revenue/demand)
`node backend/enrichTour.js [limit]` — Songkick public pages (no key; Bandsintown
now 403s arbitrary app_ids). search → slug-matched artist page → ld+json upcoming
MusicEvents → tour_upcoming/countries/next show + tour_score. Resumable, paced,
merge-safe. Runs in CI too (continue-on-error).

## Resident Advisor signal (booking intelligence)
`node backend/enrichRA.js [limit]` — RA public GraphQL (ra.co/graphql, no auth).
Slug = name.normalize().toLowerCase().replace(/[^a-z0-9]/g, '') — add `ra_slug`
to artists.json to override for ambiguous names (e.g. "fisher" → Mike Fisher).
Fetches: ra_followers, ra_upcoming, ra_events_6m, ra_avg_attending, ra_top_attending,
ra_attending_h1/h2 (trajectory), ra_venue_tier (1-5 capacity buckets), ra_countries,
ra_country_list, ra_top_regions, ra_top_venues → composite ra_score 0-100.
Stale threshold: 14 days. Runs in CI (plain HTTP, no puppeteer). Weight: 0.08 in score.

## Beatport signal (core credibility)
`beatport_score` 0-100 from genre Top-100 charts: positionScore(101−best)·0.6 +
trackBreadth·0.25 + crossGenreReach·0.15. Powers the "DJ's DJ" benchmark axis
(high Beatport + low Spotify = scene-respected, not yet mainstream).

## Momentum Score (core differentiator)
`node backend/enrichMomentum.js` (runs LAST in refresh, after all rate-of-change
signals). Standalone `momentum_score` 0-100 — ranks who's ACCELERATING, not who's
biggest. Blend (self-healing, per-artist renormalized): Trends slope 42% +
listener growth 25% + Wikipedia trend 15% + Beatport WoW change 12% + tour
velocity 6%. Logic in `momentum.js`. Guards against namesake/noise: gated to
artists with ≥50k monthly listeners; Trends needs google_trends_score≥8; outliers
clipped. Beatport `beatport_pos_change` + `tour_velocity` are TRUE deltas built
from inline `beatport_history`/`tour_history` (stored on each artist so they
survive the CI commit; data/ is gitignored). `wikipedia_trend` = recent-30d vs
prior-30d (fetchWikipedia). UI: "Momentum" sort on Rankings + pill on rows;
Ones-to-Watch/Pro prefer momentum_score, fall back to client calc if null.

## Price/Demand Gap (the buy signal — Pitchbook analog)
`node backend/enrichValueGap.js` (after computeFees + enrichMomentum). Estimates a
demand-implied fee tier and flags artists whose demand outpaced their known fee.
`demand_index` 0-100 = reach .40 (log listeners) + RA booking .22 + beatport .18 +
youtube .10 (log) + trends .10, self-healing. Calibrated to tiers using the ACTUAL
fee-tier distribution (relative repricing; sum of gaps ≈ 0). `value_gap` =
demand_tier − fee tier (+ve = underpriced). value_signal: "strong-buy" (gap≥1 AND
momentum≥40 — underpriced + surging), "buy" (gap≥1 static), "premium" (gap≤−1),
"fair". ONLY judges curated/anchored fees (a gap vs a fallback estimate just
measures the estimate's staleness). UI: "Value Gap" tab + badge on Booking acts.

## 1001Tracklists DJ-Support signal (what DJs actually play)
`node backend/enrich1001.js` — matches the roster against 1001Tracklists' weekly
chart (the tracks DJs are PLAYING in sets — hardest signal to game). Reads a local
API (`TL_API_BASE`, default http://localhost:3001; endpoint /api/1001tracklists/chart/weekly).
Writes `tl_support_score` 0-100 (chart position 70% + track breadth 30%),
`tl_chart_best`/`tl_chart_tracks`/`tl_chart_titles`, and cumulative `tl_weeks_charted`
from a committed weekly archive (`backend/tracklists-archive.json`, ~16 weeks).
Weight 0.05 in score.js. **Local-only by default** (API not reachable in CI → the
CI step no-ops gracefully; tl_* persists via generateStatic's `...prev` spread).
Set repo var `TL_API_BASE` to a hosted URL to run it in CI. UI: "DJ Support · 1001TL"
signal on artist profiles + How It Works methodology.

## Scene Score (transparent editorial layer)
`manual_scene_score` 0-100, weight 0.11 (raised from 0.04). Published rubric in
How It Works (SCENE_RUBRIC in App.jsx): Boiler Room/HÖR +20, Berghain/fabric/DC10
+20, festival closing +15, respected label +15, RA/Mixmag/DJ Mag cover +10, Ibiza
residency +10, Essential Mix +10. Explicit criteria = credible + hard to game.

## Composite weights (score.js, sum=1.00)
listeners .15, scene .11→.12, beatport .10, ra .10, trends .09, growth .08,
yt_subs .08, tiktok .06, beatport_hype .05, tl_support (1001TL DJ-support) .05,
label .05, releases .05, wikipedia .02. RETIRED (0): track_pop (Spotify-blocked),
yt_views_weekly (delta metric, 0% coverage — dropped & reallocated).
Self-healing: empty-field signals redistribute their weight per-artist over the
signals present. Rebalanced toward the reliable high-coverage / booker-trusted
core (listeners, scene, RA); listener growth reduced from .13 (volatile + thin
coverage). Keep score.js + the frontend METRICS / METRIC_DETAILS arrays in sync.

## Key per-artist fields (in artists.json, persisted)
- `emerging` (bool) — reputation-based; drives "Ones to Watch" (excludes legends).
- `booking_fee` {label, mid, tier, color} — curated club/festival estimate.
- `debut_year` — iTunes-sourced (partial coverage).
- `youtube_channel_id` — cached UC id once resolved.
