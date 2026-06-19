#!/usr/bin/env node
//
// CI data guard — enforces PERMANENT RULE #1 ("NEVER WIPE DATA") in the pipeline,
// not just inside the enrich scripts. The scripts are individually merge-safe,
// but a guard at the gate catches the failure modes they can't: a corrupt write,
// a generateStatic crash that emits a stub file, a bad merge, or a roster that
// silently collapsed. If the freshly-generated rankings.json has far fewer
// artists — or is far smaller on disk — than the version already committed, this
// FAILS the workflow so the shrunken data is never committed or deployed.
//
// Run from the repo root (CI does). Locally: `node backend/ciDataGuard.js`.
//
// Tunable via env MIN_RETAIN (default 0.90 → allow at most a 10% drop). A real
// roster shrinks only by deliberate pruning; a >10% overnight drop is a bug.

const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const REL_PATH = "frontend/public/rankings.json";
const MIN_RETAIN = Number(process.env.MIN_RETAIN || "0.90");

function countArtists(json) {
  // rankings.json shape: { rankings: [...], onesToWatch: [...], movers, lastUpdated }
  return Array.isArray(json?.rankings) ? json.rankings.length : 0;
}

function fail(msg) {
  // `::error::` renders as a red annotation in the GitHub Actions UI.
  console.error(`::error::data guard: ${msg}`);
  process.exit(1);
}

const newPath = path.resolve(process.cwd(), REL_PATH);
if (!fs.existsSync(newPath)) fail(`${REL_PATH} not found in the working tree, generateStatic did not produce it.`);

const newRaw = fs.readFileSync(newPath, "utf8");
const newBytes = Buffer.byteLength(newRaw);

let newJson;
try {
  newJson = JSON.parse(newRaw);
} catch (e) {
 fail(`${REL_PATH} is not valid JSON (${e.message}), refusing to commit a corrupt index.`);
}
const newCount = countArtists(newJson);
if (newCount === 0) fail(`${REL_PATH} has an empty "rankings" array, refusing to wipe the index.`);

// Read the previously committed version. First refresh / brand-new file → nothing
// to compare against, so let it through.
let oldRaw;
try {
  oldRaw = execSync(`git show HEAD:${REL_PATH}`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 });
} catch {
 console.log(`data guard: no committed ${REL_PATH} at HEAD: first run, skipping comparison.`);
 console.log(`data guard: new file OK: ${newCount} artists, ${(newBytes / 1e6).toFixed(2)} MB.`);
  process.exit(0);
}

const oldBytes = Buffer.byteLength(oldRaw);
let oldCount = 0;
try { oldCount = countArtists(JSON.parse(oldRaw)); } catch { /* old was unparseable, don't block on it */ }

const minCount = Math.floor(oldCount * MIN_RETAIN);
const minBytes = Math.floor(oldBytes * MIN_RETAIN);

console.log(
  `data guard: artists ${oldCount} → ${newCount} (floor ${minCount}); ` +
  `bytes ${(oldBytes / 1e6).toFixed(2)}MB → ${(newBytes / 1e6).toFixed(2)}MB (floor ${(minBytes / 1e6).toFixed(2)}MB); ` +
  `retain ≥ ${(MIN_RETAIN * 100).toFixed(0)}%.`
);

if (oldCount > 0 && newCount < minCount) {
 fail(`artist count dropped ${oldCount} → ${newCount} (more than the ${((1 - MIN_RETAIN) * 100).toFixed(0)}% allowed). Data loss suspected, blocking commit.`);
}
if (oldBytes > 0 && newBytes < minBytes) {
 fail(`rankings.json shrank ${(oldBytes / 1e6).toFixed(2)}MB → ${(newBytes / 1e6).toFixed(2)}MB (more than the ${((1 - MIN_RETAIN) * 100).toFixed(0)}% allowed). Data loss suspected, blocking commit.`);
}

console.log("data guard: passed, index is intact.");
