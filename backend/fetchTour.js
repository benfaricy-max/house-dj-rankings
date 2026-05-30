/**
 * Tour density signal (Songkick, no API key — public pages + schema.org ld+json).
 * Touring activity = strong revenue/demand signal for bookers.
 * search → slug-matched artist page → upcoming MusicEvents (count, countries, next show).
 */
const axios = require("axios");

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36";
const norm = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const get = url => axios.get(url, { headers: { "User-Agent": UA }, timeout: 14000 });

async function getTourDensity(name) {
  try {
    // 1. search → pick the artist link whose slug matches the name
    const s = await get(`https://www.songkick.com/search?query=${encodeURIComponent(name)}&type=artists`);
    const paths = [...s.data.matchAll(/href="(\/artists\/[0-9]+-[^"\/]+)"/g)].map(m => m[1]);
    const want = norm(name);
    const path = paths.find(p => {
      const slug = p.split("-").slice(1).join("-");
      return norm(slug) === want || norm(slug).startsWith(want) || want.startsWith(norm(slug));
    });
    if (!path) return null;

    // 2. artist page → parse ld+json MusicEvents
    const page = await get(`https://www.songkick.com${path}`);
    const blocks = [...page.data.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
      .map(x => { try { return JSON.parse(x[1]); } catch { return null; } }).filter(Boolean);
    const events = [];
    for (const b of blocks) for (const e of (Array.isArray(b) ? b : [b])) if (e["@type"] === "MusicEvent") events.push(e);

    const now = Date.now();
    const up = events.filter(e => e.startDate && new Date(e.startDate).getTime() >= now)
                     .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    const countries = new Set(up.map(e => e.location?.address?.addressCountry).filter(Boolean));
    const cities    = new Set(up.map(e => e.location?.name || e.location?.address?.addressLocality).filter(Boolean));
    const capped = up.length >= 8;  // Songkick artist page shows ~8 — treat as "8+"

    const eventScore = Math.min(up.length, 8) / 8 * 100;
    const geoScore   = Math.min(countries.size, 8) / 8 * 100;
    const tour_score = Math.round(eventScore * 0.4 + geoScore * 0.6);

    const next = up[0];
    return {
      tour_upcoming: up.length,
      tour_upcoming_capped: capped,
      tour_countries: countries.size,
      tour_cities: cities.size,
      tour_next_date: next?.startDate?.slice(0, 10) ?? null,
      tour_next_city: next?.location?.name ?? next?.location?.address?.addressLocality ?? null,
      tour_next_country: next?.location?.address?.addressCountry ?? null,
      tour_score,
    };
  } catch {
    return null;
  }
}

module.exports = { getTourDensity };
