/**
 * Tiny advisory lock so two data-writing scripts can't run at once and race on
 * rankings.json. The Spotify enrichment once spawned 6 concurrent runs that
 * stomped each other's writes (corrupted spotify_world_rank); this prevents it.
 *
 * Usage at the top of a script's main():
 *   const { acquireLock } = require("./scriptLock");
 *   const release = acquireLock("rankings-write");   // exits cleanly if held elsewhere
 *
 * A second run finds a live, fresh lock and exits 0 with a message (so an
 * unattended/nightly job just skips this cycle rather than corrupting data).
 * Override with IGNORE_LOCK=1. Stale locks (dead PID or >30 min old) are reclaimed.
 */
const fs = require("fs");
const path = require("path");
const os = require("os");

const STALE_MS = 30 * 60 * 1000;

function acquireLock(name = "rankings-write") {
  const lockPath = path.join(os.tmpdir(), `djr-${name}.lock`);
  try {
    if (fs.existsSync(lockPath)) {
      let info = {};
      try { info = JSON.parse(fs.readFileSync(lockPath, "utf8")); } catch {}
      const alive = info.pid && (() => { try { process.kill(info.pid, 0); return true; } catch { return false; } })();
      const fresh = info.ts && (Date.now() - info.ts) < STALE_MS;
      if (alive && fresh && process.env.IGNORE_LOCK !== "1") {
        console.error(`✖ "${name}" is already running (pid ${info.pid}, started ${new Date(info.ts).toISOString()}).`);
        console.error(`  Exiting to avoid racing writes on rankings.json. Set IGNORE_LOCK=1 to override.`);
        process.exit(0);
      }
      // stale or dead → reclaim
    }
    fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, ts: Date.now(), script: path.basename(process.argv[1] || "") }));
    const release = () => { try { const cur = JSON.parse(fs.readFileSync(lockPath, "utf8")); if (cur.pid === process.pid) fs.unlinkSync(lockPath); } catch {} };
    process.on("exit", release);
    process.on("SIGINT", () => { release(); process.exit(130); });
    process.on("SIGTERM", () => { release(); process.exit(143); });
    return release;
  } catch {
    return () => {};   // lock is best-effort; never block real work on a lock fs error
  }
}

module.exports = { acquireLock };
