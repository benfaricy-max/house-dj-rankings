/**
 * Unified LOCAL enrichment — fast, parallel, resilient.
 * Fetches YouTube + Mixcloud + TikTok + Google Trends for all artists.
 * - Concurrency pool (default 4)
 * - Per-source timeouts; any failure → null/skip, never blocks
 * - Progressive save every 5 artists (crash-safe)
 * - YouTube: search is quota-limited; once 429 hit, remaining YT → null,
 *   but resolved channel IDs are cached to artists.json for cheap future runs.
 * - Spotify: left as-is from existing rankings (cached).
 */
require("dotenv").config({ path: __dirname + "/.env" });
const path = require("path");
const fs   = require("fs");

const { getYouTubeData }        = require("./fetchArtist");
const { getMixcloudData }       = require("./fetchMixcloud");
const { getTikTokMentions }     = require("./fetchTikTok");
const { getGoogleTrends }       = require("./fetchTrends");
const { scrapeMonthlyListeners } = require("./fetchSpotifyScrape");

const RANKINGS = path.join(__dirname, "..", "frontend", "public", "rankings.json");
const ARTISTS  = path.join(__dirname, "artists.json");
const CONCURRENCY = 4;

const data     = JSON.parse(fs.readFileSync(RANKINGS, "utf8"));
const rankings = data.rankings;
const artistsFile = JSON.parse(fs.readFileSync(ARTISTS, "utf8"));
const artistById  = Object.fromEntries(artistsFile.map(a => [a.name, a]));

let youtubeQuotaDead = false;
let ytChannelUpdates = 0;
let done = 0;
const counts = { yt: 0, mc: 0, tt: 0, tr: 0, sp: 0 };

const withTimeout = (p, ms, fallback) =>
  Promise.race([p, new Promise(r => setTimeout(() => r(fallback), ms))]);

function save() {
  data.lastUpdated = new Date().toISOString();
  fs.writeFileSync(RANKINGS, JSON.stringify(data));
}

async function enrich(a) {
  // --- YouTube (skip search once quota is dead, but still try direct UC lookups) ---
  const ytId = a.youtube_channel_id || "";
  const canTryYT = ytId.startsWith("UC") || !youtubeQuotaDead;
  if (canTryYT) {
    const yt = await withTimeout(getYouTubeData(ytId), 12000, null);
    if (yt && yt.youtube_subscribers > 0) {
      a.youtube_subscribers = yt.youtube_subscribers;
      a.youtube_total_views = yt.youtube_total_views;
      counts.yt++;
      if (yt.resolved_channel_id && yt.resolved_channel_id !== ytId) {
        a.youtube_channel_id = yt.resolved_channel_id;
        if (artistById[a.name]) artistById[a.name].youtube_channel_id = yt.resolved_channel_id;
        ytChannelUpdates++;
      }
    } else if (yt === null) {
      // timeout or error — assume quota issue if it was a search
      if (!ytId.startsWith("UC")) youtubeQuotaDead = true;
    }
  } else {
    a.youtube_subscribers = a.youtube_subscribers ?? null;
  }

  // --- Mixcloud (fast HTTP; null on 404) ---
  if (a.mixcloud_username) {
    const mc = await withTimeout(getMixcloudData(a.mixcloud_username), 8000, null);
    if (mc && mc.mixcloud_followers > 0) {
      Object.assign(a, mc);
      counts.mc++;
    }
  }

  // --- TikTok (puppeteer; tight timeout, null on fail) ---
  if (a.tiktok_tag) {
    const tt = await withTimeout(getTikTokMentions(a.tiktok_tag), 14000, null);
    if (tt && tt.tiktok_post_count > 0) {
      a.tiktok_post_count = tt.tiktok_post_count;
      counts.tt++;
    }
  }

  // --- Google Trends (has own timeout; null on fail) ---
  const tr = await withTimeout(getGoogleTrends(a.name), 22000, null);
  if (tr && tr.score > 0) {
    a.google_trends_score      = tr.score;
    a.google_trends_direction  = tr.direction;
    a.google_trends_countries  = tr.top_countries ?? {};
    a.google_trends_cities     = tr.top_us_cities ?? {};
    counts.tr++;
  }

  // --- Spotify monthly listeners (puppeteer scrape; null on fail) ---
  if (a.spotify_id) {
    const ml = await withTimeout(scrapeMonthlyListeners(a.spotify_id), 20000, 0);
    if (ml > 0) { a.spotify_monthly_listeners = ml; counts.sp++; }
  }

  done++;
  if (done % 5 === 0) {
    save();
    process.stdout.write(`\r${done}/${rankings.length} | YT:${counts.yt} MC:${counts.mc} TT:${counts.tt} TR:${counts.tr} SP:${counts.sp}${youtubeQuotaDead ? " (YT quota hit)" : ""}   `);
  }
}

async function worker(queue) {
  while (queue.length) await enrich(queue.shift());
}

(async () => {
  console.log(`Enriching ${rankings.length} artists (concurrency ${CONCURRENCY})…`);
  const queue = [...rankings];
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)));
  save();
  if (ytChannelUpdates > 0) {
    fs.writeFileSync(ARTISTS, JSON.stringify(artistsFile, null, 2));
    console.log(`\nCached ${ytChannelUpdates} YouTube channel IDs → artists.json`);
  }
  console.log(`\nDONE. YT:${counts.yt} MC:${counts.mc} TT:${counts.tt} TR:${counts.tr} SP:${counts.sp} of ${rankings.length}`);
  process.exit(0);
})();
