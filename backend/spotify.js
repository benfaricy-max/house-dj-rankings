const axios = require("axios");

let tokenCache = { token: null, expiresAt: 0 };

async function getToken() {
  if (Date.now() < tokenCache.expiresAt) return tokenCache.token;

  const creds = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");

  const res = await axios.post(
    "https://accounts.spotify.com/api/token",
    "grant_type=client_credentials",
    { headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" } }
  );

  tokenCache = {
    token: res.data.access_token,
    expiresAt: Date.now() + res.data.expires_in * 1000 - 30000,
  };
  return tokenCache.token;
}

async function getArtistData(spotifyId) {
  const token = await getToken();
  const res = await axios.get(`https://api.spotify.com/v1/artists/${spotifyId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return {
    followers: res.data.followers.total,
    popularity: res.data.popularity, // 0-100
    genres: res.data.genres,
    imageUrl: res.data.images[0]?.url || null,
    spotifyUrl: res.data.external_urls.spotify,
  };
}

module.exports = { getArtistData };
