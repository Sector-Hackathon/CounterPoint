# Deploying: Railway (API + Postgres) and Vercel (web)

Deploy the API first: the web app needs the API's public URL at build time.

## 1. Railway: Postgres and API

1. Go to railway.com → **New Project** → **Deploy from GitHub repo** → choose `Sector-Hackathon/CounterPoint`.
   - Railway reads `railway.json` at the repo root, which sets the build command, the start command (it runs `prisma db push` first) and the `/health` healthcheck.
   - Leave **Root Directory** empty (repo root): the API depends on the workspace packages.
2. In the same project: **New** → **Database** → **PostgreSQL**.
3. Open the API service → **Variables** and add:

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (Railway reference variable) |
   | `SECTORS_API_KEY` | your Sectors key |
   | `SECTORS_BASE_URL` | `https://api.sectors.app/v2` |
   | `LLM_PROVIDER` | `openai` |
   | `OPENAI_API_KEY` | your OpenAI key |
   | `OPENAI_MODEL` | `gpt-4.1-mini` |
   | `WEB_ORIGIN` | your Vercel URL from step 2, e.g. `https://counterpoint.vercel.app` (comma-separate several) |
   | `RATE_LIMIT_PER_HOUR` | `10` |
   | `DAILY_THESIS_CAP` | `200` |

   Don't set `PORT`: Railway provides it.
4. **Settings** → **Networking** → **Generate Domain**. Check that `https://<api-domain>/health` returns `"dataMode":"live"` and `"llm":"openai/gpt-4.1-mini"`.

## 2. Vercel: web

1. Go to vercel.com → **Add New** → **Project** → import the same repo.
2. Set **Root Directory** to `apps/web`. The framework (Next.js) and pnpm are detected automatically.
3. Under **Environment Variables**, add `NEXT_PUBLIC_API_URL` = `https://<api-domain>` from Railway. Never put secret keys in Vercel variables for this app: anything prefixed `NEXT_PUBLIC_` is visible to every visitor.
4. Deploy, then copy the production URL into Railway's `WEB_ORIGIN` (Railway redeploys automatically).

## Telegram bot (optional)

1. In Telegram, open @BotFather, send `/newbot` and pick a name and a username ending in `bot`. Keep the token secret.
2. On the Railway API service, add `TELEGRAM_BOT_TOKEN` (the production bot's token) and `PUBLIC_WEB_URL` (the Vercel URL, used for links in bot messages).
3. Keep exactly **one replica**. The bot uses long polling, and Telegram allows only one poller per token; during a redeploy the old and new instance overlap briefly, which the API logs and retries.
4. Use a **different bot** for local development. Running the same token locally and on Railway makes the two fight over updates.
5. Check: the API log says `Telegram bot @<name> is polling`, and the website's **Integrasi** page shows **Hubungkan Telegram**.

Without `TELEGRAM_BOT_TOKEN` the bot stays off and the Integrations page shows "Belum tersedia".

## 3. Smoke test

1. Open the Vercel URL, click **Use example**, then **Verify thesis**.
2. Confirm the claims appear, then click **Investigate evidence** and watch the trace fill in.
3. Open the evidence report and expand **Evidence provenance**. Locators should start with `sectors:`, not `fixture:`.

## Operating notes

- **Cost guard**: each thesis makes roughly 5–20 Sectors calls and a handful of LLM calls. The per-IP hourly limit and the global daily cap return HTTP 429 with a readable message. Raise them for judging if needed.
- **Schema changes**: the start command runs `prisma db push`, which refuses destructive changes. Handle those manually.
- **Background jobs** run inside the API process. If you redeploy mid-investigation, that session stays in `INVESTIGATING`; resubmit the thesis.
- **Freeze**: the PRD requires the app to stay frozen after submission. Turn off auto-deploys on both platforms once you submit.
