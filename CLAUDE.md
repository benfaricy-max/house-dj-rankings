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
**ra_score formula lives in `backend/computeRaScore.js`** (shared by fetchRA + the
build) and is RECOMPUTED from the persisted aggregates every build via
`recomputeRaScores(enriched)` in generateStatic — it's no longer frozen at fetch time.
**v5 weighting devalues attending:** density 0.35 + venue tier 0.15 + geo 0.30 +
attending **0.20** (was attending 0.40 / density 0.25 / geo 0.20 / tier 0.15). RA
"attending" is soft RSVP/"interested" data — festival-inflated (a festival event
reports the whole-site crowd; Midland read avg 4094 against tier-2 clubs) and
cap-saturated at 500 — so it's the LEAST reliable input and no longer the largest;
weight moved to the hard structural facts (how OFTEN + how WIDELY booked). Keep the
weights in `computeRaScore.js` (the only place they live now).

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
Weight 0.10 in score.js, and it SELF-HEALS ON ABSENCE (v4): it's a single-WEEK
chart, so 250/330 acts read 0 (not on this week's chart ≠ no DJ support). A 0 is
treated as unmeasured — its weight redistributes over the act's present signals
(`SELF_HEAL_ABSENT` in score.js) instead of scoring a structural 0 and docking
coverage. This was burying live-headliner DJ's-DJs who don't chart a track every
week (Jamie Jones, Capriati, the Martinez Brothers). **Local-only by default**
(API not reachable in CI → the CI step no-ops gracefully; tl_* persists via
generateStatic's `...prev` spread).
Set repo var `TL_API_BASE` to a hosted URL to run it in CI. UI: "DJ Support · 1001TL"
signal on artist profiles + How It Works methodology.

## Scene Score (editorial credibility layer + credibility floor)
`manual_scene_score` 0-100, weight **0.20** (co-leads with live_demand). Published rubric in How It Works
(SCENE_RUBRIC in App.jsx): Boiler Room/HÖR +20, Berghain/fabric/DC10 +20, festival
closing +15, respected label +15, RA/Mixmag/DJ Mag cover +10, Ibiza residency +10,
Essential Mix +10. Explicit criteria = credible + hard to game. Most of the roster
is hand-scored (editorial pass Jun 2026). Default for unscored artists = 50.
**Credibility multiplier (score.js return map):** the final composite is
multiplied by `0.80 + 0.20*(scene/100)` — 0.80 at scene 0, 0.90 at the unscored-50
default, 1.00 at scene 100. **v5 NARROWED the swing** (was `0.80 + 0.35*`, range
0.80→1.15): scene was DOUBLE-COUNTED — already a 0.20-weighted signal AND a wide
multiplier, so a scene-88 heritage act got ~+11% on top of its weighted scene term,
lifting reputation-coasting names (Garnier, DJ Koze, Kerri Chandler) above their
current live heat. Narrowed, it's a DOWNSIDE credibility floor (a near-zero-scene
streaming-pop crossover is still demoted) without handing high scene a second large
bonus. Keep `score.js` + `cohort.js` (`cred`) + this note in sync.
The two-sided v3 form (`0.80 + 0.35*`) had replaced the old one-sided floor
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
populate. **Weighted 0.03 in score.js (v4)** — a deliberately small nudge: enough to
demote a single-market act (Mau P) without over-punishing non-European acts the
labelled set rates (Mochakk, Beltran). SELF-HEALS ON ABSENCE (same `SELF_HEAL_ABSENT`
mechanic as 1001TL): the 67/330 acts without a Spotify-cities pull are treated as
unmeasured (weight redistributes) rather than scored as zero international appeal.

## Festival presence signal (the live demand RA + Beatport miss)
`backend/computeFestivalScore.js` (run in generateStatic BEFORE scoreArtists, after
computeLiveDemand). `festival_score` 0-100 = `min(Σ festival_tier, 6)/6*100` from
`backend/festival_lineups.json` (festival → tier → acts; T1 global flagship=1.0,
T2 regional=0.6). Captures who's booked on the big stages — the US-festival/viral
demand RA (club-skewed/Euro) and Beatport (track-charting) structurally miss
(Disco Lines, Gordo, Hugel were buried with no RA profile + bp 0). Weight **0.05**,
SELF-HEALS ON ABSENCE (an act on no tracked lineup is unmeasured, weight redistributes
— only LIFTS festival acts, never penalises club-only ones). Weight values come from
TWO merged files (computeFestivalScore.loadFestivalWeights, deduped by festival name):
(1) `festival_lineups.json` — AUTO-SCRAPED by `backend/fetchFestivals.js` (act-centric:
matches each artist's Songkick events against a 25-festival registry; merge-safe;
runs daily in refresh.yml). Songkick is European-summer skewed, so (2)
`festival_overrides.json` — a HAND-VERIFIED supplement for confirmed US-festival/viral
bookings the scraper misses (Disco Lines/Gordo @ EDC/Coachella). Maintain (2) manually;
the scraper owns (1). Names MUST match rankings.json exactly (mismatch self-heals).
`computeFestivalScores` is AUTHORITATIVE — it CLEARS festival_score for acts no longer
on any lineup (else generateStatic's `...prev` spread goes stale). Mirror in frontend
METRICS / METRIC_DETAILS + cohort.js (`C_SELF_HEAL`).

## Composite weights (score.js, sum=1.00) — v5.1
live_demand (RA+tour blend) **.17** (LEADS), scene .20 (CO-LEADS), beatport **.13**,
tl_support (1001TL) **.11**, trends **.08**, growth **.07**, **festival .05**, scene_geography .03, label .05,
listeners .05, yt_subs **.02**, tiktok **.01**, releases **.02**, wikipedia **.01**. Then the
**credibility multiplier** (now `0.80 + 0.20*scene`, narrowed — see Scene Score section)
scales the final score.
**Jun 2026 reweight v5 (attending-unreliability + namesake/zero-data pass):** a second
labelled-acts review (8 "too high" + 6 "too low" calls). (1) RA "attending" — soft,
festival-inflated RSVP data — was devalued INSIDE ra_score (0.40→0.20, see RA section)
AND the composite leaned off live_demand (.21→.17) onto the harder-to-game signals the
calls implied: beatport .12→.13, 1001TL .10→.11, trends .07→.08, growth .06→.07. (2)
Scene credibility multiplier narrowed 0.80+0.35→0.80+0.20 (scene was double-counted —
demoted reputation-coasting heritage: Garnier, Koze, Kerri). (3) `spotify_monthly_listeners`
now SELF-HEALS ON ABSENCE — ~19 real acts (Carola, Luciano, ARTBAT, Moodymann, Lane 8…)
read 0 only because the local Spotify scrape didn't reach them; that 0 was burying them
on reach + docking coverage (0 = unmeasured here, no roster act truly has zero listeners).
(4) `TRENDS_NAMESAKE` set (score.js + cohort.js): Google Trends for common-word/namesake
acts (Midland — a US country duo / Texas city) is treated as unmeasured, not scored on a
contaminated value (Midland read trends 85 vs ≤11 for every DJ peer). KNOWN model-vs-gut
residuals (not bugs): Ben Böhmer & Bob Sinclar stay high (real global touring / real
catalog streaming); Disco Lines stays low (no RA profile exists + not Beatport-charting —
structurally invisible, needs a TikTok-growth / festival signal, not a reweight).
**v5.1 (festival signal):** added `festival_score` 0.05 — the festival-presence signal
that finally reaches the structurally-invisible class above (Disco Lines, Gordo, Hugel),
funded by halving gameable tiktok_post_count (.03→.01) + trims to yt_subs (.03→.02),
releases (.03→.02), wikipedia (.02→.01). See the Festival presence section above.
RETIRED (0): track_pop (Spotify-blocked), yt_views_weekly (delta metric, 0% coverage),
beatport_hype (one Beatport metric in primary rankings — Hype still collected for
emerging views). NORMALISATION (v3): heavy-tailed reach signals
(listeners/yt/tiktok/releases/wiki) are log-compressed and every signal is winsorised
to its 1st–99th-percentile band before min-max — so one streaming giant no longer
compresses the field, and scores are stable snapshot-to-snapshot. Mirrored in the
frontend (computeRanges/normalize + cohort.js). Self-healing has TWO forms: (a)
empty-FIELD signals redistribute weight field-wide; (b) `SELF_HEAL_ABSENT` signals
(tl_support, scene_geography) redistribute PER-ARTIST when absent for that act — a
per-artist denominator, so a structurally-sparse signal's 0 never scores as a real low.
**Jun 2026 reweight v3 (post-conditioning):** once log+winsorize made reach actually
discriminate, its effective influence jumped, so reach was pulled DOWN (listeners
.12→.08, yt/tiktok/releases trimmed) and that weight moved to scene (.14→.18),
live_demand (→.18), beatport (→.15), 1001TL (→.10). The credibility multiplier went
two-sided so credible/low-reach acts aren't buried (Hugel still ~#127).
**Jun 2026 reweight v4 (sniff-test pass):** a manual review of the labelled set found
two mechanical biases. (1) beatport (a PRODUCER/track-sales signal) over-ranked chart
producers while live headliners sank → beatport .15→.12, weight to live_demand (→.21,
the clear lead) + scene (→.20). (2) scene_geography turned ON at .03 (reach trimmed to
fund it: listeners .08→.05, yt .04→.03, trends .08→.07). (3) tl_support + scene_geography
now self-heal on absence (above) — fixed a coverage-as-zero bug burying live-only
DJ's-DJs. Net vs the labelled set: Adam Beyer #4→#8, Green Velvet →#14, Adriatique →#29,
Tiga →#42 (down); Jamie Jones →#23, Capriati →#70, Martinez Brothers #220→#91 (up, the
last also an RA-slug data fix: `themartinezbros`). Tuned vector scored ~82% on intent;
the residual misses (Township Rebellion rises on RA's underground-Euro bias, Mochakk
falls because his strengths are beatport+reach) are genuine model-vs-gut disagreements,
not bugs. Keep score.js + frontend METRICS / METRIC_DETAILS + the How It Works note in sync.

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

## Methodology hardening (Jun 2026 external review)
Four review findings on the index, and how each was handled:
- **Seasonality.** Booking demand is seasonal (Ibiza season, festival summer, ADE) and
  the leading signal (live_demand) is the seasonal one. No seasonal model yet; for now
  the How It Works page carries a "point-in-time reading" note (the index is a snapshot,
  refreshed daily; a summer vs winter reading isn't directly comparable, live signals run
  higher in season). Roadmap: normalise live signals against a trailing 12-mo seasonal curve.
- **Scene Score single-rater + additive-to-cap.** (1) Versioned + dated — `backend/scene_scores.json`
  is a dated ledger (version `2026.06.1`), surfaced in How It Works. (2) Reliability —
  `backend/sceneReliability.js` re-scores the credentialed acts independently from the
  published rubric using a SATURATING (diminishing-returns) curve `100*(1-e^(-0.029*S))`
  instead of an additive hard cap, and reports agreement vs the hand scores (Pearson r,
  MAE, % within ±15). Current r≈0.41 / MAE≈15 is tag-coverage-limited (only ~50 acts carry
  `scene_tags`), NOT published on-site until tag coverage is filled out. Live hand scores
  are NOT yet recomputed from the curve (can't — most acts lack tags); the curve is the
  audit + go-forward method. How It Works states scores are "moving from a hard cap to
  diminishing returns," which is accurate (not yet applied to live values).
- **Genre split.** Verified the headline index normalises FIELD-WIDE (one 1st–99th
  winsorised range, score.js), not per-genre — so a Beatport misclassification does NOT
  shuffle acts between renormalising pools in the main rank. The House/Techno split is a
  pure display filter (a "lens, not a verdict," already stated in How It Works). No fix needed.
- **Gameable signals.** `tiktok_post_count` (hashtag volume, gameable) was reviewed for
  removal but KEPT at low weight (0.03) because it's the only TikTok signal with real
  coverage (~75% in rankings.json; followers/engagement = 0%, not collected). Decision:
  coverage beats purity at this weight, and low weight caps the gaming damage. ROADMAP:
  build a TikTok follower scraper into fetchTikTok.js, accrue snapshots, then swap the 0.03
  weight to `tiktok_follower_growth_rate` once it clears ~50% coverage (less gameable, but
  0% covered today — weighting it now would silently zero out TikTok via self-healing).

## Rank 2.0 (experimental, parallel weighting) — Reports tab
An ALTERNATE weight vector run alongside production so the two rankings compare
side-by-side; production (live_demand LEADS) stays the default. `WEIGHTS_V2` in
`backend/score.js`; `generateStatic.js` runs `scoreArtists` twice and merges the
second pass as `score_v2` / `rank_v2` onto each artist in rankings.json.
Vector (discovery-leaning — pulls weight OFF booking onto scene/DJ-support/search/reach):
scene .186, dj_support .1395, trends .093, listeners .0744, tiktok .0744, wikipedia .0744,
releases .0651, live_demand .0558, beatport .0558, youtube .0465, scene_geo .0372,
label .0279 — i.e. the 12 requested weights (scene 20 / dj 15 / trends 10 / listeners 8 /
tiktok 8 / wiki 8 / releases 7 / live 6 / beatport 6 / youtube 5 / intl 4 / label 3) scaled
by 0.93, with growth .07 KEPT at production weight so the sum stays 1.00. festival_score is
DROPPED from 2.0 (explicit 0 in WEIGHTS_V2 — else base 0.05 carries over via Object.assign):
a simpler 2.0 methodology that doesn't lean on hand-maintained festival_lineups.json.
Production still weights festival .05 — only 2.0 drops it.
Self-heal + credibility/coverage multipliers are applied identically (scoreArtists is
weight-agnostic). UI: a `RankV2Report` in the **Reports** tab (`view==="rankv2"` inside
ReportsPage, same pattern as the Charts report) — weight-diff table, 2.0 leaderboard, and
biggest prod-vs-2.0 divergences. NOT a sort mode on the Rankings tab (deliberately kept off
the live list). Keep `WEIGHTS_V2` (score.js) + `RANK_V2_WEIGHTS` (App.jsx) in sync.

## Key per-artist fields (in artists.json, persisted)
- `emerging` (bool) — reputation-based; drives "Ones to Watch" (excludes legends).
- `booking_fee` {label, mid, tier, color} — curated club/festival estimate.
- `debut_year` — iTunes-sourced (partial coverage).
- `youtube_channel_id` — cached UC id once resolved.
