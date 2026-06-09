// Count-based, heavy-tailed signals: one FISHER/Disclosure-sized act otherwise
// stretches the raw min-max range so far that everyone else compresses into the
// bottom and the signal stops discriminating among ranks ~5–50. Log-compress
// them first (same transform Value Gap uses on listeners/attendance) so the
// conditioning matches the multiplicative way reach grows. The 0–100 "score"
// signals (live_demand/beatport/scene/trends/tl/label) are already bounded, so
// they're left linear.
const HEAVY_TAILED = new Set([
  "spotify_followers",
  "spotify_monthly_listeners",
  "youtube_subscribers",
  "youtube_views_weekly",
  "wikipedia_pageviews",
  "tiktok_post_count",
  "spotify_playlist_placements",
]);

function prep(metric, value) {
  const v = Number.isFinite(value) ? value : 0;
  return HEAVY_TAILED.has(metric) ? Math.log10(1 + Math.max(0, v)) : v;
}

// Percentile over an ascending-sorted array (nearest-rank).
function percentile(sortedAsc, p) {
  if (!sortedAsc.length) return 0;
  const idx = Math.min(sortedAsc.length - 1,
    Math.max(0, Math.round((p / 100) * (sortedAsc.length - 1))));
  return sortedAsc[idx];
}

// Winsorizing min-max: the range is the 1st–99th percentile (set in ranges
// below), and values outside it are clamped to the band before scaling. This
// caps the influence of a single outlier and — crucially — makes scores far
// more stable snapshot-to-snapshot: the top of the scale is a p99, not whatever
// one mega-act happens to register this week, so a score moving is real movement
// rather than pool drift from one act entering or leaving the roster.
function normalize(value, min, max) {
  if (max <= min) return 0;
  const clamped = Math.max(min, Math.min(max, value));
  return ((clamped - min) / (max - min)) * 100;
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
    "live_demand_score",
    "label_score",
  ];
  // live_demand_score blends RA (venue tier/attendance/geo) with Songkick tour
  // density (computeLiveDemand.js) so the leading booking signal isn't single-
  // sourced on RA — RA under-logs US/commercial/festival acts. Fall back to bare
  // ra_score if the blend hasn't been computed (e.g. an older data snapshot).
  for (const a of artists) {
    if (!Number.isFinite(a.live_demand_score) && Number.isFinite(a.ra_score)) {
      a.live_demand_score = a.ra_score;
    }
  }
  // NOTE: spotify_avg_track_popularity retired — Spotify blocks the endpoint
  // (403) under Client-Credentials and strips the popularity field, so it was
  // dead for every artist. Removed rather than shown as a column of zeros.

  // Build each metric's scale on CONDITIONED values: log-compress the heavy-
  // tailed signals, then take the 1st/99th percentile as the [min,max] band so
  // the top and bottom 1% are winsorized rather than allowed to define the scale.
  const ranges = {};
  for (const m of metrics) {
    const values = artists.map(a => prep(m, a[m])).sort((x, y) => x - y);
    ranges[m] = { min: percentile(values, 1), max: percentile(values, 99) };
  }

  // Weights sum to 1.00. Self-healing still applies: empty signals' weight
  // redistributes per-artist over the signals they do have.
  // Jun 2026 reweight (v3, post-conditioning): with log+winsorize normalisation
  // (above), reach signals finally DISCRIMINATE instead of compressing flat — so
  // their effective influence jumped. To keep this a BOOKING index (live demand +
  // scene credibility lead, not streaming reach), reach is pulled DOWN: listeners
  // 0.12→0.08, yt/tiktok/releases trimmed, and that weight moved to scene (0.14→
  // 0.18, now co-leading) + live_demand (→0.18) + beatport (→0.15) + 1001TL (→0.10).
  // Paired with the TWO-SIDED credibility multiplier below (rewards high scene,
  // penalises low). Keep in sync with frontend METRICS / METRIC_DETAILS + CLAUDE.md.
  const weights = {
    live_demand_score:            0.18,  // LEADS — live booking demand: RA (venue tier/attendance/geo) blended with Songkick tour density
    manual_scene_score:           0.18,  // CO-LEADS — editorial scene credibility (rubric in How It Works)
    beatport_score:               0.15,  // core scene / chart credibility (one Beatport metric)
    tl_support_score:             0.10,  // DJ SUPPORT: 1001Tracklists weekly chart — what DJs actually play (hardest to game)
    spotify_monthly_listeners:    0.08,  // reach — demoted hard: with conditioning, raw streams over-discriminate
    google_trends_score:          0.08,
    spotify_follower_growth_rate: 0.06,  // growth (acceleration), thin coverage
    label_score:                  0.05,  // label tier (Drumcode/Kompakt/Defected…) — credibility & trajectory
    youtube_subscribers:          0.04,  // reach proxy
    tiktok_post_count:            0.03,  // social spread (hashtag post volume). Kept at LOW weight: it's the gameable one, but it's the only TikTok signal with real coverage (~75%). Roadmap: swap to tiktok_follower_growth_rate once a follower scraper accrues >50% coverage (growth is less gameable but is 0% covered today).
    spotify_playlist_placements:  0.03,  // catalog depth / release cadence
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
      // Coverage accounting: how much of the (renormalized) weight is actually
      // backed by real data for THIS artist. Without this, the self-healing
      // reweight silently scores each artist on a different weight vector — a
      // sparse act's score concentrates on its few present signals (a missing
      // signal is treated as "doesn't count against you," not zero), so thin-data
      // acts can float up and rank beside fully-covered acts as if comparable.
      let coverageWeight = 0;   // sum of renormalized weight on present signals (0–1)
      let signalsPresent = 0;
      let signalsTotal = 0;     // weighted signals only (excludes retired 0-weight)
      for (const metric of liveMetrics) {
        const carriesWeight = weights[metric] > 0;
        if (carriesWeight) signalsTotal += 1;
        if (carriesWeight && Number.isFinite(artist[metric]) && artist[metric] > 0) {
          coverageWeight += weights[metric] / liveWeightSum;
          signalsPresent += 1;
        }
        const norm = normalize(
          prep(metric, artist[metric]),
          ranges[metric].min,
          ranges[metric].max
        );
        score += norm * (weights[metric] / liveWeightSum); // renormalized to 1.0
      }
      // Two-sided credibility multiplier. A booking index for a credibility-driven
      // scene should do BOTH: penalise an act with near-zero scene standing AND
      // reward genuine scene credibility — otherwise (now that conditioning makes
      // reach discriminate) a scene-revered but streaming-invisible act gets buried
      // by the reach signals. Scales the composite by 0.80 (scene 0) → ~0.98 (the
      // unscored 50 default) → 1.15 (scene 100). This is the lever that both demotes
      // a chart-pop crossover (low scene) and lifts a DJ's-DJ (high scene, low reach).
      const sceneVal = Number.isFinite(artist.manual_scene_score) ? artist.manual_scene_score : 50;
      const credibility = 0.80 + 0.35 * (sceneVal / 100);

      // Coverage penalty: a score built on a fraction of the signals isn't as
      // trustworthy as one on the full panel, and the self-healing reweight would
      // otherwise let a thin-data act outrank a well-covered one on a technicality.
      // Acts whose present signals back < 75% of the weight are scaled down — at
      // most a 20% cut at 0% coverage, tapering linearly to no penalty at >= 75%.
      // coverage_score (0–100) + signals_present are surfaced so the cut is legible.
      const coverageScore = Math.round(coverageWeight * 100);
      const coverageFactor = 0.80 + 0.20 * Math.min(coverageWeight / 0.75, 1);

      return {
        ...artist,
        score: Math.round(score * credibility * coverageFactor * 10) / 10,
        coverage_score: coverageScore,
        signals_present: signalsPresent,
        signals_total: signalsTotal,
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((artist, i) => ({ ...artist, rank: i + 1 }));
}

module.exports = { scoreArtists };
