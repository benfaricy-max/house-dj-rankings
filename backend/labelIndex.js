/**
 * Label tier index — a "Pitchbook for labels". Curated tiers for the labels that
 * carry the most scene credibility; releasing on an ascending label predicts
 * booking-fee increases. Tier 5 = genre-defining institution, down to 1 = unknown.
 * Used by enrichLabels.js to score artists on their label affiliations.
 */
const norm = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

// tier → label names (matched on normalized name; substring match handles
// "Drumcode", "Drumcode Limited", etc.)
const TIERS = {
  5: ["drumcode", "kompakt", "defected", "anjunadeep", "anjunabeats", "innervisions",
      "afterlife", "keinemusik", "hotcreations", "dirtybird", "ninjatune", "crosstownrebels",
      "diynamic", "mau5trap", "rekids", "cocoon", "hessleaudio", "rands", "warp", "perlon",
      "ostgut", "ostgutton", "tresor", "kompaktextra"],
  4: ["toolroom", "solidgrooves", "repopulatemars", "cuttinheadz", "kneedeepinsound", "saved",
      "truesoul", "soma", "getphysical", "suara", "snatch", "realm", "sola", "upthestuss",
      "hotflush", "lifeanddeath", "stilllove", "watergate", "knm", "noart", "rejected",
      "vivadisco", "vivamusic", "moodmusic", "desolat", "hyperdub", "running back", "runningback",
      "permanentvacation", "futureclassic", "pampa", "smallville", "dialled", "blackbook",
      "edible", "elrow", "monstercat", "spinnindeep", "armada", "sweatitout", "offthegrid"],
  3: ["toolroomtrax", "intec", "kneedeep", "circoloco", "terminalm", "filthonacid", "insomniac",
      "mauimusic", "glasgowunderground", "snatchraw", "8bit", "moonharbour", "leftroom",
      "objektivity", "kraftek", "secondstate", "drumcomplex", "odd", "phobiq", "octopus",
      "stmplay", "abracadabra", "wonkytown", "ftrax"],
};

const LOOKUP = {};
for (const [tier, names] of Object.entries(TIERS)) for (const n of names) LOOKUP[norm(n)] = +tier;

// Tier of a single label name. Unknown but real label = 2; empty = 0.
function tierOf(label) {
  const k = norm(label);
  if (!k) return 0;
  if (LOOKUP[k]) return LOOKUP[k];
  for (const key in LOOKUP) if (k.includes(key) || key.includes(k)) return LOOKUP[key]; // substring match
  return 2;                                   // a real but uncatalogued label
}

const TIER_SCORE = { 5: 100, 4: 80, 3: 60, 2: 40, 1: 25, 0: 0 };

// Score an artist from their label affiliations (array of label names).
// Returns { label_best, label_tier, label_score } — best tier they release on,
// with a small bonus for breadth across multiple respected (tier ≥4) labels.
function scoreLabels(labels) {
  const list = (labels || []).filter(Boolean);
  if (!list.length) return { label_best: null, label_tier: 0, label_score: null };
  let best = 0, bestName = null;
  let respected = 0;
  for (const l of list) {
    const t = tierOf(l);
    if (t > best) { best = t; bestName = l; }
    if (t >= 4) respected++;
  }
  const bonus = Math.min(respected - 1, 2) * 5;          // up to +10 for multiple top labels
  const score = Math.min(100, (TIER_SCORE[best] || 0) + (respected > 1 ? bonus : 0));
  return { label_best: bestName, label_tier: best, label_score: score };
}

module.exports = { tierOf, scoreLabels, TIER_SCORE };
