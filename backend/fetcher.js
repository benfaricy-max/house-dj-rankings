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
  const res = await axios.get(`https://api.spotify.com/v1/artists/${artistId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return {
    name: res.data.name,
    spotify_followers: res.data.followers.total,
    spotify_monthly_listeners: res.data.popularity, // 0-100 score; true monthly listener count isn't in the public API
    spotify_url: res.data.external_urls.spotify,
    image: res.data.images[0]?.url,
  };
}

// --- YOUTUBE ---
// Accepts a direct channel ID (UC...) or falls back to a search query
async function getYouTubeData(channelIdOrQuery) {
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
}

module.exports = { getSpotifyToken, getSpotifyData, getYouTubeData };
