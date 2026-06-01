# PEAKTIME — Commercialization Skeleton

This repo now contains the **smallest version that can take real money**, scaffolded
so it doesn't touch the live free site until you switch it on.

- **Free site:** stays on GitHub Pages exactly as today.
- **Paywall:** OFF by default (`VITE_PAYWALL_ENABLED` unset). The Booking tool works
  fully for everyone until you flip it on.
- **Pro features** (gated when the paywall is on): full demand-ranked lineup beyond the
  headliner, fair-price benchmarking, and the booking rationale.

## Architecture

```
GitHub Pages (static React)  ──fetch──▶  Serverless API (/api/*, on Vercel/CF/Netlify)
   thedjrankings.com                         api.thedjrankings.com
   - free rankings + teaser                  - /checkout  (Stripe Checkout session)
   - usePro() reads /api/me                   - /webhook   (Stripe → mints Pro cookie)
                                              - /me        (entitlement check)
                                              - /rationale (LLM booking memo, Pro)
                                                   │
                                          Stripe (billing) · Anthropic (AI memo)
```

You keep Pages for the static site and host the four functions in `api/` on a
serverless platform. The frontend talks to them via `VITE_API_BASE`.

## Files added

| File | Role |
|------|------|
| `frontend/src/usePro.js` | `usePro()` entitlement hook + `startCheckout()` |
| `api/checkout.js` | Creates a Stripe Checkout subscription session |
| `api/webhook.js` | Verifies Stripe events; mints a 30-day Pro session cookie |
| `api/me.js` | Returns `{ pro }` from the signed cookie |
| `api/rationale.js` | LLM-generated booking memo (Pro); falls back to the template |
| `api/_lib.js` | CORS + signed-session helpers |

## Go-live checklist (~1–2 days)

1. **Deploy the API.** Import this repo into Vercel; set the project root to `api/`
   (or copy `api/` into a Vercel/Cloudflare project). Add a custom domain like
   `api.thedjrankings.com`.
2. **Stripe.** Create one Product with a recurring price (Pro). Copy the price id.
   Set up a webhook endpoint → `https://api.thedjrankings.com/api/webhook` for
   `checkout.session.completed`, `customer.subscription.deleted`.
3. **Env vars (API):**
   - `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO` (and `STRIPE_PRICE_TEAM` for the agency tier)
   - `STRIPE_WEBHOOK_SECRET`
   - `SESSION_SECRET` (random 32+ chars)
   - `FRONTEND_URL=https://thedjrankings.com`
   - `ANTHROPIC_API_KEY` (optional — enables the real AI memo; without it the memo
     falls back to the deterministic template)
4. **Env vars (frontend build):**
   - `VITE_API_BASE=https://api.thedjrankings.com`
   - `VITE_PAYWALL_ENABLED=true`
5. **Test:** `localStorage.setItem('peaktime_pro','1')` unlocks Pro locally without
   paying, so you can QA the gated UI.

## Production hardening (before charging at scale)

- **Replace the cookie with a datastore.** The stub trusts a signed cookie. For real
  billing, persist `{ stripe_customer_id, status }` in Vercel KV / Upstash / Postgres
  keyed off the webhook, and have `/api/me` confirm the subscription is still active so
  you can revoke on cancellation. (TODOs are marked in `webhook.js` / `me.js`.)
- **Add login.** Tie entitlement to an account (Clerk or Supabase Auth, magic-link) so
  it follows the user across devices.
- **Customer portal.** Add a Stripe Billing Portal link for self-serve cancel/upgrade.

## Pricing (starting point)

| Tier | Price | Who | Unlocks |
|------|-------|-----|---------|
| Free | £0 | Fans, funnel | Rankings, discovery, headliner teaser |
| **Pro** | **£49–99/mo** | Promoters, buyers | Full lineup builder, fair-price check, rationale |
| **Team / Agency** | **£299–499/mo** | Agencies, festivals | Seats + roadmap: routing, alerts, competitive intel, calibrated sell-through |

## Cost to run (early)

Serverless + auth + hosting sit in free tiers; LLM memos are ~$0.01–0.03 each
(cache by lineup signature); Stripe is 2.9% + 30¢ per charge. **~$0–20/mo until you
have paying users.**
