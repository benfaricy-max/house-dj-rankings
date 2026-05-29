/**
 * Generates a static rankings.json snapshot.
 * Run locally or via GitHub Actions:  node generateStatic.js
 */
require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const path = require("path");
const fs   = require("fs");

const { getSpotifyToken, getSpotifyData, getSpotifyTopTracks, getYouTubeData } = require("./fetchArtist");
const { getTikTokMentions }    = require("./fetchTikTok");
const { getSoundCloudData }    = require("./fetchSoundCloud");
const { getPlaylistPlacements } = require("./fetchSpotifyPlaylists");
const { getGoogleTrends }      = require("./fetchTrends");
const { scoreArtists }         = require("./score");
const artists                  = require("./artists.json");

const OUT_FILE = path.join(__dirname, "..", "frontend", "public", "rankings.json");
const delay    = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log(`Fetching data for ${artists.length} artists…`);
  const token = await getSpotifyToken();
  const enriched = [];

  for (const [i, artist] of artists.entries()) {
    if (i > 0) await delay(2000);
    try {
      const [spotify, topTracks, tiktok, youtube, soundcloud, playlists, trends] = await Promise.all([
        getSpotifyData(artist.spotify_id, token),
        getSpotifyTopTracks(artist.spotify_id, token),
        getTikTokMentions(artist.tiktok_tag),
        getYouTubeData(artist.youtube_channel_id),
        getSoundCloudData(artist.soundcloud_permalink),
        getPlaylistPlacements(artist.spotify_id, token, artist),
        getGoogleTrends(artist.name),
      ]);

      enriched.push({
        ...artist, ...spotify, ...topTracks, ...tiktok,
        ...youtube, ...soundcloud, ...playlists,
        google_trends_score: trends.score,
        google_trends_direction: trends.direction,
        spotify_monthly_listeners: spotify.spotify_followers ?? 0,
      });
      process.stdout.write(`\r${i + 1}/${artists.length} ${artist.name}`);
    } catch (err) {
      console.warn(`\n  skip ${artist.name}: ${err.message?.slice(0, 60)}`);
    }
  }

  if (enriched.length === 0) {
    console.log("All fetches failed (likely rate limited) — keeping existing rankings.json");
    process.exit(0); // exit cleanly so CI doesn't fail
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
