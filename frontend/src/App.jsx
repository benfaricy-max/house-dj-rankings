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

// ── How It Works page ─────────────────────────────────────────────

const DATA_SOURCES = [
  { icon: "🎵", name: "Spotify",       color: "#1DB954", points: ["Monthly listeners (scraped)", "Follower count & growth rate", "Average track popularity score", "Playlist placements count"] },
  { icon: "▶",  name: "YouTube",       color: "#FF0000", points: ["Subscriber count", "Weekly view count"] },
  { icon: "🎵", name: "TikTok",        color: "#010101", points: ["Hashtag post count — measures how much content is being created around an artist"] },
  { icon: "📈", name: "Google Trends", color: "#4285F4", points: ["Search interest score (0–100) over the past 90 days"] },
  { icon: "🎛",  name: "Scene Score",  color: "#8b5cf6", points: ["Manual override 0–100 — accounts for festival bookings, residencies, and cultural weight that algorithms miss"] },
];

const METRIC_DETAILS = [
  { key: "spotify_monthly_listeners",    label: "Monthly Listeners",  weight: 0.20, color: "#1DB954", why: "The single strongest proxy for active fanbase size. Scraped directly from Spotify artist pages — not filtered by Spotify's API restrictions." },
  { key: "spotify_playlist_placements",  label: "Playlist Placements",weight: 0.12, color: "#1DB954", why: "How many editorial and algorithmic Spotify playlists feature this artist. A strong leading indicator — playlist inclusion drives listener growth 4–6 weeks later." },
  { key: "tiktok_post_count",            label: "TikTok Posts",       weight: 0.12, color: "#010101", why: "Total posts using the artist's hashtag. Measures grassroots hype and cultural spread, especially among the 18–25 demographic that drives festival ticket sales." },
  { key: "spotify_avg_track_popularity", label: "Track Popularity",   weight: 0.10, color: "#1DB954", why: "Average popularity score across the artist's top 10 tracks (0–100). Reflects recent stream velocity, not historical catalogue." },
  { key: "youtube_subscribers",          label: "YouTube Subscribers", weight: 0.10, color: "#FF0000", why: "Subscriber count as a proxy for dedicated fanbase depth. YouTube fans tend to be more loyal and convert to ticket buyers at a higher rate." },
  { key: "google_trends_score",          label: "Google Trends",      weight: 0.10, color: "#4285F4", why: "90-day search interest score (0–100) normalised to the artist's own peak. A rising trends score often precedes booking fee increases by 8–12 weeks." },
  { key: "spotify_follower_growth_rate", label: "Follower Growth",    weight: 0.08, color: "#1DB954", why: "Week-over-week percentage change in Spotify followers. The most forward-looking signal in the model — today's growth becomes tomorrow's rank." },
  { key: "youtube_views_weekly",         label: "YouTube Views/wk",   weight: 0.08, color: "#FF0000", why: "Weekly view count captures upload cadence and video virality. An artist releasing content consistently scores higher than one with a large back-catalogue but no new uploads." },
  { key: "spotify_followers",            label: "Spotify Followers",  weight: 0.06, color: "#1DB954", why: "Total follower count as a baseline size signal. Weighted lower than listeners because followers are a lagging indicator — listeners spike first." },
  { key: "manual_scene_score",           label: "Scene Score",        weight: 0.04, color: "#8b5cf6", why: "A 0–100 editorial override for industry context that algorithms can't capture: Boiler Room streams, Fabric residencies, festival closing slots, and critical heat." },
];

function HowItWorksPage() {
  const totalWeight = METRIC_DETAILS.reduce((s, m) => s + m.weight, 0);
  return (
    <div className="hiw-page">
      <div className="hiw-hero">
        <div className="hiw-eyebrow">Methodology</div>
        <h2 className="hiw-title">How we rank the world's hottest DJs</h2>
        <p className="hiw-sub">
          Every ranking is computed from 10 real-time signals pulled directly from Spotify, YouTube, TikTok, and Google Trends.
          No editorial bias, no pay-to-play. Refreshed every 6 hours.
        </p>
      </div>

      <section className="hiw-section">
        <h3 className="hiw-section-title">The 10 Signals</h3>
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
        <p className="hiw-section-sub">The Momentum Score is a separate composite signal that measures trajectory, not current standing. A DJ ranked #40 with a momentum of 85 is growing faster than someone at #10 with a momentum of 30.</p>
        <div className="hiw-momentum-formula">
          {[
            { signal: "Follower Growth Rate",  weight: "35%", color: "#1DB954" },
            { signal: "TikTok Post Count",     weight: "25%", color: "#010101" },
            { signal: "Google Trends Score",   weight: "25%", color: "#4285F4" },
            { signal: "Rank Change (weekly)",  weight: "15%", color: "var(--accent)" },
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
            { label: "Spotify Followers & Popularity",  freq: "Every 6 hours" },
            { label: "Monthly Listeners",               freq: "Every 6 hours (scraped)" },
            { label: "YouTube Subscribers & Views",     freq: "Every 6 hours" },
            { label: "Google Trends Score",             freq: "Every 6 hours" },
            { label: "TikTok Post Count",               freq: "Every 6 hours (scraped)" },
            { label: "Rank Snapshots Retained",         freq: "365 data points" },
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
            { q: "How is the manual scene score assigned?", a: "It's set manually by the editorial team (0–100) to account for industry factors that aren't yet measurable algorithmically: Boiler Room sets, festival headline slots, Fabric residencies, and critical tastemaker coverage. It carries only 4% weight." },
            { q: "How does the Ones to Watch list differ from the main rankings?", a: "The main rankings weight current standing heavily. Ones to Watch reranks entirely by Momentum Score — so an artist can be #45 in the main chart but #2 in Ones to Watch if they're growing fast." },
            { q: "Can I get notified when an artist moves?", a: "Pro subscribers receive weekly movement alerts by email. Subscribe under the Pro tab." },
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
        <div className="mover-name">{entry.name}</div>
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
      return { ...dj, momentum: Math.round(growth * 0.35 + tiktok * 0.25 + trends * 0.25 + rankMo * 0.15) };
    })
    .filter(dj => !dj.spotify_monthly_listeners || dj.spotify_monthly_listeners < 500_000)
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
                  <div className="breaking-name">{dj.name}</div>
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
                <div className="otw-name">{dj.name}</div>
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

function VelocityPage({ rankings }) {
  const [sortKey, setSortKey] = useState("composite");

  const artists = rankings
    .filter(d => d.velocity)
    .sort((a, b) => {
      if (sortKey === "composite") return b.velocity.composite - a.velocity.composite;
      const av = a.velocity.metrics?.[sortKey] ?? -Infinity;
      const bv = b.velocity.metrics?.[sortKey] ?? -Infinity;
      return bv - av;
    });

  if (!artists.length) return (
    <div className="page vel-empty">
      <h2>Velocity data will appear after the second data refresh</h2>
      <p>Week-over-week comparisons need at least two snapshots. Check back in 6 hours.</p>
    </div>
  );

  const metricKeys = Object.keys(VELOCITY_LABELS);

  return (
    <div className="page vel-page">
      <div className="vel-header">
        <h1 className="vel-title">Velocity</h1>
        <p className="vel-sub">Week-over-week growth rate across every signal we track. Sort any column.</p>
      </div>
      <div className="vel-table-wrap">
        <table className="vel-table">
          <thead>
            <tr>
              <th className="vel-th vel-th--artist">Artist</th>
              <th
                className={`vel-th vel-th--composite ${sortKey === "composite" ? "vel-th--active" : ""}`}
                onClick={() => setSortKey("composite")}
              >Composite ↕</th>
              {metricKeys.map(k => (
                <th
                  key={k}
                  className={`vel-th ${sortKey === k ? "vel-th--active" : ""}`}
                  onClick={() => setSortKey(k)}
                >{VELOCITY_LABELS[k]} ↕</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {artists.map(dj => (
              <tr key={dj.name} className="vel-row">
                <td className="vel-td vel-td--artist">
                  <span className="vel-rank">#{dj.rank}</span>
                  {dj.image && <img src={dj.image} className="vel-img" alt="" />}
                  <span className="vel-name">{dj.name}</span>
                </td>
                <td className="vel-td vel-td--composite">
                  <VelocityBadge value={dj.velocity.composite} />
                </td>
                {metricKeys.map(k => (
                  <td key={k} className="vel-td">
                    <VelocityBadge value={dj.velocity.metrics?.[k] ?? null} />
                  </td>
                ))}
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
          <h1 className="brk-title">🚨 Breakout Alerts</h1>
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
                  <div className="brk-card-name">{dj.name}</div>
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

// ── Pro Paywall ────────────────────────────────────────────────────

const PRO_KEY         = "djranks_pro_access";
const STRIPE_LINK     = "https://buy.stripe.com/thedjrankings"; // replace with real Stripe Payment Link
const PRO_PRICE_MONTH = 9;
const PRO_PRICE_YEAR  = 79;

function ProPaywall({ onUnlock }) {
  const [code, setCode] = useState("");
  const [err,  setErr]  = useState("");

  // Check for ?pro=ACCESS_TOKEN in URL (Stripe redirect)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token  = params.get("pro");
    if (token) {
      localStorage.setItem(PRO_KEY, token);
      window.history.replaceState({}, "", window.location.pathname);
      onUnlock();
    }
  }, []);

  function tryCode() {
    if (code.trim().toUpperCase() === "DJPRO2024") {
      localStorage.setItem(PRO_KEY, "promo_" + Date.now());
      onUnlock();
    } else {
      setErr("Invalid code.");
    }
  }

  return (
    <div className="paywall">
      <div className="paywall-hero">
        <span className="paywall-badge">PRO</span>
        <h1 className="paywall-title">The Booker's Edge</h1>
        <p className="paywall-sub">
          Real-time data tools built for promoters, bookers, and talent buyers.
          Stop guessing — start booking with confidence.
        </p>
      </div>

      <div className="paywall-features">
        {[
          { icon: "📍", title: "Geographic Demand",       desc: "See exactly which cities and countries are buzzing for each artist — down to US city level." },
          { icon: "💷", title: "Booking Fee Estimates",   desc: "Tier-based fee ranges updated with each ranking cycle. Know before you negotiate." },
          { icon: "📈", title: "Momentum Scoring",        desc: "Weighted growth metrics surfacing artists breaking before the mainstream catches on." },
          { icon: "🏟️", title: "Venue Fit Analysis",      desc: "Capacity recommendations matched to current draw based on follower density and trend data." },
          { icon: "⭐", title: "Shortlist & Budget Planner", desc: "Build a lineup, track total fees, and export to CSV for your team." },
          { icon: "🌍", title: "Market Penetration",      desc: "Understand which regions an artist hasn't cracked yet — spot opportunity before competitors." },
        ].map(f => (
          <div className="paywall-feature" key={f.title}>
            <span className="paywall-feature-icon">{f.icon}</span>
            <div>
              <h3 className="paywall-feature-title">{f.title}</h3>
              <p className="paywall-feature-desc">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="paywall-why">
        <h2 className="paywall-why-title">Why industry professionals pay for this</h2>
        <p className="paywall-why-intro">Raw rankings aren't that valuable to bookers and labels. What they actually pay for is:</p>
        <div className="paywall-why-list">
          {[
            { n: "1", title: "Breakout Detection", desc: "\"This artist is growing 40% week over week in Chicago and Berlin before anyone is talking about them.\"" },
            { n: "2", title: "Routing Intelligence", desc: "\"This artist has high search concentration in Miami and Detroit — book them there before demand peaks.\"" },
            { n: "3", title: "Comparative Benchmarking", desc: "\"Artist A has 3× the engagement of Artist B despite similar Spotify numbers — stronger credibility with real fans.\"" },
            { n: "4", title: "Historical Trajectory", desc: "\"This artist has been on a 12-week growth streak across every signal we track.\"" },
          ].map(({ n, title, desc }) => (
            <div key={n} className="paywall-why-item">
              <span className="paywall-why-num">{n}</span>
              <div>
                <strong>{title}</strong>
                <p>{desc}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="paywall-why-footnote">
          Booking agencies and labels pay for data subscriptions in the range of hundreds to thousands per month
          when it directly informs talent decisions. This is that tool.
        </p>
      </div>

      <div className="paywall-plans">
        <div className="paywall-plan paywall-plan--featured">
          <div className="paywall-plan-label">Most Popular</div>
          <div className="paywall-plan-price">£{PRO_PRICE_MONTH}<span>/mo</span></div>
          <div className="paywall-plan-name">Monthly</div>
          <a href={STRIPE_LINK + "?plan=monthly"} className="paywall-cta">Get Pro Access</a>
        </div>
        <div className="paywall-plan">
          <div className="paywall-plan-price">£{PRO_PRICE_YEAR}<span>/yr</span></div>
          <div className="paywall-plan-name">Annual <span className="paywall-save">Save 30%</span></div>
          <a href={STRIPE_LINK + "?plan=annual"} className="paywall-cta paywall-cta--outline">Get Pro Access</a>
        </div>
      </div>

      <div className="paywall-code">
        <p>Have an access code?</p>
        <div className="paywall-code-row">
          <input
            value={code}
            onChange={e => { setCode(e.target.value); setErr(""); }}
            onKeyDown={e => e.key === "Enter" && tryCode()}
            placeholder="Enter code"
            className="paywall-code-input"
          />
          <button onClick={tryCode} className="paywall-code-btn">Unlock</button>
        </div>
        {err && <p className="paywall-code-err">{err}</p>}
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
  const [proUnlocked, setProUnlocked] = useState(() => !!localStorage.getItem(PRO_KEY));
  const cardRefs = useRef({});

  function load() {
    setLoading(true);
    fetch("/rankings.json")
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
          <button className={`top-tab ${activeTab === "rankings"      ? "top-tab--active" : ""}`} onClick={() => setActiveTab("rankings")}>Rankings</button>
          <button className={`top-tab ${activeTab === "how-it-works"  ? "top-tab--active" : ""}`} onClick={() => setActiveTab("how-it-works")}>How It Works</button>
          <button className={`top-tab ${activeTab === "ones-to-watch" ? "top-tab--active" : ""}`} onClick={() => setActiveTab("ones-to-watch")}>Ones to Watch</button>
          <button className={`top-tab ${activeTab === "velocity"      ? "top-tab--active" : ""}`} onClick={() => setActiveTab("velocity")}>Velocity</button>
          <button className={`top-tab ${activeTab === "breakouts"     ? "top-tab--active" : ""}`} onClick={() => setActiveTab("breakouts")}>🚨 Breakouts</button>
          <button className={`top-tab ${activeTab === "movers"        ? "top-tab--active" : ""}`} onClick={() => setActiveTab("movers")}>Movers</button>
          <button className={`top-tab top-tab--pro ${activeTab === "pro" ? "top-tab--active" : ""}`} onClick={() => setActiveTab("pro")}>Pro</button>
        </div>
      </header>

      {activeTab === "pro" && (
        proUnlocked
          ? <ProPage rankings={rankings} />
          : <ProPaywall onUnlock={() => setProUnlocked(true)} />
      )}
      {activeTab === "ones-to-watch" && <OnestoWatchPage rankings={rankings} />}
      {activeTab === "velocity"      && <VelocityPage rankings={rankings} />}
      {activeTab === "breakouts"     && <BreakoutsPage rankings={rankings} breakouts={breakouts} breakoutThreshold={breakoutThreshold} />}
      {activeTab === "movers"        && <MoversPage />}
      {activeTab === "how-it-works"  && <HowItWorksPage />}

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
