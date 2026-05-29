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

const delay = ms => new Promise(r => setTimeout(r, ms));

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
        getTikTokMentions(artist.tiktok_tag),
        getYouTubeData(artist.youtube_channel_id),
        getSoundCloudData(artist.soundcloud_permalink),
        getMixcloudData(artist.mixcloud_username),
        getGoogleTrends(artist.name),
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

      enriched.push({
        ...artist, ...spotifyCache, ...tiktok,
        ...youtube, ...soundcloud, ...mixcloud,
        spotify_playlist_placements: artist.album_count ?? 0,
        youtube_views_weekly,
        google_trends_score:     trends.score,
        google_trends_direction: trends.direction,
        google_trends_countries: trends.top_countries ?? {},
        google_trends_cities:    trends.top_us_cities ?? {},
        spotify_monthly_listeners: spotifyCache.spotify_monthly_listeners ?? spotifyCache.spotify_followers ?? 0,
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
