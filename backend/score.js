function normalize(value, min, max) {
  if (max === min) return 0;
  return ((value - min) / (max - min)) * 100;
}

function scoreArtists(artists) {
  const metrics = [
    "spotify_followers",
    "spotify_monthly_listeners",
    "spotify_playlist_placements",
    "spotify_follower_growth_rate",
    "spotify_avg_track_popularity",
    "youtube_subscribers",
    "youtube_views_weekly",
    "tiktok_post_count",
    "google_trends_score",
    "beatport_score",
    "wikipedia_pageviews",
    "manual_scene_score",
  ];

  const ranges = {};
  for (const m of metrics) {
    const values = artists.map(a => a[m] || 0);
    ranges[m] = { min: Math.min(...values), max: Math.max(...values) };
  }

  const weights = {
    spotify_monthly_listeners:    0.17,
    beatport_score:               0.10,  // core scene / chart credibility
    spotify_playlist_placements:  0.10,
    tiktok_post_count:            0.10,
    youtube_subscribers:          0.10,
    google_trends_score:          0.10,
    spotify_avg_track_popularity: 0.08,
    spotify_follower_growth_rate: 0.08,
    youtube_views_weekly:         0.08,
    wikipedia_pageviews:          0.05,  // public interest (replaced Spotify followers)
    manual_scene_score:           0.04,
  };

  // Weights sum to 1.0 — verify if you add/remove signals

  return artists
    .map(artist => {
      let score = 0;
      for (const [metric, weight] of Object.entries(weights)) {
        const norm = normalize(
          artist[metric] || 0,
          ranges[metric].min,
          ranges[metric].max
        );
        score += norm * weight;
      }
      return { ...artist, score: Math.round(score * 10) / 10 };
    })
    .sort((a, b) => b.score - a.score)
    .map((artist, i) => ({ ...artist, rank: i + 1 }));
}

module.exports = { scoreArtists };
