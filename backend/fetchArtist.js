const axios = require("axios");
require("dotenv").config();

// --- SPOTIFY ---
async function getSpotifyToken() {
  const credentials = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");

  const res = await axios.post(
    "https://accounts.spotify.com/api/token",
    "grant_type=client_credentials",
    { headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" } }
  );
  return res.data.access_token;
}

async function getSpotifyData(artistId, token) {
  const headers = { Authorization: `Bearer ${token}` };

  // Spotify's Client Credentials tier (late 2024) only exposes name/images/urls.
  // followers, popularity, top-tracks, and related-artists all return 403.
  const artistRes = await axios.get(`https://api.spotify.com/v1/artists/${artistId}`, { headers });

  return {
    name: artistRes.data.name,
    spotify_followers: 0,          // not accessible — album_count used via fetchSpotifyPlaylists
    spotify_monthly_listeners: 0,  // not accessible under Client Credentials
    spotify_url: artistRes.data.external_urls.spotify,
    image: artistRes.data.images[0]?.url,
  };
}

// Returns track popularity signals. Currently 403 under Client Credentials —
// will activate automatically once Spotify grants extended quota access.
async function getSpotifyTopTracks(artistId, token) {
  try {
    const res = await axios.get(
      `https://api.spotify.com/v1/artists/${artistId}/top-tracks`,
      { headers: { Authorization: `Bearer ${token}` }, params: { market: "US" } }
    );
    const tracks = res.data.tracks;
    if (!tracks?.length) return { spotify_avg_track_popularity: 0, spotify_top_track_score: 0 };
    const avgTrackPopularity = tracks.reduce((sum, t) => sum + t.popularity, 0) / tracks.length;
    return {
      spotify_avg_track_popularity: Math.round(avgTrackPopularity),
      spotify_top_track_score: tracks[0]?.popularity || 0,
    };
  } catch {
    return { spotify_avg_track_popularity: 0, spotify_top_track_score: 0 };
  }
}

// --- YOUTUBE ---
// Quota-efficient resolution order (daily cap is 10,000 units):
//   1. cached channel id (UC…)           → channels.list?id        = 1 unit
//   2. @handle guesses from artist name  → channels.list?forHandle = 1 unit each
//   3. legacy username                   → channels.list?forUsername = 1 unit
//   4. last resort search query          → search.list             = 100 units
// Handle/search hits are title-validated against the artist name to avoid
// common-name mismatches. Returns resolved_channel_id for the caller to cache.
const _norm = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
function _titleMatches(channelTitle, name) {
  const a = _norm(channelTitle), b = _norm(name);
  return !!a && !!b && (a.includes(b) || b.includes(a));
}

async function getYouTubeData(artistOrQuery, opts = {}) {
  const empty = { youtube_subscribers: 0, youtube_total_views: 0, resolved_channel_id: null };
  const key = process.env.YOUTUBE_API_KEY;
  if (!key || !artistOrQuery) return empty;

  // Accept either an artist/ranking object {name, youtube_channel_id} or a raw string
  const cachedId = typeof artistOrQuery === "string" ? artistOrQuery : artistOrQuery.youtube_channel_id;
  const name     = typeof artistOrQuery === "string" ? null         : artistOrQuery.name;
  const allowSearch = opts.allowSearch !== false;

  const channelByParams = async (params) => {
    const res = await axios.get("https://www.googleapis.com/youtube/v3/channels", {
      params: { part: "statistics,snippet", key, ...params },
    });
    return res.data.items?.[0] ?? null;
  };
  const pack = (ch, id) => ({
    youtube_subscribers: parseInt(ch.statistics.subscriberCount || "0"),
    youtube_total_views: parseInt(ch.statistics.viewCount       || "0"),
    resolved_channel_id: id,
  });

  try {
    // 1. Cached channel id — trusted, no title check (1 unit)
    if (cachedId && cachedId.startsWith("UC")) {
      const ch = await channelByParams({ id: cachedId });
      if (ch) return pack(ch, cachedId);
    }

    if (name) {
      const base = _norm(name);
      const handleGuesses = [base, base + "official", base + "music", base + "dj", "dj" + base];
      // 2. @handle lookups (1 unit each) — validate title to avoid wrong-artist matches
      for (const h of handleGuesses) {
        if (!h) continue;
        try {
          const ch = await channelByParams({ forHandle: h });
          if (ch && _titleMatches(ch.snippet?.title, name)) return pack(ch, ch.id);
        } catch { /* handle not found → next */ }
      }
      // 3. Legacy username (1 unit)
      try {
        const ch = await channelByParams({ forUsername: base });
        if (ch && _titleMatches(ch.snippet?.title, name)) return pack(ch, ch.id);
      } catch { /* none */ }
    }

    // 4. Search fallback (100 units) — only when nothing cheaper worked
    const q = (cachedId && !cachedId.startsWith("UC")) ? cachedId : name;
    if (allowSearch && q) {
      const s = await axios.get("https://www.googleapis.com/youtube/v3/search", {
        params: { part: "snippet", q, type: "channel", maxResults: 1, key },
      });
      const hit = s.data.items?.[0];
      if (hit) {
        const ch = await channelByParams({ id: hit.id.channelId });
        if (ch) return pack(ch, hit.id.channelId);
      }
    }
    return empty;
  } catch (err) {
    console.warn(`[YouTube] ${name || cachedId}:`, err.response?.status ?? err.message?.slice(0, 50));
    return empty;
  }
}

module.exports = { getSpotifyToken, getSpotifyData, getSpotifyTopTracks, getYouTubeData };
