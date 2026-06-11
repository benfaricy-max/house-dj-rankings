# PEAKTIME — Fee-Anchor Acquisition Playbook

> **The one-line problem.** Zero verified fee anchors. Every Value Gap is
> demand-vs-*estimate*. The wedge, the USP, the pricing justification, and the
> neutrality moat all rest on fee accuracy that is unproven. **30–40 real anchors
> is the single highest-leverage asset PEAKTIME doesn't have** (STRATEGY.md §6).
> Every persona in the June 2026 research panel — promoter, talent buyer, manager,
> even the artist — independently named this as the thing that flips the product
> from "looks plausible" to "I'd cite it."

This playbook turns anchor collection from a vague goal into a tracked, two-sided,
anti-gameable pipeline. It pairs with two scripts:

- `node backend/validateAnchors.js` — validates every anchor, checks source
  balance (anti-lowball), reports coverage toward the goal, and prints the
  prioritized collection target list.
- `node backend/validateAnchors.js --strict` — CI gate; fails the build if any
  anchor is malformed (wire into `refresh.yml` once anchors exist).

---

## 1 · What counts as an anchor (and what never does)

An anchor is a **real** fee: actually quoted, contracted, or credibly published.
Schema lives in `backend/fee_anchors.json`. Four allowed sources, each with a
*side* — the incentive baked into who's telling you the number:

| `source` | Side | Incentive | Trust |
|---|---|---|---|
| `contract` | neutral | none — it's signed | highest (ground truth) |
| `press` | neutral | none — published, no party controls it | high (cite the URL) |
| `agency-ratecard` | **sell** | agent wants the number *high* | medium — corroborate |
| `promoter-quote` | **buy** | promoter wants the number *low* | medium — corroborate |

> **PERMANENT RULE (already in the file): never seed a guess.** A fabricated
> "anchor" is worse than an honest estimate — it launders a model number as ground
> truth and breaks the entire point. Leave the array empty until a real number exists.

---

## 2 · The anti-lowball design (this is the neutrality moat in code)

The artist-manager persona spotted the failure mode precisely: *"Buyers have every
incentive to submit LOW fees. If your anchor gets set by promoters lowballing via
your form, you've built a tool that lowers market fees."* That would invert the
product **and** destroy neutrality — the one defensible moat (STRATEGY.md §1).

The guard rails:

1. **Track the side of every anchor.** `validateAnchors.js` counts buy / sell /
   ground-truth and **warns when buy-side exceeds 70%**. The fee model must never
   be fed mostly by the people who want fees low.
2. **Require ground-truth anchors.** The validator warns if there are zero
   `contract`/`press` anchors — you need a neutral spine to calibrate the
   buy-vs-sell spread against.
3. **Corroborate single-party numbers.** A `promoter-quote` or `agency-ratecard`
   is a *claim*. Where possible, get the same act's fee from the other side or from
   press, and keep both (note the spread — the spread is itself a signal).
4. **Outlier smell test.** Any anchor >4× or <0.25× the current estimate is
   flagged for human check before it lands — catches typos and mis-keyed artists.
5. **Provenance for the cheap-to-fake sources.** `press`/`agency-ratecard` require
   a `source_url` so any anchor can be audited later.

Net: the dataset stays *two-sided and honest*, which is exactly what lets the
"neutral" claim survive contact with a sceptical booker.

---

## 3 · Where the anchors come from (collection channels, by yield)

Anchor collection is not a separate project — it rides on motions already in
`GTM.md`. Ranked by yield × effort:

1. **The founder discovery calls (GTM.md §4) — highest yield.** Q3 already asks
   "what would you pay, per what." Add one closing question: *"Just so I can
   calibrate — what did the last comparable booking actually cost you?"* Bookers
   say real numbers when they trust you're not selling. **Every call should
   produce ≥1 anchor.** Ten calls → ten anchors → a third of the goal.
2. **Press / published fees — free, neutral, do today.** Festival budget leaks,
   council-funded event filings (FOI-able fees for public events), agency rate
   cards that circulate, artist interviews quoting fees. These are `press`/
   `contract` ground-truth anchors you can collect *without talking to anyone* —
   start here to seed the neutral spine before the calls even begin.
3. **The "Send it" mailto in the Fair Value Report** — passive inbound. Keep it,
   but treat every submission as buy-side until proven otherwise (it's a promoter
   reporting). Never let inbound alone set an anchor.
4. **Design partners (post-call).** A promoter who becomes a design partner will
   share a booking history. That's a cluster of anchors from one relationship.

---

## 4 · Which anchors to get first (the priority order)

Run `node backend/validateAnchors.js --targets` for the live list. The logic:

- **Priority A — the strong-buy/buy reads already being pitched.** These have the
  biggest £-hook *and* the model has a live directional call on them
  (`value_call_history`). A real fee here does double duty: it grounds the pitch
  **and** it's the first thing that can grade the backtest. Today's top of the
  list: Jayda G (+317%), Josh Baker (+317%), Job Jobse (+317%), PAWSA (+133%),
  Yotto, KETTAMA, Marco Faraone…
- **Priority B — a calibration spread, ≥5 per fee tier.** The demand model is
  calibrated against the *tier scale*. If no tier is grounded in a real fee, the
  whole scale is an assumption. Get ≥5 anchors in each of tiers 1–6 (£1.5k →
  £150k) so the ladder itself is real. The validator shows the gap per tier.

A good first-35 mix: ~15 Priority-A strong-buy acts (grounds the pitch + the
backtest) + ~20 spread across the six tiers (grounds the scale), with at least 8–10
neutral `contract`/`press` anchors holding the middle.

---

## 5 · Definition of done

- [ ] **5 anchors** — first founder calls landed; validator shows a non-zero,
      balanced source mix; the neutral spine exists.
- [ ] **15 anchors** — Priority-A strong-buy reads grounded; the pitch stops
      saying "estimate" on the acts you lead with.
- [ ] **35 anchors** — ≥5 per tier, buy-side <70%, ≥10 ground-truth. The Value Gap
      confidence uncaps from Medium on covered acts; the model is calibrated AND
      validated against ground truth. **This is the asset that unlocks the £75/£300
      pricing the personas wouldn't pay until the fee number was real.**

Re-run `node backend/validateAnchors.js` after every call. The coverage bar and the
balance counters are the scoreboard.
