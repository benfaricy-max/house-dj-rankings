import { useMemo, useState } from "react";
import "./ClubsPage.css";
import { CLUB_PROFILES } from "./clubProfiles";

/**
 * PEAKTIME Club Index — the world's most legendary house & techno destinations.
 * North star: MUSIC INTEGRITY. Rewards serious, music-first rooms with deep
 * house/techno programming and sound over spectacle — not fame, not "new and
 * shiny." Booking popular artists earns nothing; bottle-service/EDM models score
 * low; Vegas mega-clubs don't qualify. Each club scored 0–100 on five axes.
 */
const CRITERIA = [
  { key: "h",  label: "Heritage",          weight: 0.28, why: "Decades of operation and importance to the music — built over time, not opened last season." },
  { key: "mi", label: "Music integrity",   weight: 0.24, why: "The north star. A music-first room with serious, consistent house/techno programming and sound over spectacle. Fame is irrelevant." },
  { key: "s",  label: "Legendary sessions",weight: 0.22, why: "Iconic residencies, marathon all-nighters and sunrise sets — the destination events that define the legend." },
  { key: "c",  label: "Crowd & vibe",      weight: 0.16, why: "A mature, music-first floor (not under-21 tourists) and the atmosphere that makes the room." },
  { key: "n",  label: "Notoriety",         weight: 0.10, why: "Cultural mystique and the stories people tell — bucket-list status earned over decades." },
];

// city · country · opened · [Heritage, MusicIntegrity, LegendarySessions, Crowd, Notoriety] · note
const CLUBS = [
  ["Club Space", "Miami", "US", 2000, [90,94,100,96,94], "The 24-hour Terrace and its legendary sunrise sets — the definitive house destination in the Americas, music-first to its core."],
  ["Amnesia", "Ibiza", "ES", 1976, [98,88,98,88,95], "Ibiza's heritage temple — Cocoon, the Pyramid, decades of defining the island's serious house & techno nights."],
  ["Berghain / Panorama Bar", "Berlin", "DE", 2004, [90,100,88,95,98], "The techno cathedral and the global benchmark for music integrity — Panorama Bar keeps the house faith upstairs."],
  ["DC-10", "Ibiza", "ES", 1999, [88,92,98,86,95], "Home of Circoloco — Ibiza's raw, no-VIP antidote and one of dance music's most iconic residencies."],
  ["Tresor", "Berlin", "DE", 1991, [98,95,82,85,88], "Berlin's post-wall techno origin in a power-plant vault — the foundational Detroit–Berlin axis."],
  ["Sub Club", "Glasgow", "GB", 1987, [97,90,86,88,82], "The world's longest-running underground house club; Subculture's low-ceilinged sweatbox is sacred ground."],
  ["fabric", "London", "GB", 1999, [90,92,88,86,92], "Farringdon institution — Room One's bodysonic floor and a near-religious devotion to the music."],
  ["Robert Johnson", "Offenbach", "DE", 1999, [86,95,84,87,84], "A small riverside room with outsized influence and the Live at Robert Johnson label pedigree."],
  ["Smart Bar", "Chicago", "US", 1982, [97,90,84,84,80], "House music's hometown club — four decades of Chicago's deepest, most serious programming."],
  ["Rex Club", "Paris", "FR", 1988, [93,90,88,84,81], "Laurent Garnier's spiritual home and France's techno bedrock, with a famed Funktion-One."],
  ["Bassiani", "Tbilisi", "GE", 2014, [66,96,88,93,96], "Georgia's defiant techno stronghold under a stadium — a music-first venue that became a political symbol."],
  ["Stereo", "Montreal", "CA", 1998, [85,90,88,83,82], "Members' after-hours temple revered for one of the most precise sound systems on earth."],
  ["The Block", "Tel Aviv", "IL", 2010, [72,92,82,85,82], "A sound-system pilgrimage routinely named by touring DJs as one of the best rooms anywhere."],
  ["Concrete", "Paris", "FR", 2011, [70,90,86,86,86], "The boat that rewired Parisian nightlife and won extended/24h licensing for the city's scene."],
  ["Watergate", "Berlin", "DE", 2002, [80,86,82,83,79], "Riverside LED-ceiling room with a serious house/techno booking pedigree."],
  ["Lux Frágil", "Lisbon", "PT", 1998, [84,86,84,85,82], "Lisbon's three-floor institution with a fierce local devotion and a music-first reputation."],
  ["Nowadays", "Queens, NYC", "US", 2015, [64,90,86,91,79], "Indoor-outdoor community club with Berlin-grade sound focus and a no-phones marathon ethos."],
  ["://about blank", "Berlin", "DE", 2010, [69,90,84,87,81], "Politically engaged collective club with a beloved garden — community and music first."],
  ["Sisyphos", "Berlin", "DE", 2009, [73,86,88,90,86], "Former factory turned never-ending open-air — pure Berlin vibes and marathon weekenders."],
  ["Fuse", "Brussels", "BE", 1994, [88,88,82,81,78], "Belgium's techno standard-bearer, fresh off a hard-won fight to keep its doors open."],
  ["Khidi", "Tbilisi", "GE", 2016, [60,92,86,86,83], "Tbilisi's brutalist techno fortress with an uncompromising, music-first booking ethos."],
  ["De School", "Amsterdam", "NL", 2016, [60,92,88,86,84], "Amsterdam's defining 24h club of its era (now closed) — set the bar for the city's underground."],
  ["Corsica Studios", "London", "GB", 2002, [80,89,82,83,77], "Elephant & Castle's two-room cradle for London's most credible underground nights."],
  ["Nitsa", "Barcelona", "ES", 1994, [87,86,80,81,77], "Barcelona's longest-standing electronic club — the serious counterpoint to Sónar-week tourism."],
  ["Tenax", "Florence", "IT", 1981, [91,85,84,79,77], "Italy's enduring temple of house, home to the long-running Nobody's Perfect residency."],
  ["Kompass Klub", "Ghent", "BE", 2015, [62,89,84,85,79], "A converted factory that fast became one of Europe's most respected techno destinations."],
  ["Basement", "Queens, NYC", "US", 2019, [58,90,84,85,80], "The Knockdown Center's no-phones black box — New York's most Berlin-minded room."],
  ["D-Edge", "São Paulo", "BR", 2003, [80,87,84,81,81], "South America's design-and-sound flagship — an LED-clad room with global respect."],
  ["Womb", "Tokyo", "JP", 2000, [82,84,82,81,81], "Shibuya's four-floor mainstay and the hub of Tokyo's house & techno community."],
  ["Kater Blau", "Berlin", "DE", 2014, [70,85,86,87,83], "The Bar25 lineage lives on at this riverside, vibe-first institution."],
  ["Shelter", "Amsterdam", "NL", 2014, [64,88,82,85,75], "Subterranean bunker beneath the A'DAM tower — Amsterdam's no-frills underground anchor."],
  ["Warehouse Project", "Manchester", "GB", 2006, [74,84,88,79,87], "Seasonal warehouse series that became a UK rite of passage for a generation."],
  ["FOLD", "London", "GB", 2018, [55,90,84,85,74], "Canning Town's no-photos, late-license room carrying the post-Berghain London torch."],
  ["Cocoricò", "Riccione", "IT", 1989, [88,80,82,75,82], "The glass pyramid — a Romagna riviera techno landmark of the '90s rave era."],
  ["Goa", "Madrid", "ES", 1997, [83,84,82,79,75], "Madrid's techno cornerstone, home to the long-running morning sessions."],
  ["Razzmatazz", "Barcelona", "ES", 2000, [80,80,78,77,79], "Five-room Poblenou giant whose techno floors keep real credibility."],
  ["RSO", "Berlin", "DE", 2019, [54,86,80,85,78], "Riverside techno hangar that quickly entered Berlin's serious-club conversation."],
  ["Bossa Nova Civic Club", "Brooklyn, NYC", "US", 2012, [62,86,78,85,76], "Bushwick's beloved, unpretentious dancefloor — small, sweaty, scene-defining."],
  ["Vent", "Tokyo", "JP", 2016, [58,87,80,81,74], "Omotesando's sound-first techno room, a Contact-lineage favourite of touring artists."],
  ["Warung Beach Club", "Itajaí", "BR", 2002, [78,82,86,80,80], "Brazil's open-air beach temple — a global house/melodic bucket-list destination."],
  ["Phonox", "London", "GB", 2016, [60,85,84,82,73], "Brixton's residency-led room that mints credible new names through long Saturday sets."],
  ["Public Records", "Brooklyn, NYC", "US", 2019, [54,86,78,83,73], "Audiophile hi-fi room obsessive about sound over spectacle."],
  ["Halcyon", "San Francisco", "US", 2015, [56,84,76,80,71], "A Funktion-One hi-fi room flying the flag for SF's deep-house heritage."],
  ["Flash", "Washington, DC", "US", 2014, [60,84,78,80,72], "DC's purpose-built, sound-led club anchoring the capital's techno community."],
  ["La Cheetah", "Glasgow", "GB", 2010, [56,86,78,82,72], "Glasgow's intimate basement keeping the city's deep underground lineage alive."],
  ["Bloc", "London", "GB", 2007, [58,83,82,80,74], "London warehouse-rave heritage with a serious sound-system reputation."],
  ["Spazio 900 / Goa Roma", "Rome", "IT", 1995, [80,80,78,77,72], "Rome's enduring outpost for the city's techno faithful."],
  ["Salon zur Wilden Renate", "Berlin", "DE", 2007, [73,90,84,89,85], "A labyrinthine apartment-club of secret rooms — quintessential Berlin vibes-first hedonism."],
  ["Pacha", "Ibiza", "ES", 1973, [95,55,88,63,89], "Iconic cherries and real history — but a polished, table-service model the music-integrity north star marks down hard."],
  ["Hï Ibiza", "Ibiza", "ES", 2017, [55,40,78,58,80], "Slick, award-winning and massive — the commercial, spectacle-first model this index is built to discount."],
];

const composite = s => CRITERIA.reduce((sum, c, i) => sum + s[i] * c.weight, 0);
export const clubSlug = name => name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const RANKED = CLUBS
  .map(([name, city, country, opened, scores, note]) => ({ name, city, country, opened, scores, note, score: Math.round(composite(scores) * 10) / 10 }))
  .sort((a, b) => b.score - a.score)
  .slice(0, 50)
  .map((c, i) => ({ ...c, rank: i + 1 }));

export const getClubBySlug = slug => RANKED.find(c => clubSlug(c.name) === slug) || null;

// Deterministic moody cover hue from the club name.
const hueOf = name => { let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; };
function ClubCover({ name, city, opened, big }) {
  const h = hueOf(name);
  return (
    <div className={`club-cover ${big ? "club-cover--big" : ""}`}
      style={{ background: `radial-gradient(120% 140% at 20% 10%, hsl(${h} 55% 22%), hsl(${(h + 40) % 360} 60% 9%) 70%)` }}>
      <div className="club-cover-grain" />
      <div className="club-cover-mark">◓</div>
      {big && <div className="club-cover-text"><div className="club-cover-name">{name}</div><div className="club-cover-meta">{city} · est. {opened}</div></div>}
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
          <a key={c.name} className="club-row" href={`#/club/${clubSlug(c.name)}`}>
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
