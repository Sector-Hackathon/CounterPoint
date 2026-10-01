# Contract thresholds (v2)

Source of truth: `packages/domain/src/contracts-v2.ts`. These numbers turn words like "strong", "high" and "cheap" into checks. They are fixed per contract version: to change one, add a new version so earlier reports stay reproducible.

## absolute-growth-v2: "growth kuat"

| Threshold | Value | Meaning | Why |
| --- | --- | --- | --- |
| `strongGrowthPct` | 10 | Growth is strong at ≥ 10% year on year; below 0% weakens the claim; in between is neutral | A common bar for "double-digit growth" in IDX commentary; roughly double nominal GDP growth |
| `decelerationPp` | 5 | Revenue growth falling more than 5 pp versus the prior quarter weakens the claim | Filters out normal quarter-to-quarter noise |
| `divergencePp` | 15 | Net income growth 15 pp below revenue growth weakens the claim; 15 pp above confirms the "profit outpacing revenue" counter-hypothesis | A gap large enough that margins, not volume, drive the result |
| `marginDeteriorationPp` | 2 | Net margin down 2 pp or more year on year weakens the claim | Material for banks and telcos, whose margins move slowly |
| `roeDeclinePp` | 2 | Latest ROE 2 pp or more below its prior three-year average confirms the "ROE falling" counter-hypothesis | Same scale as the margin threshold |

## dividend-level-v2: "dividen tinggi"

| Threshold | Value | Meaning | Why |
| --- | --- | --- | --- |
| `highYieldPct` | 5 | Trailing yield ≥ 5% supports "high"; below 2% weakens it | Above IDX large-cap averages and Indonesian deposit rates |
| `lowYieldPct` | 2 | See above | |
| `maxDividendAgeDays` | 450 | Last payment within about 15 months counts as current | Annual payers plus slack for a late AGM |
| `oneOffSpikePct` | 200 | Latest dividend at least double the prior median weakens the claim as a possible one-off | A special dividend usually shows as a step change |
| `stretchPayoutPct` | 90 | Payout ratio ≥ 90% confirms the "paying out almost everything" counter-hypothesis | Leaves little buffer if earnings dip |
| `yieldJumpPct` | 20 | Yield up ≥ 20% while dividend per share grew less than half as much confirms "yield rose because the price fell" | Separates price-driven yield from payout growth |

## relative-valuation-v2: "murah dibanding …"

| Threshold | Value | Meaning | Why |
| --- | --- | --- | --- |
| `minPeers` | 4 | At least 4 valid peers in the frozen set, or the comparison is unavailable | A median of fewer companies is not a baseline |
| `cheapDiscountPct` | 10 | P/E at least 10% below the peer median supports "cheap"; above the median weakens it | A discount larger than typical dispersion within a subsector |
| `roeGapPp` | 3 | ROE 3 pp or more below the peer median confirms "cheap because returns are lower" | Lower returns justify a lower multiple |
| `drawdownPct` | 25 | Last close 25% or more below the past-year high confirms "cheap because the price fell" | A bear-market-sized fall |
