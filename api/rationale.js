// POST /api/rationale  → { memo } — the true generative-AI upgrade over the
// client-side template. Pro-gated. Falls back to echoing the deterministic
// lines if no model key is set, so it works before you wire up the LLM.
// Env: ANTHROPIC_API_KEY (optional).
import { cors, readCookie, verifySession } from "./_lib.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const session = verifySession(readCookie(req, "pt_session"));
  if (!session) return res.status(402).json({ error: "Pro required." });

  const { lineup, market, budget, lines } = req.body || {};

  // No model configured → return the deterministic lines the client already has.
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(200).json({ memo: (lines || []).join("\n\n"), source: "template" });
  }

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const prompt = `You are a booking analyst for electronic-music promoters. Write a concise, confident booking rationale (120-160 words) for this proposed lineup. Use the numbers; be specific about demand, local fit, momentum, and budget; end with one honest caveat. No hype, no emoji.\n\nMarket: ${market?.city} (${market?.country}). Budget: £${budget}.\nLineup JSON:\n${JSON.stringify(lineup)}`;
    const msg = await client.messages.create({
      model: "claude-3-5-haiku-latest",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });
    return res.status(200).json({ memo: msg.content?.[0]?.text || "", source: "llm" });
  } catch (e) {
    return res.status(200).json({ memo: (lines || []).join("\n\n"), source: "template", error: e.message });
  }
}
