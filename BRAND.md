# The DJ Rankings — Brand System

> The demand index for electronic music. Before the industry catches on.

This is the single source of truth for how the product looks, sounds, and shows up —
on the site, in the deck, and on social. If a design decision isn't here, it should
default to "editorial data-terminal": restrained, numeric, confident, never decorative.

---

## 1. Name

- **Operating name:** **The DJ Rankings** — kept deliberately. It owns the literal
  search intent, matches the domain (thedjrankings.com), and says exactly what it is.
  We don't rename a product that already ranks for its own category.
- **Short form / handle:** **The Index** (internal/voice shorthand — "according to the
  Index…"). Use in copy, not as a logo.
- **Social handle:** `@thedjrankings` (primary). Fallbacks if taken:
  `@thedjrankings_`, `@djrankings`, `@theindex.fm`.

### Coined-name alternatives (optional rebrand candidates)
Offered for consideration only — none replace the operating name unless you choose to.
Each is a short, ownable mark that still signals *measurement of demand*:

| Name | Read | Why it could work | Risk |
|------|------|-------------------|------|
| **PEAKTIME** | the slot every DJ wants | nightlife-native, means "the best DJs" | less literal |
| **The Index** | a measured ranking | clean, authoritative, extensible beyond house | generic alone |
| **Cued** | "cued up next" | momentum/discovery angle, app-y | abstract |
| **Headliner Index** | who headlines next | booker-facing, premium | long |
| **Risers** | who's rising | breakout-discovery brand | narrow |

**Recommendation:** keep **The DJ Rankings** as the product/domain; adopt **"The Index"**
as the spoken shorthand and **PEAKTIME** only if you ever spin out a separate editorial/social brand.

---

## 2. Point of view

We exist because booking and discovery in electronic music still runs on **gut, hype,
and who-you-know**. We replace that with a transparent, multi-signal index.

Three beliefs:
1. **Demand is measurable.** Streams, charts, search, tour density, social velocity —
   combined and weighted — predict who fills rooms before agents and press agree.
2. **Reach ≠ credibility.** A DJ can be huge on Spotify and invisible on Beatport, or
   the reverse. We show both axes so you can tell a festival headliner from a DJ's DJ.
3. **The interesting signal is movement, not position.** #1 is a lagging indicator.
   Who's *accelerating* is the alpha. We surface velocity and breakouts first.

**One line:** *The demand index for electronic music — before the industry catches on.*

**For whom:** bookers/promoters (who to book, what to pay), artists/managers (where you
really stand), and the scene-curious (a credible map of the culture).

---

## 3. Voice

Write like a Bloomberg terminal that goes to warehouse parties. Authoritative about the
data, fluent in the culture, allergic to hype.

- **Numeric and specific.** "Up 41% in 90 days" beats "blowing up right now."
- **Declarative.** State the read, then the evidence. No hedging, no exclamation marks.
- **Culture-literate, not try-hard.** We know the difference between tech house and
  melodic techno; we don't perform it with slang or emoji.
- **Never breathless.** We don't "stan." We observe, measure, and call it.
- **Transparent.** Always willing to show the formula. The method *is* the brand.

**Do:** "Reach without the credibility to match — yet."
**Don't:** "🔥 This DJ is ABOUT TO BLOW UP 🚀🚀"

---

## 4. Logo

**Logomark:** four ascending bars — an EQ band and a ranking ladder at once. Reads as
sound, as a bar chart, and as momentum. Lives in `frontend/public/favicon.svg`.

- Bars in **acid lime (#C8F750)** on a **near-black (#0c0c0e)** rounded square.
- Never recolor the bars to a gradient or photo fill. Lime-on-dark, or single-color
  knockout (all dark on lime, all off-white on dark) only.
- **Lockup:** mark + wordmark `THE DJ RANKINGS` set in IBM Plex Mono, 600 weight,
  0.22em tracking, uppercase. Mark always left of the wordmark.
- **Clear space:** at least the height of one short bar on all sides.
- **Min size:** 16px mark (favicon). Below ~20px, drop the wordmark and use the mark alone.

**Don't:** add a turntable/headphone/vinyl cliché, rotate it, add drop shadows or glows,
or place it on a busy photo without the dark chip behind it.

---

## 5. Color & type

| Token | Value | Use |
|-------|-------|-----|
| `--bg` | `#0c0c0e` | near-black warm background |
| `--card` | `#111114` | panels |
| `--text-h` | `#E9E7DF` | off-white headings/numbers |
| `--text` | `#a9a8a2` | body |
| `--muted` | `#75767d` | captions |
| `--border` | `#1e1f23` | hairlines |
| `--accent` | `#C8F750` | acid lime — used sparingly, for emphasis & data |
| `--on-accent` | `#0c0c0e` | dark text ON lime fills (never white on lime) |

- **Display / UI:** Space Grotesk (400/500/700).
- **Data / numbers / labels:** IBM Plex Mono (400/500/600). All ranks, scores, deltas,
  and eyebrow labels are mono. Numbers being monospaced is a brand signature.
- No gradient text. No emoji in product or logo. Accent is a scalpel, not a highlighter.

---

## 6. Social kit (@thedjrankings)

- **Avatar:** the logomark on the dark chip (1080×1080 master at
  `frontend/public/brand/avatar-1080.png`). On platforms that crop circular, the
  rounded square still reads cleanly.
- **Bio:** `The demand index for electronic music. Multi-signal rankings of house &
  techno DJs — streams, charts, tours, search. Before the industry catches on. ↓`
- **Color/type:** same tokens. Every post is dark-bg, lime accent, mono numbers.

### Content pillars
1. **Weekly Movers** — biggest rank climbers/fallers, with the % and the why.
2. **Breakout of the Week** — one accelerating artist, the signal that flagged them.
3. **Reach vs. Credibility** — the two-axis chart; one artist plotted, what it means.
4. **City Spotlight** — where demand is concentrating right now.
5. **Methodology drops** — "here's exactly how the score works" (trust-building).

### Post template
- **Format:** 1080×1080 (feed) / 1080×1920 (story). Dark bg, hairline border,
  mark top-left, mono eyebrow label, one big number or one chart, one-line read.
- **Caption voice:** lead with the number, then the read, then the method in one line.
  Example: *"Sara Landry: +38% demand in 90 days. Techno search is outpacing her
  streams 3:1 — the rooms know before the algorithm does. #methodology in bio."*
- **Cadence:** Movers (Mon), Breakout (Wed), Reach-vs-Cred or City (Fri).
- **Hashtags:** sparing — `#housemusic #techno #djs #beatport` plus the artist's name.

### Watch-outs
- Never post a take without a number behind it.
- Never use stock "DJ silhouette in front of crowd" imagery — charts are the imagery.
- Always be willing to link the methodology. The transparency is the moat.
