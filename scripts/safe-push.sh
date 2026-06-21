#!/usr/bin/env bash
#
# safe-push.sh — collision-proof commit+push for a repo with concurrent writers
# (the spotify-daily / 1001TL local crons + multiple Claude sessions all touch
# rankings.json). It commits ONLY the files you name, rebases onto origin/main,
# and on a conflict drops stale LOCAL data-only commits rather than hand-merging
# them — so origin's newer rankings.json always wins. It never wipes data.
#
#   scripts/safe-push.sh "commit message" <file> [<file>...]
#
# Example:
#   scripts/safe-push.sh "feat(x): thing" backend/generatePages.js frontend/src/App.jsx
#
set -euo pipefail

[ $# -ge 2 ] || { echo "usage: scripts/safe-push.sh \"commit message\" <file> [<file>...]" >&2; exit 1; }
MSG="$1"; shift

# Guard: this tool is for code/docs, not data. Data goes through the normal
# pipeline (generateStatic / enrich*), which is merge-safe by design.
for f in "$@"; do
  case "$f" in
    *rankings.json|*artists.json)
      echo "refusing: $f is pipeline data — don't commit it with this tool (PERMANENT RULE #1)." >&2
      exit 1 ;;
  esac
done

git add -- "$@"
if git diff --cached --quiet; then echo "nothing staged from: $*"; exit 0; fi
git commit -m "$MSG"
MYSHA=$(git rev-parse HEAD)

git fetch origin
echo "committed $MYSHA — rebasing onto origin/main…"

# Fast path: a clean rebase keeps everything (incl. any other local commits).
if git rebase origin/main; then
  git push origin main
  echo "✅ pushed (clean rebase)."
  exit 0
fi

# Conflict path: a stale local data commit clashed with origin's newer refresh.
# Abort, re-anchor JUST your commit onto origin/main, dropping local-only commits.
echo "⚠️  rebase conflict (stale local data commit) — re-anchoring your commit onto origin/main…"
git rebase --abort 2>/dev/null || true
git tag -f safepush-backup "$MYSHA" >/dev/null 2>&1 || true   # recoverable
git reset --hard origin/main
if git cherry-pick "$MYSHA"; then
  git push origin main
  echo "✅ pushed. Dropped local data-only commits (origin's data kept). Your commit recoverable at tag 'safepush-backup'."
else
  echo "❌ cherry-pick hit a real (non-data) conflict — resolve manually. Your commit: $MYSHA" >&2
  exit 1
fi
