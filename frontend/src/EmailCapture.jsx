import { useState } from "react";
import "./EmailCapture.css";

// Owned-channel capture for the media-brand pivot. The newsletter list is the
// asset every revenue line prices off — and what matters is *list density*
// (working bookers vs fans), so we capture a role segment at signup, not just
// an email. See COMMERCE.md / the Pivot-2 plan.
//
// No server required. ESP = Buttondown: we POST form-encoded to its public
// embed endpoint (no secret key — the username is public, it's in the URL).
// The role is sent as BOTH a tag and metadata so the list is segmentable by
// working-booker vs fan (the metric the whole revenue model prices off).
//
// ⚙️ TO GO LIVE: set BUTTONDOWN_USERNAME below to your Buttondown username
// (or set VITE_BUTTONDOWN_USERNAME at build time). Until it's set, signups are
// kept locally (pt_newsletter_signups) so the UI is real and nothing is lost.
const BUTTONDOWN_USERNAME = import.meta.env.VITE_BUTTONDOWN_USERNAME || "";
const BUTTONDOWN_ENDPOINT = BUTTONDOWN_USERNAME
  ? `https://buttondown.com/api/emails/embed-subscribe/${BUTTONDOWN_USERNAME}`
  : "";

const ROLES = [
  { key: "agent",     label: "Agent" },
  { key: "promoter",  label: "Promoter" },
  { key: "festival",  label: "Festival / buyer" },
  { key: "label",     label: "Label" },
  { key: "other",     label: "Fan / other" },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function stashLocally(entry) {
  try {
    const key = "pt_newsletter_signups";
    const prev = JSON.parse(localStorage.getItem(key) || "[]");
    prev.push(entry);
    localStorage.setItem(key, JSON.stringify(prev));
  } catch { /* private mode / quota — non-fatal */ }
}

export default function EmailCapture({
  source = "site",
  heading = "Get the PEAKTIME Index",
  sub = "The monthly booking-demand index — who's rising, who's mispriced, and where — in your inbox. Free, neutral, no hype.",
  compact = false,
}) {
  const [email, setEmail] = useState("");
  const [role, setRole]   = useState("");
  const [state, setState] = useState("idle"); // idle | submitting | done | error
  const [err, setErr]     = useState("");

  async function submit(e) {
    e.preventDefault();
    if (state === "submitting") return;
    if (!EMAIL_RE.test(email.trim())) { setErr("Enter a valid email."); setState("error"); return; }

    setState("submitting"); setErr("");
    const entry = { email: email.trim(), role: role || "other", source, ts: new Date().toISOString() };
    // Always keep a local copy — a backstop if the ESP call fails, and the only
    // store at all until BUTTONDOWN_USERNAME is set.
    stashLocally(entry);

    try {
      if (BUTTONDOWN_ENDPOINT) {
        // Buttondown's embed endpoint is opaque to fetch (no CORS headers), so
        // we send no-cors form-encoded: the subscriber is created, but we can't
        // read the response — so we optimistically confirm. Role rides as a tag
        // (filterable) AND metadata. `embed=1` marks it a non-API signup.
        const body = new URLSearchParams();
        body.set("email", entry.email);
        body.set("embed", "1");
        body.set("tag", entry.role);
        body.set("metadata__role", entry.role);
        body.set("metadata__source", source);
        await fetch(BUTTONDOWN_ENDPOINT, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body.toString(),
        });
      }
      if (typeof window.gtag === "function") {
        window.gtag("event", "newsletter_signup", { source, role: entry.role });
      }
      setState("done");
    } catch (ex) {
      // Network failure — the local copy above means it isn't lost.
      setErr("Network hiccup — we saved your email and will add you to the list.");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className={`ec ${compact ? "ec--compact" : ""} ec--done`}>
        <div className="ec-done-mark" aria-hidden="true">✓</div>
        <div>
          <div className="ec-done-title">You're on the list.</div>
          <div className="ec-done-sub">The next Index drop lands on the 1st. Watch for it.</div>
        </div>
      </div>
    );
  }

  return (
    <form className={`ec ${compact ? "ec--compact" : ""}`} onSubmit={submit}>
      {!compact && (
        <div className="ec-copy">
          <div className="ec-heading">{heading}</div>
          <p className="ec-sub">{sub}</p>
        </div>
      )}
      <div className="ec-fields">
        <input
          className="ec-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@agency.com"
          value={email}
          onChange={e => { setEmail(e.target.value); if (state === "error") setState("idle"); }}
          aria-label="Email address"
          required
        />
        <select
          className="ec-role"
          value={role}
          onChange={e => setRole(e.target.value)}
          aria-label="What you do"
        >
          <option value="">I'm a…</option>
          {ROLES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
        </select>
        <button className="ec-submit" type="submit" disabled={state === "submitting"}>
          {state === "submitting" ? "…" : "Get the Index"}
        </button>
      </div>
      {state === "error" && <div className="ec-err">{err}</div>}
      <div className="ec-fine">No spam. Unsubscribe anytime. We never sell your data — or rankings.</div>
    </form>
  );
}
