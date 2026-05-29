// Album/single counts are pre-fetched and stored in artists.json to avoid
// Spotify rate limits. This function just passes the value through.
// Refresh manually by running: node scripts/fetchAlbumCounts.js
async function getPlaylistPlacements(artistId, token, artist) {
  return { spotify_playlist_placements: artist?.album_count ?? 0 };
}

module.exports = { getPlaylistPlacements };
