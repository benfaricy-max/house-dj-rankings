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
| `frontend/src/usePro.js` | `usePro()` entitlement hook + `startCheckout()` + `startPortal()` |
| `api/checkout.js` | Creates a Stripe Checkout subscription session |
| `api/webhook.js` | Verifies Stripe events; persists entitlement + mints a Pro cookie |
| `api/me.js` | Returns `{ pro }` — confirms against the store, falls back to cookie |
| `api/portal.js` | Stripe Billing Portal session (self-serve cancel / upgrade) |
| `api/rationale.js` | LLM-generated booking memo (Pro); falls back to the template |
| `api/_store.js` | Upstash Redis entitlement store (keyed by Stripe customer) |
| `api/_lib.js` | CORS + signed-session helpers |

The entitlement store and customer portal are **already wired**: the webhook writes
`active`/`inactive` to Upstash, `/api/me` confirms it (so cancellations revoke access),
and Pro users get a "Manage subscription" link that opens the Stripe portal. Both
degrade gracefully — without Upstash configured, `/me` falls back to trusting the
signed cookie, so the stub still runs.

## Go-live checklist (~1–2 days)

1. **Deploy the API.** Import this repo into Vercel; set the project root to `api/`
   (or copy `api/` into a Vercel/Cloudflare project). Add a custom domain like
   `api.thedjrankings.com`.
2. **Stripe.** Create one Product with a recurring price (Pro). Copy the price id.
   Set up a webhook endpoint → `https://api.thedjrankings.com/api/webhook` for
   `checkout.session.completed`, `customer.subscription.deleted`.
3. **Env vars (API):**
   - `STRIPE_SECRET_KEY`, `STRIPE_PRICE_SOLO` (£75/mo), `STRIPE_PRICE_TEAM` (£300/mo).
     The frontend `startCheckout(plan, { meta })` sends `plan` (+ optional metadata
     that rides through to Stripe). `api/checkout.js` maps each plan to its price id
     and derives the Stripe mode (subscription vs one-off).
   - **Self-serve revenue lines (no sales call, no gatekeeper):**
     - `STRIPE_PRICE_REPORT` — **one-off £29 Fair Value Report** (`plan: "report"`,
       Stripe `mode: payment`). Surfaced on the seller side of each Value Report
       (`ReportCTA.jsx`); metadata records which artist's report was bought.
     - `STRIPE_PRICE_INTEL` — **£6/mo paid Index tier** (`plan: "intel"`, subscription).
       Surfaced beside the free capture in the Index drop (`IntelUpsell.jsx`).
     Both CTAs render only when `VITE_API_BASE` is set (`checkoutReady` in `usePro.js`),
     so the live open site is unchanged until the API is deployed.
   - `STRIPE_WEBHOOK_SECRET`
   - `SESSION_SECRET` (random 32+ chars)
   - `FRONTEND_URL=https://thedjrankings.com`
   - `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (create a free Upstash Redis
     DB — this is the entitlement store; without it `/me` falls back to the cookie)
   - `ANTHROPIC_API_KEY` (optional — enables the real AI memo; without it the memo
     falls back to the deterministic template)
   - In the Stripe Billing Portal settings, enable cancellation + plan switching so
     `/api/portal` works.
4. **Env vars (frontend build):**
   - `VITE_API_BASE=https://api.thedjrankings.com`
   - `VITE_PAYWALL_ENABLED=true`
5. **Test:** `localStorage.setItem('peaktime_pro','1')` unlocks Pro locally without
   paying, so you can QA the gated UI.

## Production hardening

- ✅ **Entitlement store** — `api/_store.js` (Upstash Redis). Webhook persists
  active/inactive; `/api/me` confirms it so cancellations revoke access.
- ✅ **Customer portal** — `api/portal.js` + "Manage subscription" link.
- ⬜ **Add login.** Entitlement currently follows a signed cookie tied to the Stripe
  customer. For multi-device access, add an account layer (Clerk or Supabase Auth,
  magic-link) and key the store on the user id as well as the customer id.

## Pricing (starting point)

Live pricing tiers (in `frontend/src/Pricing.jsx` → `PLANS`; shown via the gated
upgrade modal only when the paywall is ON):

| Tier | Price | plan id | Who | Unlocks |
|------|-------|---------|-----|---------|
| Free | £0 | — | Fans, funnel | Rankings, discovery, headliner teaser |
| **Solo** | **£75/mo** | `solo` | Independent promoters & buyers | Full lineup, Fair Value Reports + negotiation scripts, private pitch links, routing & club-vs-viral reads |
| **Team** | **£300/mo** | `team` | Agencies & festivals | Everything in Solo across seats + roster routing, competitive intel, calibrated sell-through, priority refresh |

**Self-serve lines (sell without a sales call — to the audience you already have):**

| SKU | Price | plan id | Who | What |
|-----|-------|---------|-----|------|
| **Fair Value Report** | **£29** one-off | `report` | DJs, managers, agents (sell side) | A verified, downloadable report + private pitch link for one act — the neutral number to take into a fee talk. Sold on the seller side of each Value Report. |
| **Index Pro** | **£6/mo** | `intel` | Fans, scene-adjacent, working bookers | The full data behind every Index drop — every act's Value Gap, weekly movers, market reads. Sold beside the free capture in the Index drop. |

## Cost to run (early)

Serverless + auth + hosting sit in free tiers; LLM memos are ~$0.01–0.03 each
(cache by lineup signature); Stripe is 2.9% + 30¢ per charge. **~$0–20/mo until you
have paying users.**
