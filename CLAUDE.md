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

## Beatport signal (core credibility)
`beatport_score` 0-100 from genre Top-100 charts: positionScore(101−best)·0.6 +
trackBreadth·0.25 + crossGenreReach·0.15. Powers the "DJ's DJ" benchmark axis
(high Beatport + low Spotify = scene-respected, not yet mainstream).

## Key per-artist fields (in artists.json, persisted)
- `emerging` (bool) — reputation-based; drives "Ones to Watch" (excludes legends).
- `booking_fee` {label, mid, tier, color} — curated club/festival estimate.
- `debut_year` — iTunes-sourced (partial coverage).
- `youtube_channel_id` — cached UC id once resolved.
