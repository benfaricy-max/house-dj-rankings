const axios = require("axios");

async function getMixcloudData(username) {
  if (!username) return { mixcloud_followers: 0, mixcloud_recent_plays: 0, mixcloud_play_count_total: 0 };
  try {
    const [profileRes, uploadsRes] = await Promise.all([
      axios.get(`https://api.mixcloud.com/${username}/`),
      axios.get(`https://api.mixcloud.com/${username}/cloudcasts/`, { params: { limit: 5 } }),
    ]);

    const recentPlays = uploadsRes.data.data.reduce(
      (sum, mix) => sum + (mix.play_count || 0), 0
    );

    return {
      mixcloud_followers:         profileRes.data.follower_count   ?? 0,
      mixcloud_recent_plays:      recentPlays,
      mixcloud_play_count_total:  profileRes.data.play_count       ?? 0,
    };
  } catch (err) {
    console.warn(`[Mixcloud] Failed for ${username}:`, err.message?.slice(0, 60));
    return { mixcloud_followers: 0, mixcloud_recent_plays: 0, mixcloud_play_count_total: 0 };
  }
}

module.exports = { getMixcloudData };
