/**
 * Generates a static rankings.json snapshot.
 * Run locally or via GitHub Actions:  node generateStatic.js
 *
 * Quota optimisation: after resolving a YouTube channel via search (100 units),
 * the real channel ID (UC...) is written back to artists.json so future runs
 * use a direct lookup (1 unit). Over 264 artists this saves ~26,000 units/day.
 */
require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const path = require("path");
const fs   = require("fs");

const { getSpotifyToken, getSpotifyData, getSpotifyTopTracks, getYouTubeData } = require("./fetchArtist");
const { getTikTokMentions }     = require("./fetchTikTok");
const { getMixcloudData }       = require("./fetchMixcloud");
const { getSoundCloudData }     = require("./fetchSoundCloud");
const { getPlaylistPlacements } = require("./fetchSpotifyPlaylists");
const { getGoogleTrends }       = require("./fetchTrends");
const { scoreArtists, WEIGHTS_V2 } = require("./score");
const { computeLiveDemand }     = require("./computeLiveDemand");
const { recomputeRaScores }     = require("./computeRaScore");
const { computeFestivalScores } = require("./computeFestivalScore");

const ARTISTS_FILE = path.join(__dirname, "artists.json");
const SNAP_FILE    = path.join(__dirname, "data", "snapshots.json");
const OUT_FILE     = path.join(__dirname, "..", "frontend", "public", "rankings.json");

const artists = JSON.parse(fs.readFileSync(ARTISTS_FILE, "utf8"));

// Load previous snapshots to compute youtube_views_weekly
let snapshots = {};
try { snapshots = JSON.parse(fs.readFileSync(SNAP_FILE, "utf8")); } catch {}

// Load EXISTING rankings so we never wipe a metric we couldn't fetch this run
// (e.g. TikTok needs puppeteer, unavailable in CI). Merge-safe: keep prior value.
let prevRankings = {};
try {
  const rj = JSON.parse(fs.readFileSync(OUT_FILE, "utf8"));
  prevRankings = Object.fromEntries((rj.rankings ?? []).map(r => [r.name, r]));
} catch {}
const keep = (next, prev) => (next && next > 0) ? next : (prev || 0);

// Change-compressed history accrual for slow-moving signals (fee tier, venue tier,
// value-signal calls). Unlike rank_history (one point/day for a 90-day chart), these
// record ONE point per actual change and preserve the first-seen date — so months
// later we can prove a "strong-buy" act's fee tier or room size actually rose. The
// `sig` is the comparison key; ride-along fields (mid, attendance) snapshot at the
// moment of change. Merge-safe: a null/empty reading today leaves history untouched
// (never wipes a prior real reading); same-day re-runs replace, never duplicate.
const MAX_HIST = 180; // change-points; tiers move slowly → effectively unbounded horizon
function accrueChange(prevHist, today, point, sig) {
  if (point == null) return Array.isArray(prevHist) ? prevHist : []; // no real reading → preserve
  const hist = (Array.isArray(prevHist) ? prevHist : []).filter(p => p.d !== today);
  const last = hist[hist.length - 1];
  if (!last || last.sig !== sig) hist.push({ d: today, sig, ...point });
  return hist.slice(-MAX_HIST);
}

// Sanity-gate weekly listener growth. A jump computed across a measurement-basis
// change (old scrape value → fresh Interceptor value) or off a tiny denominator
// produces fabricated spikes (e.g. Blawan 54,866→530,781 = +867%). For a "data,
// not hype" product, publish NOTHING rather than a glitch: return null so it
// self-heals in the composite and shows "—" in the UI. Real weekly listener moves
// almost never exceed ±60%; bases under 1k blow up the percentage.
const GROWTH_CAP = 60, GROWTH_BASE_MIN = 1000;
const sanitizeGrowth = (pct, base) =>
  (Number.isFinite(pct) && Math.abs(pct) <= GROWTH_CAP && base >= GROWTH_BASE_MIN) ? pct : null;

const delay = ms => new Promise(r => setTimeout(r, ms));

// Hard per-fetch timeout. A single stalled socket (no response, never rejects)
// used to hang the whole Promise.all and burn the 6h job limit. This guarantees
// every fetch settles, so the loop always finishes and the commit step runs.
const withTimeout = (promise, ms, fallback) =>
  Promise.race([
    Promise.resolve(promise).catch(() => fallback),
    new Promise(r => setTimeout(() => r(fallback), ms)),
  ]);

async function main() {
  console.log(`Fetching data for ${artists.length} artists (Spotify from cache, live: YouTube/Trends/TikTok/Mixcloud)…`);
  const enriched = [];
  let channelIdUpdates = 0;

  for (const [i, artist] of artists.entries()) {
    if (i > 0) await delay(2500);
    if (i > 0 && i % 60 === 0) {
      console.log(`\n[pause] ${i} done — resting 20s…`);
      await delay(20000);
    }
    try {
      // Always use cached Spotify data — avoids rate limits entirely
      const prevSnap = snapshots[artist.name]?.slice(-1)[0];
      const spotifyCache = prevSnap ?? {
        spotify_followers: 0, spotify_monthly_listeners: 0,
        spotify_avg_track_popularity: 0, spotify_top_track_score: 0,
        name: artist.name, image: null, spotify_url: null,
      };

      const [tiktok, youtube, soundcloud, mixcloud, trends] = await Promise.all([
        withTimeout(getTikTokMentions(artist.tiktok_tag), 15000, {}),
        withTimeout(getYouTubeData(artist, { allowSearch: true }), 30000, {}), // accurate search resolution; caches UC id so it's 1u next time. ~90/day fit in quota, completes over a few days.
        withTimeout(getSoundCloudData(artist.soundcloud_permalink), 15000, {}),
        withTimeout(getMixcloudData(artist.mixcloud_username), 15000, {}),
        withTimeout(getGoogleTrends(artist.search_alias || artist.name), 25000, {}), // search_alias disambiguates common names (e.g. "Rebekah techno")
      ]);

      // Cache resolved YouTube channel ID back to artists.json to save quota
      if (youtube.resolved_channel_id && youtube.resolved_channel_id !== artist.youtube_channel_id) {
        artist.youtube_channel_id = youtube.resolved_channel_id;
        channelIdUpdates++;
      }

      // Compute weekly YouTube views from snapshot diff
      const prevTotal = prevSnap?.youtube_total_views || 0;
      const currTotal = youtube.youtube_total_views || 0;
      const youtube_views_weekly = prevTotal > 0 && currTotal >= prevTotal
        ? currTotal - prevTotal
        : 0;

      // Merge-safe: only overwrite a metric if THIS run fetched a real value;
      // otherwise preserve whatever's already live (e.g. locally-scraped TikTok).
      const prev = prevRankings[artist.name] ?? {};
      enriched.push({
        ...prev, ...artist, ...spotifyCache,
        ...soundcloud,
        // image: keep a real image if we have one
        image: artist.image ?? spotifyCache.image ?? prev.image ?? null,
        // A null/empty tiktok_tag means the hashtag is too generic to be a clean
        // signal (e.g. "alignment" catches unrelated content) — force 0 so the
        // old inflated value is never resurrected by keep().
        tiktok_post_count:    artist.tiktok_tag ? keep(tiktok.tiktok_post_count, prev.tiktok_post_count) : 0,
        youtube_subscribers:  keep(youtube.youtube_subscribers, prev.youtube_subscribers),
        youtube_total_views:  keep(youtube.youtube_total_views, prev.youtube_total_views),
        // Freshness stamp: refresh only when THIS run fetched a real value (else keep prev).
        youtube_updated:      youtube.youtube_subscribers > 0 ? new Date().toISOString() : (prev.youtube_updated ?? null),
        youtube_views_weekly: keep(youtube_views_weekly, prev.youtube_views_weekly),
        mixcloud_followers:        keep(mixcloud.mixcloud_followers, prev.mixcloud_followers),
        mixcloud_play_count_total: keep(mixcloud.mixcloud_play_count_total, prev.mixcloud_play_count_total),
        spotify_playlist_placements: artist.album_count ?? 0,
        google_trends_score:     keep(trends.score, prev.google_trends_score),
        google_trends_direction: trends.score > 0 ? trends.direction : (prev.google_trends_direction ?? "stable"),
        google_trends_updated:   trends.score > 0 ? new Date().toISOString() : (prev.google_trends_updated ?? null),
        google_trends_countries: (trends.top_countries && Object.keys(trends.top_countries).length) ? trends.top_countries : (prev.google_trends_countries ?? {}),
        // google_trends_cities retired (all-zeros / noise) — see ra_recent_cities for real city demand.
        spotify_monthly_listeners: keep(spotifyCache.spotify_monthly_listeners ?? spotifyCache.spotify_followers, prev.spotify_monthly_listeners),
        // RA fields: never fetched in CI (requires local enrichRA.js run) — always preserve prev
        ra_slug:          prev.ra_slug          ?? null,
        ra_followers:     prev.ra_followers      ?? 0,
        ra_upcoming:      prev.ra_upcoming       ?? 0,
        ra_events_6m:     prev.ra_events_6m      ?? 0,
        ra_avg_attending: prev.ra_avg_attending  ?? 0,
        ra_top_attending: prev.ra_top_attending  ?? 0,
        ra_attending_h1:  prev.ra_attending_h1   ?? 0,
        ra_attending_h2:  prev.ra_attending_h2   ?? 0,
        ra_venue_tier:    prev.ra_venue_tier      ?? 0,
        ra_countries:     prev.ra_countries       ?? 0,
        ra_country_list:  prev.ra_country_list    ?? [],
        ra_top_regions:   prev.ra_top_regions     ?? [],
        ra_top_venues:    prev.ra_top_venues      ?? [],
        ra_score:         prev.ra_score           ?? 0,
        ra_updated:       prev.ra_updated         ?? null,
      });
      process.stdout.write(`\r${i + 1}/${artists.length} ${artist.name}   `);
    } catch (err) {
      console.warn(`\n  skip ${artist.name}: ${err.message?.slice(0, 60)}`);
    }
  }

  // Write back any newly resolved YouTube channel IDs
  if (channelIdUpdates > 0) {
    fs.writeFileSync(ARTISTS_FILE, JSON.stringify(artists, null, 2));
    console.log(`\nCached ${channelIdUpdates} YouTube channel IDs → artists.json`);
  }

  if (enriched.length === 0) {
    console.log("All fetches failed (likely rate limited) — keeping existing rankings.json");
    process.exit(0);
  }

  // Recompute ra_score from its persisted components every build (v5: ra_score is
  // no longer frozen at fetch time — keeps the RA weighting current and consistent
  // with the components). Must run BEFORE computeLiveDemand, which reads ra_score.
  recomputeRaScores(enriched);

  // Blend RA + Songkick tour into live_demand_score (+ flag RA under-coverage)
  // before scoring, so the leading booking signal isn't single-sourced on RA.
  computeLiveDemand(enriched);

  // Major-festival booking presence (festival_lineups.json) — the live demand RA +
  // Beatport miss for US-festival/viral acts. Self-heals on absence; safe no-op if
  // the lineup file is empty/missing.
  computeFestivalScores(enriched);

  const ranked = scoreArtists(enriched);
  ranked.forEach((dj, i) => { dj.rank = i + 1; });

  // Rank 2.0 (parallel) — same pipeline, alternate weight vector (WEIGHTS_V2 in
  // score.js). Run as a second independent pass and merge score_v2 / rank_v2 onto
  // the production ranking so the frontend can offer a "Rank 2.0" sort toggle
  // without changing the default order. Self-heal + credibility/coverage logic is
  // identical (scoreArtists applies it to whatever weights it's handed).
  const v2 = scoreArtists(enriched, WEIGHTS_V2);
  const v2ByName = new Map(v2.map(d => [d.name, d]));
  for (const dj of ranked) {
    const m = v2ByName.get(dj.name);
    if (m) { dj.score_v2 = m.score; dj.rank_v2 = m.rank; }
  }

  // Append today's rank to each artist's history (one point/day, keep ~90 days).
  // Powers the historical rank chart on profile pages. Merge-safe — only grows.
  const today = new Date().toISOString().slice(0, 10);
  for (const dj of ranked) {
    const prevHist = prevRankings[dj.name]?.rank_history ?? [];
    const hist = prevHist.filter(p => p.d !== today);
    hist.push({ d: today, r: dj.rank });
    dj.rank_history = hist.slice(-90);

    // Weekly rank movement, derived from the history we just appended (mirrors
    // server.js: positive = climbed, i.e. the rank number fell). Compare against
    // the most recent snapshot that is ≥7 days old; before a week of history
    // exists, fall back to the oldest point so early movement still shows. Stays
    // null with only today's point — never fabricates a delta. Powers the RankDelta
    // arrows and the live hero's "This week's movers".
    const weekAgo = Date.now() - 7 * 864e5;
    let basePt = null;
    for (const p of dj.rank_history) {
      if (p.d === today) continue;
      if (new Date(p.d).getTime() <= weekAgo) basePt = p;   // latest point ≥7d old
    }
    if (!basePt) basePt = dj.rank_history.find(p => p.d !== today) ?? null;  // else oldest prior
    dj.rank_change = (basePt && Number.isFinite(basePt.r)) ? basePt.r - dj.rank : null;

    // Listener history → real listener-growth for ALL artists as it accumulates.
    const prevLH = prevRankings[dj.name]?.listeners_history ?? [];
    const lh = prevLH.filter(p => p.d !== today);
    const ml = dj.spotify_monthly_listeners || 0;
    if (ml > 0) lh.push({ d: today, l: ml });
    dj.listeners_history = lh.slice(-90);
    // Intercept-sourced listeners (../intercept pipeline) are reliable enough to
    // trust history-based growth even over a stale kworb flag — they drive both
    // the number and its growth. Otherwise keep a fresh kworb value if present.
    const interceptSourced = dj.listener_source === "intercept";
    if (lh.length >= 2 && (interceptSourced || dj.listener_growth_source !== "kworb")) {
      // Compute weekly growth from history (≥2 snapshots available).
      const cur = lh[lh.length - 1].l;
      const target = Date.now() - 7 * 864e5;
      let base = lh[0];
      for (const p of lh) if (new Date(p.d).getTime() <= target) base = p;
      if (base.l > 0 && cur > 0) {
        const raw = Math.round((cur - base.l) / base.l * 1000) / 10;
        const safe = sanitizeGrowth(raw, base.l);
        if (safe != null) { dj.spotify_follower_growth_rate = safe; dj.listener_growth_source = "history"; }
        else { dj.spotify_follower_growth_rate = null; dj.listener_growth_source = null; }   // glitch/basis-change → no number
      }
    } else if (dj.listener_growth_source !== "kworb") {
      // Fallback: fewer than 2 history snapshots — derive growth from kworb's
      // listener_daily_delta if present in prev (merge-safe: never wipes kworb data).
      const prevDelta = prevRankings[dj.name]?.listener_daily_delta;
      const prevListeners = prevRankings[dj.name]?.spotify_monthly_listeners || ml;
      if (Number.isFinite(prevDelta) && prevListeners > 0) {
        const weeklyPct = sanitizeGrowth(Math.round((prevDelta / prevListeners) * 7 * 1000) / 10, prevListeners);
        if (weeklyPct != null) {
          dj.spotify_follower_growth_rate = weeklyPct;
          dj.listener_daily_delta = prevDelta;
          dj.listener_growth_source = "kworb";
        }
      }
    }

    // ── Predictive-validation history ──────────────────────────────────────
    // Snapshot the slow-moving OUTCOMES (fee tier, room size) and the CALL
    // (value-signal) so a future "our calls, scored" backtest can show that a
    // strong-buy act's fee/venue actually rose after we flagged it. Change-
    // compressed + merge-safe (see accrueChange): records only real movement,
    // never fabricates, never wipes. Snapshotted here because generateStatic is
    // the only daily-cadence writer; fee/venue/value fields ride in via ...prev.
    const prevDj = prevRankings[dj.name] ?? {};

    // Fee outcome — tier is the claim ("fee rose"); mid/basis ride along.
    const feeTier = dj.booking_fee?.tier;
    dj.fee_history = accrueChange(
      prevDj.fee_history, today,
      feeTier != null ? { t: feeTier, m: dj.booking_fee?.mid ?? null, b: dj.booking_fee?.basis ?? null } : null,
      feeTier != null ? `${feeTier}|${dj.booking_fee?.basis ?? ""}` : null,
    );

    // Room-size outcome — venue tier (1-5) is the discrete claim; attendance snapshots at each move.
    const vt = dj.ra_venue_tier;
    dj.venue_history = accrueChange(
      prevDj.venue_history, today,
      vt > 0 ? { vt, aa: dj.ra_avg_attending ?? 0, ta: dj.ra_top_attending ?? 0 } : null,
      vt > 0 ? String(vt) : null,
    );

    // The CALL we're grading later — value signal + gap (+ demand tier for context).
    const vs = dj.value_signal;
    dj.value_call_history = accrueChange(
      prevDj.value_call_history, today,
      vs ? { s: vs, g: dj.value_gap ?? null, dt: dj.demand_tier ?? null } : null,
      vs ? `${vs}|${dj.value_gap ?? ""}` : null,
    );
  }

  const onesToWatch = ranked
    .filter(d => d.rank > 10 && (!d.spotify_monthly_listeners || d.spotify_monthly_listeners < 500_000))
    .slice(0, 50);

  const payload = {
    rankings:    ranked,
    onesToWatch,
    movers:      { rising: [], falling: [] },
    lastUpdated: new Date().toISOString(),
  };

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(payload));
  console.log(`\nSaved ${ranked.length} artists → ${OUT_FILE}`);
}

main().catch(e => { console.error(e); process.exit(1); });
