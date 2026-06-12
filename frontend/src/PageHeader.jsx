/* ============================================================================
 * PageHeader — the PEAKTIME masthead + primary navigation.
 *
 * ⚠️  OWNERSHIP: This component is owned and maintained as a single surface.
 *     Do NOT modify the header/nav structure, the sticky behaviour, the tab set,
 *     or the live ticker without coordinating first — header changes have churned
 *     repeatedly when edited in parallel. Treat this file as the source of truth
 *     for everything between the top of the page and the first content section.
 *
 * Design contract (ui-ux-pro-max: Data-Dense Dashboard × Real-Time Operations):
 *   1. Sticky two-tier masthead (slim) — survives scrolling 330+ rows.
 *   2. Primary nav ≤5 tabs + a "More" overflow menu (no crammed tab row).
 *   3. Live status ticker in tier 1 (acts · signals · today's top mover).
 *   4. Left-aligned, dense, hairline-separated — terminal, not marketing splash.
 *   5. Primary CTA (Deep Dive) lives in the nav, top-right.
 * The editorial H1/scope is a scroll-away intro (rankings tab only), not sticky.
 * ========================================================================== */
import { useEffect, useMemo, useRef, useState } from "react";
import { slugify } from "./ArtistProfile";

const num = (v) => (Number.isFinite(v) ? v : 0);

// Primary tabs (≤5) + overflow. Keep the five highest-traffic destinations
// visible; everything else lives under "More". CTA is rendered separately.
const PRIMARY_TABS = [
  ["rankings", "Rankings"],
  ["booking", "Booking Intelligence"],
  ["clubs", "Club Index"],
  ["reports", "Reports"],
  ["how-it-works", "How It Works"],
];
const MORE_TABS = [
  ["index", "The Index"],
  ["scouting", "Scouting"],
];
const CTA_TAB = ["pro", "Deep Dive"];

function BrandMark() {
  return (
    <svg className="pm-mark" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="#0c0c0e" />
      <g fill="var(--accent)">
        <rect x="5.5" y="18.5" width="3.6" height="8" rx="1.3" />
        <rect x="11.2" y="13" width="3.6" height="13.5" rx="1.3" />
        <rect x="16.9" y="8" width="3.6" height="18.5" rx="1.3" />
        <rect x="22.6" y="4" width="3.6" height="22.5" rx="1.3" />
      </g>
    </svg>
  );
}

export default function PageHeader({ activeTab, setActiveTab, lastUpdated, editor, rankings }) {
  const go = (tab) => { window.location.hash = ""; setActiveTab(tab); window.scrollTo({ top: 0 }); };

  // Live status: top mover today — real rank climber if history has accrued,
  // else the highest-momentum act. Mirrors the index's "movement is the signal".
  const mover = useMemo(() => {
    if (!Array.isArray(rankings) || !rankings.length) return null;
    const climb = rankings
      .filter((d) => num(d.rank_change) > 0)
      .sort((a, b) => num(b.rank_change) - num(a.rank_change))[0];
    if (climb) return { name: climb.name, tag: `▲${num(climb.rank_change)}` };
    const mo = rankings
      .filter((d) => num(d.momentum_score) > 0)
      .sort((a, b) => num(b.momentum_score) - num(a.momentum_score))[0];
    return mo ? { name: mo.name, tag: `▲${Math.round(num(mo.momentum_score))}` } : null;
  }, [rankings]);

  const signals = num(rankings?.[0]?.signals_total) || 13;
  const updated = lastUpdated
    ? new Date(lastUpdated).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
    : null;

  // "More" overflow menu — closes on outside-click and Escape.
  const moreTabs = editor ? [...MORE_TABS, ["journal", "Journal"]] : MORE_TABS;
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);
  useEffect(() => {
    if (!moreOpen) return;
    const onDoc = (e) => { if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setMoreOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [moreOpen]);
  const moreActive = moreTabs.some(([k]) => k === activeTab);

  return (
    <header className="pm">
      {/* Tier 1 — slim sticky bar: brand · live ticker · CTA */}
      <div className="pm-bar">
        <a href="#" className="pm-brand" onClick={(e) => { e.preventDefault(); go("rankings"); }} aria-label="PEAKTIME — home">
          <BrandMark />
          <span className="pm-word">PEAKTIME</span>
        </a>

        {rankings?.length > 0 && (
          <div className="pm-ticker" aria-label="Live index status">
            <span className="pm-tk"><b>{rankings.length}</b> acts</span>
            <span className="pm-tk-dot" aria-hidden="true">·</span>
            <span className="pm-tk"><b>{signals}</b> signals</span>
            {mover && <>
              <span className="pm-tk-dot" aria-hidden="true">·</span>
              <a className="pm-tk-mover" href={`#/artist/${slugify(mover.name)}`}>
                <span className="pm-tk-arrow">{mover.tag}</span> {mover.name}
              </a>
            </>}
            {updated && <span className="pm-tk-upd">· {updated}</span>}
          </div>
        )}

        <button className="pm-cta" onClick={() => go(CTA_TAB[0])} aria-current={activeTab === CTA_TAB[0] || undefined}>
          {CTA_TAB[1]}
        </button>
      </div>

      {/* Tier 2 — sticky primary nav */}
      <nav className="pm-nav" aria-label="Primary">
        <div className="pm-nav-tabs">
          {PRIMARY_TABS.map(([key, label]) => (
            <button
              key={key}
              className={`pm-tab ${activeTab === key ? "pm-tab--active" : ""}`}
              onClick={() => setActiveTab(key)}
              aria-current={activeTab === key ? "page" : undefined}
            >
              {label}
            </button>
          ))}
          <div className="pm-more" ref={moreRef}>
            <button
              className={`pm-tab pm-tab--more ${moreActive ? "pm-tab--active" : ""}`}
              onClick={() => setMoreOpen((o) => !o)}
              aria-haspopup="true"
              aria-expanded={moreOpen}
            >
              More <span className="pm-caret" aria-hidden="true">▾</span>
            </button>
            {moreOpen && (
              <div className="pm-more-menu" role="menu">
                {moreTabs.map(([key, label]) => (
                  <button
                    key={key}
                    role="menuitem"
                    className={`pm-more-item ${activeTab === key ? "pm-more-item--active" : ""}`}
                    onClick={() => { setActiveTab(key); setMoreOpen(false); }}
                  >
                    {label}{key === "journal" && <span className="tab-private"> ·private</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Editorial intro — scrolls away; front page only */}
      {activeTab === "rankings" && (
        <div className="pm-intro">
          <div className="pm-eyebrow">Underground electronic · house &amp; techno</div>
          <h1 className="pm-title">The demand index for underground electronic music</h1>
          <p className="pm-scope">
            Booking demand, not Spotify followers. We rank house &amp; techno acts by who&apos;s actually
            filling rooms and moving the scene — blended from live bookings, charts, and momentum,
            refreshed daily. The one read that isn&apos;t selling either side anything.
          </p>
        </div>
      )}
    </header>
  );
}
