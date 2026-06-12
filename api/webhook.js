// POST /api/webhook  → Stripe webhook. On a completed checkout it mints a Pro
// session cookie. On cancellation it clears entitlement.
// Env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET.
// NOTE: Stripe must receive the RAW body to verify the signature — disable body
// parsing for this route (Vercel: `export const config = { api:{ bodyParser:false } }`).
import Stripe from "stripe";
import { signSession } from "./_lib.js";
import { setEntitlement } from "./_store.js";

export const config = { api: { bodyParser: false } };

async function rawBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({ error: "Webhook not configured." });
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  let event;
  try {
    const buf = await rawBody(req);
    event = stripe.webhooks.constructEvent(buf, req.headers["stripe-signature"], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return res.status(400).json({ error: `Signature verification failed: ${e.message}` });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object;
        const plan = s.metadata?.plan || "pro";
        // One-off purchases (mode "payment", e.g. the £29 report) are NOT a
        // recurring entitlement — they buy a single artefact, so they don't
        // grant ongoing Pro access. The sale + its artist metadata live in
        // Stripe (Payments); fulfilment is handled separately.
        if (s.mode === "payment") break;
        // Subscriptions (solo / team / intel / pro): grant access. Source of
        // truth is the entitlement store (if configured); the signed cookie is
        // a convenience so /me works instantly on the success redirect.
        await setEntitlement(s.customer, { status: "active", plan, subscription: s.subscription });
        const token = signSession({ customer: s.customer, plan, exp: Date.now() + 30 * 864e5 });
        res.setHeader("Set-Cookie", `pt_session=${token}; Path=/; Max-Age=${30 * 86400}; HttpOnly; Secure; SameSite=None`);
        break;
      }
      case "customer.subscription.deleted":
      case "customer.subscription.paused":
        await setEntitlement(event.data.object.customer, { status: "inactive", plan: "pro" });
        break;
    }
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
  return res.status(200).json({ received: true });
}
