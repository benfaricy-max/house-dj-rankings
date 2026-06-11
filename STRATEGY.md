# PEAKTIME — Strategy

> The neutral demand index for electronic music. The one read in a booking
> negotiation that isn't selling either side anything.

Companion docs: `GTM.md` (Stage-0 sales motion + target tracker), `COMMERCE.md`
(pricing/billing skeleton), `BRAND.md` (voice/positioning), `CLAUDE.md` (architecture).
This file is the strategic layer above them — what we're building, why it wins, and the
honest state of play. Generated from a six-lens pass (business plan, pricing, revenue,
growth, USP, competitive) on 2026-06-10.

---

## 1 · The business in one page

**Problem.** A house/techno booking fee is set on gut, agent hype, and Spotify follower
counts. On a £5k–£50k headliner the buyer has no independent way to know if they're
overpaying by £10k, and the seller has no neutral proof the act is underpriced. Both
sides negotiate blind.

**Wedge.** Not the leaderboard — the **Value Gap report**: a fee benchmark that reads
"demand-implied £Y vs current band £X → strong-buy," with a paste-ready negotiation line
and a private, expiring Pitch Link. The ranking is the free funnel; the fee read is the
product.

**Beachhead.** Buy-side first — independent house/techno promoters and talent buyers in
the UK/EU who personally sign £5k–£50k offers. One person decides, so that person is
buyer and champion in one. Agents come later via Pitch Link (the expansion motion).

**Model.** SaaS subscription. **Solo £75/mo** (independent buyers), **Team £300/mo**
(agencies/festivals). Land Solo, expand to Team — Team carries the LTV.

**The edge (ranked by durability).**
1. **Neutrality** — no agency, no act, no kickback. The hardest thing for an incumbent
   to copy, because RA, Beatport, and agencies all have a side. This is the moat.
2. **Booking demand, not popularity** — scene credibility leads; raw reach is demoted.
3. **Value Gap as a concrete buy/sell signal** with a negotiation artifact — turns data
   into a decision both sides can cite.

---

## 2 · Market & revenue (bottom-up)

**TAM is a niche, and that's a strategic fork, not a flaw.**
~3,000 independent buyers globally × £75 + ~300 agencies/festivals × £300 ≈
**£3–4M ARR fully penetrated.** This is a boutique/lifestyle SaaS *or* a wedge into a
bigger talent-data play (fee-benchmark data → agency tooling, licensing). **Decide which**
— it changes pricing, fundraising, and how hard to chase scale.

**18-month path (conservative → aggressive):**

| Driver | Conservative | Aggressive |
|---|---|---|
| Solo subs | 40 × £75 | 120 × £75 |
| Team subs | 8 × £300 | 25 × £300 |
| **MRR** | **£5,400** | **£16,500** |
| **ARR** | **~£65k** | **~£198k** |

**Unit economics (estimated — validate on calls).** CAC ≈ £0 today (founder outreach);
at scale, paid CAC for a £75/mo product in a tiny market is dangerous, so growth must
stay organic/community/referral. Churn unknown — bound at 4–6%/mo → Solo LTV ≈
£1.3k–1.8k, Team LTV ≈ £6k–9k. **Team is the business.**

**The load-bearing assumption:** that a booker pays *monthly* for an *episodic* need (a
few risky bookings a quarter). If the need is episodic, subscription churn will be brutal
and a per-decision model may fit better. `GTM.md` Q3 tests this directly.

---

## 3 · Pricing posture

- **Don't defend £75/£300 — collect their number.** The prices are a hypothesis in
  `Pricing.jsx`, not a finding. The first 10 calls replace them.
- **The 4× Solo→Team jump needs a real fence.** Make Team a different *job*
  (multi-buyer roster intelligence, competitive routing across a lineup), not "Solo with
  logins."
- **Likely under-pricing Team.** An agency avoiding one £10k overpay a quarter gets 30×+
  return at £300/mo. Test higher (£500–£1,000), not lower.
- **Keep the index free.** Paywalling the ranking reads as pay-to-play and damages the
  neutrality moat. Charge for the *decision tools* (Value Gap depth, Pitch Links, Team
  intel) — which is how it's already structured. Protect that.

---

## 4 · Go-to-market & growth

Stage is pre-PMF, open product. The job is reach, usage, and trust — not spend.

- **Motion (per `GTM.md`):** founder closes the first 10 by hand; buy-side first; warm
  intro → cold-number email → RA/IG DM, with the Value Gap report *as* the artifact.
- **The loop:** Pitch Link compounds — every shared read exposes a new booker. Free
  ranking + CRSSD-featured blog is the top-of-funnel. North-star activation event:
  `pitch_opened` (instrumented in `peaktime_funnel`).
- **Activation before acquisition.** Don't pour traffic onto a read that isn't yet
  trusted; you only burn first impressions.
- **Position against the status quo, not against RA.** "Replace the coin-flip with a
  number" expands the category; "we're better than Resident Advisor" picks a fight with a
  bigger, data-richer incumbent.

---

## 5 · Competitive landscape

| Competitor | Owns | Soft spot | Threat |
|---|---|---|---|
| **Resident Advisor** | Live-booking demand, scene authority, the audience | Sells events/tickets — *has a side*; no fee benchmark | **Highest** — closest data, could build this, but can't be neutral |
| **Beatport** | Genre chart credibility | Not booking demand, not buyer-facing | Low |
| **Chartmetric / Soundcharts** | Streaming-reach analytics | Reach-biased; not scene-credible; not fee-oriented | Medium |
| **Agency data + agent gut** | The actual incumbent for a fee decision | Partisan by definition (the seller) | Medium |
| **Status quo: doing nothing** | Negotiating on hype & relationships | No neutral benchmark at all | **The real competitor** |

**Watch-item:** any RA move toward booking analytics or promoter-facing fee guidance
kills the *data* moat overnight — so build defensibility on **neutrality + the buyer
relationship**, never on "best data."

---

## 6 · Honest state of play (2026-06-10)

You have an investor-grade **product** and a zero-grade **business** — and the two
unvalidated facts every lens dead-ends at are the same:

1. **0 verified fee anchors.** `fee_anchors.json` is seeded empty. Every Value Gap is
   currently an *estimate* (`basis: "curated"`). The wedge, the USP, the pricing
   justification, and the growth loop's trust gate all rest on fee accuracy that is
   unproven. **30–40 real anchors is the single highest-leverage asset you don't have.**
   The first booker who knows a real fee and sees the estimate is off doesn't just
   discount that number — they lose trust in the neutrality, which *is* the moat.

2. **Outreach hasn't started.** `GTM.md` is excellent and unexecuted; the §1 target table
   is being filled now (see below); the funnel is instrumented and empty (no events
   because no Pitch Link has been sent).

**The trap:** recent commits are product polish ("A Booking Day" tab, dead Spotify IDs).
The next proof point is not a feature — it's a conversation.

**These solve each other.** The first 10 founder-led calls *produce* the fee anchors
(bookers say real numbers), the activation data, and the design partners —
simultaneously.

---

## 7 · The single next action

Fill `GTM.md` §1 with five real names this week and send five Pitch Links. That one move
clears three blockers at once: first activation data, first fee anchors, first design
partner. **Don't touch Stripe until those calls have happened.**

See `GTM.md` §1 for the seeded strong-buy target shortlist (artists reading as
underpriced, with the rooms/promoters that book them).
