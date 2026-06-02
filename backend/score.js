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
    "ra_score",
    "label_score",
  ];

  const ranges = {};
  for (const m of metrics) {
    const values = artists.map(a => a[m] || 0);
    ranges[m] = { min: Math.min(...values), max: Math.max(...values) };
  }

  const weights = {
    spotify_follower_growth_rate: 0.13,  // GROWTH weighted heavily — acceleration > size
    spotify_monthly_listeners:    0.13,
    manual_scene_score:           0.11,  // editorial scene credibility (transparent rubric — see How It Works)
    beatport_score:               0.10,  // core scene / chart credibility
    google_trends_score:          0.09,
    ra_score:                     0.08,  // RA booking momentum: venue tier, attending, geo spread
    youtube_subscribers:          0.08,
    tiktok_post_count:            0.07,
    youtube_views_weekly:         0.06,  // delta metric — empty until 2 snapshots exist, then auto-included
    label_score:                  0.05,  // label tier (Drumcode/Kompakt/Defected…) — credibility & trajectory
    spotify_playlist_placements:  0.05,
    spotify_avg_track_popularity: 0.03,  // currently blocked by Spotify (403) — auto-excluded below
    wikipedia_pageviews:          0.02,  // public interest (replaced Spotify followers)
  };
  // sum = 1.00

  // Weights sum to 1.0 by design. But a signal that is EMPTY across the entire
  // field (max === 0 — e.g. Spotify track popularity is API-blocked, or
  // youtube_views_weekly before a second snapshot exists) contributes nothing
  // to anyone and would silently shrink every score. So we redistribute the
  // weight of any all-empty signal proportionally across the signals that DO
  // have data. This is self-healing: a signal rejoins automatically the moment
  // it starts returning real values — no manual reweighting required.
  const liveMetrics = Object.keys(weights).filter(m => ranges[m].max > 0);
  const liveWeightSum = liveMetrics.reduce((s, m) => s + weights[m], 0) || 1;

  return artists
    .map(artist => {
      let score = 0;
      for (const metric of liveMetrics) {
        const norm = normalize(
          artist[metric] || 0,
          ranges[metric].min,
          ranges[metric].max
        );
        score += norm * (weights[metric] / liveWeightSum); // renormalized to 1.0
      }
      return { ...artist, score: Math.round(score * 10) / 10 };
    })
    .sort((a, b) => b.score - a.score)
    .map((artist, i) => ({ ...artist, rank: i + 1 }));
}

module.exports = { scoreArtists };
