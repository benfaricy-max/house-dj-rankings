// Cohort indices, rank-uncertainty bands, and stakeholder lenses for the rankings
// page. Kept in its own module so the App.jsx monolith stays thin and parallel
// sessions don't collide on it.
//
// WHY within-cohort scoring: the global index normalises every signal across a
// 330-deep pool, so one streaming giant compresses the reach signal for everyone
// and the score barely discriminates inside a sub-group. Re-normalising within a
// smaller, more homogeneous cohort (emerging acts, one region, the rising tier)
// is statistically cleaner - the scale is set by the cohort, not by global outliers.

// Re-score a subset against ITSELF: min-max each signal within the subset, weight
// by the published METRICS weights, self-heal empty-in-cohort signals, and apply
// the same scene credibility floor the global model uses. Returns the subset
// sorted by cohort_score with a 1..N cohort_rank.
// Conditioning, mirrored from backend/score.js so cohort scores use the same
// model as the global index (log-compress heavy-tailed reach, winsorise to the
// 1st-99th percentile band, two-sided scene credibility multiplier).
const C_HEAVY = new Set([
  "spotify_monthly_listeners", "youtube_subscribers", "tiktok_post_count",
  "spotify_playlist_placements", "wikipedia_pageviews",
]);
// Structurally-sparse signals that SELF-HEAL on absence (mirror of backend
// score.js SELF_HEAL_ABSENT): when an act doesn't read on them - the 1001TL
// weekly chart, the local-only Spotify geography pull - their weight redistributes
// over the act's present signals instead of scoring a structural 0.
const C_SELF_HEAL = new Set(["tl_support_score", "scene_geography"]);
const cPrep = (key, v) => { const x = Number.isFinite(v) ? v : 0; return C_HEAVY.has(key) ? Math.log10(1 + Math.max(0, x)) : x; };
const cPct = (s, p) => (s.length ? s[Math.min(s.length - 1, Math.max(0, Math.round((p / 100) * (s.length - 1))))] : 0);

export function rankWithinCohort(subset, metricDefs) {
  if (!subset || subset.length === 0) return [];
  const ranges = {};
  for (const m of metricDefs) {
    const vals = subset.map(a => cPrep(m.key, a[m.key])).sort((x, y) => x - y);
    ranges[m.key] = { min: cPct(vals, 1), max: cPct(vals, 99) };
  }
  const live = metricDefs.filter(m => ranges[m.key].max > ranges[m.key].min);
  const norm = (v, mn, mx) => (mx <= mn ? 0 : ((Math.max(mn, Math.min(mx, v)) - mn) / (mx - mn)) * 100);

  return subset
    .map(a => {
      // Per-artist denominator: a self-healing signal that's absent for this act is
      // dropped from both numerator and denominator (its weight redistributes); every
      // other signal still counts and dilutes. Matches backend/score.js exactly.
      let raw = 0, denom = 0, covW = 0;
      for (const m of live) {
        const present = Number.isFinite(a[m.key]) && a[m.key] > 0;
        if (C_SELF_HEAL.has(m.key) && !present) continue;
        denom += m.weight;
        if (present) covW += m.weight;
        raw += norm(cPrep(m.key, a[m.key]), ranges[m.key].min, ranges[m.key].max) * m.weight;
      }
      const d = denom > 0 ? denom : 1;
      const s = raw / d;
      const covFrac = covW / d;
      const scene = Number.isFinite(a.manual_scene_score) ? a.manual_scene_score : 50;
      const cred = 0.80 + 0.35 * (scene / 100); // two-sided: lifts high scene, scales down low
      const covFactor = 0.8 + 0.2 * Math.min(covFrac / 0.75, 1);
      return { ...a, cohort_score: Math.round(s * cred * covFactor * 10) / 10, cohort_coverage: Math.round(covFrac * 100) };
    })
    .sort((x, y) => y.cohort_score - x.cohort_score)
    .map((a, i) => ({ ...a, cohort_rank: i + 1 }));
}

// Rank-uncertainty band. A hard ordinal (#7 vs #9) implies a precision the data
// doesn't have. This finds the contiguous run of acts whose score sits within a
// small noise epsilon of this act's score - i.e. the ranks that are statistically
// indistinguishable. Epsilon widens for thin-data acts (low coverage = more
// uncertainty). It's an honesty band, not a bootstrap CI, and is labelled as such.
export function withRankIntervals(sortedByScore, scoreKey = "score") {
  const eps = a => {
    const cov = Number.isFinite(a.coverage_score) ? a.coverage_score : 100;
    return 1.2 * (1 + Math.max(0, 75 - cov) / 75); // ~1.2 pts, up to ~2.4 at zero coverage
  };
  const n = sortedByScore.length;
  return sortedByScore.map((a, i) => {
    const s = a[scoreKey] ?? 0;
    const e = eps(a);
    let lo = i, hi = i;
    while (lo > 0 && Math.abs((sortedByScore[lo - 1][scoreKey] ?? 0) - s) <= e) lo--;
    while (hi < n - 1 && Math.abs((sortedByScore[hi + 1][scoreKey] ?? 0) - s) <= e) hi++;
    return { ...a, rank_lo: lo + 1, rank_hi: hi + 1, rank_pm: Math.max(hi - i, i - lo) };
  });
}

// Region cohorts come from where acts are actually booked (RA top regions), with
// audience/tour fallbacks. Returns the most common regions across the field.
export function deriveRegions(rankings, max = 12) {
  const counts = {};
  for (const a of rankings) {
    const regions = a.value_anchor?.top_regions || a.ra_top_regions || a.ra_country_list || [];
    for (const r of regions) counts[String(r)] = (counts[String(r)] || 0) + 1;
  }
  return Object.entries(counts)
    .filter(([, c]) => c >= 4)
    .sort((x, y) => y[1] - x[1])
    .slice(0, max)
    .map(([r]) => r);
}

export function inRegion(a, region) {
  const regions = a.value_anchor?.top_regions || a.ra_top_regions || a.ra_country_list || [];
  return regions.map(String).includes(region);
}

// "Rising into headliner tier": real momentum AND enough scene/live credibility to
// carry a bigger stage - not just a viral spike. The festival lens cohort.
export function isRising(a) {
  return Number.isFinite(a.momentum_score) && a.momentum_score >= 45
    && (a.manual_scene_score ?? 0) >= 55
    && (a.live_demand_score ?? a.ra_score ?? 0) >= 40;
}

// Stakeholder lenses. Same index, three jobs-to-be-done. Each sets a default sort,
// an optional cohort, a one-line framing, and a jump to the tool that finishes the
// job - making explicit what City Scout / Value Gap already started.
export const PERSONAS = {
  all: {
    label: "Everyone", question: null, sort: "score", cohort: "full", cta: null,
    blurb: null,
  },
  agent: {
    label: "Agent", question: "Is my act under-priced?", sort: "value_gap", cohort: "full",
    cta: { label: "Open Value Gap →", tab: "booking" },
    blurb: "Sorted by how far independently-measured demand runs ahead of the current fee band - your re-pricing leverage, act by act.",
  },
  promoter: {
    label: "Promoter", question: "Who's hot, and affordable?", sort: "momentum_score", cohort: "full",
    cta: { label: "City Scout →", tab: "scouting" },
    blurb: "Sorted by momentum - who's accelerating right now. Each card shows the estimated fee band so you can weigh heat against budget.",
  },
  festival: {
    label: "Festival", question: "Who's rising into headliner tier?", sort: "score", cohort: "rising",
    cta: null,
    blurb: "The rising cohort: real momentum plus the scene and live-booking credibility to carry a bigger stage - re-ranked within the tier, not buried under established headliners.",
  },
};
