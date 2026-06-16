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
const DEV_SECRET = "dev-only-not-secret";
const SECRET = process.env.SESSION_SECRET || DEV_SECRET;

// Anything internet-reachable (any Vercel deployment, incl. preview, or an
// explicit production NODE_ENV) must run with a real secret. The dev fallback
// signs forgeable Pro tokens — leaving it on in prod means anyone can mint
// themselves a "pro" session cookie and bypass the paywall entirely.
const IS_DEPLOYED = Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production";
const SECRET_IS_REAL = SECRET !== DEV_SECRET && SECRET.length >= 16;
// Insecure = deployed but the secret is missing, the dev default, or too short.
const INSECURE_SECRET = IS_DEPLOYED && !SECRET_IS_REAL;

// Fail closed and loudly: refuse to MINT a session with an unsafe secret. Callers
// (checkout/webhook) will surface a 5xx instead of silently issuing a token that
// an attacker could forge. Better a broken upgrade flow than a free-Pro exploit.
export function assertSessionSecret() {
  if (INSECURE_SECRET) {
    throw new Error(
      "SESSION_SECRET is missing, the dev default, or shorter than 16 chars in a deployed " +
      "environment. Set a strong SESSION_SECRET (e.g. `openssl rand -base64 32`) before " +
      "minting sessions — refusing to issue a forgeable Pro token."
    );
  }
}

export function signSession(payload) {
  assertSessionSecret();
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifySession(token) {
  // Fail closed on verify too: with an unsafe secret in a deployed env, treat
  // every cookie as invalid (caller falls back to free) rather than trusting a
  // signature anyone could have produced.
  if (INSECURE_SECRET) return null;
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
