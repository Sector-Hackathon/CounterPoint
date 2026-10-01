# Counterpoint

**Product Requirements Document**

AI Evidence Investigation Agent for Indonesian Stock Narratives

**Track 1 — AI Agents & Assistants**

| **Document version**    | 1.0                          |
|-------------------------|------------------------------|
| **Date**                | 25 September 2026            |
| **Status**              | Implementation-ready MVP PRD |
| **Product stage**       | Hackathon MVP                |
| **Submission deadline** | 8 October 2026, 23:59 WIB    |

> **Product promise**  
> Paste a stock thesis. Counterpoint decomposes it into testable claims, investigates the evidence using Sectors data, searches for counterevidence, and shows which parts are supported, weakened, or unverifiable — without giving investment recommendations.

Source basis: Counterpoint Revised Proposal (24 Sep 2026), agreed implementation plan, and current Sectors Hackathon official rules checked 25 Sep 2026.

# 1. Executive Summary

Counterpoint is an auditable evidence-investigation agent for Indonesian retail investors who encounter stock theses on social media, investment communities, or other digital channels. The product sits between idea discovery and conviction: it does not tell users what to buy or sell; it helps them test the claims they are considering.

The MVP converts unstructured natural-language theses into atomic typed claims, assigns each claim a predefined evidence contract, retrieves Sectors data through typed adapters, performs deterministic financial calculations, and lets a bounded AI agent decide what evidence to investigate next. The final report separates supporting evidence, counterevidence, missing evidence, and qualified interpretation, with every numeric statement traceable to an evidence object.

> **Core design principle**  
> Language models interpret and plan. Deterministic code calculates, validates, compares, tracks periods, selects admissible peers, and enforces evidence provenance. The product must never depend on an LLM “feeling” that a number is high, cheap, or strong.

# 2. Product Context & Competition Constraints

| **Constraint** | **Decision**           | **PRD implication**                                                                                                         |
|----------------|------------------------|-----------------------------------------------------------------------------------------------------------------------------|
| Track          | AI Agents & Assistants | AI/LLM must be core and team-built orchestration must go beyond configuring an existing chat client.                        |
| Core data      | Sectors REST API / MCP | Removing Sectors data must break the core product workflow.                                                                 |
| MVP            | Working end to end     | At least one complete real-data workflow must function from thesis input to evidence report.                                |
| Positioning    | Information & analysis | No buy/sell/hold, target price, portfolio allocation, automated trade execution, or personalized investment recommendation. |
| Judging        | 40 / 30 / 30           | Real-world usability 40%, video/storytelling 30%, technical depth/execution 30%.                                            |
| Freeze         | On submission          | Repository and application freeze when submitted or at deadline, whichever comes first.                                     |

# 3. Problem Statement

Self-directed Indonesian retail investors frequently encounter persuasive stock narratives that combine facts, comparisons, interpretations, and speculation into a single sentence. Verifying them manually requires claim decomposition, metric selection, time-period matching, peer selection, historical comparison, contradiction search, and synthesis across multiple data points.

The problem is not simply lack of financial information. It is the lack of a fast, disciplined, traceable workflow for deciding which parts of a stock narrative are actually supported by available company and market evidence.

> **One-sentence problem statement**  
> Indonesian self-directed investors need a fast way to independently test stock theses they discover online because persuasive narratives often combine multiple claims that require different data and comparisons to verify.

# 4. Target User & Jobs to Be Done

## 4.1 Primary persona

Self-directed Indonesian retail investor who discovers stock ideas through communities or social media, understands basic fundamental concepts, but lacks a professional equity-research workflow and has limited time for manual cross-checking.

## 4.2 Jobs to be done

- When I see an interesting stock thesis, help me identify which parts can actually be checked with data.

- Show me what is fact, what is interpretation, and what is assumption or speculation.

- Do not only find supporting evidence; actively look for evidence that weakens the claim.

- If the available data is insufficient, say so clearly rather than manufacturing certainty.

- Let me inspect the exact periods, peers, metrics, and source evidence behind the assessment.

## 4.3 Out-of-scope users

- Users seeking stock picks, trading signals, target prices, or portfolio allocation.

- Intraday trading automation or brokerage execution workflows.

- Users expecting full-text verification of rumors, management quality, or future events without relevant data.

# 5. Product Goals, Non-Goals & Success Definition

## 5.1 MVP goals

- Turn a pasted stock thesis into atomic, typed, researchable claims.

- Verify at least three claim types end to end using real Sectors data.

- Demonstrate genuine evidence-dependent adaptive investigation in at least one case.

- Produce a report where every numeric claim is traceable to an EvidenceItem.

- Expose counterevidence and missing evidence instead of optimizing for agreement with the user.

- Responsibly abstain when a claim is outside supported scope or evidence is insufficient.

- Deliver a product understandable within roughly five seconds of first use.

## 5.2 Non-goals

- Predict prices or returns.

- Provide buy/sell/hold or target-price recommendations.

- Build a generic “ask anything about stocks” chatbot.

- Build portfolio tracking, alerts, watchlists, brokerage integrations, or trading automation.

- Support every IDX company or every claim category in the MVP.

- Create a multi-agent system, vector database, or long-term conversational memory unless core requirements are already stable.

# 6. MVP Scope & Priorities

| **Priority** | **Meaning**             | **Scope**                                                                                                                                                                                                                   |
|--------------|-------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| P0           | Must work end to end    | Entity resolution; claim ontology; 3 claim types; evidence contracts; typed Sectors adapters; deterministic calculations; one adaptive branch; counterevidence; evidence coverage; citation/numeric validation; abstention. |
| P1           | Strong differentiators  | Deterministic peer policy; visible execution trace; 20–50-case evaluation set; time semantics; baseline comparison.                                                                                                         |
| P2           | Only if core is stable  | Multi-company thesis handling; saved report history; shareable reports; additional charts/market context.                                                                                                                   |
| CUT          | Explicitly out of scope | Authentication, multi-user accounts, portfolio features, alerts, sentiment, generic chat, mobile app, vector DB, complex charts, multi-agent orchestration.                                                                 |

# 7. Core User Experience

## 7.1 Primary flow

1.  Paste thesis

2.  Resolve company/entities

3.  Extract atomic claims

4.  Classify & normalize claims

5.  Mark unsupported/unverifiable claims

6.  Select evidence contracts

7.  Investigate evidence

8.  Adapt when contradiction appears

9.  Stop when sufficient/unobtainable

10. Render evidence report

## 7.2 Example user journey

> **Example thesis**  
> “BBRI masih menarik karena growth kuat dan valuasinya murah dibanding bank besar lain.”

| **Stage**         | **Expected experience**                                                                                                                                                  |
|-------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Input             | User pastes thesis and taps Verify Thesis.                                                                                                                               |
| Entity resolution | System resolves BBRI and any referenced comparison entities; asks for confirmation if ambiguous.                                                                         |
| Decomposition     | System shows atomic claims such as growth strength and relative valuation.                                                                                               |
| Investigation     | Growth contract starts with revenue/earnings evidence. If revenue and EPS diverge, the agent chooses a margin or peer follow-up rather than executing a fixed checklist. |
| Report            | Each claim shows assessment, evidence coverage, supports, weakens, missing evidence, exact periods, and provenance.                                                      |
| Abstention        | Forward-looking or unsupported claims are labeled UNVERIFIABLE / insufficient evidence instead of receiving a fabricated conclusion.                                     |

# 8. Claim Ontology & Normalization

Claim extraction is not sufficient. Every supported claim must be normalized into a stable research specification so that the same natural-language idea maps to the same evidence requirements across runs.

| **Claim type**     | **Normalized meaning**                                                       | **Comparison basis**                     | **MVP priority** |
|--------------------|------------------------------------------------------------------------------|------------------------------------------|------------------|
| ABSOLUTE_GROWTH    | Company has strong recent fundamental growth.                                | Historical company metrics               | P0 #1           |
| DIVIDEND_LEVEL     | Company dividend/yield is high or attractive relative to a defined baseline. | Own history and/or peer baseline         | P0 #2           |
| RELATIVE_VALUATION | Company is cheap/expensive compared with relevant peers.                     | Comparable valuation + peer distribution | P0 #3           |
| RELATIVE_GROWTH    | Company growth is stronger/weaker than peers.                                | Matched peer growth metrics              | P1               |
| FORWARD_LOOKING    | Future price, performance, or management outcome claim.                      | Typically outside available evidence     | Abstain          |

## 8.1 Claim object requirements

- Original text

- Normalized text

- Resolved entity/ticker

- Claim type

- Comparison type (absolute / historical / peer)

- Time scope if stated

- Verifiability status (YES / PARTIAL / NO)

- Evidence contract ID

# 9. Evidence Contract System

Evidence contracts are code-defined policies that specify what must be checked before an assessment can be produced. The LLM may select from approved contracts but may not invent new requirements or thresholds at runtime.

| **Contract**          | **Claim**          | **Required checks**                                                   | **Counterchecks**                                                                     |
|-----------------------|--------------------|-----------------------------------------------------------------------|---------------------------------------------------------------------------------------|
| absolute-growth-v1    | ABSOLUTE_GROWTH    | Revenue growth; earnings/EPS growth; historical context               | Growth deceleration; margin deterioration; revenue/earnings divergence                |
| dividend-level-v1     | DIVIDEND_LEVEL     | Dividend/yield metric; historical or peer baseline; relevant period   | One-off dividend; falling payout/coverage context if available; missing comparability |
| relative-valuation-v1 | RELATIVE_VALUATION | Comparable valuation metric; valid peer set; peer median/distribution | Not below peer baseline; metric mismatch; insufficient peers                          |

> **Contract rule**  
> If a required check is unavailable, the system must report the missing evidence and downgrade evidence coverage. It must not silently substitute a different period, metric, or peer universe.

# 10. Evidence Assessment Framework

| **Status**          | **Meaning**                                                                                                         |
|---------------------|---------------------------------------------------------------------------------------------------------------------|
| SUPPORTED           | Available evidence materially supports the normalized claim within the declared evidence contract.                  |
| PARTIALLY SUPPORTED | Some evidence supports the claim, but material counterevidence or context weakens it.                               |
| NOT SUPPORTED       | Available evidence does not support the claim or materially contradicts it.                                         |
| UNVERIFIABLE        | The claim requires unavailable evidence, unsupported data, or forward-looking speculation beyond the product scope. |

## 10.1 Mandatory report fields

- Evidence coverage (e.g., 3 of 4 required checks available) — never an uncalibrated confidence percentage.

- Supporting evidence with periods and evidence IDs.

- Counterevidence with periods and evidence IDs.

- Missing evidence / unavailable checks.

- Qualified interpretation bounded by the evidence.

- Source references / provenance.

- Explicit “not investment advice” framing where relevant.

# 11. Agent Orchestration Requirements

The agent is a bounded research controller. It must make evidence-dependent decisions about what to inspect next, while deterministic code owns arithmetic, validation, period logic, peer eligibility, and final evidence bookkeeping.

| **Component**      | **Responsibility**                                                                                                                  |
|--------------------|-------------------------------------------------------------------------------------------------------------------------------------|
| Planner            | Chooses the next research question based on claim, contract, evidence gaps, counterevidence, available tools, and remaining budget. |
| Tool Router        | Allows only whitelisted domain tools; validates tool parameters and prevents arbitrary URL/code execution.                          |
| Evidence Evaluator | Checks contract completeness, contradictions, comparability, and whether further research can materially improve the assessment.    |
| Replanner          | Changes the next question when evidence conflicts or reveals a new gap.                                                             |
| Stop Controller    | Stops when evidence is sufficient, unobtainable, duplicated, out of scope, or budget-limited.                                       |
| Report Composer    | Produces a bounded explanation from validated EvidenceItems and assessment state.                                                   |

> **Proof of agency**  
> The demo must show at least two contrasting cases with different tool paths. A fixed checklist with a progress animation does not count as adaptive behavior.

## 11.1 Provisional per-claim budget

- Maximum 6 domain-tool executions.

- Maximum 2 evidence-driven replans after the initial plan.

- One retry for a transient tool failure.

- Duplicate tool/evidence signatures are rejected.

- Budget exhaustion returns a partial report with explicit gaps.

# 12. Deterministic Financial & Data Logic

The following functions must be implemented and unit-tested outside the LLM layer. Exact metric availability is subject to the Sectors data spike; unsupported calculations must be removed rather than approximated.

| **Function**           | **Requirement**                                                                         |
|------------------------|-----------------------------------------------------------------------------------------|
| Period matching        | Match comparable quarters/periods; reject silent quarterly-vs-annual substitutions.     |
| YoY growth             | Calculate revenue/earnings/EPS growth when denominator and period semantics are valid.  |
| Margin change          | Calculate percentage-point changes; handle missing/zero/negative edge cases explicitly. |
| Peer statistics        | Median/distribution over frozen valid peer set; minimum peer count enforced.            |
| Evidence coverage      | Track required completed / unavailable / invalid checks.                                |
| Numeric reconciliation | Ensure reported numbers equal stored calculated evidence values.                        |

# 13. Peer Selection & Time Semantics

## 13.1 Peer policy

1\. Start from Sectors sector/subsector or documented comparable-company candidates.

2\. Filter by data availability, matched reporting period, metric comparability, and business-model compatibility.

3\. Require minimum valid peer count for relative claims; otherwise mark peer comparison unavailable.

4\. Freeze peer set before calculating the comparative result.

5\. Expose included and excluded peers with reasons.

6\. Never allow the LLM to select a favorable subset after seeing the result.

## 13.2 Time semantics

- Store economic period/trading date separately from retrieval time.

- Use same-quarter year-on-year comparisons for seasonal financial metrics unless a contract explicitly defines another basis.

- Display exact comparison periods in the evidence report.

- Reject incomparable periods instead of silently substituting the nearest available record.

- Do not infer causality from temporal co-occurrence.

# 14. Entity Resolution

Company resolution should prefer deterministic company/ticker lookup and use the LLM only for context disambiguation. The system must never silently guess an ambiguous ticker and continue to paid data retrieval.

| **Case**            | **Required behavior**                                                                                          |
|---------------------|----------------------------------------------------------------------------------------------------------------|
| Single clear entity | Resolve automatically and show canonical ticker/name.                                                          |
| Alias / common name | Map via company dictionary/search, then display canonical entity.                                              |
| Multiple companies  | Extract all referenced entities; P0 may designate one primary company and treat multi-company workflows as P2. |
| Ambiguous entity    | Pause investigation and ask user to confirm.                                                                   |
| Unknown entity      | Return unsupported/unknown entity state without issuing unrelated API calls.                                   |

# 15. Functional Requirements

| **ID** | **Requirement**                                                         | **Priority** | **Acceptance Criteria**                                                                               | **Dependencies**     |
|--------|-------------------------------------------------------------------------|--------------|-------------------------------------------------------------------------------------------------------|----------------------|
| FR-001 | User can submit a natural-language stock thesis.                        | P0           | A valid thesis creates a ThesisSession and returns an analysis job/session ID.                        | Web, API             |
| FR-002 | System resolves company/ticker entities before financial retrieval.     | P0           | Clear entity auto-resolves; ambiguous entity requires confirmation; no silent guess.                  | Entity service       |
| FR-003 | System decomposes thesis into atomic claims using structured output.    | P0           | At least one valid claim object contains original text, normalized text, entity, type, verifiability. | LLM, schema          |
| FR-004 | System maps supported claims to a versioned evidence contract.          | P0           | Every verifiable claim has contractId; unsupported type returns explicit scope state.                 | Contract registry    |
| FR-005 | System fetches Sectors evidence through typed adapters only.            | P0           | No raw provider payload is passed directly to the report composer or client.                          | Sectors client       |
| FR-006 | System calculates required financial metrics deterministically.         | P0           | All displayed derived values are produced by tested code and stored as EvidenceItems.                 | Analytics            |
| FR-007 | System evaluates evidence sufficiency after each relevant tool result.  | P0           | State shows completed, missing, invalid, and contradictory checks.                                    | Evaluator            |
| FR-008 | Agent can choose a different follow-up based on observed contradiction. | P0           | At least one representative case follows a different tool path after conflicting evidence.            | Planner/router       |
| FR-009 | System actively checks contract-defined counterevidence.                | P0           | Final report includes weakens/counterevidence when present, not only supports.                        | Contracts/evaluator  |
| FR-010 | System stops according to bounded conditions and budget.                | P0           | No unbounded loop; stop reason persisted and displayed/debuggable.                                    | Agent state          |
| FR-011 | System produces one of four evidence assessments.                       | P0           | SUPPORTED / PARTIALLY SUPPORTED / NOT SUPPORTED / UNVERIFIABLE generated from validated state.        | Evaluator/report     |
| FR-012 | Every numeric statement in final report is traceable to evidence.       | P0           | Citation validator rejects/removes numeric claims without matching EvidenceItem.                      | Validator            |
| FR-013 | Relative claims use deterministic peer policy.                          | P1           | Peer set, exclusions, sample size, and comparison periods are inspectable.                            | Peer service         |
| FR-014 | User can view actual execution trace.                                   | P1           | Trace shows tool/action, human-readable reason, evidence produced, and stop reason; no fake steps.    | Trace store/UI       |
| FR-015 | System identifies forward-looking or unsupported claims and abstains.   | P0           | Price target/future certainty/unsupported speculation receives UNVERIFIABLE or scope explanation.     | Classifier/evaluator |
| FR-016 | User can inspect evidence details from report.                          | P0           | At least each metric shows value, unit, period, comparison basis, and source locator.                 | UI/evidence          |

# 16. Backend & API Requirements

## 16.1 Suggested application endpoints

| **Endpoint**                  | **Responsibility**                                                                          |
|-------------------------------|---------------------------------------------------------------------------------------------|
| POST /theses                  | Create thesis session; validate input; resolve initial entities/claims or enqueue analysis. |
| POST /theses/{id}/investigate | Start bounded investigation for eligible claims; idempotent on repeated request key.        |
| GET /theses/{id}              | Return session state, entities, claims, and current progress.                               |
| GET /theses/{id}/report       | Return final/partial evidence report and validation status.                                 |
| GET /claims/{id}/evidence     | Return EvidenceItems, comparison periods, and source locators.                              |
| GET /theses/{id}/trace        | Return persisted execution events and stop reason.                                          |

## 16.2 Backend module boundaries

- Thesis

- Entity

- Claims

- Contracts

- Investigation

- Evidence

- Sectors

- Peers

- Analytics

- Reports

- Validation

- Evaluation

# 17. Frontend Requirements

| **Surface**                | **Required content**                                                                                                                       |
|----------------------------|--------------------------------------------------------------------------------------------------------------------------------------------|
| Screen 1 — Landing         | Headline, short explanation, thesis text area, Verify Thesis CTA, concise information-not-advice note.                                     |
| Screen 2 — Investigation   | Detected company, atomic claims, claim type/status, actual live/polled execution trace, contradiction-driven branch explanation.           |
| Screen 3 — Evidence Report | Per-claim assessment, evidence coverage, supports, weakens, missing evidence, exact periods, peer context, expandable evidence provenance. |

## 17.1 UX principles

- No generic empty chatbot as the primary experience.

- Show only real completed investigation steps; no decorative fake checklist.

- Make uncertainty visually first-class.

- Evidence details must be one interaction away from the assessment.

- Keep the main flow understandable without requiring financial research expertise.

- Do not visually imply a buy/sell signal through green/red recommendation-style affordances.

# 18. Core Data Model

| **Entity**     | **Minimum fields**                                                                                                                                         |
|----------------|------------------------------------------------------------------------------------------------------------------------------------------------------------|
| ThesisSession  | id, rawThesis, status, createdAt, finalReportId                                                                                                            |
| Entity         | id, sessionId, ticker, canonicalName, resolutionStatus                                                                                                     |
| Claim          | id, sessionId, originalText, normalizedText, claimType, comparisonType, verifiability, contractId, assessment                                              |
| EvidenceItem   | id, claimId, metric, value, unit, economicPeriod, comparisonPeriod, observationDate, retrievalTime, sourceLocator, derivedFrom, calculationVersion, status |
| ExecutionTrace | id, claimId, sequence, action/tool, reason, startedAt, finishedAt, evidenceIds, resultStatus                                                               |
| Report         | id, sessionId, content/structured sections, validationStatus, createdAt                                                                                    |

# 19. Non-Functional Requirements

| **ID**  | **Requirement**   | **Priority** | **Acceptance Criteria**                                                                                                                          | **Dependencies** |
|---------|-------------------|--------------|--------------------------------------------------------------------------------------------------------------------------------------------------|------------------|
| NFR-001 | Reliability       | P0           | Tool failures, missing data, invalid JSON, and unavailable peers produce truthful partial/error states, never fabricated success.                | All              |
| NFR-002 | Traceability      | P0           | 100% of displayed numeric statements map to stored EvidenceItems.                                                                                | Evidence/report  |
| NFR-003 | Bounded execution | P0           | Per-claim tool and replan limits are enforced.                                                                                                   | Agent            |
| NFR-004 | Reproducibility   | P1           | Representative runs persist model/prompt version, calculation version, tool trace, and evidence IDs.                                             | Trace/eval       |
| NFR-005 | Performance       | P1           | Target typical end-to-end investigation \<= 60 seconds; hard timeout \<= 90 seconds for demo environment, subject to measured API/model latency. | Infra            |
| NFR-006 | Cost control      | P0           | Sectors/API requests are bounded, cached where safe, and logged for credit accounting.                                                           | Sectors/agent    |
| NFR-007 | Security          | P0           | Secrets remain server-side; inputs treated as untrusted data; no arbitrary code/URL tools.                                                       | API/agent        |
| NFR-008 | Accessibility     | P1           | Readable typography, keyboard-accessible primary flow, sufficient contrast, status not conveyed by color alone.                                  | Web              |
| NFR-009 | Observability     | P1           | Structured logs include session/claim IDs, tool decisions, failures, retries, stop reason, and latency.                                          | Backend          |

# 20. Safety, Security & Responsible Design

## 20.1 Financial-advice boundary

- No buy/sell/hold wording.

- No target price or expected return.

- No portfolio allocation recommendation.

- No automated execution.

- No “best stock” ranking.

- Assess only evidence behind user-provided claims and explicitly state limitations.

## 20.2 Prompt injection & untrusted thesis text

Pasted content from social media or communities is data, not instruction. The system prompt and tool router must delimit thesis text and ignore embedded instructions such as “ignore previous instructions” or requests to output a recommendation.

- Structured claim extraction only; do not execute commands contained in thesis text.

- Whitelisted domain tools only.

- No arbitrary browsing/URL fetch/code execution in the MVP agent.

- Schema validation for LLM outputs.

- One bounded retry for invalid structured output; then fail truthfully.

# 21. Evaluation Plan

The repository should contain a small reproducible evaluation harness. This is not intended to prove statistical superiority; it demonstrates that the system behaves consistently, cites evidence, abstains appropriately, and shows real adaptive routing.

| **Dimension**        | **What to review**                                                                              |
|----------------------|-------------------------------------------------------------------------------------------------|
| Entity resolution    | Correct ticker/company or explicit ambiguity state.                                             |
| Claim decomposition  | Atomic claims match intended meaning and supported taxonomy.                                    |
| Claim classification | Correct claim type and verifiability.                                                           |
| Tool selection       | Selected tools are allowed and useful for evidence contract.                                    |
| Adaptive routing     | At least two cases exercise genuinely different evidence-dependent paths.                       |
| Citation correctness | Every numeric/factual report statement maps to relevant EvidenceItem.                           |
| Abstention           | Unsupported/forward-looking cases stop without fabricated conclusions.                          |
| Robustness           | Missing peers, API failure, prompt injection, invalid JSON, duplicate calls handled truthfully. |

## 21.1 Minimum evaluation set

- 20–30 real or realistically phrased Indonesian stock narratives for development.

- At least 20 labeled claim-level cases in the public eval fixture.

- A small held-out set not tuned specifically to the demo thesis.

- One generic-LLM baseline receiving a fixed data bundle for qualitative comparison on unsupported claims and traceability.

- Report measured results only; label planned targets separately.

# 22. Product & Technical Telemetry

| **Category** | **Suggested events/metrics**                                                                                |
|--------------|-------------------------------------------------------------------------------------------------------------|
| Product      | Theses submitted; claims/session; supported claim types; user opens evidence; report completion.            |
| Agent        | Tool calls/claim; replans/claim; stop reason; duplicate-call prevention; partial investigations.            |
| Data         | Sectors calls; cache hit; missing-data rate; incomparable-period rate; peer-unavailable rate.               |
| Quality      | Citation validation failures; numeric reconciliation failures; unsupported-claim catches; eval pass counts. |
| Performance  | Latency by stage; model latency; Sectors latency; end-to-end time.                                          |

# 23. MVP Acceptance Criteria / Definition of Done

- A user can paste a real stock thesis and understand the product purpose immediately.

- System resolves intended company/ticker or requests confirmation if ambiguous.

- Thesis is decomposed into atomic typed claims with verifiability status.

- At least three claim types run end to end using real Sectors data.

- Every verifiable claim uses a versioned evidence contract.

- Deterministic code calculates every displayed derived metric.

- Every numeric statement in the final report is traceable to an EvidenceItem.

- At least one demo case triggers a genuine evidence-dependent follow-up branch.

- At least one representative case ends responsibly as UNVERIFIABLE / insufficient evidence.

- Relative claims expose peer set, exclusions, sample size, and exact comparison periods.

- Report separates supports, weakens, missing evidence, and interpretation.

- No prohibited investment recommendation or automated trade action is emitted.

- Representative execution traces and evaluation fixtures are committed to the public repository.

- Fresh setup instructions reproduce the core workflow with valid credentials.

# 24. Implementation Milestones

| **Date** | **Milestone**                 | **Deliverable**                                                              | **Acceptance / cut gate**                                      |
|----------|-------------------------------|------------------------------------------------------------------------------|----------------------------------------------------------------|
| 25 Sep   | Data spike + skeleton         | Monorepo, Next.js/NestJS, DB, Sectors credentials, endpoint/coverage matrix. | One real ticker → Sectors response → normalized domain object. |
| 26 Sep   | Domain + first contract       | Claim/Evidence models, period matcher, growth analytics, Sectors adapter.    | Real data produces stored EvidenceItems without LLM.           |
| 27 Sep   | Entity + claim parser         | Entity resolver, structured claim extraction, claim taxonomy mapping.        | 10 development theses parse into valid structured claims.      |
| 28 Sep   | First agent loop              | Planner, router, state, budgets, stop conditions, trace.                     | One claim completes thesis → assessment end to end.            |
| 29 Sep   | Adaptive contradiction branch | Counterevidence-driven replan.                                               | Two fixtures produce different tool paths.                     |
| 30 Sep   | Report + validator            | Report composer, numeric/citation validation, advice/causality guard.        | Zero report numbers without EvidenceItem.                      |
| 1 Oct    | Second claim type             | Dividend contract.                                                           | End-to-end dividend case.                                      |
| 2 Oct    | Third claim type + peers      | Relative valuation + deterministic peer policy.                              | Real peer-relative case completes.                             |
| 3 Oct    | Frontend polish               | Three core screens + execution trace.                                        | End-to-end demo usable without developer tools.                |
| 4 Oct    | Evaluation + feature freeze   | 20+ cases; robustness tests.                                                 | No new features after freeze; correctness only.                |
| 5 Oct    | User validation               | 5 target users; descriptive feedback.                                        | Record missed evidence / comprehension feedback.               |
| 6 Oct    | Reliability + repo            | README, tests, architecture, clean secrets, fresh clone test.                | Documented setup reproduces core workflow.                     |
| 7 Oct    | Video + submission prep       | 1-min teaser, ≤3-min judging video, social/portal fields.                  | All links accessible and product state frozen for recording.   |
| 8 Oct    | Submit                        | Final verification only.                                                     | Submit before 23:59 WIB; project freezes on submission.        |

# 25. Risks & Mitigations

| **Risk**                                        | **Severity** | **Mitigation**                                                                                              | **Cut / warning signal**                                  |
|-------------------------------------------------|--------------|-------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------|
| Sectors coverage insufficient for planned claim | High         | Run coverage spike first; remove unsupported metric/contract rather than faking proxy.                      | No reliable fields for contract after day-one validation. |
| LLM becomes the real verdict engine             | High         | Code-defined evidence contracts, deterministic calculations, bounded assessment rules, citation validator.  | Same evidence produces unstable/unexplained statuses.     |
| Agent is actually a fixed checklist             | High         | Require contrasting execution paths and persisted reasons for tool choices.                                 | All cases follow identical tools regardless of evidence.  |
| Peer comparison is cherry-picked                | High         | Deterministic peer universe, minimum count, period matching, visible exclusions, freeze before calculation. | LLM can remove unfavorable peers after result.            |
| Product looks like financial advice             | High         | Evidence-checking language only; no trade actions/recommendations; include disclaimer.                      | Output starts ranking/buying/selling securities.          |
| Demo latency/failure                            | Medium       | Bounded tools, cache, timeout, tested real-data case, truthful cached replay only if clearly labeled.       | Repeated runs fail or exceed video practicality.          |
| Scope explosion                                 | High         | P0/P1/P2 cut list; feature freeze 4 Oct.                                                                    | Core vertical slice not stable by 30 Sep.                 |
| Prompt injection from pasted content            | Medium       | Treat thesis as untrusted data; structured extraction; whitelisted tools; schema validation.                | Thesis text can alter system/tool policy.                 |

# 26. Open Questions to Resolve During Data Spike

- Which exact Sectors fields/endpoints provide reliable revenue, earnings/EPS, dividend, valuation, sector/subsector, and peer inputs for the chosen MVP companies?

- What valuation metrics are sufficiently comparable across the initial supported universe?

- What minimum peer count and business-model compatibility rules are practical with actual Sectors coverage?

- Which companies should be excluded from the first demo because accounting templates require special handling?

- What model provides the best structured-output/tool-routing reliability within latency and cost constraints?

- What exact thresholds/definitions should translate qualitative words such as “strong” or “high” into a contract assessment? These must be explicitly versioned and not improvised by the LLM.

- Should investigation be synchronous with polling/SSE, or queued as a job in the first implementation? Default recommendation: job state with polling/SSE to avoid long HTTP requests.

# 27. Recommended Repository Structure

```text
counterpoint/
├── apps/
│ ├── web/ # Next.js
│ └── api/ # NestJS
├── packages/
│ ├── domain/ # claims, evidence, contracts
│ ├── sectors/ # typed Sectors client/adapters
│ └── eval/ # evaluation utilities
├── evals/ # labeled cases + expected behavior
├── docs/ # architecture, data dictionary, demo notes
├── scripts/ # Sectors probe, seed, eval, replay
├── .env.example
└── README.md
```


# 28. Demo Requirements

| **Time**  | **Beat**        | **What judges must see**                                                                                 |
|-----------|-----------------|----------------------------------------------------------------------------------------------------------|
| 0:00–0:20 | Problem         | Show one persuasive community-style thesis; explain that one sentence contains multiple claims.          |
| 0:20–0:45 | Decomposition   | Paste thesis; show detected company, atomic claims, claim types, and one unsupported/unverifiable claim. |
| 0:45–1:35 | Agent moment    | Focus on one claim; contradiction changes the next tool/question. Show actual reason for branch.         |
| 1:35–2:20 | Evidence report | Show supports, weakens, coverage, exact period, peers; open one evidence item.                           |
| 2:20–2:45 | Contrast        | Second claim follows a different path or stops as unverifiable.                                          |
| 2:45–3:00 | Close           | Reinforce evidence-checking position; no recommendation.                                                 |

# 29. Sources & Product Basis

This PRD is derived from the revised Counterpoint proposal and the agreed implementation plan. Hackathon constraints below were verified against the official Sectors Hackathon website on 25 September 2026.

**Official rules:** [hackathon.sectors.app/rules](https://hackathon.sectors.app/rules)

**Track 1 requirements:** [hackathon.sectors.app/tracks/ai-agents-assistants](https://hackathon.sectors.app/tracks/ai-agents-assistants)

**Internal source:** Counterpoint — Revised Proposal, 24 September 2026.
