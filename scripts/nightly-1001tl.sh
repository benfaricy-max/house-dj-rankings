#!/usr/bin/env bash
#
# Nightly 1001Tracklists set-crawl refresh (local-only).
#
# The set-crawl needs the local interceptor API on localhost:3001, which CI can't
# reach — so this runs on Ben's machine via a launchd agent (see
# ~/Library/LaunchAgents/com.peaktime.nightly1001tl.plist). It:
#   1. starts the interceptor API,
#   2. runs backend/enrich1001.js (weekly-chart backfill + block-aware set-crawl),
#   3. stops the interceptor,
#   4. commits ONLY the 1001TL data files (never sweeps up frontend WIP),
#   5. rebases past the daily refresh and pushes.
#
# Safe to run by hand any time:  bash scripts/nightly-1001tl.sh
# Override caps for a quick test: TL_SETCRAWL_SETS=5 BACKFILL_WEEKS=2 bash scripts/nightly-1001tl.sh
#
set -uo pipefail

# launchd starts with a minimal PATH — make tools resolvable.
export PATH="/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

# Resolve repo root from this script's location (scripts/ -> repo root).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/.." && pwd)"
INTERCEPT_DIR="${INTERCEPT_DIR:-/Users/benjaminfaricy/intercept}"
LOG="${TL_NIGHTLY_LOG:-$HOME/Library/Logs/peaktime-nightly-1001tl.log}"
PORT=3001

log() { printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" | tee -a "$LOG"; }

mkdir -p "$(dirname "$LOG")"
log "──────── nightly 1001TL refresh start ────────"
log "repo=$REPO intercept=$INTERCEPT_DIR"

# Only these files may be committed — never `git add -A` (protects frontend WIP).
DATA_FILES=(
  "frontend/public/rankings.json"
  "frontend/public/tracklists.json"
  "backend/artists.json"
  "backend/tracklists-archive.json"
  "backend/tracklists-setplays.json"
)

cleanup_server() {
  [ -n "${SRV_PID:-}" ] && kill -9 "$SRV_PID" 2>/dev/null
  pkill -f "tsx.*apps/api" 2>/dev/null
  lsof -ti:$PORT 2>/dev/null | xargs kill -9 2>/dev/null
}
trap cleanup_server EXIT

# ── 1. Start interceptor API ────────────────────────────────────────────────
cleanup_server; sleep 1
if [ ! -d "$INTERCEPT_DIR" ]; then log "ERROR: interceptor dir not found — aborting (data preserved)."; exit 1; fi
( cd "$INTERCEPT_DIR" && pnpm --filter api dev ) > "/tmp/peaktime-intercept.log" 2>&1 &
SRV_PID=$!
log "interceptor starting (pid $SRV_PID), waiting for health…"
HEALTHY=false
for _ in $(seq 1 40); do
  if curl -s -m 3 "localhost:$PORT/health" | grep -q '"ok"'; then HEALTHY=true; break; fi
  sleep 1
done
if [ "$HEALTHY" != true ]; then
  log "ERROR: interceptor never went healthy — aborting (data preserved). See /tmp/peaktime-intercept.log"
  exit 1
fi
log "interceptor healthy."

# ── 1b. Warm-up gate ─────────────────────────────────────────────────────────
# /health goes green before the headless browser + guid harvest are ready, so the
# FIRST hit to a deep 1001 endpoint can 502 and make enrich skip the whole run.
# Poll the real chart endpoint until it actually serves (HTTP 200, or 503 = a
# soft-block, which still means "reachable" — enrich is block-tolerant). Only then
# run enrich. Up to ~120s.
WARM=false
for _ in $(seq 1 12); do
  # Probe the homepage-backed /latest (cheapest 1001 route, not deep-gated). Once
  # it serves, the fetch path + guid harvest are ready. Paced at ~8s to respect the
  # interceptor's 8/min outbound limit (don't burn the budget warming up).
  CODE=$(curl -s -m 15 -o /dev/null -w '%{http_code}' "localhost:$PORT/api/1001tracklists/latest" 2>/dev/null)
  if [ "$CODE" = "200" ] || [ "$CODE" = "503" ]; then WARM=true; log "1001 fetch path warm (HTTP $CODE)."; break; fi
  sleep 8
done
if [ "$WARM" != true ]; then
  log "ERROR: 1001 endpoint never served (last HTTP ${CODE:-?}) — aborting (data preserved)."
  exit 1
fi

# ── 2. Run enrich (weekly backfill + block-aware set-crawl) ──────────────────
log "running enrich1001.js…"
ENRICH_OUT="$(cd "$REPO" && node backend/enrich1001.js 2>&1)"
ENRICH_RC=$?
printf '%s\n' "$ENRICH_OUT" | tee -a "$LOG"
log "enrich exit code: $ENRICH_RC"

# enrich returns 0 even when it SKIPS (API unreachable/cold). Only treat as a real
# refresh if it printed its success summary — otherwise do NOT commit (a skip must
# never produce a commit, and must never sweep unrelated working-tree data).
if ! printf '%s' "$ENRICH_OUT" | grep -q '^1001TL:'; then
  log "enrich did not complete a refresh (skipped) — leaving git untouched. Done."
  exit 0
fi

# ── 3. Stop interceptor ──────────────────────────────────────────────────────
cleanup_server
log "interceptor stopped."

# ── 4+5. Commit ONLY the data files, rebase, push ───────────────────────────
cd "$REPO" || exit 1
# Stage only existing data files that actually changed.
to_add=()
for f in "${DATA_FILES[@]}"; do [ -f "$f" ] && to_add+=("$f"); done
git add -- "${to_add[@]}" 2>/dev/null

if git diff --cached --quiet; then
  log "no data changes to commit — nothing to push. Done."
  exit 0
fi

CHANGED=$(git diff --cached --name-only | tr '\n' ' ')
git commit -q -m "chore: nightly 1001TL set-crawl refresh

Automated DJ-support data (weekly chart backfill + set-crawl). Files: $CHANGED

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>" \
  && log "committed: $CHANGED"

# Rebase past the daily refresh (autostash protects any other WIP), then push.
if git pull --rebase --autostash origin main >>"$LOG" 2>&1; then
  if git push origin main >>"$LOG" 2>&1; then
    log "pushed to origin/main. Done."
  else
    log "ERROR: push failed (commit is local — will retry next run). Check auth/keychain."
    exit 1
  fi
else
  log "ERROR: rebase failed — aborting rebase, leaving commit local for next run."
  git rebase --abort 2>/dev/null
  exit 1
fi

log "──────── nightly 1001TL refresh complete ────────"
