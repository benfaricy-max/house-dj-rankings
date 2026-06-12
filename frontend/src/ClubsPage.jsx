import { useMemo, useState } from "react";
import "./ClubsPage.css";
import { CLUB_PROFILES } from "./clubProfiles";
import { CLUB_IMAGES } from "./clubImages";

/**
 * PEAKTIME Club Index — the world's most legendary house & techno destinations.
 * North star: MUSIC INTEGRITY. Rewards serious, music-first rooms with deep
 * house/techno programming and sound over spectacle — not fame, not "new and
 * shiny." Booking popular artists earns nothing; bottle-service/EDM models score
 * low; Vegas mega-clubs don't qualify. Each club scored 0–100 on five axes.
 */
// Pure data + ranking logic extracted to clubsData.js so backend/generatePages.js
// can prerender /club/<slug> from the same source of truth. Re-exported for back-compat.
import { CRITERIA, RANKED, clubSlug, getClubBySlug } from "./clubsData";
export { clubSlug, getClubBySlug } from "./clubsData";

// Deterministic moody cover hue from the club name.
const hueOf = name => { let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; };
function ClubCover({ name, city, opened, big }) {
  const h = hueOf(name);
  const photo = CLUB_IMAGES[name];
  const style = photo
    ? { backgroundImage: `linear-gradient(180deg, rgba(12,12,14,0.15), rgba(12,12,14,0.85)), url("${photo}")`, backgroundSize: "cover", backgroundPosition: "center" }
    : { background: `radial-gradient(120% 140% at 20% 10%, hsl(${h} 55% 22%), hsl(${(h + 40) % 360} 60% 9%) 70%)` };
  return (
    <div className={`club-cover ${big ? "club-cover--big" : ""} ${photo ? "club-cover--photo" : ""}`} style={style}>
      {!photo && <div className="club-cover-grain" />}
      {!photo && <div className="club-cover-mark">◓</div>}
      {big && <div className="club-cover-text"><div className="club-cover-name">{name}</div><div className="club-cover-meta">{city} · est. {opened}{photo ? "" : ""}</div></div>}
    </div>
  );
}

export default function ClubsPage() {
  const ranked = RANKED;
  const max = ranked[0]?.score || 100;
  return (
    <div className="page clubs-page">
      <div className="clubs-hero">
        <div className="clubs-eyebrow">PEAKTIME Club Index</div>
        <h1 className="clubs-title">The 50 most legendary house destinations</h1>
        <p className="clubs-sub">
          Not a popularity contest and not a list of the biggest rooms. We rank the world's house &amp; techno
          venues with <b>music integrity as the north star</b> — serious, music-first programming and sound over
          spectacle, alongside heritage and legendary sessions. Booking famous artists earns nothing; bottle-service
          and EDM-tourist models score low. Tap any club for its full story.
        </p>
      </div>

      <div className="clubs-rubric">
        {CRITERIA.map(c => (
          <div key={c.key} className={`clubs-crit ${c.key === "mi" ? "clubs-crit--star" : ""}`}>
            <div className="clubs-crit-top"><span>{c.key === "mi" ? "★ " : ""}{c.label}</span><span className="clubs-crit-w">{Math.round(c.weight * 100)}%</span></div>
            <div className="clubs-crit-why">{c.why}</div>
          </div>
        ))}
      </div>

      <div className="clubs-list">
        {ranked.map(c => (
          <a key={c.name} className="club-row" href={`/club/${clubSlug(c.name)}`}>
            <div className="club-rank">{c.rank <= 3 ? ["🥇","🥈","🥉"][c.rank-1] : <span>#{c.rank}</span>}</div>
            <ClubCover name={c.name} city={c.city} opened={c.opened} />
            <div className="club-info">
              <div className="club-name">{c.name}</div>
              <div className="club-meta">{c.city} · {c.country} · est. {c.opened}</div>
            </div>
            <div className="club-score-wrap">
              <div className="club-score-bar"><div className="club-score-fill" style={{ width: `${(c.score / max) * 100}%` }} /></div>
              <div className="club-score">{c.score}</div>
            </div>
          </a>
        ))}
      </div>

      <div className="clubs-foot">
        Editorial index — scored by PEAKTIME against the published rubric above, with music integrity as the north
        star. Not driven by ticket sales, capacity or social following. Corrections and nominations welcome.
      </div>
    </div>
  );
}

// ── Club profile page (#/club/<slug>) ──────────────────────────────
export function ClubProfile({ slug }) {
  const c = getClubBySlug(slug);
  if (!c) return <div className="page"><button className="ap-back" onClick={() => { window.location.hash = ""; }}>← Back</button><div className="ap-chart-empty">Club not found.</div></div>;
  const p = CLUB_PROFILES[c.name] || {};
  const back = () => { window.location.hash = ""; };

  const Section = ({ title, children }) => children ? <div className="cp-section"><h2 className="cp-h">{title}</h2>{children}</div> : null;

  return (
    <div className="page cp-page">
      <button className="ap-back" onClick={back}>← Back to Club Index</button>
      <ClubCover name={c.name} city={c.city} opened={c.opened} big />

      <div className="cp-head">
        <div className="cp-rank">#{c.rank}</div>
        <div>
          <h1 className="cp-name">{c.name}</h1>
          <div className="cp-meta">{c.city} · {c.country}</div>
        </div>
        <div className="cp-score"><div className="cp-score-n">{c.score}</div><div className="cp-score-l">Index score</div></div>
      </div>

      <div className="cp-stats">
        <div className="cp-stat"><div className="cp-stat-v">{c.opened}</div><div className="cp-stat-l">Opened</div></div>
        {p.capacity && <div className="cp-stat"><div className="cp-stat-v cp-stat-v--sm">{p.capacity}</div><div className="cp-stat-l">Capacity</div></div>}
        {p.founders && <div className="cp-stat"><div className="cp-stat-v cp-stat-v--sm">{p.founders}</div><div className="cp-stat-l">Founders / origin</div></div>}
        {p.residencies && <div className="cp-stat"><div className="cp-stat-v cp-stat-v--sm">{p.residencies}</div><div className="cp-stat-l">Signature nights</div></div>}
      </div>

      <Section title="The lore">{p.lore ? <p className="cp-p">{p.lore}</p> : <p className="cp-p">{c.note}</p>}</Section>

      {p.iconicSets && (
        <Section title="Most iconic sets">
          <ul className="cp-list">{p.iconicSets.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </Section>
      )}
      <Section title="What makes it unique">{p.unique && <p className="cp-p">{p.unique}</p>}</Section>
      <Section title="Reputation">{p.reputation && <p className="cp-p">{p.reputation}</p>}</Section>
      <Section title="The secrets">{p.secrets && <p className="cp-p cp-p--secret">{p.secrets}</p>}</Section>

      <div className="cp-section">
        <h2 className="cp-h">Why it ranks #{c.rank}</h2>
        <div className="cp-crits">
          {CRITERIA.map((cr, i) => (
            <div key={cr.key} className="cp-crit-row">
              <span className="cp-crit-label">{cr.key === "mi" ? "★ " : ""}{cr.label} <span className="cp-crit-w">{Math.round(cr.weight*100)}%</span></span>
              <div className="cp-crit-track"><div className="cp-crit-fill" style={{ width: `${c.scores[i]}%` }} /></div>
              <span className="cp-crit-val">{c.scores[i]}</span>
            </div>
          ))}
        </div>
      </div>

      {!p.lore && <div className="cp-foot">Full profile in progress — this club's extended story is being written. Score &amp; criteria are live.</div>}
      <div className="cp-foot">PEAKTIME Club Index · editorial. A club's score never rises for booking a popular artist.</div>
    </div>
  );
}
