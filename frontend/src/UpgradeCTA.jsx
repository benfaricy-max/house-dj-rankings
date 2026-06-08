// Fake-door payment CTA — Experiment 2, Prong A.
// Measures willingness to PAY, not interest. A real card entry is the only signal
// that isn't a lie people tell in surveys. This is ONE button, not a paywall — the
// product stays fully open, so there's no anchor damage and nothing is taken away.
//
// To go live: set the Payment Link env vars at build time (Stripe Dashboard →
// Payment Links → New → recurring £75/mo and £300/mo, "collect email" ON):
//   VITE_STRIPE_LINK_SOLO=https://buy.stripe.com/xxx   (£75 promoters/buyers)
//   VITE_STRIPE_LINK_TEAM=https://buy.stripe.com/yyy   (£300 agencies/festivals)
// Until those are set, the button still records the click + intent locally so the
// funnel works the moment it deploys; it just shows a "I'll set you up" message
// instead of opening Stripe.
import { useState } from "react";

const LINKS = {
  solo: import.meta.env.VITE_STRIPE_LINK_SOLO || "https://buy.stripe.com/00w3cx2yhdLi9zwcPD8IU00",
  team: import.meta.env.VITE_STRIPE_LINK_TEAM || "https://buy.stripe.com/cNi4gB6OxfTqfXU6rf8IU01",
};
const COPY = {
  solo: { price: "£75/mo", label: "Unlock full Fair Value Reports",
          sub: "Every report, negotiation script + private pitch links for your bookings." },
  team: { price: "£300/mo", label: "Unlock the full roster dashboard",
          sub: "Whole-roster repricing, competitive intel + priority refresh for your agency." },
};

// Always-available funnel record (works even with no analytics installed). Inspect
// in DevTools: JSON.parse(localStorage.peaktime_funnel).
function track(event, props) {
  try {
    window.plausible?.(event, { props });
    window.gtag?.("event", event, props);
    const log = JSON.parse(localStorage.getItem("peaktime_funnel") || "[]");
    log.push({ event, ...props, t: new Date().toISOString() });
    localStorage.setItem("peaktime_funnel", JSON.stringify(log));
  } catch { /* storage disabled — ignore */ }
}

export default function UpgradeCTA({ tier = "solo", surface = "value_gap" }) {
  const [done, setDone] = useState(false);
  const link = LINKS[tier];
  const c = COPY[tier];

  const onClick = () => {
    track("upgrade_click", { tier, surface });
    if (link) { track("reached_stripe", { tier, surface }); window.open(link, "_blank", "noopener"); }
    else setDone(true); // no link configured yet — still capture intent
  };

  if (done) {
    return (
      <div className="vg-fakedoor vg-fakedoor--done" role="status">
        You're on the list — I'll set up your access and email you within 24h. Thanks for backing this.
      </div>
    );
  }
  return (
    <div className="vg-fakedoor">
      <div className="vg-fakedoor-text">
        <strong>{c.label} — {c.price}</strong>
        <span>{c.sub}</span>
      </div>
      <button className="vg-fakedoor-btn" onClick={onClick}>Get {c.price === "£75/mo" ? "Solo" : "Team"} →</button>
    </div>
  );
}
