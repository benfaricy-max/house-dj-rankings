/**
 * Club vs Viral lens — the booker's trust filter. Cookiy AI research was blunt:
 * bookers trust CLUB traction (RA bookings, Beatport charts, DJs actually playing
 * the tracks) and treat VIRAL traction (TikTok, raw streaming) as noise that can
 * evaporate before the date. A single blended "momentum" number hides which kind
 * an artist's heat is. This splits it: of an act's measured traction, how much is
 * scene-driven vs hype-driven — so a booker knows whether the demand will still be
 * there on the night.
 *
 * Built from signals already in the model (no new data). Club + Viral are each a
 * 0-100 blend of the signals the artist has; the split is their relative balance.
 */

// Heavy-tailed reach signals are log-compressed before normalising — mirror of
// the conditioning in computeRanges (App.jsx) / score.js. The `ranges` passed in
// are built on these LOG-scaled values, so a raw count must be prep'd the same
// way before it's normalised, or it blows past 100 (e.g. 14.5M listeners against
// a log range of 0–7.3). This is exactly the bug this fixes.
const HEAVY_TAILED = new Set([
  "spotify_monthly_listeners", "youtube_subscribers", "tiktok_post_count",
  "spotify_playlist_placements", "wikipedia_pageviews",
]);
const prep = (key, v) => { const x = Number.isFinite(v) ? v : 0; return HEAVY_TAILED.has(key) ? Math.log10(1 + Math.max(0, x)) : x; };
const normalize = (v, min, max) => (max <= min ? 0 : ((Math.max(min, Math.min(max, v)) - min) / (max - min)) * 100);

// CLUB = scene / DJ / live-booking demand. VIRAL = consumer hype / reach.
const CLUB = [
  { key: "live_demand_score", pct100: true },   // live-booking strength: RA + tour blend (already 0-100)
  { key: "beatport_score",    pct100: true },   // Beatport chart credibility (already 0-100)
 { key: "tl_support_score", pct100: true }, // 1001Tracklists, DJs actually playing it
];
const VIRAL = [
  { key: "google_trends_score",     pct100: true },  // search hype (already 0-100)
  { key: "tiktok_post_count" },                       // social virality (normalized vs field)
  { key: "spotify_monthly_listeners" },               // mainstream streaming reach (normalized)
];

function blend(dj, defs, ranges) {
  let sum = 0, n = 0;
  for (const d of defs) {
    const raw = dj[d.key] ?? 0;
    if (!(raw > 0)) continue;
    const r = ranges?.[d.key];
    const v = d.pct100 ? Math.min(100, raw) : (r ? normalize(prep(d.key, raw), r.min, r.max) : null);
    if (v == null) continue;
    sum += v; n++;
  }
  return n ? { score: sum / n, n } : { score: 0, n: 0 };
}

export function computeClubViral(dj, ranges) {
  const club = blend(dj, CLUB, ranges);
  const viral = blend(dj, VIRAL, ranges);
  if (club.n === 0 && viral.n === 0) return null;
  const total = club.score + viral.score;
  const clubPct = total > 0 ? Math.round((club.score / total) * 100) : 50;
  const label = clubPct >= 62 ? "Scene-driven" : clubPct <= 38 ? "Hype-driven" : "Balanced";
  const tone = clubPct >= 62 ? "club" : clubPct <= 38 ? "viral" : "mixed";
  return { clubPct, viralPct: 100 - clubPct, label, tone, clubN: club.n, viralN: viral.n };
}

const NOTE = {
 club: "Demand is rooted in scene signals (RA bookings, Beatport, DJ support), the kind bookers trust to still be there on the night.",
 viral: "Heat is mostly consumer hype (social + streaming) and light on scene signals, can cool fast; price for the risk.",
  mixed: "A balanced mix of scene credibility and consumer reach.",
};

export default function ClubViral({ dj, ranges, compact = false }) {
  const cv = computeClubViral(dj, ranges);
  if (!cv) return null;
  return (
    <div className={`clubviral${compact ? " clubviral--compact" : ""}`}>
      <div className="cv-head">
        <span className="cv-dot" />
        Club vs Viral
        <span className={`cv-verdict cv-verdict--${cv.tone}`}>{cv.label}</span>
      </div>
      <div className="cv-bar" role="img" aria-label={`${cv.clubPct}% club traction, ${cv.viralPct}% viral`}>
        <div className="cv-seg cv-seg--club" style={{ width: `${cv.clubPct}%` }} />
        <div className="cv-seg cv-seg--viral" style={{ width: `${cv.viralPct}%` }} />
      </div>
      <div className="cv-legend">
        <span className="cv-leg cv-leg--club">Club {cv.clubPct}%<span className="cv-leg-sub">Live · Beatport · 1001TL</span></span>
        <span className="cv-leg cv-leg--viral">Viral {cv.viralPct}%<span className="cv-leg-sub">TikTok · streaming · search</span></span>
      </div>
      {!compact && <div className={`cv-note cv-note--${cv.tone}`}>{NOTE[cv.tone]}</div>}
    </div>
  );
}
