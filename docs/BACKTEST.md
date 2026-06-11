# PEAKTIME — Value-Call Backtest

*Generated 2026-06-11 · horizon 180d · grades Value Gap calls against fee/venue-tier movement (CLAUDE.md predictive-validation history). Outcomes graded against ground-truth tier MOVES, never the model's own re-score.*

## Verdict

**Not yet gradable — and that is the honest, correct state today.**

- Call-grading history (`value_call_history`) began **2026-06-09**.
- Oldest directional call is **2 day(s)** old; the horizon to grade a fee/room-tier move is **180 days**.
- **50** directional calls are accruing and will become gradable on a rolling basis. First results land ~**178 days** from now.

The framework is built and running. Fee/room tiers move slowly (a booking re-prices over months, not days), so grading now would measure noise. The backtest *proves itself* only with time — this script is the instrument; re-run it on a schedule.

## Leading-indicator read (NOT a backtest)

*A 12-day rank-movement sanity check while the real backtest matures. Avg rank Δ is positive when an act climbed (rank number fell). This is a directional smell test, not validation — too short a window, and rank movement is partly the model re-scoring itself.*

Window: 2026-05-30 → 2026-06-11 (7 snapshots)

| Signal | Acts | Avg rank Δ (↑ = climbed) |
|---|--:|--:|
| strong-buy | 11 | +15.2 |
| buy | 11 | +20.2 |
| premium | 28 | -14.5 |
| fair | 42 | -0.2 |

**Read it loosely:** if `strong-buy` acts climb and `premium` acts slip over time, the signal has directional life. Do not quote this as accuracy — quote the matured backtest above once it exists.

## How to use this

- Re-run weekly: `node backend/backtestValueCalls.js --leading --write`.
- The first real, quotable number ("of acts we flagged strong-buy N months ago, X% rose a fee or room tier") arrives once calls cross the 180-day horizon.
- That single number is what the talent-buyer persona said would move them more than any feature — it converts "looks plausible" into "proven."
