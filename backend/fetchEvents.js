const axios = require("axios");

const APP_ID = process.env.BANDSINTOWN_APP_ID || "house-dj-rankings";

async function getArtistEvents(artistName) {
  try {
    const res = await axios.get(
      `https://rest.bandsintown.com/artists/${encodeURIComponent(artistName)}/events`,
      { params: { app_id: APP_ID, date: "upcoming" }, timeout: 8000 }
    );
    if (!Array.isArray(res.data)) return [];
    return res.data.slice(0, 5).map(e => ({
      date:      e.datetime,
      venue:     e.venue?.name ?? "",
      city:      [e.venue?.city, e.venue?.country].filter(Boolean).join(", "),
      ticketUrl: e.offers?.[0]?.url ?? null,
    }));
  } catch {
    return [];
  }
}

module.exports = { getArtistEvents };
