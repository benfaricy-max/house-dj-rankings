/**
 * Tour density signal (Songkick, no API key — public pages + schema.org ld+json).
 * Touring activity = strong revenue/demand signal for bookers.
 * search → slug-matched artist page → upcoming MusicEvents (count, countries, next show).
 */
const axios = require("axios");

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36";
const norm = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const get = url => axios.get(url, { headers: { "User-Agent": UA }, timeout: 14000 });

// Returns { status, data?, slug?, candidates?, msg? }
//   status: "ok" | "no_match" | "no_events" | "error"
// Exact normalized-slug match only — the old loose startsWith match grabbed the
// wrong artist for common names (e.g. "Rossi." → Vasco Rossi). Pass opts.slug
// ("123456-real-artist", from a songkick_slug override) to force the right one.
async function getTourDensity(name, opts = {}) {
  try {
    let path = opts.slug ? `/artists/${opts.slug}` : null;
    let candidates = [];
    if (!path) {
      const s = await get(`https://www.songkick.com/search?query=${encodeURIComponent(name)}&type=artists`);
      candidates = [...s.data.matchAll(/href="(\/artists\/[0-9]+-[^"\/]+)"/g)].map(m => m[1]);
      const want = norm(name);
      const slugOf = p => norm(p.split("-").slice(1).join("-"));
      path = candidates.find(p => slugOf(p) === want) || null;          // exact match only
      if (!path) return { status: "no_match", candidates: candidates.slice(0, 6) };
    }

    // artist page → parse ld+json MusicEvents
    const page = await get(`https://www.songkick.com${path}`);
    const blocks = [...page.data.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
      .map(x => { try { return JSON.parse(x[1]); } catch { return null; } }).filter(Boolean);
    const events = [];
    for (const b of blocks) for (const e of (Array.isArray(b) ? b : [b])) if (e["@type"] === "MusicEvent") events.push(e);

    const now = Date.now();
    const up = events.filter(e => e.startDate && new Date(e.startDate).getTime() >= now)
                     .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    if (up.length === 0) return { status: "no_events", slug: path };

    const countries = new Set(up.map(e => e.location?.address?.addressCountry).filter(Boolean));
    const cities    = new Set(up.map(e => e.location?.name || e.location?.address?.addressLocality).filter(Boolean));
    const capped = up.length >= 8;
    const tour_score = Math.round((Math.min(up.length, 8) / 8 * 100) * 0.4 + (Math.min(countries.size, 8) / 8 * 100) * 0.6);
    const next = up[0];
    return {
      status: "ok", slug: path,
      data: {
        tour_upcoming: up.length,
        tour_upcoming_capped: capped,
        tour_countries: countries.size,
        tour_cities: cities.size,
        tour_next_date: next?.startDate?.slice(0, 10) ?? null,
        tour_next_city: next?.location?.name ?? next?.location?.address?.addressLocality ?? null,
        tour_next_country: next?.location?.address?.addressCountry ?? null,
        tour_score,
      },
    };
  } catch (e) {
    return { status: "error", msg: e.response?.status || e.message?.slice(0, 60) };
  }
}

module.exports = { getTourDensity };
