import { useState } from "react";
import { startCheckout, checkoutReady } from "./usePro";
import "./ReportCTA.css";

// PATH 1 — the one-off Fair Value Report purchase (£29, no subscription).
//
// Aimed at the *sell side*: the DJ, manager or agent who wants the demand data
// about their own act to take into a fee conversation. The negotiation script
// already has a seller framing — this turns it into a finished, paid artefact:
// a verified, downloadable report + a private pitch link they can forward.
//
// Self-serve and gatekeeper-free: an artist buys it for themselves at an impulse
// price; no promoter call required. Renders only once checkout is wired
// (checkoutReady) so the live open site is unchanged until Stripe is deployed.
//
// `artist` = the ranking row this report is for. We pass its slug + name to
// Stripe as metadata so each sale records which act was bought.
export default function ReportCTA({ artist }) {
  const [busy, setBusy] = useState(false);
  if (!checkoutReady || !artist) return null;

  const slug = (artist.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const buy = async () => {
    if (busy) return;
    setBusy(true);
    if (typeof window.gtag === "function") {
      window.gtag("event", "report_checkout_start", { artist: slug, source: "value-report" });
    }
    try {
      await startCheckout("report", { meta: { artist: slug, name: artist.name, source: "value-report", side: "seller" } });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rcta">
      <div className="rcta-body">
        <div className="rcta-eyebrow">Take this to the table</div>
        <div className="rcta-h">Your verified Fair Value Report for {artist.name}</div>
        <p className="rcta-sub">
          A clean, branded PDF of this benchmark plus a private pitch link to forward — the neutral
          number that backs your fee, so you negotiate from data, not gut feel. One-off. No subscription.
        </p>
        <ul className="rcta-feats">
          <li>Demand-implied fee band with confidence + evidence</li>
          <li>Local fee comps from acts who fill the same rooms</li>
          <li>Ready-to-send negotiation line, seller-framed</li>
          <li>A private, expiring pitch link to share one-to-one</li>
        </ul>
      </div>
      <div className="rcta-buy">
        <div className="rcta-price"><span className="rcta-amount">£29</span><span className="rcta-cadence">one-off</span></div>
        <button className="rcta-btn" onClick={buy} disabled={busy}>
          {busy ? "Opening checkout…" : "Get the report →"}
        </button>
        <div className="rcta-fine">Secure checkout via Stripe · instant access</div>
      </div>
    </div>
  );
}
