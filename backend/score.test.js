// Golden-file regression test for the composite ranking model (score.js).
//
// score.js IS the product. Its weights, normalisation, self-healing, and the
// two-sided credibility multiplier are hand-tuned against the labelled set
// (~82% intent agreement) — a silent change to any of them re-ranks the whole
// index. This test pins a small, hand-built roster to EXACT scores + ranks so
// any future edit to the model has to consciously update the goldens (and prove
// the new numbers are intended) instead of shipping a regression unnoticed.
//
// Run: `npm test` (backend/) or `node --test`.
//
// The five fixture acts deliberately exercise the model's core behaviours:
//   headliner — high live-demand + high scene            → must lead
//   crossover — huge reach + top trends, LOW scene       → credibility multiplier
//                                                           must demote it below djsdj
//   djsdj     — low reach, high scene + beatport, and
//               ABSENT tl_support + scene_geography      → self-heal must drop those
//                                                           from its denominator (total 11, not 13)
//   mid       — middling everything
//   longtail  — thin across the board                    → must trail
//
// To regenerate goldens after an INTENTIONAL model change: run the roster
// through scoreArtists and paste the new score/rank values below.

const test = require("node:test");
const assert = require("node:assert/strict");
const { scoreArtists } = require("./score");

const ROSTER = [
  { name: "headliner",  live_demand_score: 88, manual_scene_score: 90, beatport_score: 70,
    tl_support_score: 60, google_trends_score: 65, spotify_follower_growth_rate: 30,
    scene_geography: 72, label_score: 80, spotify_monthly_listeners: 4_000_000,
    youtube_subscribers: 800_000, tiktok_post_count: 12_000, spotify_playlist_placements: 40,
    wikipedia_pageviews: 50_000 },
  { name: "crossover",  live_demand_score: 55, manual_scene_score: 25, beatport_score: 30,
    tl_support_score: 20, google_trends_score: 95, spotify_follower_growth_rate: 80,
    scene_geography: 20, label_score: 35, spotify_monthly_listeners: 18_000_000,
    youtube_subscribers: 5_000_000, tiktok_post_count: 90_000, spotify_playlist_placements: 120,
    wikipedia_pageviews: 200_000 },
  // djsdj intentionally OMITS tl_support_score + scene_geography to exercise SELF_HEAL_ABSENT.
  { name: "djsdj",      live_demand_score: 80, manual_scene_score: 95, beatport_score: 85,
    google_trends_score: 22, spotify_follower_growth_rate: 10, label_score: 78,
    spotify_monthly_listeners: 600_000, youtube_subscribers: 120_000, tiktok_post_count: 800,
    spotify_playlist_placements: 18, wikipedia_pageviews: 9_000 },
  { name: "mid",        live_demand_score: 50, manual_scene_score: 50, beatport_score: 48,
    tl_support_score: 35, google_trends_score: 40, spotify_follower_growth_rate: 25,
    scene_geography: 45, label_score: 45, spotify_monthly_listeners: 1_500_000,
    youtube_subscribers: 300_000, tiktok_post_count: 4_000, spotify_playlist_placements: 25,
    wikipedia_pageviews: 20_000 },
  { name: "longtail",   live_demand_score: 18, manual_scene_score: 30, beatport_score: 15,
    tl_support_score: 10, google_trends_score: 12, spotify_follower_growth_rate: 5,
    scene_geography: 25, label_score: 20, spotify_monthly_listeners: 120_000,
    youtube_subscribers: 20_000, tiktok_post_count: 200, spotify_playlist_placements: 6,
    wikipedia_pageviews: 1_500 },
];

// Golden snapshot — captured from score.js (model vector v4, Jun 2026).
const GOLDEN = {
  headliner: { rank: 1, score: 94,   signals_total: 13 },
  djsdj:     { rank: 2, score: 80.3, signals_total: 11 }, // 11 = tl_support + scene_geography self-healed away
  mid:       { rank: 3, score: 43,   signals_total: 13 },
  crossover: { rank: 4, score: 42.7, signals_total: 13 },
  longtail:  { rank: 5, score: 3.7,  signals_total: 13 },
};

function rankBy(name, ranked) {
  return ranked.find(a => a.name === name);
}

test("scoreArtists is deterministic and matches the golden snapshot", () => {
  // scoreArtists mutates input (live_demand fallback), so pass a deep copy.
  const ranked = scoreArtists(structuredClone(ROSTER));

  for (const [name, want] of Object.entries(GOLDEN)) {
    const got = rankBy(name, ranked);
    assert.ok(got, `expected "${name}" in the ranked output`);
    assert.equal(got.rank, want.rank, `${name} rank`);
    assert.equal(got.score, want.score, `${name} score`);
    assert.equal(got.signals_total, want.signals_total, `${name} signals_total`);
  }
});

test("rank order is exactly headliner > djsdj > mid > crossover > longtail", () => {
  const ranked = scoreArtists(structuredClone(ROSTER));
  const order = ranked.sort((a, b) => a.rank - b.rank).map(a => a.name);
  assert.deepEqual(order, ["headliner", "djsdj", "mid", "crossover", "longtail"]);
});

test("credibility multiplier demotes a high-reach / low-scene crossover below a low-reach DJ's-DJ", () => {
  const ranked = scoreArtists(structuredClone(ROSTER));
  const crossover = rankBy("crossover", ranked);
  const djsdj = rankBy("djsdj", ranked);
  // crossover has far more reach + the top trends/growth, yet must rank LOWER
  // than djsdj purely on scene credibility. If this flips, the multiplier broke.
  assert.ok(crossover.rank > djsdj.rank,
    `crossover (#${crossover.rank}) should rank below djsdj (#${djsdj.rank})`);
});

test("SELF_HEAL_ABSENT drops absent sparse signals from the per-artist denominator", () => {
  const ranked = scoreArtists(structuredClone(ROSTER));
  const djsdj = rankBy("djsdj", ranked);
  const headliner = rankBy("headliner", ranked);
  // djsdj omits tl_support_score + scene_geography → counted signals = 13 - 2 = 11.
  assert.equal(djsdj.signals_total, 11, "djsdj should self-heal its 2 absent sparse signals away");
  assert.equal(headliner.signals_total, 13, "headliner carries the full panel");
});

test("a missing/empty roster does not throw", () => {
  assert.doesNotThrow(() => scoreArtists([]));
  assert.deepEqual(scoreArtists([]), []);
});
