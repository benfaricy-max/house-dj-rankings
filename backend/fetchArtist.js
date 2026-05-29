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
// Accepts a direct channel ID (UC...) or falls back to a search query
async function getYouTubeData(channelIdOrQuery) {
  const empty = { youtube_subscribers: 0, youtube_total_views: 0 };
  if (!process.env.YOUTUBE_API_KEY) return empty;

  try {
  let channelId = channelIdOrQuery;

  if (!channelIdOrQuery.startsWith("UC")) {
    const searchRes = await axios.get("https://www.googleapis.com/youtube/v3/search", {
      params: {
        part: "snippet",
        q: channelIdOrQuery,
        type: "channel",
        maxResults: 1,
        key: process.env.YOUTUBE_API_KEY,
      },
    });
    const hit = searchRes.data.items?.[0];
    if (!hit) return { youtube_subscribers: 0, youtube_total_views: 0 };
    channelId = hit.id.channelId;
  }

  const res = await axios.get("https://www.googleapis.com/youtube/v3/channels", {
    params: {
      part: "statistics,snippet",
      id: channelId,
      key: process.env.YOUTUBE_API_KEY,
    },
  });
  const channel = res.data.items?.[0];
  if (!channel) return { youtube_subscribers: 0, youtube_total_views: 0 };
  return {
    youtube_subscribers: parseInt(channel.statistics.subscriberCount || "0"),
    youtube_total_views: parseInt(channel.statistics.viewCount || "0"),
  };
  } catch (err) {
    console.warn(`[YouTube] Failed for "${channelIdOrQuery}":`, err.response?.status ?? err.message);
    return empty;
  }
}

module.exports = { getSpotifyToken, getSpotifyData, getSpotifyTopTracks, getYouTubeData };
