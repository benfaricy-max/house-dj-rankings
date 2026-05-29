function normalize(value, min, max) {
  if (max === min) return 0;
  return ((value - min) / (max - min)) * 100;
}

function scoreArtists(artists) {
  const metrics = ["spotify_followers", "spotify_monthly_listeners", "youtube_subscribers", "youtube_total_views"];

  const ranges = {};
  for (const m of metrics) {
    const values = artists.map(a => a[m] || 0);
    ranges[m] = { min: Math.min(...values), max: Math.max(...values) };
  }

  const weights = {
    spotify_followers: 0.25,
    spotify_monthly_listeners: 0.30,
    youtube_subscribers: 0.20,
    youtube_total_views: 0.25,
  };

  return artists
    .map(artist => {
      let score = 0;
      for (const [metric, weight] of Object.entries(weights)) {
        const norm = normalize(artist[metric] || 0, ranges[metric].min, ranges[metric].max);
        score += norm * weight;
      }
      return { ...artist, score: Math.round(score * 10) / 10 };
    })
    .sort((a, b) => b.score - a.score)
    .map((artist, i) => ({ ...artist, rank: i + 1 }));
}

module.exports = { scoreArtists };
