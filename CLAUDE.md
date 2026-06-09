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
Stale threshold: 14 days. Runs in CI (plain HTTP, no puppeteer). NOTE: ra_score is
NOT weighted directly anymore — it feeds `live_demand_score` (see below).

## Live-demand blend (RA not single-sourced) — `live_demand_score`, weight 0.17 (LEADS)
`backend/computeLiveDemand.js` (run in `generateStatic.js` BEFORE scoreArtists).
RA's event coverage skews underground/Europe and UNDER-logs US/commercial/festival
acts — so RA alone scores a real touring act as low-demand just because RA can't see
its shows. So the leading booking signal is a blend: RA (venue tier/attendance/geo)
+ Songkick `tour_score`. The blend only **corroborates upward** — tour can lift an
act RA under-sees, but a thin/low tour score never drags down a solid RA reading
(`live = max(ra, blend)`; Songkick has its own gaps). `ra_coverage_thin` flags acts
RA structurally under-logs (reach ≥750k & <3 RA events, or RA-blind while touring) —
there tour is weighted more (0.65 vs 0.35) and the UI shows a "RA-thin · tour-led"
pill. Coverage 84%→92%. score.js weights `live_demand_score` (falls back to ra_score
if the blend hasn't been computed). Keep in sync: score.js, frontend METRICS /
METRIC_DETAILS, this file.

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

**Fee honesty (important).** We hold NO transacted fees — `booking_fee.basis` is
"curated" (hand-tiered) or "estimate" (listener-derived), both model-implied, so
the gap is demand vs an estimate, NOT vs a real price. The Fair Value Report says
this plainly: bands labelled "estimated tier", a fee-basis note, and confidence
CAPPED at Medium unless the fee is verified. Real anchors go in
`backend/fee_anchors.json` (actual quoted/contracted/published fees — schema in
the file; NEVER seed guesses). computeFees.js applies them → basis "anchored" +
`fee_source`/`fee_date`, overriding the estimate and labelled "✓ verified fee"
(uncaps confidence). Goal: 30-40 real anchors to calibrate + validate the model.
Promoters can submit fees via the "Send it" mailto in the report.

## 1001Tracklists DJ-Support signal (what DJs actually play)
`node backend/enrich1001.js` — matches the roster against 1001Tracklists' weekly
chart (the tracks DJs are PLAYING in sets — hardest signal to game). Reads a local
API (`TL_API_BASE`, default http://localhost:3001; endpoint /api/1001tracklists/chart/weekly).
Writes `tl_support_score` 0-100 (chart position 70% + track breadth 30%),
`tl_chart_best`/`tl_chart_tracks`/`tl_chart_titles`, and cumulative `tl_weeks_charted`
from a committed weekly archive (`backend/tracklists-archive.json`, ~16 weeks).
Weight 0.09 in score.js. **Local-only by default** (API not reachable in CI → the
CI step no-ops gracefully; tl_* persists via generateStatic's `...prev` spread).
Set repo var `TL_API_BASE` to a hosted URL to run it in CI. UI: "DJ Support · 1001TL"
signal on artist profiles + How It Works methodology.

## Scene Score (editorial credibility layer + credibility floor)
`manual_scene_score` 0-100, weight **0.18** (co-leads with live_demand). Published rubric in How It Works
(SCENE_RUBRIC in App.jsx): Boiler Room/HÖR +20, Berghain/fabric/DC10 +20, festival
closing +15, respected label +15, RA/Mixmag/DJ Mag cover +10, Ibiza residency +10,
Essential Mix +10. Explicit criteria = credible + hard to game. Most of the roster
is hand-scored (editorial pass Jun 2026). Default for unscored artists = 50.
**Credibility multiplier — TWO-SIDED (score.js return map):** the final composite is
multiplied by `0.80 + 0.35*(scene/100)` — 0.80 at scene 0, ~0.98 at the unscored-50
default, 1.15 at scene 100. It both PENALISES near-zero scene AND REWARDS genuine
credibility. The two-sided form (v3) replaced the old one-sided floor
(`0.75 + 0.25*min(scene,50)/50`) because once conditioning made reach discriminate,
a scene-revered but streaming-invisible act (Ben UFO, Villalobos) was getting buried
by reach — the floor only punished low scene, it didn't lift high scene. Still demotes
the streaming-pop crossover hard (Hugel, scene 28, sits ~#127). Keep the factor in
sync with the How It Works "Credibility multiplier" note.

## Scene Geography / international appeal (audience-based)
`node backend/enrichSpotifyGeo.js [limit]` — pulls each artist's Spotify top listener
cities ("where people listen") via the Interceptor (`/api/spotify/artist/:id` now
returns `topCities`), stores `spotify_top_cities` [{city,country,listeners}] and a
`scene_geography` score 0-100 = share of top-city listeners in the core EM credibility
markets (Ibiza/Spain, Berlin/Germany, Amsterdam/NL, UK, Italy, France… — set lives in
both this script and `methodology.jsx`). Local-only (Interceptor), merge-safe, scriptLock,
resumable (`geo_intercept_at`). **Two axes, deliberately separate:** booking footprint
(RA `ra_top_regions` — where they're booked) vs audience geography (Spotify cities —
where they're heard). An act can be Euro-booked but US-listened; that gap is the point.
UI: the artist-profile "Scene Geography" strip (`sceneGeography` in methodology.jsx)
shows both — audience axis falls back to Google Trends countries until Spotify cities
populate. **Not yet weighted in score.js** — surfaced for review first ("see before
weight"); weight ~.05-.08 once real city data is validated against the labeled set.

## Composite weights (score.js, sum=1.00)
live_demand (RA+tour blend) .18 (CO-LEADS), scene .18 (CO-LEADS), beatport .15,
tl_support (1001TL) .10, listeners .08, trends .08, growth .06, label .05, yt_subs .04,
tiktok .03, releases .03, wikipedia .02. Then the **two-sided credibility multiplier**
scales the final score (see Scene Score section). RETIRED (0): track_pop
(Spotify-blocked), yt_views_weekly (delta metric, 0% coverage), beatport_hype (one
Beatport metric in primary rankings — Hype still collected for emerging views).
NORMALISATION (v3): heavy-tailed reach signals (listeners/yt/tiktok/releases/wiki) are
log-compressed and every signal is winsorised to its 1st–99th-percentile band before
min-max — so one streaming giant no longer compresses the field, and scores are stable
snapshot-to-snapshot. Mirrored in the frontend (computeRanges/normalize + cohort.js).
Self-healing: empty-field signals redistribute weight per-artist over signals present.
**Jun 2026 reweight v3 (post-conditioning):** once log+winsorize made reach actually
discriminate, its effective influence jumped, so reach was pulled DOWN (listeners
.12→.08, yt/tiktok/releases trimmed) and that weight moved to scene (.14→.18, now
co-leading), live_demand (→.18), beatport (→.15), 1001TL (→.10). The credibility
multiplier went two-sided so credible/low-reach acts aren't buried (Hugel still ~#127).
Keep score.js + frontend METRICS / METRIC_DETAILS + the How It Works note in sync.

## Predictive-validation history (the "our calls, scored" backtest data)
Three change-compressed time-series accrued in `generateStatic.js` (after rank/listeners
history, inside the `ranked` loop) so we can later PROVE the index was right — that a
"strong-buy" act's fee tier or room size actually rose after we flagged it. A ranking
that can show it was right is a different product than one that only looks plausible.
- `fee_history` [{d, sig, t, m, b}] — fee-tier OUTCOME (t=tier, m=mid, b=basis).
- `venue_history` [{d, sig, vt, aa, ta}] — room-size OUTCOME (vt=ra_venue_tier 1-5,
  aa=avg_attending, ta=top_attending snapshotted at each tier move).
- `value_call_history` [{d, sig, s, g, dt}] — the CALL being graded (s=value_signal,
  g=value_gap, dt=demand_tier).
Mechanics (`accrueChange` helper): records ONE point per real change with the **first-seen
date preserved** (not one/day — these move slowly, so a 90-day window would lose the
horizon; cap `MAX_HIST`=180 change-points ≈ unbounded). Merge-safe & sacred-rule compliant:
a null/empty reading leaves history untouched (never wipes a prior real reading), same-day
re-runs replace not duplicate. Snapshotted in generateStatic because it's the only
daily-cadence writer; fee/venue/value fields ride in via the `...prev` spread (they're
local-sourced — computeFees/enrichRA/enrichValueGap don't run in CI). Backtest grading:
freeze the call at date T (value_call_history), then read fee_history/venue_history at
T+6–12mo. NOTE: grade outcomes against the FEE/VENUE movement, not against the current
model's own re-scored signal (that would be circular).

## Key per-artist fields (in artists.json, persisted)
- `emerging` (bool) — reputation-based; drives "Ones to Watch" (excludes legends).
- `booking_fee` {label, mid, tier, color} — curated club/festival estimate.
- `debut_year` — iTunes-sourced (partial coverage).
- `youtube_channel_id` — cached UC id once resolved.
