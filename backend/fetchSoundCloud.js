const axios = require("axios");

// SoundCloud public API requires a client_id obtained from their web app.
// Add SOUNDCLOUD_CLIENT_ID to your .env.
// To find yours: open soundcloud.com, open DevTools Network tab, look for
// requests to api-v2.soundcloud.com and copy the client_id query param.

const BASE = "https://api-v2.soundcloud.com";

async function getSoundCloudData(permalink) {
  const clientId = process.env.SOUNDCLOUD_CLIENT_ID;

  if (!clientId || !permalink) {
    return { soundcloud_followers: 0, soundcloud_recent_plays: 0, soundcloud_reposts: 0 };
  }

  try {
    // Resolve the user profile from their permalink URL
    const resolveRes = await axios.get(`${BASE}/resolve`, {
      params: {
        url: `https://soundcloud.com/${permalink}`,
        client_id: clientId,
      },
    });

    const user = resolveRes.data;
    const userId = user.id;
    const soundcloud_followers = user.followers_count || 0;

    // Fetch their 10 most recent tracks for play + repost counts
    const tracksRes = await axios.get(`${BASE}/users/${userId}/tracks`, {
      params: {
        client_id: clientId,
        limit: 10,
        linked_partitioning: 1,
      },
    });

    const tracks = tracksRes.data.collection || [];
    const soundcloud_recent_plays = tracks.reduce((sum, t) => sum + (t.playback_count || 0), 0);
    const soundcloud_reposts      = tracks.reduce((sum, t) => sum + (t.reposts_count  || 0), 0);

    return { soundcloud_followers, soundcloud_recent_plays, soundcloud_reposts };
  } catch (err) {
    console.warn(`[SoundCloud] Failed for ${permalink}:`, err.response?.status ?? err.message);
    return { soundcloud_followers: 0, soundcloud_recent_plays: 0, soundcloud_reposts: 0 };
  }
}

module.exports = { getSoundCloudData };
