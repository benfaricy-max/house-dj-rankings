import { useState, useMemo } from "react";
import "./ProPage.css";

// ── Static enrichment ─────────────────────────────────────────────
// Location / agency metadata for known artists
const ARTIST_META = {
  "FISHER":               { city: "Sydney",        region: "Oceania",  genres: ["Tech House"],                 agency: "WME",            booking: "booking@wmeglobal.com"       },
  "Chris Lake":           { city: "London",        region: "UK",       genres: ["Tech House", "Deep House"],   agency: "Paradigm",       booking: "chrislake@paradigmagency.com" },
  "John Summit":          { city: "Chicago",       region: "US",       genres: ["Tech House", "House"],        agency: "UTA",            booking: "johnsummit@utamusic.com"      },
  "Fred Again":           { city: "London",        region: "UK",       genres: ["House", "UK Garage"],         agency: "WME",            booking: "fredagain@wmeglobal.com"      },
  "Four Tet":             { city: "London",        region: "UK",       genres: ["Electronic", "House"],        agency: "Independent",    booking: null                           },
  "Disclosure":           { city: "London",        region: "UK",       genres: ["UK House", "Deep House"],     agency: "Columbia",       booking: "disclosure@columbiabooking.com"},
  "Peggy Gou":            { city: "Berlin",        region: "Europe",   genres: ["Tech House", "Italo"],        agency: "Independent",    booking: null                           },
  "Black Coffee":         { city: "Johannesburg",  region: "Africa",   genres: ["Afro House", "Deep House"],   agency: "WME",            booking: "blackcoffee@wmeglobal.com"    },
  "Solomun":              { city: "Hamburg",       region: "Europe",   genres: ["Deep House", "Melodic"],      agency: "Diynamic",       booking: "booking@diynamic-music.com"   },
  "Tale Of Us":           { city: "Milan",         region: "Europe",   genres: ["Melodic Techno", "House"],    agency: "Afterlife",      booking: "booking@afterlife.it"         },
  "Bicep":                { city: "London",        region: "UK",       genres: ["House", "Electronic"],        agency: "Ninja Tune",     booking: null                           },
  "Honey Dijon":          { city: "Chicago",       region: "US",       genres: ["House", "Disco"],             agency: "Classic Music",  booking: null                           },
  "Jamie Jones":          { city: "Barcelona",     region: "Europe",   genres: ["Tech House"],                 agency: "Hot Creations",  booking: "booking@hotcreations.com"     },
  "Charlotte de Witte":   { city: "Ghent",         region: "Europe",   genres: ["Techno"],                     agency: "Independent",    booking: null                           },
  "Adam Beyer":           { city: "Stockholm",     region: "Europe",   genres: ["Techno"],                     agency: "Drumcode",       booking: "booking@drumcode.se"          },
  "Gorgon City":          { city: "London",        region: "UK",       genres: ["UK House", "Deep House"],     agency: "Positiva",       booking: "gorgoncity@positiva.com"      },
  "The Martinez Brothers":{ city: "New York",      region: "US",       genres: ["Tech House", "Deep House"],   agency: "Cuttin' Headz",  booking: null                           },
  "Hot Since 82":         { city: "Leeds",         region: "UK",       genres: ["Tech House", "Deep House"],   agency: "Knee Deep",      booking: "booking@kneedeepin.com"       },
  "Seth Troxler":         { city: "Detroit",       region: "US",       genres: ["Deep House", "Techno"],       agency: "Tuskegee",       booking: null                           },
  "Michael Bibi":         { city: "London",        region: "UK",       genres: ["Tech House"],                 agency: "Solid Grooves",  booking: "booking@solidgrooves.co.uk"   },
  "ANOTR":                { city: "Amsterdam",     region: "Europe",   genres: ["Tech House"],                 agency: "Rejected",       booking: "anotr@rejectedmusic.com"      },
  "Mau P":                { city: "Amsterdam",     region: "Europe",   genres: ["Tech House"],                 agency: "Rejected",       booking: "maup@rejectedmusic.com"       },
  "SIDEPIECE":            { city: "Los Angeles",   region: "US",       genres: ["Tech House"],                 agency: "Insomniac",      booking: "sidepiece@insomniac.com"      },
  "Chris Stussy":         { city: "Amsterdam",     region: "Europe",   genres: ["Deep House", "House"],        agency: "Technicolour",   booking: null                           },
  "PAWSA":                { city: "London",        region: "UK",       genres: ["Tech House"],                 agency: "Kaluki",         booking: "booking@kalukimusic.com"      },
  "Carlita":              { city: "Istanbul",      region: "Europe",   genres: ["House", "Melodic"],           agency: "Innervisions",   booking: null                           },
  "East End Dubs":        { city: "London",        region: "UK",       genres: ["Tech House", "Deep House"],   agency: "EED",            booking: null                           },
  "Josh Baker":           { city: "London",        region: "UK",       genres: ["Tech House"],                 agency: "Solid Grooves",  booking: "joshbaker@solidgrooves.co.uk" },
  "Franky Rizardo":       { city: "Amsterdam",     region: "Europe",   genres: ["Tech House"],                 agency: "Rejected",       booking: null                           },
  "Ben Sterling":         { city: "London",        region: "UK",       genres: ["Tech House", "House"],        agency: "Toolroom",       booking: null                           },
  "Disco Lines":          { city: "New York",      region: "US",       genres: ["Tech House", "House"],        agency: "Independent",    booking: null                           },
  "Chris Lorenzo":        { city: "London",        region: "UK",       genres: ["Tech House", "UK Bass"],      agency: "Black Book",     booking: null                           },
  "KETTAMA":              { city: "London",        region: "UK",       genres: ["Tech House"],                 agency: "Skint",          booking: null                           },
  "Cloonee":              { city: "London",        region: "UK",       genres: ["Tech House"],                 agency: "Skint",          booking: null                           },
  "Ranger Trucco":        { city: "Buenos Aires",  region: "Americas", genres: ["Tech House"],                 agency: "Independent",    booking: null                           },
  "Massano":              { city: "Turin",         region: "Europe",   genres: ["Melodic Techno", "House"],    agency: "Afterlife",      booking: null                           },
  "Mau P":                { city: "Amsterdam",     region: "Europe",   genres: ["Tech House"],                 agency: "Rejected",       booking: "maup@rejectedmusic.com"       },
  "Alisha":               { city: "London",        region: "UK",       genres: ["Tech House", "House"],        agency: "Independent",    booking: null                           },
};

function getMeta(name) {
  return ARTIST_META[name] ?? { city: "Global", region: "Global", genres: ["Electronic"], agency: "Independent", booking: null };
}

// ── Momentum score ────────────────────────────────────────────────
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
    const growth   = norm(dj.spotify_follower_growth_rate || 0, "spotify_follower_growth_rate");
    const tiktok   = norm(dj.tiktok_post_count || 0, "tiktok_post_count");
    const trends   = norm(dj.google_trends_score || 0, "google_trends_score");
    const rankMo   = dj.rank_change ? Math.min(Math.max(dj.rank_change * 8, 0), 100) : 40;
    const score    = Math.round(growth * 0.35 + tiktok * 0.25 + trends * 0.25 + rankMo * 0.15);
    return { ...dj, momentum: score, meta: getMeta(dj.name) };
  });
}

const REGIONS = ["All", "UK", "Europe", "US", "Americas", "Oceania", "Africa", "Global"];

// ── Paywall ───────────────────────────────────────────────────────
function Paywall({ onDemo }) {
  return (
    <div className="paywall">
      <div className="paywall-hero">
        <div className="paywall-eyebrow">Pro Access</div>
        <h2 className="paywall-title">Industry intelligence for the electronic music scene</h2>
        <p className="paywall-sub">
          Real-time trend data, momentum scoring, and booking tools — built for artists, managers, and promoters.
        </p>
      </div>

      <div className="pricing-grid">
        <div className="pricing-card">
          <div className="pricing-badge">Artist / Management</div>
          <div className="pricing-amount">£29<span>/mo</span></div>
          <ul className="pricing-features">
            <li>Claim &amp; verify your artist profile</li>
            <li>Add booking contact &amp; press kit</li>
            <li>Upload bio, photos &amp; rider</li>
            <li>Receive direct booking inquiries</li>
            <li>Analytics: profile views &amp; contacts</li>
            <li>Show upcoming dates from Bandsintown</li>
            <li>Rank history &amp; trend charts</li>
          </ul>
          <button className="pricing-cta pricing-cta--artist" onClick={onDemo}>
            Get Artist Access
          </button>
        </div>

        <div className="pricing-card pricing-card--featured">
          <div className="pricing-featured-tag">Most Popular</div>
          <div className="pricing-badge">Booker / Promoter</div>
          <div className="pricing-amount">£49<span>/mo</span></div>
          <ul className="pricing-features">
            <li>Full trending artist dashboard</li>
            <li>Momentum scores &amp; rank velocity</li>
            <li>Filter by region, genre &amp; trajectory</li>
            <li>Direct booking contacts for claimed profiles</li>
            <li>Rising talent spotlight</li>
            <li>Week-over-week movement alerts</li>
            <li>Export to CSV for your team</li>
          </ul>
          <button className="pricing-cta pricing-cta--booker" onClick={onDemo}>
            Get Booker Access
          </button>
        </div>
      </div>

      <button className="paywall-demo-btn" onClick={onDemo}>
        Preview Pro Dashboard (Demo)
      </button>
    </div>
  );
}

// ── Booker dashboard ──────────────────────────────────────────────
function MomentumBar({ score }) {
  const color = score >= 70 ? "#4ade80" : score >= 40 ? "var(--accent)" : "var(--muted)";
  return (
    <div className="momentum-bar-wrap">
      <div className="momentum-bar-track">
        <div className="momentum-bar-fill" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="momentum-score" style={{ color }}>{score}</span>
    </div>
  );
}

function BookerArtistRow({ dj, rank }) {
  const claimed = !!dj.meta.booking;
  return (
    <div className="booker-row">
      <div className="booker-rank">
        <span className="booker-rank-num">#{rank ?? dj.rank}</span>
        {dj.rank_change != null && dj.rank_change !== 0 && (
          <span className={`booker-delta ${dj.rank_change > 0 ? "up" : "down"}`}>
            {dj.rank_change > 0 ? `▲${dj.rank_change}` : `▼${Math.abs(dj.rank_change)}`}
          </span>
        )}
      </div>

      <div className="booker-avatar">
        {dj.image
          ? <img src={dj.image} alt={dj.name} />
          : <div className="booker-placeholder">{dj.name[0]}</div>
        }
      </div>

      <div className="booker-info">
        <div className="booker-name">
          {dj.name}
          {claimed && <span className="claimed-badge">Claimed</span>}
        </div>
        <div className="booker-meta">
          <span>{dj.meta.city}</span>
          {dj.meta.genres.slice(0, 2).map(g => (
            <span key={g} className="genre-tag">{g}</span>
          ))}
        </div>
      </div>

      <div className="booker-momentum">
        <div className="booker-momentum-label">Momentum</div>
        <MomentumBar score={dj.momentum} />
      </div>

      <div className="booker-contact">
        {claimed ? (
          <a href={`mailto:${dj.meta.booking}`} className="contact-btn contact-btn--active">
            Book
          </a>
        ) : (
          <span className="contact-btn contact-btn--locked">
            Unclaimed
          </span>
        )}
        {dj.spotify_url && (
          <a href={dj.spotify_url} target="_blank" rel="noreferrer" className="contact-btn contact-btn--spotify">
            Spotify
          </a>
        )}
      </div>
    </div>
  );
}

function BookerDashboard({ enriched }) {
  const [region, setRegion]   = useState("All");
  const [sortBy, setSortBy]   = useState("momentum");
  const [search, setSearch]   = useState("");

  const filtered = useMemo(() => {
    let list = enriched;
    if (region !== "All") list = list.filter(d => d.meta.region === region);
    if (search.trim())    list = list.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));
    return [...list].sort((a, b) =>
      sortBy === "momentum" ? b.momentum - a.momentum :
      sortBy === "rank"     ? a.rank - b.rank :
      sortBy === "rising"   ? (b.rank_change ?? 0) - (a.rank_change ?? 0) :
      0
    );
  }, [enriched, region, sortBy, search]);

  const risingTalent = useMemo(() =>
    [...enriched]
      .filter(d => d.rank > 15 && d.momentum > 50)
      .sort((a, b) => b.momentum - a.momentum)
      .slice(0, 5)
  , [enriched]);

  return (
    <div className="booker-dashboard">
      {risingTalent.length > 0 && (
        <section className="rising-section">
          <div className="pro-section-eyebrow">Rising Talent Spotlight</div>
          <div className="rising-strip">
            {risingTalent.map(dj => (
              <div key={dj.name} className="rising-card">
                <div className="rising-avatar">
                  {dj.image
                    ? <img src={dj.image} alt={dj.name} />
                    : <div className="rising-placeholder">{dj.name[0]}</div>
                  }
                </div>
                <div className="rising-name">{dj.name}</div>
                <div className="rising-rank">#{dj.rank}</div>
                <div className="rising-mo-label">Momentum</div>
                <div className="rising-mo-score" style={{ color: dj.momentum >= 70 ? "#4ade80" : "var(--accent)" }}>
                  {dj.momentum}
                </div>
                {dj.meta.city && <div className="rising-city">{dj.meta.city}</div>}
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="booker-controls">
        <input
          className="booker-search"
          placeholder="Search artist…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="region-filters">
          {REGIONS.map(r => (
            <button
              key={r}
              className={`region-btn ${region === r ? "region-btn--active" : ""}`}
              onClick={() => setRegion(r)}
            >{r}</button>
          ))}
        </div>
        <div className="sort-controls">
          <span className="sort-label">Sort</span>
          {[
            { key: "momentum", label: "Momentum" },
            { key: "rank",     label: "Rank"     },
            { key: "rising",   label: "Rising"   },
          ].map(s => (
            <button
              key={s.key}
              className={`sort-btn ${sortBy === s.key ? "sort-btn--active" : ""}`}
              onClick={() => setSortBy(s.key)}
            >{s.label}</button>
          ))}
        </div>
      </div>

      <div className="booker-list">
        <div className="booker-list-header">
          <span>Artist</span>
          <span />
          <span />
          <span>Momentum</span>
          <span>Contact</span>
        </div>
        {filtered.map((dj, i) => (
          <BookerArtistRow key={dj.name} dj={dj} rank={i + 1} />
        ))}
        {filtered.length === 0 && (
          <div className="booker-empty">No artists match your filters</div>
        )}
      </div>
    </div>
  );
}

// ── Artist portal ─────────────────────────────────────────────────
function ArtistPortal({ enriched }) {
  const [query, setQuery]   = useState("");
  const [selected, setSelected] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ bio: "", booking: "", presskit: "", rider: "" });

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
              <div className="portal-artist-meta">
                {selected.meta.city} · {selected.meta.genres.join(", ")}
              </div>
              <div className="portal-stats-row">
                <span className="portal-stat">
                  <span className="portal-stat-label">Rank</span>
                  <span className="portal-stat-value">#{selected.rank}</span>
                </span>
                <span className="portal-stat">
                  <span className="portal-stat-label">Score</span>
                  <span className="portal-stat-value">{selected.score} pts</span>
                </span>
                <span className="portal-stat">
                  <span className="portal-stat-label">Momentum</span>
                  <span className="portal-stat-value" style={{ color: "#4ade80" }}>{selected.momentum}</span>
                </span>
                {selected.rank_change != null && (
                  <span className="portal-stat">
                    <span className="portal-stat-label">This week</span>
                    <span className={`portal-stat-value ${selected.rank_change > 0 ? "up" : selected.rank_change < 0 ? "down" : ""}`}>
                      {selected.rank_change > 0 ? `▲${selected.rank_change}` : selected.rank_change < 0 ? `▼${Math.abs(selected.rank_change)}` : "—"}
                    </span>
                  </span>
                )}
              </div>
            </div>
            <div className={`claim-status ${claimed ? "claim-status--claimed" : "claim-status--unclaimed"}`}>
              {claimed ? "Profile Claimed" : "Profile Unclaimed"}
            </div>
          </div>

          {!claimed && !editMode && (
            <div className="claim-prompt">
              <div className="claim-prompt-title">Claim this profile</div>
              <p className="claim-prompt-body">
                Claiming your profile lets bookers find and contact you directly. Add your booking
                contact, bio, press kit, and rider to appear in the Booker Dashboard.
              </p>
              <ul className="claim-checklist">
                <li className={form.booking   ? "done" : ""}>Booking contact email</li>
                <li className={form.bio       ? "done" : ""}>Artist bio</li>
                <li className={form.presskit  ? "done" : ""}>Press kit link</li>
                <li className={form.rider     ? "done" : ""}>Technical rider</li>
              </ul>
              <button className="claim-btn" onClick={() => setEditMode(true)}>
                Claim Profile — £29/mo
              </button>
            </div>
          )}

          {(claimed || editMode) && (
            <div className="portal-form">
              <div className="pro-section-eyebrow" style={{ marginBottom: 16 }}>Profile Details</div>
              <div className="form-row">
                <label>Booking Email</label>
                <input
                  className="form-input"
                  placeholder="booking@youragency.com"
                  value={form.booking}
                  onChange={e => setForm(f => ({ ...f, booking: e.target.value }))}
                />
              </div>
              <div className="form-row">
                <label>Artist Bio</label>
                <textarea
                  className="form-input form-textarea"
                  placeholder="Write a short artist bio (200 words max)…"
                  value={form.bio}
                  onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                />
              </div>
              <div className="form-row">
                <label>Press Kit URL</label>
                <input
                  className="form-input"
                  placeholder="https://dropbox.com/your-presskit"
                  value={form.presskit}
                  onChange={e => setForm(f => ({ ...f, presskit: e.target.value }))}
                />
              </div>
              <div className="form-row">
                <label>Technical Rider</label>
                <input
                  className="form-input"
                  placeholder="https://dropbox.com/your-rider"
                  value={form.rider}
                  onChange={e => setForm(f => ({ ...f, rider: e.target.value }))}
                />
              </div>
              <button className="form-save-btn" onClick={() => setEditMode(false)}>
                {claimed ? "Save Changes" : "Submit &amp; Claim Profile"}
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
  const [unlocked, setUnlocked] = useState(false);
  const [proTab, setProTab]     = useState("booker");

  const enriched = useMemo(() => computeMomentumScores(rankings), [rankings]);

  if (!unlocked) return <Paywall onDemo={() => setUnlocked(true)} />;

  return (
    <div className="pro-page">
      <div className="demo-banner">
        Preview mode — <strong>subscribe to unlock full access</strong>
        <button className="demo-subscribe-btn">Subscribe</button>
      </div>

      <div className="pro-header">
        <div className="pro-header-title">Pro Dashboard</div>
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
      {proTab === "artist" && <ArtistPortal enriched={enriched} />}
    </div>
  );
}
