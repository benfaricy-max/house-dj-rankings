import { useState, useEffect } from "react";

// Commercialization scaffold. The paywall is OFF by default so the live site
// behaves exactly as before. Flip it on (and point at your API) only once
// Stripe + the serverless functions are deployed — see COMMERCE.md.
//   VITE_PAYWALL_ENABLED=true        → gate Pro features
//   VITE_API_BASE=https://api.…      → where the serverless functions live
const PAYWALL = import.meta.env.VITE_PAYWALL_ENABLED === "true";
const API = import.meta.env.VITE_API_BASE || "";

// True once the serverless checkout is reachable (i.e. VITE_API_BASE is set at
// build time). New revenue CTAs render only when this is true, so the live
// open site is unchanged until Stripe + the API are deployed — see COMMERCE.md.
export const checkoutReady = !!API;

// Returns { pro, loading, paywall }. When the paywall is disabled, everyone is
// "pro" — i.e. the whole product is open, which is the current behaviour.
export function usePro() {
  const [pro, setPro] = useState(!PAYWALL);
  const [loading, setLoading] = useState(PAYWALL);

  useEffect(() => {
    if (!PAYWALL) return;
    // Dev/manual unlock for testing without a backend.
    if (localStorage.getItem("peaktime_pro") === "1") { setPro(true); setLoading(false); return; }
    if (!API) { setLoading(false); return; }
    fetch(`${API}/api/me`, { credentials: "include" })
      .then(r => (r.ok ? r.json() : { pro: false }))
      .then(d => setPro(!!d.pro))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { pro, loading, paywall: PAYWALL };
}

// Kicks off Stripe Checkout via the serverless function. `meta` rides through
// to Stripe (e.g. { artist, name, source }) so a purchase records what was
// bought — which artist's Fair Value Report, which surface drove the sale.
export async function startCheckout(plan = "solo", { meta } = {}) {
 if (!API) { alert("Checkout isn't configured yet, see COMMERCE.md."); return; }
  try {
    const r = await fetch(`${API}/api/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ plan, meta }),
    });
    const { url, error } = await r.json();
    if (url) window.location.href = url;
    else alert(error || "Could not start checkout.");
  } catch {
    alert("Could not reach the checkout service.");
  }
}

// Opens the Stripe Billing Portal for self-serve cancel / upgrade.
export async function startPortal() {
 if (!API) { alert("Billing portal isn't configured yet, see COMMERCE.md."); return; }
  try {
    const r = await fetch(`${API}/api/portal`, { method: "POST", credentials: "include" });
    const { url, error } = await r.json();
    if (url) window.location.href = url;
    else alert(error || "Could not open the billing portal.");
  } catch {
    alert("Could not reach the billing service.");
  }
}
