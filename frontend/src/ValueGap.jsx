import { useState, useMemo } from "react";
import "./ValueGap.css";
import { ArtistLink, slugify } from "./ArtistProfile";

// The wedge: a NEUTRAL third-party benchmark for booking fees. Today fee talks are
// information-asymmetric — the agent knows the artist's demand, the promoter doesn't,
// and there's no neutral number either side can cite. Value Gap is that number. Both
// sides pay for it because a neutral source you can both point to beats a partisan one.

const fmt = n => (!n ? "—" : n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? Math.round(n / 1e3) + "K" : String(n));
export const valueSlug = name => slugify(name);

// The evidence that builds (or fails to build) the demand case. Transparent on
// purpose — the methodology being inspectable is what makes the verdict neutral.
const EVIDENCE = [
  { key: "reach",      label: "Streaming reach",            has: a => a.spotify_monthly_listeners > 0,            val: a => `${fmt(a.spotify_monthly_listeners)} monthly listeners` },
  { key: "ra",         label: "Live booking demand (RA)",   has: a => a.ra_score > 0,                             val: a => `RA ${a.ra_score}/100${a.ra_avg_attending ? ` · ${a.ra_avg_attending} avg attending` : ""}${a.ra_venue_tier ? ` · venue tier ${a.ra_venue_tier}/5` : ""}` },
  { key: "beatport",   label: "Scene / chart credibility",  has: a => a.beatport_score > 0,                       val: a => `Beatport ${a.beatport_score}/100` },
  { key: "conversion", label: "Streaming→live conversion",  has: a => Number.isFinite(a.live_conversion_score),  val: a => `${a.live_conversion_score}/100 (live demand vs streaming size)` },
  { key: "trends",     label: "Search interest",            has: a => a.google_trends_score > 0,                  val: a => `${Math.round(a.google_trends_score)}/100` },
  { key: "youtube",    label: "YouTube audience",           has: a => a.youtube_subscribers > 0,                  val: a => `${fmt(a.youtube_subscribers)} subscribers` },
];

// Confidence = how much independent evidence corroborates the gap. This is the
// guardrail against false positives (e.g. a pre-streaming legend whose demand
// index rests on a single signal). A neutral benchmark must say "we don't have
// enough to prove this" when that's true.
export function valueConfidence(a) {
  const present = EVIDENCE.filter(s => s.has(a));
  const n = present.length;
  const hasLive = a.ra_score > 0;        // a fee is built on live demand above all
  let level;
  if (n >= 4 && hasLive) level = "High";
  else if (n >= 3 || (n >= 2 && hasLive)) level = "Medium";
  else level = "Low";
  return { level, dots: level === "High" ? 3 : level === "Medium" ? 2 : 1, present, n };
}

const verdictText = (a, conf) => {
  const g = a.value_gap, pct = a.value_gap_pct;
  if (g >= 1) return `Demand data implies ${a.name} is underpriced — the booking fee sits about ${g} tier${g > 1 ? "s" : ""} (~${pct > 0 ? "+" : ""}${pct}%) below what current demand supports.`;
  if (g <= -1) return `Demand data implies ${a.name}'s fee runs ahead of currently measured demand by about ${Math.abs(g)} tier${Math.abs(g) > 1 ? "s" : ""}.`;
  return `${a.name}'s fee is aligned with measured demand — a clean deal at the current rate.`;
};

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

// ── Shareable proof artifact: #/value/<slug> ─────────────────────────────────
export function ValueReport({ rankings, slug }) {
  const a = useMemo(() => rankings.find(r => valueSlug(r.name) === slug), [rankings, slug]);
  const [copied, setCopied] = useState(false);
  const back = () => { window.location.hash = ""; };

  if (!a || !Number.isFinite(a.value_gap) || !a.booking_fee) {
    return (
      <div className="page vr-page">
        <button className="ap-back" onClick={back}>← Back</button>
        <div className="vr-missing">No fair-value report for this artist yet — we only publish a verdict when there's a known fee anchor and enough demand data to be neutral about it.</div>
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
      `Evidence: ${conf.present.map(s => `${s.label} (${s.val(a)})`).join("; ")}.`,
      `Neutral demand benchmark · thedjrankings.com`,
    ];
    navigator.clipboard?.writeText(lines.join("\n")).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1900); });
  };

  return (
    <div className="page vr-page">
      <button className="ap-back" onClick={back}>← Back</button>
      <div className="vr-sheet">
        <div className="vr-top">
          <div className="vr-brand">PEAKTIME · Neutral demand benchmark</div>
          <button className="vr-copy" onClick={copySummary}>{copied ? "✓ Copied" : "Copy report"}</button>
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
            <div className="vr-band-s">{a.booking_fee.basis === "curated" ? "curated benchmark" : "anchored estimate"}</div>
          </div>
          <div className="vr-band-arrow">→</div>
          <div className="vr-band vr-band--implied">
            <div className="vr-band-l">Demand-implied band</div>
            <div className="vr-band-v">{a.demand_fee_label}</div>
            <div className="vr-band-s">{a.value_gap > 0 ? "+" : ""}{a.value_gap} tier{Math.abs(a.value_gap) !== 1 ? "s" : ""}{Number.isFinite(a.value_gap_pct) ? ` · ${a.value_gap_pct > 0 ? "+" : ""}${a.value_gap_pct}%` : ""}</div>
          </div>
        </div>

        <div className="vr-section-h">The evidence</div>
        <div className="vr-evidence">
          {conf.present.map(s => (
            <div className="vr-ev" key={s.key}>
              <span className="vr-ev-dot" />
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
          {EVIDENCE.filter(s => !s.has(a)).length > 0 && (
            <div className="vr-ev-missing">No signal yet from: {EVIDENCE.filter(s => !s.has(a)).map(s => s.label).join(", ")}.</div>
          )}
        </div>

        <div className="vr-section-h">What this means</div>
        <div className="vr-sides">
          <div className="vr-side">
            <div className="vr-side-h">For the buyer / promoter</div>
            <p>{sides.buyer}</p>
          </div>
          <div className="vr-side">
            <div className="vr-side-h">For the artist / manager</div>
            <p>{sides.seller}</p>
          </div>
        </div>

        <div className="vr-foot">
          Generated {new Date().toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })} · demand-data only, no party's input · <a href="#/value-method" onClick={e => { e.preventDefault(); window.location.hash = "#/value"; }}>methodology</a>
        </div>
      </div>
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
        <h1 className="vg-h1">The Value Gap</h1>
        <p className="vg-lead">
          Booking fees are negotiated blind: the agent knows the artist's demand, the buyer doesn't, and
          there's no neutral number either side can point to. Value Gap is that number — it estimates the
          fee an artist's <em>demand</em> supports, from observable data only, and shows the gap to the fee
          they're actually asking. One benchmark, two sides of the table.
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
            <p><strong>It uses no party's input.</strong> The demand-implied fee comes only from observable signals: streaming reach, live booking demand (Resident Advisor venue tier &amp; attendance), Beatport chart credibility, streaming-to-live conversion, search interest, and YouTube audience. Neither the artist nor the buyer feeds it anything.</p>
            <p><strong>It's a relative re-pricing, not an absolute claim.</strong> We rank every artist by a 0–100 demand index, then map that onto the <em>actual</em> distribution of booking-fee tiers in the market. So a gap means the data ranks an artist's demand above (or below) where their fee sits — not that a fee is "wrong" against some invented scale. Across the whole field the gaps net to roughly zero.</p>
            <p><strong>It only judges known fees.</strong> A verdict is published only when an artist has a curated or anchored fee to compare against. Comparing demand to a wild guess would just measure the guess.</p>
            <p><strong>It states its confidence.</strong> Every verdict carries a confidence level from how many independent signals corroborate it. Low-confidence cases (e.g. a legend with little streaming footprint) are held back rather than presented as proof — a neutral benchmark has to admit when it can't prove something.</p>
          </div>
        )}
      </div>
    </div>
  );
}
