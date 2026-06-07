import { useCallback, useEffect, useState } from "react";

// ── Watchlist + momentum-spike alerts (client-side, no backend) ──────────────
// The research (Cookiy AI, P3 "The Strategic Pragmatist") said the data feels
// static — managers need to know *when* an artist is moving so they can time a
// negotiation. Until server-push email alerts exist (roadmap), this delivers the
// same timing value locally: a manager stars the acts they represent / track, and
// on each return visit we compare each watched artist's momentum_score against the
// value last seen on this device. Anything that jumped surfaces as an alert.
//
// Honest limits: device-local (no cross-device sync), fires on revisit (not push).
// Server-stored watchlists + email/push are the hardening path.

const WATCH_KEY = "pt_watchlist";       // string[] of artist names
const SNAP_KEY  = "pt_momentum_snap";   // { [name]: { m: number, t: epoch } }

// A spike is meaningful if momentum climbed by at least this many points,
// or crossed into "hot" (≥65) since the last visit.
export const SPIKE_DELTA = 6;
export const HOT_THRESHOLD = 65;

function readJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function writeJSON(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* private mode / quota */ }
}

export function useWatchlist() {
  const [watched, setWatched] = useState(() => new Set(readJSON(WATCH_KEY, [])));

  const persist = useCallback(next => {
    setWatched(next);
    writeJSON(WATCH_KEY, [...next]);
  }, []);

  const toggle = useCallback(name => {
    setWatched(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      writeJSON(WATCH_KEY, [...next]);
      return next;
    });
  }, []);

  const isWatched = useCallback(name => watched.has(name), [watched]);

  return { watched, isWatched, toggle, persist };
}

// Compare current momentum against the last-seen snapshot for watched artists.
// Returns the artists that spiked, plus an `ack()` to record the new baseline so
// each spike is shown once. New watches (no prior snapshot) seed silently.
export function detectSpikes(rankings, watched) {
  const snap = readJSON(SNAP_KEY, {});
  const spikes = [];
  const nextSnap = { ...snap };
  const now = Date.now();

  for (const a of rankings) {
    if (!watched.has(a.name)) continue;
    const m = a.momentum_score;
    if (!Number.isFinite(m)) continue;
    const prev = snap[a.name];
    if (prev && Number.isFinite(prev.m)) {
      const delta = m - prev.m;
      const crossedHot = m >= HOT_THRESHOLD && prev.m < HOT_THRESHOLD;
      if (delta >= SPIKE_DELTA || crossedHot) {
        spikes.push({ name: a.name, from: Math.round(prev.m), to: Math.round(m), delta: Math.round(delta), crossedHot });
      }
    }
    // Always refresh the baseline to the value just observed.
    nextSnap[a.name] = { m, t: now };
  }
  // Drop snapshots for artists no longer watched, so the store doesn't grow forever.
  for (const name of Object.keys(nextSnap)) {
    if (!watched.has(name)) delete nextSnap[name];
  }

  const ack = () => writeJSON(SNAP_KEY, nextSnap);
  return { spikes, ack };
}

// Hook wrapper: runs spike detection once rankings + watchlist are ready, and
// exposes the current alert list with a dismiss that acknowledges the baseline.
export function useMomentumAlerts(rankings, watched) {
  const [alerts, setAlerts] = useState([]);
  const [ackFn, setAckFn] = useState(() => () => {});

  useEffect(() => {
    if (!rankings.length || watched.size === 0) { setAlerts([]); return; }
    const { spikes, ack } = detectSpikes(rankings, watched);
    setAlerts(spikes);
    setAckFn(() => ack);
  }, [rankings, watched]);

  const dismiss = useCallback(() => { ackFn(); setAlerts([]); }, [ackFn]);

  return { alerts, dismiss };
}
