const { spawn } = require("child_process");
const path = require("path");

const SCRIPT  = path.join(__dirname, "trends.py");
const TIMEOUT = 25000; // 25s max per artist — prevents hanging the whole run

function getGoogleTrends(artistName) {
  return new Promise((resolve) => {
    const empty = { score: 0, direction: "stable", top_countries: {}, top_us_cities: {} };
    const py = spawn("python3", [SCRIPT, artistName]);
    let out = "";

    // Kill the process if it takes too long
    const timer = setTimeout(() => {
      py.kill();
      resolve(empty);
    }, TIMEOUT);

    py.stdout.on("data", d => { out += d.toString(); });
    py.stderr.on("data", () => {});
    py.on("close", () => {
      clearTimeout(timer);
      try {
        const result = JSON.parse(out.trim());
        resolve({
          score:         result.score         ?? 0,
          direction:     result.direction      ?? "stable",
          top_countries: result.top_countries  ?? {},
          top_us_cities: result.top_us_cities  ?? {},
        });
      } catch {
        resolve(empty);
      }
    });
    py.on("error", () => { clearTimeout(timer); resolve(empty); });
  });
}

module.exports = { getGoogleTrends };
