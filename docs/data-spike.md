# Sectors data spike (2026-09-27)

Probed with `pnpm sectors:probe BBRI`, then ran end to end with `pnpm --filter @counterpoint/api live-check`. Raw payloads are saved under `docs/data-spike/<TICKER>/`, which git ignores because it is paid API data.

## Findings

| Area | Result |
| --- | --- |
| API version | **v1 was discontinued on 2026-05-11** (HTTP 410 on every `/v1/*` path). The base URL is now `https://api.sectors.app/v2`. Auth is unchanged: `Authorization: <key>`. |
| `GET /company/report/{ticker}/?sections=overview` | `overview.sector`, `overview.sub_sector` (e.g. `Banks`) |
| `...?sections=financials` | `financials.historical_financials[]` has `year`, `revenue`, `earnings` (annual). Also exposes `yoy_quarter_revenue_growth` and `yoy_quarter_earnings_growth`, which are **not used**: we compute growth ourselves from matched periods. |
| `...?sections=valuation` | No top-level P/E. `valuation.historical_valuation[]` holds one entry per `year` with `pe`, `pb`, `pe_peer_avg`, `pb_peer_avg`; the latest year is current, as of `valuation.latest_close_date`. The provider's `*_peer_avg` is not used, because its peer set can't be inspected. |
| `...?sections=dividend` | `historical_dividends` is keyed by year (`{"2025": {breakdown[], total_yield}}`), not an array. `yield_ttm`, `payout_ratio` and `total_yield` are **fractions** (0.1098 = 10.98%). |
| `GET /financials/quarterly/{ticker}/?n_quarters=8` | An array of 8 quarter-end rows with `date`, `revenue`, `earnings`. Banks also carry `financials_sector_metrics` (interest income, loans, deposits). |
| `GET /companies/` (screener) | `sub_sector` is no longer a query parameter. Use `where=sub_sector = 'Banks'`, `order_by=-market_cap`, `limit`. Name search uses `where=company_name like '%Mandiri%'`. Responses look like `{results: [{symbol, company_name}], pagination}`. Structured queries cost 1 credit. |

## Decisions

- **Peer universe**: the 10 largest companies by market cap in the target's subsector (`PEER_UNIVERSE_LIMIT`). The Banks subsector has 48 companies, so fetching all of them per claim would waste credits and latency. Peer policy filters still apply afterwards.
- **Current valuation**: the latest `historical_valuation` year, stamped with `latest_close_date`. Peers fetched the same day share that date, so the period match holds.
- **Search input** from thesis text is sanitized to `[A-Za-z0-9 .&-]` before it reaches a `where` clause.

## Live results (OpenAI planner, `gpt-4.1-mini`)

| Claim | Assessment | Path note |
| --- | --- | --- |
| BBRI absolute growth | PARTIALLY_SUPPORTED | Earnings +22.3% YoY supports it; FY2025 revenue −9.2% weakens it. No replan. |
| BBCA absolute growth | NOT_SUPPORTED | Earnings −0.1% YoY triggers a **REPLAN** to the margin check. Different path from BBRI. |
| BBRI dividend level | SUPPORTED | TTM yield 11.0% vs 5-year average 6.8%; paid 159 days ago |
| BBRI relative valuation | NOT_SUPPORTED | P/E 7.58x is 0.5% above the 9-bank peer median; P/BV is 10.8% above |

About 5 seconds per claim, and 17 uncached Sectors calls for all four claims.

## Open questions

- Bank "revenue" in Sectors includes non-interest and premium income. BBRI FY2025 annual revenue −9.2% versus quarterly +8.4% YoY needs a sanity check against the annual report before the demo.
- Thresholds are still provisional. The absolute-growth contract calls BBRI's 8.4% quarterly revenue growth "neutral" because it is below the 10% threshold.
- The fixture data in `packages/sectors/src/fixtures.ts` stays synthetic; tests don't depend on live data.

## Counterpoint data check (2026-10-01)

Probed with `pnpm sectors:probe BBRI BBCA TLKM ASII` (20/20 HTTP 200). Fields the v2 counter-hypotheses use:

| Field | BBRI | BBCA | TLKM | ASII |
| --- | --- | --- | --- | --- |
| `financials.historical_financial_ratio[].profitability.roe` (fraction), years | 2018–2025 | 2018–2025 | 2021–2025 | 2021–2025 |
| `overview.all_time_price["52_w_high"]` + `last_close_price` | 4050 / 3140 | 8750 / 6075 | 3990 / 2290 | 7475 / 4600 |
| `valuation.historical_valuation[].pe`, years | 2022–2026 | 2022–2026 | 2022–2026 | 2022–2026 |
| `dividend.historical_dividends` with `total_yield` + `breakdown` | 2023–2026 | 2023–2026 | 2023–2026 | 2023–2026 |

All present for all four, so no counter-hypothesis is dropped. The latest `historical_valuation` year is the current year (it equals the current P/E). **The current calendar year in `historical_dividends` is partial** (e.g. BBRI 2026: DPS 209 so far vs 345 in 2025), so year-over-year dividend comparisons use completed fiscal years only.

### BBRI revenue reconciliation

| Source | FY2025 revenue (IDR) | FY2025 net income (IDR) |
| --- | --- | --- |
| `report?sections=financials` annual | 181.30T | 56.65T |
| Sum of `financials/quarterly` Q1–Q4 2025 | 204.34T | 57.61T |

Annual and quarterly **revenue disagree by 11%** for the same fiscal year, while net income agrees within 1.7%. Sectors' bank "revenue" is therefore not reliable across endpoints, which explains the earlier −9.2% annual vs +8.4% quarterly contradiction. Decision: the v2 growth contract's historical-context check uses **annual net income growth**; quarterly revenue YoY (same endpoint for both quarters: Q2 2026 53.35T vs Q2 2025 49.20T, +8.4%) is kept as a same-source comparison.
