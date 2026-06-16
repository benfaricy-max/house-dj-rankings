// Genre lean (house ↔ techno) — single source of truth.
//
// Extracted from methodology.jsx so the build (backend/generatePages.js, plain Node
// ESM import) and the SPA share ONE classifier — same pattern as clubsData.js. The
// house/techno line is genuinely blurred and no one agrees on it, so we don't
// adjudicate it: lean is derived from where Beatport charts the artist; for acts not
// currently charting, we fall back to their single most-representative label
// (label_best). Output is a 3-way lean — house / crossover / techno — where
// "crossover" is the honest bucket for the melodic middle. An editorial `genre_lean`
// on the artist overrides. methodology.jsx re-exports everything here.

export const GENRE_META = {
  house:     { label: "House",     color: "#C8F750" },
  crossover: { label: "Crossover", color: "#4fd6e8" },
  techno:    { label: "Techno",    color: "#b388ff" },
};

const HOUSE_CHART = new Set(["House","Deep House","Afro House","Tech House","Bass House","Progressive House","Future House","Jackin House","Indie Dance","Nu Disco / Disco","Organic House","Funky House","Soulful House","Amapiano"]);
const TECHNO_CHART = new Set(["Techno (Peak Time / Driving)","Techno (Raw / Deep / Hypnotic)","Hard Techno","Hard Dance / Hardcore","Electro (Classic / Detroit / Modern)"]);
const BRIDGE_CHART = new Set(["Melodic House & Techno","Minimal / Deep Tech"]);
const TECHNO_LABEL = ["drumcode","kntxt","afterlife","exhale","suara","terminal m","filth on acid","octopus","second state","token","ostgut","klockworks","dystopian","mord","perc trax","soma","arts","figure","sleaze","planet rhythm","rekids","involve","set about","monnom","sci+tec","bpitch","cocoon","intec","truesoul","obsessed","ellum","nina kraviz","trip","reload"];
const HOUSE_LABEL = ["defected","hot creations","crosstown rebels","toolroom","repopulate mars","cuttin","solid grooves","glasgow underground","dftd","snatch","cajual","relief","dirtybird","anjunadeep","innervisions","keinemusik","diynamic","all day i dream","get physical","no art","realm","hot since","fuse","moan","desert hearts","sola","rumors","life and death","spinnin","musical freedom","stmpd","insomniac","armada","ultra","nervous","nu moda","experts only","higher ground","saved","stil vor talent","watergate","kompakt","ninja tune"];

function leanFromCharts(charts) {
  let h = 0, t = 0;
  for (const g of charts) {
    if (HOUSE_CHART.has(g)) h++;
    else if (TECHNO_CHART.has(g)) t++;
    else if (BRIDGE_CHART.has(g)) { h += 0.5; t += 0.5; }
    else h += 0.25; // unknown genre → slight house (roster is house-anchored)
  }
  if (t > h * 1.3) return "techno";
  if (h > t * 1.3) return "house";
  return "crossover";
}

function leanFromLabel(lb) {
  if (!lb) return null;
  const x = lb.toLowerCase();
  const t = TECHNO_LABEL.some(k => x.includes(k));
  const h = HOUSE_LABEL.some(k => x.includes(k));
  if (t && !h) return "techno";
  if (h && !t) return "house";
  return null;
}

// Returns "house" | "crossover" | "techno" | null. Editorial override wins.
export function genreLean(dj) {
  if (dj?.genre_lean && GENRE_META[dj.genre_lean]) return dj.genre_lean;
  const charts = Array.isArray(dj?.beatport_charts) ? dj.beatport_charts : [];
  if (charts.length) return leanFromCharts(charts);
  return leanFromLabel(dj?.label_best);
}

// PURE techno — editorial. This is a HOUSE-anchored index ("House DJ Rankings"),
// so acts who are genuinely pure techno with no house overlap don't belong in the
// main ranking; they stay in the database and surface under the Techno filter.
// This is deliberately NARROWER than genreLean === "techno": that bucket sweeps in
// melodic/Afterlife acts (Tale Of Us, Anyma, Adriatique, Mind Against, Recondite,
// Massano, Colyn, KAS:ST…) who share festival/club stages WITH house — those keep
// their place in the main ranking. Only the peak-time/driving/raw/hard/industrial
// techno acts with no house crossover are listed here. A per-artist `pure_techno:
// true` in the data also flags one without editing this set.
const PURE_TECHNO = new Set([
  "Charlotte de Witte", "Adam Beyer", "Amelie Lens", "Sven Väth", "Surgeon",
  "Sam Paganini", "Slam", "DJ Rush", "Planetary Assault Systems", "Len Faki",
  "Answer Code Request", "Jay Lumen", "999999999", "Wehbba", "Luigi Madonna",
  "Harvey McKay", "Spektre", "Dense & Pika", "Chelina Manuhutu",
  "Township Rebellion", "Alan Fitzpatrick", "Joseph Capriati",
  "Laurent Garnier", "Richie Hawtin", "Kenny Larkin", "Marco Faraone",
  "The Hacker", "Objekt", "Stephan Bodzin", "Agents Of Time",
]);

export function isPureTechno(dj) {
  if (!dj) return false;
  if (dj.pure_techno === true) return true;
  if (dj.pure_techno === false) return false; // explicit editorial keep
  return PURE_TECHNO.has(dj.name);
}

// Filter predicate for a house-anchored index. The default ("all") is the
// house-anchored main ranking: everything EXCEPT pure-techno outliers. House is
// the broad anchor: house + the melodic "crossover" middle + unclassified acts.
// Techno is the home for the genuinely-techno acts — INCLUDING the pure-techno
// names removed from the main view, so they're never lost, just relocated.
export function matchesGenre(dj, filter) {
  if (filter === "techno") return genreLean(dj) === "techno" || isPureTechno(dj);
  if (isPureTechno(dj)) return false; // pure techno is excluded from "all" and "house"
  if (filter === "all") return true;
  const lean = genreLean(dj);
  if (filter === "house") return lean === "house" || lean === "crossover" || lean === null;
  return true;
}
