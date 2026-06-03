import { useMemo, useState } from "react";
import "./ClubsPage.css";

/**
 * PEAKTIME Club Index — the world's most credible house & techno venues.
 * Editorial, criteria-driven, and deliberately NOT a popularity contest:
 * heritage and underground integrity are weighted heavily; commercialization is
 * penalized. Booking famous artists earns nothing here. Each club is scored
 * 0–100 on six axes; the composite is a transparent weighted blend.
 */
const CRITERIA = [
  { key: "h", label: "Heritage", weight: 0.22, why: "Years operating + historical significance to the music. Old and foundational beats new and shiny." },
  { key: "r", label: "Industry reputation", weight: 0.20, why: "Standing among DJs and the scene — a room artists treat as a rite of passage, not a payday." },
  { key: "p", label: "Programming", weight: 0.18, why: "Consistency of credible house/techno bookings, residencies and legendary recurring parties — quality, not star wattage." },
  { key: "c", label: "Crowd & vibe", weight: 0.15, why: "A mature, music-first floor (not bottle-service or under-21 tourists), plus sound system and atmosphere." },
  { key: "u", label: "Underground integrity", weight: 0.15, why: "The anti-commercial axis. Door policy, no-phones ethos, music over spectacle. Mega-club commercialization is penalized hard." },
  { key: "n", label: "Notoriety", weight: 0.10, why: "Cultural mystique and word-of-mouth legend — the stories people tell about the place." },
];

// city · country · opened · [Heritage, Reputation, Programming, Crowd, Underground, Notoriety] · note
const CLUBS = [
  ["Berghain / Panorama Bar", "Berlin", "DE", 2004, [92,100,98,97,100,100], "The techno cathedral. Impossible door, no photos, marathon sets — the global standard for credibility."],
  ["Tresor", "Berlin", "DE", 1991, [98,93,88,85,96,88], "Berlin's post-wall techno origin in a power-plant vault. Foundational Detroit–Berlin axis."],
  ["fabric", "London", "GB", 1999, [90,96,95,86,86,92], "Farringdon institution, Room One's bodysonic floor and a near-religious devotion to the underground."],
  ["DC-10", "Ibiza", "ES", 1999, [88,93,91,85,84,95], "Home of Circoloco — Ibiza's antidote to the VIP island. Raw, sweaty, no frills."],
  ["Sub Club", "Glasgow", "GB", 1987, [97,91,88,89,93,82], "The world's longest-running underground house club. Subbie's low-ceilinged sweatbox is sacred ground."],
  ["Bassiani", "Tbilisi", "GE", 2014, [66,95,91,93,98,96], "Georgia's defiant techno stronghold under a stadium — a venue that became a political symbol."],
  ["Robert Johnson", "Offenbach", "DE", 1999, [86,95,91,87,95,84], "A small riverside room with outsized influence; the Live at Robert Johnson label cred."],
  ["Smart Bar", "Chicago", "US", 1982, [97,89,86,84,90,80], "House music's hometown club. Four decades of Chicago's deepest programming."],
  ["Rex Club", "Paris", "FR", 1988, [93,90,90,84,87,81], "Laurent Garnier's spiritual home and France's techno bedrock, with a famed Funktion-One."],
  ["The Block", "Tel Aviv", "IL", 2010, [72,92,89,85,92,82], "A sound-system pilgrimage; widely cited by touring DJs as one of the best rooms on earth."],
  ["Concrete", "Paris", "FR", 2011, [70,90,88,86,90,86], "The boat that rewired Parisian nightlife and won extended/24h licensing for the scene."],
  ["Amnesia", "Ibiza", "ES", 1976, [95,86,86,79,70,91], "Ibiza heritage incarnate (Cocoon, Pyramid) — legendary, if more commercial than its underground peers."],
  ["Watergate", "Berlin", "DE", 2002, [80,87,88,83,80,79], "Riverside LED-ceiling room with a serious house/techno booking pedigree."],
  ["Lux Frágil", "Lisbon", "PT", 1998, [84,88,87,85,83,82], "Lisbon's three-floor institution, part-owned by John Malkovich, with a fierce local devotion."],
  ["Club Space", "Miami", "US", 2000, [84,87,89,82,77,88], "The Terrace and legendary sunrise sets — America's flagship after-hours marathon room."],
  ["Sisyphos", "Berlin", "DE", 2009, [73,85,83,90,91,86], "Former dog-biscuit factory turned never-ending open-air; pure Berlin vibes over star power."],
  ["://about blank", "Berlin", "DE", 2010, [69,87,85,87,93,81], "Politically engaged collective club with a beloved garden — community-first to the core."],
  ["Khidi", "Tbilisi", "GE", 2016, [60,89,87,86,93,83], "Tbilisi's other techno fortress; brutalist concrete and an uncompromising booking ethos."],
  ["Nowadays", "Queens, NYC", "US", 2015, [64,87,89,91,91,79], "Outdoor-indoor community club with a Berlin-grade sound focus and a no-phones dancefloor."],
  ["Fuse", "Brussels", "BE", 1994, [88,87,85,81,87,78], "Belgium's techno standard-bearer, fresh off a hard-won fight to keep its doors open."],
  ["Stereo", "Montreal", "CA", 1998, [85,89,87,83,87,82], "Members' after-hours temple revered for one of the most precise sound systems anywhere."],
  ["Corsica Studios", "London", "GB", 2002, [80,87,87,83,89,77], "Elephant & Castle's two-room cradle for London's most credible underground nights."],
  ["Nitsa", "Barcelona", "ES", 1994, [87,85,85,81,83,77], "Barcelona's longest-standing electronic club, the serious counterpoint to Sónar week tourism."],
  ["Tenax", "Florence", "IT", 1981, [91,83,83,79,81,77], "Italy's enduring temple of house, with the long-running Nobody's Perfect residency."],
  ["Cocoricò", "Riccione", "IT", 1989, [88,81,81,75,73,82], "The glass pyramid — a Romagna riviera techno landmark of the '90s rave era."],
  ["D-Edge", "São Paulo", "BR", 2003, [80,87,87,81,83,81], "South America's design-and-sound flagship, an LED-clad room with global respect."],
  ["Womb", "Tokyo", "JP", 2000, [82,85,85,81,79,81], "Shibuya's four-floor mainstay and the hub of Tokyo's house & techno community."],
  ["Kompass Klub", "Ghent", "BE", 2015, [62,87,87,85,88,79], "A converted factory that fast became one of Europe's most respected techno destinations."],
  ["Shelter", "Amsterdam", "NL", 2014, [64,84,85,85,88,75], "Subterranean bunker beneath the A'DAM tower — Amsterdam's no-frills underground anchor."],
  ["FOLD", "London", "GB", 2018, [55,85,85,85,91,74], "Canning Town's no-photos, late-license room carrying the post-Berghain London torch."],
  ["Razzmatazz", "Barcelona", "ES", 2000, [80,82,83,77,73,79], "Five-room Poblenou giant; broad, but its techno floors keep real credibility."],
  ["Kater Blau", "Berlin", "DE", 2014, [70,83,81,87,86,83], "The Bar25 lineage lives on at this riverside vibe-first institution."],
  ["Warehouse Project", "Manchester", "GB", 2006, [74,87,87,79,75,87], "Seasonal warehouse series that became a UK rite of passage for a generation."],
  ["Goa", "Madrid", "ES", 1997, [83,81,83,79,81,75], "Madrid's techno cornerstone, home to the long-running morning sessions."],
  ["RSO", "Berlin", "DE", 2019, [54,84,84,85,88,78], "Riverside techno hangar that quickly entered Berlin's serious-club conversation."],
  ["Basement", "Queens, NYC", "US", 2019, [58,87,87,85,90,80], "The Knockdown Center's no-phones black box — New York's most Berlin-minded room."],
  ["Bossa Nova Civic Club", "Brooklyn, NYC", "US", 2012, [62,83,82,85,87,76], "Bushwick's beloved, unpretentious dancefloor — small, sweaty, scene-defining."],
  ["Public Records", "Brooklyn, NYC", "US", 2019, [54,83,83,83,84,73], "Audiophile hi-fi room obsessive about sound over spectacle."],
  ["Phonox", "London", "GB", 2016, [60,83,85,82,83,73], "Brixton's residency-led room that mints new credible names through long Saturday sets."],
  ["Vent", "Tokyo", "JP", 2016, [58,84,84,81,86,74], "Omotesando's sound-first techno room, a Contact-lineage favourite of touring artists."],
  ["Lux / Trouw lineage — De School", "Amsterdam", "NL", 2016, [60,90,88,86,92,84], "Amsterdam's defining 24h club of its era (now closed) — set the bar for the city's underground."],
  ["Bloc / Autumn Street", "London", "GB", 2007, [58,82,82,80,82,74], "London warehouse rave heritage and a sound-system reputation."],
  ["Warung Beach Club", "Itajaí", "BR", 2002, [78,83,84,80,74,80], "Brazil's open-air beach temple — a global melodic/house bucket-list room."],
  ["Spazio 900 / Goa Roma", "Rome", "IT", 1995, [80,78,80,77,79,72], "Rome's enduring outpost for the city's techno faithful."],
  ["Sub Club's Subculture / La Cheetah", "Glasgow", "GB", 2010, [56,82,82,82,86,72], "Glasgow's intimate basement keeping the city's deep underground lineage alive."],
  ["Flash", "Washington, DC", "US", 2014, [60,81,82,80,83,72], "DC's purpose-built, sound-led club anchoring the capital's techno community."],
  ["Halcyon", "San Francisco", "US", 2015, [56,80,82,80,82,71], "A Funktion-One hi-fi room flying the flag for SF's deep-house heritage."],
  ["Pacha", "Ibiza", "ES", 1973, [95,73,73,63,42,89], "The cherries are iconic and the history is real — but heavy commercialization drags the credibility score down."],
  ["Hï Ibiza", "Ibiza", "ES", 2017, [55,66,70,58,22,80], "Slick, award-winning and massive — and exactly the polished, commercial model this index discounts."],
  ["Salon zur Wilden Renate", "Berlin", "DE", 2007, [73,84,82,89,90,85], "A labyrinthine apartment-club of secret rooms — quintessential Berlin vibes-first hedonism."],
];

const composite = s => CRITERIA.reduce((sum, c, i) => sum + s[i] * c.weight, 0);

export default function ClubsPage() {
  const [open, setOpen] = useState(null);
  const ranked = useMemo(() =>
    CLUBS.map(([name, city, country, opened, scores, note]) =>
      ({ name, city, country, opened, scores, note, score: Math.round(composite(scores) * 10) / 10 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 50)
      .map((c, i) => ({ ...c, rank: i + 1 })),
  []);
  const max = ranked[0]?.score || 100;

  return (
    <div className="page clubs-page">
      <div className="clubs-hero">
        <div className="clubs-eyebrow">PEAKTIME Club Index</div>
        <h1 className="clubs-title">The 50 most credible clubs in dance music</h1>
        <p className="clubs-sub">
          Not a popularity contest and not a list of the biggest rooms. We rank the world's house &amp; techno
          venues on <b>legend, not glamour</b> — heritage, underground integrity and the respect of the floor.
          Booking famous artists earns a club nothing here; commercialization is penalized. Vegas-style mega-clubs
          don't qualify — they don't credibly book this music.
        </p>
      </div>

      <div className="clubs-rubric">
        {CRITERIA.map(c => (
          <div key={c.key} className="clubs-crit">
            <div className="clubs-crit-top"><span>{c.label}</span><span className="clubs-crit-w">{Math.round(c.weight * 100)}%</span></div>
            <div className="clubs-crit-why">{c.why}</div>
          </div>
        ))}
      </div>

      <div className="clubs-list">
        {ranked.map(c => (
          <div key={c.name} className={`club-row ${open === c.name ? "club-row--open" : ""}`} onClick={() => setOpen(open === c.name ? null : c.name)}>
            <div className="club-main">
              <div className="club-rank">{c.rank <= 3 ? ["🥇","🥈","🥉"][c.rank-1] : <span>#{c.rank}</span>}</div>
              <div className="club-info">
                <div className="club-name">{c.name}</div>
                <div className="club-meta">{c.city} · {c.country} · est. {c.opened}</div>
              </div>
              <div className="club-score-wrap">
                <div className="club-score-bar"><div className="club-score-fill" style={{ width: `${(c.score / max) * 100}%` }} /></div>
                <div className="club-score">{c.score}</div>
              </div>
            </div>
            {open === c.name && (
              <div className="club-detail">
                <p className="club-note">{c.note}</p>
                <div className="club-crits">
                  {CRITERIA.map((cr, i) => (
                    <div key={cr.key} className="club-crit-row">
                      <span className="club-crit-label">{cr.label}</span>
                      <div className="club-crit-track"><div className="club-crit-fill" style={{ width: `${c.scores[i]}%` }} /></div>
                      <span className="club-crit-val">{c.scores[i]}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="clubs-foot">
        Editorial index — scored by PEAKTIME against the published rubric above, not by ticket sales or social
        following. Corrections and nominations welcome. A club's score never rises for booking a popular artist.
      </div>
    </div>
  );
}
