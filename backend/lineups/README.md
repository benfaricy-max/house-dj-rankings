# Lineup Intelligence configs

Drop a festival lineup here as JSON and run:

```bash
node backend/makeLineupReport.js backend/lineups/<slug>.json
```

It writes `frontend/public/reports/<slug>/index.html` — the same branded report as
the III Points / CRSSD ones, but the picks (smartest buy, value mid-card, priced-ahead,
breakout, saturation, conversion standouts) are **auto-derived from live data** instead
of hand-written. A new festival is a config, not a coding session.

To feature it on the site, add the slug to the Reports list in `frontend/src/App.jsx`
(same as the existing reports).

## Config schema

```jsonc
{
  "slug": "my-festival-2026",            // output dir under reports/
  "title": "My Festival 2026",           // shown in hero + <title>
  "eyebrow": "Lineup Intelligence · City · Date",
  "lead": "optional custom intro paragraph",
  "currency": "USD",                     // "USD" | "GBP"  (default USD)
  "region": {                            // optional — drives the saturation read
    "label": "Miami",
    "countries": ["United States", "United States of America"],
    "cities": ["Miami", "Florida"]
  },
  "lanes": [                             // first lane = the tracked electronic/dance lane
    { "id": 1, "label": "Electronic / dance", "color": "#C8F750" },
    { "id": 2, "label": "Live / indie / alt", "color": "#7fd4ff" },
    { "id": 3, "label": "Hip-hop / rap",      "color": "#ff8a5c" }
  ],
  "acts": [
    { "name": "KETTAMA", "fee": 40000, "lane": 1 },
    { "name": "Marco Carola b2b Franky Rizardo", "fee": 95000, "lane": 1,
      "members": ["Marco Carola", "Franky Rizardo"] },   // b2b: costed as one line, signals pulled from members
    { "name": "Four Tet", "fee": 90000, "lane": 1, "live": true }
  ],
  "editorial": {                         // optional — override any auto-derived prose
    "smartestBuy": "...", "valueMidcard": "...", "pricedAhead": "...",
    "breakout": "...", "closing": "the 'who drives ticket sales' summary paragraph"
  }
}
```

Acts the roster doesn't cover render as untracked by design (PEAKTIME is
house/techno/electronic). Fees are editorial estimates — the report says so in the
method note; never represent them as transacted.
