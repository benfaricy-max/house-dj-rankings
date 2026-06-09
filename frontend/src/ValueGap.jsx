import { useState, useMemo } from "react";
import "./ValueGap.css";
import { ArtistLink, slugify } from "./ArtistProfile";
import { PitchLinkModal } from "./Pitch";
import PricingModal from "./Pricing";
import RoutingSaturation from "./RoutingSaturation";
import { usePro } from "./usePro";
import UpgradeCTA from "./UpgradeCTA";

// The wedge: a NEUTRAL third-party benchmark for booking fees. Today fee talks are
// information-asymmetric — the agent knows the artist's demand, the promoter doesn't,
// and there's no neutral number either side can cite. Value Gap is that number. Both
// sides pay for it because a neutral source you can both point to beats a partisan one.

const fmt = n => (!n ? "—" : n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? Math.round(n / 1e3) + "K" : String(n));
export const valueSlug = name => slugify(name);

// LIVE & LOCAL anchor — what bookers actually trust: the rooms you fill, the
// tickets you move, the routing you sustain. The whole verdict rests on these.
const LIVE = [
  { key: "venue",      label: "Venue size commanded",      has: a => a.value_anchor?.venue_tier > 0,             val: a => `Tier ${a.value_anchor.venue_tier}/5${a.value_anchor.venue_label ? ` · ${a.value_anchor.venue_label} cap` : ""}` },
  { key: "draw",       label: "Live draw per show",        has: a => a.value_anchor?.avg_attending > 0,          val: a => `${a.value_anchor.avg_attending} avg attending (RA)` },
  { key: "conversion", label: "Streaming→live conversion", has: a => Number.isFinite(a.value_anchor?.conversion),val: a => `${a.value_anchor.conversion}/100 vs streaming size` },
  { key: "routing",    label: "Tour routing breadth",      has: a => a.value_anchor?.routing_countries > 0,      val: a => `${a.value_anchor.routing_countries} countries` },
];
// Supporting digital signals — used only to corroborate the live picture, never
// to drive a verdict on their own (the booker objection these answers).
const SUPPORT = [
  { key: "reach",    label: "Streaming reach",           has: a => a.spotify_monthly_listeners > 0, val: a => `${fmt(a.spotify_monthly_listeners)} monthly listeners` },
  { key: "beatport", label: "Scene / chart credibility", has: a => a.beatport_score > 0,            val: a => `Beatport ${a.beatport_score}/100` },
  { key: "trends",   label: "Search interest",           has: a => a.google_trends_score > 0,       val: a => `${Math.round(a.google_trends_score)}/100` },
  { key: "youtube",  label: "YouTube audience",          has: a => a.youtube_subscribers > 0,       val: a => `${fmt(a.youtube_subscribers)} subscribers` },
];
const EVIDENCE = [...LIVE, ...SUPPORT];

// Confidence = how well the LIVE anchor holds + how much digital corroborates it.
// A verdict with no live anchor isn't published at all (the backend requires venue
// tier + attendance), so here we grade the depth of corroboration.
export function valueConfidence(a) {
  const live = LIVE.filter(s => s.has(a));
  const support = SUPPORT.filter(s => s.has(a));
  const anchored = a.value_anchor?.venue_tier > 0 && a.value_anchor?.avg_attending > 0;
  const feeVerified = a.booking_fee?.basis === "anchored" && !!a.booking_fee?.fee_source;
  let level;
  if (anchored && live.length >= 3 && support.length >= 2) level = "High";
  else if (anchored && support.length >= 1) level = "Medium";
  else level = "Low";
  // The benchmark fee is itself a model-implied estimate unless it's a verified
  // anchor. You can't be HIGH-confidence about an under/over-pricing call when you
  // don't actually know the fee — so cap unverified-fee verdicts at Medium.
  if (!feeVerified && level === "High") level = "Medium";
  return { level, feeVerified, dots: level === "High" ? 3 : level === "Medium" ? 2 : 1, live, support, present: [...live, ...support], n: live.length + support.length };
}

// Fee-basis honesty. The current fee is a MODEL-IMPLIED estimate (a curated tier
// or a listener-derived band) unless it's a verified anchor — a real quoted/
// contracted fee from fee_anchors.json. We never imply we know a fee we don't:
// a booker who actually knows fees would spot it in one click, and that kills trust.
export function feeBasis(a) {
  const bf = a.booking_fee || {};
  if (bf.basis === "anchored" && bf.fee_source) {
    return { verified: true, label: `verified fee · ${bf.fee_source}`,
      note: `Real, sourced fee${bf.fee_date ? ` (${bf.fee_date})` : ""} — not modelled.` };
  }
  if (bf.basis === "curated") {
    return { verified: false, label: "estimated tier · curated",
      note: "Hand-tiered estimate, not a transacted fee. The gap below is demand vs this estimate." };
  }
  return { verified: false, label: "estimated tier · model",
    note: "Listener-derived estimate, not a transacted fee. The gap below is demand vs this estimate." };
}

const verdictText = (a, conf) => {
  const g = a.value_gap, pct = a.value_gap_pct;
  if (g >= 1) return `Demand data implies ${a.name} is underpriced — the booking fee sits about ${g} tier${g > 1 ? "s" : ""} (~${pct > 0 ? "+" : ""}${pct}%) below what current demand supports.`;
  if (g <= -1) return `Demand data implies ${a.name}'s fee runs ahead of currently measured demand by about ${Math.abs(g)} tier${Math.abs(g) > 1 ? "s" : ""}.`;
  return `${a.name}'s fee is aligned with measured demand — a clean deal at the current rate.`;
};

// A ready-to-paste negotiation line — the exact gap the research surfaced: a
// manager who "just sounded like I was bragging, not negotiating" needs a neutral
// sentence they can drop into an email to justify the fee. Built only from the
// live anchor + the neutral benchmark, so it reads as evidence, not spin.
export function negotiationLine(a, side = "seller") {
  const anchor = a.value_anchor || {};
  const proof = [
    anchor.venue_tier > 0 && `tier ${anchor.venue_tier}/5 rooms`,
    anchor.avg_attending > 0 && `~${anchor.avg_attending} attending per show`,
    (anchor.routing_countries || a.ra_countries) > 0 && `${anchor.routing_countries || a.ra_countries} countries on the routing`,
  ].filter(Boolean).join(", ");
  const evidence = proof ? ` — ${proof}` : "";
  const surging = Number.isFinite(a.momentum_score) && a.momentum_score >= 40
    ? `, with momentum still climbing (${a.momentum_score}/100)` : "";
  const src = "Source: PEAKTIME neutral demand benchmark (thedjrankings.com), built from live booking data — no input from either side.";
  const g = a.value_gap;

  if (side === "buyer") {
    if (g >= 1) return `${a.name}'s measured demand${evidence} already supports ${a.demand_fee_label}${surging}, yet the act is still bookable around ${a.booking_fee.label}. Worth locking in at today's rate before the fee catches up. ${src}`;
    if (g <= -1) return `The ask for ${a.name} sits at ${a.booking_fee.label}, but measured live demand${evidence} only supports about ${a.demand_fee_label}. A fee nearer that band is the fair number, or expect to carry more ticket-sales risk. ${src}`;
    return `${a.name}'s fee (${a.booking_fee.label}) lines up with measured live demand${evidence} — a clean deal at the current rate. ${src}`;
  }
  // seller / manager / agent
  if (g >= 1) return `${a.name}'s live demand${evidence}${surging} supports a fee around ${a.demand_fee_label} — about ${g} tier${g > 1 ? "s" : ""} above the current ${a.booking_fee.label} band. ${src}`;
  if (g <= -1) return `${a.name}'s fee (${a.booking_fee.label}) currently sits ahead of independently measured demand${evidence}. Defensible with private sell-through data, but a data-led buyer will likely cite the gap. ${src}`;
  return `${a.name}'s ${a.booking_fee.label} fee is backed by independently measured live demand${evidence} — useful proof if a buyer tries to talk it down. ${src}`;
}

// Same data, two negotiating positions. This is why both audiences pay.
function bothSides(a) {
  const g = a.value_gap;
  if (g >= 1) return {
    buyer:  `Opportunity. You can likely book ${a.name} at today's rate before the fee rises to meet demand. If the quote comes in higher, this is your neutral benchmark to push back toward ${a.booking_fee.label}.`,
    seller: `Leverage. Neutral demand data supports a higher fee — roughly ${a.demand_fee_label}. Bring this into the next conversation instead of arguing from gut feel.`,
  };
  if (g <= -1) return {
    buyer:  `Caution. The asking fee runs ahead of measured demand. Use this to negotiate toward ${a.demand_fee_label}, or expect to carry more of the ticket-sales risk.`,
    seller: `Your fee is ahead of measured demand. Defensible if you hold private sell-through data — but a data-driven buyer will likely cite a gap here, so be ready for it.`,
  };
  return {
    buyer:  `Priced in line with demand. No overpay risk at the current rate, and little headroom to negotiate down.`,
    seller: `Priced correctly. The data backs your current fee — useful proof if a buyer tries to talk you down.`,
  };
}

// Local fee comps — the anchor a promoter actually wants: not a global index, but
// "what do acts who fill the SAME rooms (and tour the same regions) actually
// charge?" Bookers (Cookiy AI) said a demand number only lands when it's grounded
// in comparable local fees. Peers = same venue tier (room size they command) with
// a known fee; we prefer peers sharing this act's strongest regions for a true
// regional read, and fall back to same-room-size acts everywhere.
const feeShort = m => (!m ? null : m >= 1e6 ? `£${(m / 1e6).toFixed(1)}M` : m >= 1e3 ? `£${Math.round(m / 1e3)}K` : `£${m}`);
function peerFeeComps(a, rankings) {
  const vt = Math.round(a?.value_anchor?.venue_tier || a?.ra_venue_tier || 0);
  if (!vt || !Array.isArray(rankings)) return null;
  const myRegions = new Set((a.value_anchor?.top_regions || a.ra_country_list || []).map(String));
  const pool = rankings.filter(p =>
    p.name !== a.name &&
    p.booking_fee?.tier && Number.isFinite(p.booking_fee.mid) &&
    (p.booking_fee.basis === "curated" || p.booking_fee.basis === "anchored") &&
    Math.round(p.ra_venue_tier || 0) === vt);
  if (pool.length < 3) return null;
  const shareRegion = p => (p.value_anchor?.top_regions || p.ra_country_list || []).some(r => myRegions.has(String(r)));
  const regional = pool.filter(shareRegion);
  let basis = regional.length >= 4 ? regional : pool;
  const regionalUsed = basis === regional;
  // Narrow to genuinely comparable demand so the band isn't "the whole tier".
  // Same room size + similar measured demand = a real peer set, not a market dump.
  const di = a.demand_index;
  if (Number.isFinite(di)) {
    const near = basis.filter(p => Number.isFinite(p.demand_index) && Math.abs(p.demand_index - di) <= 15);
    if (near.length >= 4) basis = near;
  }
  const mids = basis.map(p => p.booking_fee.mid).sort((x, y) => x - y);
  // Interquartile band (25th–75th pct) — robust to a single outlier fee.
  const q = f => mids[Math.min(mids.length - 1, Math.max(0, Math.round(f * (mids.length - 1))))];
  const lo = q(0.25), hi = q(0.75);
  const median = q(0.5);
  const examples = [...basis]
    .sort((x, y) => Math.abs((x.demand_index || 0) - (di || 0)) - Math.abs((y.demand_index || 0) - (di || 0)))
    .slice(0, 3)
    .map(p => ({ name: p.name, fee: p.booking_fee.label }));
  return { count: basis.length, regional: regionalUsed, lo, hi, median, examples, venueLabel: a.value_anchor?.venue_label };
}

// ── Shareable proof artifact: #/value/<slug> ─────────────────────────────────
export function ValueReport({ rankings, slug }) {
  const a = useMemo(() => rankings.find(r => valueSlug(r.name) === slug), [rankings, slug]);
  const [copied, setCopied] = useState(false);
  const [lineCopied, setLineCopied] = useState("");
  const [pitchOpen, setPitchOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const { pro, paywall } = usePro();
  const comps = useMemo(() => (a ? peerFeeComps(a, rankings) : null), [a, rankings]);
  const back = () => { window.location.hash = ""; };

  const copyLine = (side) => {
    navigator.clipboard?.writeText(negotiationLine(a, side)).then(() => {
      setLineCopied(side); setTimeout(() => setLineCopied(""), 1900);
    });
  };

  if (!a || !Number.isFinite(a.value_gap) || !a.booking_fee) {
    return (
      <div className="page vr-page">
        <button className="ap-back" onClick={back}>← Back</button>
        <div className="vr-missing">No fair-value report for this artist yet — we only publish a verdict when there's a fee benchmark and enough live demand data to be neutral about it.</div>
      </div>
    );
  }

  const conf = valueConfidence(a);
  const sides = bothSides(a);
  const dir = a.value_gap >= 1 ? "under" : a.value_gap <= -1 ? "over" : "fair";

  const copySummary = () => {
    const lines = [
      `PEAKTIME — Fair Value Report: ${a.name}`,
      verdictText(a, conf),
      `Current fee band: ${a.booking_fee.label}  →  Demand-implied: ${a.demand_fee_label}  (confidence: ${conf.level})`,
      comps ? `Comparable fees (${comps.regional ? "same rooms, this artist's regions" : "same-size rooms"}): ${feeShort(comps.lo)}–${feeShort(comps.hi)} across ${comps.count} acts.` : null,
      `Evidence: ${conf.present.map(s => `${s.label} (${s.val(a)})`).join("; ")}.`,
      `Neutral demand benchmark · thedjrankings.com`,
    ].filter(Boolean);
    navigator.clipboard?.writeText(lines.join("\n")).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1900); });
  };

  return (
    <div className="page vr-page">
      <button className="ap-back" onClick={back}>← Back</button>
      <div className="vr-sheet">
        <div className="vr-top">
          <div className="vr-brand">PEAKTIME · Neutral demand benchmark</div>
          <div className="vr-top-actions">
            <button className="vr-copy" onClick={copySummary}>{copied ? "✓ Copied" : "Copy report"}</button>
            <button className="vr-copy vr-copy--primary" onClick={() => (paywall && !pro ? setPayOpen(true) : setPitchOpen(true))}>
              ↗ Private pitch link{paywall && !pro ? " · Pro" : ""}
            </button>
          </div>
        </div>

        <h1 className="vr-title">Fair Value Report</h1>
        <div className="vr-artist"><ArtistLink name={a.name} /> <span className="vr-rank">#{a.rank}</span></div>

        <div className={`vr-verdict vr-verdict--${dir}`}>
          <span className={`vr-flag vr-flag--${dir}`}>
            {dir === "under" ? "UNDERPRICED" : dir === "over" ? "PRICED AHEAD" : "FAIRLY PRICED"}
          </span>
          <p className="vr-verdict-text">{verdictText(a, conf)}</p>
          <div className={`vr-conf vr-conf--${conf.level.toLowerCase()}`}>
            Confidence: <strong>{conf.level}</strong>
            <span className="vr-dots">{"●".repeat(conf.dots)}{"○".repeat(3 - conf.dots)}</span>
            <span className="vr-conf-note">{conf.n} of {EVIDENCE.length} demand signals corroborate</span>
          </div>
        </div>

        {conf.level === "Low" && (
          <div className="vr-lowconf">⚠ Indicative only. Too few independent signals to present this as proof — treat as a prompt to dig deeper, not a benchmark to cite.</div>
        )}

        <div className="vr-bands">
          <div className="vr-band">
            <div className="vr-band-l">Current fee band</div>
            <div className="vr-band-v">{a.booking_fee.label}</div>
            <div className={`vr-band-s${feeBasis(a).verified ? " vr-band-s--verified" : ""}`}>{feeBasis(a).verified ? "✓ " : ""}{feeBasis(a).label}</div>
          </div>
          <div className="vr-band-arrow">→</div>
          <div className="vr-band vr-band--implied">
            <div className="vr-band-l">Demand-implied band</div>
            <div className="vr-band-v">{a.demand_fee_label}</div>
            <div className="vr-band-s">{a.value_gap > 0 ? "+" : ""}{a.value_gap} tier{Math.abs(a.value_gap) !== 1 ? "s" : ""}{Number.isFinite(a.value_gap_pct) ? ` · ${a.value_gap_pct > 0 ? "+" : ""}${a.value_gap_pct}%` : ""}</div>
          </div>
        </div>

        {!feeBasis(a).verified && (
          <div className="vr-feenote">
            <strong>On the fee number:</strong> {feeBasis(a).note} We don't hold this act's transacted fee, so the benchmark is model-implied — read the gap as a demand signal, not a quoted price.{" "}
            <a href={`mailto:hello@thedjranks.com?subject=${encodeURIComponent(`Fee anchor: ${a.name}`)}&body=${encodeURIComponent(`Real fee for ${a.name} (quote/contract/published):\nFee (GBP): \nSource (promoter-quote / agency-ratecard / contract / press): \nDate: \nRegion: \nNotes: `)}`}>Know the real fee? Send it →</a> Verified fees override the estimate and raise confidence.
          </div>
        )}

        {comps && (
          <div className="vr-comps">
            <div className="vr-comps-h">
              <span className="vr-comps-title">Comparable fees</span>
              <span className="vr-comps-tag">{comps.regional ? "acts who fill the same rooms in this artist's regions" : "acts who fill the same-size rooms"}</span>
            </div>
            <div className="vr-comps-band">
              <span className="vr-comps-range">{feeShort(comps.lo)}–{feeShort(comps.hi)}</span>
              <span className="vr-comps-sub">
                across {comps.count} comparable act{comps.count !== 1 ? "s" : ""}{comps.venueLabel ? ` · ${comps.venueLabel} cap rooms` : ""}
              </span>
            </div>
            <div className="vr-comps-ex">
              {comps.examples.map(e => (
                <span className="vr-comp" key={e.name}><span className="vr-comp-n">{e.name}</span><span className="vr-comp-f">{e.fee}</span></span>
              ))}
            </div>
            <div className="vr-comps-note">The neutral local anchor: {a.name}'s demand-implied {a.demand_fee_label} band sits against what acts filling the same rooms actually command — not a global index.</div>
          </div>
        )}

        <div className="vr-section-h">Live &amp; local anchor <span className="vr-section-tag">the basis bookers trust</span></div>
        <div className="vr-evidence vr-evidence--live">
          {conf.live.map(s => (
            <div className="vr-ev" key={s.key}>
              <span className="vr-ev-dot" />
              <span className="vr-ev-label">{s.label}</span>
              <span className="vr-ev-val">{s.val(a)}</span>
            </div>
          ))}
          {a.value_anchor?.top_regions?.length > 0 && (
            <div className="vr-ev">
              <span className="vr-ev-dot" />
              <span className="vr-ev-label">Strongest regions</span>
              <span className="vr-ev-val">{a.value_anchor.top_regions.join(", ")}</span>
            </div>
          )}
          {a.value_anchor?.capped_by_venue && (
            <div className="vr-ev-note">⛓ Implied fee capped at the venue size this artist actually fills — no arena-fee inflation from digital reach.</div>
          )}
        </div>

        {Array.isArray(a.ra_recent_cities) && a.ra_recent_cities.length > 0 && (
          <>
            <div className="vr-section-h">Recent routing <span className="vr-section-tag">how fresh a date will feel in your market</span></div>
            <RoutingSaturation dj={a} compact max={5} />
          </>
        )}

        <div className="vr-section-h">Supporting signals <span className="vr-section-tag">corroboration only</span></div>
        <div className="vr-evidence">
          {conf.support.map(s => (
            <div className="vr-ev" key={s.key}>
              <span className="vr-ev-dot vr-ev-dot--support" />
              <span className="vr-ev-label">{s.label}</span>
              <span className="vr-ev-val">{s.val(a)}</span>
            </div>
          ))}
          {Number.isFinite(a.momentum_score) && a.momentum_score >= 40 && (
            <div className="vr-ev vr-ev--mo">
              <span className="vr-ev-dot vr-ev-dot--mo" />
              <span className="vr-ev-label">Momentum</span>
              <span className="vr-ev-val">▲ {a.momentum_score}/100 — demand accelerating</span>
            </div>
          )}
          {conf.support.length === 0 && <div className="vr-ev-missing">No supporting digital signals yet — verdict rests on the live anchor alone.</div>}
        </div>

        <div className="vr-section-h">What this means</div>
        <div className="vr-sides">
          <div className="vr-side">
            <div className="vr-side-h">For the buyer / promoter</div>
            <p>{sides.buyer}</p>
            <button className="vr-line-copy" onClick={() => copyLine("buyer")}>
              {lineCopied === "buyer" ? "✓ Copied — paste into your offer" : "Copy the negotiation line ↗"}
            </button>
          </div>
          <div className="vr-side">
            <div className="vr-side-h">For the artist / manager</div>
            <p>{sides.seller}</p>
            <button className="vr-line-copy" onClick={() => copyLine("seller")}>
              {lineCopied === "seller" ? "✓ Copied — paste into your pitch" : "Copy the negotiation line ↗"}
            </button>
          </div>
        </div>

        <div className="vr-foot">
          Generated {new Date().toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })} · demand-data only, no party's input · <a href="#/value-method" onClick={e => { e.preventDefault(); window.location.hash = "#/value"; }}>methodology</a>
        </div>
      </div>
      {pitchOpen && <PitchLinkModal artist={a} onClose={() => setPitchOpen(false)} />}
      <PricingModal open={payOpen} onClose={() => setPayOpen(false)} reason="Share this as a private pitch link" />
    </div>
  );
}

// ── The framework page (lives inside Booking Intelligence) ───────────────────
export function ValueGapPage({ rankings }) {
  const [audience, setAudience] = useState("buyer");   // "buyer" | "seller"
  const [showMethod, setShowMethod] = useState(false);

  const data = useMemo(() => {
    const judged = rankings
      .filter(a => a.booking_fee && Number.isFinite(a.value_gap))
      .map(a => ({ ...a, _conf: valueConfidence(a) }));
    // Only High/Medium confidence are presentable as "proof". Low confidence is
    // held back so the benchmark never overclaims.
    const solid = judged.filter(a => a._conf.level !== "Low");
    const byGap = (x, y) => (y.value_gap - x.value_gap) || ((y.momentum_score || 0) - (x.momentum_score || 0));
    return {
      under:    solid.filter(a => a.value_gap >= 1).sort(byGap),
      over:     solid.filter(a => a.value_gap <= -1).sort((x, y) => x.value_gap - y.value_gap),
      fair:     solid.filter(a => a.value_gap === 0).length,
      lowConf:  judged.filter(a => a._conf.level === "Low" && a.value_gap !== 0).length,
      total:    judged.length,
    };
  }, [rankings]);

  const Row = ({ a }) => (
    <a className="vg-row" href={`#/value/${valueSlug(a.name)}`}>
      <div className="vg-name"><span className="vg-name-text">{a.name}</span><span className="vg-rank">#{a.rank}</span></div>
      <div className="vg-fee">
        <span className="vg-now">{a.booking_fee.label}</span>
        <span className="vg-arrow">→</span>
        <span className="vg-implied">{a.demand_fee_label}</span>
      </div>
      <div className="vg-gap">
        <span className={`vg-gap-badge vg-gap--${a.value_gap > 0 ? "up" : "down"}`}>
          {a.value_gap > 0 ? "+" : ""}{a.value_gap} tier{Math.abs(a.value_gap) !== 1 ? "s" : ""}
        </span>
        <span className={`vg-conf-dots vg-conf-dots--${a._conf.level.toLowerCase()}`} title={`${a._conf.level} confidence`}>
          {"●".repeat(a._conf.dots)}{"○".repeat(3 - a._conf.dots)}
        </span>
      </div>
      <span className="vg-cta">{audience === "buyer" ? (a.value_gap > 0 ? "Book before it rises →" : "Negotiate down →") : (a.value_gap > 0 ? "Raise your fee →" : "Defend / review →")}</span>
    </a>
  );

  // The two audiences see the same data, led by what matters to them.
  const buyerLead  = data.over;    // don't overpay first
  const buyerNext  = data.under;   // then: grab the bargains
  const sellerLead = data.under;   // raise your fee first
  const sellerNext = data.over;    // then: the at-risk premium

  return (
    <div className="page vg-page">
      <div className="vg-hero">
        <div className="vg-kicker">Justify a fee increase · spot underpriced talent · with a number you didn't make up</div>
        <h1 className="vg-h1">The Value Gap</h1>
        <p className="vg-lead">
          Booking fees are negotiated blind: the agent knows the artist's demand, the buyer doesn't, and
          there's no neutral number either side can point to. Value Gap is that number. It's anchored to
          what bookers actually trust — <em>the venue size an artist fills, their live draw per show, and
          their tour routing</em> — with streaming and search used only to corroborate, never to drive it.
          The implied fee is capped at the rooms they really play, so it never inflates a club act into an
          arena fee. Open any artist for a ready-to-send negotiation line and a private pitch link.
        </p>
      </div>

      <div className="vg-toggle" role="tablist" aria-label="Your side of the table">
        <button role="tab" aria-selected={audience === "buyer"} className={`vg-tog ${audience === "buyer" ? "vg-tog--on" : ""}`} onClick={() => setAudience("buyer")}>
          I'm buying <span className="vg-tog-sub">promoter / talent buyer</span>
        </button>
        <button role="tab" aria-selected={audience === "seller"} className={`vg-tog ${audience === "seller" ? "vg-tog--on" : ""}`} onClick={() => setAudience("seller")}>
          I'm selling <span className="vg-tog-sub">artist / manager / agent</span>
        </button>
      </div>

      {audience === "buyer"
        ? <UpgradeCTA tier="solo" surface="value_gap_buyer" />
        : <UpgradeCTA tier="team" surface="value_gap_seller" />}

      {audience === "buyer" ? (
        <>
          <div className="vg-section">
            <div className="vg-head vg-head--prem">Don't overpay · fee runs ahead of demand</div>
            <div className="vg-sub">Your leverage. The data supports a lower number — negotiate toward the demand-implied band.</div>
            {buyerLead.length ? buyerLead.slice(0, 20).map(a => <Row key={a.name} a={a} />)
              : <div className="vg-empty">No clearly-overpriced acts with enough data to prove it right now.</div>}
          </div>
          <div className="vg-section">
            <div className="vg-head vg-head--up">Underpriced · book before the fee catches up</div>
            <div className="vg-sub">Your opportunity. Demand has outpaced the fee — lock them in at today's rate.</div>
            {buyerNext.slice(0, 25).map(a => <Row key={a.name} a={a} />)}
          </div>
        </>
      ) : (
        <>
          <div className="vg-section">
            <div className="vg-head vg-head--up">You're underpriced · raise your fee, with proof</div>
            <div className="vg-sub">Neutral demand data supports a higher fee. Bring the report into the negotiation.</div>
            {sellerLead.length ? sellerLead.slice(0, 25).map(a => <Row key={a.name} a={a} />)
              : <div className="vg-empty">No clearly-underpriced acts with enough data to prove it right now.</div>}
          </div>
          <div className="vg-section">
            <div className="vg-head vg-head--prem">Priced ahead · defend it or expect pushback</div>
            <div className="vg-sub">Your fee runs ahead of measured demand — fine if you hold private sell-through, but a data-driven buyer will cite this.</div>
            {sellerNext.slice(0, 20).map(a => <Row key={a.name} a={a} />)}
          </div>
        </>
      )}

      <div className="vg-stats">
        <span><strong>{data.total}</strong> artists benchmarked</span>
        <span><strong>{data.under.length}</strong> underpriced</span>
        <span><strong>{data.over.length}</strong> priced ahead</span>
        <span><strong>{data.fair}</strong> fairly priced</span>
        {data.lowConf > 0 && <span className="vg-stats-muted">{data.lowConf} held back (insufficient data to prove)</span>}
      </div>

      <div className="vg-method">
        <button className="vg-method-toggle" onClick={() => setShowMethod(s => !s)} aria-expanded={showMethod}>
          {showMethod ? "− " : "+ "}How the benchmark works (and why it's neutral)
        </button>
        {showMethod && (
          <div className="vg-method-body">
            <p><strong>It's anchored to live demand, not digital vanity metrics.</strong> The demand index is led (≈two-thirds of its weight) by the signals bookers price on: the venue tier an artist commands, their average live draw per show, streaming-to-live conversion, and tour-routing breadth. Streaming reach, Beatport, search and YouTube only corroborate — they can't drive a verdict on their own. This is the direct answer to "global metrics are noise until they line up with local ticket velocity and routing."</p>
            <p><strong>The implied fee is capped by venue size.</strong> A fee can't outrun the rooms you fill, so the demand-implied tier is capped at the venue tier an artist actually plays (plus a notch of headroom). No arena fee gets pinned on a 500-capacity club act because their Spotify is big.</p>
            <p><strong>No verdict without a live anchor.</strong> We publish a gap only for artists with a real venue tier <em>and</em> attendance figure to stand on. No live data, no verdict — the global-digital-only cases are excluded rather than guessed at.</p>
            <p><strong>It's a relative re-pricing.</strong> Every anchored artist is ranked by a 0–100 demand index, then mapped onto the <em>actual</em> distribution of booking-fee tiers. A gap means the data ranks an artist above (or below) where their fee sits — not a fee "wrong" against an invented scale. Across the field the gaps net to roughly zero.</p>
            <p><strong>It states its confidence and uses no party's input.</strong> Every verdict carries a confidence level from how well the live anchor holds and how much corroborates it; thin cases are held back. Neither the artist nor the buyer feeds it anything.</p>
          </div>
        )}
      </div>
    </div>
  );
}
