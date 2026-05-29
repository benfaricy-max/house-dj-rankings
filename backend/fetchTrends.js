const { spawn } = require("child_process");
const path = require("path");

const SCRIPT = path.join(__dirname, "trends.py");

function getGoogleTrends(artistName) {
  return new Promise((resolve) => {
    const py = spawn("python3", [SCRIPT, artistName]);
    let out = "";
    py.stdout.on("data", d => { out += d.toString(); });
    py.stderr.on("data", () => {}); // suppress stderr noise
    py.on("close", () => {
      try {
        const result = JSON.parse(out.trim());
        resolve({
          score:         result.score         ?? 0,
          direction:     result.direction      ?? "stable",
          top_countries: result.top_countries  ?? {},
          top_us_cities: result.top_us_cities  ?? {},
        });
      } catch {
        resolve({ score: 0, direction: "stable", top_countries: {}, top_us_cities: {} });
      }
    });
    py.on("error", () => {
      resolve({ score: 0, direction: "stable", top_countries: {}, top_us_cities: {} });
    });
  });
}

module.exports = { getGoogleTrends };
