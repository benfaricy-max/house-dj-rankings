/**
 * Full-roster label sourcing — decouples the Label signal from Beatport CHARTING.
 *
 * Previously label_score came only from beatport_labels (labels an artist was
 * CURRENTLY charting on) → coverage was capped at the ~43% of the roster on a chart
 * this week. This reads each artist's Beatport ARTIST PAGE releases (their whole
 * label history), so every artist with a Beatport presence gets a label tier.
 *
 * Per artist: resolve their Beatport artist id once (cached in artists.json as
 * beatport_artist_id → 1 request next run), fetch /artist/x/<id>/releases, pull the
 * distinct labels, and score with labelIndex.scoreLabels. Plain HTTP (runs in CI),
 * resumable, paced, lock-guarded, merge-safe (never wipes a real label on failure).
 *
 * Run: node backend/enrichArtistLabels.js [limit]   (FORCE_RESOLVE=1 to re-resolve ids)
 */
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { scoreLabels } = require("./labelIndex");
const { acquireLock } = require("./scriptLock");

const RANKINGS = path.join(__dirname, "..", "frontend", "public", "rankings.json");
const ARTISTS  = path.join(__dirname, "artists.json");
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36";
const LIMIT = parseInt(process.argv[2] || "999", 10);
const STALE_DAYS = 30;
const KEEP = 12;   // label_tier_history points retained

const norm = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const delay = ms => new Promise(r => setTimeout(r, ms));
const ND = html => { const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/); try { return m ? JSON.parse(m[1]) : null; } catch { return null; } };
const get = (u) => axios.get(u, { headers: { "User-Agent": UA }, timeout: 18000, validateStatus: () => true });

// Resolve a Beatport artist id by searching the artist name (exact normalized match).
async function resolveArtistId(name) {
  const r = await get(`https://www.beatport.com/search?q=${encodeURIComponent(name)}`);
  if (r.status !== 200) return null;
  const j = ND(r.data); if (!j) return null;
  const want = norm(name);
  // Walk the dehydrated queries for artist objects; match name → id.
  const queries = j?.props?.pageProps?.dehydratedState?.queries ?? [];
  for (const q of queries) {
    const d = q.state?.data; if (!d) continue;
    const buckets = [d?.artists?.data, d?.artists, Array.isArray(d?.data) ? d.data : null].filter(Array.isArray);
    for (const arr of buckets) {
      for (const a of arr) {
        const nm = a?.artist_name ?? a?.name;
        const id = a?.artist_id ?? a?.id;
        if (nm && id && norm(nm) === want) return Number(id);
      }
    }
  }
  return null;
}

// Distinct label names from an artist's releases page.
async function fetchLabels(id) {
  const r = await get(`https://www.beatport.com/artist/x/${id}/releases`);
  if (r.status !== 200) return null;
  const s = r.data;
  const names = new Set();
  for (const m of s.matchAll(/"label":\{[^}]*?"name":"([^"]+)"/g)) names.add(m[1]);
  return names.size ? [...names] : [];
}

(async () => {
  const data = JSON.parse(fs.readFileSync(RANKINGS, "utf8"));
  const artists = JSON.parse(fs.readFileSync(ARTISTS, "utf8"));
  const byName = Object.fromEntries(artists.map(a => [a.name, a]));
  acquireLock("rankings-write");

  const today = new Date().toISOString().slice(0, 10);
  const fresh = a => a.artist_labels_updated && (Date.now() - new Date(a.artist_labels_updated).getTime()) < STALE_DAYS * 864e5;
  const todo = data.rankings.filter(a => !fresh(a)).slice(0, LIMIT);
  console.log(`Artist-label sourcing for ${todo.length} artists…`);

  let resolved = 0, scored = 0, missed = 0, failStreak = 0, done = 0;
  for (const dj of todo) {
    try {
      const src = byName[dj.name] || dj;
      let id = (!process.env.FORCE_RESOLVE && src.beatport_artist_id) || null;
      if (!id) { id = await resolveArtistId(dj.name); await delay(700); if (id) { dj.beatport_artist_id = id; if (byName[dj.name]) byName[dj.name].beatport_artist_id = id; resolved++; } }
      if (!id) { missed++; }
      else {
        const labels = await fetchLabels(id);
        await delay(700);
        if (labels && labels.length) {
          const { label_best, label_tier, label_score } = scoreLabels(labels);
          if (label_score != null) {
            const h = dj.label_tier_history ?? [];
            if (h[h.length - 1]?.d === today) h[h.length - 1] = { d: today, t: label_tier };
            else h.push({ d: today, t: label_tier });
            const hist = h.slice(-KEEP);
            const traj = hist.length >= 2 ? (label_tier > hist[0].t ? "ascending" : label_tier < hist[0].t ? "slipping" : "stable") : "new";
            const upd = { beatport_labels: labels, label_best, label_tier, label_score, label_trajectory: traj, label_tier_history: hist, artist_labels_updated: new Date().toISOString() };
            Object.assign(dj, upd);
            if (byName[dj.name]) Object.assign(byName[dj.name], upd);
            scored++;
          }
        }
      }
      failStreak = 0;
    } catch (e) {
      failStreak++;
 if (failStreak >= 10) { console.log("Too many consecutive errors, saving and stopping."); break; }
    }
    if (++done % 15 === 0) { fs.writeFileSync(RANKINGS, JSON.stringify(data)); fs.writeFileSync(ARTISTS, JSON.stringify(artists, null, 2)); process.stdout.write(`\r${done}/${todo.length} · ${scored} scored · ${resolved} new ids · ${missed} no-match   `); }
  }
  fs.writeFileSync(RANKINGS, JSON.stringify(data));
  fs.writeFileSync(ARTISTS, JSON.stringify(artists, null, 2));
  const cov = data.rankings.filter(a => a.label_score > 0).length;
  console.log(`\nDone. ${scored} scored this run · ${resolved} ids resolved · ${missed} unmatched. Label coverage now ${cov}/${data.rankings.length} (${Math.round(cov / data.rankings.length * 100)}%).`);
})();
