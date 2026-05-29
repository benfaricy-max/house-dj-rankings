const { getSpotifyToken, getSpotifyData, getYouTubeData } = require("./fetcher");
const { scoreArtists } = require("./scorer");
const DJS = require("./djs");

let cachedRankings = [];
let lastUpdated = null;

async function fetchAllData() {
  console.log("[rankings] Fetching data for", DJS.length, "DJs…");
  const token = await getSpotifyToken();

  const results = await Promise.allSettled(
    DJS.map(async (dj) => {
      const [spotify, youtube] = await Promise.all([
        getSpotifyData(dj.spotifyId, token),
        getYouTubeData(dj.youtubeQuery),
      ]);
      return { ...spotify, ...youtube };
    })
  );

  const successful = results
    .filter((r) => r.status === "fulfilled")
    .map((r) => r.value);

  const failed = results
    .filter((r) => r.status === "rejected")
    .map((_, i) => DJS[i]?.name);

  if (failed.length) console.warn("[rankings] Failed to fetch:", failed);

  cachedRankings = scoreArtists(successful);
  lastUpdated = new Date().toISOString();
  console.log("[rankings] Done. Last updated:", lastUpdated);
  return cachedRankings;
}

function getRankings() {
  return { rankings: cachedRankings, lastUpdated };
}

module.exports = { fetchAllData, getRankings };
