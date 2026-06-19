import { useState } from "react";
import { startCheckout, checkoutReady } from "./usePro";
import "./IntelUpsell.css";

// PATH 2 — the paid intelligence tier. The free Index drop is the lead magnet;
// this is the paid product sitting right beside it: the full data behind every
// drop, every act's Value Gap, and the weekly movers — as a self-serve £6/mo
// content subscription. No tool onboarding, no sales call, no gatekeeper.
//
// Subscription plan id "intel" → STRIPE_PRICE_INTEL (see COMMERCE.md). Renders
// only once checkout is wired, so the live open site is unchanged until deploy.
export default function IntelUpsell({ source = "index-drop" }) {
  const [busy, setBusy] = useState(false);
  if (!checkoutReady) return null;

  const subscribe = async () => {
    if (busy) return;
    setBusy(true);
    if (typeof window.gtag === "function") {
      window.gtag("event", "intel_checkout_start", { source });
    }
    try {
      await startCheckout("intel", { meta: { source } });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="intel-upsell">
      <div className="intel-up-tag">PEAKTIME Index Pro</div>
      <div className="intel-up-h">The full data behind every drop</div>
      <p className="intel-up-sub">
        The free Index is the headline. Pro is the whole story: every act's Value Gap, the weekly
        movers before they surface publicly, full market &amp; routing reads, and the raw demand
 numbers to cite. Neutral, no hype: delivered all month, not once.
      </p>
      <div className="intel-up-row">
        <div className="intel-up-price"><span className="intel-up-amount">£6</span><span className="intel-up-cadence">/mo</span></div>
        <button className="intel-up-btn" onClick={subscribe} disabled={busy}>
          {busy ? "Opening checkout…" : "Go Pro →"}
        </button>
      </div>
      <div className="intel-up-fine">Cancel anytime · secure checkout via Stripe</div>
    </div>
  );
}
