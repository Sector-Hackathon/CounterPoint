# Generic-LLM baseline

PRD §21.1: the same thesis and the same Sectors data bundle (quarterly and annual financials, dividends, valuation for the named ticker) given to a plain prompt ("You are a helpful assistant… Is this stock thesis right?"). Produced with `pnpm --filter @counterpoint/api baseline "<thesis>" <TICKER> <name>`. Qualitative comparison only.

## Measured results (2026-10-01, `openai/gpt-4.1-mini`, live Sectors data)

| Case | Numbers in answer | Not in data bundle | Advice/causal language flagged |
| --- | --- | --- | --- |
| `bbri-example` | 3 | 1 (`6000`, quoted from the thesis) | 1 (causal "karena") |
| `tlkm-example` | 4 | 1 (`9.75`, a rounding of 9.7466%) | 0 |

The plain model mostly quotes numbers correctly from the data it is given. The differences are in what it concludes:

- **It confirms comparisons it has no data for.** `bbri-example` calls the thesis "tepat" (correct), including "valuasi yang murah dibandingkan dengan bank besar lain", but the bundle contains no peer data. Counterpoint freezes a 9-bank peer set and reports P/E 0.9% below the peer median and P/BV 15.2% above it: not supported.
- **It smooths over contradicting evidence.** The same answer calls growth "cukup stabil" while FY2025 net income fell 5.8%. Counterpoint reports that decline as counterevidence and states the threshold that would change the verdict.
- **It frames conclusions as investment appeal** ("menarik bagi investor yang mencari pendapatan"). Counterpoint's validator removes advice wording, and forward-looking claims such as "harga akan naik ke 6000" are marked as not checkable.
- **No traceability.** Its numbers carry no period or source; every number in a Counterpoint report links to an evidence item with its period and Sectors locator.

Raw answers are in `bbri-example.json` and `tlkm-example.json`.
