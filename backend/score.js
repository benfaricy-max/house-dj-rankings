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
    "beatport_hype_score",
    "tl_support_score",
    "wikipedia_pageviews",
    "manual_scene_score",
    "ra_score",
    "label_score",
  ];
  // NOTE: spotify_avg_track_popularity retired — Spotify blocks the endpoint
  // (403) under Client-Credentials and strips the popularity field, so it was
  // dead for every artist. Removed rather than shown as a column of zeros.

  const ranges = {};
  for (const m of metrics) {
    const values = artists.map(a => a[m] || 0);
    ranges[m] = { min: Math.min(...values), max: Math.max(...values) };
  }

  // Weights sum to 1.00. Self-healing still applies: empty signals' weight
  // redistributes per-artist over the signals they do have.
  // Jun 2026 reweight: Monthly Listeners (reach) now LEADS the composite (0.19),
  // ahead of the credibility signals (Beatport, RA). Scene Score — a hand-scored
  // editorial layer — was reduced to a supporting 0.10 so the index leans on
  // measurable, third-party reach rather than editorial judgement. Keep this in
  // sync with the frontend METRICS / METRIC_DETAILS arrays and CLAUDE.md.
  const weights = {
    spotify_monthly_listeners:    0.19,  // LEADS — active fanbase reach, read from the live Spotify session
    beatport_score:               0.13,  // core scene / chart credibility (one Beatport metric)
    ra_score:                     0.12,  // RA live booking demand: venue tier, attending, geo spread
    manual_scene_score:           0.10,  // editorial scene credibility (rubric in How It Works) — supporting layer
    google_trends_score:          0.09,
    spotify_follower_growth_rate: 0.08,  // growth (acceleration), thin coverage
    youtube_subscribers:          0.06,  // reach proxy — reduced from 0.08
    tiktok_post_count:            0.06,
    tl_support_score:             0.05,  // DJ SUPPORT: 1001Tracklists weekly chart — what DJs actually play (hardest to game)
    label_score:                  0.05,  // label tier (Drumcode/Kompakt/Defected…) — credibility & trajectory
    spotify_playlist_placements:  0.05,  // catalog depth / release cadence
    wikipedia_pageviews:          0.02,  // public interest
    spotify_avg_track_popularity: 0.00,  // RETIRED (Spotify blocks the endpoint)
    youtube_views_weekly:         0.00,  // REMOVED (delta metric, 0% coverage)
    beatport_hype_score:          0.00,  // REMOVED from primary rankings (one Beatport metric); still collected for emerging views
  };
  // Live weights re-normalize below, so the retired track-popularity weight
  // (always empty) is excluded automatically and scores are unaffected.

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
