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

// Self-healing-on-absence signals (v4). These two are STRUCTURALLY SPARSE: an
// act reads 0/absent not because demand is zero but because the signal didn't
// sample it. 1001TL is a single-WEEK chart (250/330 acts read 0 — not on this
// week's chart ≠ no DJ support), and scene_geography needs a Spotify-cities pull
// the Interceptor only runs locally (67/330 unmeasured). Scoring those 0s as a
// real low both buried the act on the signal's weight AND cut its coverage — a
// coverage-as-zero bug that hit exactly the live-headliner DJ's-DJs the index
// claims to favour (Jamie Jones, Capriati, the Martinez Brothers all read tl=0).
// So when ABSENT, the weight redistributes per-artist over the signals present
// (excluded from the denominator) instead of scoring 0. A PRESENT value still
// scores normally and can pull an act DOWN — e.g. Mau P's real geo of 22.
const SELF_HEAL_ABSENT = new Set(["tl_support_score", "scene_geography", "spotify_monthly_listeners", "festival_score"]);
// festival_score self-heals on absence (v5.1): it captures major-festival booking
// presence — the live demand RA (club-skewed/Euro) and Beatport (track-charting) both
// miss for US-festival/viral acts (Disco Lines, Gordo, Hugel). An act on no tracked
// lineup is UNMEASURED (weight redistributes), never scored zero — so the signal only
// LIFTS festival acts, never penalises a club-only/underground act. See computeFestivalScore.js.
// spotify_monthly_listeners self-heals on absence (v5): the listener count comes from
// a puppeteer scrape that only runs locally, so ~19 real, major acts (Marco Carola,
// Luciano, ARTBAT, Moodymann, Lane 8…) read 0 simply because the scrape didn't reach
// them — NOT because they have no audience. Scoring that 0 as rock-bottom reach both
// buried them on the listeners weight AND docked their coverage. A 0 here means
// "unmeasured" (no act in this roster truly has zero listeners), so its weight
// redistributes per-artist like 1001TL/geo. A real, present count still scores normally.

// Google Trends is structurally UNREADABLE for acts whose name collides with a
// common word or a more-famous namesake — "Midland" is a US country duo, a Texas
// city, a UK region; the search index can't isolate the DJ, so the trends number
// is namesake noise, not demand (Midland reads 85 while every DJ peer is ≤11).
// For these acts we treat google_trends_score as UNMEASURED — its weight redistributes
// per-artist (same self-heal as 1001TL/geo) rather than letting a contaminated value
// inflate the rank. A scalar analog of cleanGeoTrends.js. Mirror in cohort.js.
const TRENDS_NAMESAKE = new Set(["Midland"]);

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

function scoreArtists(artists, weightOverride) {
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
    "scene_geography",
    "live_demand_score",
    "festival_score",
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
  // Jun 2026 reweight (v4): a sniff-test pass found two mechanical biases, tuned
  // against the labelled calls. (1) beatport (a PRODUCER/track-sales signal) sat at
  // 0.15 — the 3rd-heaviest weight — and over-ranked chart producers (Kolter, Adam
  // Port, Green Velvet) while live headliners whose value is curation/performance,
  // not track sales, sank (Jamie Jones beatport 29, Capriati none). For a BOOKING
  // index, who fills rooms must outweigh who charts tracks: beatport 0.15→0.12, and
  // weight moved into live_demand (0.18→0.21) + scene (0.18→0.20, the index's lead).
  // (2) scene_geography (international appeal — share of listeners in core EM
  // credibility markets) was built but left unweighted; turned on at a deliberately
  // SMALL 0.03 (SELF_HEAL_ABSENT, see above) — enough to nudge a single-market act
  // (Mau P) down without over-punishing non-European acts the labelled set rates
  // (Mochakk, Beltran). Funded by trimming reach (listeners 0.08→0.05, yt 0.04→0.03,
  // trends 0.08→0.07). Also: tl_support now self-heals on absence (weekly sample,
  // 250/330 read 0). Paired with the v3 TWO-SIDED credibility multiplier below. The
  // tuner (backend/_tune_v4 in history) scored this vector ~82% on intent. Keep in
  // sync with frontend METRICS / METRIC_DETAILS + CLAUDE.md.
  // v5 rebalance: RA "attending" was both the largest ra_score component AND soft,
  // festival-inflated RSVP data — so its unreliability propagated up through
  // live_demand. Rather than just reshuffle inside RA, lean the COMPOSITE off
  // live_demand (0.21→0.17) and onto the harder-to-game signals: Beatport (track
  // sales), 1001TL DJ support (what DJs actually play), Google Trends (search), and
  // listener growth (acceleration). Scene unchanged (its multiplier was already
  // narrowed). Sum still 1.00.
  // v5.1: festival_score (0.05) added — major-festival booking presence, the live
  // demand RA+Beatport miss for US-festival/viral acts. Funded thinly across the
  // gameable/minor signals (tiktok hashtag volume halved + small trims to yt/releases/
  // wiki) so no single act takes a big funding hit. SELF-HEALS on absence. Sum still 1.00.
  const weights = {
    live_demand_score:            0.17,  // LEADS still, but trimmed: RA's biggest input (attending) is its least reliable, so live demand carries a bit less
 manual_scene_score: 0.20, // CO-LEADS, editorial scene credibility (rubric in How It Works)
 beatport_score: 0.13, // chart credibility (producer/track-sales signal), bumped v5
 tl_support_score: 0.11, // DJ SUPPORT: 1001Tracklists weekly chart, what DJs play. Bumped v5. SELF-HEALS on absence (weekly sample)
 google_trends_score: 0.08, // search interest, bumped v5
 spotify_follower_growth_rate: 0.07, // growth (acceleration), bumped v5
    festival_score:               0.05,  // v5.1: major-festival booking presence. SELF-HEALS on absence (lineup coverage is the gate)
 scene_geography: 0.03, // v4: international appeal, share of listeners in core EM markets. SELF-HEALS on absence (local-only pull)
 label_score: 0.05, // label tier (Drumcode/Kompakt/Defected…), credibility & trajectory
 spotify_monthly_listeners: 0.05, // reach: demoted hard: with conditioning, raw streams over-discriminate. SELF-HEALS on absence (local-only scrape)
 youtube_subscribers: 0.02, // reach proxy, trimmed v5.1 to fund festival_score
 tiktok_post_count: 0.01, // social spread (hashtag post volume): the gameable signal, halved v5.1 to fund festival_score (festival presence is a better, harder-to-game live signal). Roadmap: tiktok_follower_growth_rate once a scraper accrues coverage.
 spotify_playlist_placements: 0.02, // catalog depth / release cadence, trimmed v5.1
 wikipedia_pageviews: 0.01, // public interest, trimmed v5.1
    spotify_avg_track_popularity: 0.00,  // RETIRED (Spotify blocks the endpoint)
    youtube_views_weekly:         0.00,  // REMOVED (delta metric, 0% coverage)
    beatport_hype_score:          0.00,  // REMOVED from primary rankings (one Beatport metric); still collected for emerging views
  };
  if (weightOverride) Object.assign(weights, weightOverride); // for the weight tuner; production passes nothing
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
      // Per-artist scoring with a per-artist denominator. SELF_HEAL_ABSENT signals
      // (tl_support, scene_geography) that are ABSENT for this act are dropped from
      // BOTH the numerator and the denominator — their weight redistributes over the
      // act's present signals instead of scoring a structural 0. Every OTHER signal
      // (incl. a genuine reach low) still counts and still dilutes, exactly as before;
      // for a fully-sampled act the denominator equals liveWeightSum (no change).
      let rawScore = 0;         // Σ norm·weight over signals that COUNT for this act
      let denom = 0;            // Σ weight over signals that count for this act
      // Coverage accounting: how much of the COUNTED weight is actually backed by
      // real data for THIS artist (self-healed-away signals are not held against it).
      let coverageWeight = 0;
      let signalsPresent = 0;
      let signalsTotal = 0;     // weighted, counted signals (excludes retired + self-healed-absent)
      for (const metric of liveMetrics) {
        const carriesWeight = weights[metric] > 0;
        if (!carriesWeight) continue;
        const present = Number.isFinite(artist[metric]) && artist[metric] > 0;
        // Sparse signal absent → redistribute (don't score 0, don't dock coverage).
        if (SELF_HEAL_ABSENT.has(metric) && !present) continue;
        // Namesake-contaminated Trends → treat as unmeasured (drop from num+denom).
        if (metric === "google_trends_score" && TRENDS_NAMESAKE.has(artist.name)) continue;
        signalsTotal += 1;
        denom += weights[metric];
        if (present) {
          coverageWeight += weights[metric];
          signalsPresent += 1;
        }
        const norm = normalize(
          prep(metric, artist[metric]),
          ranges[metric].min,
          ranges[metric].max
        );
        rawScore += norm * weights[metric];
      }
      const liveDenom = denom > 0 ? denom : 1;
      const score = rawScore / liveDenom;          // renormalized per-artist to 1.0
      const coverageFrac = coverageWeight / liveDenom; // 0–1 of counted weight backed by data
      // Two-sided credibility multiplier. A booking index for a credibility-driven
      // scene should do BOTH: penalise an act with near-zero scene standing AND
      // reward genuine scene credibility — otherwise (now that conditioning makes
      // reach discriminate) a scene-revered but streaming-invisible act gets buried
      // by the reach signals. Scales the composite by 0.80 (scene 0) → ~0.98 (the
      // unscored 50 default) → 1.15 (scene 100). This is the lever that both demotes
      // a chart-pop crossover (low scene) and lifts a DJ's-DJ (high scene, low reach).
      const sceneVal = Number.isFinite(artist.manual_scene_score) ? artist.manual_scene_score : 50;
      // v5 — scene was DOUBLE-COUNTED: it's already a 0.20-weighted signal AND a
      // multiplier with a wide 0.80→1.15 swing, so a scene-88 heritage act got ~+11%
      // on top of its weighted scene term. That lifted revered/DJ's-DJ names (Garnier,
      // Koze, Joris Voorn, Bob Sinclar, Kerri Chandler) above their current live heat.
      // Narrowed to 0.80→1.00: the multiplier keeps its job as a DOWNSIDE credibility
      // floor (a near-zero-scene streaming-pop crossover is still demoted) but no longer
      // hands high scene a second large bonus on top of the 0.20 weight. Mirror in cohort.js.
      const credibility = 0.80 + 0.20 * (sceneVal / 100);

      // Coverage penalty: a score built on a fraction of the signals isn't as
      // trustworthy as one on the full panel, and the self-healing reweight would
      // otherwise let a thin-data act outrank a well-covered one on a technicality.
      // Acts whose present signals back < 75% of the weight are scaled down — at
      // most a 20% cut at 0% coverage, tapering linearly to no penalty at >= 75%.
      // coverage_score (0–100) + signals_present are surfaced so the cut is legible.
      const coverageScore = Math.round(coverageFrac * 100);
      const coverageFactor = 0.80 + 0.20 * Math.min(coverageFrac / 0.75, 1);

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

// ─────────────────────────────────────────────────────────────────────────────
// Rank 2.0 (experimental, parallel) — an ALTERNATE weight vector run alongside the
// production weights so the two rankings can be compared side-by-side before either
// is committed. Production stays the default (live_demand LEADS); 2.0 is a reach/
// discovery-leaning cut requested for evaluation: it pulls weight OFF the booking
// signal (live_demand .17→.0528) and onto scene, DJ support, search, social reach
// (TikTok/Wikipedia/YouTube) and catalog. generateStatic runs scoreArtists twice and
// merges 2.0's output as score_v2 / rank_v2; the frontend exposes a sort toggle.
//
// The 12 requested weights (scene 20, dj_support 15, trends 10, listeners 8, tiktok 8,
// live 6, beatport 6, intl 4, label 3, youtube 5, wikipedia 8, releases 7 — sum 93
// after reserving 7 for growth, the one omitted signal kept) are scaled by 0.93 so
// growth (.07) keeps its production weight and the vector still sums to 1.00.
// festival_score is DROPPED from 2.0 (explicit 0 — without it the base 0.05 would
// carry over via Object.assign): a deliberately simpler 2.0 methodology that doesn't
// lean on the hand-maintained festival_lineups.json. Self-healing + the credibility/
// coverage multipliers are unchanged (scoreArtists is weight-agnostic).
const WEIGHTS_V2 = {
  manual_scene_score:           0.186,   // scene 20% × 0.93
  tl_support_score:             0.1395,  // dj support 15%
  google_trends_score:          0.093,   // google trends 10%
  spotify_monthly_listeners:    0.0744,  // monthly listeners 8%
  tiktok_post_count:            0.0744,  // tik tok 8%
  wikipedia_pageviews:          0.0744,  // wikipedia views 8%
  spotify_playlist_placements:  0.0651,  // release/catalog 7%
  live_demand_score:            0.0558,  // live booking 6%
  beatport_score:               0.0558,  // beatport chart 6%
  youtube_subscribers:          0.0465,  // youtube subscribers 5%
  scene_geography:              0.0372,  // international appeal 4%
  label_score:                  0.0279,  // label trajectory 3%
  spotify_follower_growth_rate: 0.07,    // KEPT (omitted from the 12 → production weight retained)
  festival_score:               0,       // DROPPED from 2.0 (explicit 0 overrides base 0.05)
};

module.exports = { scoreArtists, WEIGHTS_V2 };
