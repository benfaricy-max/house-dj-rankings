/**
 * CLI for the reusable Lineup Intelligence generator.
 *   node backend/makeLineupReport.js backend/lineups/<slug>.json
 *
 * Reads a lineup config (see backend/lineups/README.md), pulls live PEAKTIME
 * signals, auto-derives the picks, and writes the report to
 * frontend/public/reports/<slug>/index.html. Feature on the Reports page by
 * adding the slug there (same as the existing III Points / CRSSD reports).
 */
const fs = require("fs");
const path = require("path");
const { generateLineupReport } = require("./lineupReport");

const file = process.argv[2];
if (!file) { console.error("usage: node backend/makeLineupReport.js <config.json>"); process.exit(1); }

const config = JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
const r = generateLineupReport(config);
console.log(`Wrote ${r.path}`);
console.log(`  ${r.acts} acts · ${r.tracked} tracked · est. budget ${r.total.toLocaleString()}`);
console.log(`  smartest buy → ${r.smartest || "—"} · breakout → ${r.breakout || "—"}`);
