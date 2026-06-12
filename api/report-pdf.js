// GET /api/report-pdf?session_id=cs_...  → streams the branded Fair Value Report
// PDF for a paid one-off (£29) purchase. This is the fulfilment for plan "report":
// Stripe's success_url redirects the buyer straight here, we verify the session is
// paid, read the artist from its metadata, and render the PDF on the fly from the
// live rankings data. No storage needed — the PDF is regenerated from current data.
//
// Env: STRIPE_SECRET_KEY, FRONTEND_URL (where rankings.json is served).
import Stripe from "stripe";
import PDFDocument from "pdfkit";

const FRONTEND = process.env.FRONTEND_URL || "https://thedjrankings.com";
const ACCENT = "#9bbf2f";   // print-safe lime (the screen --accent is too bright on white)
const INK = "#14151a";
const MUTED = "#6b6e76";
const SRC = "Source: PEAKTIME neutral demand benchmark (thedjrankings.com), built from live booking data — no input from either side.";

const slugify = n => String(n || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const feeShort = m => (!m ? null : m >= 1e6 ? `£${(m / 1e6).toFixed(1)}M` : m >= 1e3 ? `£${Math.round(m / 1e3)}K` : `£${m}`);

// ── Report data (server-side mirror of the on-site Fair Value Report) ──────────
function negotiationLine(a) {
  const anchor = a.value_anchor || {};
  const proof = [
    anchor.venue_tier > 0 && `tier ${anchor.venue_tier}/5 rooms`,
    anchor.avg_attending > 0 && `~${anchor.avg_attending} attending per show`,
    (anchor.routing_countries || a.ra_countries) > 0 && `${anchor.routing_countries || a.ra_countries} countries on the routing`,
  ].filter(Boolean).join(", ");
  const evidence = proof ? ` — ${proof}` : "";
  const surging = Number.isFinite(a.momentum_score) && a.momentum_score >= 40 ? `, with momentum still climbing (${a.momentum_score}/100)` : "";
  const g = a.value_gap;
  if (g >= 1) return `${a.name}'s live demand${evidence}${surging} supports a fee around ${a.demand_fee_label} — about ${g} tier${g > 1 ? "s" : ""} above the current ${a.booking_fee.label} band. ${SRC}`;
  if (g <= -1) return `${a.name}'s fee (${a.booking_fee.label}) currently sits ahead of independently measured demand${evidence}. Defensible with private sell-through data, but a data-led buyer will likely cite the gap. ${SRC}`;
  return `${a.name}'s ${a.booking_fee.label} fee is backed by independently measured live demand${evidence} — useful proof if a buyer tries to talk it down. ${SRC}`;
}

function peerFeeComps(a, rankings) {
  const vt = Math.round(a?.value_anchor?.venue_tier || a?.ra_venue_tier || 0);
  if (!vt || !Array.isArray(rankings)) return null;
  const myRegions = new Set((a.value_anchor?.top_regions || a.ra_country_list || []).map(String));
  const pool = rankings.filter(p =>
    p.name !== a.name && p.booking_fee?.tier && Number.isFinite(p.booking_fee.mid) &&
    (p.booking_fee.basis === "curated" || p.booking_fee.basis === "anchored") &&
    Math.round(p.ra_venue_tier || 0) === vt);
  if (pool.length < 3) return null;
  const shareRegion = p => (p.value_anchor?.top_regions || p.ra_country_list || []).some(r => myRegions.has(String(r)));
  const regional = pool.filter(shareRegion);
  let basis = regional.length >= 4 ? regional : pool;
  const regionalUsed = basis === regional;
  const di = a.demand_index;
  if (Number.isFinite(di)) {
    const near = basis.filter(p => Number.isFinite(p.demand_index) && Math.abs(p.demand_index - di) <= 15);
    if (near.length >= 4) basis = near;
  }
  const mids = basis.map(p => p.booking_fee.mid).sort((x, y) => x - y);
  const q = f => mids[Math.min(mids.length - 1, Math.max(0, Math.round(f * (mids.length - 1))))];
  const examples = [...basis]
    .sort((x, y) => Math.abs((x.demand_index || 0) - (di || 0)) - Math.abs((y.demand_index || 0) - (di || 0)))
    .slice(0, 3).map(p => ({ name: p.name, fee: p.booking_fee.label }));
  return { count: basis.length, regional: regionalUsed, lo: q(0.25), hi: q(0.75), examples, venueLabel: a.value_anchor?.venue_label };
}

export function deriveReport(a, rankings) {
  const g = a.value_gap;
  const verdict = g >= 1 ? "UNDERPRICED" : g <= -1 ? "PRICED AHEAD" : "FAIRLY PRICED";
  const anchor = a.value_anchor || {};
  const evidence = [
    anchor.venue_tier > 0 && ["Room tier", `${anchor.venue_tier}/5${anchor.venue_label ? ` · ${anchor.venue_label} cap` : ""}`],
    anchor.avg_attending > 0 && ["Avg. attending", `~${anchor.avg_attending} per show`],
    anchor.conversion > 0 && ["Sell-through", `${anchor.conversion}%`],
    (anchor.routing_countries || a.ra_countries) > 0 && ["Routing", `${anchor.routing_countries || a.ra_countries} countries`],
    anchor.top_regions?.length > 0 && ["Strongest regions", anchor.top_regions.join(", ")],
    Number.isFinite(a.momentum_score) && a.momentum_score >= 40 && ["Momentum", `${a.momentum_score}/100 — accelerating`],
  ].filter(Boolean);
  const routing = (a.ra_recent_cities || []).slice(0, 5).map(c => `${c.city}${c.days_since != null ? ` · ${c.days_since}d ago` : ""}`);
  return {
    name: a.name, rank: a.rank, verdict,
    feeNow: a.booking_fee?.label, feeImplied: a.demand_fee_label,
    gap: g, gapPct: a.value_gap_pct, signal: a.value_signal,
    verified: a.booking_fee?.basis === "anchored",
    comps: peerFeeComps(a, rankings), evidence, routing,
    line: negotiationLine(a),
  };
}

// ── PDF rendering ──────────────────────────────────────────────────────────────
export function renderReportPDF(doc, r) {
  const L = 56, R = 539, W = R - L;
  const rule = (y, color = "#e7e8ea") => doc.moveTo(L, y).lineTo(R, y).lineWidth(1).strokeColor(color).stroke();

  // Masthead
  doc.fillColor(ACCENT).rect(L, 52, 26, 6).fill();
  doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(9).text("PEAKTIME · NEUTRAL DEMAND BENCHMARK", L, 66, { characterSpacing: 1 });
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(26).text("Fair Value Report", L, 84);
  doc.fillColor(INK).font("Helvetica").fontSize(14).text(`${r.name}${r.rank ? `   ·   #${r.rank}` : ""}`, L, 116);
  rule(142);

  // Verdict
  let y = 158;
  doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(13).text(r.verdict, L, y);
  const gapStr = Number.isFinite(r.gap) ? `${r.gap > 0 ? "+" : ""}${r.gap} tier${Math.abs(r.gap) !== 1 ? "s" : ""}${Number.isFinite(r.gapPct) ? `  ·  ${r.gapPct > 0 ? "+" : ""}${r.gapPct}%` : ""}` : "";
  doc.fillColor(MUTED).font("Helvetica").fontSize(10).text(gapStr, L, y + 2, { width: W, align: "right" });
  y += 26;

  // Fee bands
  doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(8.5).text("CURRENT FEE BAND", L, y, { characterSpacing: 0.8 });
  doc.text("DEMAND-IMPLIED BAND", L + W / 2, y, { characterSpacing: 0.8 });
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(18).text(r.feeNow || "—", L, y + 13);
  doc.fillColor(ACCENT).text(r.feeImplied || "—", L + W / 2, y + 13);
  doc.fillColor(MUTED).font("Helvetica").fontSize(8.5)
     .text(r.verified ? "✓ verified fee" : "estimated tier — model-implied, not a quoted price", L, y + 38, { width: W / 2 - 10 });
  y += 64;
  rule(y); y += 18;

  // Local fee comps
  if (r.comps) {
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(11).text("Comparable fees", L, y);
    doc.fillColor(MUTED).font("Helvetica").fontSize(9)
       .text(r.comps.regional ? "acts who fill the same rooms in this artist's regions" : "acts who fill the same-size rooms", L, y + 16);
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(15).text(`${feeShort(r.comps.lo)}–${feeShort(r.comps.hi)}`, L, y + 30);
    doc.fillColor(MUTED).font("Helvetica").fontSize(9).text(`across ${r.comps.count} comparable acts${r.comps.venueLabel ? ` · ${r.comps.venueLabel} cap rooms` : ""}`, L, y + 50);
    if (r.comps.examples?.length) {
      doc.fillColor(MUTED).fontSize(9).text(r.comps.examples.map(e => `${e.name} ${e.fee}`).join("    ·    "), L, y + 66, { width: W });
    }
    y += 92; rule(y); y += 18;
  }

  // Evidence
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(11).text("Live & local anchor", L, y);
  doc.fillColor(MUTED).font("Helvetica").fontSize(9).text("the basis bookers trust", L, y, { width: W, align: "right" });
  y += 20;
  for (const [label, val] of r.evidence) {
    doc.fillColor(ACCENT).circle(L + 3, y + 5, 2).fill();
    doc.fillColor(MUTED).font("Helvetica").fontSize(9.5).text(label, L + 14, y, { width: 150, continued: false });
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(9.5).text(String(val), L + 170, y, { width: W - 170 });
    y += 17;
  }
  if (r.routing.length) {
    y += 4;
    doc.fillColor(MUTED).font("Helvetica").fontSize(9).text(`Recent routing: ${r.routing.join("   ·   ")}`, L, y, { width: W });
    y += 18;
  }
  y += 6; rule(y); y += 18;

  // The negotiation line — the artefact's payload
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(11).text("Take this to the table", L, y);
  y += 18;
  const lineHeight = doc.font("Helvetica").fontSize(10.5).heightOfString(r.line, { width: W - 28, lineGap: 2 });
  doc.fillColor("#f5f8ea").roundedRect(L, y, W, lineHeight + 24, 8).fill();
  doc.fillColor(INK).font("Helvetica").fontSize(10.5).text(r.line, L + 14, y + 12, { width: W - 28, lineGap: 2 });
  y += lineHeight + 24 + 16;

  // Footer
  doc.fillColor(MUTED).font("Helvetica").fontSize(8)
     .text(`Generated ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} · demand data only, no party's input · thedjrankings.com`, L, 760, { width: W, align: "center" });
}

async function fetchRankings() {
  const res = await fetch(`${FRONTEND}/rankings.json`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`rankings.json ${res.status}`);
  const d = await res.json();
  return d.rankings || d;
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).send("GET only");
  if (!process.env.STRIPE_SECRET_KEY) return res.status(503).send("Fulfilment not configured.");

  const sessionId = req.query?.session_id || new URL(req.url, "http://x").searchParams.get("session_id");
  if (!sessionId) return res.status(400).send("Missing session_id.");

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") return res.status(402).send("Payment not completed.");

    const slug = session.metadata?.artist || slugify(session.metadata?.name);
    if (!slug) return res.status(404).send("No artist on this purchase.");

    const rankings = await fetchRankings();
    const artist = rankings.find(a => slugify(a.name) === slug);
    if (!artist || !Number.isFinite(artist.value_gap) || !artist.booking_fee) {
      return res.status(404).send("No Fair Value Report available for this artist.");
    }

    const report = deriveReport(artist, rankings);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="PEAKTIME-FairValue-${slug}.pdf"`);
    const doc = new PDFDocument({ size: "A4", margin: 0 });
    doc.pipe(res);
    renderReportPDF(doc, report);
    doc.end();
  } catch (e) {
    return res.status(500).send(`Could not generate the report: ${e.message}`);
  }
}
