// GET /api/me  → { pro: boolean, plan }. The frontend calls this to decide
// whether to show Pro features. Reads the signed session cookie set by the
// webhook, then — if the entitlement store is configured — confirms the
// subscription is still active (so cancellations revoke access immediately).
import { cors, readCookie, verifySession } from "./_lib.js";
import { storeEnabled, getEntitlement } from "./_store.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;
  const session = verifySession(readCookie(req, "pt_session"));
  if (!session) return res.status(200).json({ pro: false, plan: null });

  if (storeEnabled()) {
    try {
      const ent = await getEntitlement(session.customer);
      return res.status(200).json({ pro: ent?.status === "active", plan: ent?.plan || null });
    } catch {
      // Store hiccup — fall back to the cookie rather than locking a paying user out.
    }
  }
  return res.status(200).json({ pro: true, plan: session.plan || "pro" });
}
