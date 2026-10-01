# Counterpoint

AI evidence investigation agent for Indonesian stock narratives. Paste a stock thesis (or drop a screenshot of the post); Counterpoint decomposes it into testable claims, investigates each against Sectors data, and then **argues back**: it builds the strongest opposing case and tests that too. You watch the agent reason live, predicting each result before the data arrives, and the report shows which parts are supported, weakened or unverifiable, plus **what would change each verdict**. It never gives buy/sell/hold advice.

| Paste | Watch it investigate | Read the evidence |
| --- | --- | --- |
| ![Input](docs/img/input.png) | ![Investigation](docs/img/investigation.png) | ![Report](docs/img/report.png) |

> Language models interpret and plan. Deterministic code calculates, validates, compares, tracks periods, selects peers, and enforces evidence provenance.

## Repository layout

```text
apps/
  api/        NestJS API: sessions, entity resolution, claim extraction, investigation agent, reports
  web/        Next.js UI: landing, live investigation trace, evidence report
packages/
  domain/     claim ontology, evidence contracts, deterministic analytics, peer policy, validators
  sectors/    typed Sectors client + adapters, labelled synthetic fixture source
  eval/       evaluation case schema and scoring
evals/        labelled claim-level and thesis-level cases
docs/         architecture and data notes
scripts/      Sectors data-spike probe
```

## Quick start

Requirements: Node 20+, pnpm 10, Docker.

```bash
pnpm install
cp .env.example .env            # add SECTORS_API_KEY / ANTHROPIC_API_KEY when available
docker compose up -d postgres   # Postgres on localhost:5433
pnpm build:packages
pnpm --filter @counterpoint/api db:push
pnpm dev:api                    # http://localhost:4000/health
pnpm dev:web                    # http://localhost:3000
```

### Modes

| Setting | Unset | Set |
| --- | --- | --- |
| `SECTORS_API_KEY` | Synthetic fixture data (`fixture:` locators, labelled in the UI) | Live Sectors API |
| `LLM_PROVIDER` + that provider's key | Heuristic claim extractor + deterministic planner (labelled `heuristic-v1` / `deterministic-v1`) | LLM structured extraction, planner, and bounded interpretation. `openai` uses `OPENAI_API_KEY` / `OPENAI_MODEL`; `anthropic` uses `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` |

`SESSION_DEADLINE_MS` (default `90000`) is the hard limit for one investigation; when it is reached the report is built from what was found and marked partial.

Assessments are always produced by deterministic contract rules, never by the LLM.

## Tests and evaluation

```bash
pnpm test                                           # unit tests: domain, sectors, eval, api, web
pnpm eval                                           # 24 labelled claim cases through the real engine (fixture data)
pnpm --filter @counterpoint/api eval --theses       # thesis decomposition cases (uses the LLM)
pnpm --filter @counterpoint/api eval --llm-planner  # claim cases with the LLM planner
pnpm --filter @counterpoint/api baseline "<thesis>" <TICKER> <name>  # generic-LLM baseline -> evals/baseline/
pnpm --filter @counterpoint/api export-trace <sessionId> <name>     # commit a run -> evals/traces/
```

Eval results are written to `evals/results/` (git-ignored). Representative live traces are in `evals/traces/`, and the measured baseline comparison is in `evals/baseline/README.md`. Only measured results should be reported.

## API

| Endpoint | Purpose |
| --- | --- |
| `POST /theses` | Create a session from `{ "thesis": "..." }`; analysis runs in the background |
| `GET /theses/:id` | Session state, entities, claims, live trace |
| `POST /theses/:id/entities/:entityId/confirm` | Confirm an ambiguous company `{ "ticker": "BBRI" }` |
| `POST /theses/:id/investigate` | Start the bounded investigation (idempotent) |
| `GET /theses/:id/report` | Validated evidence report |
| `GET /theses/:id/trace` | Persisted execution events and stop reasons |
| `GET /theses/:id/events` | Server-Sent Events: replay of the session, then live agent steps |
| `POST /theses/extract-text` | Transcribe a screenshot `{ "imageBase64", "mimeType" }` (not stored) |
| `GET /claims/:id/evidence` | EvidenceItems with periods and source locators |
| `GET /health` | Data mode, LLM model, contract registry |

## Status

Verified end to end on live Sectors v2 data (see [docs/data-spike.md](docs/data-spike.md); run `pnpm --filter @counterpoint/api live-check`). Thresholds are fixed per contract version and explained in [docs/thresholds.md](docs/thresholds.md); the design is in [docs/architecture.md](docs/architecture.md), and product changes since PRD v1.0 in [docs/prd/CHANGELOG.md](docs/prd/CHANGELOG.md). Deployment: [docs/deploy.md](docs/deploy.md).

Information and analysis only; not investment advice.
