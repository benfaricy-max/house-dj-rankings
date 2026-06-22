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

// ── Tiered entitlements (preview / freemium model) ──────────────────────────
// Three self-serve subscription tiers gate distinct surfaces:
//   rankings  ($7/mo)  → full Rankings, Club Index, and Scouting data
//   booking   ($29/mo) → the Booking Intelligence toolset
//   allaccess ($45/mo) → everything above, bundled
// A purchased tier grants itself; All Access grants all three. Legacy single-Pro
// plans (solo/team/pro/intel) map to All Access so existing buyers keep access.
export const TIERS = ["rankings", "booking", "allaccess"];

export const TIER_META = {
  rankings:  { plan: "rankings",  price: "$7",  cadence: "/mo", name: "Rankings" },
  booking:   { plan: "booking",   price: "$29", cadence: "/mo", name: "Booking Intelligence" },
  allaccess: { plan: "allaccess", price: "$45", cadence: "/mo", name: "PEAKTIME All Access" },
};

// plan id → the tiers it grants.
const PLAN_GRANTS = {
  rankings:  ["rankings"],
  booking:   ["booking"],
  allaccess: ["rankings", "booking", "allaccess"],
  // legacy / back-compat
  solo:  ["rankings", "booking", "allaccess"],
  team:  ["rankings", "booking", "allaccess"],
  pro:   ["rankings", "booking", "allaccess"],
  intel: ["rankings"],
};

function expandPlans(plans) {
  const out = new Set();
  for (const p of plans || []) for (const t of (PLAN_GRANTS[p] || [p])) out.add(t);
  return out;
}

// Memoize the single /api/me call so every gated surface shares one request.
let _mePromise = null;
function fetchEntitlement() {
  if (_mePromise) return _mePromise;
  _mePromise = fetch(`${API}/api/me`, { credentials: "include" })
    .then(r => (r.ok ? r.json() : {}))
    .catch(() => ({}));
  return _mePromise;
}

// Returns { tiers:Set, has(tier), loading, paywall }. With the paywall off,
// everyone holds every tier (the site stays fully open, today's behaviour).
export function useEntitlements() {
  const [tiers, setTiers] = useState(() => (PAYWALL ? new Set() : new Set(TIERS)));
  const [loading, setLoading] = useState(PAYWALL);

  useEffect(() => {
    if (!PAYWALL) return;
    // Dev/manual unlock without a backend: peaktime_pro=1 → all; or a comma list
    // of plan ids in peaktime_tier (e.g. "rankings,booking").
    if (localStorage.getItem("peaktime_pro") === "1") { setTiers(new Set(TIERS)); setLoading(false); return; }
    const devTier = localStorage.getItem("peaktime_tier");
    if (devTier) { setTiers(expandPlans(devTier.split(","))); setLoading(false); return; }
    if (!API) { setLoading(false); return; }
    fetchEntitlement()
      .then(d => {
        const plans = d.tiers?.length ? d.tiers : (d.pro ? [d.plan || "allaccess"] : []);
        setTiers(expandPlans(plans));
      })
      .finally(() => setLoading(false));
  }, []);

  return { tiers, has: t => tiers.has(t), loading, paywall: PAYWALL };
}

// Convenience for a single gated surface: { unlocked, loading, paywall }.
export function useTier(tier) {
  const { has, loading, paywall } = useEntitlements();
  return { unlocked: !paywall || has(tier), loading, paywall };
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
