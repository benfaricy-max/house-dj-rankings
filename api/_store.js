// Lightweight entitlement store on Upstash Redis (REST — no SDK, just fetch).
// Keyed by Stripe customer id so entitlement survives across devices and can be
// revoked on cancellation. Degrades gracefully: if Upstash isn't configured, the
// callers fall back to trusting the signed cookie (the original stub behaviour).
// Env: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN.
const URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

export const storeEnabled = () => !!(URL && TOKEN);

async function cmd(args) {
  const r = await fetch(URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error(`Upstash ${r.status}`);
  return (await r.json()).result;
}

// Persist { status: 'active'|'inactive', plan, subscription }.
export async function setEntitlement(customer, data) {
  if (!storeEnabled() || !customer) return;
  await cmd(["SET", `ent:${customer}`, JSON.stringify({ ...data, updated: Date.now() })]);
}

export async function getEntitlement(customer) {
  if (!storeEnabled() || !customer) return null;
  const v = await cmd(["GET", `ent:${customer}`]);
  return v ? JSON.parse(v) : null;
}
