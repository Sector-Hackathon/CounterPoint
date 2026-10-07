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

Requirements: Node 22+, pnpm 10, Docker.

```bash
pnpm install
cp .env.example .env            # add SECTORS_API_KEY / ANTHROPIC_API_KEY when available
docker compose up -d postgres   # Postgres on localhost:5433
pnpm build:packages
pnpm --filter @counterpoint/api db:push
pnpm dev:api                    # http://localhost:4000/health
pnpm dev:web                    # http://localhost:3005 (FRONTEND_PORT in .env)
```

The web commands (`dev`, `build`, and `start`) read the root `.env` for public frontend settings. `FRONTEND_PORT` controls the frontend server port; `API_PORT` controls the backend, and `WEB_ORIGIN` must match the frontend URL for CORS. Restart the server after changing its port. An existing shell `FRONTEND_PORT` takes precedence over the file.

### Modes

| Setting | Unset | Set |
| --- | --- | --- |
| `SECTORS_API_KEY` | Synthetic fixture data (`fixture:` locators, labelled in the UI) | Live Sectors API |
| `LLM_PROVIDER` + that provider's key | Heuristic claim extractor + deterministic planner (labelled `heuristic-v1` / `deterministic-v1`) | LLM structured extraction, planner, and bounded interpretation. `openai` uses `OPENAI_API_KEY` / `OPENAI_MODEL`; `anthropic` uses `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` |

`SESSION_DEADLINE_MS` (default `90000`) is the hard limit for one investigation; when it is reached the report is built from what was found and marked partial.

Assessments are always produced by deterministic contract rules, never by the LLM.

The web interface offers Bahasa Indonesia and English through the language selector on every page. A language cookie lets the server render the selected language immediately on subsequent visits; existing browser storage preferences are migrated on the first visit. Interface labels, metric names, report summaries, and copied results follow the selected language; original quotes and backend evidence narratives keep their original wording.

The workspace root `.env` is the frontend configuration source: explicit shell or hosting environment variables take precedence, followed by root `NEXT_PUBLIC_*`, followed by Next.js web environment files. Root public values intentionally override `apps/web/.env.local`. Keep server credentials out of all `NEXT_PUBLIC_*` variables. `FRONTEND_PORT` follows shell environment, root `.env`, then the default port.

The workflow uses SSE while connected and polls a lightweight session revision after connection failure. Full replay is fetched only when that revision changes. Permanent access/not-found errors stop polling. Trace persistence uses the same row for running and final tool steps; caught investigation failures close unfinished rows. Terminal-session displays mark any remaining running rows as interrupted. Abrupt process termination does not execute the cleanup block or automatically resume investigations.

The appearance control in the header offers Light, Dark, and Follow system. The choice is stored in the browser and applied before hydration to reduce theme flashes. The palette uses navy and indigo for the main interface, amber for counter-evidence, and violet for assessments; statuses keep their text labels in both themes.

The homepage (`/`) introduces the product, its motivation, an interactive illustrative example, how it works, and the limits of its assessments. The investigation form is at `/check`; `/history` opens account history. Both require sign-in. Illustration figures on the landing page are fictional and do not come from a live investigation.

The investigation screen offers **Summary** and **Agent workflow** views. The workflow shows recorded execution nodes in order, with click-through rationale, assessment rules, evidence, timestamps, and outcomes. Claims run sequentially. A started retrieval is persisted before execution and updated when it completes, so reconnects can rebuild an in-flight node. Polling uses the read-only `/theses/:id/event-snapshot` endpoint when SSE is unavailable. Existing sessions show their recorded completed steps; only new runs have retrieval-start events. After updating, run `pnpm build:packages` and restart the API and web servers. No database migration is needed.

The **History** tab (`/history`) reads investigations belonging to the signed-in account from PostgreSQL. Search by message or resolved ticker, filter statuses, refresh, and reopen investigations or reports. Pages contain 12 entries. Sign in on another device to access the same history.

### Accounts

Create an account at `/sign-up` with name, email, and a password of at least 10 characters; registration signs you in automatically. `/sign-in` and the header sign-out control manage subsequent sessions. Passwords are salted and hashed with scrypt. Random session tokens are held in HttpOnly cookies; only token hashes are stored in the database. Sessions expire after 7 days, and signing out revokes the current session. Authentication attempts are limited per IP in each API process.

All investigation, event stream, evidence, trace, and report endpoints check the signed-in user and ownership. Existing investigations without an owner remain stored but are not automatically assigned to new accounts. Report links require the owner's account; copied report text can still be shared. Email verification and password recovery are not implemented yet.

After pulling these changes, run `pnpm --filter @counterpoint/api db:generate` and `pnpm --filter @counterpoint/api db:push` before starting the API. Stop a running API first if Windows locks the Prisma engine DLL. Use `localhost` consistently for both web and API in local development. `WEB_ORIGIN` must match the web URL, and requests include credentials. For deployment on different sites, set `AUTH_COOKIE_SAME_SITE=none` and serve both over HTTPS; browsers that block third-party cookies require web/API hosting on the same site or an API reverse proxy. Production cookies are always Secure.

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
