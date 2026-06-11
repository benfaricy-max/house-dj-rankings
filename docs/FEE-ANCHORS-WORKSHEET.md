# Fee-Anchor Collection Worksheet

> Companion to `FEE-ANCHORS-PLAYBOOK.md`. This is the turnkey sheet: the exact ask,
> the priority targets pre-loaded, and a paste-ready template. Goal: **35 real
> anchors.** Current: **0.** Pipeline: **proven** (validator + computeFees verified
> end-to-end — a real fee flips an act to "✓ verified" and uncaps Value Gap confidence).

---

## The finding on press anchors (why this file starts empty)

I searched the one channel that doesn't need a founder call — published/press fees.
**Result: nothing citable for this roster.** Every public number is one of:

- **Agency-listing estimate aggregators** (delafont, playhousesound, bookingagentinfo,
  twisted-entertainment) — third-party *guesses* ("$150k–$299k"). These are NOT real
  quoted/transacted fees. Seeding them violates the file's permanent rule.
- **Editorial blog ranges** (e.g. "Adam Beyer $40–80k/show") — a writer's estimate,
  not a contract or a named quote.
- **Festival pay breakdowns** (Coachella 2026) — name only pop headliners, zero DJs.

Real transacted DJ fees are confidential by contract. **The credible-anchor channel
is the founder discovery calls — full stop.** Don't pad this file to feel productive;
one real number from a booker beats ten agency-site guesses.

---

## The ask (add to the end of every GTM.md §4 call)

> *"Last thing, just so I can calibrate the model honestly — what did the last
> comparable booking actually cost you? Ballpark is fine, and it stays between us as
> a data point, never attributed."*

Bookers answer this when they trust you're not selling. Log it the same day.

---

## Priority A — strong-buy/buy reads in the pitch pipeline

These have the biggest £-hook *and* a live model call on them, so a real fee does
double duty (grounds the pitch + grades the backtest). Fill `fee_gbp` from a call.

| Artist | Current estimate | Model says | Real fee (£) | Source | Date |
|---|---|---|---|---|---|
| Jayda G | £8K–£18K | strong-buy +317% | | | |
| Josh Baker | £8K–£18K | buy +317% | | | |
| Job Jobse | £8K–£18K | buy +317% | | | |
| PAWSA | £8K–£18K | strong-buy +133% | | | |
| Yotto | £8K–£18K | strong-buy +133% | | | |
| KETTAMA | £8K–£18K | strong-buy +133% | | | |
| Marco Faraone | £8K–£18K | strong-buy +133% | | | |
| WhoMadeWho | £8K–£18K | strong-buy +133% | | | |
| Franky Rizardo | £8K–£18K | buy +133% | | | |
| Carlita | £8K–£18K | buy +133% | | | |

## Priority B — calibration spread (≥5 per tier grounds the scale)

| Tier | Band | Get a real fee for any of… |
|---|---|---|
| 6 | £70K–£150K | Peggy Gou, FISHER, Black Coffee, John Summit |
| 5 | £35K–£70K | Charlotte de Witte, Solomun, Adam Beyer, Carl Cox |
| 4 | £18K–£40K | Prospa, ANOTR, Chris Stussy, Mau P |
| 3 | £8K–£18K | Josh Baker, Âme, Armand Van Helden, PAWSA |
| 2 | £4K–£10K | Max Styler, Township Rebellion, Kolter, Omar |
| 1 | £1.5K–£5K | Julian Fijma, Roddy Lima, Colyn, Palms Trax |

---

## Paste-ready template

When you have a real number, drop it into `backend/fee_anchors.json`'s `anchors`
array and run the validator:

```json
{ "name": "PAWSA", "fee_gbp": 14000, "source": "promoter-quote", "source_url": null, "date": "2026-06-15", "region": "EU-club", "note": "quoted to [promoter] for an autumn club date, ex-travel" }
```

`source` ∈ `promoter-quote` (buy-side) · `agency-ratecard` (sell-side) · `contract` ·
`press` (the last two are ground truth — most valuable). Then:

```bash
node backend/validateAnchors.js        # checks schema, balance, coverage, outliers
node backend/computeFees.js            # applies anchors → "✓ verified fee" on covered acts
node backend/enrichValueGap.js         # re-reads gaps vs the now-verified fees
```

**Watch the source balance.** Keep promoter-quotes (buy-side) under 70% and get a
few `contract`/`press` ground-truth anchors — a buyer-only dataset drifts fees down
and quietly erodes the neutrality moat (the anti-lowball guard in `validateAnchors.js`
will warn you).

---

## Milestones

- [ ] **5** — first calls landed, source mix balanced, neutral spine exists.
- [ ] **15** — Priority-A reads grounded; pitch stops saying "estimate" on lead acts.
- [ ] **35** — ≥5/tier, buy-side <70%, ≥10 ground-truth. Confidence uncaps; model
      calibrated *and* validated. This is the asset that unlocks the £75/£300 pricing.
