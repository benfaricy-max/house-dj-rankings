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
  // Jun 2026 reweight (v2): this is a BOOKING index, so live booking demand (RA —
  // venue tier, attendance, geo spread) LEADS, with Beatport + Scene credibility
  // alongside it. Raw Spotify reach is the weakest booking predictor, so it sits
  // at a supporting 0.12 (down from 0.19, which over-crowned streaming giants).
  // Paired with the credibility floor below (see the return map). Keep this in
  // sync with the frontend METRICS / METRIC_DETAILS arrays and CLAUDE.md.
  const weights = {
    ra_score:                     0.17,  // LEADS — RA live booking demand: venue tier, attending, geo spread
    beatport_score:               0.14,  // core scene / chart credibility (one Beatport metric)
    manual_scene_score:           0.14,  // editorial scene credibility (rubric in How It Works)
    spotify_monthly_listeners:    0.12,  // reach — supporting; raw streams are the weakest booking predictor
    tl_support_score:             0.09,  // DJ SUPPORT: 1001Tracklists weekly chart — what DJs actually play (hardest to game)
    google_trends_score:          0.08,
    spotify_follower_growth_rate: 0.06,  // growth (acceleration), thin coverage
    youtube_subscribers:          0.05,  // reach proxy
    label_score:                  0.05,  // label tier (Drumcode/Kompakt/Defected…) — credibility & trajectory
    tiktok_post_count:            0.04,
    spotify_playlist_placements:  0.04,  // catalog depth / release cadence
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
      // Credibility floor: a demand index for a credibility-driven scene shouldn't
      // crown an act with near-zero scene standing on reach + charts alone. Acts
      // below 50 on Scene have their composite scaled down — at most a 25% cut at
      // scene 0, tapering linearly to no penalty at scene >= 50. Unscored acts (the
      // 50 default) are unaffected. This is the lever that stops a streaming-huge /
      // scene-thin act (e.g. a chart-pop crossover) from topping a booking index.
      const sceneVal = Number.isFinite(artist.manual_scene_score) ? artist.manual_scene_score : 50;
      const credibility = 0.75 + 0.25 * (Math.min(sceneVal, 50) / 50);
      return { ...artist, score: Math.round(score * credibility * 10) / 10 };
    })
    .sort((a, b) => b.score - a.score)
    .map((artist, i) => ({ ...artist, rank: i + 1 }));
}

module.exports = { scoreArtists };
