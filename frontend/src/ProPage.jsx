import { useState, useMemo } from "react";
import "./ProPage.css";
import { openMomentumReport } from "./momentumReport";
import { ArtistLink } from "./ArtistProfile";
import { LockCard } from "./Paywall";
import { useTier } from "./usePro";

// a11y: make a non-button element keyboard-activatable (Enter/Space) and focusable.
const pressable = (handler, opts = {}) => ({
  role: "button",
  tabIndex: 0,
  onClick: handler,
  onKeyDown: e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handler(e); } },
  ...opts,
});

// ── Static enrichment ────────────────────────────────────────────
const ARTIST_META = {
  "FISHER":                { city: "Sydney",       region: "Oceania",  genres: ["Tech House"],               agency: "WME",           booking: "booking@wmeglobal.com"         },
  "Chris Lake":            { city: "London",       region: "UK",       genres: ["Tech House","Deep House"],  agency: "Paradigm",      booking: "chrislake@paradigmagency.com"  },
  "John Summit":           { city: "Chicago",      region: "US",       genres: ["Tech House","House"],       agency: "UTA",           booking: "johnsummit@utamusic.com"       },
  "Fred Again":            { city: "London",       region: "UK",       genres: ["House","UK Garage"],        agency: "WME",           booking: "fredagain@wmeglobal.com"       },
  "Four Tet":              { city: "London",       region: "UK",       genres: ["Electronic","House"],       agency: "Independent",   booking: null                            },
  "Disclosure":            { city: "London",       region: "UK",       genres: ["UK House","Deep House"],    agency: "Columbia",      booking: "disclosure@columbiabooking.com"},
  "Peggy Gou":             { city: "Berlin",       region: "Europe",   genres: ["Tech House","Italo"],       agency: "Independent",   booking: null                            },
  "Black Coffee":          { city: "Johannesburg", region: "Africa",   genres: ["Afro House","Deep House"],  agency: "WME",           booking: "blackcoffee@wmeglobal.com"     },
  "Solomun":               { city: "Hamburg",      region: "Europe",   genres: ["Deep House","Melodic"],     agency: "Diynamic",      booking: "booking@diynamic-music.com"    },
  "Tale Of Us":            { city: "Milan",        region: "Europe",   genres: ["Melodic","House"],          agency: "Afterlife",     booking: "booking@afterlife.it"          },
  "Bicep":                 { city: "London",       region: "UK",       genres: ["House","Electronic"],       agency: "Ninja Tune",    booking: null                            },
  "Honey Dijon":           { city: "Chicago",      region: "US",       genres: ["House","Disco"],            agency: "Classic Music", booking: null                            },
  "Jamie Jones":           { city: "Barcelona",    region: "Europe",   genres: ["Tech House"],               agency: "Hot Creations", booking: "booking@hotcreations.com"      },
  "Charlotte de Witte":    { city: "Ghent",        region: "Europe",   genres: ["Techno"],                   agency: "Independent",   booking: null                            },
  "Adam Beyer":            { city: "Stockholm",    region: "Europe",   genres: ["Techno"],                   agency: "Drumcode",      booking: "booking@drumcode.se"           },
  "Gorgon City":           { city: "London",       region: "UK",       genres: ["UK House","Deep House"],    agency: "Positiva",      booking: "gorgoncity@positiva.com"       },
  "The Martinez Brothers": { city: "New York",     region: "US",       genres: ["Tech House","Deep House"],  agency: "Cuttin' Headz", booking: null                            },
  "Hot Since 82":          { city: "Leeds",        region: "UK",       genres: ["Tech House","Deep House"],  agency: "Knee Deep",     booking: "booking@kneedeepin.com"        },
  "Seth Troxler":          { city: "Detroit",      region: "US",       genres: ["Deep House","Techno"],      agency: "Tuskegee",      booking: null                            },
  "Michael Bibi":          { city: "London",       region: "UK",       genres: ["Tech House"],               agency: "Solid Grooves", booking: "booking@solidgrooves.co.uk"    },
  "ANOTR":                 { city: "Amsterdam",    region: "Europe",   genres: ["Tech House"],               agency: "Rejected",      booking: "anotr@rejectedmusic.com"       },
  "Mau P":                 { city: "Amsterdam",    region: "Europe",   genres: ["Tech House"],               agency: "Rejected",      booking: "maup@rejectedmusic.com"        },
  "SIDEPIECE":             { city: "Los Angeles",  region: "US",       genres: ["Tech House"],               agency: "Insomniac",     booking: "sidepiece@insomniac.com"       },
  "Chris Stussy":          { city: "Amsterdam",    region: "Europe",   genres: ["Deep House","House"],       agency: "Technicolour",  booking: null                            },
  "PAWSA":                 { city: "London",       region: "UK",       genres: ["Tech House"],               agency: "Kaluki",        booking: "booking@kalukimusic.com"       },
  "Carlita":               { city: "Istanbul",     region: "Europe",   genres: ["House","Melodic"],          agency: "Innervisions",  booking: null                            },
  "East End Dubs":         { city: "London",       region: "UK",       genres: ["Tech House","Deep House"],  agency: "EED",           booking: null                            },
  "Josh Baker":            { city: "London",       region: "UK",       genres: ["Tech House"],               agency: "Solid Grooves", booking: "joshbaker@solidgrooves.co.uk"  },
  "Franky Rizardo":        { city: "Amsterdam",    region: "Europe",   genres: ["Tech House"],               agency: "Rejected",      booking: null                            },
  "Ben Sterling":          { city: "London",       region: "UK",       genres: ["Tech House","House"],       agency: "Toolroom",      booking: null                            },
  "Disco Lines":           { city: "New York",     region: "US",       genres: ["Tech House","House"],       agency: "Independent",   booking: null                            },
  "Chris Lorenzo":         { city: "London",       region: "UK",       genres: ["Tech House","UK Bass"],     agency: "Black Book",    booking: null                            },
  "KETTAMA":               { city: "London",       region: "UK",       genres: ["Tech House"],               agency: "Skint",         booking: null                            },
  "Cloonee":               { city: "London",       region: "UK",       genres: ["Tech House"],               agency: "Skint",         booking: null                            },
  "Ranger Trucco":         { city: "Buenos Aires", region: "Americas", genres: ["Tech House"],               agency: "Independent",   booking: null                            },
  "Massano":               { city: "Turin",        region: "Europe",   genres: ["Melodic","House"],          agency: "Afterlife",     booking: null                            },
  "Alisha":                { city: "London",       region: "UK",       genres: ["Tech House","House"],       agency: "Independent",   booking: null                            },
  "Prospa":                { city: "London",       region: "UK",       genres: ["Tech House","House"],       agency: "Independent",   booking: null                            },
  "Dennis Cruz":           { city: "Barcelona",    region: "Europe",   genres: ["Tech House"],               agency: "Independent",   booking: null                            },
  "Omar+":                 { city: "London",       region: "UK",       genres: ["Tech House","Deep House"],  agency: "Independent",   booking: null                            },
  "Beltran":               { city: "Madrid",       region: "Europe",   genres: ["Tech House"],               agency: "Independent",   booking: null                            },
  "Rossi.":                { city: "London",       region: "UK",       genres: ["Tech House"],               agency: "Toolroom",      booking: null                            },
  "Luke Dean":             { city: "London",       region: "UK",       genres: ["Tech House"],               agency: "Independent",   booking: null                            },
  "Max Dean":              { city: "London",       region: "UK",       genres: ["Tech House"],               agency: "Independent",   booking: null                            },
  "Julian Fijma":          { city: "Amsterdam",    region: "Europe",   genres: ["Tech House"],               agency: "Rejected",      booking: null                            },
  "MALUGI":                { city: "London",       region: "UK",       genres: ["Tech House"],               agency: "Independent",   booking: null                            },
  "Silva Bumpa":           { city: "London",       region: "UK",       genres: ["Tech House"],               agency: "Independent",   booking: null                            },
  "Discip":                { city: "Amsterdam",    region: "Europe",   genres: ["Tech House"],               agency: "Independent",   booking: null                            },
  "AYYBO":                 { city: "Stockholm",    region: "Europe",   genres: ["Tech House"],               agency: "Independent",   booking: null                            },
  "Max Styler":            { city: "Los Angeles",  region: "US",       genres: ["Tech House"],               agency: "Independent",   booking: null                            },
  "Riordan":               { city: "London",       region: "UK",       genres: ["Tech House"],               agency: "Independent",   booking: null                            },
  "Locklead":              { city: "London",       region: "UK",       genres: ["Tech House"],               agency: "Independent",   booking: null                            },
  "Obskür":               { city: "Barcelona",    region: "Europe",   genres: ["Tech House"],               agency: "Independent",   booking: null                            },
  "Kolter":                { city: "London",       region: "UK",       genres: ["Tech House"],               agency: "Independent",   booking: null                            },
  "Murphy's Law":          { city: "London",       region: "UK",       genres: ["Tech House"],               agency: "Independent",   booking: null                            },
  "Roddy Lima":            { city: "Porto",        region: "Europe",   genres: ["Tech House"],               agency: "Independent",   booking: null                            },
};

function getMeta(name) {
  return ARTIST_META[name] ?? { city: "Global", region: "Global", genres: ["Electronic"], agency: "Independent", booking: null };
}

// ── Booking fee tiers ────────────────────────────────────────────
function getFeeTier(rank) {
  if (rank <= 3)  return { label: "£20K–£50K+", tier: 5, mid: 35000, color: "#f59e0b" };
  if (rank <= 8)  return { label: "£8K–£20K",   tier: 4, mid: 14000, color: "#3b82f6" };
  if (rank <= 15) return { label: "£3K–£8K",    tier: 3, mid: 5500,  color: "#8b5cf6" };
  if (rank <= 30) return { label: "£1K–£3K",    tier: 2, mid: 2000,  color: "var(--accent)" };
  return           { label: "£500–£1.5K",        tier: 1, mid: 1000,  color: "var(--muted)" };
}

function getVenueFit(rank) {
  if (rank <= 3)  return { label: "Festival / Arena", sub: "5,000+ capacity",  icon: "🏟" };
  if (rank <= 8)  return { label: "Large Club",        sub: "1,000–5,000 cap", icon: "🔊" };
  if (rank <= 15) return { label: "Mid Club",           sub: "500–1,000 cap",  icon: "🎛" };
  if (rank <= 30) return { label: "Club",               sub: "200–500 cap",    icon: "🎶" };
  return           { label: "Emerging Venue",           sub: "Under 200 cap",  icon: "⭐" };
}

// ── Geographic interest ──────────────────────────────────────────
// (computeMarkets / REGION_DEFAULTS removed — geography is now real per-artist
//  data: Google Trends countries + RA booking markets, see GeographicInterest.)

// ── Momentum scores ──────────────────────────────────────────────
function computeMomentumScores(rankings) {
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
  return rankings.map(dj => {
    const growth = norm(dj.spotify_follower_growth_rate || 0, "spotify_follower_growth_rate");
    const tiktok = norm(dj.tiktok_post_count || 0, "tiktok_post_count");
    const trends = norm(dj.google_trends_score || 0, "google_trends_score");
    const rankMo = dj.rank_change ? Math.min(Math.max(dj.rank_change * 8, 0), 100) : 40;
    const fallbackMo = Math.round(growth * 0.35 + tiktok * 0.25 + trends * 0.25 + rankMo * 0.15);
    return {
      ...dj,
      momentum: Number.isFinite(dj.momentum_score) ? dj.momentum_score : fallbackMo,
      meta:     getMeta(dj.name),
      feeTier:  dj.booking_fee ?? getFeeTier(dj.rank),
      venueFit: getVenueFit(dj.rank),
    };
  });
}

function fmt(n) {
 if (!n) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

const REGIONS    = ["All","UK","Europe","US","Americas","Oceania","Africa","Global"];
const ALL_GENRES = ["All","Tech House","Deep House","House","UK House","Afro House","Melodic","Electronic"];

// ── CSV export ───────────────────────────────────────────────────
function exportCSV(artists) {
  const headers = ["Name","Rank","City","Agency","Fee Estimate","Venue Fit","Momentum","Booking Contact","Spotify Followers","Monthly Listeners"];
  const rows = artists.map(dj => [
    dj.name, dj.rank, dj.meta.city, dj.meta.agency,
    dj.feeTier.label, dj.venueFit.label, dj.momentum,
    dj.meta.booking || "Unclaimed",
    dj.spotify_followers || 0, dj.spotify_monthly_listeners || 0,
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })),
    download: `thedjranks-shortlist-${new Date().toISOString().slice(0, 10)}.csv`,
  });
  a.click();
}

// ── Momentum bar ─────────────────────────────────────────────────
function MomentumBar({ score }) {
  const color = score >= 70 ? "#4ade80" : score >= 40 ? "var(--accent)" : "var(--muted)";
  return (
    <div className="momentum-bar-wrap">
      <div className="momentum-bar-track">
        <div className="momentum-bar-fill" style={{ transform: `scaleX(${Math.max(0, Math.min(100, score)) / 100})`, background: color }} />
      </div>
      <span className="momentum-score" style={{ color }}>{score}</span>
    </div>
  );
}

// ── Geographic interest ──────────────────────────────────────────
function TrendSparkline({ dj }) {
  const series = dj.trends_12m;
  if (!Array.isArray(series) || series.length < 4) return null;

  const W = 280, H = 64, pad = 4;
  const max = Math.max(...series, 1);
  const pts = series.map((v, i) => {
    const x = pad + (i / (series.length - 1)) * (W - pad * 2);
    const y = H - pad - (v / max) * (H - pad * 2);
    return [x, y];
  });
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${pad},${H - pad} ${line} ${(W - pad).toFixed(1)},${H - pad}`;

  const mom = dj.trends_mom_12w;
  const dir = dj.google_trends_direction;
  const momColor = mom > 0 ? "#4caf50" : mom < 0 ? "#e74c3c" : "#888";
  const stroke = dir === "up" ? "#4caf50" : dir === "down" ? "#e74c3c" : "var(--accent)";

  return (
    <div className="detail-section" style={{ marginTop: 20 }}>
      <div className="detail-section-title">
 Search Interest, 12 Months
        {mom != null && mom !== 0 && (
          <span style={{ color: momColor, marginLeft: 8, fontSize: "0.78rem", fontWeight: 700 }}>
            {mom > 0 ? "▲" : "▼"} {Math.abs(mom).toFixed(0)}% vs prior qtr
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="trend-spark" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`tg-${dj.rank}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor={stroke} stopOpacity="0.35" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill={`url(#tg-${dj.rank})`} />
        <polyline points={line} fill="none" stroke={stroke} strokeWidth="2"
          strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="trend-spark-foot">
        <span>12 mo ago</span>
        <span>Peak {dj.trends_peak ?? max}</span>
        <span>now</span>
      </div>
    </div>
  );
}

function GeographicInterest({ dj }) {
  // Real, per-artist geography only — no hardcoded regional defaults.
  const countries = dj?.google_trends_countries ?? {};
  const raCountries = Array.isArray(dj?.ra_country_list) ? dj.ra_country_list : [];
  const direction = dj?.google_trends_direction ?? "stable";
  const hasSearch = Object.keys(countries).length > 0;
  const hasTour   = raCountries.length > 0;

  const dirColor = direction === "up" ? "#4caf50" : direction === "down" ? "#e74c3c" : "#888";
  const dirLabel = direction === "up" ? "▲ Rising" : direction === "down" ? "▼ Falling" : "→ Stable";

  return (
    <div className="geo-interest">
      <div className="geo-title">
        Geographic Demand
        {hasSearch && (
          <span className="geo-direction" style={{ color: dirColor, marginLeft: 10, fontSize: "0.8rem" }}>
            {dirLabel} this week
          </span>
        )}
      </div>

      {hasSearch && (
        <div className="geo-breakdown">
          <div className="geo-breakdown-title">🌍 Search interest by country</div>
          {Object.entries(countries).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([country, score]) => (
            <div key={country} className="geo-row">
              <span className="geo-region">{country}</span>
              <div className="geo-bar-track">
                <div className="geo-bar-fill" style={{
                  transform: `scaleX(${Math.max(0, Math.min(100, score)) / 100})`,
                  background: score >= 70 ? "var(--accent)" : score >= 40 ? "color-mix(in srgb, var(--accent) 55%, var(--muted))" : "var(--muted)",
                }} />
              </div>
              <span className="geo-score">{score}</span>
            </div>
          ))}
        </div>
      )}

      {hasTour && (
        <div className="geo-breakdown">
          <div className="geo-breakdown-title">🎫 Recent booking markets (Resident Advisor)</div>
          <div className="geo-chips">
            {raCountries.slice(0, 12).map(c => <span key={c} className="geo-chip">{c}</span>)}
          </div>
        </div>
      )}

      {!hasSearch && !hasTour && (
        <div className="geo-empty">Geographic demand builds as Google Trends &amp; Resident Advisor data resolve for this artist.</div>
      )}

      <div className="geo-note">
 {hasSearch ? "Live per-artist Google Trends + RA booking data" : hasTour ? "Live Resident Advisor booking markets" : "No fabricated defaults, real data only"}
      </div>
    </div>
  );
}

// ── Artist detail panel ──────────────────────────────────────────
function ArtistDetailPanel({ dj, inShortlist, onToggleShortlist, onClose, allArtists }) {
  const claimed = !!dj.meta.booking;
  const stats = [
    { label: "Monthly Listeners", value: fmt(dj.spotify_monthly_listeners) },
    { label: "Spotify Followers", value: fmt(dj.spotify_followers) },
    { label: "YouTube Subs",      value: fmt(dj.youtube_subscribers) },
    { label: "TikTok Posts",      value: fmt(dj.tiktok_post_count) },
 { label: "Google Trends", value: dj.google_trends_score ? `${Math.round(dj.google_trends_score)}/100` : "—" },
 { label: "Listener Growth", value: dj.spotify_follower_growth_rate ? `${dj.spotify_follower_growth_rate >= 0 ? "+" : ""}${dj.spotify_follower_growth_rate.toFixed(1)}%` : "—" },
    { label: "Mixcloud Followers", value: fmt(dj.mixcloud_followers) },
    { label: "Mixcloud Plays",    value: fmt(dj.mixcloud_play_count_total) },
 { label: "Beatport Score", value: dj.beatport_score ? `${dj.beatport_score}/100` : "—" },
 { label: "Beatport Best Pos", value: dj.beatport_best_position ? `#${dj.beatport_best_position}` : "—" },
 { label: "Upcoming Shows", value: dj.tour_upcoming ? `${dj.tour_upcoming}${dj.tour_upcoming_capped ? "+" : ""}` : "—" },
 { label: "Touring Countries", value: dj.tour_countries || "—" },
  ];
  return (
    <div className="artist-detail-panel">
      <button className="detail-close" onClick={onClose}>✕</button>

      <div className="detail-header">
        <div className="detail-avatar">
          {dj.image
            ? <img src={dj.image} alt={dj.name} />
            : <div className="detail-avatar-placeholder">{dj.name[0]}</div>
          }
        </div>
        <div className="detail-header-info">
          <div className="detail-name"><ArtistLink name={dj.name} /></div>
          <div className="detail-meta-line">
            {dj.meta.city} · {dj.meta.agency}
            {claimed && <span className="claimed-badge">Claimed</span>}
          </div>
          <div className="detail-genres">
            {dj.meta.genres.map(g => <span key={g} className="genre-tag">{g}</span>)}
          </div>
          <div className="detail-rank-row">
            <span className="detail-rank">#{dj.rank}</span>
            {dj.rank_change != null && dj.rank_change !== 0 && (
              <span className={`detail-delta ${dj.rank_change > 0 ? "up" : "down"}`}>
                {dj.rank_change > 0 ? `▲${dj.rank_change}` : `▼${Math.abs(dj.rank_change)}`} this week
              </span>
            )}
            <span className="detail-score">{dj.score} pts</span>
          </div>
        </div>
      </div>

      <div className="detail-body">
        <div className="detail-col">
          <div className="detail-section">
            <div className="detail-section-title">Booking Estimate</div>
            <div className="fee-display">
              <div className="fee-amount" style={{ color: dj.feeTier.color }}>{dj.feeTier.label}</div>
              <div className="fee-sub">Est. club / festival fee · per show</div>
              <div className="fee-dots">
                {[1,2,3,4,5].map(t => (
                  <div key={t} className={`fee-dot ${t <= dj.feeTier.tier ? "fee-dot--on" : ""}`}
                    style={t <= dj.feeTier.tier ? { background: dj.feeTier.color } : undefined} />
                ))}
              </div>
            </div>
            <div className="venue-fit">
              <span className="venue-icon">{dj.venueFit.icon}</span>
              <div>
                <div className="venue-label">{dj.venueFit.label}</div>
                <div className="venue-sub">{dj.venueFit.sub}</div>
              </div>
            </div>
          </div>

          <div className="detail-section">
            <div className="detail-section-title">Momentum</div>
            <div className="detail-momentum-big" style={{
              color: dj.momentum >= 70 ? "#4ade80" : dj.momentum >= 40 ? "var(--accent)" : "var(--muted)"
            }}>
              {dj.momentum}<span>/100</span>
            </div>
            <MomentumBar score={dj.momentum} />
          </div>

          <div className="detail-section">
            <div className="detail-section-title">Booking Contact</div>
            {claimed ? (
              <a href={`mailto:${dj.meta.booking}`} className="detail-contact-btn">✉ {dj.meta.booking}</a>
            ) : (
 <div className="detail-unclaimed">Profile unclaimed, <a href="#">Invite artist</a></div>
            )}
            {dj.spotify_url && (
              <a href={dj.spotify_url} target="_blank" rel="noreferrer" className="detail-spotify-link">Open on Spotify ↗</a>
            )}
          </div>
        </div>

        <div className="detail-col">
          <GeographicInterest dj={dj} />

          <div className="detail-section" style={{ marginTop: 20 }}>
            <div className="detail-section-title">Key Metrics</div>
            <div className="detail-stats-grid">
              {stats.map(s => (
                <div key={s.label} className="detail-stat-cell">
                  <div className="detail-stat-val">{s.value}</div>
                  <div className="detail-stat-label">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          <TrendSparkline dj={dj} />
        </div>
      </div>

      <div className="detail-footer">
        <button
          className={`shortlist-btn ${inShortlist ? "shortlist-btn--active" : ""}`}
          onClick={() => onToggleShortlist(dj)}
        >
          {inShortlist ? "★ In Shortlist" : "☆ Add to Shortlist"}
        </button>
        <button className="report-btn" onClick={() => openMomentumReport(dj, allArtists || [])}>
          ⬇ Generate Momentum Report <span className="report-pro">PRO</span>
        </button>
      </div>
    </div>
  );
}

// ── Booker artist row ────────────────────────────────────────────
function BookerArtistRow({ dj, rank, active, inShortlist, onClick, onToggleShortlist }) {
  return (
    <div className={`booker-row ${active ? "booker-row--active" : ""}`} onClick={onClick}>
      <div className="booker-rank">
        <span className="booker-rank-num">#{rank ?? dj.rank}</span>
        {dj.rank_change != null && dj.rank_change !== 0 && (
          <span className={`booker-delta ${dj.rank_change > 0 ? "up" : "down"}`}>
            {dj.rank_change > 0 ? `▲${dj.rank_change}` : `▼${Math.abs(dj.rank_change)}`}
          </span>
        )}
      </div>
      <div className="booker-avatar">
        {dj.image ? <img src={dj.image} alt={dj.name} /> : <div className="booker-placeholder">{dj.name[0]}</div>}
      </div>
      <div className="booker-info">
        <div className="booker-name">
          <span className="booker-name-text"><ArtistLink name={dj.name} /></span>
          {dj.meta.booking && <span className="claimed-badge">Claimed</span>}
        </div>
        <div className="booker-meta">
          <span>{dj.meta.city}</span>
          {dj.meta.genres.slice(0, 2).map(g => <span key={g} className="genre-tag">{g}</span>)}
        </div>
      </div>
      <div className="booker-fee" style={{ color: dj.feeTier.color }}>{dj.feeTier.label}</div>
      <div className="booker-momentum"><MomentumBar score={dj.momentum} /></div>
      <div className="booker-star">
        <button
          className={`star-btn ${inShortlist ? "star-btn--on" : ""}`}
          aria-pressed={inShortlist}
          aria-label={`${inShortlist ? "Remove" : "Add"} ${dj.name} ${inShortlist ? "from" : "to"} shortlist`}
          onClick={e => { e.stopPropagation(); onToggleShortlist(dj); }}
        >
          {inShortlist ? "★" : "☆"}
        </button>
      </div>
    </div>
  );
}

// ── Shortlist tray ───────────────────────────────────────────────
function ShortlistTray({ shortlist, onRemove, onClear, onExport }) {
  const total = shortlist.reduce((s, d) => s + d.feeTier.mid, 0);
  const fmtBudget = n => n >= 1000 ? `£${(n / 1000).toFixed(0)}K` : `£${n}`;
  if (!shortlist.length) return null;
  return (
    <div className="shortlist-tray">
      <div className="shortlist-tray-header">
        <span className="shortlist-tray-title">Shortlist ({shortlist.length})</span>
        <div className="shortlist-tray-btns">
          <button className="tray-btn" onClick={onExport}>Export CSV</button>
          <button className="tray-btn tray-btn--clear" onClick={onClear}>Clear all</button>
        </div>
      </div>
      <div className="shortlist-chips">
        {shortlist.map(dj => (
          <div key={dj.name} className="shortlist-chip">
            <span className="chip-name">{dj.name}</span>
            <span className="chip-fee" style={{ color: dj.feeTier.color }}>{dj.feeTier.label}</span>
            <button className="chip-remove" onClick={() => onRemove(dj.name)}>✕</button>
          </div>
        ))}
      </div>
      <div className="shortlist-budget">
        <span className="budget-label">Estimated lineup cost</span>
        <span className="budget-total">
          {fmtBudget(total)}
          <span className="budget-note"> mid-range estimate</span>
        </span>
      </div>
    </div>
  );
}

// ── Booker dashboard ─────────────────────────────────────────────
function BookerDashboard({ enriched }) {
  const [region,    setRegion]    = useState("All");
  const [genre,     setGenre]     = useState("All");
  const [sortBy,    setSortBy]    = useState("momentum");
  const [search,    setSearch]    = useState("");
  const [activeRow, setActiveRow] = useState(null);
  const [shortlist, setShortlist] = useState([]);
  const { unlocked } = useTier("allaccess");

  function toggleShortlist(dj) {
    setShortlist(prev =>
      prev.some(d => d.name === dj.name) ? prev.filter(d => d.name !== dj.name) : [...prev, dj]
    );
  }

  const filtered = useMemo(() => {
    let list = enriched;
    if (region !== "All") list = list.filter(d => d.meta.region === region);
    if (genre  !== "All") list = list.filter(d => d.meta.genres.includes(genre));
    if (search.trim())    list = list.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));
    return [...list].sort((a, b) =>
      sortBy === "momentum" ? b.momentum - a.momentum :
      sortBy === "rank"     ? a.rank - b.rank :
      sortBy === "rising"   ? (b.rank_change ?? 0) - (a.rank_change ?? 0) :
      sortBy === "fee"      ? b.feeTier.tier - a.feeTier.tier : 0
    );
  }, [enriched, region, genre, sortBy, search]);

  const risingTalent = useMemo(() =>
    [...enriched].filter(d => d.rank > 15 && d.momentum > 50)
      .sort((a, b) => b.momentum - a.momentum).slice(0, 5)
  , [enriched]);

  const activeArtist = activeRow
    ? (filtered.find(d => d.name === activeRow) ?? enriched.find(d => d.name === activeRow))
    : null;

  return (
    <div className="booker-dashboard">
      {risingTalent.length > 0 && (
        <section className="rising-section">
          <div className="pro-section-eyebrow">Rising Talent Spotlight</div>
          <div className="rising-strip">
            {risingTalent.map(dj => (
              <div key={dj.name} className="rising-card" {...pressable(() => setActiveRow(dj.name), { "aria-label": `Select ${dj.name}` })}>
                <div className="rising-avatar">
                  {dj.image ? <img src={dj.image} alt={dj.name} /> : <div className="rising-placeholder">{dj.name[0]}</div>}
                </div>
                <div className="rising-name">{dj.name}</div>
                <div className="rising-rank">#{dj.rank}</div>
                <div className="rising-mo-score" style={{ color: dj.momentum >= 70 ? "#4ade80" : "var(--accent)" }}>{dj.momentum}</div>
                <div className="rising-city">{dj.meta.city}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="booker-controls">
        <input className="booker-search" placeholder="Search artist…" value={search} onChange={e => setSearch(e.target.value)} />
        <div className="filter-row">
          <div className="filter-group">
            <span className="filter-label">Region</span>
            {REGIONS.map(r => (
              <button key={r} className={`filter-btn ${region === r ? "filter-btn--active" : ""}`} onClick={() => setRegion(r)}>{r}</button>
            ))}
          </div>
          <div className="filter-group">
            <span className="filter-label">Genre</span>
            {ALL_GENRES.map(g => (
              <button key={g} className={`filter-btn ${genre === g ? "filter-btn--active" : ""}`} onClick={() => setGenre(g)}>{g}</button>
            ))}
          </div>
          <div className="filter-group">
            <span className="filter-label">Sort</span>
            {[
              { key: "momentum", label: "Momentum" },
              { key: "rank",     label: "Rank"     },
              { key: "rising",   label: "Rising"   },
              { key: "fee",      label: "Fee Tier" },
            ].map(s => (
              <button key={s.key} className={`filter-btn ${sortBy === s.key ? "filter-btn--active" : ""}`} onClick={() => setSortBy(s.key)}>{s.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className={`booker-main ${activeArtist ? "booker-main--split" : ""}`}>
        <div className="booker-list">
          <div className="booker-list-header">
            <span>Artist</span><span /><span />
            <span>Fee Est.</span>
            <span>Momentum</span>
            <span />
          </div>
          {(unlocked ? filtered : filtered.slice(0, 2)).map((dj, i) => (
            <BookerArtistRow
              key={dj.name}
              dj={dj}
              rank={i + 1}
              active={activeRow === dj.name}
              inShortlist={shortlist.some(d => d.name === dj.name)}
              onClick={() => setActiveRow(activeRow === dj.name ? null : dj.name)}
              onToggleShortlist={toggleShortlist}
            />
          ))}
          {!filtered.length && <div className="booker-empty">No artists match your filters</div>}
          {!unlocked && filtered.length > 2 && (
            <div className="booker-lock">
              <p className="booker-lock-note">
                Two live examples are open above — and here's a full example artefact:{" "}
                <a href="/reports/mau-p.html" target="_blank" rel="noopener">the Mau&nbsp;P deep-dive report</a>.
                Deep Dive on the whole roster, plus every paid feature, is part of All Access.
              </p>
              <LockCard tier="allaccess" source="deep-dive-booker"
                headline="Open the full Deep Dive"
                sub="Filter, shortlist and export the entire roster — booker dashboard, artist portal, fee estimates and momentum reads on every act."
                hiddenCount={filtered.length - 2} />
            </div>
          )}
        </div>

        {activeArtist && (
          <ArtistDetailPanel
            dj={activeArtist}
            allArtists={enriched}
            inShortlist={shortlist.some(d => d.name === activeArtist.name)}
            onToggleShortlist={toggleShortlist}
            onClose={() => setActiveRow(null)}
          />
        )}
      </div>

      <ShortlistTray
        shortlist={shortlist}
        onRemove={name => setShortlist(prev => prev.filter(d => d.name !== name))}
        onClear={() => setShortlist([])}
        onExport={() => exportCSV(shortlist)}
      />
    </div>
  );
}

// ── Artist portal ────────────────────────────────────────────────
function ArtistPortal({ enriched }) {
  const [query,    setQuery]    = useState("");
  const [selected, setSelected] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [form,     setForm]     = useState({ bio: "", booking: "", presskit: "", rider: "" });

  const results = useMemo(() =>
    query.length < 2 ? [] : enriched.filter(d => d.name.toLowerCase().includes(query.toLowerCase())).slice(0, 6)
  , [enriched, query]);

  function select(dj) {
    setSelected(dj);
    setQuery(dj.name);
    setForm({ bio: "", booking: dj.meta.booking ?? "", presskit: "", rider: "" });
    setEditMode(false);
  }

  const claimed = selected && !!selected.meta.booking;

  return (
    <div className="artist-portal">
      <div className="portal-search-wrap">
        <input
          className="portal-search"
          placeholder="Search your artist name…"
          value={query}
          onChange={e => { setQuery(e.target.value); setSelected(null); }}
        />
        {results.length > 0 && !selected && (
          <div className="portal-results">
            {results.map(dj => (
              <button key={dj.name} className="portal-result-row" onClick={() => select(dj)}>
                {dj.image ? <img src={dj.image} alt={dj.name} className="portal-result-avatar" /> : <div className="portal-result-initial">{dj.name[0]}</div>}
                <span className="portal-result-name">{dj.name}</span>
                <span className="portal-result-rank">#{dj.rank}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="portal-profile">
          <div className="portal-profile-header">
            <div className="portal-avatar-wrap">
              {selected.image
                ? <img src={selected.image} alt={selected.name} className="portal-avatar" />
                : <div className="portal-avatar portal-avatar--placeholder">{selected.name[0]}</div>
              }
            </div>
            <div>
              <div className="portal-artist-name">{selected.name}</div>
              <div className="portal-artist-meta">{selected.meta.city} · {selected.meta.genres.join(", ")}</div>
              <div className="portal-stats-row">
                {[
                  { label: "Rank",     value: `#${selected.rank}` },
                  { label: "Score",    value: `${selected.score} pts` },
                  { label: "Momentum", value: selected.momentum, accent: true },
...(selected.rank_change != null ? [{ label: "This week", value: selected.rank_change > 0 ? `▲${selected.rank_change}` : selected.rank_change < 0 ? `▼${Math.abs(selected.rank_change)}` : "—", delta: selected.rank_change }] : []),
                ].map((s, i) => (
                  <span key={i} className="portal-stat">
                    <span className="portal-stat-label">{s.label}</span>
                    <span className={`portal-stat-value ${s.accent ? "up" : s.delta > 0 ? "up" : s.delta < 0 ? "down" : ""}`}>{s.value}</span>
                  </span>
                ))}
              </div>
            </div>
            <div className={`claim-status ${claimed ? "claim-status--claimed" : "claim-status--unclaimed"}`}>
              {claimed ? "Profile Claimed" : "Profile Unclaimed"}
            </div>
          </div>

          {!claimed && !editMode && (
            <div className="claim-prompt">
              <div className="claim-prompt-title">Claim this profile</div>
              <p className="claim-prompt-body">Claiming your profile lets bookers find and contact you directly from the Deep Dive dashboard.</p>
              <ul className="claim-checklist">
                <li className={form.booking  ? "done" : ""}>Booking contact email</li>
                <li className={form.bio      ? "done" : ""}>Artist bio</li>
                <li className={form.presskit ? "done" : ""}>Press kit link</li>
                <li className={form.rider    ? "done" : ""}>Technical rider</li>
              </ul>
              <button className="claim-btn" onClick={() => setEditMode(true)}>Claim Profile</button>
            </div>
          )}

          {(claimed || editMode) && (
            <div className="portal-form">
              <div className="pro-section-eyebrow" style={{ marginBottom: 16 }}>Profile Details</div>
              {[
                { key: "booking",  label: "Booking Email",  type: "input",    placeholder: "booking@youragency.com" },
                { key: "bio",      label: "Artist Bio",     type: "textarea", placeholder: "Write a short bio (200 words max)…" },
                { key: "presskit", label: "Press Kit URL",  type: "input",    placeholder: "https://dropbox.com/your-presskit" },
                { key: "rider",    label: "Technical Rider",type: "input",    placeholder: "https://dropbox.com/your-rider" },
              ].map(f => (
                <div key={f.key} className="form-row">
                  <label>{f.label}</label>
                  {f.type === "textarea"
                    ? <textarea className="form-input form-textarea" placeholder={f.placeholder} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
                    : <input className="form-input" placeholder={f.placeholder} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
                  }
                </div>
              ))}
              <button className="form-save-btn" onClick={() => setEditMode(false)}>
                {claimed ? "Save Changes" : "Submit & Claim Profile"}
              </button>
            </div>
          )}
        </div>
      )}

      {!selected && !query && (
        <div className="portal-empty">
          <div className="portal-empty-title">Are you an artist or manager?</div>
          <p className="portal-empty-body">Search for your artist above to claim your profile and start receiving booking inquiries from promoters using our Booker Dashboard.</p>
        </div>
      )}
    </div>
  );
}

// ── Pro page root ─────────────────────────────────────────────────
export default function ProPage({ rankings }) {
  const [proTab, setProTab] = useState("booker");
  const { unlocked } = useTier("allaccess");

  const enriched = useMemo(() => computeMomentumScores(rankings), [rankings]);

  return (
    <div className="pro-page">
      <div className="pro-header">
        <div className="pro-header-title">Deep Dive</div>
        <div className="pro-tabs">
          <button className={`pro-tab ${proTab === "booker" ? "pro-tab--active" : ""}`} onClick={() => setProTab("booker")}>
            Booker / Promoter
          </button>
          <button className={`pro-tab ${proTab === "artist" ? "pro-tab--active" : ""}`} onClick={() => setProTab("artist")}>
            Artist Portal
          </button>
        </div>
      </div>
      {proTab === "booker" && <BookerDashboard enriched={enriched} />}
      {proTab === "artist" && (unlocked
        ? <ArtistPortal enriched={enriched} />
        : <div style={{ display: "flex", justifyContent: "center", padding: "44px 16px" }}>
            <LockCard tier="allaccess" source="deep-dive-portal"
              headline="The Artist Portal is part of All Access"
              sub="Claim and manage an artist profile, surface booking contacts, and let promoters reach you straight from the Deep Dive dashboard." />
          </div>
      )}
    </div>
  );
}
