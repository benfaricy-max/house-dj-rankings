# Deploy — what's actually live, and what isn't

Single source of truth for how this repo ships. Three deploy-ish configs exist in
the tree; only one serves **thedjrankings.com** today. This doc says which, and
flags the legacy/ambiguous bits so nobody wires up the wrong one.

## ✅ The live path — GitHub Pages (the public site)

**thedjrankings.com is a static site on GitHub Pages.** No server in the request path.

- `.github/workflows/deploy.yml` builds `frontend/` (Vite/React) and publishes
  `frontend/dist` via `actions/upload-pages-artifact` → `actions/deploy-pages`.
- Triggers: every push to `main`, **and** after a successful `Refresh Rankings`
  run (so fresh data redeploys). A failed refresh does **not** redeploy stale data.
- The app reads a static `frontend/public/rankings.json` (≈2.4 MB) — there is no
  runtime API for the rankings. Data is regenerated nightly and committed (see below).
- Commerce build vars (`VITE_API_BASE`, `VITE_PAYWALL_ENABLED`) come from repo
  **Variables** and are **currently set** (`VITE_API_BASE=https://bonaroo.vercel.app`,
  `VITE_PAYWALL_ENABLED=true`) → checkout CTAs render on the live site. Stripe is in
  **test mode** today; see the billing section for going live.

## 🔄 The data pipeline — Refresh Rankings (writes the data the site reads)

- `.github/workflows/refresh.yml` runs daily (cron `12 7 * * *` UTC) + on manual
  dispatch. It runs the `backend/` enrich scripts, recomputes the composite via
  `backend/score.js`, then commits `frontend/public/rankings.json` + `backend/artists.json`.
- Guardrails (added Jun 2026):
  - **`backend/ciDataGuard.js`** runs before the commit and **fails the job** if the
    roster count or file size dropped more than `MIN_RETAIN` (default 90%) — enforces
    PERMANENT RULE #1 ("never wipe data") at the gate, not just inside the scripts.
  - **`notify-on-failure`** job opens/updates a `refresh-failure` GitHub issue (and
    pings Slack if `SLACK_WEBHOOK_URL` is set) so a broken refresh isn't silent.
- The commit uses `[skip ci]` + a rebase-and-retry push so a concurrent commit
  during the long run doesn't lose the day's data.

## 🧪 The billing backend — lives in a SEPARATE repo

- `api/` here (`checkout`, `webhook`, `me`, `portal`, `rationale`, `report-pdf`;
  ESM, Stripe 16, HMAC signed-cookie sessions in `api/_lib.js`, optional entitlement
  store `api/_store.js`) is the **source-of-record copy**.
- The **deployed** billing API is a standalone public repo,
  `benfaricy-max/peaktime-api`, on Vercel → **`bonaroo.vercel.app`**. The frontend
  reaches it via the `VITE_API_BASE` repo Variable (set to `https://bonaroo.vercel.app`).
- **Checkout is LIVE in Stripe TEST mode** (`VITE_PAYWALL_ENABLED=true`; ReportCTA +
  Intel CTA render on the live site). Real money is one flip away ("Stage 6" in
  `COMMERCE.md` / project notes: swap to Stripe live keys + live price IDs + live
  `whsec_`, redeploy).
- ⚠️ **`api/_lib.js` here now refuses to mint a session with the dev-default/short
  `SESSION_SECRET` in a deployed env (fails closed). This protects the canonical
  copy — but the live deploy runs from `peaktime-api`, so the SAME guard must be
  applied (or re-synced) there, and `SESSION_SECRET` confirmed set in the `bonaroo`
  Vercel project, BEFORE Stage 6. Until then the deployed sessions are only as safe
  as that project's env.** Also wire a real entitlement store so cancellations revoke.

## ⚠️ Legacy / ambiguous — decide and remove

These exist in the tree but are **not** the live path. Left in place (not deleted)
because confirming they're unused needs the Vercel dashboard, and deleting a live
billing deploy by mistake is worse than a documented TODO. Decide, then prune:

- **`vercel.json`** (root) — defines experimental `frontend` + `backend` services
  with `backend/server.js` as the entrypoint. **Confirmed legacy** (project notes:
  "an unrelated experimental frontend+backend config — don't deploy main-repo api/").
  The live site is GitHub Pages and the live API is the separate `peaktime-api` repo,
  so nothing here depends on it. A stale Vercel link exists locally
  (`.vercel/project.json` → `house-dj-rankings`, gitignored). **Action:** safe to
  delete `vercel.json` and unlink the `house-dj-rankings` Vercel project — left in
  place only because pruning it is a 2-minute dashboard check, not a code change.
- **`backend/server.js`** — legacy local Express server (node-cron live-demand API).
  Not in any CI path; referenced only by `package.json` `start`/`dev` (local dev) and
  by `vercel.json`'s entrypoint. **Action:** if `vercel.json` is retired and you don't
  use the local server, drop `server.js` + the `start`/`dev` scripts. Until then it's
  harmless but should not be mistaken for production.

## TL;DR

| Concern | Where it lives | Status |
| --- | --- | --- |
| Public site | GitHub Pages via `deploy.yml` (`frontend/dist`) | **LIVE** |
| Rankings data | `refresh.yml` → `score.js` → committed `rankings.json` | **LIVE** |
| Billing / Pro | separate repo `peaktime-api` → `bonaroo.vercel.app` (`api/` here = source copy) | **LIVE (Stripe test mode)** |
| `vercel.json` + `backend/server.js` | root / `backend/` | **Legacy — safe to prune** |
