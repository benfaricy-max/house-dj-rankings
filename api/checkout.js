// POST /api/checkout  → returns { url } for Stripe Checkout.
// Env: STRIPE_SECRET_KEY, STRIPE_PRICE_PRO (and optionally STRIPE_PRICE_TEAM).
import Stripe from "stripe";
import { cors } from "./_lib.js";

const FRONTEND = process.env.FRONTEND_URL || "https://thedjrankings.com";
const PRICES = {
  pro: process.env.STRIPE_PRICE_PRO,
  team: process.env.STRIPE_PRICE_TEAM,
};

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: "Billing not configured yet (set STRIPE_SECRET_KEY)." });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const plan = (req.body?.plan || "pro");
  const price = PRICES[plan];
  if (!price) return res.status(400).json({ error: `Unknown plan "${plan}" (set STRIPE_PRICE_${plan.toUpperCase()}).` });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      allow_promotion_codes: true,
      automatic_tax: { enabled: true },
      success_url: `${FRONTEND}/?pro=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND}/?pro=cancelled`,
    });
    return res.status(200).json({ url: session.url });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
