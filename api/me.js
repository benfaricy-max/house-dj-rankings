// GET /api/me  → { pro: boolean, plan }. The frontend calls this to decide
// whether to show Pro features. Reads the signed session cookie set by the
// webhook, then — if the entitlement store is configured — confirms the
// subscription is still active (so cancellations revoke access immediately).
import { cors, readCookie, verifySession } from "./_lib.js";
import { storeEnabled, getEntitlement } from "./_store.js";

// plan id → the access tiers it grants. Mirrors PLAN_GRANTS in frontend/usePro.js.
const PLAN_TIERS = {
  rankings:  ["rankings"],
  booking:   ["booking"],
  allaccess: ["rankings", "booking", "allaccess"],
  // legacy single-Pro plans map to everything
  solo:  ["rankings", "booking", "allaccess"],
  team:  ["rankings", "booking", "allaccess"],
  pro:   ["rankings", "booking", "allaccess"],
  intel: ["rankings"],
};
const tiersFor = plan => (plan && PLAN_TIERS[plan]) || [];

export default async function handler(req, res) {
  if (cors(req, res)) return;
  const session = verifySession(readCookie(req, "pt_session"));
  if (!session) return res.status(200).json({ pro: false, plan: null, tiers: [] });

  if (storeEnabled()) {
    try {
      const ent = await getEntitlement(session.customer);
      const active = ent?.status === "active";
      return res.status(200).json({ pro: active, plan: ent?.plan || null, tiers: active ? tiersFor(ent?.plan) : [] });
    } catch {
      // Store hiccup — fall back to the cookie rather than locking a paying user out.
    }
  }
  const plan = session.plan || "pro";
  return res.status(200).json({ pro: true, plan, tiers: tiersFor(plan) });
}
