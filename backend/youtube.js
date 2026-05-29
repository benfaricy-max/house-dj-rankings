const axios = require("axios");

// Search for a channel by query, return subscriber count + channel URL
async function getChannelData(query) {
  const searchRes = await axios.get("https://www.googleapis.com/youtube/v3/search", {
    params: {
      key: process.env.YOUTUBE_API_KEY,
      q: query,
      type: "channel",
      part: "snippet",
      maxResults: 1,
    },
  });

  const items = searchRes.data.items;
  if (!items || items.length === 0) return { subscribers: 0, youtubeUrl: null };

  const channelId = items[0].snippet.channelId || items[0].id.channelId;

  const statsRes = await axios.get("https://www.googleapis.com/youtube/v3/channels", {
    params: {
      key: process.env.YOUTUBE_API_KEY,
      id: channelId,
      part: "statistics",
    },
  });

  const stats = statsRes.data.items[0]?.statistics;
  return {
    subscribers: parseInt(stats?.subscriberCount || "0", 10),
    youtubeUrl: `https://www.youtube.com/channel/${channelId}`,
  };
}

module.exports = { getChannelData };
