/**
 * Wikipedia pageviews (Wikimedia REST API). Free, open, historical, not rate-limited.
 * Resolves the artist's article (validated against the name to avoid mismatches),
 * then returns trailing 30-day total pageviews. Returns resolved_title for caching.
 */
const axios = require("axios");

const UA = "thedjrankings/1.0 (https://thedjrankings.com; analytics)";
const norm = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const ymd = d => d.toISOString().slice(0, 10).replace(/-/g, "");
const baseTitle = t => t.replace(/\s*\([^)]*\)\s*$/, "").trim(); // strip "(musician)" etc.

async function searchTitle(name) {
  const r = await axios.get("https://en.wikipedia.org/w/api.php", {
    params: { action: "query", list: "search", srsearch: name, srlimit: 4, format: "json" },
    headers: { "User-Agent": UA }, timeout: 12000,
  });
  const want = norm(name);
  for (const h of (r.data?.query?.search || [])) {
    if (norm(baseTitle(h.title)) === want) return h.title;   // strict: title must match the artist name
  }
  return null;
}

// Returns { total30 (trailing 30d views), trend (% change: recent 30d vs prior 30d) }.
async function pageviews(title) {
  const end = new Date(Date.now() - 2 * 864e5), start = new Date(Date.now() - 62 * 864e5);
  const art = encodeURIComponent(title.replace(/ /g, "_"));
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/all-agents/${art}/daily/${ymd(start)}/${ymd(end)}`;
  const r = await axios.get(url, { headers: { "User-Agent": UA }, timeout: 12000 });
  const items = r.data.items || [];
  const total = items.reduce((s, i) => s + (i.views || 0), 0);
  // split the 60-day window into prior-30 and recent-30 for a trend slope
  const recent = items.slice(-30).reduce((s, i) => s + (i.views || 0), 0);
  const prior = total - recent;
  const trend = prior > 0 ? Math.round(((recent - prior) / prior) * 100) : 0;
  return { total30: recent, trend };
}

async function getWikipediaViews(artist) {
  const empty = { wikipedia_pageviews: 0, wikipedia_trend: 0, resolved_title: null };
  try {
    const name = typeof artist === "string" ? artist : artist.name;
    let title = (typeof artist === "object" && artist.wikipedia_title) || null;
    if (!title) title = await searchTitle(name);
    if (!title) return empty;
    const { total30, trend } = await pageviews(title);
    return { wikipedia_pageviews: total30, wikipedia_trend: trend, resolved_title: title };
  } catch {
    return empty;
  }
}

module.exports = { getWikipediaViews };
