const axios = require("axios");

const delay = ms => new Promise(r => setTimeout(r, ms));

// Serialize requests to avoid rate limits — 800ms between each call
let queue = Promise.resolve();
function enqueue(fn) {
  queue = queue.then(() => delay(800)).then(fn);
  return queue;
}

// Google Trends unofficial JSON endpoint
async function getGoogleTrends(artistName) {
  return enqueue(async () => {
    try {
      const now = new Date();
      const twoWeeksAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);
      const startTime = twoWeeksAgo.toISOString().split("T")[0];
      const endTime   = now.toISOString().split("T")[0];

      // Step 1: get a comparison token
      const widgetRes = await axios.get(
        "https://trends.google.com/trends/api/explore",
        {
          params: {
            hl: "en-US",
            tz: "-60",
            req: JSON.stringify({
              comparisonItem: [{ keyword: artistName, geo: "", time: `${startTime} ${endTime}` }],
              category: 0,
              property: "",
            }),
          },
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
          },
        }
      );

      // Strip the ")]}',\n" XSSI prefix Google prepends
      const widgetJson = JSON.parse(widgetRes.data.replace(/^\)\]\}',\n/, ""));
      const widget = widgetJson.widgets?.find(w => w.id === "TIMESERIES");
      if (!widget) return { score: 0, direction: "stable" };

      await delay(400);

      // Step 2: fetch time-series data using the token
      const dataRes = await axios.get(
        "https://trends.google.com/trends/api/widgetdata/multiline",
        {
          params: {
            hl: "en-US",
            tz: "-60",
            req: JSON.stringify(widget.request),
            token: widget.token,
            csvFormatType: "APPLICATION_CSV",
          },
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36",
          },
        }
      );

      const dataJson = JSON.parse(dataRes.data.replace(/^\)\]\}',\n/, ""));
      const timeline = dataJson?.default?.timelineData || [];
      if (timeline.length === 0) return { score: 0, direction: "stable" };

      const values = timeline.map(t => t.value?.[0] ?? 0);
      const mid = Math.floor(values.length / 2);
      const avg = arr => arr.reduce((s, v) => s + v, 0) / (arr.length || 1);
      const recent = avg(values.slice(mid));
      const prior  = avg(values.slice(0, mid));

      const score = Math.round(recent);
      const delta = prior > 0 ? ((recent - prior) / prior) * 100 : 0;
      const direction = delta > 5 ? "rising" : delta < -5 ? "falling" : "stable";

      return { score, direction };
    } catch (err) {
      console.warn(`[Trends] Failed for "${artistName}":`, err.response?.status ?? err.message?.slice(0, 80));
      return { score: 0, direction: "stable" };
    }
  });
}

module.exports = { getGoogleTrends };
