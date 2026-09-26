# Architecture

## Flow

1. **Thesis session** (`POST /theses`) stores the raw thesis, then analyzes it in the background.
2. **Claim extraction** (`apps/api/src/claims`) uses Claude structured outputs to produce atomic typed claims. Thesis text is delimited as untrusted data. Without an LLM key, a labelled heuristic extractor is used.
3. **Entity resolution** (`apps/api/src/entity`) is deterministic ticker/alias lookup. Ambiguous mentions pause the session (`AWAITING_CONFIRMATION`); unknown mentions never trigger data calls.
4. **Contract mapping** assigns each supported claim a versioned evidence contract (`packages/domain/src/contracts.ts`). Forward-looking, unsupported, and not-yet-supported claim types get an explicit scope note and are never investigated.
5. **Investigation** (`apps/api/src/investigation/engine.ts`) runs one bounded loop per claim:
   - **Planner** (Claude or deterministic) picks the next eligible check and says why.
   - **Tool router** accepts only whitelisted tools that can serve that check and rejects duplicate signatures.
   - **Evidence builders** compute metrics deterministically from normalized Sectors records and store them as EvidenceItems with periods, provenance, and `derivedFrom` links.
   - **Evaluator** re-derives check states. When a check weakens the claim, triggered counterchecks open and a `REPLAN` event is recorded. This is the evidence-dependent branch.
   - **Stop controller** stops on sufficiency, unobtainable evidence, the budget (6 tool calls, 2 replans, 1 transient retry), or repeated invalid planner decisions.
6. **Assessment** is a deterministic rule over check states: SUPPORTED, PARTIALLY_SUPPORTED, NOT_SUPPORTED, or UNVERIFIABLE, with evidence coverage (`n of m required checks available`).
7. **Report** (`apps/api/src/reports`) turns check states into statements built from evidence values. An optional Claude interpretation is added, and the validator then removes any statement whose numbers do not match cited evidence, or that contains advice or causal language.

## Contrasting paths (fixture)

| Claim | Path |
| --- | --- |
| BBRI strong growth | revenue → earnings (weakens; divergence weakens) → **REPLAN** → annual → deceleration → margin (weakens) → PARTIALLY_SUPPORTED |
| BBCA strong growth | revenue → earnings → annual → deceleration → SUPPORTED |
| BBRI "harga akan naik ke 6000" | no tools → UNVERIFIABLE (out of scope) |

## Open items from the data spike (PRD section 26)

- **Sectors endpoints and field names** in `packages/sectors/src/adapters.ts` are unverified. Run `pnpm sectors:probe <TICKER>`, inspect `docs/data-spike/`, and adjust the adapters only.
- **`RATIO_FIELDS_ARE_FRACTIONS`**: confirm whether yields and payout ratios are fractions or percent.
- **Thresholds** (`strongGrowthPct`, `highYieldPct`, `cheapDiscountPct`, `minPeers`, ...) are provisional. To change one, bump the contract id (e.g. `absolute-growth-v2`) so past reports stay reproducible.
- **Bank accounting**: "revenue" semantics for banks need confirming against Sectors fields.
- **Latency**: NFR-005 targets 60s end to end with a 90s hard timeout. Measure with live Sectors and Claude before the demo; the hard timeout is not implemented yet.
