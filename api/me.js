// GET /api/me  → { pro: boolean }. The frontend calls this to decide whether to
// show Pro features. Reads the signed session cookie set by the webhook.
import { cors, readCookie, verifySession } from "./_lib.js";

export default function handler(req, res) {
  if (cors(req, res)) return;
  const session = verifySession(readCookie(req, "pt_session"));
  // TODO: for production, look the customer up in your datastore and confirm the
  // subscription is still active, rather than trusting the cookie's expiry alone.
  return res.status(200).json({ pro: !!session, plan: session?.plan || null });
}
