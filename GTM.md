# PEAKTIME — Go-to-Market (Stage 0)

The job right now is not to build a sales machine. It's to close the first 10 deals
by hand and learn the pattern. Founder closes every one personally. Every call is
research. Don't deploy Stripe until this doc's tracker has real answers in it.

Companion docs: `COMMERCE.md` (pricing/billing skeleton), `BRAND.md` (voice).

> **LEAD MOTION — DECIDED 2026-06-11 (founder). Do not re-flip without founder sign-off.**
> **Buy-side first.** Promoters / talent buyers are the beachhead — one person decides,
> feels "am I overpaying" as their own margin. The **offer case** is the default everywhere.
> **Selling (agent → promoter) is the EXPANSION loop**, available but not the lead.
> Surfaces aligned to this:
> - **Pitch Link** (`Pitch.jsx`): default `side = "buyer"`, "Buying (offer case)" toggle first. (done)
> - **Outreach** (`materials/outreach-pack.md`): all drafts are buy-side. (done)
> - **Homepage** (`App.jsx`): wire `BuyerLane` ("Who's underpriced right now") under the hero
>   on the rankings tab — it's the buy-side entry point, currently built but NOT wired
>   (in unpushed commit `e095931`). **Before wiring, fix `BuyerLane.jsx`'s local `slugify`:
>   it uses NFKD and mangles accented names (Sven Väth → `sven-va-th`), breaking the
>   `/value/<slug>` link. Import the canonical `slugify` from `./artistLink` instead, and
>   pass `onOpenValue={slug => window.location.href = '/value/'+slug}` for path routing.**

---

## 1 · Pick the 5

Not the 5 biggest names you can reach — the 5 who feel the pain *this month*. A name
only qualifies when all four columns are filled:

**Seeded from the index (2026-06-10).** The five below are the strongest *strong-buy*
reads (underpriced **and** surging) whose price band sits in the £5k–£50k one-person-decides
zone — so the Value Gap £-hook is biggest and the buyer is reachable. Fees are **curated
estimates** (`basis: "curated"`), so each call doubles as fee-anchor collection (§3 of
STRATEGY.md). **Before you send: fill the bolded buyer cell with a real person** — a name
you can reach who is actually weighing this act for a date. The artist + gap is done; the
person is the only missing column.

| # | Booker / buyer (← fill the name) | Artist (strong-buy read) | Trigger (next 8 wks) | How you reach them | Status |
|---|----------------|----------------------------|------------------|--------------------|--------|
| 1 | **[name]** — UK city-club promoter booking autumn/winter (WHP Manchester / fabric / Bristol-Leeds nights) | **Prospa** — est £18–40K, demand-implied **£35–70K (+79%)**, tier-5 demand, Ninja Tune / Boiler Room | Autumn UK club holds (Sep–Dec); recently London + Madrid | RA DM to the promoter, or warm intro via a scene mutual | not contacted |
| 2 | **[name]** — mid-size UK/EU tech-house night | **PAWSA** — est £8–18K, demand-implied **£18–40K (+133%)**, Solä (own label), Boiler Room | Ibiza season now + UK autumn; recently Ibiza, Miami, Düsseldorf | Cold email, subject = the number; or IG DM | not contacted |
| 3 | **[name]** — Irish / UK independent promoter | **KETTAMA** — est £8–18K, demand-implied **£18–40K (+133%)**, G-Town / Boiler Room / fabric | Belfast + UK dates this season | Warm intro (Galway/Belfast scene) or RA DM | not contacted |
| 4 | **[name]** — melodic-house promoter / festival stage buyer | **Yotto** — est £8–18K, demand-implied **£18–40K (+133%)**, Anjunadeep, festival headliner | Festival summer holds; recently Barcelona, Paris | Cold email with the Pitch Link | not contacted |
| 5 | **[name]** — festival / club booker (highest-gap hook) | **Jayda G** — est £8–18K, demand-implied **£35–70K (+317%)**, tier-5 demand, Hï Ibiza | Summer festival season; recently Ibiza, Lisbon | Cold email — the +317% gap is the subject line | not contacted |

> Backups if any of the above don't have a live decision: **ANOTR** (+79%, £18–40K→£35–70K),
> **Kerri Chandler** (+79%, tier-5), **Marco Faraone** / **Franky Rizardo** / **Lee Foss**
> (all +133%, £8–18K band). Pull a fresh list anytime: filter `rankings.json` for
> `value_signal === "strong-buy"` and sort by `value_gap_pct`.

**Filters:**
- A live booking decision in the next 8 weeks. No live decision = no urgency.
- Books in the £5k–£50k range — big enough to negotiate, small enough that one
  person decides. That person is your buyer and your champion in one.
- **Buy-side first** (promoters / talent buyers). They feel "am I overpaying" as
  their own margin. Agents come later, via Pitch Link (the expansion motion).
- You can name the exact artist they're weighing. If you can't, you can't run a
  real Value Gap report, and the pitch goes generic.

Status values: `not contacted → contacted → call booked → call done → design partner → closed / passed`.

---

## 2 · Outreach

One rule: **specific person, specific artist, specific number.** Run the Value Gap
report *before* you send — the £ gap is the hook, not the feature list.

### A — Warm intro ask (highest-converting; send to a mutual)
> Quick one — are you still close with [Name] at [Promoter/Venue]? I built a demand
> index for electronic music (thedjrankings.com) and ran a fair-fee read on
> [Artist], who I think they're weighing for [date/season]. It came back
> [strong-buy / premium]. I'd love 15 min to show them — no pitch. Happy to send the
> one-pager first so you can see it's legit.

### B — Cold email (subject line is the number)
> **Subject: [Artist] is reading as [underpriced / a premium booking]**
>
> [Name] —
>
> I run PEAKTIME, a neutral demand index for house & techno (thedjrankings.com). No
> agency, no act — just the data.
>
> I ran a fair-fee read on [Artist] ahead of [the season / a date I'd guess you're
> weighing]. Current fee band sits at [£X]; demand-implied is [£Y]. Verdict:
> **[strong-buy]** — [one line, e.g. "RA bookings and Beatport are running ahead of
> the fee; the rooms know before the rate-card moves."]
>
> Here's the private read — expires in 7 days, just for you: [Pitch Link]
>
> Worth 15 minutes? I want to know if it changes how you'd approach the offer — and
> what I'm missing.
>
> [Ben]

### C — DM (RA / Instagram, 3 lines max)
> Not selling anything — I built a neutral demand index for the scene and ran a
> fair-fee read on [Artist]. Came back [strong-buy]: fee band [£X] vs demand-implied
> [£Y]. Private one-pager → [Pitch Link]. Does that match how you're seeing them?

---

## 3 · The pitch artifact = the Value Gap report

You already built the best collateral you have. Use it as-is:

1. Open the artist's Value Gap report (`#/value/<slug>`).
2. Generate a **Pitch Link**, framed **"Buying (offer case)"**, 7-day expiry, with a
   one-line note: *"For the [event] hold — what I think this should cost."*
3. That link *is* the attachment. It carries verdict + confidence, the live anchor
   (venue tier, avg draw), local fee comps, and a ready-to-paste negotiation line.

Don't paraphrase the report in the email. Send the report. Let the number be the pitch.

---

## 4 · The 15-minute discovery call

Goal is not to sell. It's to learn three things. Ask, then shut up, then write down
the exact words.

**Open (15 sec):**
> "I'm not going to pitch you. I built this and I need to know if it's actually
> useful to someone who books for a living, or if I'm fooling myself. Three
> questions, then I'm out of your hair."

**Q1 — does the number change a real decision?** *(validates the whole product)*
> "You're looking at [Artist] for [date]. This read says [strong-buy at £Y vs £X].
> Does that change how you'd make the offer — or is it telling you something you
> already knew?"
>
> Listen for: a reaction to the £ gap. "Huh, I'd have offered more" = wedge works.
> "Already knew that" = the value isn't the number — find out what is.

**Q2 — who actually sets what you pay?** *(economic buyer + decision process)*
> "When you land on a fee for a headliner — is that your call, or does it go past
> someone?"
>
> Listen for: "I decide up to £X, above that it's [owner/festival director]." That's
> your buyer and your champion in one answer.

**Q3 — what would you pay, and per what?** *(pricing reality + packaging)*
> "If this saved you from overpaying on one booking a quarter — what's that worth?
> And would you think about it per booking, per month, or per seat for your team?"
>
> Listen for: the unit they answer in. Don't defend £75/£300 — collect their number.

**Close (never end open):**
> "Last thing — can I run this on the next three names you're weighing, and send them
> over this week?"
>
> A yes = a design partner forming. That's the only outcome that matters.

---

## 5 · Objections (pre-loaded)

- **"The fees are just estimates."** → "Correct — the fee band is a curated estimate.
  The *demand* side isn't: it's RA bookings, Beatport, streaming, search. The gap is
  the signal, and the method's public. I'd rather show you the math than ask you to
  trust it."
- **"I already know who's hot."** → "You do. This isn't for the names you know cold —
  it's for the one on the edge of the budget where you're guessing by ±£10k. Which
  booking this season felt like a coin-flip on price?"
- **"Who's behind this — an agency?"** → "Nobody. No act, no agency, no kickback.
  That's the whole point — it's the one read in the room that isn't selling you
  something." *(This is the moat. Lead with it when trust is the blocker.)*
- **"Send me something to look at."** → "Already did — the link in my email is the
  live read on [Artist], yours for 7 days. Tell me if it's wrong."

---

## 6 · Single next action

**Today:** fill the §1 table. **This week:** run a Value Gap + Pitch Link on each
booker's real decision, send via §2. **Goal:** 3 of 5 take a 15-min call. The output
of those calls — the objections, the £ they'd pay, who signs — is your pricing page
and your design-partner list. Don't touch Stripe until you have it.

---

## Funnel instrumentation (already wired)

Activation events land in `localStorage.peaktime_funnel` (inspect:
`JSON.parse(localStorage.peaktime_funnel)`):
- `upgrade_click` / `reached_stripe` — pricing-CTA intent (`UpgradeCTA.jsx`)
- `pitch_link_copied` — you copied a pitch link to send (`Pitch.jsx`)
- `pitch_opened` — a recipient opened one (the activation signal that matters)
