// POST /api/checkout  → returns { url } for Stripe Checkout.
//
// Two revenue shapes share this one function:
//   • subscription plans — solo / team / pro (alias) / intel
//   • one-off payments   — report  (a single Fair Value Report purchase)
// The plan's mode is derived from PLANS below, so the frontend only sends a
// plan id (+ optional metadata). Env: STRIPE_SECRET_KEY and one price id per
// plan you sell — STRIPE_PRICE_SOLO / _TEAM / _INTEL / _REPORT (see COMMERCE.md).
import Stripe from "stripe";
import { cors } from "./_lib.js";

const FRONTEND = process.env.FRONTEND_URL || "https://thedjrankings.com";

// plan id → { price env, Stripe mode }. `pro` is kept as a back-compat alias
// for `solo` so older links/buttons still resolve.
const PLANS = {
  solo:   { price: process.env.STRIPE_PRICE_SOLO,   mode: "subscription" },
  pro:    { price: process.env.STRIPE_PRICE_SOLO,   mode: "subscription" },
  team:   { price: process.env.STRIPE_PRICE_TEAM,   mode: "subscription" },
  intel:  { price: process.env.STRIPE_PRICE_INTEL,  mode: "subscription" }, // paid Index tier
  report: { price: process.env.STRIPE_PRICE_REPORT, mode: "payment" },      // one-off Fair Value Report
};

// Only allow a short, known-safe set of metadata keys through to Stripe, and
// clamp their length — this rides straight from an untrusted client.
function cleanMeta(raw) {
  if (!raw || typeof raw !== "object") return {};
  const allow = ["artist", "name", "source", "note", "side"];
  const out = {};
  for (const k of allow) {
    if (raw[k] != null) out[k] = String(raw[k]).slice(0, 200);
  }
  return out;
}

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: "Billing not configured yet (set STRIPE_SECRET_KEY)." });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const planId = req.body?.plan || "solo";
  const plan = PLANS[planId];
  if (!plan) return res.status(400).json({ error: `Unknown plan "${planId}".` });
  if (!plan.price) {
    return res.status(400).json({ error: `Plan "${planId}" has no price configured (set STRIPE_PRICE_${planId.toUpperCase()}).` });
  }

  const meta = cleanMeta(req.body?.meta);
  meta.plan = planId;

  // One-off report buyers are redirected straight to their generated PDF
  // (api/report-pdf verifies the session is paid before rendering). Built from
  // the request host so it works on whatever domain the API is deployed to.
  const proto = (req.headers["x-forwarded-proto"] || "https").split(",")[0];
  const apiBase = req.headers.host ? `${proto}://${req.headers.host}` : "";
  const successUrl = planId === "report" && apiBase
    ? `${apiBase}/api/report-pdf?session_id={CHECKOUT_SESSION_ID}`
    : `${FRONTEND}/?pro=success&plan=${planId}&session_id={CHECKOUT_SESSION_ID}`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: plan.mode,
      line_items: [{ price: plan.price, quantity: 1 }],
      allow_promotion_codes: true,
      // Stripe automatic tax is OFF for launch — turning it on requires a
      // configured tax origin/registration (Settings → Tax) or Checkout errors.
      // Re-enable with `automatic_tax: { enabled: true }` once that's set up.
      metadata: meta,
      // one-off purchases also stamp the payment intent so the webhook/receipt
      // carries which artist report was bought.
      ...(plan.mode === "payment" ? { payment_intent_data: { metadata: meta } } : {}),
      success_url: successUrl,
      cancel_url: `${FRONTEND}/?pro=cancelled`,
    });
    return res.status(200).json({ url: session.url });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
