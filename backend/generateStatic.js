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
const { scoreArtists }          = require("./score");

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
        youtube_views_weekly: keep(youtube_views_weekly, prev.youtube_views_weekly),
        mixcloud_followers:        keep(mixcloud.mixcloud_followers, prev.mixcloud_followers),
        mixcloud_play_count_total: keep(mixcloud.mixcloud_play_count_total, prev.mixcloud_play_count_total),
        spotify_playlist_placements: artist.album_count ?? 0,
        google_trends_score:     keep(trends.score, prev.google_trends_score),
        google_trends_direction: trends.score > 0 ? trends.direction : (prev.google_trends_direction ?? "stable"),
        google_trends_countries: (trends.top_countries && Object.keys(trends.top_countries).length) ? trends.top_countries : (prev.google_trends_countries ?? {}),
        google_trends_cities:    (trends.top_us_cities && Object.keys(trends.top_us_cities).length) ? trends.top_us_cities : (prev.google_trends_cities ?? {}),
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

  const ranked = scoreArtists(enriched);
  ranked.forEach((dj, i) => { dj.rank = i + 1; });

  // Append today's rank to each artist's history (one point/day, keep ~90 days).
  // Powers the historical rank chart on profile pages. Merge-safe — only grows.
  const today = new Date().toISOString().slice(0, 10);
  for (const dj of ranked) {
    const prevHist = prevRankings[dj.name]?.rank_history ?? [];
    const hist = prevHist.filter(p => p.d !== today);
    hist.push({ d: today, r: dj.rank });
    dj.rank_history = hist.slice(-90);

    // Listener history → real listener-growth for ALL artists as it accumulates.
    const prevLH = prevRankings[dj.name]?.listeners_history ?? [];
    const lh = prevLH.filter(p => p.d !== today);
    const ml = dj.spotify_monthly_listeners || 0;
    if (ml > 0) lh.push({ d: today, l: ml });
    dj.listeners_history = lh.slice(-90);
    if (lh.length >= 2 && dj.listener_growth_source !== "kworb") {
      const cur = lh[lh.length - 1].l;
      const target = Date.now() - 7 * 864e5;
      let base = lh[0];
      for (const p of lh) if (new Date(p.d).getTime() <= target) base = p;
      if (base.l > 0 && cur > 0) dj.spotify_follower_growth_rate = Math.round((cur - base.l) / base.l * 1000) / 10;
    }
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
