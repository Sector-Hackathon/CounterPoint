# Counterpoint: final-week design (1–8 Oct 2026)

Status: draft for review. Supersedes PRD v1.0 where they conflict. Solo builder, 7 days, submit 8 Oct 23:59 WIB.

## 1. Why the current product is not yet a winner

Judging: usability 40%, video 30%, technical depth 30%. Track bar: "multi-step reasoning, routing between data sources, autonomous task execution, purpose-built interfaces".

| Gap | Effect on score |
|---|---|
| Counterchecks are a fixed list per contract; the planner mostly picks the order | Judges can read it as a checklist with an LLM in front (technical depth) |
| Only 2 Sectors endpoints used (`/company/report`, `/financials/quarterly`) plus the screener | Weak "innovation in API usage" (technical depth) |
| Report says *what* the verdict is, not *what would change it* | Users get a label, not a next step (usability) |
| Investigation screen is tags plus a raw `<ol>` trace, polled every second | The agent never looks like it is thinking (video, usability) |
| UI is the default generated kit: slate + indigo, gradient headline text, sparkles eyebrow, 4-up card grids, pricing, mock sign-in | Reads as AI slop; preview pages break the PRD CUT list (all three criteria) |

## 2. Product thesis for the final week

**Counterpoint argues back.** Every thesis gets an opposing case built by the agent and tested against Sectors data, shown live as the agent reasons, and ends with the exact conditions that would flip each verdict.

Three features carry that sentence. Everything else is fixes or cut.

### F1. The Counterpoint engine (headline feature)

After a claim's required checks complete, an **adversary step** builds the strongest opposing case and tests it.

- **Hypothesis catalog (code-defined, versioned).** Each claim type has 3–5 counter-hypotheses, each with a deterministic test and the tools it needs. The LLM *chooses and orders* hypotheses given the evidence so far and writes why; it cannot invent tests or thresholds (PRD §9 holds).
- **Symmetric.** For a bullish claim the counterpoint is bearish; for a bearish claim it is bullish. This is what makes it a fact-checker and not a cynic.
- **Untestable hypotheses are listed, not dropped**: "Open question: is the growth concentrated in one segment? Sectors does not expose segment data."

Initial catalog (verify field availability on Day 0 before committing to each):

| Claim type | Counter-hypothesis | Test | New data |
|---|---|---|---|
| ABSOLUTE_GROWTH | Base effect: prior-year quarter was unusually weak | Prior-year YoY vs 8-quarter median | none |
| ABSOLUTE_GROWTH | Earnings growth outpaced revenue (non-operating or one-off) | Existing divergence + margin checks, promoted to hypotheses | none |
| ABSOLUTE_GROWTH | Growth is decelerating over 4 quarters, not just 1 | Slope of trailing 4 YoY values | none |
| DIVIDEND_LEVEL | Yield is high because the price fell, not because the dividend rose | 12-month price change from `/daily/{ticker}` vs DPS change | **daily price** |
| DIVIDEND_LEVEL | Payout is above earnings coverage | Existing payout check | none |
| RELATIVE_VALUATION | Cheap because profitability is lower than peers | ROE vs frozen peer median (from `valuation`/`financials` if present) | **ROE field** |
| RELATIVE_VALUATION | Discount is normal for this stock (historical P/E band) | Current P/E vs own 5-year `historical_valuation` median | none |
| RELATIVE_VALUATION | Insider/major holders reducing stake | `ownership` section change | **ownership** |

Output per claim: `counterpoint: { stance, hypotheses: [{ id, rationale, status: confirmed|refuted|untestable, evidenceIds }] }`. Confirmed hypotheses feed the deterministic `assess()` as `weakens` (or `supports` for a bearish claim's counterpoint). The assessment rule is unchanged.

### F2. "What would change this verdict" (cheap, high usability)

Deterministic, from contract thresholds and current values. For each check that is not at its supporting state:

> Revenue growth would count as strong at ≥ 10% YoY. Latest quarter (Q2 2026): 8.4%.

No LLM. Computed in `packages/domain`. This answers the user's real next question ("so what do I watch?") without predicting anything, so it stays inside the advice boundary.

### F3. Live reasoning stream ("an agent that actually thinks")

Replace polling with **Server-Sent Events**. The planner now emits a *prediction* before each tool call, and the deterministic evaluator emits whether the prediction held. That loop (predict → observe → update) is real, inspectable reasoning. It is not a typing animation over canned text.

Event types (`GET /theses/:id/events`, `text/event-stream`):

```
session.status   { status }
claims.extracted { claims[] with source spans in the thesis text }
plan.step        { claimId, checkOrHypothesisId, reason, expectation }
tool.started     { claimId, tool, params }
tool.finished    { claimId, tool, ms, evidenceIds, status }
evidence.added   { claimId, metric, value, unit, period }
check.evaluated  { claimId, checkId, outcome, expectationHeld: boolean }
replan           { claimId, trigger, newDirection }
counter.result   { claimId, hypothesisId, status }
claim.assessed   { claimId, assessment, coverage }
report.ready     { reportId }
```

Every event is also persisted to `ExecutionTrace`, so a finished session replays the identical stream (good for the video and for judges re-opening a link). Polling stays as fallback.

**Rule:** the UI may only render what an event says. No fake steps, no simulated delays on live runs. Replay mode may pace events but is labelled "Replay".

### F4. Screenshot input (P1, cut first)

Theses circulate as screenshots of Stockbit/X/Telegram posts. Accept an image, extract text with the vision-capable model, **show the extracted text for the user to confirm**, then proceed as a pasted thesis. Extracted text is untrusted data (PRD §20.2).

## 3. Fixes carried over from the PRD review

1. BBRI annual revenue −9.2% vs quarterly +8.4%: reconcile against the annual report; if Sectors bank "revenue" is not comparable, the historical-context check uses earnings or is marked incomparable. Demo depends on this.
2. Finalize thresholds as `*-v2` contracts; keep v1 for reproducibility.
3. 90s hard session timeout (NFR-005) → partial report with `BUDGET_EXHAUSTED`/`TIMEOUT`.
4. Delete login, workspaces, integrations, plan/pricing pages and the "Sign in" chrome (PRD CUT list). Landing CTA goes straight to the input.
5. Commit traces of the demo runs under `evals/traces/` (PRD §23).
6. Generic-LLM baseline: same thesis + same data bundle to a plain prompt; show where it invents numbers or gives advice (`evals/baseline/`).
7. Update `architecture.md`/README: OpenAI is the deployed provider; document the new events and Counterpoint engine. Commit the PRD with a v1.1 changelog pointing to this spec.

**Cut entirely:** Telegram bot, multi-company theses, saved history, pricing, auth, new claim types beyond what F1 needs. RELATIVE_GROWTH only if Day 2 finishes early.

## 4. UI/UX direction

Follow `frontend-design` (claude-plugins-official). Its list of generated-design tells applies directly: we currently ship tells 4 and 5 (SaaS-card kit, eyebrow chrome) plus gradient-accented headline words.

### 4.1 Concept: two voices

"Counterpoint" in music is two independent melodic lines that move against each other and resolve together. The product does exactly that: the user's thesis is one voice, the agent's counter-case is the other, the verdict is where they resolve. **This metaphor drives layout and motion; it is never literal (no staves, no notes).**

- Investigation and report are laid out as **two lanes**: *Thesis* (left) and *Counterpoint* (right), with evidence landing between them.
- Uncertainty is first-class: UNVERIFIABLE and missing evidence render as a **diagonal hatch** texture, not just grey. Status is never color alone (NFR-008).

### 4.2 Tokens (proposal; review before building)

Light-first (financial reading, daytime use, distinct from the sea of dark AI dashboards); dark theme derived after.

| Token | Hex | Role |
|---|---|---|
| `--paper` | `#EDEFF1` | Background, cool grey (deliberately not cream) |
| `--ink` | `#16191F` | Text, rules |
| `--thesis` | `#1F3FBF` | The user's voice, supporting evidence |
| `--counter` | `#B86A12` | The agent's counter-voice, weakening evidence |
| `--resolve` | `#5B3A99` | Not supported (violet, not red: no sell signal) |
| `--quiet` | `#7A818C` | Secondary text, hatch strokes |

Type: **Schibsted Grotesk** for headlines (news-agency grotesque: fact-checking vernacular), **IBM Plex Sans** for body and all numbers with `font-variant-numeric: tabular-nums`. Sentence case everywhere; no all-caps labels, no mono labels, no eyebrows, no `→` in buttons.

Radii by hierarchy (sheet 14px, evidence chip 6px, inline tag 3px), not one radius on everything. No drop-shadow-on-every-card; elevation only for the evidence drawer.

### 4.3 Motion: one signature moment per screen

Library: `motion` (`motion/react`, the successor to framer-motion). All motion behind `useReducedMotion()`; reduced motion swaps to instant state changes.

| Screen | The one moment | Driven by |
|---|---|---|
| Input | The pasted sentence **splits**: each claim's span lifts out of the quote and becomes a claim row (shared `layoutId` from text span to row). Unverifiable spans settle hatched. | `claims.extracted` (spans) |
| Investigation | The **reasoning thread** grows one event at a time. On `replan`, the thread visibly **forks** into the counter lane (SVG path draw, 400ms). Numbers appear only when `evidence.added` carries them, with a short count-up from 0 to the real value. | SSE events |
| Report | The two lanes **resolve**: thesis and counterpoint columns slide together around the verdict. | `report.ready` |

Everything else is responsive motion only (expanding evidence, opening the drawer). No scroll-triggered fade-ups, no hover lift on cards, no ambient gradients.

### 4.4 Screens

1. **Landing = the input.** No marketing page. Headline, the input (paste or drop a screenshot), one real example thesis to try, the not-advice line. A short "how it works" sits below the fold, rendered as a replay of a real trace, not as four cards.
2. **Investigation.** Left: thesis with highlighted claim spans. Centre: reasoning thread (plan → expectation → tool → evidence → held/didn't hold). Right: counterpoint lane filling with hypotheses. Header shows real budget use: "Tool calls 4 of 6 · Replans 1 of 2".
3. **Report.** Per claim: verdict, coverage, *Thesis says / Counterpoint says* side by side, "What would change this verdict", evidence drawer one click away (value, unit, period, peers, source locator). Peer set shown with exclusions and reasons.

### 4.5 Quality floor

Keyboard path through the whole flow; visible focus; 4.5:1 contrast; status by text + texture + color; mobile at 375px (two lanes stack, with lane labels); screenshot review of every screen in light and dark before freeze.

## 5. Architecture changes

| Unit | Change | Location |
|---|---|---|
| Event bus | In-process `EventEmitter` keyed by session; engine emits typed events; persisted to `ExecutionTrace` | `apps/api/src/investigation/events.ts` (new) |
| SSE controller | `@Sse('theses/:id/events')`; replays persisted events, then tails live ones | `apps/api/src/thesis/thesis.controller.ts` |
| Planner | Output gains `expectation`; evaluator sets `expectationHeld` | `llm-planner.ts`, `engine.ts`, `prompts.ts` |
| Counterpoint | Hypothesis catalog + deterministic tests + adversary selection step | `packages/domain/src/counterpoint.ts` (new), `apps/api/src/investigation/adversary.ts` (new) |
| Falsifiers | `whatWouldChange(contract, states, values)` | `packages/domain/src/falsifiers.ts` (new) |
| Sectors | Adapters for `/daily/{ticker}`, report `ownership` (and ROE source) | `packages/sectors/src/adapters.ts` |
| Claim spans | Extractor returns `[start, end]` offsets into the raw thesis | `claims.service.ts`, schema |
| Timeout | Session-level 90s `AbortController` | `investigation.service.ts` |
| Screenshot | `POST /theses/extract-text` (image → text, not persisted) | `thesis.controller.ts`, `llm.service.ts` |
| Web | New token sheet, `motion`, SSE hook `useSessionEvents`, three screens | `apps/web` |

Budget changes: the per-claim tool budget rises from 6 to 8 to fit up to 3 counter-hypotheses; replans stay at 2. Update the eval expectations to match.

## 6. Testing

- Domain: unit tests for every counter-hypothesis test, falsifier text and numbers, and symmetric stance.
- Engine: fixture tests proving two theses take different counterpoint paths, and that `expectationHeld` reflects evaluator output.
- Events: replaying a finished session reproduces the same ordered event list.
- Eval: extend `claim-cases.json` with expected `counterpoint` hypothesis outcomes; add the baseline comparison script.
- UI: manual keyboard and reduced-motion pass; screenshots at 375px and 1440px in both themes.

## 7. Schedule

Times are targets; cut lines are hard.

| Day | Build | Done when |
|---|---|---|
| **1 Oct (eve)** | Probe `ownership`, `peers`, `future` sections and `/daily/{ticker}` for BBRI, BBCA, TLKM, ASII; save fields to `docs/data-spike.md`. Prune the hypothesis catalog to what the data supports. Commit PRD. | Catalog final |
| **2 Oct** | Fixes 1–3. Event bus + SSE + persisted replay. Planner `expectation`. | `curl -N …/events` streams a full live run; replay identical |
| **3 Oct** | Counterpoint engine + catalog tests + new adapters. Falsifiers. Eval cases updated. | BBRI and BBCA produce different counterpoint paths on live data; `pnpm test` and `pnpm eval` green |
| **4 Oct** | UI foundation: tokens, type, `motion`, delete preview pages, new landing/input, claim-span split moment. Screenshot input if on time. | Paste → split animation works on live data |
| **5 Oct** | Investigation screen: reasoning thread, fork on replan, counter lane, budget header. | Full live run watchable without dev tools |
| **6 Oct** | Report screen: two-lane resolve, falsifiers, evidence drawer, peers. Accessibility pass, dark theme. **Feature freeze 20:00.** | All three screens screenshot-reviewed |
| **7 Oct** | Morning: 3 target-user sessions, fix only comprehension issues. Baseline + traces committed. README/docs. Afternoon/evening: record 3-min video and 1-min teaser. | Videos uploaded; fresh-clone setup works |
| **8 Oct** | Buffer only. Deploy check, submission form, social post, turn off auto-deploy. **Submit by 20:00 WIB.** | Submitted |

**Cut order if behind:** F4 screenshot → ownership hypothesis → dark theme → report lane-resolve animation → RELATIVE_GROWTH (already out). Never cut: SSE stream, Counterpoint engine, falsifiers, fixes 1–3.

## 8. Video spine (3 min)

1. 0:00 A real community post (screenshot). "One sentence, four claims, one of them a price target."
2. 0:20 Drop it in; the sentence splits into claims; the price target settles hatched: unverifiable.
3. 0:45 Live thread on the growth claim: the agent predicts, checks, the prediction fails, the thread forks into the counterpoint lane.
4. 1:40 Report: thesis vs counterpoint, "what would change this verdict", open one evidence item down to the Sectors locator.
5. 2:20 Side-by-side with a generic chatbot given the same data: invented numbers or advice vs Counterpoint's cited, bounded answer.
6. 2:45 Close: "Every thesis has a counterpoint. Now you can see it."

## 9. Open decisions for review

1. Light-first palette and the "two voices" concept, or a different direction?
2. Raise the per-claim tool budget from 6 to 8 for counter-hypotheses?
3. Delete the preview pages outright (recommended) or keep them off-nav?
