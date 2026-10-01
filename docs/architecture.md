# Architecture

## Flow

1. **Thesis session** (`POST /theses`) stores the raw thesis, then analyzes it in the background. A thesis can also come from a screenshot: `POST /theses/extract-text` transcribes it, and the user confirms the text before checking it.
2. **Claim extraction** (`apps/api/src/claims`) uses the configured LLM's structured output (deployed: OpenAI `gpt-4.1-mini`; Anthropic is also supported) to produce atomic typed claims with a direction (bullish or bearish). Thesis text is delimited as untrusted data. Each claim's quote is located in the thesis (`locateSpan`) so the UI can highlight it; paraphrases get no span rather than a guess. Without an LLM key, a labelled heuristic extractor is used.
3. **Entity resolution** (`apps/api/src/entity`) is deterministic ticker/alias lookup. Ambiguous mentions pause the session (`AWAITING_CONFIRMATION`); unknown mentions never trigger data calls.
4. **Contract mapping** assigns each supported claim a versioned evidence contract (`packages/domain/src/contracts-v2.ts`; v1 stays registered so older reports resolve). Forward-looking and unsupported claims get an explicit scope note and are never investigated.
5. **Investigation** (`apps/api/src/investigation/engine.ts`) runs one bounded loop per claim. A contract's checks come in three phases:
   - **Required** checks establish the claim.
   - **Counter** checks probe contradictions; some open only after a check weakens the claim, which triggers a `REPLAN`.
   - **Counterpoint** checks test the strongest opposing case ("is this growth a rebound from a weak prior year?"). They open only after every required check is resolved, at most three per claim, and only for bullish claims; a bearish claim's counter-case is its inverted checks.

   Each step:
   - **Planner** (LLM or deterministic) picks the next eligible check, says why, and **predicts the outcome**.
   - **Tool router** accepts only whitelisted tools that can serve that check and rejects duplicate signatures.
   - **Evidence builders** compute metrics deterministically from normalized Sectors records and store them as EvidenceItems with periods, provenance and `derivedFrom` links. Evidence is persisted per step.
   - **Evaluator** re-derives check states and records whether the planner's prediction held.
   - **Stop controller** stops on sufficiency, unobtainable evidence, the budget (8 tool calls, 2 replans, 1 transient retry, 3 counter-hypotheses), repeated invalid planner decisions, or the 90 s session deadline (`SESSION_DEADLINE_MS`), which returns a partial report.
6. **Assessment** is a deterministic rule over check states: SUPPORTED, PARTIALLY_SUPPORTED, NOT_SUPPORTED or UNVERIFIABLE, with evidence coverage (`n of m required checks available`). A confirmed counter-hypothesis counts as weakening evidence.
7. **Report** (`apps/api/src/reports`) turns check states into statements built from evidence values, lists counter-hypotheses as confirmed, refuted, untestable or not tested, and adds **what would change this verdict**: for each check not helping the claim, the contract threshold next to the current value (`packages/domain/src/falsifiers.ts`). An optional LLM interpretation is added; the validator then removes any statement whose numbers do not match cited evidence, or that contains advice or causal language.

## Live events

`GET /theses/:id/events` is a Server-Sent Events stream. On connect it replays the session from Postgres (claims, every trace step with its evidence, assessments, report, status last), then tails live events from an in-process bus (`apps/api/src/events`). Live events that arrive during the replay are buffered and deduplicated by id, so a reload or reconnect rebuilds the same screen. Event types: `session.status`, `claims.extracted`, `trace.step` (one per trace row: phase, hypothesis, prediction, whether it held, outcome, evidence), `claim.assessed`, `report.ready`.

## Contrasting paths (live Sectors data, 2026-10-01)

Committed traces: `evals/traces/`.

| Claim | Path | Result |
| --- | --- | --- |
| TLKM "growth kuat" | quarterly → quarterly → annual → counter-case: base effect (confirmed), earnings outpacing revenue (confirmed), ROE trend (confirmed) | PARTIALLY_SUPPORTED |
| TLKM "dividennya tinggi" | dividends ×4 → counter-case: yield from price (refuted), payout stretch (confirmed, 126.6%) | PARTIALLY_SUPPORTED |
| BBRI "valuasinya murah dibanding bank besar lain" | valuation → peer set (9 banks) → peer baseline → P/BV cross-check (weakens) → counter-case ×3 (all refuted) | NOT_SUPPORTED |
| BBRI "harga akan naik ke 6000" | no tools | UNVERIFIABLE (out of scope) |

## Data notes

- Sectors API v2; field mapping and probes in `docs/data-spike.md`.
- Bank "revenue" differs between the annual and quarterly endpoints, so the growth contract's historical context uses annual net income.
- The current calendar year in dividend history is partial; dividend comparisons and averages use completed fiscal years.
- Thresholds and their reasoning: `docs/thresholds.md`. Change one only by adding a new contract version.
