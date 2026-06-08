# PEAKTIME — Go-to-Market (Stage 0)

The job right now is not to build a sales machine. It's to close the first 10 deals
by hand and learn the pattern. Founder closes every one personally. Every call is
research. Don't deploy Stripe until this doc's tracker has real answers in it.

Companion docs: `COMMERCE.md` (pricing/billing skeleton), `BRAND.md` (voice).

---

## 1 · Pick the 5

Not the 5 biggest names you can reach — the 5 who feel the pain *this month*. A name
only qualifies when all four columns are filled:

| # | Booker / buyer | Artist they're deciding on | Trigger (hold / date, next 8 wks) | How you reach them | Status |
|---|----------------|----------------------------|-----------------------------------|--------------------|--------|
| 1 |                |                            |                                   |                    | not contacted |
| 2 |                |                            |                                   |                    | not contacted |
| 3 |                |                            |                                   |                    | not contacted |
| 4 |                |                            |                                   |                    | not contacted |
| 5 |                |                            |                                   |                    | not contacted |

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
