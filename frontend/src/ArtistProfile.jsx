import { useRef } from "react";
import { ARTIST_PROFILES } from "./artistProfiles";
import "./ArtistProfile.css";

export const slugify = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// Reusable inline link to an artist's profile. Inherits surrounding text style;
// stops propagation so it won't trigger parent row/card click handlers.
export function ArtistLink({ name, className = "", children }) {
  return (
    <a
      className={`artist-link ${className}`.trim()}
      href={`#/artist/${slugify(name)}`}
      onClick={e => e.stopPropagation()}
    >
      {children ?? name}
    </a>
  );
}

function fmt(n) {
  if (n == null || n === 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

// ── Career trajectory (12-mo search interest) ──
function TrajectoryChart({ series }) {
  if (!Array.isArray(series) || series.length < 4) {
    return <div className="ap-chart-empty">Career trajectory builds as 12-month search data lands.</div>;
  }
  const W = 600, H = 140, pad = 8;
  const max = Math.max(...series, 1);
  const pts = series.map((v, i) => [
    pad + (i / (series.length - 1)) * (W - pad * 2),
    H - pad - (v / max) * (H - pad * 2),
  ]);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${pad},${H - pad} ${line} ${(W - pad).toFixed(1)},${H - pad}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="ap-chart" preserveAspectRatio="none">
      <defs><linearGradient id="apTraj" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#a8e00f" stopOpacity="0.30" />
        <stop offset="100%" stopColor="#a8e00f" stopOpacity="0" />
      </linearGradient></defs>
      <polygon points={area} fill="url(#apTraj)" />
      <polyline points={line} fill="none" stroke="#a8e00f" strokeWidth="2"
        strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// ── Historical rank chart (12 weeks) — lower rank = higher on chart ──
function RankChart({ history }) {
  const pts = (history || []).filter(p => p.r != null).slice(-84);
  if (pts.length < 2) {
    return <div className="ap-chart-empty">Rank history is building — check back as weekly data accumulates.</div>;
  }
  const W = 600, H = 140, pad = 14;
  const ranks = pts.map(p => p.r);
  const min = Math.min(...ranks), max = Math.max(...ranks);
  const span = max - min || 1;
  const xy = pts.map((p, i) => [
    pad + (i / (pts.length - 1)) * (W - pad * 2),
    pad + ((p.r - min) / span) * (H - pad * 2), // higher rank number → lower on chart
  ]);
  const line = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const improving = pts[pts.length - 1].r <= pts[0].r;
  const color = improving ? "#4caf50" : "#e74c3c";
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="ap-chart" preserveAspectRatio="none">
        <polyline points={line} fill="none" stroke={color} strokeWidth="2"
          strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {xy.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.5" fill={color} />)}
      </svg>
      <div className="ap-chart-foot">
        <span>#{pts[0].r} · {pts[0].d}</span>
        <span>{improving ? "▲ climbing" : "▼ slipping"}</span>
        <span>#{pts[pts.length - 1].r} · now</span>
      </div>
    </>
  );
}

// ── Shareable ranking card (canvas → PNG) ──
async function generateCard(dj, profile) {
  const W = 1080, H = 1080;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d");

  // background
  const g = x.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#0b0b0f"); g.addColorStop(1, "#15151f");
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = "#a8e00f"; x.fillRect(0, 0, W, 12);

  // header
  x.fillStyle = "#888"; x.font = "600 30px Inter, Arial, sans-serif";
  x.textAlign = "left"; x.fillText("THE DJ RANKINGS", 70, 110);

  // rank
  x.fillStyle = "#fff"; x.font = "800 120px Inter, Arial, sans-serif";
  x.fillText(`#${dj.rank}`, 66, 250);
  x.fillStyle = "#a8e00f"; x.font = "600 30px Inter, Arial, sans-serif";
  x.fillText("GLOBAL RANK", 70, 290);

  // artist image (circle) with fallback
  const cx = W - 250, cy = 200, r = 120;
  const drawInitial = () => {
    x.fillStyle = "#222"; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
    x.fillStyle = "#a8e00f"; x.font = "800 110px Inter, Arial, sans-serif"; x.textAlign = "center";
    x.fillText((dj.name[0] || "?").toUpperCase(), cx, cy + 40); x.textAlign = "left";
  };
  if (dj.image) {
    try {
      const img = await new Promise((res, rej) => {
        const im = new Image(); im.crossOrigin = "anonymous";
        im.onload = () => res(im); im.onerror = rej; im.src = dj.image;
      });
      x.save(); x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.clip();
      x.drawImage(img, cx - r, cy - r, r * 2, r * 2); x.restore();
      x.lineWidth = 4; x.strokeStyle = "#a8e00f"; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.stroke();
    } catch { drawInitial(); }
  } else drawInitial();

  // name
  x.fillStyle = "#fff"; x.font = "800 84px Inter, Arial, sans-serif";
  x.fillText(dj.name.length > 18 ? dj.name.slice(0, 17) + "…" : dj.name, 70, 470);
  // genres / label
  x.fillStyle = "#aaa"; x.font = "400 34px Inter, Arial, sans-serif";
  const sub = [(profile?.genres || []).slice(0, 2).join(" · "), profile?.label].filter(Boolean).join("  •  ");
  if (sub) x.fillText(sub, 70, 525);

  // stats
  const stats = [
    ["Score", dj.score != null ? String(dj.score) : "—"],
    ["Spotify", fmt(dj.spotify_monthly_listeners)],
    ["Beatport", dj.beatport_score ? `${dj.beatport_score}/100` : "—"],
    ["TikTok", fmt(dj.tiktok_post_count)],
  ];
  let sy = 660;
  for (const [label, val] of stats) {
    x.fillStyle = "#666"; x.font = "600 30px Inter, Arial, sans-serif"; x.fillText(label.toUpperCase(), 70, sy);
    x.fillStyle = "#fff"; x.font = "800 56px Inter, Arial, sans-serif"; x.textAlign = "right";
    x.fillText(val, W - 70, sy); x.textAlign = "left";
    sy += 100; x.strokeStyle = "#2a2a2a"; x.beginPath(); x.moveTo(70, sy - 55); x.lineTo(W - 70, sy - 55); x.stroke();
  }

  // footer
  x.fillStyle = "#a8e00f"; x.font = "700 34px Inter, Arial, sans-serif"; x.textAlign = "center";
  x.fillText("thedjrankings.com", W / 2, H - 60); x.textAlign = "left";

  return new Promise(res => c.toBlob(res, "image/png"));
}

export default function ArtistProfile({ rankings, slug, onBack }) {
  const cardBusy = useRef(false);
  const dj = rankings.find(a => slugify(a.name) === slug);
  if (!dj) {
    return (
      <div className="ap-page"><button className="ap-back" onClick={onBack}>← Back</button>
        <div className="ap-chart-empty">Artist not found.</div></div>
    );
  }
  const profile = ARTIST_PROFILES[dj.name] || {};
  const genres = profile.genres || dj.genres || [];

  // Plain PNG download — deliberately NOT using navigator.share(), which on iOS
  // surfaces a "wants to access other apps and services" prompt that reads as
  // sketchy to first-time visitors. A download has no permission surface at all.
  async function share() {
    if (cardBusy.current) return; cardBusy.current = true;
    try {
      const blob = await generateCard(dj, profile);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${slugify(dj.name)}-rank.png`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.warn("card failed", e); }
    cardBusy.current = false;
  }

  const stats = [
    { label: "Overall Score", value: dj.score ?? "—" },
    { label: "Spotify Listeners", value: fmt(dj.spotify_monthly_listeners) },
    { label: "Beatport Score", value: dj.beatport_score ? `${dj.beatport_score}/100` : "—" },
    { label: "RA Score", value: dj.ra_score ? `${dj.ra_score}/100` : "—" },
    { label: "TikTok Posts", value: fmt(dj.tiktok_post_count) },
    { label: "YouTube Subs", value: fmt(dj.youtube_subscribers) },
    { label: "Google Trends", value: dj.google_trends_score ? `${Math.round(dj.google_trends_score)}/100` : "—" },
  ];

  const TIER_LABELS = ["", "<300 cap", "300–700", "700–1.5K", "1.5K–5K", "5K+"];
  const raAttendTrend = dj.ra_attending_h1 && dj.ra_attending_h2
    ? dj.ra_attending_h1 > dj.ra_attending_h2 * 1.1 ? "↑" : dj.ra_attending_h1 < dj.ra_attending_h2 * 0.9 ? "↓" : "→"
    : null;

  return (
    <div className="ap-page">
      <button className="ap-back" onClick={onBack}>← Back to rankings</button>

      <div className="ap-header">
        <div className="ap-avatar">
          {dj.image ? <img src={dj.image} alt={dj.name} /> : <div className="ap-avatar-ph">{dj.name[0]}</div>}
        </div>
        <div className="ap-head-info">
          <div className="ap-rank-badge">#{dj.rank}</div>
          <h1 className="ap-name">{dj.name}</h1>
          <div className="ap-meta">
            {profile.hometown && <span>{profile.hometown}</span>}
            {profile.label && <span>{profile.label}</span>}
            {profile.since && <span>Active since {profile.since}</span>}
          </div>
          <div className="ap-genres">{genres.map(g => <span key={g} className="ap-genre">{g}</span>)}</div>
        </div>
        <button className="ap-share" onClick={share}>↓ Download ranking card</button>
      </div>

      {profile.bio && <p className="ap-bio">{profile.bio}</p>}

      {(Number.isFinite(dj.momentum_score) || dj.value_signal || Number.isFinite(dj.live_conversion_score) || dj.label_score != null) && (
        <div className="ap-signals">
          {Number.isFinite(dj.live_conversion_score) && (
            <div className={`ap-signal ${dj.live_conversion_score >= 80 ? "ap-signal--buy" : ""}`}>
              <div className="ap-signal-val">{dj.live_conversion_score}<span>/100</span></div>
              <div className="ap-signal-key">Live Conversion</div>
              <div className="ap-signal-sub">{dj.ra_avg_attending} RA attending per typical show vs streaming reach</div>
            </div>
          )}
          {dj.label_score != null && dj.label_best && (
            <div className="ap-signal">
              <div className="ap-signal-val" style={{ fontSize: 18 }}>{dj.label_best}</div>
              <div className="ap-signal-key">Label tier {dj.label_tier}/5{dj.label_trajectory === "ascending" ? " ↑" : ""}</div>
              <div className="ap-signal-sub">{dj.label_trajectory === "ascending" ? "moving onto bigger labels" : "current charting label"}</div>
            </div>
          )}
          {Number.isFinite(dj.momentum_score) && (
            <div className="ap-signal">
              <div className="ap-signal-val" style={{ color: dj.momentum_score >= 65 ? "#C8F750" : "#E9E7DF" }}>
                {dj.momentum_score}<span>/100</span>
              </div>
              <div className="ap-signal-key">Momentum</div>
              <div className="ap-signal-sub">acceleration vs. own baseline</div>
            </div>
          )}
          {dj.booking_fee && (
            <div className="ap-signal">
              <div className="ap-signal-val">{dj.booking_fee.label}</div>
              <div className="ap-signal-key">Booking fee {dj.booking_fee.basis === "curated" || dj.booking_fee.basis === "anchored" ? "" : "(est.)"}</div>
              <div className="ap-signal-sub">curated club/festival range</div>
            </div>
          )}
          {dj.value_signal && dj.value_signal !== "fair" && (
            <div className={`ap-signal ap-signal--${dj.value_signal === "premium" ? "prem" : "buy"}`}>
              <div className="ap-signal-val">
                {dj.value_signal === "premium" ? "Priced ahead" : `${dj.value_gap > 0 ? "+" : ""}${dj.value_gap} tier${Math.abs(dj.value_gap) !== 1 ? "s" : ""}`}
              </div>
              <div className="ap-signal-key">
                {dj.value_signal === "strong-buy" ? "Strong buy" : dj.value_signal === "buy" ? "Underpriced" : "Price vs demand"}
              </div>
              <div className="ap-signal-sub">
                {dj.value_signal === "premium" ? "fee runs hotter than demand" : `demand implies ${dj.demand_fee_label}`}
              </div>
            </div>
          )}
        </div>
      )}

      {Number.isFinite(dj.value_gap) && (
        <a className="ap-valuelink" href={`#/value/${slugify(dj.name)}`}>
          ✦ View {dj.name}'s Fair Value report — the neutral, live-anchored fee benchmark →
        </a>
      )}

      {/* Touring summary — Songkick when matched, otherwise backfilled from RA
          (RA is the better-covered source; Songkick can't match many names). */}
      {(dj.tour_upcoming > 0 || dj.ra_upcoming > 0 || dj.ra_events_6m > 0) && (() => {
        const sk = dj.tour_upcoming > 0;                       // have Songkick upcoming + next-show detail
        const upcoming = sk ? dj.tour_upcoming : (dj.ra_upcoming || dj.ra_events_6m || 0);
        const countries = dj.tour_countries || dj.ra_countries || 0;
        return (
          <div className="ap-tour">
            <div className="ap-tour-item">
              <div className="ap-tour-val">{upcoming}{sk && dj.tour_upcoming_capped ? "+" : ""}</div>
              <div className="ap-tour-label">{sk ? "Upcoming shows" : "Recent bookings"}</div>
            </div>
            <div className="ap-tour-item">
              <div className="ap-tour-val">{countries || "—"}</div>
              <div className="ap-tour-label">Countries</div>
            </div>
            {sk && dj.tour_next_date ? (
              <div className="ap-tour-item ap-tour-next">
                <div className="ap-tour-val">{dj.tour_next_date}</div>
                <div className="ap-tour-label">Next: {dj.tour_next_city}{dj.tour_next_country ? `, ${dj.tour_next_country}` : ""}</div>
              </div>
            ) : dj.ra_avg_attending > 0 ? (
              <div className="ap-tour-item ap-tour-next">
                <div className="ap-tour-val">{fmt(dj.ra_avg_attending)}</div>
                <div className="ap-tour-label">Avg attending / show</div>
              </div>
            ) : <div className="ap-tour-item" />}
            <div className="ap-tour-item">
              <div className="ap-tour-val" style={{ color: "#f5a623" }}>{dj.tour_score || dj.ra_score || "—"}</div>
              <div className="ap-tour-label">{dj.tour_score ? "Tour density" : "RA booking score"}</div>
            </div>
          </div>
        );
      })()}

      {dj.ra_score > 0 && (
        <div className="ap-ra">
          <div className="ap-ra-header">
            <span className="ap-ra-label">Resident Advisor</span>
            <a className="ap-ra-link" href={`https://ra.co/dj/${dj.ra_slug}`} target="_blank" rel="noreferrer">View on RA ↗</a>
          </div>
          <div className="ap-ra-grid">
            <div className="ap-ra-item">
              <div className="ap-ra-val">{dj.ra_followers ? fmt(dj.ra_followers) : "—"}</div>
              <div className="ap-ra-key">RA Followers</div>
            </div>
            <div className="ap-ra-item">
              <div className="ap-ra-val">{dj.ra_events_6m ?? "—"}<span className="ap-ra-unit"> / 6mo</span></div>
              <div className="ap-ra-key">Bookings</div>
            </div>
            <div className="ap-ra-item">
              <div className="ap-ra-val">
                {dj.ra_avg_attending ?? "—"}
                {raAttendTrend && <span className={`ap-ra-trend ap-ra-trend--${raAttendTrend === "↑" ? "up" : raAttendTrend === "↓" ? "down" : "flat"}`}>{raAttendTrend}</span>}
              </div>
              <div className="ap-ra-key">Avg Attending</div>
            </div>
            <div className="ap-ra-item">
              <div className="ap-ra-val">{dj.ra_venue_tier ? TIER_LABELS[Math.round(dj.ra_venue_tier)] : "—"}</div>
              <div className="ap-ra-key">Venue Size</div>
            </div>
            <div className="ap-ra-item">
              <div className="ap-ra-val">{dj.ra_countries ?? "—"}</div>
              <div className="ap-ra-key">Countries</div>
            </div>
            <div className="ap-ra-item">
              <div className="ap-ra-val">{dj.ra_upcoming ?? "—"}</div>
              <div className="ap-ra-key">Upcoming</div>
            </div>
          </div>
          {(dj.ra_top_regions?.length > 0 || dj.ra_country_list?.length > 0) && (
            <div className="ap-ra-regions">
              {dj.ra_top_regions?.length > 0 && (
                <div>
                  <span className="ap-ra-regions-label">Most played: </span>
                  {dj.ra_top_regions.map((r, i) => (
                    <span key={i} className="ap-ra-tag">{r.name}</span>
                  ))}
                </div>
              )}
              {dj.ra_country_list?.length > 0 && (
                <div>
                  <span className="ap-ra-regions-label">Recent markets: </span>
                  {dj.ra_country_list.map((c, i) => (
                    <span key={i} className="ap-ra-tag">{c}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="ap-grid">
        <div className="ap-card">
          <div className="ap-card-title">Career Trajectory <span>· search interest, 12 mo</span></div>
          <TrajectoryChart series={dj.trends_12m} />
        </div>
        <div className="ap-card">
          <div className="ap-card-title">Historical Rank <span>· last 12 weeks</span></div>
          <RankChart history={dj.rank_history} />
        </div>
      </div>

      <div className="ap-stats">
        {stats.map(s => (
          <div key={s.label} className="ap-stat">
            <div className="ap-stat-val">{s.value}</div>
            <div className="ap-stat-label">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
