import { useEffect, useState, useMemo, useRef } from "react";
import "./App.css";
import ProPage from "./ProPage";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
const MEDAL = { 1: "🥇", 2: "🥈", 3: "🥉" };

const METRICS = [
  { key: "spotify_monthly_listeners",    label: "Monthly Listeners",  weight: 0.20, format: "count"    },
  { key: "spotify_playlist_placements",  label: "Releases",           weight: 0.12, format: "number"   },
  { key: "tiktok_post_count",            label: "TikTok Posts",       weight: 0.12, format: "posts"    },
  { key: "spotify_avg_track_popularity", label: "Track Popularity",   weight: 0.10, format: "score100" },
  { key: "youtube_subscribers",          label: "YT Subscribers",     weight: 0.10, format: "count"    },
  { key: "google_trends_score",          label: "Google Trends",      weight: 0.10, format: "score100" },
  { key: "spotify_follower_growth_rate", label: "Follower Growth",    weight: 0.08, format: "pct"      },
  { key: "youtube_views_weekly",         label: "YT Views / wk",      weight: 0.08, format: "count"    },
  { key: "spotify_followers",            label: "Spotify Followers",  weight: 0.06, format: "count"    },
  { key: "manual_scene_score",           label: "Scene Score",        weight: 0.04, format: "score100" },
];

const SORT_OPTIONS = [
  { key: "score",                       label: "Score"      },
  { key: "spotify_monthly_listeners",   label: "Listeners"  },
  { key: "tiktok_post_count",           label: "TikTok"     },
  { key: "google_trends_score",         label: "Trending"   },
  { key: "youtube_subscribers",         label: "YouTube"    },
  { key: "spotify_followers",           label: "Followers"  },
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
      <div className="compare-modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>

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
      <div className="dj-card-main" onClick={onToggle}>
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
            <span className="dj-name">{dj.name}</span>
            <span className="dj-score-badge">{dj.score} pts</span>
          </div>
          <ScoreBar score={dj.score} maxScore={maxScore} />
          <div className="dj-quick-stats">
            {dj.spotify_monthly_listeners > 0 && <span className="qs-pill">{fmt(dj.spotify_monthly_listeners)} listeners</span>}
            {dj.tiktok_post_count > 0 && <span className="qs-pill">{fmt(dj.tiktok_post_count)} TikTok posts</span>}
            {dj.google_trends_score > 0 && <span className="qs-pill">Trends {dj.google_trends_score}/100</span>}
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

// ── Main App ───────────────────────────────────────────────────────

export default function App() {
  const [rankings, setRankings]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [movers, setMovers]           = useState(null);
  const [onesToWatch, setOnesToWatch] = useState([]);
  const [expanded, setExpanded]       = useState(null);
  const [sortKey, setSortKey]         = useState("score");
  const [compareList, setCompareList] = useState([]);
  const [showCompare, setShowCompare] = useState(false);
  const [activeTab, setActiveTab]     = useState("rankings");
  const cardRefs = useRef({});

  function load() {
    setLoading(true);
    fetch(`${API}/api/rankings`)
      .then(r => { if (!r.ok) throw new Error("Server error"); return r.json(); })
      .then(data => {
        const list = Array.isArray(data) ? data : (data.rankings ?? []);
        setRankings(list);
        setLastUpdated(Array.isArray(data) ? null : (data.lastUpdated ?? null));
        setMovers(data.movers ?? null);
        setOnesToWatch(data.onesToWatch ?? []);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }

  useEffect(() => { load(); }, []);

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

  return (
    <div className="page">
      <header className="page-header">
        <div className="header-eyebrow">Live Rankings</div>
        <h1 className="header-title">House DJ Rankings</h1>
        <p className="header-sub">Scored across Spotify, TikTok, YouTube &amp; Google Trends</p>
        {lastUpdated && <p className="header-updated">Updated {new Date(lastUpdated).toLocaleString()}</p>}
        <div className="top-tabs">
          <button className={`top-tab ${activeTab === "rankings" ? "top-tab--active" : ""}`} onClick={() => setActiveTab("rankings")}>Rankings</button>
          <button className={`top-tab top-tab--pro ${activeTab === "pro" ? "top-tab--active" : ""}`} onClick={() => setActiveTab("pro")}>Pro</button>
        </div>
      </header>

      {activeTab === "pro" && <ProPage rankings={rankings} />}

      {activeTab === "rankings" && <>
      {movers && <WeeklyMovers movers={movers} onScrollTo={scrollTo} />}
      {onesToWatch.length > 0 && <OnesToWatch artists={onesToWatch} onScrollTo={scrollTo} />}

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
