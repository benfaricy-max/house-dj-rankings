// POST /api/portal → { url } for the Stripe Billing Portal, so subscribers can
// self-serve cancel / upgrade / update payment. Customer is read from the
// signed session cookie. Env: STRIPE_SECRET_KEY.
import Stripe from "stripe";
import { cors, readCookie, verifySession } from "./_lib.js";

const FRONTEND = process.env.FRONTEND_URL || "https://thedjrankings.com";

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!process.env.STRIPE_SECRET_KEY) return res.status(503).json({ error: "Billing not configured." });

  const session = verifySession(readCookie(req, "pt_session"));
  if (!session?.customer) return res.status(401).json({ error: "Not signed in." });

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const portal = await stripe.billingPortal.sessions.create({
      customer: session.customer,
      return_url: `${FRONTEND}/?pro=portal`,
    });
    return res.status(200).json({ url: portal.url });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
