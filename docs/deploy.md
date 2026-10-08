# Deploying for free: Neon + Render + Vercel

| Part | Service | Free plan |
| --- | --- | --- |
| Postgres | Neon | Small, enough for this app. Pauses when idle and wakes on the next query. |
| API and Telegram bot | Render web service (`render.yaml`) | 512 MB, 750 hours a month. Sleeps after 15 minutes without HTTP traffic. |
| Web | Vercel | Forwards `/api/*` to Render, so the browser only talks to one site. |
| Keep the API awake | cron-job.org or UptimeRobot | Calls `/health` every 10 minutes. |

Why the forwarding: with the web on `vercel.app` and the API on `onrender.com`, the login cookie would be a third-party cookie, which Safari (every iPhone) blocks. Through `/api` it is first-party.

Order: Neon, then Render, then Vercel, then back to Render for the web URL.

## 1. Neon: the database

1. neon.tech → sign up → **Create project**. Region: **AWS Asia Pacific (Singapore)**.
2. On the project dashboard click **Connect**, turn **Connection pooling off**, and copy the connection string (`postgresql://…?sslmode=require`). This is `DATABASE_URL`. The pooled string breaks `prisma db push`.

## 2. Render: the API

1. render.com → sign up with GitHub → **New** → **Blueprint** → choose `Sector-Hackathon/CounterPoint`. Render reads `render.yaml` and creates `counterpoint-api` (free plan, Singapore).
2. It asks for the secret variables:

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | the Neon string from step 1 |
   | `SECTORS_API_KEY` | your Sectors key |
   | `OPENAI_API_KEY` | your OpenAI key |
   | `WEB_ORIGIN` | for now `https://example.com`; set it in step 4 |
   | `PUBLIC_WEB_URL` | the same; set it in step 4 |
   | `TELEGRAM_BOT_TOKEN` | a **production** bot from @BotFather (`/newbot`), not the one in your local `.env`. Leave empty to keep the bot off. |

3. **Apply**. The first build takes a few minutes. When it is live, open `https://<service>.onrender.com/health`: it should return `"dataMode":"live"` and `"llm":"openai/gpt-4.1-mini"`. Note the URL.

Keep the service at one instance (the free plan always is): Telegram allows one poller per bot token.

## 3. Vercel: the web

1. vercel.com → sign up with GitHub → **Add New** → **Project** → import the repo.
2. **Root Directory**: `apps/web`. Next.js and pnpm are detected.
3. **Environment Variables**:

   | Variable | Value |
   | --- | --- |
   | `NEXT_PUBLIC_API_URL` | `/api` |
   | `API_PROXY_TARGET` | `https://<service>.onrender.com` (no trailing slash) |

   Never put secret keys here. Both are read at build time, so redeploy after changing them.
4. **Deploy** and copy the production URL, e.g. `https://counterpoint.vercel.app`.

## 4. Render again: the web URL

In the Render service → **Environment**, set `WEB_ORIGIN` and `PUBLIC_WEB_URL` to the Vercel URL, then **Save, rebuild and deploy**. `WEB_ORIGIN` is checked on every sign-in and check, so a wrong value shows "Origin tidak diizinkan".

## 5. Keep the API awake

At cron-job.org (or UptimeRobot), create a job that opens `https://<service>.onrender.com/health` every **10 minutes**. Without it, Render puts the API to sleep after 15 quiet minutes and the Telegram bot stops answering. One service running all month uses about 744 of the 750 free hours.

## 6. Smoke test

1. Open the Vercel URL, sign up, and check a message such as "BBCA laba naik 10% tahun ini." The steps should appear live, then the result.
2. Paste a screenshot into the box: its text should appear for editing.
3. With a bot token set: the Render log shows `Telegram bot @<name> is polling`. On **Integrasi**, connect Telegram and send the bot a message.

## Operating notes

- **Cold start**: after a deploy, or if the pinger misses, the first request waits up to a minute while Render wakes the API.
- **Cost guard**: each check makes roughly 5 to 20 Sectors calls and a few LLM calls. Each signed-in account (and each Telegram account) may start `RATE_LIMIT_PER_HOUR` checks an hour, and `DAILY_THESIS_CAP` caps all checks per day. Both return HTTP 429 with a readable message.
- **Screenshots** are shrunk in the browser before upload, because Vercel limits a forwarded request body to about 4.5 MB.
- **Schema changes**: the start command runs `prisma db push`, which refuses destructive changes. Handle those manually.
- **Background jobs** run inside the API process. A check that is running during a redeploy stays unfinished; send it again.
- **Freeze**: once you submit, turn off auto-deploy on Render (**Settings** → **Auto-Deploy**) and Vercel.
