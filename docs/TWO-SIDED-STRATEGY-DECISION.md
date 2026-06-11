# PEAKTIME — Decision: Which Side of the Table Do We Serve?

> **Status: OPEN DECISION — needs a call from the founder.**
> Surfaced by the June 2026 research panel (fan / promoter / talent buyer / artist
> manager / artist). The buy-side research (market + competitive + user-research)
> never hit this; the *sell-side* personas did, hard. It's the highest-stakes
> unanswered question in the strategy, because the wrong answer detonates the one
> moat the whole plan rests on: **neutrality** (STRATEGY.md §1).

---

## 1 · The decision in one sentence

PEAKTIME's data is useful to **both** sides of a booking negotiation — but the buyer
and the seller want opposite things from it, and serving both openly may be
incompatible with being *neutral*. We must decide, deliberately: **buy-side only,
walled two-sided, or open two-sided** — and build accordingly.

---

## 2 · Why this is forced now, not later

The product is currently built **buy-side** (STRATEGY.md §1 beachhead, GTM.md
pitch). But the same features read as weapons from the other side:

| Feature | Buyer (pays today) | Seller (manager / artist) |
|---|---|---|
| **Routing/saturation alert** | "Don't overpay for an over-routed act" — *favourite feature, "I'd open the app just for this"* (promoter) | *"A buyer's weapon pointed at my fee"* (manager); *"a sentence that could cost me a booking"* (artist) |
| **Value Gap → "premium"** | "This act is overpriced, offer less" | A public, model-implied, Medium-confidence verdict telling every promoter my artist is a bad buy — *based on a fee we estimated* |
| **Buyer-side negotiation script** | Copy-paste a lowball line | The same report arms the person across the table from the artist |
| **"Send it" fee mailto** | Crowdsource real fees | *Buyers have every incentive to submit LOW fees → the model drifts down → we quietly lower market fees* (manager) |

Two independent personas (manager + artist) flagged the **consent/reputational
time-bomb**: artists are scored publicly without opting in. *"thedjrankings.com is
telling promoters I'm overpriced and I never agreed to be on it."* That's a PR and
possibly legal exposure that grows with every new user.

And the strategic kicker (manager, verbatim): *"The day a promoter realises managers
are using 'the neutral Index' as a fee-raising weapon, your neutrality — your entire
moat — is gone."*

---

## 3 · The three options

### Option A — Buy-side only (stay the course, tighten it)
Serve buyers. Treat sell-side use as incidental. Don't build manager/artist SKUs.

- **Pros:** Coherent with STRATEGY/GTM today. One ICP, one message, one motion.
  Neutrality is defensible *as "we don't represent any act."*
- **Cons:** Leaves the artist consent bomb live. Managers/artists still screenshot
  favourable reads and ignore unfavourable ones — you get the neutrality *risk*
  without the sell-side *revenue*. Caps TAM at the ~3,000 buyers (STRATEGY §2).
- **Required guardrails:** an artist **claim + contest + suppress** flow (defuses
  the bomb regardless of which option wins — see §5). Frame the index as "demand
  signal," never "what you're worth."

### Option B — Walled two-sided (sell the same neutrality to both, separately)
Buyers get the buy lane; managers/artists get a *separate* product (roster
monitoring, sell-side collateral, claim/defend) — but the **underlying index stays
one neutral number** both cite. Wall the *tools*, not the *truth*.

- **Pros:** Doubles the market (managers would pay £40–60/mo, artists £8–15/mo per
  the panel — new revenue STRATEGY §2 doesn't count). The neutral number is exactly
  what makes it citeable by both, which is the *point* — a benchmark only works if
  both sides trust it. Defensible: "we give everyone the same read; we sell each
  side better tools to act on it."
- **Cons:** Operationally heavier (two SKUs, two motions). The neutrality story gets
  subtle — "we sell a fee-raising tool to managers AND a fee-cutting tool to buyers"
  is true but needs careful framing or it reads as playing both sides for money.
- **Required guardrails:** all of A's, plus: the fee-anchor intake must stay
  **two-sided and balanced** (the anti-lowball design in
  `docs/FEE-ANCHORS-PLAYBOOK.md` is literally this guardrail in code), and the
  negotiation script should be *symmetric* (offer-case and ask-case), not buyer-only.

### Option C — Open two-sided marketplace
Lean in: become the shared price-discovery layer for the whole scene, like a public
comp. Both sides transact around the number.

- **Pros:** Biggest vision; strongest network effects; the number becomes
  infrastructure.
- **Cons:** Highest neutrality risk and highest build cost; pulls toward being a
  booking marketplace (where RA already is, and RA *has a side*). Premature pre-PMF.
- **Verdict:** Not now. Revisit only after the buy-side wedge is proven and 35
  anchors exist.

---

## 4 · Recommendation

**Option B (walled two-sided), sequenced — but not yet.** Concretely:

1. **Now (next 90 days): stay buy-side in GO-TO-MARKET (Option A motion)** — the
   first 10 founder calls, the anchor program, the buyer lane. Don't split focus
   pre-PMF. STRATEGY §7's "single next action" stands.
2. **Now, regardless of option: ship the consent guardrails (§5).** The artist
   claim/contest/suppress flow is not optional and not option-dependent — it
   defuses a live reputational bomb and *also* becomes the on-ramp to the future
   manager/artist SKU. Build it once; it serves both the risk and the roadmap.
3. **Later (post-PMF, ≥15 anchors): open the walled sell-side SKU (Option B
   product)** — roster monitoring + sell-side collateral at ~£50/mo for managers,
   a cheap/free claim-and-defend tier for artists. The panel sized real willingness
   to pay here; it's net-new LTV the current model ignores.

Why B over A long-term: a fee benchmark that *only* buyers use isn't neutral, it's a
buyer's tool — and sellers will say so, killing its authority in the room. The
benchmark's power is that **both sides cite the same number.** That's only true if
you serve both. Neutrality is preserved by keeping the *number* single and the
*anchor intake* balanced — not by pretending only buyers exist.

---

## 5 · The guardrails that ship regardless (do these now)

These defuse the consent bomb and protect the moat under *any* option:

- [ ] **Artist claim flow** — let an artist/manager claim a profile (verify identity).
- [ ] **Contest a data point** — a path to flag a wrong fee estimate or scene score,
      with provenance, before it's quoted against them.
- [ ] **Suppress the buyer-facing fee verdict** — let a claimed artist hide the
      public "premium/underpriced" call on themselves (the verdict can stay internal
      to paying buyers without being a public billboard).
- [ ] **Frame as demand signal, never "worth"** — copy audit: the index reads a
      *demand* gap, not a person's value. Words matter when the data point is a human.
- [ ] **Two-sided, balanced anchor intake** — enforced by
      `node backend/validateAnchors.js` (buy-side cap, ground-truth floor). This is
      the anti-lowball moat in code; keep it green.
- [ ] **Symmetric negotiation script** — ship the seller/ask-case alongside the
      buyer/offer-case so the tool isn't structurally a lowball weapon.

---

## 6 · What would change the recommendation

- If the first 10 calls reveal buyers **won't** pay until sellers are also on the
  platform feeding real fees → accelerate Option B (the two-sided data flywheel is
  the unlock, not a later layer).
- If an artist publicly objects to being scored before the claim flow ships → the
  guardrails (§5) become P0, today, ahead of any growth work.
- If RA ships booking/fee analytics → neutrality + the buyer relationship is the
  only defensible ground (STRATEGY §5 watch-item); that *strengthens* the case for
  serving both sides a number RA structurally can't (RA has a side).

---

*Companion docs: `STRATEGY.md` (the buy-side thesis this decision sits on top of),
`docs/FEE-ANCHORS-PLAYBOOK.md` (the balanced-intake guardrail), `BRAND.md`
(neutrality voice). Decision owner: founder. Recommended review: after call #5.*
