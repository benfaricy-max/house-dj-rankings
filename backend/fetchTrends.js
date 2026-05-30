// Google Trends disabled for now — re-enable once rate limits clear
const empty = { score: 0, direction: "stable", top_countries: {}, top_us_cities: {} };
async function getGoogleTrends() { return empty; }
module.exports = { getGoogleTrends };
