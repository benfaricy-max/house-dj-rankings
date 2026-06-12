import { useEffect, useMemo, useRef, useState } from "react";
import "./Pitch.css";
import { slugify } from "./ArtistProfile";
import { valueConfidence, negotiationLine } from "./ValueGap";

// ── Private Pitch Link ───────────────────────────────────────────────────────
// The research (Cookiy AI, P4 "The Protective Gatekeeper") was explicit: managers
// want to share an artist's demand data *selectively with a promoter* — never
// publicly, never on social. A Pitch Link is that primitive: a clean, read-only,
// single-artist, branded brief at an unguessable URL with a built-in expiry. No
// public index, no site chrome, marked confidential.
//
// The underlying numbers are already public (rankings.json), so this leaks
// nothing — it *packages* them privately for a one-to-one negotiation. The token
// carries only {slug, side, expiry, note}; the page resolves the artist from the
// live data. Expiry is enforced client-side. Hardening path: server-minted,
// revocable tokens + access logging (see COMMERCE.md).

const EXPIRY_OPTIONS = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
];

// base64url so the token is URL- and copy-safe (no +/=).
const b64urlEncode = obj => btoa(unescape(encodeURIComponent(JSON.stringify(obj))))
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64urlDecode = str => {
  const pad = str.length % 4 ? "=".repeat(4 - (str.length % 4)) : "";
  return JSON.parse(decodeURIComponent(escape(atob(str.replace(/-/g, "+").replace(/_/g, "/") + pad))));
};

export function encodePitch({ slug, side, days, note }) {
  return b64urlEncode({ s: slug, side, exp: Date.now() + days * 864e5, n: note || undefined });
}
export function decodePitch(token) {
  try {
    const d = b64urlDecode(token);
    if (!d || !d.s) return { error: "invalid" };
    if (d.exp && Date.now() > d.exp) return { error: "expired", exp: d.exp };
    return { slug: d.s, side: d.side === "buyer" ? "buyer" : "seller", exp: d.exp, note: d.n };
  } catch { return { error: "invalid" }; }
}

const fmtDate = ts => new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

// Funnel instrumentation — same shape as UpgradeCTA's track(). Pitch-link
// activation lands in localStorage.peaktime_funnel alongside the upgrade funnel,
// so the whole picture is in one log. The core question this answers: do the
// private pitch links bookers generate actually get opened by the recipient?
// Inspect: JSON.parse(localStorage.peaktime_funnel).
function track(event, props) {
  try {
    window.plausible?.(event, { props });
    window.gtag?.("event", event, props);
    const log = JSON.parse(localStorage.getItem("peaktime_funnel") || "[]");
    log.push({ event, ...props, t: new Date().toISOString() });
    localStorage.setItem("peaktime_funnel", JSON.stringify(log));
  } catch { /* storage disabled — ignore */ }
}

// ── Generator modal (Pro-gated by the caller) ────────────────────────────────
export function PitchLinkModal({ artist, onClose }) {
  // Buy-side is the lead motion (STRATEGY.md / GTM.md §1, decision 2026-06-11):
  // promoters/buyers are the beachhead; the offer case is the default. Selling
  // (agent → promoter) is the expansion loop, still available via the toggle.
  const [side, setSide] = useState("buyer");
  const [days, setDays] = useState(30);
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);

  const url = useMemo(() => {
    const token = encodePitch({ slug: slugify(artist.name), side, days, note: note.trim() });
    return `${window.location.origin}${window.location.pathname}#/pitch/${token}`;
  }, [artist.name, side, days, note]);

  const copy = () => navigator.clipboard?.writeText(url).then(() => {
    setCopied(true); setTimeout(() => setCopied(false), 1900);
    track("pitch_link_copied", { artist: artist.name, side, days });
  });

  return (
    <div className="pl-overlay" onClick={onClose}>
      <div className="pl-modal" onClick={e => e.stopPropagation()}>
        <div className="pl-modal-top">
          <div className="pl-modal-title">Demand dossier · {artist.name}</div>
          <button className="pl-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <p className="pl-modal-sub">
          A read-only, expiring dossier to send one promoter directly — third-party proof of this
          artist's demand at a private URL. Not listed publicly, not indexed. The numbers are
          neutral; the framing is yours.
        </p>

        <div className="pl-field">
          <span className="pl-field-label">Framed for</span>
          <div className="pl-seg">
            <button className={side === "buyer" ? "pl-seg-on" : ""} onClick={() => setSide("buyer")}>Buying (offer case)</button>
            <button className={side === "seller" ? "pl-seg-on" : ""} onClick={() => setSide("seller")}>Selling (your fee case)</button>
          </div>
        </div>

        <div className="pl-field">
          <span className="pl-field-label">Expires in</span>
          <div className="pl-seg">
            {EXPIRY_OPTIONS.map(o => (
              <button key={o.days} className={days === o.days ? "pl-seg-on" : ""} onClick={() => setDays(o.days)}>{o.label}</button>
            ))}
          </div>
        </div>

        <div className="pl-field">
          <span className="pl-field-label">Note to recipient <em>(optional)</em></span>
          <input className="pl-input" value={note} maxLength={140} placeholder="e.g. For the Warehouse Project Q3 hold"
            onChange={e => setNote(e.target.value)} />
        </div>

        <div className="pl-urlbox">
          <input className="pl-url" readOnly value={url} onFocus={e => e.target.select()} />
          <button className="pl-copy" onClick={copy}>{copied ? "✓ Copied" : "Copy link"}</button>
        </div>
        <a className="pl-preview-link" href={`#/pitch/${encodePitch({ slug: slugify(artist.name), side, days, note: note.trim() })}`} target="_blank" rel="noreferrer">
          Preview what the recipient sees ↗
        </a>
      </div>
    </div>
  );
}

// ── The read-only pitch page (route: #/pitch/<token>) ─────────────────────────
export default function PitchPage({ rankings }) {
  const token = (window.location.hash.match(/^#\/pitch\/(.+)$/) || [])[1] || "";
  const decoded = useMemo(() => decodePitch(token), [token]);

  // Keep the private brief out of search indexes for the life of this view.
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots"; meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => { document.head.removeChild(meta); };
  }, []);

  // Recipient-activation signal: did a generated pitch link actually get opened?
  // Fires once per token, waiting for rankings to load before resolving the artist.
  const firedRef = useRef(false);
  useEffect(() => {
    if (firedRef.current) return;
    if (decoded.error) { firedRef.current = true; track("pitch_dead", { reason: decoded.error }); return; }
    if (!rankings.length) return; // data still loading — resolve on the next run
    firedRef.current = true;
    const a = rankings.find(r => slugify(r.name) === decoded.slug);
    track(a ? "pitch_opened" : "pitch_dead",
      a ? { artist: a.name, side: decoded.side } : { reason: "missing-artist", slug: decoded.slug });
  }, [token, rankings.length, decoded]);

  const back = () => { window.location.hash = ""; };

  if (decoded.error === "expired") {
    return <PitchShell><div className="pp-msg">This pitch link expired on {fmtDate(decoded.exp)}. Ask the sender for a fresh one.</div></PitchShell>;
  }
  if (decoded.error) {
    return <PitchShell><div className="pp-msg">This pitch link is invalid or incomplete.</div></PitchShell>;
  }

  const a = rankings.find(r => slugify(r.name) === decoded.slug);
  if (!rankings.length) return <PitchShell><div className="pp-msg">Loading…</div></PitchShell>;
  if (!a) return <PitchShell><div className="pp-msg">This artist is no longer in the index.</div></PitchShell>;

  const side = decoded.side;
  const seller = side !== "buyer";
  const conf = valueConfidence(a);
  const hasGap = Number.isFinite(a.value_gap) && a.booking_fee;
  const line = hasGap ? negotiationLine(a, side) : null;
  const anchor = a.value_anchor || {};

  // Demand standing — the seller-facing headline ("in demand, rising") vs a
  // neutral position read for the buyer. Momentum ≥60 reads as "rising".
  const rising = Number.isFinite(a.momentum_score) && a.momentum_score >= 60;
  const standing = seller
    ? `In demand — #${a.rank} on the index${rising ? ", and rising" : ""}.`
    : `#${a.rank} on the index${rising ? ", rising" : ""}.`;

  // Routing → exclusivity. Same aggregation as RoutingSaturation: recent shows
  // (~90d) by country. Low routing reads as scarcity (a date here is exclusive);
  // heavy routing reads as proven live demand. Both are seller-positive, honestly.
  const routing = (() => {
    const cities = Array.isArray(a.ra_recent_cities) ? a.ra_recent_cities : [];
    if (!cities.length) return null;
    const shows = cities.reduce((s, c) => s + (c.shows_3m || c.shows || 0), 0);
    if (!shows) return null;
    const countries = new Set(cities.map(c => c.country).filter(Boolean)).size;
    const selective = shows <= 3;
    const cLabel = `${countries} ${countries === 1 ? "country" : "countries"}`;
    const text = seller
      ? (selective
          ? `Selective routing — ${shows} shows in ${cLabel} over ~90 days. A date here is comparatively scarce.`
          : `Proven live demand — ${shows} shows across ${cLabel} in ~90 days. The rooms are already booking.`)
      : (selective
          ? `Lightly routed — ${shows} shows in ~90 days; room to build a standout date.`
          : `Heavily routed — ${shows} shows in ~90 days; a date in a busy region feels less exclusive.`);
    return { shows, selective, text };
  })();

  const liveStats = [
    anchor.venue_tier > 0 && { k: "Venue tier commanded", v: `${anchor.venue_tier}/5${anchor.venue_label ? ` · ${anchor.venue_label}` : ""}` },
    anchor.avg_attending > 0 && { k: "Avg live draw / show", v: `${anchor.avg_attending} (RA)` },
    (anchor.routing_countries || a.ra_countries) > 0 && { k: "Touring reach", v: `${anchor.routing_countries || a.ra_countries} countries` },
    a.ra_events_6m > 0 && { k: "Recent bookings", v: `${a.ra_events_6m} in 6 mo` },
  ].filter(Boolean);

  return (
    <PitchShell>
      <div className="pp-confidential">Confidential · prepared privately for direct negotiation — not published{decoded.exp ? ` · expires ${fmtDate(decoded.exp)}` : ""}</div>

      {decoded.note && <div className="pp-note">“{decoded.note}”</div>}

      <div className="pp-head">
        <div>
          <div className="pp-eyebrow">PEAKTIME · Neutral demand brief</div>
          <h1 className="pp-name">{a.name}</h1>
          <div className="pp-rank">#{a.rank} on the PEAKTIME demand index</div>
        </div>
        {Number.isFinite(a.momentum_score) && (
          <div className={`pp-mo ${a.momentum_score >= 65 ? "pp-mo--hot" : ""}`}>
            <div className="pp-mo-val">{a.momentum_score >= 65 ? "▲ " : ""}{a.momentum_score}</div>
            <div className="pp-mo-lbl">momentum / 100</div>
          </div>
        )}
      </div>

      <div className="pp-standing">{standing}</div>

      {hasGap && (
        <div className={`pp-verdict pp-verdict--${a.value_gap >= 1 ? "under" : a.value_gap <= -1 ? "over" : "fair"}`}>
          <div className="pp-bands">
            <div><div className="pp-band-l">{seller ? "Current ask" : "Current fee band"}</div><div className="pp-band-v">{a.booking_fee.label}</div></div>
            <div className="pp-arrow">→</div>
            <div><div className="pp-band-l">{seller ? "What the data supports" : "Demand-implied"}</div><div className="pp-band-v pp-band-v--imp">{a.demand_fee_label}</div></div>
          </div>
          <div className="pp-conf">Confidence: <strong>{conf.level}</strong> · {conf.n} of {conf.present.length || conf.n} signals corroborate</div>
        </div>
      )}

      {line && (
        <div className="pp-line">
          <div className="pp-line-l">The case, in one line</div>
          <p>{line}</p>
        </div>
      )}

      {routing && (
        <div className={`pp-routing${routing.selective ? " pp-routing--scarce" : ""}`}>
          <span className="pp-routing-dot" />{routing.text}
        </div>
      )}

      {liveStats.length > 0 && (
        <div className="pp-evidence">
          <div className="pp-evidence-h">{seller ? "What this fee is backed by" : "What the fee is anchored to"} <span>— the rooms they fill, not streaming vanity</span></div>
          <div className="pp-grid">
            {liveStats.map(s => (
              <div className="pp-stat" key={s.k}><div className="pp-stat-v">{s.v}</div><div className="pp-stat-k">{s.k}</div></div>
            ))}
          </div>
        </div>
      )}

      <div className="pp-foot">
        Demand-data only — no input from either side of the table. Methodology is public at thedjrankings.com.
        <button className="pp-explore" onClick={back}>{seller ? "Verify this on the public index →" : "Explore the full index →"}</button>
      </div>
    </PitchShell>
  );
}

function PitchShell({ children }) {
  return (
    <div className="pp-page">
      <div className="pp-sheet">{children}</div>
    </div>
  );
}
