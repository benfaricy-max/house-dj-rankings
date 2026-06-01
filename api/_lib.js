// Shared helpers for the PEAKTIME serverless functions.
import crypto from "crypto";

const FRONTEND = process.env.FRONTEND_URL || "https://thedjrankings.com";

// CORS — the static site lives on a different origin than the functions.
export function cors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", FRONTEND);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(204).end(); return true; }
  return false;
}

// Minimal signed-cookie session so we don't need a DB just to prove this out.
// The webhook mints a token after payment; /api/me verifies it. For production,
// swap this for a real datastore (Vercel KV / Upstash / Postgres) keyed by the
// Stripe customer id, so you can revoke on cancellation. See COMMERCE.md.
const SECRET = process.env.SESSION_SECRET || "dev-only-not-secret";

export function signSession(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifySession(token) {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  if (sig !== expected) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString());
    if (data.exp && Date.now() > data.exp) return null;
    return data;
  } catch { return null; }
}

export function readCookie(req, name) {
  const raw = req.headers.cookie || "";
  const hit = raw.split(";").map(s => s.trim()).find(s => s.startsWith(name + "="));
  return hit ? decodeURIComponent(hit.split("=")[1]) : null;
}
