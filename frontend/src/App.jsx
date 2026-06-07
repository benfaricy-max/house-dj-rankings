import { useEffect, useState, useMemo, useRef, lazy, Suspense } from "react";
import "./App.css";
const ProPage = lazy(() => import("./ProPage"));   // code-split: the ~750-line tab loads in its own chunk
import ArtistProfile, { slugify, ArtistLink } from "./ArtistProfile";
import { ValueGapPage, ValueReport, valueSlug } from "./ValueGap";
const ClubsPage   = lazy(() => import("./ClubsPage"));                                  // splits ~750 lines of club lore/images out of the main chunk
const ClubProfile = lazy(() => import("./ClubsPage").then(m => ({ default: m.ClubProfile })));
const BlogPage    = lazy(() => import("./BlogPage"));                                   // editor-only tab — rarely loaded
const BlogPost    = lazy(() => import("./BlogPage").then(m => ({ default: m.BlogPost })));

// a11y helper: make a non-button element behave like a button for keyboard +
// screen-reader users (Enter/Space activate, focusable, announced as a button).
// Pass `expanded` for disclosure widgets to emit aria-expanded.
export const pressable = (handler, expanded) => ({
  role: "button",
  tabIndex: 0,
  onClick: handler,
  onKeyDown: e => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handler(e); }
  },
  ...(expanded !== undefined ? { "aria-expanded": expanded } : {}),
});

const parseProfileSlug = () => {
  const m = (window.location.hash || "").match(/^#\/artist\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
};
const parseMarketSlug = () => {
  const m = (window.location.hash || "").match(/^#\/market\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
};
const parseClubSlug = () => {
  const m = (window.location.hash || "").match(/^#\/club\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
};
const parseBlogSlug = () => {
  const m = (window.location.hash || "").match(/^#\/blog\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
};
const parseValueSlug = () => {
  const m = (window.location.hash || "").match(/^#\/value\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
};
// Editor-only gate: the Journal stays hidden from the public until it's ready.
// Visit the site once with ?editor=1 (or #editor) on this device to unlock it;
// the flag is remembered in localStorage. Use ?editor=0 to lock it again.
const isEditor = () => {
  try {
    const s = (window.location.search + " " + window.location.hash);
    if (/[?&#]editor=1\b/.test(s) || /#editor\b/.test(s)) localStorage.setItem("pt_editor", "1");
    if (/[?&#]editor=0\b/.test(s)) localStorage.removeItem("pt_editor");
    return localStorage.getItem("pt_editor") === "1";
  } catch { return false; }
};

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
const MEDAL = { 1: "🥇", 2: "🥈", 3: "🥉" };

const METRICS = [
  { key: "manual_scene_score",           label: "Scene Score",        weight: 0.18, format: "score100" },
  { key: "beatport_score",               label: "Beatport Chart",     weight: 0.13, format: "score100" },
  { key: "ra_score",                     label: "RA Booking",         weight: 0.12, format: "score100" },
  { key: "spotify_monthly_listeners",    label: "Monthly Listeners",  weight: 0.11, format: "count"    },
  { key: "google_trends_score",          label: "Google Trends",      weight: 0.09, format: "score100" },
  { key: "spotify_follower_growth_rate", label: "Listener Growth",    weight: 0.08, format: "pct"      },
  { key: "youtube_subscribers",          label: "YT Subscribers",     weight: 0.06, format: "count"    },
  { key: "tiktok_post_count",            label: "TikTok Posts",       weight: 0.06, format: "posts"    },
  { key: "tl_support_score",             label: "DJ Support (1001TL)",weight: 0.05, format: "score100" },
  { key: "label_score",                  label: "Label Trajectory",   weight: 0.05, format: "score100" },
  { key: "spotify_playlist_placements",  label: "Releases",           weight: 0.05, format: "number"   },
  { key: "wikipedia_pageviews",          label: "Wikipedia Views",    weight: 0.02, format: "count"    },
];

const SORT_OPTIONS = [
  { key: "score",                       label: "Score"      },
  { key: "momentum_score",              label: "Momentum"   },
  { key: "spotify_monthly_listeners",   label: "Listeners"  },
  { key: "google_trends_score",         label: "Trending"   },
  { key: "youtube_subscribers",         label: "YouTube"    },
  { key: "beatport_score",              label: "Beatport"   },
];

// ── Utilities ─────────────────────────────────────────────────────

function fmt(n) {
  if (n == null || n === 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

function fmtMetric(value, format) {
  if (value == null) return "—";
  switch (format) {
    case "count":    return fmt(value);
    case "posts":    return `${fmt(value)} posts`;
    case "number":   return value ? String(value) : "—";
    case "score100": return value ? `${Math.round(value)} / 100` : "—";
    case "pct":      return value ? `${value > 0 ? "+" : ""}${value.toFixed(1)}%` : "—";
    default:         return String(value ?? "—");
  }
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function computeRanges(rankings) {
  const ranges = {};
  for (const { key } of METRICS) {
    const vals = rankings.map(a => a[key] || 0);
    ranges[key] = { min: Math.min(...vals), max: Math.max(...vals) };
  }
  return ranges;
}

function normalize(value, min, max) {
  if (max === min) return 0;
  return ((value - min) / (max - min)) * 100;
}

// ── Icons ─────────────────────────────────────────────────────────

function SpotifyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.371-.721.49-1.101.241-3.021-1.858-6.832-2.278-11.322-1.237-.43.101-.86-.18-.96-.61-.101-.43.18-.86.61-.96 4.91-1.12 9.121-.641 12.512 1.43.38.239.489.72.261 1.136zm1.47-3.271c-.301.461-.921.6-1.381.301-3.461-2.129-8.732-2.75-12.822-1.5-.53.16-1.08-.14-1.24-.67-.16-.53.14-1.08.67-1.24 4.671-1.419 10.471-.72 14.432 1.721.46.3.6.92.341 1.388zm.13-3.401C15.64 8.851 8.77 8.619 4.92 9.79c-.63.19-1.3-.16-1.49-.79-.19-.63.16-1.3.79-1.49 4.431-1.35 11.801-1.09 16.451 1.73.561.34.74 1.07.4 1.63-.339.56-1.069.74-1.629.4z"/>
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );
}

// ── Small components ───────────────────────────────────────────────

function RankDelta({ delta }) {
  if (delta == null) return null;
  if (delta > 0)  return <span className="rank-delta rank-delta--up">▲{delta}</span>;
  if (delta < 0)  return <span className="rank-delta rank-delta--down">▼{Math.abs(delta)}</span>;
  return <span className="rank-delta rank-delta--flat">—</span>;
}

function ScoreBar({ score, maxScore }) {
  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
  return (
    <div className="score-bar-track">
      <div className="score-bar-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

function ScoreEditor({ dj, onSaved }) {
  const [open, setOpen]     = useState(false);
  const [val, setVal]       = useState(dj.manual_scene_score ?? 0);
  const [saving, setSaving] = useState(false);

  function save() {
    setSaving(true);
    fetch(`${API}/api/artists/${encodeURIComponent(dj.name)}/score`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ manual_scene_score: Number(val) }),
    })
      .then(r => r.json())
      .then(() => { setOpen(false); onSaved(); })
      .catch(() => {})
      .finally(() => setSaving(false));
  }

  if (!open) return (
    <button className="score-edit-btn" onClick={e => { e.stopPropagation(); setOpen(true); }}>
      Edit scene score ({dj.manual_scene_score ?? 0})
    </button>
  );
  return (
    <div className="score-editor" onClick={e => e.stopPropagation()}>
      <input type="number" min="0" max="100" value={val} onChange={e => setVal(e.target.value)} className="score-editor-input" />
      <button className="score-editor-save" onClick={save} disabled={saving}>{saving ? "…" : "Save"}</button>
      <button className="score-editor-cancel" onClick={() => setOpen(false)}>✕</button>
    </div>
  );
}

// ── Trend chart (SVG sparkline) ────────────────────────────────────

function TrendChart({ name }) {
  const [history, setHistory] = useState(undefined);

  useEffect(() => {
    fetch(`${API}/api/artists/${encodeURIComponent(name)}/history`)
      .then(r => r.json())
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [name]);

  if (history === undefined) return <div className="trend-loading">Loading history…</div>;

  const points = (history ?? []).filter(h => h.rank != null);

  if (points.length < 2) {
    return (
      <div className="trend-empty">
        Rank history builds up over time — check back after the next weekly refresh.
      </div>
    );
  }

  const W = 400, H = 90, PX = 20, PY = 16;
  const ranks = points.map(p => p.rank);
  const minR = Math.min(...ranks), maxR = Math.max(...ranks);
  const rangeR = Math.max(maxR - minR, 1);

  const pts = points.map((p, i) => ({
    x: PX + (i / (points.length - 1)) * (W - PX * 2),
    y: PY + ((p.rank - minR) / rangeR) * (H - PY * 2),
    rank: p.rank,
    date: p.timestamp ? new Date(p.timestamp).toLocaleDateString("en-GB", { month: "short", day: "numeric" }) : "",
  }));

  const polyline = pts.map(p => `${p.x},${p.y}`).join(" ");

  // Trend direction: is latest rank better (lower number) than first?
  const improved = pts[pts.length - 1].rank < pts[0].rank;

  return (
    <div className="trend-chart">
      <div className="trend-header">
        <span className="trend-title">Rank History</span>
        <span className={`trend-dir ${improved ? "trend-dir--up" : "trend-dir--down"}`}>
          {improved ? "▲ Climbing" : "▼ Falling"}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="trend-svg" preserveAspectRatio="none">
        <polyline points={polyline} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3.5" fill="var(--accent)" />
            <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="9" fill="var(--muted)">#{p.rank}</text>
            {(i === 0 || i === pts.length - 1) && (
              <text x={p.x} y={H - 2} textAnchor="middle" fontSize="8" fill="var(--muted)" opacity="0.6">{p.date}</text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

// ── Upcoming events ────────────────────────────────────────────────

function UpcomingEvents({ name }) {
  const [events, setEvents] = useState(undefined);

  useEffect(() => {
    fetch(`${API}/api/events/${encodeURIComponent(name)}`)
      .then(r => r.json())
      .then(setEvents)
      .catch(() => setEvents([]));
  }, [name]);

  if (events === undefined) return null;
  if (!events.length) return <div className="events-empty">No upcoming events found via Bandsintown</div>;

  return (
    <div className="events-list">
      <div className="events-title">Upcoming Shows</div>
      {events.map((e, i) => (
        <div key={i} className="event-row">
          <span className="event-date">{fmtDate(e.date)}</span>
          <span className="event-venue">{e.venue}</span>
          <span className="event-city">{e.city}</span>
          {e.ticketUrl && (
            <a href={e.ticketUrl} target="_blank" rel="noreferrer" className="event-ticket" onClick={ev => ev.stopPropagation()}>
              Tickets
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Score breakdown ────────────────────────────────────────────────

function MetricRow({ metric, value, normalized, contribution, maxContrib }) {
  const barPct   = maxContrib > 0 ? (contribution / maxContrib) * 100 : 0;
  const strength = normalized >= 70 ? "strong" : normalized >= 35 ? "mid" : "weak";
  return (
    <div className="metric-row">
      <div className="metric-label">{metric.label}</div>
      <div className="metric-raw">{fmtMetric(value, metric.format)}</div>
      <div className="metric-bar-wrap">
        <div className={`metric-bar metric-bar--${strength}`} style={{ width: `${barPct}%` }} />
      </div>
      <div className="metric-contrib">+{contribution.toFixed(1)}</div>
      <div className="metric-weight">{Math.round(metric.weight * 100)}%</div>
    </div>
  );
}

function ScoreBreakdown({ dj, ranges }) {
  const rows = METRICS.map(metric => {
    const { min, max } = ranges[metric.key] ?? { min: 0, max: 0 };
    const value        = dj[metric.key] ?? 0;
    const normalized   = normalize(value, min, max);
    const contribution = normalized * metric.weight;
    return { metric, value, normalized, contribution };
  }).sort((a, b) => b.contribution - a.contribution);

  const maxContrib = rows[0]?.contribution ?? 1;
  const topTwo     = rows.slice(0, 2).map(r => r.metric.label).join(" & ");

  return (
    <div className="score-breakdown">
      <div className="breakdown-header">
        <div>
          <div className="breakdown-title">Score Breakdown</div>
          <div className="breakdown-sub">Driven by {topTwo}</div>
        </div>
        <div className="breakdown-total">{dj.score} pts</div>
      </div>
      <div className="breakdown-cols">
        <span className="col-header">Signal</span>
        <span className="col-header">Value</span>
        <span className="col-header">Contribution</span>
        <span className="col-header col-right">Pts</span>
        <span className="col-header col-right">Wt</span>
      </div>
      <div className="breakdown-rows">
        {rows.map(({ metric, value, normalized, contribution }) => (
          <MetricRow key={metric.key} metric={metric} value={value} normalized={normalized} contribution={contribution} maxContrib={maxContrib} />
        ))}
      </div>
    </div>
  );
}

// ── Weekly movers ──────────────────────────────────────────────────

function WeeklyMovers({ movers, onScrollTo }) {
  const hasData = movers.rising.length > 0 || movers.falling.length > 0;
  if (!hasData) return null;

  return (
    <section className="movers-section">
      <div className="section-eyebrow">Weekly Movers</div>
      <div className="movers-grid">
        {movers.rising.length > 0 && (
          <div className="movers-col">
            <div className="movers-col-label movers-col-label--up">Rising</div>
            {movers.rising.map(dj => (
              <button key={dj.name} className="mover-row" onClick={() => onScrollTo(dj.name)}>
                <span className="mover-delta mover-delta--up">▲{dj.rank_change}</span>
                <span className="mover-name">{dj.name}</span>
                <span className="mover-rank">#{dj.rank}</span>
              </button>
            ))}
          </div>
        )}
        {movers.falling.length > 0 && (
          <div className="movers-col">
            <div className="movers-col-label movers-col-label--down">Falling</div>
            {movers.falling.map(dj => (
              <button key={dj.name} className="mover-row" onClick={() => onScrollTo(dj.name)}>
                <span className="mover-delta mover-delta--down">▼{Math.abs(dj.rank_change)}</span>
                <span className="mover-name">{dj.name}</span>
                <span className="mover-rank">#{dj.rank}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ── Ones to watch ──────────────────────────────────────────────────

function OnesToWatch({ artists, onScrollTo }) {
  if (!artists.length) return null;
  return (
    <section className="watch-section">
      <div className="section-eyebrow">Ones to Watch</div>
      <div className="watch-scroll">
        {artists.map(dj => (
          <button key={dj.name} className="watch-card" onClick={() => onScrollTo(dj.name)}>
            <div className="watch-avatar">
              {dj.image
                ? <img src={dj.image} alt={dj.name} className="watch-img" />
                : <div className="watch-placeholder">{dj.name[0]}</div>
              }
            </div>
            <div className="watch-name">{dj.name}</div>
            <div className="watch-rank">#{dj.rank}</div>
            <div className="watch-growth">
              +{dj.spotify_follower_growth_rate?.toFixed(1)}% growth
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

// ── Compare modal ──────────────────────────────────────────────────

function CompareModal({ djs, ranges, onClose }) {
  const [a, b] = djs;

  // Close on Escape and lock background scroll while open (modal a11y baseline).
  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const rows = METRICS.map(metric => {
    const { min, max } = ranges[metric.key] ?? { min: 0, max: 0 };
    const normA = normalize(a[metric.key] ?? 0, min, max);
    const normB = normalize(b[metric.key] ?? 0, min, max);
    return { metric, normA, normB, valA: a[metric.key] ?? 0, valB: b[metric.key] ?? 0, winA: normA >= normB };
  });

  const winsA = rows.filter(r => r.winA).length;
  const winsB = rows.length - winsA;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="compare-modal" role="dialog" aria-modal="true" aria-label={`Compare ${a.name} versus ${b.name}`} onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close comparison">✕</button>

        <div className="cmp-header">
          <div className="cmp-dj cmp-dj--left">
            {a.image ? <img src={a.image} alt={a.name} className="cmp-avatar" /> : <div className="cmp-avatar cmp-placeholder">{a.name[0]}</div>}
            <div className="cmp-dj-name">{a.name}</div>
            <div className="cmp-dj-meta">#{a.rank} · {a.score} pts</div>
            <div className="cmp-wins">{winsA} signals</div>
          </div>
          <div className="cmp-vs">vs</div>
          <div className="cmp-dj cmp-dj--right">
            {b.image ? <img src={b.image} alt={b.name} className="cmp-avatar" /> : <div className="cmp-avatar cmp-placeholder">{b.name[0]}</div>}
            <div className="cmp-dj-name">{b.name}</div>
            <div className="cmp-dj-meta">#{b.rank} · {b.score} pts</div>
            <div className="cmp-wins">{winsB} signals</div>
          </div>
        </div>

        <div className="cmp-rows">
          {rows.map(({ metric, normA, normB, valA, valB, winA }) => (
            <div key={metric.key} className={`cmp-row ${winA ? "cmp-row--a" : "cmp-row--b"}`}>
              <div className="cmp-bar-left">
                <span className="cmp-val">{fmtMetric(valA, metric.format)}</span>
                <div className="cmp-track">
                  <div className={`cmp-fill cmp-fill--a ${winA ? "cmp-fill--winner" : ""}`} style={{ width: `${normA}%` }} />
                </div>
              </div>
              <div className="cmp-metric-label">{metric.label}</div>
              <div className="cmp-bar-right">
                <div className="cmp-track">
                  <div className={`cmp-fill cmp-fill--b ${!winA ? "cmp-fill--winner" : ""}`} style={{ width: `${normB}%` }} />
                </div>
                <span className="cmp-val">{fmtMetric(valB, metric.format)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="cmp-footer">
          <div className={`cmp-verdict ${winsA > winsB ? "cmp-verdict--a" : "cmp-verdict--b"}`}>
            {winsA > winsB ? a.name : b.name} leads on {Math.max(winsA, winsB)} of {rows.length} signals
          </div>
        </div>
      </div>
    </div>
  );
}

// ── DJ Card ────────────────────────────────────────────────────────

function DJCard({ dj, maxScore, isTop, expanded, onToggle, ranges, onScoreSaved, inCompare, onToggleCompare }) {
  return (
    <div className={`dj-card ${isTop ? "dj-card--top" : ""} ${expanded ? "dj-card--expanded" : ""} ${inCompare ? "dj-card--comparing" : ""}`}>
      <div className="dj-card-main" {...pressable(onToggle, expanded)} aria-label={`${dj.name}, rank ${dj.rank} — ${expanded ? "collapse" : "expand"} details`}>
        <div className="dj-rank">
          {MEDAL[dj.rank] ?? <span className="rank-num">#{dj.rank}</span>}
          <RankDelta delta={dj.rank_change} />
        </div>

        <div className="dj-avatar-wrap">
          {dj.image
            ? <img src={dj.image} alt={dj.name} className="dj-avatar" />
            : <div className="dj-avatar dj-avatar--placeholder">{dj.name[0]}</div>
          }
        </div>

        <div className="dj-info">
          <div className="dj-name-row">
            <span className="dj-name"><ArtistLink name={dj.name} /></span>
            <span className="dj-score-badge">{dj.score} pts</span>
          </div>
          <ScoreBar score={dj.score} maxScore={maxScore} />
          <div className="dj-quick-stats">
            {Number.isFinite(dj.momentum_score) && (
              <span className={`qs-pill qs-pill--mo ${dj.momentum_score >= 65 ? "qs-mo--hot" : ""}`}>
                ▲ Momentum {dj.momentum_score}
              </span>
            )}
            {dj.spotify_monthly_listeners > 0 && <span className="qs-pill">{fmt(dj.spotify_monthly_listeners)} listeners</span>}
            {dj.tiktok_post_count > 0 && <span className="qs-pill">{fmt(dj.tiktok_post_count)} TikTok posts</span>}
            {dj.google_trends_score > 0 && <span className="qs-pill">Trends {dj.google_trends_score}/100</span>}
          </div>
        </div>

        <div className="dj-side-stats">
          <div className="dss">
            <span className="dss-num">{fmt(dj.spotify_monthly_listeners)}</span>
            <span className="dss-lbl">listeners</span>
          </div>
          <div className="dss">
            <span className="dss-num">{fmt(dj.tiktok_post_count)}</span>
            <span className="dss-lbl">TikTok</span>
          </div>
        </div>

        <div className="dj-side">
          <div className="dj-actions" onClick={e => e.stopPropagation()}>
            {dj.spotify_url && (
              <a href={dj.spotify_url} target="_blank" rel="noreferrer" className="link-btn link-btn--spotify"><SpotifyIcon /></a>
            )}
            {dj.youtube_url && (
              <a href={dj.youtube_url} target="_blank" rel="noreferrer" className="link-btn link-btn--youtube"><YouTubeIcon /></a>
            )}
            <button
              className={`compare-btn ${inCompare ? "compare-btn--active" : ""}`}
              onClick={() => onToggleCompare(dj.name)}
              title={inCompare ? "Remove from compare" : "Add to compare"}
            >
              {inCompare ? "✓" : "+"}
            </button>
          </div>
          <div className="expand-btn">{expanded ? "▲" : "▼"}</div>
        </div>
      </div>

      {expanded && (
        <div className="dj-detail">
          <a className="profile-link" href={`#/artist/${slugify(dj.name)}`} onClick={e => e.stopPropagation()}>
            View full profile &amp; shareable card →
          </a>
          <div className="detail-tabs">
            <ScoreBreakdown dj={dj} ranges={ranges} />
            <div className="detail-right">
              <TrendChart name={dj.name} />
              <UpcomingEvents name={dj.name} />
            </div>
          </div>
          <div className="detail-footer" onClick={e => e.stopPropagation()}>
            <ScoreEditor dj={dj} onSaved={onScoreSaved} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Compare bar (floating) ─────────────────────────────────────────

function CompareBar({ selected, onClear, onCompare }) {
  return (
    <div className="compare-bar">
      <div className="compare-bar-djs">
        {selected.map(dj => (
          <span key={dj.name} className="compare-bar-chip">{dj.name}</span>
        ))}
        {selected.length === 1 && <span className="compare-bar-hint">Select one more to compare</span>}
      </div>
      <div className="compare-bar-actions">
        {selected.length === 2 && (
          <button className="compare-bar-btn compare-bar-btn--go" onClick={onCompare}>Compare</button>
        )}
        <button className="compare-bar-btn compare-bar-btn--clear" onClick={onClear}>Clear</button>
      </div>
    </div>
  );
}

// ── How It Works page ─────────────────────────────────────────────

const DATA_SOURCES = [
  { icon: "🎵", name: "Spotify",       color: "#1DB954", points: ["Monthly listeners (scraped)", "Follower count & growth rate", "Average track popularity score", "Playlist placements count"] },
  { icon: "▶",  name: "YouTube",       color: "#FF0000", points: ["Subscriber count", "Weekly view count"] },
  { icon: "🎵", name: "TikTok",        color: "#010101", points: ["Hashtag post count — measures how much content is being created around an artist"] },
  { icon: "📈", name: "Google Trends", color: "#4285F4", points: ["Search interest score (0–100) over the past 90 days"] },
  { icon: "🎛",  name: "Scene Score",  color: "#8b5cf6", points: ["Manual override 0–100 — accounts for festival bookings, residencies, and cultural weight that algorithms miss"] },
];

const METRIC_DETAILS = [
  { key: "manual_scene_score",           label: "Scene Score",         weight: 0.18, color: "#8b5cf6", why: "Editorial credibility for what algorithms miss — Boiler Room, Berghain/fabric bookings, festival closing slots, press covers. Scored against a published, transparent rubric (below). Leads the composite: bookers told us scene credibility strictly outweighs mainstream reach." },
  { key: "beatport_score",               label: "Beatport Chart",      weight: 0.13, color: "#a8e00f", why: "Position across genre Top 100 charts. The DJ retail store, so charting signals credibility with the core scene rather than the mainstream." },
  { key: "ra_score",                     label: "RA Booking",          weight: 0.12, color: "#FF5C00", why: "Resident Advisor live-booking signal: venue-capacity tier, attendance, and geographic spread of recent and upcoming shows. Direct demand from the touring market." },
  { key: "spotify_monthly_listeners",    label: "Monthly Listeners",   weight: 0.11, color: "#1DB954", why: "A proxy for active fanbase size, read from the live Spotify session. Useful, but reach alone is the weakest booking predictor — so it sits below the scene signals." },
  { key: "google_trends_score",          label: "Google Trends",       weight: 0.09, color: "#4285F4", why: "Search interest normalized to the artist's own peak. Rising search frequently precedes booking-fee increases." },
  { key: "spotify_follower_growth_rate", label: "Listener Growth",     weight: 0.08, color: "#C8F750", why: "Rate of change in audience — acceleration often predicts demand before size does. Weighted modestly while its coverage builds." },
  { key: "youtube_subscribers",          label: "YouTube Subscribers", weight: 0.06, color: "#FF0000", why: "A proxy for dedicated fanbase depth. YouTube audiences tend to convert to ticket buyers at a higher rate." },
  { key: "tiktok_post_count",            label: "TikTok Posts",        weight: 0.06, color: "#E9E7DF", why: "Posts using the artist's hashtag. Measures grassroots cultural spread, often an early breakout indicator." },
  { key: "tl_support_score",             label: "DJ Support (1001TL)", weight: 0.05, color: "#00b8d4", why: "Where the artist's tracks land on 1001Tracklists' weekly chart of what DJs actually PLAY in their sets. The hardest signal to game — tastemakers spinning your music, not sales or streams." },
  { key: "label_score",                  label: "Label Trajectory",    weight: 0.05, color: "#8b5cf6", why: "Tier and trajectory of the labels an artist releases on (Drumcode/Kompakt/Defected…) — credibility, and whether they're moving onto bigger homes." },
  { key: "spotify_playlist_placements",  label: "Releases / Catalog",  weight: 0.05, color: "#1DB954", why: "Depth and recency of catalog. Active release schedules score higher than a single back-catalog hit." },
  { key: "wikipedia_pageviews",          label: "Wikipedia Views",     weight: 0.02, color: "#9aa0a6", why: "Trailing 30-day article pageviews. A clean, independent measure of broad public interest." },
];

// Published, transparent Scene Score rubric — explicit so it's a credible
// editorial layer, not a black box (and harder to game than pure data signals).
const SCENE_RUBRIC = [
  { pts: "+20", item: "Boiler Room / HÖR / Cercle set", note: "tastemaker-platform booking" },
  { pts: "+20", item: "Berghain / fabric / DC10 booking or residency", note: "institutional venue credibility" },
  { pts: "+15", item: "Festival closing or main-stage headline slot", note: "Awakenings, DGTL, Time Warp, Movement…" },
  { pts: "+15", item: "Respected label home or own imprint", note: "Drumcode, Hessle, Dystopian, etc." },
  { pts: "+10", item: "RA / Mixmag / DJ Mag cover or feature", note: "critical / editorial standing" },
  { pts: "+10", item: "Ibiza residency", note: "season-long booking at a major club" },
  { pts: "+10", item: "Essential Mix / fabric or RA podcast", note: "landmark mix-series invitation" },
];

function HowItWorksPage() {
  const totalWeight = METRIC_DETAILS.reduce((s, m) => s + m.weight, 0);
  return (
    <div className="hiw-page">
      <div className="hiw-hero">
        <div className="hiw-eyebrow">Methodology</div>
        <h2 className="hiw-title">How we rank the world's hottest DJs</h2>
        <p className="hiw-sub">
          Every ranking is computed from 11 independent signals pulled from Spotify, Beatport, YouTube, TikTok, Google Trends, Resident Advisor and Wikipedia.
          No editorial bias, no pay-to-play. Refreshed every 6 hours.
        </p>
      </div>

      <section className="hiw-section">
        <h3 className="hiw-section-title">The 11 Signals</h3>
        <p className="hiw-section-sub">Each artist receives a score from 0–100 on each metric, normalised across the full ranked pool. Weighted scores are summed to produce the final ranking.</p>
        <div className="hiw-metrics">
          {METRIC_DETAILS.map(m => (
            <div key={m.key} className="hiw-metric-row">
              <div className="hiw-metric-info">
                <div className="hiw-metric-name">{m.label}</div>
                <div className="hiw-metric-why">{m.why}</div>
              </div>
              <div className="hiw-metric-right">
                <div className="hiw-weight-bar-track">
                  <div className="hiw-weight-bar-fill" style={{ width: `${(m.weight / 0.20) * 100}%`, background: m.color }} />
                </div>
                <div className="hiw-weight-label" style={{ color: m.color }}>{Math.round(m.weight * 100)}%</div>
              </div>
            </div>
          ))}
        </div>
        <div className="hiw-weight-note">Weights sum to 100%. Min-max normalisation ensures no single outlier distorts the rankings.</div>
      </section>

      <section className="hiw-section">
        <h3 className="hiw-section-title">Scene Score — the published rubric</h3>
        <p className="hiw-section-sub">
          Scene Score (11% of the rank) is the one editorial layer in the model — the industry credibility that pure data misses.
          To keep it honest, the criteria are public. Points accrue toward a 0–100 score; it's deliberately harder to game than a follower count.
        </p>
        <div className="hiw-rubric">
          {SCENE_RUBRIC.map(r => (
            <div key={r.item} className="hiw-rubric-row">
              <span className="hiw-rubric-pts">{r.pts}</span>
              <span className="hiw-rubric-item">{r.item}</span>
              <span className="hiw-rubric-note">{r.note}</span>
            </div>
          ))}
        </div>
        <div className="hiw-weight-note">Capped at 100. Reviewed editorially; corrections welcome. This makes the scene layer a transparent, defensible signal rather than a black box.</div>
      </section>

      <section className="hiw-section">
        <h3 className="hiw-section-title">Data Sources</h3>
        <div className="hiw-sources">
          {DATA_SOURCES.map(s => (
            <div key={s.name} className="hiw-source-card">
              <div className="hiw-source-header">
                <span className="hiw-source-icon" style={{ color: s.color }}>{s.icon}</span>
                <span className="hiw-source-name" style={{ color: s.color }}>{s.name}</span>
              </div>
              <ul className="hiw-source-points">
                {s.points.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="hiw-section">
        <h3 className="hiw-section-title">Momentum Score</h3>
        <p className="hiw-section-sub">Our core differentiator. The Momentum Score (0–100) ranks who is <em>accelerating</em> relative to their own baseline — not who is biggest. An artist climbing 50k→150k monthly listeners outscores one sitting flat at 2M. It blends only rate-of-change signals, and an artist is scored on whichever of these it has data for (no fabricated acceleration from a static snapshot).</p>
        <div className="hiw-momentum-formula">
          {[
            { signal: "Google Trends slope (search acceleration)", weight: "42%", color: "#4285F4" },
            { signal: "Listener growth rate",                      weight: "25%", color: "#1DB954" },
            { signal: "Wikipedia views trend (30d vs prior 30d)",  weight: "15%", color: "#9aa0a6" },
            { signal: "Beatport position change (week/week)",      weight: "12%", color: "#a8e00f" },
            { signal: "Touring velocity (cities & shows growth)",  weight: "6%",  color: "#FF5C00" },
          ].map((f, i, arr) => (
            <div key={f.signal} className="hiw-formula-row">
              <div className="hiw-formula-bar" style={{ background: f.color, width: f.weight }} />
              <span className="hiw-formula-label">{f.signal}</span>
              <span className="hiw-formula-weight" style={{ color: f.color }}>{f.weight}</span>
              {i < arr.length - 1 && <span className="hiw-formula-plus">+</span>}
            </div>
          ))}
        </div>
      </section>

      <section className="hiw-section">
        <h3 className="hiw-section-title">Update Schedule</h3>
        <div className="hiw-schedule">
          {[
            { label: "Spotify Monthly Listeners",       freq: "Daily (scraped)" },
            { label: "Beatport Chart Position",         freq: "Daily" },
            { label: "YouTube Subscribers & Views",     freq: "Daily" },
            { label: "Google Trends (12-month history)",freq: "Daily" },
            { label: "TikTok Post Count",               freq: "Daily (scraped)" },
            { label: "Wikipedia Pageviews",             freq: "Daily" },
            { label: "Tour Density (Songkick)",         freq: "Daily" },
            { label: "Rank Snapshots Retained",         freq: "90 data points" },
          ].map(s => (
            <div key={s.label} className="hiw-schedule-row">
              <span className="hiw-schedule-label">{s.label}</span>
              <span className="hiw-schedule-freq">{s.freq}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="hiw-section">
        <h3 className="hiw-section-title">FAQ</h3>
        <div className="hiw-faq">
          {[
            { q: "Why isn't SoundCloud included?", a: "SoundCloud's public API no longer exposes follower or play counts at scale. We include it in data collection but weight it at 0% until reliable data is available." },
            { q: "Why do some artists show zero for certain metrics?", a: "Not every DJ has a YouTube channel or is active on TikTok. Zero values are genuine — they're not data errors. They pull the weighted score for that signal to zero but don't affect others." },
            { q: "How is the Scene Score assigned?", a: "It's an editorial 0–100 score against the published rubric above — Boiler Room/HÖR sets, Berghain/fabric/DC10 bookings, festival closing slots, respected label homes, RA/Mixmag/DJ Mag covers, Ibiza residencies, Essential Mix invitations. It carries 11% weight, and the explicit criteria make it harder to game than pure data signals." },
            { q: "How does the Ones to Watch list differ from the main rankings?", a: "The main rankings weight current standing heavily. Ones to Watch reranks entirely by Momentum Score — so an artist can be #45 in the main chart but #2 in Ones to Watch if they're growing fast." },
            { q: "Can I get notified when an artist moves?", a: "Weekly movement alerts are on the roadmap. For now, the Ones to Watch and Velocity tabs surface who's accelerating across every signal we track." },
          ].map(({ q, a }) => (
            <details key={q} className="hiw-faq-item">
              <summary className="hiw-faq-q">{q}</summary>
              <p className="hiw-faq-a">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

// ── Movers page ───────────────────────────────────────────────────

function MoverRow({ entry, direction }) {
  const isRising = direction === "rising";
  const change = Math.abs(entry.change);
  return (
    <div className="mover-entry">
      <div className={`mover-change-badge ${isRising ? "mover-change--up" : "mover-change--down"}`}>
        {isRising ? "▲" : "▼"}{change}
      </div>
      <div className="mover-avatar">
        {entry.image
          ? <img src={entry.image} alt={entry.name} />
          : <div className="mover-placeholder">{entry.name[0]}</div>
        }
      </div>
      <div className="mover-info">
        <div className="mover-name"><ArtistLink name={entry.name} /></div>
        <div className="mover-ranks">
          <span className="mover-past-rank">#{entry.pastRank}</span>
          <span className="mover-arrow">{isRising ? "→" : "→"}</span>
          <span className={`mover-current-rank ${isRising ? "mover-rank--up" : "mover-rank--down"}`}>#{entry.currentRank}</span>
          <span className="mover-days-ago">{entry.daysAgo}d ago</span>
        </div>
      </div>
    </div>
  );
}

function MoversPage() {
  const [period,  setPeriod]  = useState("week");
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    fetch(`${API}/api/movers`)
      .then(r => { if (!r.ok) throw new Error("Server error"); return r.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  const PERIODS = [
    { key: "week",  label: "This Week"  },
    { key: "month", label: "This Month" },
    { key: "year",  label: "This Year"  },
  ];

  const current = data?.[period];

  return (
    <div className="movers-page">
      <div className="movers-page-header">
        <h2 className="movers-page-title">Biggest Movers</h2>
        <p className="movers-page-sub">Largest rank changes compared to the same period prior</p>
      </div>

      <div className="movers-period-tabs">
        {PERIODS.map(p => (
          <button
            key={p.key}
            className={`movers-period-btn ${period === p.key ? "movers-period-btn--active" : ""}`}
            onClick={() => setPeriod(p.key)}
          >{p.label}</button>
        ))}
      </div>

      {loading && <div className="state-msg"><div className="spinner" />Loading movers…</div>}
      {error   && <div className="state-msg state-msg--error">Error: {error}</div>}

      {!loading && !error && (
        current?.hasData ? (
          <div className="movers-grid">
            <div className="movers-col">
              <div className="movers-col-header movers-col-header--rising">
                <span className="movers-col-icon">▲</span> Biggest Risers
              </div>
              {current.rising.length > 0
                ? current.rising.map(e => <MoverRow key={e.name} entry={e} direction="rising" />)
                : <div className="movers-empty">No risers this period</div>
              }
            </div>
            <div className="movers-col">
              <div className="movers-col-header movers-col-header--falling">
                <span className="movers-col-icon">▼</span> Biggest Fallers
              </div>
              {current.falling.length > 0
                ? current.falling.map(e => <MoverRow key={e.name} entry={e} direction="falling" />)
                : <div className="movers-empty">No fallers this period</div>
              }
            </div>
          </div>
        ) : (
          <div className="movers-no-data">
            <div className="movers-no-data-icon">📊</div>
            <div className="movers-no-data-title">Not enough historical data yet</div>
            <p className="movers-no-data-sub">
              {period === "week"  && "Rankings need at least 7 days of snapshots to show weekly movers. Check back soon."}
              {period === "month" && "Monthly movers require 30+ days of rank history. Keep checking — this will populate automatically."}
              {period === "year"  && "Yearly movers require 365+ days of rank history."}
            </p>
          </div>
        )
      )}
    </div>
  );
}

// ── Ones to Watch page ────────────────────────────────────────────

const BREAKING_SLOTS = ["Mau P", "ANOTR", "Disco Lines"];

function OnestoWatchPage({ rankings }) {
  const withMomentum = useMemo(() => {
    const keys = ["spotify_follower_growth_rate", "tiktok_post_count", "google_trends_score"];
    const ranges = {};
    for (const k of keys) {
      const vals = rankings.map(r => r[k] || 0);
      ranges[k] = { min: Math.min(...vals), max: Math.max(...vals) };
    }
    function norm(v, k) {
      const { min, max } = ranges[k];
      return max === min ? 0 : ((v - min) / (max - min)) * 100;
    }
    return [...rankings].map(dj => {
      const growth = norm(dj.spotify_follower_growth_rate || 0, "spotify_follower_growth_rate");
      const tiktok = norm(dj.tiktok_post_count || 0, "tiktok_post_count");
      const trends = norm(dj.google_trends_score || 0, "google_trends_score");
      const rankMo = dj.rank_change ? Math.min(Math.max(dj.rank_change * 8, 0), 100) : 40;
      // Prefer the real backend Momentum Score (rate-of-change blend); fall back
      // to this client estimate only where momentum hasn't been computed yet.
      const fallback = Math.round(growth * 0.35 + tiktok * 0.25 + trends * 0.25 + rankMo * 0.15);
      return { ...dj, momentum: Number.isFinite(dj.momentum_score) ? dj.momentum_score : fallback };
    })
    .filter(dj => dj.emerging === true)   // reputation-based: emerging breakouts only, excludes veterans/legends
    .sort((a, b) => b.momentum - a.momentum);
  }, [rankings]);

  const breaking = withMomentum.filter(d => BREAKING_SLOTS.includes(d.name));

  return (
    <div className="otw-page">
      {breaking.length > 0 && (
        <section className="breaking-section">
          <div className="breaking-eyebrow">
            <span className="breaking-live">● BREAKING</span>
            <span className="breaking-sponsored">Sponsored — <a href="mailto:hello@thedjranks.com">get featured</a></span>
          </div>
          <div className="breaking-grid">
            {breaking.map(dj => (
              <div key={dj.name} className="breaking-card">
                <div className="breaking-img">
                  {dj.image ? <img src={dj.image} alt={dj.name} /> : <div className="breaking-placeholder">{dj.name[0]}</div>}
                </div>
                <div className="breaking-body">
                  <div className="breaking-name"><ArtistLink name={dj.name} /></div>
                  <div className="breaking-stats">
                    <span className="breaking-rank">Chart #{dj.rank}</span>
                    {dj.spotify_follower_growth_rate > 0 && (
                      <span className="breaking-growth">+{dj.spotify_follower_growth_rate.toFixed(1)}% growth</span>
                    )}
                  </div>
                  <div className="breaking-mo">
                    <div className="breaking-mo-bar-track">
                      <div className="breaking-mo-bar-fill" style={{ width: `${dj.momentum}%` }} />
                    </div>
                    <span className="breaking-mo-val">{dj.momentum} momentum</span>
                  </div>
                  {dj.spotify_url && (
                    <a href={dj.spotify_url} target="_blank" rel="noreferrer" className="breaking-spotify">Listen on Spotify ↗</a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="otw-list-section">
        <div className="otw-section-header">
          <h2 className="otw-section-title">Ones to Watch</h2>
          <p className="otw-section-sub">All artists ranked by momentum — early trajectory, high growth</p>
        </div>
        {withMomentum.map((dj, i) => {
          const moColor = dj.momentum >= 70 ? "#4ade80" : dj.momentum >= 40 ? "var(--accent)" : "var(--muted)";
          return (
            <div key={dj.name} className="otw-row">
              <div className="otw-pos">#{i + 1}</div>
              <div className="otw-avatar">
                {dj.image ? <img src={dj.image} alt={dj.name} /> : <div className="otw-placeholder">{dj.name[0]}</div>}
              </div>
              <div className="otw-info">
                <div className="otw-name"><ArtistLink name={dj.name} /></div>
                <div className="otw-subs">
                  {dj.spotify_monthly_listeners > 0 && <span>{fmt(dj.spotify_monthly_listeners)} listeners</span>}
                  {dj.spotify_follower_growth_rate > 0 && <span className="otw-growth">+{dj.spotify_follower_growth_rate.toFixed(1)}% growth</span>}
                </div>
              </div>
              <div className="otw-chart-rank">
                Chart #{dj.rank}
                {dj.rank_change > 0 && <span className="up"> ▲{dj.rank_change}</span>}
                {dj.rank_change < 0 && <span className="down"> ▼{Math.abs(dj.rank_change)}</span>}
              </div>
              <div className="otw-momentum">
                <div className="otw-mo-score" style={{ color: moColor }}>{dj.momentum}</div>
                <div className="otw-mo-label">momentum</div>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

// ── City Spotlight Tab ────────────────────────────────────────────

// Curated city data combining real Google Trends + scene knowledge
// Real data: John Summit (US/CA), Chris Lake (US/CA), Franky Rizardo (NL/EU), Prospa (UK/Africa)
// Estimated: based on label, home city, known fan geography

// ---- Booking Intelligence -------------------------------------------------
const BOOKING_MARKETS = [
  { city: "Amsterdam", country: "Netherlands" },
  { city: "Berlin", country: "Germany" },
  { city: "London", country: "United Kingdom" },
  { city: "Ibiza", country: "Spain" },
  { city: "Paris", country: "France" },
  { city: "Miami", country: "United States" },
  { city: "New York", country: "United States" },
  { city: "Los Angeles", country: "United States" },
  { city: "Las Vegas", country: "United States" },
  { city: "Melbourne", country: "Australia" },
  { city: "Sydney", country: "Australia" },
  { city: "Toronto", country: "Canada" },
  { city: "Mexico City", country: "Mexico" },
];
const BUDGET_PRESETS = [25000, 50000, 100000, 250000, 500000];
const fmtGBP = n =>
  n >= 1000 ? "£" + Math.round(n / 1000) + "K" : "£" + n;

function momentumTag(a) {
  const m = a.trends_mom_12w;
  if (!Number.isFinite(m)) return { arrow: "→", cls: "flat", label: "steady" };
  if (m >= 25) return { arrow: "↑", cls: "up", label: `+${Math.round(m)}% 12wk` };
  if (m <= -25) return { arrow: "↓", cls: "down", label: `${Math.round(m)}% 12wk` };
  return { arrow: "→", cls: "flat", label: "steady" };
}

// Compare a quoted ask against our curated benchmark mid.
function priceVerdict(mid, quote) {
  const q = Number(quote);
  if (!q || q <= 0 || !mid) return null;
  const pct = Math.round(((q - mid) / mid) * 100);
  if (pct <= -8) return { pct, cls: "good", label: `${Math.abs(pct)}% below benchmark — good deal` };
  if (pct >= 8)  return { pct, cls: "over", label: `${pct}% over benchmark — likely overpaying` };
  return { pct, cls: "fair", label: "in line with benchmark" };
}

// Plain-English booking memo, composed from the lineup signals.
function buildRationale(lineup, market, budget) {
  const { head, support, total, remaining } = lineup;
  const util = Math.round((total / budget) * 100);
  const s = [];
  if (head._local != null && head._local >= 70)
    s.push(`${head.name} anchors the bill: search demand in ${market.country} is among the strongest in the field (${head._local}/100), so the headline slot is tightly matched to ${market.city}.`);
  else if (head._local != null)
    s.push(`${head.name} anchors the bill, with ${market.country} search interest at ${head._local}/100 — a solid if not peak fit for ${market.city}.`);
  else
    s.push(`${head.name} anchors the bill on overall demand (${head._overall}/100); we don't yet have ${market.country}-specific signal for them, so treat the local read as provisional.`);

  const m = head.trends_mom_12w;
  if (Number.isFinite(m) && m >= 25)
    s.push(`Momentum is climbing (+${Math.round(m)}% over 12 weeks), which typically precedes fee increases — locking them now likely beats next season's rate.`);
  else if (Number.isFinite(m) && m <= -25)
    s.push(`Momentum has cooled (${Math.round(m)}% over 12 weeks), which is leverage: there's likely room to negotiate below the benchmark.`);

  if (support.length) {
    const topSup = [...support].sort((a, b) => (b._local ?? b._overall) - (a._local ?? a._overall))[0];
    s.push(`${support.length} support act${support.length > 1 ? "s" : ""} (${support.map(a => a.name).join(", ")}) round out the night without stretching spend${topSup._local != null ? `; ${topSup.name} also indexes high locally (${topSup._local}/100)` : ""}.`);
  }
  s.push(`At ${fmtGBP(total)}, the lineup uses ${util}% of your ${fmtGBP(budget)} budget${remaining > 0 ? `, leaving ${fmtGBP(remaining)} for production, visuals, or a local opener` : ""}.`);
  s.push(`These are demand estimates from public signals — search, streaming, charts, touring — not a ticket guarantee. Calibrate against your own on-sale history before committing.`);
  return s;
}

function BookingToolPage({ rankings }) {
  const [budget, setBudget] = useState(100000);
  const [market, setMarket] = useState(BOOKING_MARKETS[0]);
  const [quotes, setQuotes] = useState({});   // artist name -> quoted ask (£)
  const [memoOpen, setMemoOpen] = useState(false);

  const maxScore = useMemo(
    () => Math.max(...rankings.map(r => r.score || 0)) || 1,
    [rankings]
  );

  // Demand Fit (0–100): how well an artist suits THIS market. Blends local
  // (country-level search interest) with overall demand. Transparent, no black box.
  const scored = useMemo(() => {
    return rankings
      .filter(r => r.booking_fee?.mid > 0)
      .map(r => {
        const overall = Math.round(((r.score || 0) / maxScore) * 100);
        const local = r.google_trends_countries?.[market.country];
        const hasLocal = Number.isFinite(local) && local > 0;
        const fit = hasLocal ? Math.round(0.6 * local + 0.4 * overall) : overall;
        return { ...r, _overall: overall, _local: hasLocal ? local : null, _fit: fit };
      })
      .sort((a, b) => b._fit - a._fit);
  }, [rankings, market, maxScore]);

  // Greedy lineup: best-fit headliner within ~70% of budget, then fill support.
  const lineup = useMemo(() => {
    const headMax = budget * 0.72;
    let head = scored.find(a => a.booking_fee.mid <= headMax);
    if (!head) head = scored.find(a => a.booking_fee.mid <= budget); // tiny budget: relax
    if (!head) return null;
    let remaining = budget - head.booking_fee.mid;
    const support = [];
    for (const a of scored) {
      if (a.name === head.name) continue;
      if (support.length >= 3) break;
      if (a.booking_fee.mid <= remaining) {
        support.push(a);
        remaining -= a.booking_fee.mid;
      }
    }
    const acts = [head, ...support];
    const total = acts.reduce((s, a) => s + a.booking_fee.mid, 0);
    // lineup demand index — headliner weighted 2x
    const wSum = head._fit * 2 + support.reduce((s, a) => s + a._fit, 0);
    const wDen = 2 + support.length;
    const demandIndex = Math.round(wSum / wDen);
    return { head, support, acts, total, remaining: budget - total, demandIndex };
  }, [scored, budget]);

  const Gauge = value => (
    <div className="bk-gauge">
      <div className="bk-gauge-track"><div className="bk-gauge-fill" style={{ width: value + "%" }} /></div>
      <span className="bk-gauge-val">{value}</span>
    </div>
  );

  // Rendered as a function call (not <ActCard/>) so the quote <input> keeps
  // focus across keystrokes — defining a component inline would remount it.
  const ActCard = (a, role) => {
    const mt = momentumTag(a);
    const verdict = priceVerdict(a.booking_fee.mid, quotes[a.name]);
    return (
      <div className={`bk-act bk-act--${role}`} key={a.name}>
        <div className="bk-act-top">
          <span className="bk-act-role">{role === "head" ? "Headliner" : "Support"}</span>
          <span className={`bk-mom bk-mom--${mt.cls}`}>{mt.arrow} {mt.label}</span>
        </div>
        <div className="bk-act-name"><ArtistLink name={a.name} /></div>
        <div className="bk-act-meta">#{a.rank} · benchmark {a.booking_fee.label}</div>
        <div className="bk-act-stats">
          <div><span className="bk-stat-l">Demand Fit</span>{Gauge(a._fit)}</div>
          <div className="bk-act-sub">
            {a._local != null
              ? <>Local interest in {market.country}: <b>{a._local}/100</b></>
              : <>No local data — using <b>global demand {a._overall}/100</b></>}
          </div>
          {(a.value_signal === "buy" || a.value_signal === "strong-buy") && (
            <div className="bk-value bk-value--buy">
              {a.value_signal === "strong-buy" ? "◆ Strong buy" : "▲ Underpriced"} — demand implies {a.demand_fee_label}
            </div>
          )}
          {a.value_signal === "premium" && (
            <div className="bk-value bk-value--prem">Priced ahead of current demand</div>
          )}
          {Number.isFinite(a.live_conversion_score) && (
            <div className={`bk-conv ${a.live_conversion_score >= 75 ? "bk-conv--hi" : ""}`}>
              Live conversion {a.live_conversion_score}/100 · {a.ra_avg_attending} attending / show
            </div>
          )}
        </div>
        <div className="bk-quote">
          <span className="bk-stat-l">Your quote (optional)</span>
          <div className="bk-quote-row">
            <span className="bk-quote-prefix">£</span>
            <input
              type="number" className="bk-quote-input" placeholder={String(a.booking_fee.mid)}
              value={quotes[a.name] ?? ""}
              onChange={e => setQuotes(q => ({ ...q, [a.name]: e.target.value }))}
            />
            {verdict && <span className={`bk-verdict bk-verdict--${verdict.cls}`}>{verdict.label}</span>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="page bk-page">
      <div className="bk-header">
        <h1 className="cs-title">Build a lineup that sells</h1>
        <p className="cs-sub">
          Enter a budget and a market. We propose a lineup, sized to your budget,
          ranked by projected demand in that city — so you book the right names
          before you overpay.
        </p>
      </div>

      <div className="bk-controls">
        <div className="bk-field">
          <label>Budget</label>
          <div className="bk-budget-row">
            {BUDGET_PRESETS.map(b => (
              <button key={b}
                className={`bk-chip ${budget === b ? "bk-chip--on" : ""}`}
                onClick={() => setBudget(b)}>{fmtGBP(b)}</button>
            ))}
          </div>
        </div>
        <div className="bk-field">
          <label>Market</label>
          <select className="bk-select" value={market.city}
            onChange={e => setMarket(BOOKING_MARKETS.find(m => m.city === e.target.value))}>
            {BOOKING_MARKETS.map(m => <option key={m.city} value={m.city}>{m.city}</option>)}
          </select>
        </div>
      </div>

      {!lineup ? (
        <div className="bk-empty">No artist fits within {fmtGBP(budget)}. Try a larger budget.</div>
      ) : (
        <>
          <div className="bk-summary">
            <div className="bk-sum-cell">
              <div className="bk-sum-n">{lineup.demandIndex}<span>/100</span></div>
              <div className="bk-sum-l">Lineup Demand Fit · {market.city}</div>
            </div>
            <div className="bk-sum-cell">
              <div className="bk-sum-n">{fmtGBP(lineup.total)}</div>
              <div className="bk-sum-l">Projected cost · {Math.round(lineup.total / budget * 100)}% of budget</div>
            </div>
            <div className="bk-sum-cell">
              <div className="bk-sum-n">{lineup.acts.length}</div>
              <div className="bk-sum-l">Acts · {fmtGBP(lineup.remaining)} unspent</div>
            </div>
          </div>

          <div className="bk-lineup">
            {ActCard(lineup.head, "head")}
            {lineup.support.map(a => ActCard(a, "support"))}
          </div>

          <div className="bk-memo-bar">
            <button className="bk-memo-btn" onClick={() => setMemoOpen(o => !o)}>
              {memoOpen ? "Hide booking rationale" : "✦ Generate booking rationale"}
            </button>
          </div>
          {memoOpen && (
            <div className="bk-memo">
              <div className="bk-memo-head">
                <span className="bk-act-role">Auto-generated rationale</span>
                <span className="bk-memo-tag">{market.city} · {fmtGBP(budget)} budget</span>
              </div>
              {buildRationale(lineup, market, budget).map((line, i) => (
                <p key={i} className="bk-memo-line">{line}</p>
              ))}
            </div>
          )}

          <div className="bk-method">
            <b>How this is computed.</b> Demand Fit blends country-level search
            interest for {market.country} (60%) with each artist's overall demand
            score (40%); fees are our curated booking benchmarks. This is a demand
            estimate, not a guaranteed ticket forecast.
            <span className="bk-roadmap"> Connect your ticketing data to calibrate
            this into a sell-through prediction →</span>
          </div>

          <a className="bk-marketread" href={`#/market/${citySlug(market.city)}`}>
            ✦ Generate a shareable Market Read for {market.city} — a one-page brief to send a promoter →
          </a>
        </>
      )}
    </div>
  );
}

// ---- Market Read — shareable one-page demand brief per city ----------------
const citySlug = c => c.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const cityMatch = (raCity, marketCity) => {
  const a = (raCity || "").toLowerCase().split("/")[0].trim();
  const b = marketCity.toLowerCase();
  return a && (a.includes(b) || b.includes(a));
};

// Booking Intelligence — Lineup Builder + Value Gap + the three market views,
// all under one tab with a single sub-nav.
function BookingIntelPage({ rankings }) {
  const [view, setView] = useState("booking");
  const TABS = [
    ["booking", "Lineup Builder"],
    ["value", "Value Gap"],
    ["read", "City Read"],
    ["saturation", "Saturation"],
    ["spotlight", "City Spotlight"],
    ["scout", "City Scout"],
  ];
  return (
    <div className="mk-page">
      <div className="mk-subnav">
        {TABS.map(([k, label]) => (
          <button key={k} className={`mk-subtab ${view === k ? "mk-subtab--on" : ""}`} onClick={() => setView(k)}>{label}</button>
        ))}
      </div>
      {view === "booking" && <BookingToolPage rankings={rankings} />}
      {view === "value" && <ValueGapPage rankings={rankings} />}
      {view === "read" && <MarketReadPage rankings={rankings} embedded />}
      {view === "saturation" && <MarketSaturationPage rankings={rankings} />}
      {view === "spotlight" && <CitySpotlightPage rankings={rankings} />}
      {view === "scout" && <CityScoutPage rankings={rankings} />}
    </div>
  );
}

// Scouting — talent discovery / trajectory views under one tab.
// "What DJs Are Playing" — the weekly 1001Tracklists DJ-support chart, with our
// roster artists linked and non-roster acts shown plain (scene context + leads).
function DJChartPage() {
  const [chart, setChart] = useState(undefined);
  useEffect(() => {
    fetch("/tracklists.json", { cache: "no-cache" }).then(r => (r.ok ? r.json() : null)).then(setChart).catch(() => setChart(null));
  }, []);

  if (chart === undefined) return <div className="page"><div className="cs-empty">Loading the DJ chart…</div></div>;
  if (!chart || !chart.entries?.length) return <div className="page"><div className="cs-empty">DJ-support chart isn't available yet. Run the 1001Tracklists enrichment to populate it.</div></div>;

  const top = chart.top_supported || [];
  return (
    <div className="page dj-page">
      <div className="cs-header">
        <div>
          <h1 className="cs-title">What DJs Are Playing</h1>
          <p className="cs-sub">
            Who the scene's tastemakers are actually spinning, from the 1001Tracklists weekly chart —
            the hardest signal to game (DJ support, not sales or streams). Ranked over the last
            <strong> {chart.weeks_archived} weeks</strong>: <strong>{chart.roster_supported}</strong> of our roster have charted.
          </p>
        </div>
      </div>

      {top.length > 0 && (
        <>
          <div className="dj-section-h">Most DJ-supported · last {chart.weeks_archived} weeks</div>
          <div className="dj-board">
            {top.map((a, i) => (
              <a key={a.slug} className="dj-board-row" href={`#/artist/${a.slug}`}>
                <span className="dj-board-pos">{i + 1}</span>
                <span className="dj-board-name">{a.name}</span>
                <span className="dj-board-bar"><span className="dj-board-fill" style={{ width: `${a.score}%` }} /></span>
                <span className="dj-board-meta">{a.weeks}wk · best #{a.best ?? "—"}</span>
                {a.now ? <span className="dj-badge">on chart now</span> : a.recent ? <span className="dj-badge dj-badge--soft">recent</span> : <span className="dj-board-spacer" />}
              </a>
            ))}
          </div>
        </>
      )}

      <div className="dj-section-h">This week's chart · {chart.roster_hits} of {chart.count} are roster</div>
      <div className="dj-meta">Week {chart.week} · updated {chart.date}</div>
      <div className="dj-list">
        {chart.entries.map((e, i) => (
          <div key={i} className={`dj-row ${e.roster.length ? "dj-row--hit" : ""}`}>
            <span className="dj-rank">{e.rank ? `#${e.rank}` : "—"}</span>
            <div className="dj-track">
              <div className="dj-title">{e.title}</div>
              <div className="dj-artist">
                {e.roster.length
                  ? e.artist.split(/(\s+(?:vs\.?|&|x|ft\.?|feat\.?|featuring|with|\+|,|\/)\s+)/i).map((part, j) => {
                      const hit = e.roster.find(r => r.name.toLowerCase() === part.trim().toLowerCase());
                      return hit ? <a key={j} className="dj-link" href={`#/artist/${hit.slug}`}>{part}</a> : <span key={j}>{part}</span>;
                    })
                  : <span className="dj-artist--plain">{e.artist}</span>}
              </div>
            </div>
            {e.roster.length > 0 && <span className="dj-badge">tracked</span>}
          </div>
        ))}
      </div>
      <div className="cs-est-note" style={{ maxWidth: 640 }}>ⓘ Source: 1001Tracklists weekly chart. Roster acts are linked; un-linked acts are charting names we don't track yet — useful expansion leads.</div>
    </div>
  );
}

function ScoutingPage({ rankings }) {
  const [view, setView] = useState("watch");
  const TABS = [
    ["watch", "Ones to Watch"],
    ["velocity", "Velocity"],
    ["djchart", "DJ Chart"],
    ["benchmark", "Benchmark"],
  ];
  return (
    <div className="mk-page">
      <div className="mk-subnav">
        {TABS.map(([k, label]) => (
          <button key={k} className={`mk-subtab ${view === k ? "mk-subtab--on" : ""}`} onClick={() => setView(k)}>{label}</button>
        ))}
      </div>
      {view === "watch" && <OnestoWatchPage rankings={rankings} />}
      {view === "velocity" && <VelocityPage rankings={rankings} />}
      {view === "djchart" && <DJChartPage />}
      {view === "benchmark" && <ComparativeBenchmarkingPage rankings={rankings} />}
    </div>
  );
}

function MarketReadPage({ rankings, slug, embedded }) {
  const initial = BOOKING_MARKETS.find(m => citySlug(m.city) === slug) || BOOKING_MARKETS[0];
  const [market, setMarket] = useState(initial);
  const [copied, setCopied] = useState(false);
  // Keep the URL in sync only on the standalone shareable route, not when
  // rendered inside the combined Markets tab (would hijack navigation).
  useEffect(() => { if (!embedded) window.location.hash = `#/market/${citySlug(market.city)}`; }, [market, embedded]);

  const D = useMemo(() => {
    const list = rankings.filter(a => a.booking_fee);
    const buys = list.filter(a => a.value_signal === "buy" || a.value_signal === "strong-buy")
      .sort((x, y) => (y.value_signal === "strong-buy") - (x.value_signal === "strong-buy") || y.value_gap - x.value_gap || (y.momentum_score || 0) - (x.momentum_score || 0)).slice(0, 6);
    const breaking = list.filter(a => Number.isFinite(a.momentum_score) && a.momentum_score >= 45)
      .sort((x, y) => y.momentum_score - x.momentum_score).slice(0, 6);
    const converters = list.filter(a => Number.isFinite(a.live_conversion_score) && a.live_conversion_score >= 70)
      .sort((x, y) => y.live_conversion_score - x.live_conversion_score).slice(0, 6);
    const localDemand = list.filter(a => a.google_trends_countries?.[market.country] > 0)
      .map(a => ({ a, v: a.google_trends_countries[market.country] }))
      .sort((x, y) => y.v - x.v).slice(0, 6);
    const saturated = [];
    for (const a of rankings) for (const c of (a.ra_recent_cities || []))
      if (cityMatch(c.city, market.city) && c.shows_3m >= 2) saturated.push({ a, c });
    saturated.sort((x, y) => y.c.saturation - x.c.saturation);
    return { buys, breaking, converters, localDemand, saturated };
  }, [rankings, market]);

  const copyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}#/market/${citySlug(market.city)}`;
    navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); });
  };

  const Line = ({ a, right }) => (
    <div className="mr-line">
      <div className="mr-line-l"><ArtistLink name={a.name} /><span className="mr-rk">#{a.rank}</span></div>
      <div className="mr-line-r">{right}</div>
    </div>
  );

  return (
    <div className="page mr-page">
      {!embedded && <button className="ap-back mr-back" onClick={() => { window.location.hash = ""; }}>← Back to rankings</button>}
      <div className="mr-actions">
        <select className="bk-select" value={market.city} onChange={e => setMarket(BOOKING_MARKETS.find(m => m.city === e.target.value))}>
          {BOOKING_MARKETS.map(m => <option key={m.city} value={m.city}>{m.city}</option>)}
        </select>
        <button className="mr-btn" onClick={copyLink}>{copied ? "✓ Link copied" : "Copy share link"}</button>
        <button className="mr-btn" onClick={() => window.print()}>Save as PDF</button>
      </div>

      <div className="mr-sheet">
        <div className="mr-head">
          <div className="brand-lockup mr-brand">
            <svg viewBox="0 0 32 32" aria-hidden="true"><g fill="var(--accent)"><rect x="5.5" y="18.5" width="3.6" height="8" rx="1.3" /><rect x="11.2" y="13" width="3.6" height="13.5" rx="1.3" /><rect x="16.9" y="8" width="3.6" height="18.5" rx="1.3" /><rect x="22.6" y="4" width="3.6" height="22.5" rx="1.3" /></g></svg>
            <span className="brand-word">PEAKTIME</span>
          </div>
          <div className="mr-date">{new Date().toLocaleDateString(undefined, { month: "short", year: "numeric" })}</div>
        </div>
        <div className="mr-eyebrow">Market Read · Booking intelligence</div>
        <h1 className="mr-title">{market.city}</h1>
        <p className="mr-sub">Who to book, who's breaking, and who the {market.city} crowd has already seen — from PEAKTIME's live demand model.</p>

        <div className="mr-grid">
          <div className="mr-col">
            <div className="mr-sec-h mr-h-buy">◆ Book now · underpriced &amp; rising</div>
            {D.buys.map(a => <Line key={a.name} a={a} right={<><b>{a.booking_fee.label}</b> → {a.demand_fee_label}{a.value_signal === "strong-buy" ? " ★" : ""}</>} />)}

            <div className="mr-sec-h">▲ Breaking · momentum leaders</div>
            {D.breaking.map(a => <Line key={a.name} a={a} right={<>momentum <b>{a.momentum_score}</b></>} />)}
          </div>
          <div className="mr-col">
            <div className="mr-sec-h">◎ Best value live · converts above streaming</div>
            {D.converters.map(a => <Line key={a.name} a={a} right={<>conv <b>{a.live_conversion_score}</b> · {fmt(a.spotify_monthly_listeners)} list.</>} />)}

            {D.saturated.length > 0 && <>
              <div className="mr-sec-h mr-h-warn">✕ Already saturated in {market.city}</div>
              {D.saturated.slice(0, 5).map(({ a, c }) => <Line key={a.name} a={a} right={<><b>{c.shows_3m}</b> shows/3mo{c.days_since != null ? ` · ${c.days_since}d ago` : ""}</>} />)}
            </>}

            {D.localDemand.length > 0 && <>
              <div className="mr-sec-h">◈ Strong demand in {market.country}</div>
              {D.localDemand.map(({ a, v }) => <Line key={a.name} a={a} right={<>local interest <b>{v}/100</b></>} />)}
            </>}
          </div>
        </div>

        <div className="mr-foot">
          PEAKTIME · the demand index for electronic music · <b>thedjrankings.com</b><br/>
          <span className="mr-note">Booking fees are curated estimates; demand signals from Spotify, Beatport, Resident Advisor, Google Trends. A directional read, not a quote.</span>
        </div>
      </div>
    </div>
  );
}

// ---- Market Saturation — per-city freshness for regional buyers ------------
function MarketSaturationPage({ rankings }) {
  const [city, setCity] = useState("All cities");

  const rows = useMemo(() => {
    const flat = [];
    for (const a of rankings) {
      for (const c of (a.ra_recent_cities || [])) {
        // "Overbooked" = repeat bookings in one market (2+ shows in 3 months).
        if (c.shows_3m >= 2) {
          flat.push({ name: a.name, rank: a.rank, image: a.image, ...c });
        }
      }
    }
    return flat.sort((x, y) => y.saturation - x.saturation || (x.days_since ?? 999) - (y.days_since ?? 999));
  }, [rankings]);

  const cities = useMemo(
    () => ["All cities", ...[...new Set(rows.map(r => r.city))].sort()],
    [rows]
  );
  const filtered = city === "All cities" ? rows : rows.filter(r => r.city === city);
  const shown = filtered;

  const Row = ({ r }) => {
    const level = r.saturation >= 70 ? "over" : "heavy";
    return (
      <div className="ms-row">
        <div className="ms-artist"><ArtistLink name={r.name} /><span className="ms-rank">#{r.rank}</span></div>
        <div className="ms-city">{r.city}{r.country ? <span className="ms-country">, {r.country}</span> : null}</div>
        <div className="ms-detail">
          <b>{r.shows_3m}</b> show{r.shows_3m !== 1 ? "s" : ""} / 3mo{r.days_since != null && <> · last {r.days_since}d ago</>}
        </div>
        <div className={`ms-badge ms-badge--${level}`}>{level === "over" ? "Overbooked" : "Heavy"} {r.saturation}</div>
      </div>
    );
  };

  return (
    <div className="page ms-page">
      <div className="bk-header">
        <h1 className="cs-title">Who's overbooked, and where</h1>
        <p className="cs-sub">
          An artist who's played a city four times this quarter is a hard sell there — no matter their global numbers.
          We score market freshness per city from live booking frequency &amp; recency, so a regional buyer knows who's
          fresh in their market and who the crowd has already seen.
        </p>
      </div>

      <div className="ms-controls">
        <div className="bk-field">
          <label>City</label>
          <select className="bk-select" value={city} onChange={e => setCity(e.target.value)}>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="ms-count">{filtered.length} saturated artist·city pairs tracked</div>
      </div>

      <div className="ms-head">
        <span>Artist</span><span>Market</span><span>Recent activity</span><span>Saturation</span>
      </div>
      {shown.map((r, i) => <Row key={r.name + r.city + i} r={r} />)}

      <div className="bk-method">
        <b>How this is computed.</b> From Resident Advisor booking history: saturation (0–100) rises with shows in a
        city over the last 3 months and how recently the artist last played there. Higher = more overexposed in that
        market. RA covers club/festival bookings; absence isn't proof an artist hasn't played a market.
      </div>
    </div>
  );
}

// ---- Price/Demand Gap — the buy signal -------------------------------------

const CS_SHORT_COUNTRY = { "United States of America": "USA", "United Kingdom": "UK", "United Arab Emirates": "UAE", "Czech Republic": "Czechia" };

// Builds a per-artist "where their live demand concentrates" view from the real
// Resident Advisor booking footprint (ra_recent_cities). Returns top cities scored
// 0-100 by recent show count relative to the artist's busiest market.
export function citySpotlight(a) {
  const raw = Array.isArray(a.ra_recent_cities) ? a.ra_recent_cities : [];
  const cities = raw
    .map(c => ({ city: c.city, country: CS_SHORT_COUNTRY[c.country] || c.country, shows: c.shows ?? c.shows_3m ?? 1, days_since: c.days_since }))
    .filter(c => c.city)
    .sort((x, y) => y.shows - x.shows || (x.days_since ?? 999) - (y.days_since ?? 999))
    .slice(0, 8);
  const max = Math.max(...cities.map(c => c.shows), 1);
  cities.forEach(c => (c.score = Math.round((c.shows / max) * 100)));
  return cities;
}

function CitySpotlightPage({ rankings }) {
  const [selected, setSelected] = useState(null);
  const [q, setQ] = useState("");

  const artists = useMemo(() => rankings
    .map(a => ({ name: a.name, rank: a.rank, image: a.image, cities: citySpotlight(a) }))
    .filter(a => a.cities.length >= 2)
    .sort((a, b) => a.rank - b.rank), [rankings]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle ? artists.filter(a => a.name.toLowerCase().includes(needle)) : artists;
    return list.slice(0, needle ? 120 : 60);
  }, [artists, q]);

  return (
    <div className="page cs-page">
      <div className="cs-header">
        <div>
          <h1 className="cs-title">City Demand Spotlight</h1>
          <p className="cs-sub">
            Where each artist's live demand actually concentrates — from {artists.length} artists'
            Resident Advisor booking footprint over recent months. Book them where they already pull.
          </p>
        </div>
      </div>

      <input className="cs-search" placeholder="Search an artist…" value={q} onChange={e => setQ(e.target.value)} />

      <div className="cs-grid">
        {filtered.map(artist => {
          const isSelected = selected === artist.name;
          return (
            <div
              key={artist.name}
              className={`cs-card ${isSelected ? "cs-card--open" : ""}`}
              {...pressable(() => setSelected(isSelected ? null : artist.name), isSelected)}
              aria-label={`${artist.name} — ${isSelected ? "hide" : "show"} top cities`}
            >
              <div className="cs-card-header">
                <div className="cs-card-left">
                  {artist.image && <img src={artist.image} className="cs-avatar" alt="" />}
                  <div>
                    <div className="cs-card-name"><ArtistLink name={artist.name} /></div>
                    <div className="cs-card-meta">Rank #{artist.rank} · {artist.cities.length} active markets</div>
                  </div>
                </div>
                <div className="cs-card-right">
                  <span className="cs-data-badge cs-data-badge--live">Live</span>
                  <span className="cs-top-city">{artist.cities[0].city}</span>
                  <span className="cs-chevron">{isSelected ? "▲" : "▼"}</span>
                </div>
              </div>

              {isSelected && (
                <div className="cs-city-list">
                  {artist.cities.map((c, i) => (
                    <div key={c.city + i} className="cs-city-row">
                      <span className="cs-city-rank">#{i + 1}</span>
                      <span className="cs-city-name">{c.city}<span className="cs-city-country"> · {c.country}</span></span>
                      <div className="cs-city-bar-track">
                        <div className="cs-city-bar-fill" style={{
                          width: `${c.score}%`,
                          background: i === 0 ? "var(--accent)" : i < 3 ? "color-mix(in srgb, var(--accent) 70%, #fff)" : "#2a2a2a",
                        }} />
                      </div>
                      <span className="cs-city-score">{c.shows} show{c.shows !== 1 ? "s" : ""}</span>
                    </div>
                  ))}
                  <div className="cs-est-note">ⓘ Concentration = recent Resident Advisor bookings per city — more shows means stronger live demand there.</div>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && <div className="cs-empty">No artist matches "{q}".</div>}
      </div>
    </div>
  );
}

// ── City Scout — the inverted view: pick a city, see who draws there ──────────
function CityScoutPage({ rankings }) {
  const index = useMemo(() => {
    const m = {};
    const JUNK = new Set(["All", "all", "Online", "Various", "TBA"]);   // RA pseudo-buckets, not real cities
    for (const a of rankings) {
      for (const c of (a.ra_recent_cities || [])) {
        if (!c.city || JUNK.has(c.city)) continue;
        const recent = c.shows_3m ?? 0, days = c.days_since ?? 9999;
        // "Hot now" = recent booking volume, decayed by how long since they played.
        const hot = recent * 10 - days / 45;
        (m[c.city] ??= { city: c.city, country: c.country, artists: [] }).artists.push({
          name: a.name, rank: a.rank, image: a.image,
          recent, total: c.shows ?? recent, days_since: c.days_since, saturation: c.saturation, hot,
        });
      }
    }
    for (const k in m) m[k].artists.sort((x, y) => y.hot - x.hot || (x.days_since ?? 9999) - (y.days_since ?? 9999) || x.rank - y.rank);
    return m;
  }, [rankings]);

  const cities = useMemo(() => Object.values(index).sort((a, b) => b.artists.length - a.artists.length), [index]);
  const [city, setCity] = useState("");
  const current = (city && index[city]) || cities[0];

  if (!current) return <div className="page cy-page"><div className="cs-empty">No city booking data yet.</div></div>;

  const ago = d => d == null ? "" : d === 0 ? "today" : d < 31 ? `${d}d ago` : d < 365 ? `${Math.round(d / 30)}mo ago` : `${Math.round(d / 365)}y ago`;

  return (
    <div className="page cy-page">
      <div className="cs-header">
        <div>
          <h1 className="cs-title">City Scout</h1>
          <p className="cs-sub">Pick a market and see which artists actually draw there — ranked by recent Resident Advisor bookings. The promoter's view: who's hot in your city right now.</p>
        </div>
      </div>

      <select className="cs-search cy-select" value={current.city} onChange={e => setCity(e.target.value)}>
        {cities.map(c => <option key={c.city} value={c.city}>{c.city}{c.country ? `, ${c.country}` : ""} · {c.artists.length} artist{c.artists.length !== 1 ? "s" : ""}</option>)}
      </select>

      <div className="cy-head">
        <span className="cy-head-city">{current.city}</span>
        <span className="cy-head-meta">{current.country} · {current.artists.length} artists with recent bookings</span>
      </div>

      <div className="cy-list">
        {current.artists.map((a, i) => (
          <div className="cy-row" key={a.name + i}>
            <span className="cy-pos">{i + 1}</span>
            {a.image ? <img className="cy-avatar" src={a.image} alt="" /> : <span className="cy-avatar cy-avatar--ph">{a.name[0]}</span>}
            <span className="cy-name"><ArtistLink name={a.name} /><span className="cy-rank">#{a.rank}</span></span>
            <span className="cy-shows">{a.recent > 0 ? `${a.recent} in 3mo` : `${a.total} all-time`}</span>
            <span className="cy-last">{ago(a.days_since)}</span>
            {a.saturation >= 60 && <span className="cy-sat" title="Heavily booked here recently">overbooked</span>}
          </div>
        ))}
      </div>
      <div className="cs-est-note" style={{ maxWidth: 640 }}>ⓘ Ranked by recent Resident Advisor bookings in this city. "Overbooked" flags artists who've played here repeatedly and lately — diminishing returns for a new date.</div>
    </div>
  );
}

// ── Comparative Benchmarking Tab ──────────────────────────────────

const CMP_METRICS = [
  { key: "spotify_monthly_listeners", label: "Spotify Listeners", short: "Spotify",  signal: "mainstream streaming audience", color: "#1DB954" },
  { key: "beatport_score",            label: "Beatport Chart",    short: "Beatport", signal: "core scene / chart credibility",color: "#a8e00f" },
  { key: "tiktok_post_count",         label: "TikTok Posts",      short: "TikTok",   signal: "viral / social buzz",          color: "#ff0050" },
  { key: "mixcloud_followers",        label: "Mixcloud Followers",short: "Mixcloud", signal: "DJ / mix credibility",          color: "#5000ff" },
  { key: "google_trends_score",       label: "Google Trends",     short: "Trends",   signal: "search interest",              color: "#4285F4" },
];

// percentile of value within a sorted ascending array of positive values
function pctRank(value, sortedVals) {
  if (!sortedVals.length) return 0;
  let below = 0;
  for (const v of sortedVals) { if (v < value) below++; else break; }
  return Math.round((below / Math.max(sortedVals.length - 1, 1)) * 100);
}

function ComparativeBenchmarkingPage({ rankings }) {
  // Build percentile maps per metric (only artists with non-zero values count)
  const { profiles, sortedByMetric } = useMemo(() => {
    const sortedByMetric = {};
    for (const m of CMP_METRICS) {
      sortedByMetric[m.key] = rankings.map(r => r[m.key] || 0).filter(v => v > 0).sort((a, b) => a - b);
    }
    const profiles = {};
    for (const dj of rankings) {
      const prof = {};
      for (const m of CMP_METRICS) {
        const v = dj[m.key] || 0;
        prof[m.key] = v > 0 ? { value: v, pct: pctRank(v, sortedByMetric[m.key]) } : null;
      }
      profiles[dj.name] = prof;
    }
    return { profiles, sortedByMetric };
  }, [rankings]);

  // Auto-generated discrepancy insights (over-indexers)
  const insights = useMemo(() => {
    const archetypes = [
      { a: "tiktok_post_count",         b: "spotify_monthly_listeners", title: "Viral, Under-Streamed",   blurb: "Social buzz is running ahead of streaming — hype before the catalog catches up.", icon: "🚀" },
      { a: "beatport_score",            b: "spotify_monthly_listeners", title: "The DJ's DJ",             blurb: "High Beatport chart credibility with the core scene, ahead of mainstream streaming.", icon: "🎧" },
      { a: "spotify_monthly_listeners", b: "tiktok_post_count",         title: "Streaming Giant, Quiet Socially", blurb: "Big streaming numbers without the viral social footprint.",            icon: "📀" },
      { a: "google_trends_score",       b: "tiktok_post_count",         title: "Search Breakout",         blurb: "Spiking search interest outpacing social buzz — early momentum signal.",         icon: "🔍" },
    ];
    return archetypes.map(arc => {
      const picks = rankings
        .map(dj => {
          const pa = profiles[dj.name]?.[arc.a];
          const pb = profiles[dj.name]?.[arc.b];
          if (!pa || !pb) return null;
          return { dj, gap: pa.pct - pb.pct, pa, pb };
        })
        .filter(x => x && x.gap >= 25)
        .sort((a, b) => b.gap - a.gap)
        .slice(0, 3);
      const am = CMP_METRICS.find(m => m.key === arc.a);
      const bm = CMP_METRICS.find(m => m.key === arc.b);
      return { ...arc, am, bm, picks };
    }).filter(arc => arc.picks.length > 0);
  }, [profiles, rankings]);

  // Direct comparison selectors — default to two data-rich artists
  const withData = rankings.filter(d => CMP_METRICS.filter(m => (d[m.key] || 0) > 0).length >= 2);
  const names = rankings.map(d => d.name).sort((a, b) => a.localeCompare(b));
  const [aName, setAName] = useState(withData[0]?.name ?? rankings[0]?.name);
  const [bName, setBName] = useState(withData[1]?.name ?? rankings[1]?.name);

  const A = rankings.find(d => d.name === aName);
  const B = rankings.find(d => d.name === bName);

  // Headline callout for the A/B comparison
  const callout = useMemo(() => {
    if (!A || !B) return null;
    const shared = CMP_METRICS.filter(m => (A[m.key] || 0) > 0 && (B[m.key] || 0) > 0);
    if (!shared.length) return null;
    let biggest = null, similar = null;
    for (const m of shared) {
      const va = A[m.key], vb = B[m.key];
      const ratio = Math.max(va, vb) / Math.min(va, vb);
      const leader = va >= vb ? A : B, trailer = va >= vb ? B : A;
      if (!biggest || ratio > biggest.ratio) biggest = { m, ratio, leader, trailer };
      if (ratio < 1.3 && (!similar || ratio < similar.ratio)) similar = { m, ratio };
    }
    if (!biggest || biggest.ratio < 1.5) return null;
    return { biggest, similar };
  }, [A, B]);

  return (
    <div className="page cmp-page">
      <div className="cmp-header">
        <h1 className="cmp-title">Comparative Benchmarking</h1>
        <p className="cmp-sub">
          Cross-metric analysis that exposes hidden signal — who's viral but not streaming,
          who's a DJ's DJ, who's quietly breaking out. Compare any two artists head-to-head.
        </p>
      </div>

      {/* ── Direct comparison ── */}
      <div className="cmp-compare">
        <div className="cmp-selectors">
          <select className="cmp-select" value={aName} onChange={e => setAName(e.target.value)}>
            {names.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <span className="cmp-vs">vs</span>
          <select className="cmp-select" value={bName} onChange={e => setBName(e.target.value)}>
            {names.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        {callout && (
          <div className="cmp-callout">
            <strong><ArtistLink name={callout.biggest.leader.name} /></strong> has{" "}
            <span className="cmp-ratio">{callout.biggest.ratio.toFixed(1)}×</span>{" "}
            the {callout.biggest.m.short} presence of <strong><ArtistLink name={callout.biggest.trailer.name} /></strong>
            {callout.similar && callout.similar.m.key !== callout.biggest.m.key
              ? <>, despite similar {callout.similar.m.short} numbers.</>
              : <>.</>}
          </div>
        )}

        <div className="cmp-grid">
          {CMP_METRICS.map(m => {
            const va = A?.[m.key] || 0, vb = B?.[m.key] || 0;
            const max = Math.max(va, vb, 1);
            const fmtV = v => m.key === "google_trends_score" ? (v ? Math.round(v) : "—") : (v ? fmt(v) : "—");
            return (
              <div className="cmp-row" key={m.key}>
                <div className="cmp-metric-label">{m.label}<span className="cmp-metric-signal">{m.signal}</span></div>
                <div className="cmp-bars">
                  <div className="cmp-bar-side cmp-bar-side--a">
                    <span className="cmp-val">{fmtV(va)}</span>
                    <div className="cmp-bar-track"><div className="cmp-bar-fill" style={{ width: `${(va/max)*100}%`, background: m.color, marginLeft: "auto" }} /></div>
                  </div>
                  <div className="cmp-bar-side cmp-bar-side--b">
                    <div className="cmp-bar-track"><div className="cmp-bar-fill" style={{ width: `${(vb/max)*100}%`, background: m.color }} /></div>
                    <span className="cmp-val">{fmtV(vb)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="cmp-legend-row">
          <span><span className="cmp-dot" style={{background:"#888"}} /> {aName}</span>
          <span>{bName} <span className="cmp-dot" style={{background:"#888"}} /></span>
        </div>
      </div>

      {/* ── Auto insights ── */}
      <h2 className="cmp-insights-title">Biggest Discrepancies</h2>
      <p className="cmp-insights-sub">Artists who over-index on one signal but lag on another — the gaps a sharp booker exploits.</p>
      <div className="cmp-insights">
        {insights.map(arc => (
          <div className="cmp-insight-card" key={arc.title}>
            <div className="cmp-insight-head">
              <span className="cmp-insight-icon">{arc.icon}</span>
              <div>
                <div className="cmp-insight-title">{arc.title}</div>
                <div className="cmp-insight-blurb">{arc.blurb}</div>
              </div>
            </div>
            <div className="cmp-insight-list">
              {arc.picks.map(p => (
                <div className="cmp-insight-row" key={p.dj.name}>
                  <span className="cmp-insight-name"><ArtistLink name={p.dj.name} /></span>
                  <span className="cmp-insight-stat">
                    <span style={{ color: arc.am.color }}>{arc.am.short} {p.pa.pct}th</span>
                    {" · "}
                    <span style={{ color: arc.bm.color }}>{arc.bm.short} {p.pb.pct}th</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="cmp-foot">Percentiles are within artists that have data for each metric. Updated every refresh.</p>
    </div>
  );
}

// ── Velocity Tab ──────────────────────────────────────────────────

const VELOCITY_LABELS = {
  spotify_followers:          "Spotify Followers",
  spotify_monthly_listeners:  "Monthly Listeners",
  tiktok_post_count:          "TikTok Posts",
  youtube_subscribers:        "YT Subscribers",
  youtube_views_weekly:       "YT Views/wk",
  google_trends_score:        "Google Trends",
  mixcloud_followers:         "Mixcloud",
};

function VelocityBadge({ value }) {
  if (value == null)  return <span className="vel-badge vel-badge--na">N/A</span>;
  if (value > 0)  return <span className="vel-badge vel-badge--up">+{value.toFixed(1)}%</span>;
  if (value < 0)  return <span className="vel-badge vel-badge--down">{value.toFixed(1)}%</span>;
  return <span className="vel-badge vel-badge--flat">0%</span>;
}

// Tiny inline sparkline for the 12-month search-interest series
function VelSpark({ series }) {
  if (!Array.isArray(series) || series.length < 4) return <span className="vel-na">—</span>;
  const s = series.slice(-26); // last ~6 months for compactness
  const W = 96, H = 24, max = Math.max(...s, 1);
  const pts = s.map((v, i) => `${(i / (s.length - 1) * W).toFixed(1)},${(H - (v / max) * (H - 3) - 1.5).toFixed(1)}`).join(" ");
  const up = s[s.length - 1] >= s[0];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="vel-spark" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={up ? "#4ade80" : "#f87171"} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function VelocityPage({ rankings }) {
  const [sortKey, setSortKey] = useState("mom4");

  const artists = rankings
    .filter(d => d.trends_mom_4w != null && Array.isArray(d.trends_12m) && d.trends_12m.length > 4)
    .map(d => {
      const rh = (d.rank_history || []).filter(p => p.r != null);
      const rankDelta = rh.length >= 2 ? rh[0].r - rh[rh.length - 1].r : null;
      return { dj: d, mom4: d.trends_mom_4w ?? 0, mom12: d.trends_mom_12w ?? 0, rankDelta };
    })
    .sort((a, b) => (sortKey === "mom12" ? b.mom12 - a.mom12 : b.mom4 - a.mom4));

  if (!artists.length) return (
    <div className="page vel-empty">
      <h2>Velocity data is still building</h2>
      <p>Driven by the 12-month Google Trends backfill — check back as it accumulates.</p>
    </div>
  );

  return (
    <div className="page vel-page">
      <div className="vel-header">
        <h1 className="vel-title">Velocity</h1>
        <p className="vel-sub">
          Real momentum from 12 months of Google Trends search data — who's accelerating right now.
          Spotify, TikTok &amp; YouTube velocity join here as weekly history accumulates.
        </p>
      </div>
      <div className="vel-table-wrap">
        <table className="vel-table">
          <thead>
            <tr>
              <th className="vel-th vel-th--artist">Artist</th>
              <th className={`vel-th vel-th--composite ${sortKey === "mom4" ? "vel-th--active" : ""}`} onClick={() => setSortKey("mom4")}>Search · 4-wk ↕</th>
              <th className={`vel-th ${sortKey === "mom12" ? "vel-th--active" : ""}`} onClick={() => setSortKey("mom12")}>Search · 12-wk ↕</th>
              <th className="vel-th">Rank move</th>
              <th className="vel-th">12-mo trend</th>
            </tr>
          </thead>
          <tbody>
            {artists.map(({ dj, mom4, mom12, rankDelta }) => (
              <tr key={dj.name} className="vel-row">
                <td className="vel-td vel-td--artist">
                  <span className="vel-rank">#{dj.rank}</span>
                  {dj.image && <img src={dj.image} className="vel-img" alt="" />}
                  <span className="vel-name"><ArtistLink name={dj.name} /></span>
                </td>
                <td className="vel-td vel-td--composite"><VelocityBadge value={mom4} /></td>
                <td className="vel-td"><VelocityBadge value={mom12} /></td>
                <td className="vel-td">
                  {rankDelta == null ? <span className="vel-na">—</span>
                    : rankDelta > 0 ? <span className="vel-badge vel-badge--up">▲{rankDelta}</span>
                    : rankDelta < 0 ? <span className="vel-badge vel-badge--down">▼{Math.abs(rankDelta)}</span>
                    : <span className="vel-badge vel-badge--flat">—</span>}
                </td>
                <td className="vel-td"><VelSpark series={dj.trends_12m} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Breakouts Tab ─────────────────────────────────────────────────

function BreakoutsPage({ rankings, breakouts: staticBreakouts, breakoutThreshold }) {
  const [threshold, setThreshold] = useState(breakoutThreshold ?? 8);

  // Re-compute from rankings if threshold changes
  const alerts = rankings
    .filter(d => d.velocity?.score_change_pct != null && d.velocity.score_change_pct >= threshold)
    .sort((a, b) => b.velocity.score_change_pct - a.velocity.score_change_pct);

  const noData = rankings.filter(d => d.velocity).length === 0;

  return (
    <div className="page brk-page">
      <div className="brk-header">
        <div>
          <h1 className="brk-title">Breakout Alerts</h1>
          <p className="brk-sub">Artists whose overall score jumped significantly week-over-week — move before the market catches on.</p>
        </div>
        <div className="brk-threshold">
          <label>Alert threshold</label>
          <div className="brk-threshold-row">
            <input
              type="range" min="2" max="30" step="1" value={threshold}
              onChange={e => setThreshold(Number(e.target.value))}
              className="brk-slider"
            />
            <span className="brk-threshold-val">+{threshold}%</span>
          </div>
        </div>
      </div>

      {noData ? (
        <div className="brk-empty">
          <div className="brk-empty-icon">⏳</div>
          <h2>Waiting for second data snapshot</h2>
          <p>Breakout detection needs two weeks of data to compare. Check back after the next refresh.</p>
        </div>
      ) : alerts.length === 0 ? (
        <div className="brk-empty">
          <div className="brk-empty-icon">📊</div>
          <h2>No breakouts this week at +{threshold}%</h2>
          <p>Lower the threshold to surface smaller movements, or check back after the next data refresh.</p>
        </div>
      ) : (
        <div className="brk-list">
          {alerts.map((dj, i) => {
            const v = dj.velocity;
            const drivers = Object.entries(v.metrics ?? {})
              .filter(([, val]) => val > 5)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 3);
            return (
              <div key={dj.name} className="brk-card">
                <div className="brk-card-rank">#{i + 1}</div>
                <div className="brk-card-avatar">
                  {dj.image
                    ? <img src={dj.image} alt={dj.name} />
                    : <div className="brk-card-initial">{dj.name[0]}</div>}
                </div>
                <div className="brk-card-body">
                  <div className="brk-card-name"><ArtistLink name={dj.name} /></div>
                  <div className="brk-card-meta">Rank #{dj.rank} · Overall score +{v.score_change_pct.toFixed(1)}% this week</div>
                  {drivers.length > 0 && (
                    <div className="brk-card-drivers">
                      {drivers.map(([key, val]) => (
                        <span key={key} className="brk-driver">
                          {VELOCITY_LABELS[key] ?? key} <strong>+{val.toFixed(1)}%</strong>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="brk-card-score">
                  <span className="brk-score-badge">+{v.score_change_pct.toFixed(1)}%</span>
                  <span className="brk-score-label">score jump</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Reports — published analysis ────────────────────────────────────
const REPORTS = [
  {
    title: "CRSSD Fall 2026 — Lineup Intelligence",
    dek: "A full demand read on the CRSSD Fall lineup: who's underpriced, who's overbooked in San Diego, ticket-conversion standouts, and the budget math — built from the same live-anchored data the rest of the site runs on.",
    href: "/reports/crssd-fall-2026/",
    img: "/reports/crssd-fall-2026/img/card-table-4x5.png",
    tag: "Festival",
    date: "2026-06-02",
  },
  {
    title: "Mau P — Momentum Report",
    dek: "A single-artist deep dive on Mau P's trajectory across every signal — the kind of one-pager you'd send a promoter to make the case.",
    href: "/reports/mau-p.html",
    tag: "Artist",
    date: "2026-05-30",
  },
];

function ReportsPage() {
  const fmtDate = iso => new Date(iso + "T00:00:00").toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  const [feature, ...rest] = REPORTS;
  return (
    <div className="page rp-page">
      <div className="rp-hero">
        <h1 className="rp-title">Analysis Reports</h1>
        <p className="rp-sub">Standalone intelligence briefs — lineups, artists and scenes read through PEAKTIME's demand data. Shareable, and built for industry decisions.</p>
      </div>

      <a className="rp-feature" href={feature.href}>
        {feature.img && <div className="rp-feature-img" style={{ backgroundImage: `url(${feature.img})` }} />}
        <div className="rp-feature-body">
          <div className="rp-meta"><span className="rp-tag">{feature.tag}</span> · {fmtDate(feature.date)}</div>
          <div className="rp-feature-title">{feature.title}</div>
          <div className="rp-feature-dek">{feature.dek}</div>
          <span className="rp-read">Read the report →</span>
        </div>
      </a>

      <div className="rp-list">
        {rest.map(r => (
          <a className="rp-card" key={r.href} href={r.href}>
            <div className="rp-meta"><span className="rp-tag">{r.tag}</span> · {fmtDate(r.date)}</div>
            <div className="rp-card-title">{r.title}</div>
            <div className="rp-card-dek">{r.dek}</div>
            <span className="rp-read">Read →</span>
          </a>
        ))}
      </div>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────

export default function App() {
  const [rankings, setRankings]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [movers, setMovers]                   = useState(null);
  const [onesToWatch, setOnesToWatch]         = useState([]);
  const [velocityRanked, setVelocityRanked]   = useState([]);
  const [breakouts, setBreakouts]             = useState([]);
  const [breakoutThreshold, setBreakoutThreshold] = useState(8);
  const [expanded, setExpanded]       = useState(null);
  const [sortKey, setSortKey]         = useState("score");
  const [compareList, setCompareList] = useState([]);
  const [showCompare, setShowCompare] = useState(false);
  const [activeTab, setActiveTab]     = useState("rankings");
  const cardRefs = useRef({});

  function load() {
    setLoading(true);
    // no-cache = always revalidate against the server's ETag. A returning visitor
    // gets a cheap 304 when unchanged, but fresh data the moment it updates —
    // otherwise GitHub Pages can serve a stale rankings.json and newly-added
    // fields (e.g. Beatport) look "missing".
    fetch("/rankings.json", { cache: "no-cache" })
      .then(r => { if (!r.ok) throw new Error("Data not available"); return r.json(); })
      .then(data => {
        const list = Array.isArray(data) ? data : (data.rankings ?? []);
        setRankings(list);
        setLastUpdated(Array.isArray(data) ? null : (data.lastUpdated ?? null));
        setMovers(data.movers ?? null);
        setOnesToWatch(data.onesToWatch ?? []);
        setVelocityRanked(data.velocityRanked ?? []);
        setBreakouts(data.breakouts ?? []);
        setBreakoutThreshold(data.breakoutThreshold ?? 8);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }

  useEffect(() => { load(); }, []);

  const [profileSlug, setProfileSlug] = useState(parseProfileSlug());
  const [marketSlug, setMarketSlug] = useState(parseMarketSlug());
  const [clubSlugState, setClubSlugState] = useState(parseClubSlug());
  const [blogSlugState, setBlogSlugState] = useState(parseBlogSlug());
  const [valueSlugState, setValueSlugState] = useState(parseValueSlug());
  const [editor] = useState(isEditor());
  useEffect(() => {
    const onHash = () => { setProfileSlug(parseProfileSlug()); setMarketSlug(parseMarketSlug()); setClubSlugState(parseClubSlug()); setBlogSlugState(parseBlogSlug()); setValueSlugState(parseValueSlug()); };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // GA4 SPA virtual pageviews — track tab switches and profile navigation
  useEffect(() => {
    if (typeof window.gtag !== "function") return;
    const path  = profileSlug ? `/artist/${profileSlug}` : `/${activeTab}`;
    const title = profileSlug ? `Artist: ${profileSlug}` : `Tab: ${activeTab}`;
    window.gtag("event", "page_view", {
      page_title: title,
      page_path: path,
      page_location: window.location.origin + "/" + path.replace(/^\//, ""),
    });
  }, [activeTab, profileSlug]);

  const ranges   = useMemo(() => computeRanges(rankings), [rankings]);
  const maxScore = rankings[0]?.score ?? 1;

  const sorted = useMemo(() => {
    if (sortKey === "score") return rankings;
    return [...rankings].sort((a, b) => (b[sortKey] || 0) - (a[sortKey] || 0));
  }, [rankings, sortKey]);

  function scrollTo(name) {
    setExpanded(name);
    setTimeout(() => {
      cardRefs.current[name]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }

  function toggleCompare(name) {
    setCompareList(prev => {
      if (prev.includes(name)) return prev.filter(n => n !== name);
      if (prev.length >= 2)    return [prev[1], name];
      return [...prev, name];
    });
    setShowCompare(false);
  }

  const compareDJs = compareList.map(n => rankings.find(r => r.name === n)).filter(Boolean);

  // Profile page route — shareable URL like #/artist/john-summit (after all hooks)
  if (profileSlug) {
    return (
      <div className="page">
        {rankings.length
          ? <ArtistProfile rankings={rankings} slug={profileSlug} onBack={() => { window.location.hash = ""; }} />
          : <div className="loading">Loading…</div>}
      </div>
    );
  }

  // Market Read route — shareable one-pager like #/market/amsterdam
  if (marketSlug) {
    return rankings.length
      ? <MarketReadPage rankings={rankings} slug={marketSlug} />
      : <div className="page"><div className="loading">Loading…</div></div>;
  }

  // Club profile route — shareable like #/club/berghain-panorama-bar
  if (clubSlugState) {
    return <div className="page"><Suspense fallback={<div className="loading">Loading…</div>}><ClubProfile slug={clubSlugState} /></Suspense></div>;
  }

  // Journal post route — shareable like #/blog/notes-from-the-floor (editor-only for now)
  if (valueSlugState) {
    return <div className="page"><ValueReport rankings={rankings} slug={valueSlugState} /></div>;
  }
  if (blogSlugState && editor) {
    return <div className="page"><Suspense fallback={<div className="loading">Loading…</div>}><BlogPost slug={blogSlugState} /></Suspense></div>;
  }

  return (
    <div className="page">
      <header className="page-header">
        <a href="#" className="brand-lockup" onClick={e => { e.preventDefault(); window.location.hash = ""; setActiveTab("rankings"); }}>
          <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="7" fill="#0c0c0e" />
            <g fill="var(--accent)">
              <rect x="5.5" y="18.5" width="3.6" height="8" rx="1.3" />
              <rect x="11.2" y="13" width="3.6" height="13.5" rx="1.3" />
              <rect x="16.9" y="8" width="3.6" height="18.5" rx="1.3" />
              <rect x="22.6" y="4" width="3.6" height="22.5" rx="1.3" />
            </g>
          </svg>
          <span className="brand-word">PEAKTIME</span>
        </a>
        <div className="header-eyebrow">The demand index for electronic music</div>
        <h1 className="header-title">Hottest House DJ Rankings</h1>
        <div className="header-platforms">
          <span className="plat-pill"><span className="plat-dot" style={{ background: "#1DB954" }} />Spotify</span>
          <span className="plat-pill"><span className="plat-dot" style={{ background: "#a8e00f" }} />Beatport</span>
          <span className="plat-pill"><span className="plat-dot" style={{ background: "#ff0050" }} />TikTok</span>
          <span className="plat-pill"><span className="plat-dot" style={{ background: "#FF0000" }} />YouTube</span>
          <span className="plat-pill"><span className="plat-dot" style={{ background: "#4285F4" }} />Trends</span>
        </div>
        {lastUpdated && <p className="header-updated">Updated {new Date(lastUpdated).toLocaleString()}</p>}
        <div className="top-tabs">
          <button className={`top-tab ${activeTab === "rankings"      ? "top-tab--active" : ""}`} onClick={() => setActiveTab("rankings")}>Rankings</button>
          <button className={`top-tab ${activeTab === "how-it-works"  ? "top-tab--active" : ""}`} onClick={() => setActiveTab("how-it-works")}>How It Works</button>
          <button className={`top-tab ${activeTab === "booking" ? "top-tab--active" : ""}`} onClick={() => setActiveTab("booking")}>Booking Intelligence</button>
          <button className={`top-tab ${activeTab === "clubs" ? "top-tab--active" : ""}`} onClick={() => setActiveTab("clubs")}>Club Index</button>
          <button className={`top-tab ${activeTab === "reports" ? "top-tab--active" : ""}`} onClick={() => setActiveTab("reports")}>Reports</button>
          {editor && <button className={`top-tab ${activeTab === "journal" ? "top-tab--active" : ""}`} onClick={() => setActiveTab("journal")}>Journal <span className="tab-private">·private</span></button>}
          <button className={`top-tab ${activeTab === "scouting" ? "top-tab--active" : ""}`} onClick={() => setActiveTab("scouting")}>Scouting</button>
          {/* TEMP: Breakouts & Movers tabs hidden until enough history accrues to populate them
          <button className={`top-tab ${activeTab === "breakouts"     ? "top-tab--active" : ""}`} onClick={() => setActiveTab("breakouts")}>Breakouts</button>
          <button className={`top-tab ${activeTab === "movers"        ? "top-tab--active" : ""}`} onClick={() => setActiveTab("movers")}>Movers</button>
          */}
          <button data-tab="pro" className={`top-tab ${activeTab === "pro" ? "top-tab--active" : ""}`} onClick={() => setActiveTab("pro")}>Deep Dive</button>
        </div>
      </header>

      {activeTab === "pro" && <Suspense fallback={<div className="state-msg"><div className="spinner" />Loading…</div>}><ProPage rankings={rankings} /></Suspense>}
      {activeTab === "booking"       && <BookingIntelPage rankings={rankings} />}
      {activeTab === "clubs"         && <Suspense fallback={<div className="state-msg"><div className="spinner" />Loading…</div>}><ClubsPage /></Suspense>}
      {activeTab === "reports"       && <ReportsPage />}
      {activeTab === "journal"       && editor && <Suspense fallback={<div className="state-msg"><div className="spinner" />Loading…</div>}><BlogPage /></Suspense>}
      {activeTab === "scouting"      && <ScoutingPage rankings={rankings} />}
      {/* TEMP: hidden until sufficient data
      {activeTab === "breakouts"     && <BreakoutsPage rankings={rankings} breakouts={breakouts} breakoutThreshold={breakoutThreshold} />}
      {activeTab === "movers"        && <MoversPage />}
      */}
      {activeTab === "how-it-works"  && <HowItWorksPage />}

      {activeTab === "rankings" && <>
      <div className="sort-bar">
        <span className="sort-label">Sort by</span>
        {SORT_OPTIONS.map(opt => (
          <button
            key={opt.key}
            className={`sort-btn ${sortKey === opt.key ? "sort-btn--active" : ""}`}
            onClick={() => setSortKey(opt.key)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <main className="rankings-list">
        {loading && <div className="state-msg"><div className="spinner" />Loading rankings…</div>}
        {error   && <div className="state-msg state-msg--error">⚠ {error}</div>}
        {!loading && !error && sorted.map(dj => (
          <div key={dj.name} ref={el => { cardRefs.current[dj.name] = el; }}>
            <DJCard
              dj={dj}
              maxScore={maxScore}
              isTop={dj.rank <= 3}
              expanded={expanded === dj.name}
              onToggle={() => setExpanded(prev => prev === dj.name ? null : dj.name)}
              ranges={ranges}
              onScoreSaved={load}
              inCompare={compareList.includes(dj.name)}
              onToggleCompare={toggleCompare}
            />
          </div>
        ))}
      </main>

      </>}

      {compareList.length > 0 && (
        <CompareBar
          selected={compareDJs}
          onClear={() => { setCompareList([]); setShowCompare(false); }}
          onCompare={() => setShowCompare(true)}
        />
      )}

      {showCompare && compareDJs.length === 2 && (
        <CompareModal djs={compareDJs} ranges={ranges} onClose={() => setShowCompare(false)} />
      )}
    </div>
  );
}
