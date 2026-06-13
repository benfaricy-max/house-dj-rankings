import { useState, useMemo } from "react";
import { slugify } from "./ArtistProfile";
import "./ChartsPage.css";

// ---------------------------------------------------------------------------
// Charts - the visual layer of the Index. Four hand-rolled SVG charts, no
// charting library (the site ships React only). Brand rules: near-black bg,
// acid-lime accent used sparingly, mono numbers, no emoji, accessible fallbacks.
//   1. Reach vs Credibility - the signature two-axis scatter (bubble=momentum)
//   2. Momentum / Trends - 12-month search-interest lines for top movers
//   3. Rankings - horizontal bar, top 20 by composite score
//   4. Signal Profile - per-artist radar across the 9 weighted signals
// ---------------------------------------------------------------------------

const num = (v) => (Number.isFinite(v) ? v : 0);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Centered moving average - tames spiky weekly search-interest data so the
// underlying trajectory (the actual momentum signal) is legible.
function smooth(arr, win = 5) {
  const h = Math.floor(win / 2);
  return arr.map((_, i) => {
    let sum = 0, n = 0;
    for (let j = Math.max(0, i - h); j <= Math.min(arr.length - 1, i + h); j++) { sum += num(arr[j]); n++; }
    return n ? sum / n : 0;
  });
}

// Min-max normalise a field to 0..100 across the roster (log for heavy tails).
function makeNormalizer(rows, key, { log = false } = {}) {
  const prep = (v) => (log ? Math.log10(1 + Math.max(0, num(v))) : num(v));
  const vals = rows.map((r) => prep(r[key])).filter((v) => v > 0);
  const lo = vals.length ? Math.min(...vals) : 0;
  const hi = vals.length ? Math.max(...vals) : 1;
  const span = Math.max(hi - lo, 1e-9);
  return (v) => clamp(((prep(v) - lo) / span) * 100, 0, 100);
}

// Credibility axis: Beatport (track/scene credibility) blended with the editorial
// Scene score. This is the "DJ's DJ" axis - high here + low reach = scene-revered.
const credibility = (d) => Math.round(0.55 * num(d.beatport_score) + 0.45 * num(d.manual_scene_score));

// =====================================================================
// 1. REACH vs CREDIBILITY  (scatter / bubble)
// =====================================================================
const QUADRANTS = {
  headliner: { label: "Festival headliners", shape: "circle", hint: "high reach · high credibility" },
  djsdj:     { label: "DJ's DJs",            shape: "triangle", hint: "scene-revered, not yet mainstream" },
  crossover: { label: "Mainstream crossover", shape: "square", hint: "big reach, scene yet to follow" },
  emerging:  { label: "Emerging / niche",    shape: "diamond", hint: "building on both axes" },
};

function quadrantOf(x, y, mx, my) {
  if (x >= mx && y >= my) return "headliner";
  if (x < mx && y >= my) return "djsdj";
  if (x >= mx && y < my) return "crossover";
  return "emerging";
}

function ShapeMark({ kind, cx, cy, r, fill, stroke, opacity }) {
  const common = { fill, stroke, strokeWidth: 1, opacity };
  if (kind === "square") return <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} rx={1.5} {...common} />;
  if (kind === "triangle") {
    const p = `${cx},${cy - r * 1.2} ${cx - r * 1.1},${cy + r * 0.9} ${cx + r * 1.1},${cy + r * 0.9}`;
    return <polygon points={p} {...common} />;
  }
  if (kind === "diamond") {
    const p = `${cx},${cy - r * 1.25} ${cx + r * 1.1},${cy} ${cx},${cy + r * 1.25} ${cx - r * 1.1},${cy}`;
    return <polygon points={p} {...common} />;
  }
  return <circle cx={cx} cy={cy} r={r} {...common} />;
}

function ReachCredChart({ rankings }) {
  const [hover, setHover] = useState(null);
  const [showData, setShowData] = useState(false);

  const W = 720, H = 520, PL = 56, PR = 24, PT = 28, PB = 52;
  const plotW = W - PL - PR, plotH = H - PT - PB;

  const reachOf = useMemo(() => makeNormalizer(rankings, "spotify_monthly_listeners", { log: true }), [rankings]);

  const pts = useMemo(() => {
    const rows = rankings
      .filter((d) => num(d.spotify_monthly_listeners) > 0 && credibility(d) > 0)
      .slice() // already score-sorted upstream
      .sort((a, b) => num(a.score) - num(b.score))
      .slice(-90); // top 90 by score keeps the cloud legible
    return rows.map((d) => ({
      name: d.name,
      x: reachOf(d.spotify_monthly_listeners),
      y: credibility(d),
      mom: clamp(num(d.momentum_score), 0, 100),
      listeners: num(d.spotify_monthly_listeners),
      beatport: num(d.beatport_score),
      scene: num(d.manual_scene_score),
      rank: d.rank,
    }));
  }, [rankings, reachOf]);

  const mx = useMemo(() => median(pts.map((p) => p.x)), [pts]);
  const my = useMemo(() => median(pts.map((p) => p.y)), [pts]);

  const sx = (x) => PL + (x / 100) * plotW;
  const sy = (y) => PT + (1 - y / 100) * plotH; // invert: high credibility on top
  const sr = (m) => 3 + (m / 100) * 9; // bubble radius from momentum

  return (
    <section className="ch-card">
      <header className="ch-head">
        <div>
          <h2 className="ch-title">Reach vs. Credibility</h2>
          <p className="ch-sub">
            Streaming reach on the x-axis, scene credibility (Beatport + editorial Scene score) on the y.
            Bubble size = momentum. The top-left quadrant is the DJ's DJs - revered, not yet mainstream.
          </p>
        </div>
        <button className="ch-toggle" onClick={() => setShowData((s) => !s)} aria-pressed={showData}>
          {showData ? "Show chart" : "Show data"}
        </button>
      </header>

      {showData ? (
        <DataTable
          caption="Reach vs. Credibility - underlying values"
          cols={["Rank", "Artist", "Reach (idx)", "Credibility", "Momentum", "Monthly listeners"]}
          rows={pts
            .slice()
            .sort((a, b) => b.y - a.y)
            .map((p) => [
              p.rank ?? " - ",
              p.name,
              p.x.toFixed(0),
              p.y.toFixed(0),
              p.mom.toFixed(0),
              p.listeners.toLocaleString("en-GB"),
            ])}
        />
      ) : (
        <div className="ch-plot-wrap">
          <svg viewBox={`0 0 ${W} ${H}`} className="ch-svg" role="img"
               aria-label="Scatter plot of streaming reach against scene credibility for the top 90 artists">
            {/* quadrant grid */}
            <line x1={sx(mx)} y1={PT} x2={sx(mx)} y2={PT + plotH} className="ch-grid" />
            <line x1={PL} y1={sy(my)} x2={PL + plotW} y2={sy(my)} className="ch-grid" />
            {/* quadrant labels */}
            <text x={PL + plotW - 6} y={PT + 14} className="ch-quad" textAnchor="end">Festival headliners ▲</text>
            <text x={PL + 6} y={PT + 14} className="ch-quad">▲ DJ's DJs</text>
            <text x={PL + plotW - 6} y={PT + plotH - 6} className="ch-quad" textAnchor="end">Mainstream crossover</text>
            <text x={PL + 6} y={PT + plotH - 6} className="ch-quad">Emerging / niche</text>

            {/* axes */}
            <text x={PL + plotW / 2} y={H - 14} className="ch-axis" textAnchor="middle">Reach  →  (streaming, log-scaled)</text>
            <text x={16} y={PT + plotH / 2} className="ch-axis" textAnchor="middle"
                  transform={`rotate(-90 16 ${PT + plotH / 2})`}>Credibility  →  (Beatport + Scene)</text>

            {/* points */}
            {pts.map((p, i) => {
              const q = quadrantOf(p.x, p.y, mx, my);
              const active = hover === i;
              return (
                <a key={p.name} href={`#/artist/${slugify(p.name)}`} className="ch-dot">
                  <g onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                     tabIndex={0} onFocus={() => setHover(i)} onBlur={() => setHover(null)}>
                    <ShapeMark kind={QUADRANTS[q].shape} cx={sx(p.x)} cy={sy(p.y)} r={sr(p.mom)}
                               fill={active ? "var(--accent)" : "rgba(200,247,80,0.34)"}
                               stroke={active ? "var(--accent)" : "rgba(200,247,80,0.55)"}
                               opacity={hover == null || active ? 1 : 0.4} />
                  </g>
                </a>
              );
            })}

            {/* tooltip (drawn last, on top) */}
            {hover != null && (() => {
              const p = pts[hover];
              const tx = clamp(sx(p.x) + 10, PL, PL + plotW - 150);
              const ty = clamp(sy(p.y) - 52, PT, PT + plotH - 56);
              return (
                <g className="ch-tip" pointerEvents="none">
                  <rect x={tx} y={ty} width="150" height="50" rx="4" />
                  <text x={tx + 8} y={ty + 17} className="ch-tip-name">{p.name}</text>
                  <text x={tx + 8} y={ty + 32} className="ch-tip-row">Reach {p.x.toFixed(0)} · Cred {p.y.toFixed(0)}</text>
                  <text x={tx + 8} y={ty + 44} className="ch-tip-row">Momentum {p.mom.toFixed(0)}</text>
                </g>
              );
            })()}
          </svg>
          <ul className="ch-legend">
            {Object.values(QUADRANTS).map((q) => (
              <li key={q.label}><LegendShape kind={q.shape} /> <span>{q.label}</span></li>
            ))}
            <li className="ch-legend-note">Bubble size = momentum</li>
          </ul>
        </div>
      )}
    </section>
  );
}

function LegendShape({ kind }) {
  return (
    <svg viewBox="0 0 14 14" width="12" height="12" className="ch-legmark" aria-hidden="true">
      <ShapeMark kind={kind} cx={7} cy={7} r={4.5} fill="rgba(200,247,80,0.4)" stroke="var(--accent)" opacity={1} />
    </svg>
  );
}

// =====================================================================
// 2. MOMENTUM / TRENDS  (multi-line, top movers)
// =====================================================================
function TrendsChart({ rankings }) {
  const movers = useMemo(
    () =>
      rankings
        .filter((d) => Array.isArray(d.trends_12m) && d.trends_12m.length >= 8 && num(d.momentum_score) > 0)
        .sort((a, b) => num(b.momentum_score) - num(a.momentum_score))
        .slice(0, 6),
    [rankings]
  );

  const [off, setOff] = useState(() => new Set()); // legend-toggled-off names
  const STYLES = ["0", "6 4", "2 4", "8 3 2 3", "1 5", "10 4 2 4"];
  const W = 720, H = 360, PL = 36, PR = 16, PT = 20, PB = 40;
  const plotW = W - PL - PR, plotH = H - PT - PB;
  const N = 52; // align to last 52 weeks

  const series = movers.map((d, i) => {
    const raw = smooth(d.trends_12m.slice(-N), 5);
    const max = Math.max(...raw, 1);
    const pts = raw.map((v, j) => [
      PL + (j / (raw.length - 1)) * plotW,
      PT + (1 - num(v) / max) * plotH,
    ]);
    return { name: d.name, mom: num(d.momentum_score), dash: STYLES[i % STYLES.length], pts, on: !off.has(d.name) };
  });

  const toggle = (name) =>
    setOff((s) => {
      const n = new Set(s);
      n.has(name) ? n.delete(name) : n.add(name);
      return n;
    });

  if (!series.length)
    return (
      <section className="ch-card">
        <Empty title="Momentum / Trends" msg="Search-interest history is still accruing - check back after the next refresh." />
      </section>
    );

  return (
    <section className="ch-card">
      <header className="ch-head">
        <div>
          <span className="ch-eyebrow">12-month search interest</span>
          <h2 className="ch-title">Momentum - who's accelerating</h2>
          <p className="ch-sub">The six highest-momentum acts, each normalised to its own peak. Movement is the signal, not position.</p>
        </div>
      </header>
      <div className="ch-plot-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} className="ch-svg" role="img" aria-label="Line chart of 12-month search interest for the top six momentum acts">
          {[0, 0.5, 1].map((g) => (
            <line key={g} x1={PL} y1={PT + g * plotH} x2={PL + plotW} y2={PT + g * plotH} className="ch-grid" />
          ))}
          <text x={PL} y={H - 14} className="ch-axis">12 months ago</text>
          <text x={PL + plotW} y={H - 14} className="ch-axis" textAnchor="end">now</text>
          {series.filter((s) => s.on).map((s) => (
            <polyline key={s.name} points={s.pts.map((p) => p.join(",")).join(" ")}
                      fill="none" stroke="var(--accent)" strokeWidth="1.8"
                      strokeDasharray={s.dash} vectorEffect="non-scaling-stroke"
                      strokeLinejoin="round" opacity="0.92" />
          ))}
        </svg>
        <ul className="ch-legend ch-legend--click">
          {series.map((s) => (
            <li key={s.name}>
              <button className={`ch-legbtn ${s.on ? "" : "ch-legbtn--off"}`} onClick={() => toggle(s.name)}
                      aria-pressed={s.on}>
                <svg viewBox="0 0 24 8" width="22" height="8" aria-hidden="true">
                  <line x1="0" y1="4" x2="24" y2="4" stroke="var(--accent)" strokeWidth="1.8" strokeDasharray={s.dash} />
                </svg>
                <span>{s.name}</span>
                <span className="ch-legval">{s.mom.toFixed(0)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// =====================================================================
// 3. RANKINGS  (horizontal bar, top 20)
// =====================================================================
function RankingsBar({ rankings }) {
  const top = useMemo(
    () =>
      rankings
        .slice()
        .sort((a, b) => num(a.rank) - num(b.rank))
        .slice(0, 20),
    [rankings]
  );
  const max = Math.max(...top.map((d) => num(d.score)), 1);

  return (
    <section className="ch-card">
      <header className="ch-head">
        <div>
          <h2 className="ch-title">Top 20 - overall demand</h2>
          <p className="ch-sub">The weighted multi-signal score, sorted descending. Click any bar for the full breakdown.</p>
        </div>
      </header>
      <ol className="ch-bars" aria-label="Top 20 artists by composite score">
        {top.map((d) => (
          <li key={d.name} className="ch-bar-row">
            <a href={`#/artist/${slugify(d.name)}`} className="ch-bar-link">
              <span className="ch-bar-rank">{String(num(d.rank)).padStart(2, "0")}</span>
              <span className="ch-bar-name">{d.name}</span>
              <span className="ch-bar-track">
                <span className="ch-bar-fill" style={{ width: `${(num(d.score) / max) * 100}%` }} />
              </span>
              <span className="ch-bar-val">{num(d.score).toFixed(1)}</span>
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}

// =====================================================================
// 4. SIGNAL PROFILE  (per-artist radar)
// =====================================================================
const RADAR_AXES = [
  ["Live demand", "live_demand_score"],
  ["Scene", "manual_scene_score"],
  ["Beatport", "beatport_score"],
  ["Trends", "google_trends_score"],
  ["Reach", "_reach"],
  ["DJ support", "tl_support_score"],
];

function SignalRadar({ rankings }) {
  const reachOf = useMemo(() => makeNormalizer(rankings, "spotify_monthly_listeners", { log: true }), [rankings]);
  const sorted = useMemo(() => rankings.slice().sort((a, b) => num(a.rank) - num(b.rank)), [rankings]);
  const [name, setName] = useState(() => sorted[0]?.name ?? "");
  const dj = sorted.find((d) => d.name === name) || sorted[0];

  if (!dj) return null;
  const valOf = (key) => (key === "_reach" ? reachOf(dj.spotify_monthly_listeners) : clamp(num(dj[key]), 0, 100));
  const data = RADAR_AXES.map(([label, key]) => ({ label, v: valOf(key) }));

  const W = 380, C = W / 2, R = 130;
  const ang = (i) => (Math.PI * 2 * i) / RADAR_AXES.length - Math.PI / 2;
  const pt = (i, r) => [C + Math.cos(ang(i)) * r, C + Math.sin(ang(i)) * r];
  const poly = data.map((d, i) => pt(i, (d.v / 100) * R).join(",")).join(" ");

  return (
    <section className="ch-card">
      <header className="ch-head">
        <div>
          <h2 className="ch-title">Signal Profile</h2>
          <p className="ch-sub">The shape of one artist's demand across the six leading signals. A table backs the chart below.</p>
        </div>
        <label className="ch-select-wrap">
          <span className="ch-select-label">Artist</span>
          <select className="ch-select" value={name} onChange={(e) => setName(e.target.value)}>
            {sorted.map((d) => (
              <option key={d.name} value={d.name}>#{num(d.rank)} · {d.name}</option>
            ))}
          </select>
        </label>
      </header>
      <div className="ch-radar-wrap">
        <svg viewBox={`0 0 ${W} ${W}`} className="ch-radar" role="img" aria-label={`Radar chart of ${dj.name}'s signal scores`}>
          {[0.25, 0.5, 0.75, 1].map((g) => (
            <polygon key={g} className="ch-grid"
              points={RADAR_AXES.map((_, i) => pt(i, R * g).join(",")).join(" ")} fill="none" />
          ))}
          {RADAR_AXES.map((_, i) => {
            const [x, y] = pt(i, R);
            return <line key={i} x1={C} y1={C} x2={x} y2={y} className="ch-grid" />;
          })}
          <polygon points={poly} fill="rgba(200,247,80,0.18)" stroke="var(--accent)" strokeWidth="1.8" />
          {data.map((d, i) => {
            const [x, y] = pt(i, (d.v / 100) * R);
            return <circle key={i} cx={x} cy={y} r="3" fill="var(--accent)" />;
          })}
          {RADAR_AXES.map(([label], i) => {
            const [x, y] = pt(i, R + 18);
            return (
              <text key={label} x={x} y={y} className="ch-radar-label"
                    textAnchor={Math.abs(x - C) < 8 ? "middle" : x > C ? "start" : "end"}>{label}</text>
            );
          })}
        </svg>
        <DataTable
          compact
          caption={`${dj.name} - signal scores`}
          cols={["Signal", "Score"]}
          rows={data.map((d) => [d.label, d.v.toFixed(0)])}
        />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------
function DataTable({ caption, cols, rows, compact }) {
  return (
    <div className={`ch-table-wrap ${compact ? "ch-table-wrap--compact" : ""}`}>
      <table className="ch-table">
        <caption className="ch-sr">{caption}</caption>
        <thead>
          <tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{r.map((cell, j) => <td key={j} className={j === 1 && !compact ? "ch-td-name" : ""}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Empty({ title, msg }) {
  return (
    <>
      <h2 className="ch-title">{title}</h2>
      <p className="ch-empty">{msg}</p>
    </>
  );
}

function median(arr) {
  if (!arr.length) return 50;
  const s = arr.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// ---------------------------------------------------------------------------
export default function ChartsPage({ rankings }) {
  if (!Array.isArray(rankings) || !rankings.length) {
    return <div className="state-msg"><div className="spinner" />Loading charts…</div>;
  }
  return (
    <div className="ch-page">
      <div className="ch-intro">
        <h1 className="ch-h1">Charts</h1>
        <p className="ch-lede">The Index, read visually - where demand sits, who's moving, and the shape of each act's signals.</p>
      </div>
      <ReachCredChart rankings={rankings} />
      <TrendsChart rankings={rankings} />
      <RankingsBar rankings={rankings} />
      <SignalRadar rankings={rankings} />
    </div>
  );
}
