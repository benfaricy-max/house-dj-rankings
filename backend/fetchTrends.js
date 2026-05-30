const { spawn } = require("child_process");
const path = require("path");

const SCRIPT  = path.join(__dirname, "trends.py");
const TIMEOUT = 22000; // hard cap per artist so a hang never blocks the run

function getGoogleTrends(artistName) {
  return new Promise((resolve) => {
    const empty = { score: 0, direction: "stable", top_countries: {}, top_us_cities: {} };
    const py = spawn("python3", [SCRIPT, artistName]);
    let out = "";
    const timer = setTimeout(() => { py.kill(); resolve(empty); }, TIMEOUT);
    py.stdout.on("data", d => { out += d.toString(); });
    py.stderr.on("data", () => {});
    py.on("close", () => {
      clearTimeout(timer);
      try {
        const r = JSON.parse(out.trim());
        resolve({
          score:         r.score         ?? 0,
          direction:     r.direction      ?? "stable",
          top_countries: r.top_countries  ?? {},
          top_us_cities: r.top_us_cities  ?? {},
        });
      } catch { resolve(empty); }
    });
    py.on("error", () => { clearTimeout(timer); resolve(empty); });
  });
}

module.exports = { getGoogleTrends };
