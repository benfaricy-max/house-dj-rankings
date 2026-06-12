import { useMemo } from "react";
import { slugify } from "./ArtistProfile";
import EmailCapture from "./EmailCapture";
import IntelUpsell from "./IntelUpsell";
import "./IndexDrop.css";

// ── The PEAKTIME Index — the monthly "drop" ────────────────────────────────
// The media-brand flagship (Pivot 2). A dated, narrated snapshot of the same
// live data — frozen into a citable monthly artefact with the recurring rituals
// bookers come back for: Movers, Value Gap of the Month, City in Focus.
//
// Everything here is DERIVED from rankings.json — no new data, no fabrication
// (PERMANENT RULE #1). If a signal is thin, the section degrades gracefully
// rather than inventing a story.

const MONTH = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// Compare current rank to the rank ~30d ago from rank_history. Positive delta = climbed.
function moverDelta(dj) {
  const h = Array.isArray(dj.rank_history) ? dj.rank_history : [];
  if (h.length < 2) return null;
  const now = dj.rank ?? h[h.length - 1]?.r;
  const cutoff = Date.now() - 32 * 864e5;
  // earliest history point at/after the 30d window opens; else the oldest we have
  const past = h.find(p => new Date(p.d).getTime() >= cutoff) ?? h[0];
  if (now == null || past?.r == null) return null;
  return past.r - now; // climbed N places
}

function MoverRow({ dj, delta }) {
  const up = delta > 0;
  return (
    <a className="idx-mover" href={`/artist/${slugify(dj.name)}`}>
      <span className={`idx-mover-delta ${up ? "is-up" : "is-down"}`}>
        {up ? "▲" : "▼"} {Math.abs(delta)}
      </span>
      <span className="idx-mover-name">{dj.name}</span>
      <span className="idx-mover-rank">#{dj.rank}</span>
    </a>
  );
}

export default function IndexDrop({ rankings = [], lastUpdated }) {
  const now = new Date(lastUpdated || Date.now());
  const monthLabel = `${MONTH[now.getMonth()]} ${now.getFullYear()}`;

  const top20 = useMemo(
    () => [...rankings].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999)).slice(0, 20),
    [rankings]
  );

  const { risers, fallers } = useMemo(() => {
    const withDelta = rankings
      .map(dj => ({ dj, delta: moverDelta(dj) }))
      .filter(x => x.delta != null && Math.abs(x.delta) >= 2);
    return {
      risers:  [...withDelta].filter(x => x.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 5),
      fallers: [...withDelta].filter(x => x.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 5),
    };
  }, [rankings]);

  // Value Gap of the Month: the most underpriced act with a confident buy signal.
  const valuePick = useMemo(() => {
    const buys = rankings.filter(d => (d.value_signal === "strong-buy" || d.value_signal === "buy") && d.value_gap_pct != null);
    const pref = buys.filter(d => d.value_signal === "strong-buy");
    const pool = pref.length ? pref : buys;
    return [...pool].sort((a, b) => (b.value_gap_pct ?? 0) - (a.value_gap_pct ?? 0))[0] || null;
  }, [rankings]);

  // City in Focus: the market with the most recent live activity across the field.
  const cityFocus = useMemo(() => {
    const tally = new Map(); // city -> { city, country, shows, acts:Set }
    for (const dj of rankings) {
      for (const c of (dj.ra_recent_cities || [])) {
        if (!c?.city) continue;
        const key = c.city;
        const e = tally.get(key) || { city: c.city, country: c.country, shows: 0, acts: new Set() };
        e.shows += (c.shows_3m ?? c.shows ?? 1);
        e.acts.add(dj);
        tally.set(key, e);
      }
    }
    const top = [...tally.values()].sort((a, b) => b.shows - a.shows)[0];
    if (!top) return null;
    const acts = [...top.acts].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999)).slice(0, 6);
    return { city: top.city, country: top.country, shows: top.shows, acts };
  }, [rankings]);

  if (!rankings.length) {
    return <div className="idx-wrap"><div className="loading">Loading the Index…</div></div>;
  }

  const headline = valuePick
    ? `${valuePick.name} is the most underpriced act in the index this month`
    : `Where booking demand is moving in ${monthLabel}`;

  return (
    <div className="idx-wrap">
      <header className="idx-masthead">
        <div className="idx-kicker">The PEAKTIME Index</div>
        <h1 className="idx-month">{monthLabel}</h1>
        <p className="idx-standfirst">
          The neutral booking-demand index for house &amp; techno — who's rising, who's mispriced,
          and where, this month. Data, not hype.
        </p>
      </header>

      {/* 1 — The headline */}
      <section className="idx-section idx-headline">
        <div className="idx-eyebrow">This month</div>
        <h2 className="idx-headline-title">{headline}</h2>
      </section>

      {/* 2 — Movers */}
      <section className="idx-section">
        <div className="idx-section-head">
          <h2 className="idx-h2">Movers</h2>
          <span className="idx-section-note">Rank change vs ~30 days ago</span>
        </div>
        {(risers.length || fallers.length) ? (
          <div className="idx-movers-grid">
            <div className="idx-movers-col">
              <div className="idx-col-label is-up">Rising</div>
              {risers.length ? risers.map(({ dj, delta }) => <MoverRow key={dj.name} dj={dj} delta={delta} />)
                             : <div className="idx-empty">No significant climbs this period.</div>}
            </div>
            <div className="idx-movers-col">
              <div className="idx-col-label is-down">Falling</div>
              {fallers.length ? fallers.map(({ dj, delta }) => <MoverRow key={dj.name} dj={dj} delta={delta} />)
                              : <div className="idx-empty">No significant falls this period.</div>}
            </div>
          </div>
        ) : (
          <div className="idx-empty">Movers populate as rank history accrues across the month.</div>
        )}
      </section>

      {/* 3 — Value Gap of the Month */}
      {valuePick && (
        <section className="idx-section idx-value">
          <div className="idx-section-head">
            <h2 className="idx-h2">Value Gap of the Month</h2>
            <span className={`idx-signal idx-signal--${valuePick.value_signal}`}>{valuePick.value_signal}</span>
          </div>
          <a className="idx-value-card" href={`#/value/${slugify(valuePick.name)}`}>
            <div className="idx-value-name">{valuePick.name}</div>
            <div className="idx-value-stat">
              <span className="idx-value-pct">+{valuePick.value_gap_pct}%</span>
              <span className="idx-value-lbl">booking demand says the fee should be higher than where it sits</span>
            </div>
            <div className="idx-value-fees">
              <span>Known fee <strong>{valuePick.booking_fee?.label || "—"}</strong></span>
              <span className="idx-value-arrow">→</span>
              <span>Demand-implied <strong>{valuePick.demand_fee_label || "—"}</strong></span>
            </div>
            {Array.isArray(valuePick.scene_tags) && valuePick.scene_tags.length > 0 && (
              <div className="idx-value-tags">
                {valuePick.scene_tags.slice(0, 3).map(t => <span key={t} className="idx-tag">{t}</span>)}
              </div>
            )}
            <div className="idx-value-cta">Read the Fair Value Report →</div>
          </a>
        </section>
      )}

      {/* 4 — City in Focus */}
      {cityFocus && (
        <section className="idx-section">
          <div className="idx-section-head">
            <h2 className="idx-h2">City in Focus — {cityFocus.city}</h2>
            <span className="idx-section-note">Most live booking activity this period</span>
          </div>
          <div className="idx-city-acts">
            {cityFocus.acts.map(dj => (
              <a key={dj.name} className="idx-city-act" href={`/artist/${slugify(dj.name)}`}>
                <span className="idx-city-rank">#{dj.rank}</span>
                <span className="idx-city-name">{dj.name}</span>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* The drop = the lead magnet. Capture sits inside the artefact. */}
      <section className="idx-section idx-capture">
        <EmailCapture
          source="index-drop"
          heading={`Get the ${monthLabel} Index — and every drop after`}
          sub="The full index plus Movers, the Value Gap of the Month, and City in Focus — in your inbox on the 1st. Free and neutral."
        />
        <IntelUpsell source="index-drop" />
      </section>

      {/* 5 — The top 20 snapshot */}
      <section className="idx-section">
        <div className="idx-section-head">
          <h2 className="idx-h2">The Index — Top 20</h2>
          <span className="idx-section-note">{monthLabel} snapshot</span>
        </div>
        <ol className="idx-top20">
          {top20.map(dj => (
            <li key={dj.name} className="idx-top20-row">
              <a href={`/artist/${slugify(dj.name)}`}>
                <span className="idx-top20-rank">{dj.rank}</span>
                <span className="idx-top20-name">{dj.name}</span>
                <span className="idx-top20-score">{Math.round(dj.score)}</span>
              </a>
            </li>
          ))}
        </ol>
      </section>

      {/* Masthead / neutrality footer — same every issue */}
      <footer className="idx-footer">
        <p>
          The PEAKTIME Index ranks booking demand, not popularity, from a transparent
          composite of scene credibility, live demand, and reach. The methodology is
          public and the same for everyone. <a href="?tab=how-it-works">How it works →</a>
        </p>
        <p className="idx-footer-rule">
          We never take payment to alter a ranking or fee benchmark. A fabricated stat is
          the one thing that would break this — so we don't print one.
        </p>
      </footer>
    </div>
  );
}
