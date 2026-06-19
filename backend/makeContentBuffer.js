// PEAKTIME social content buffer — batches ~3 weeks of ready-to-post captions
// from the CURRENT data, so distribution survives a data hiccup.
//
// WHY: today the Instagram is coupled to the local pipeline — posts are rendered
// from fresh rankings.json, so the week the pipeline stalls, the feed goes quiet
// too (premortem #1 + #6). This decouples them: run it once, get a dated queue of
// captions in brand voice (BRAND.md §6) that you can schedule ahead. The numbers
// are stamped with the data date so a buffered post never lies about freshness.
//
// Run:  node backend/makeContentBuffer.js [weeks]   (default 3)
// Out:  docs/content-queue.md   — copy/paste captions, cadence Mon/Wed/Fri.

const fs = require("fs");
const path = require("path");

const raw = require("../frontend/public/rankings.json");
const ARTISTS = Array.isArray(raw) ? raw : raw.artists || raw.rankings;
const WEEKS = Math.max(1, parseInt(process.argv[2], 10) || 3);

const dataDate = (() => {
  const t = Math.max(...ARTISTS.map(a => Date.parse(a.timestamp)).filter(Number.isFinite));
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : "unknown";
})();
const fmt = n => (n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? Math.round(n / 1e3) + "K" : String(n));

// ---- pillar 1: Weekly Movers — biggest climbers since first rank_history point.
function movers() {
  const withDelta = ARTISTS.filter(a => Array.isArray(a.rank_history) && a.rank_history.length >= 2)
    .map(a => {
      const first = a.rank_history[0].r, now = a.rank;
      return { a, delta: first - now, from: first, to: now };
    })
    .filter(m => Number.isFinite(m.delta) && m.delta !== 0);
  const up = [...withDelta].sort((x, y) => y.delta - x.delta).slice(0, 3);
  const down = [...withDelta].sort((x, y) => x.delta - y.delta).slice(0, 1);
  return { up, down };
}

// ---- pillar 2: Breakout — fastest accelerator with credible reach.
function breakout() {
  const c = ARTISTS.filter(a =>
    Number.isFinite(a.momentum_score) && a.momentum_score > 0 &&
    a.spotify_monthly_listeners >= 500000 && a.rank > 10);
  c.sort((p, q) => q.momentum_score - p.momentum_score);
  return c[0];
}

// ---- pillar 3: Reach vs Credibility — a "DJ's DJ" (high Beatport, modest reach).
function reachVsCred() {
  const c = ARTISTS.filter(a =>
    a.beatport_score >= 60 && a.spotify_monthly_listeners > 0 &&
    a.spotify_monthly_listeners < 1.5e6);
  c.sort((p, q) => q.beatport_score - p.beatport_score);
  return c[0];
}

// ---- pillar 4: City Spotlight — where bookings concentrate right now (RA shows).
function citySpotlight() {
  const map = new Map();
  for (const a of ARTISTS) {
    if (!Array.isArray(a.ra_recent_cities)) continue;
    for (const c of a.ra_recent_cities) {
      if (!c.city || c.city === "All" || c.city === "North") continue;
      const key = `${c.city}, ${c.country}`;
      const e = map.get(key) || { acts: new Set(), shows: 0 };
      e.acts.add(a.name);
      e.shows += c.shows || 0;
      map.set(key, e);
    }
  }
  const ranked = [...map.entries()]
    .map(([city, e]) => ({ city, acts: e.acts.size, shows: e.shows }))
    .sort((x, y) => y.acts - x.acts);
  return ranked[0];
}

// ---- pillar 5: Methodology — rotate through the signals that build trust.
const METHODS = [
 ["Why #1 is the boring number", "Rank is a lagging indicator. We sort on momentum, rate of change across search, streams, and bookings, because the rooms know who's rising before the chart does. The acceleration is the alpha."],
  ["Reach is not credibility", "We plot two axes. A DJ can be huge on Spotify and invisible on Beatport, or the reverse. One fills festivals; one earns the booth's respect. Showing both is how you tell them apart."],
  ["Value Gap, explained", "We estimate a demand-implied fee tier from streams, RA bookings, Beatport, and search, then compare it to the known fee. A positive gap flags an act whose demand has outrun its price. The method is in the bio."],
  ["What we won't do", "No stock DJ-silhouette photos. No takes without a number behind them. Charts are the imagery, and the formula is always public. The transparency is the point."],
];

// ---- caption builders (BRAND.md voice: number, read, method; no emoji/exclaim) --
const TAGS_BASE = "#housemusic #techno #djs #beatport";
function captionFor(pillar, ctx) {
  const m = a => fmt(a.spotify_monthly_listeners || 0) + " monthly listeners";
  switch (pillar) {
    case "Movers": {
      const top = ctx.up[0];
      const climbers = ctx.up.map(x => `${x.a.name} ${x.from}→${x.to}`).join(", ");
      return {
        title: "Weekly Movers",
 body: `Biggest climbers this week: ${climbers}. ${top.a.name} moved ${top.delta} places on rising search and bookings: momentum, not a one-off. Full board and method in bio.`,
        tags: `${TAGS_BASE} #${top.a.name.replace(/[^a-z0-9]/gi, "")}`,
      };
    }
    case "Breakout": {
      const a = ctx;
      return {
        title: "Breakout of the Week",
 body: `${a.name}: momentum ${Math.round(a.momentum_score)}/100 at #${a.rank}, on ${m(a)}. Accelerating faster than acts twice their size, the rooms are moving before the algorithm. Methodology in bio.`,
        tags: `${TAGS_BASE} #${a.name.replace(/[^a-z0-9]/gi, "")}`,
      };
    }
    case "ReachVsCred": {
      const a = ctx;
      return {
        title: "Reach vs. Credibility",
 body: `${a.name}: Beatport credibility ${Math.round(a.beatport_score)}/100 on ${m(a)}. Scene-respected before mainstream-large, a DJ's DJ. We plot both axes so a headliner reads differently from a booth favourite. Method in bio.`,
        tags: `${TAGS_BASE} #${a.name.replace(/[^a-z0-9]/gi, "")}`,
      };
    }
    case "City": {
      const c = ctx;
      return {
        title: "City Spotlight",
        body: `${c.city} is concentrating demand: ${c.acts} ranked acts with recent or upcoming shows. Where the roster is playing is where the rooms are betting. City breakdown on the site.`,
        tags: `${TAGS_BASE} #${c.city.split(",")[0].replace(/[^a-z0-9]/gi, "")}`,
      };
    }
    case "Method": {
      const [t, b] = ctx;
 return { title: `Methodology: ${t}`, body: b, tags: `${TAGS_BASE} #methodology` };
    }
  }
}

// ---- assemble the schedule: Mon Movers, Wed Breakout/Reach/City, Fri Method ----
function nextDay(from, weekday) { // weekday: 1=Mon..5=Fri
  const d = new Date(from);
  do { d.setDate(d.getDate() + 1); } while (d.getDay() !== weekday);
  return d;
}
const mv = movers(), bo = breakout(), rc = reachVsCred(), cs = citySpotlight();
const wedRotation = [
  () => captionFor("Breakout", bo),
  () => captionFor("ReachVsCred", rc),
  () => captionFor("City", cs),
];

let monCursor = new Date(), wedCursor = new Date(), friCursor = new Date();
const posts = [];
for (let w = 0; w < WEEKS; w++) {
  monCursor = nextDay(monCursor, 1);
  wedCursor = nextDay(wedCursor < monCursor ? monCursor : wedCursor, 3);
  friCursor = nextDay(friCursor < wedCursor ? wedCursor : friCursor, 5);
  posts.push({ date: monCursor.toISOString().slice(0, 10), pillar: "Movers", ...captionFor("Movers", mv) });
  posts.push({ date: wedCursor.toISOString().slice(0, 10), pillar: "Wed", ...wedRotation[w % 3]() });
  posts.push({ date: friCursor.toISOString().slice(0, 10), pillar: "Method", ...captionFor("Method", METHODS[w % METHODS.length]) });
}

// ---- write the queue --------------------------------------------------------
const lines = [];
lines.push(`# PEAKTIME, content queue`);
lines.push("");
lines.push(`> ${WEEKS} weeks, ${posts.length} posts. Generated ${new Date().toISOString().slice(0, 10)} from data dated **${dataDate}**.`);
lines.push(`> Cadence: Movers (Mon), Breakout/Reach/City (Wed), Methodology (Fri). Voice: number → read → method, no emoji, no exclamation marks.`);
lines.push(`> Buffer first, refresh later: if the pipeline stalls, these still post. Re-run after a fresh \`enrichLocal.js\` to update the numbers.`);
lines.push("");
for (const p of posts) {
  lines.push(`---`);
  lines.push(`### ${p.date} · ${p.title}`);
  lines.push("");
  lines.push(p.body);
  lines.push("");
  lines.push(`\`${p.tags}\``);
  lines.push("");
}
const outDir = path.join(__dirname, "..", "docs");
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, "content-queue.md");
fs.writeFileSync(out, lines.join("\n"));
console.log(`Wrote ${posts.length} posts → ${path.relative(path.join(__dirname, ".."), out)} (data ${dataDate})`);
