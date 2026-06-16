/**
 * Resident Advisor data via their public GraphQL API (ra.co/graphql).
 * No auth required. Returns booking-intelligence signals:
 *   - ra_followers      RA follower count (scene credibility proxy)
 *   - ra_upcoming       upcoming events count
 *   - ra_events_6m      events in last ~6 months (last 10 RA events)
 *   - ra_avg_attending  avg "attending" per recent event
 *   - ra_top_attending  peak attending count
 *   - ra_attending_h1   avg attending for events 1-5 (recent)
 *   - ra_attending_h2   avg attending for events 6-10 (older)
 *   - ra_venue_tier     median venue capacity tier 1-5
 *   - ra_countries      unique countries in recent bookings
 *   - ra_country_list   sorted country list (display)
 *   - ra_top_regions    RA's venuesMostPlayed regions (display)
 *   - ra_score          composite 0-100 booking-momentum signal
 */
const axios = require("axios");
const { computeRaScore } = require("./computeRaScore");

const RA_GQL = "https://ra.co/graphql";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36";

// Venue capacity → tier (1=tiny, 5=stadium/major festival)
const VENUE_TIERS = [
  [300,   1],
  [700,   2],
  [1500,  3],
  [5000,  4],
  [Infinity, 5],
];
function capacityToTier(capStr) {
  const cap = parseInt(capStr, 10);
  if (!cap || cap <= 0) return null;
  for (const [max, tier] of VENUE_TIERS) if (cap <= max) return tier;
  return 5;
}
function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function avg(nums) {
  if (!nums.length) return 0;
  return nums.reduce((s, x) => s + x, 0) / nums.length;
}

// RA slugs: lowercase, strip all non-alphanumeric (including accents)
function generateSlug(name) {
  return (name || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const QUERY = `
  query RArtist($slug: String!) {
    artist(slug: $slug) {
      id
      name
      urlSafeName
      followerCount
      upcomingEventsCount
      venuesMostPlayed { name capacity country { name } }
      regionsMostPlayed { name country { name } }
      past: events(type: PREVIOUS) {
        date attending isFestival
        venue { name capacity area { name } country { name } }
        country { name }
      }
    }
  }
`;

async function queryRA(slug) {
  const r = await axios.post(
    RA_GQL,
    { query: QUERY, variables: { slug } },
    { headers: { "User-Agent": UA, "Referer": "https://ra.co/", "Content-Type": "application/json" }, timeout: 12000 }
  );
  return r.data?.data?.artist ?? null;
}

// Returns { data, error } — error=true means a network/API failure (potential rate limit);
// data=null with error=false means artist not found on RA (not a failure).
async function getRAData(artistName, overrideSlug) {
  const slug = overrideSlug || generateSlug(artistName);
  if (!slug) return { data: null, error: false };

  try {
    const artist = await queryRA(slug);
    if (!artist) return { data: null, error: false };

    // Sanity check: verify name roughly matches to avoid slug collisions
    const wantNorm = generateSlug(artistName);
    const gotNorm  = generateSlug(artist.name);
    // Allow if either contains the other (catches "FISHER" → "Mike Fisher" mismatch)
    if (!overrideSlug && !gotNorm.includes(wantNorm) && !wantNorm.includes(gotNorm)) {
      return { data: null, error: false };
    }

    const events  = artist.past || [];
    const now     = Date.now();
    const SIX_M   = 180 * 864e5;

    // Filter to last 6 months; RA returns ~10 events
    const recent  = events.filter(e => (now - new Date(e.date).getTime()) < SIX_M);

    const attendingVals = recent.map(e => e.attending || 0);
    // Split into first-5 (most recent) and second-5 (older) for trajectory
    const h1 = attendingVals.slice(0, 5);  // most recent
    const h2 = attendingVals.slice(5);     // older

    const capacities = recent
      .map(e => capacityToTier(e.venue?.capacity))
      .filter(Boolean);

    const countries = [...new Set(recent.map(e => e.country?.name).filter(Boolean))];

    // Composite ra_score 0-100 — computed from the same aggregates the build
    // recomputes from, via the shared computeRaScore module. v5 weighting devalues
    // attending (soft RSVP / festival-inflated / cap-saturated) in favour of the hard
    // structural facts (venue tier = real room capacity, booking density). See
    // computeRaScore.js for the rationale and weights.
    const avgAttending = avg(attendingVals);
    const ra_score     = computeRaScore({
      ra_avg_attending: Math.round(avgAttending),
      ra_events_6m:     recent.length,
      ra_countries:     countries.length,
      ra_venue_tier:    median(capacities) || 0,
    });

    // ── Market saturation: per-city booking frequency + recency ──
    // "Overbooked" = repeated recent shows in one city. Freshness drops with
    // both frequency (shows in last 3 months) and recency of the last booking.
    const cityMap = {};
    for (const e of events) {
      const city = e.venue?.area?.name || e.venue?.country?.name || e.country?.name;
      const t = new Date(e.date).getTime();
      if (!city || !Number.isFinite(t)) continue;
      const days = Math.round((now - t) / 864e5);
      const c = cityMap[city] || (cityMap[city] = { city, country: e.venue?.country?.name || e.country?.name || null, shows: 0, shows_3m: 0, days_since: Infinity });
      c.shows++;
      if (days <= 90) c.shows_3m++;
      if (days < c.days_since) c.days_since = days;
    }
    const ra_recent_cities = Object.values(cityMap).map(c => {
      const freqPts = Math.min(c.shows_3m, 4) * 22;                                   // frequency in last 3mo
      const recPts  = c.days_since <= 21 ? 30 : c.days_since <= 45 ? 20 : c.days_since <= 90 ? 10 : 0;
      const saturation = Math.min(100, freqPts + recPts);                             // 0=fresh, 100=overbooked
      return { city: c.city, country: c.country, shows: c.shows, shows_3m: c.shows_3m, days_since: c.days_since === Infinity ? null : c.days_since, saturation };
    }).sort((a, b) => b.saturation - a.saturation).slice(0, 8);

    return {
      data: {
        ra_slug:          artist.urlSafeName,
        ra_followers:     artist.followerCount     || 0,
        ra_upcoming:      artist.upcomingEventsCount || 0,
        ra_events_6m:     recent.length,
        ra_avg_attending: Math.round(avg(attendingVals)),
        ra_top_attending: Math.max(0, ...attendingVals),
        ra_attending_h1:  Math.round(avg(h1)),   // recent 5 events avg
        ra_attending_h2:  Math.round(avg(h2)),   // older 5 events avg
        ra_venue_tier:    median(capacities) || 0,
        ra_countries:     countries.length,
        ra_country_list:  countries.sort(),
        ra_top_regions:   (artist.regionsMostPlayed || []).slice(0, 5).map(r => ({
          name: r.name,
          country: r.country?.name,
        })),
        ra_top_venues:    (artist.venuesMostPlayed || []).slice(0, 5).map(v => ({
          name: v.name,
          capacity: parseInt(v.capacity, 10) || 0,
          country: v.country?.name,
        })),
        ra_score,
        ra_recent_cities,
      },
      error: false,
    };
  } catch {
    return { data: null, error: true };
  }
}

module.exports = { getRAData, generateSlug };
