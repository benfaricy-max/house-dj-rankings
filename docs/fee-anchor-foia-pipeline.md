# Fee-anchor pipeline: public-records (FOIA/CORA) → fee_anchors.json

The Value Gap rests on model-implied fee tiers (confidence capped Medium). To uncap it we need
**real, dated, sourced fees** — and `backend/fee_anchors.json` forbids estimates/guesses. A web scan
can't supply these (per-gig fees are private; public results are self-labelled estimates). Public
records can: when a publicly-owned venue or public university books an act, the performance
agreement — including the guarantee — is a public record.

This is the highest-fidelity *public* source. Each result is a real contracted number with a date and
a citation, which is exactly `source: "contract"` (or `"press"` if a journalist published it first).

## Why Red Rocks is the anchor source

- **Red Rocks Amphitheatre is owned by the City & County of Denver** (operated by Denver Arts &
  Venues). Artist performance agreements / settlements are government records.
- **Denver Arts & Venues runs a public CORA portal:** https://www.artsandvenuesdenver.com/home/contact-us/cora-requests
- Colorado courts have held that a public entity's records are public **even when held by a third
  party** (the promoter), so a guarantee in a Live Nation/AEG settlement is still reachable.
- Electronic acts headline Red Rocks constantly, and a large share are on our roster.

Secondary public sources (same legal logic, other jurisdictions):
- **Public universities** booking spring-concert / EDM acts → state public-records act (each state).
- **Municipally-funded festivals** and **state fairs** on public land → state/city records act.
- **Other publicly-owned amphitheaters** (verify ownership first — many are privately operated).

## Target list — roster acts confirmed/likely at Red Rocks

16 roster acts that tour the US at the scale that lands a publicly-owned venue. Confidence = likelihood
they have a CORA-reachable Red Rocks (or other public-venue) booking. **Step 1 for each is always:
confirm the exact show date** from the venue's past-events archive (redrocksonline.com) before filing —
the request must name the date.

| Act | Confidence | Notes |
|---|---|---|
| John Summit | **Confirmed** | Sold-out Red Rocks; Civic Center Park (Denver, public) 2024; Red Rocks 2026 |
| Disco Lines | **Confirmed** | Red Rocks headline (Westword, Boulder local) |
| FISHER | High | Perennial US arena/amphitheater headliner |
| Chris Lake | High | Black Book label shows tour Red Rocks-tier venues |
| Gorgon City | High | Regular Red Rocks / US amphitheater act |
| Dom Dolla | High | Red Rocks headliner |
| SIDEPIECE | Medium | Often supports/co-headlines US amphitheater bills |
| Mau P | Medium | Rapid US touring ascent |
| ANOTR | Medium | Heavy US festival/club run |
| Cloonee | Medium | US amphitheater/club headliner |
| Chris Lorenzo | Medium | US touring |
| Disclosure | Medium | Plays larger US venues (some publicly owned) |
| Hot Since 82 | Medium | US touring |
| Prospa | Lower | Verify US public-venue dates |
| KETTAMA | Lower | Verify US public-venue dates |
| Peggy Gou | Lower | Mostly private/festival; check public-venue US dates |

Track each in `docs/fee-anchor-tracker.csv`.

## Workflow per act

1. **Find the event.** redrocksonline.com past events (or the public university / city festival).
   Record exact venue + date.
2. **File the request.** Denver Arts & Venues CORA portal for Red Rocks; the relevant state records
   office for a university/municipal show. Use the template below.
3. **Log it** in the tracker (status `requested`, with the date filed).
4. **On response:** record the guarantee. If a range/settlement, take the guarantee (not the
   bonus/overage unless you want effective-fee). Convert USD→GBP at the show-date rate.
5. **Add the anchor** to `backend/fee_anchors.json` (schema below), then run
   `node backend/computeFees.js` → `enrichValueGap.js`. The fee shows as "✓ verified fee".

## CORA request template (Red Rocks / Denver Arts & Venues)

> Subject: CORA request — artist performance agreement, [ARTIST], [DATE] at Red Rocks
>
> Under the Colorado Open Records Act (C.R.S. § 24-72-201 et seq.), I request a copy of the artist
> performance agreement, contract, rider financial page, and event settlement for the performance by
> **[ARTIST]** at Red Rocks Amphitheatre on **[DATE]**, specifically any document stating the artist
> guarantee, fixed fee, or compensation. If any portion is withheld, please cite the specific statutory
> exemption and release all reasonably segregable non-exempt portions (including the guarantee figure).
> I request electronic copies. Please advise of any fees before incurring them.

## Public-university / municipal template (generic)

> Under [STATE]'s public records act, I request the performance/entertainment contract and any
> settlement for **[ARTIST]** at **[EVENT/VENUE]** on **[DATE]**, including the page stating the
> artist guarantee or fee. Electronic copies preferred; please advise of fees before incurring them.

## fee_anchors.json entry (target shape)

```json
{
  "name": "John Summit",
  "fee_gbp": 0,
  "source": "contract",
  "source_url": "https://www.artsandvenuesdenver.com/... (CORA response)",
  "date": "YYYY-MM-DD",
  "region": "US-amphitheater",
  "note": "Red Rocks guarantee via Denver Arts & Venues CORA; USD→GBP at show-date rate"
}
```

## Honest caveats

- **Geo/venue skew.** Red Rocks is a US amphitheater — fees there run higher than an EU club night.
  Use the `region` field so calibration can account for it; don't treat a Red Rocks guarantee as a
  global flat fee.
- **Band ceiling.** Documented top-tier fees (e.g. Black Coffee ~£340K press-reported) exceed Band A
  (£70–150K). If anchors confirm this, add a band above A rather than capping.
- **Yield is slow, not instant.** CORA responses take days–weeks. 8–12 verified anchors from this
  pass is a realistic, model-changing result — enough to validate the tier mapping at the top half of
  the roster. Combine with the built-in "Send it" promoter mailto for the long-tail mid-roster.
