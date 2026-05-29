require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cron = require("node-cron");
const { getSpotifyToken, getSpotifyData, getSpotifyTopTracks, getYouTubeData } = require("./fetchArtist");
const { scrapeMonthlyListeners } = require("./fetchSpotifyScrape");
const { getTikTokMentions } = require("./fetchTikTok");
const { getSoundCloudData } = require("./fetchSoundCloud");
const { getPlaylistPlacements } = require("./fetchSpotifyPlaylists");
const { getGoogleTrends } = require("./fetchTrends");
const { scoreArtists } = require("./score");
const { saveSnapshot, getLastWeekSnapshot, updateRank, getArtistHistory } = require("./db");
const { getArtistEvents } = require("./fetchEvents");
const artists = require("./artists.json");

const path = require("path");
const fs = require("fs");
const ARTISTS_PATH = path.join(__dirname, "artists.json");

const app = express();
app.use(cors());
app.use(express.json());

// In-memory cache — served instantly on every request
let cache = { rankings: [], lastUpdated: null, movers: null, onesToWatch: [] };

const delay = ms => new Promise(r => setTimeout(r, ms));

async function buildRankings() {
  console.log("[fetch] Starting rankings refresh for", artists.length, "artists…");
  const token = await getSpotifyToken();
  const enriched = [];

  for (const [i, artist] of artists.entries()) {
    if (i > 0) await delay(1500); // 1.5s between artists keeps us well under rate limits

    try {
      const [spotify, topTracks, monthlyListeners, tiktok, youtube, soundcloud, playlists, trends] = await Promise.all([
        getSpotifyData(artist.spotify_id, token),
        getSpotifyTopTracks(artist.spotify_id, token),
        scrapeMonthlyListeners(artist.spotify_id),
        getTikTokMentions(artist.tiktok_tag),
        getYouTubeData(artist.youtube_channel_id),
        getSoundCloudData(artist.soundcloud_permalink),
        getPlaylistPlacements(artist.spotify_id, token, artist),
        getGoogleTrends(artist.name),
      ]);

      const lastWeek = getLastWeekSnapshot(artist.name);
      const growthRate = lastWeek && lastWeek.spotify_followers > 0
        ? ((spotify.spotify_followers - lastWeek.spotify_followers) / lastWeek.spotify_followers) * 100
        : 0;

      const data = {
        ...artist,
        ...spotify,
        ...topTracks,
        spotify_monthly_listeners: monthlyListeners,
        ...tiktok,
        ...youtube,
        ...soundcloud,
        ...playlists,
        google_trends_score: trends.score,
        google_trends_direction: trends.direction,
        spotify_follower_growth_rate: growthRate,
      };

      saveSnapshot(artist.name, data);
      enriched.push(data);
      console.log(`[fetch] ${i + 1}/${artists.length} ${artist.name} ✓`);
    } catch (err) {
      console.warn(`[fetch] Failed for ${artist.name}:`, err.message);
    }
  }

  if (enriched.length === 0) throw new Error("All artist fetches failed");

  const ranked = scoreArtists(enriched);

  // Persist rank into each snapshot, then compute rank_change vs last week
  for (const dj of ranked) {
    updateRank(dj.name, dj.rank);
    const lastWeek = getLastWeekSnapshot(dj.name);
    dj.rank_change = (lastWeek?.rank != null) ? lastWeek.rank - dj.rank : null;
  }

  // Weekly movers — top 3 risers and fallers
  const withChange = ranked.filter(d => d.rank_change != null);
  const movers = {
    rising:  [...withChange].sort((a, b) => b.rank_change - a.rank_change).slice(0, 5).filter(d => d.rank_change > 0),
    falling: [...withChange].sort((a, b) => a.rank_change - b.rank_change).slice(0, 5).filter(d => d.rank_change < 0),
  };

  // Ones to watch — strong growth but not yet top 10
  const onesToWatch = ranked
    .filter(d => d.rank > 10 && d.spotify_follower_growth_rate > 0.3)
    .sort((a, b) => b.spotify_follower_growth_rate - a.spotify_follower_growth_rate)
    .slice(0, 6);

  cache = { rankings: ranked, lastUpdated: new Date().toISOString(), movers, onesToWatch };
  console.log("[fetch] Done. Rankings cached at", cache.lastUpdated);
  return cache;
}

// Serve from cache — instant response
app.get("/api/rankings", (req, res) => {
  if (!cache.rankings.length) {
    return res.status(503).json({ error: "Rankings not ready yet — check back in a moment." });
  }
  res.json(cache);
});

// Update manual scene score and re-rank in-memory
app.patch("/api/artists/:name/score", (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const score = Number(req.body.manual_scene_score);
  if (isNaN(score) || score < 0 || score > 100) {
    return res.status(400).json({ error: "score must be 0–100" });
  }

  const artistsData = JSON.parse(fs.readFileSync(ARTISTS_PATH, "utf8"));
  const idx = artistsData.findIndex(a => a.name === name);
  if (idx === -1) return res.status(404).json({ error: "Artist not found" });

  artistsData[idx].manual_scene_score = score;
  fs.writeFileSync(ARTISTS_PATH, JSON.stringify(artistsData, null, 2));

  // Re-rank from current cached data if available
  if (cache.rankings.length) {
    const updated = cache.rankings.map(a =>
      a.name === name ? { ...a, manual_scene_score: score } : a
    );
    cache = { rankings: scoreArtists(updated), lastUpdated: cache.lastUpdated };
  }

  res.json({ ok: true, name, manual_scene_score: score });
});

// Rank history for trend chart
app.get("/api/artists/:name/history", (req, res) => {
  const name = decodeURIComponent(req.params.name);
  res.json(getArtistHistory(name));
});

// Upcoming events via Bandsintown
app.get("/api/events/:name", async (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const events = await getArtistEvents(name);
  res.json(events);
});

// Manual refresh trigger
app.post("/api/refresh", async (req, res) => {
  try {
    const result = await buildRankings();
    res.json({ message: "Refreshed", count: result.rankings.length, lastUpdated: result.lastUpdated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Auto-refresh every 6 hours
cron.schedule("0 */6 * * *", () => {
  console.log("[cron] Scheduled refresh");
  buildRankings().catch(e => console.error("[cron] Error:", e.message));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[server] Running on http://localhost:${PORT}`);
  // Seed cache on startup (non-blocking)
  buildRankings().catch(e => console.error("[startup] Error:", e.message));
});
