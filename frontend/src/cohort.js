// Cohort indices, rank-uncertainty bands, and stakeholder lenses for the rankings
// page. Kept in its own module so the App.jsx monolith stays thin and parallel
// sessions don't collide on it.
//
// WHY within-cohort scoring: the global index normalises every signal across a
// 330-deep pool, so one streaming giant compresses the reach signal for everyone
// and the score barely discriminates inside a sub-group. Re-normalising within a
// smaller, more homogeneous cohort (emerging acts, one region, the rising tier)
// is statistically cleaner — the scale is set by the cohort, not by global outliers.

// Re-score a subset against ITSELF: min-max each signal within the subset, weight
// by the published METRICS weights, self-heal empty-in-cohort signals, and apply
// the same scene credibility floor the global model uses. Returns the subset
// sorted by cohort_score with a 1..N cohort_rank.
export function rankWithinCohort(subset, metricDefs) {
  if (!subset || subset.length === 0) return [];
  const ranges = {};
  for (const m of metricDefs) {
    const vals = subset.map(a => a[m.key] || 0);
    ranges[m.key] = { min: Math.min(...vals), max: Math.max(...vals) };
  }
  const live = metricDefs.filter(m => ranges[m.key].max > 0);
  const liveW = live.reduce((t, m) => t + m.weight, 0) || 1;
  const norm = (v, mn, mx) => (mx <= mn ? 0 : ((v - mn) / (mx - mn)) * 100);

  return subset
    .map(a => {
      let s = 0;
      let covW = 0;
      for (const m of live) {
        if (Number.isFinite(a[m.key]) && a[m.key] > 0) covW += m.weight / liveW;
        s += norm(a[m.key] || 0, ranges[m.key].min, ranges[m.key].max) * (m.weight / liveW);
      }
      const scene = Number.isFinite(a.manual_scene_score) ? a.manual_scene_score : 50;
      const cred = 0.75 + 0.25 * (Math.min(scene, 50) / 50);
      const covFactor = 0.8 + 0.2 * Math.min(covW / 0.75, 1);
      return { ...a, cohort_score: Math.round(s * cred * covFactor * 10) / 10, cohort_coverage: Math.round(covW * 100) };
    })
    .sort((x, y) => y.cohort_score - x.cohort_score)
    .map((a, i) => ({ ...a, cohort_rank: i + 1 }));
}

// Rank-uncertainty band. A hard ordinal (#7 vs #9) implies a precision the data
// doesn't have. This finds the contiguous run of acts whose score sits within a
// small noise epsilon of this act's score — i.e. the ranks that are statistically
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
// carry a bigger stage — not just a viral spike. The festival lens cohort.
export function isRising(a) {
  return Number.isFinite(a.momentum_score) && a.momentum_score >= 45
    && (a.manual_scene_score ?? 0) >= 55
    && (a.live_demand_score ?? a.ra_score ?? 0) >= 40;
}

// Stakeholder lenses. Same index, three jobs-to-be-done. Each sets a default sort,
// an optional cohort, a one-line framing, and a jump to the tool that finishes the
// job — making explicit what City Scout / Value Gap already started.
export const PERSONAS = {
  all: {
    label: "Everyone", question: null, sort: "score", cohort: "full", cta: null,
    blurb: null,
  },
  agent: {
    label: "Agent", question: "Is my act under-priced?", sort: "value_gap", cohort: "full",
    cta: { label: "Open Value Gap →", tab: "booking" },
    blurb: "Sorted by how far independently-measured demand runs ahead of the current fee band — your re-pricing leverage, act by act.",
  },
  promoter: {
    label: "Promoter", question: "Who's hot, and affordable?", sort: "momentum_score", cohort: "full",
    cta: { label: "City Scout →", tab: "scouting" },
    blurb: "Sorted by momentum — who's accelerating right now. Each card shows the estimated fee band so you can weigh heat against budget.",
  },
  festival: {
    label: "Festival", question: "Who's rising into headliner tier?", sort: "score", cohort: "rising",
    cta: null,
    blurb: "The rising cohort: real momentum plus the scene and live-booking credibility to carry a bigger stage — re-ranked within the tier, not buried under established headliners.",
  },
};
