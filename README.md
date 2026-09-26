# Counterpoint

AI evidence investigation agent for Indonesian stock narratives. Paste a stock thesis; Counterpoint decomposes it into testable claims, investigates each against Sectors data, actively looks for counterevidence, and reports which parts are supported, weakened, or unverifiable. It never gives buy/sell/hold advice.

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
| `ANTHROPIC_API_KEY` | Heuristic claim extractor + deterministic planner (labelled `heuristic-v1` / `deterministic-v1`) | Claude structured extraction, planner, and bounded interpretation (`LLM_MODEL`, default `claude-opus-5`) |

Assessments are always produced by deterministic contract rules, never by the LLM.

## Tests and evaluation

```bash
pnpm test                               # unit tests (domain, sectors, eval, api engine/composer)
pnpm eval                               # 22 labelled claim cases through the real engine
pnpm --filter @counterpoint/api eval --theses       # thesis decomposition cases
pnpm --filter @counterpoint/api eval --llm-planner  # same claim cases with the Claude planner
```

Results are written to `evals/results/` (git-ignored). Only measured results should be reported.

## API

| Endpoint | Purpose |
| --- | --- |
| `POST /theses` | Create a session from `{ "thesis": "..." }`; analysis runs in the background |
| `GET /theses/:id` | Session state, entities, claims, live trace |
| `POST /theses/:id/entities/:entityId/confirm` | Confirm an ambiguous company `{ "ticker": "BBRI" }` |
| `POST /theses/:id/investigate` | Start the bounded investigation (idempotent) |
| `GET /theses/:id/report` | Validated evidence report |
| `GET /theses/:id/trace` | Persisted execution events and stop reasons |
| `GET /claims/:id/evidence` | EvidenceItems with periods and source locators |
| `GET /health` | Data mode, LLM model, contract registry |

## Status

Scaffold implementing the P0 vertical slice. Before relying on live data, run the data spike (`pnpm sectors:probe BBRI`) and verify the endpoint and field mapping in `packages/sectors/src/adapters.ts`. Contract thresholds are marked provisional; see [docs/architecture.md](docs/architecture.md).

Information and analysis only; not investment advice.
