# PEAKTIME — Homepage Repositioning (buyer lane)

> **The finding.** Every professional persona in the June 2026 research panel said
> the same thing: the homepage *"sells the magazine, not the tool."* The H1 — *"The
> demand index for underground electronic music"* — tells a reader who's hot. A
> buyer's actual job is **"who's underpriced for my city and my budget, right now,
> and what should I offer?"** That job is currently buried inside artist cards and
> the Value Gap tab. The front door needs a buyer lane.

This is **additive, not a rewrite** — it keeps the ranking as the free funnel
(neutrality moat intact, STRATEGY.md §3) and adds a buyer entry point above it.

---

## What ships

A `<BuyerLane />` band rendered just under the hero headline:

- **Headline that names the job:** *"Who's underpriced right now"* + *"The neutral
  read for the offer you're about to make."*
- **Two filters a buyer thinks in:** region (derived from where acts are actually
  booked — RA top cities/countries) and budget band (Under £10k / £10–40k / £40k+,
  mapped to `booking_fee.tier`).
- **Up to 6 strong-buy / underpriced reads** matching the filter, each showing
  `fee band → demand-implied (+gap%)`, clicking through to the existing Value Gap
  report (`#/value/<slug>`) — the pitch artifact (GTM.md §3).
- **Honest footer:** "Estimated fee bands until verified — the demand side is RA
  bookings, Beatport, search & streaming." (Keeps the fee-honesty posture.)

Files (already created, additive, zero collision risk):
- `frontend/src/BuyerLane.jsx`
- `frontend/src/BuyerLane.css`

Both validated: compiles under the project's esbuild/JSX toolchain; reads only
fields already present in `rankings.json` (`value_signal`, `value_gap_pct`,
`demand_fee_label`, `booking_fee`, `ra_top_regions`/`ra_country_list`). Defensive
about missing fields (92 acts carry value-gap data, 307 carry region data today).

---

## Wiring (one import + one line)

Left intentionally un-wired so it doesn't collide with concurrent edits to
`App.jsx`. To turn it on, in `frontend/src/App.jsx`:

```jsx
// top with the other imports
import BuyerLane from "./BuyerLane";
```

Then render it once, immediately under the hero `<h1 className="header-title">`
(around line 2657, the "The demand index for underground electronic music" block),
passing the already-loaded ranked list:

```jsx
<h1 className="header-title">The demand index for underground electronic music</h1>
{/* NEW: buyer entry point */}
<BuyerLane rankings={rankings} />
```

It self-navigates to `#/value/<slug>` on click. To route through App's own handler
instead, pass `onOpenValue={(slug) => { window.location.hash = `#/value/${slug}`; }}`.

---

## Why this is the right altitude

- **Doesn't paywall anything** — the lane is free, like the ranking. Charging for
  the read damages the neutrality moat; charging for the *depth* (Pitch Links, Team
  intel) is the model that's already built. This respects that line.
- **Routes to the wedge** — every click lands on a Value Gap report, the artifact
  GTM.md sends as the pitch. The homepage becomes a funnel into the thing that sells.
- **Speaks buyer, keeps fan** — the ranking stays the hero for fans (who are the
  share/virality engine, not the wallet — fan persona); the buyer lane sits above it
  for the people who actually pay.

---

## Measure it

When the paywall/funnel is live, the lane should lift the north-star activation
event (`pitch_opened`, GTM.md). Track click-through from `BuyerLane` rows to
`#/value/*` as the leading homepage metric — it's the "did the buyer find the tool"
signal the personas said was missing.

---

## Follow-on (not in this drop)

- A real **usability pass on the rendered site** — this spec is grounded in the
  data and code, but the panel's UX feedback was partly inferred (the live site is
  a JS SPA that static fetch can't see). Worth driving the actual rendered page.
- A **city landing page** per high-volume region (`#/market/<city>` already exists
  for some flows) — the buyer lane is the seed of a programmatic-SEO surface.
