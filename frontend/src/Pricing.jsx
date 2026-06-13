import { useEffect } from "react";
import "./Pricing.css";
import { startCheckout } from "./usePro";

// Two-tier pricing presentation (#7). Concrete tiers from the booker research:
// a solo plan for an individual promoter/buyer, a team plan for agencies/festivals.
// This is presentation only - the paywall stays OFF by default (usePro/PAYWALL),
// so the live site is unchanged until VITE_PAYWALL_ENABLED=true + Stripe is wired
// (see COMMERCE.md). startCheckout(plan) maps to STRIPE_PRICE_SOLO / _TEAM.

export const PLANS = [
  {
    id: "solo",
    name: "Solo",
    price: "£75",
    cadence: "/mo",
    who: "Independent promoters & buyers",
    cta: "Start Solo",
    features: [
      "Full demand-ranked lineup - every act, not just the headliner",
      "Fair Value Reports + ready-to-paste negotiation scripts",
      "Private, expiring pitch links to share with a promoter",
      "Routing-saturation & Club-vs-Viral read on every act",
    ],
  },
  {
    id: "team",
    name: "Team",
    price: "£300",
    cadence: "/mo",
    who: "Agencies & festivals",
    highlight: true,
    cta: "Start Team",
    features: [
      "Everything in Solo, across multiple seats",
      "Roster routing & competitive intel across your whole book",
      "Calibrated sell-through + saturation alerts by market",
      "Priority data refresh and early access to new signals",
    ],
  },
];

export function PricingTiers({ onClose }) {
  return (
    <div className="pricing-grid">
      {PLANS.map(p => (
        <div key={p.id} className={`pricing-card${p.highlight ? " pricing-card--hl" : ""}`}>
          {p.highlight && <div className="pricing-ribbon">Most popular</div>}
          <div className="pricing-name">{p.name}</div>
          <div className="pricing-price">{p.price}<span className="pricing-cadence">{p.cadence}</span></div>
          <div className="pricing-who">{p.who}</div>
          <ul className="pricing-feats">
            {p.features.map(f => <li key={f}><span className="pricing-check">✓</span>{f}</li>)}
          </ul>
          <button className={`pricing-cta${p.highlight ? " pricing-cta--hl" : ""}`}
            onClick={() => { startCheckout(p.id); onClose?.(); }}>
            {p.cta}
          </button>
        </div>
      ))}
    </div>
  );
}

// Modal shown when a gated (Pro) feature is tapped while the paywall is on.
export default function PricingModal({ open, onClose, reason }) {
  useEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="pricing-overlay" onClick={onClose}>
      <div className="pricing-modal" onClick={e => e.stopPropagation()}>
        <button className="pricing-close" onClick={onClose} aria-label="Close">✕</button>
        <div className="pricing-eyebrow">PEAKTIME Pro</div>
        <h2 className="pricing-h">{reason || "Unlock the booking toolkit"}</h2>
        <p className="pricing-sub">The neutral demand benchmark, the fee comps, the private pitch links - the numbers both sides of a booking can cite. Cancel anytime.</p>
        <PricingTiers onClose={onClose} />
        <div className="pricing-foot">Secure checkout via Stripe · prices in GBP</div>
      </div>
    </div>
  );
}
