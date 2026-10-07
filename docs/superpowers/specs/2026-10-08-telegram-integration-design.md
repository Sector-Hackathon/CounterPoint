# Telegram integration — design

Date: 2026-10-08 · Branch: `feat/telegram-bot` · Status: approved in conversation, awaiting spec review

## Goal

A signed-in Counterpoint user links their Telegram account once, then sends a stock claim (text or screenshot) to the bot. The check runs on the existing API under their account, appears in their website history, and the bot replies with a per-claim scoreboard and a link to the full analysis. The website gets an Integrations page for one-tap setup, with Discord shown as "Segera hadir".

Scope is lean for the hackathon demo. Out of scope: Discord and WhatsApp bots, webhooks, English bot copy, live progress in chat.

## Architecture

The bot lives inside the existing NestJS API as `TelegramModule` (`apps/api/src/telegram/`), using **grammY** with **long polling**. No public URL is needed, so it runs the same locally and on Railway.

- It calls `ThesisService`, `InvestigationService`, `LlmService.readImageText`, `ReportsService` and `UsageLimiter` directly, never over HTTP.
- It subscribes to `EventsService` for each check it started, to learn when the report is ready.
- If `TELEGRAM_BOT_TOKEN` is unset, the module does not start the bot, and `GET /integrations` reports `telegram.configured = false`.
- Only one process may poll a token. Local dev uses its own bot (for example `@CounterpointDevBot`); Railway runs one replica with the production bot. A `409 Conflict` from `getUpdates` (overlap during a redeploy) is logged and retried with backoff, not treated as fatal.

Units:

| Unit | Responsibility |
|---|---|
| `link-codes.ts` (`LinkCodeService`) | Create a one-time code for a user; consume a code → userId. Hash-only storage, 10-minute expiry, single use. |
| `telegram-links.ts` (`TelegramLinkService`) | Find a link by Telegram user ID; link (replacing any previous link for that Telegram account or that user); unlink. |
| `bot-copy.ts` | Pure functions producing every bot message (Indonesian), including the scoreboard. No I/O. |
| `conversation.ts` (`TelegramConversation`) | Platform-neutral handler: `onStart(code?)`, `onText`, `onPhoto`, `onButton`, `onCommand`. Talks to a small `ChatPort` interface (send, edit, answer button, download file) so tests use a fake. |
| `check-watcher.ts` (`CheckWatcher`) | Given a sessionId and chat, drives the check: starts the investigation when claims are extracted, asks for ticker confirmation, sends the scoreboard on completion. Re-attaches to unfinished Telegram checks on boot. |
| `telegram.bot.ts` | grammY wiring only: maps updates to `TelegramConversation`, implements `ChatPort`, runs polling with conflict backoff. |
| `integrations.controller.ts` | Web API for the Integrations page. |

## Data model (one Prisma migration)

```prisma
model TelegramLink {
  id             String   @id @default(uuid())
  userId         String   @unique
  telegramUserId String   @unique
  chatId         String
  username       String?
  linkedAt       DateTime @default(now())
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model LinkCode {
  id        String    @id @default(uuid())
  codeHash  String    @unique
  userId    String
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
}
```

`ThesisSession` gains `source String @default("web")` (`web` | `telegram`) and `telegramChatId String?`, so the watcher can re-attach after a restart and history can show where a check came from.

Codes are 24 random bytes, base64url-encoded (fits Telegram's 64-character `start` parameter), and stored as SHA-256, the same way auth session tokens are stored.

## Account linking

1. Website → `POST /integrations/telegram/link` → `{ url: "https://t.me/<bot>?start=<code>", expiresAt }`. Creating a new code invalidates the user's earlier unused codes.
2. The user taps Start; the bot receives `/start <code>`.
3. `consume(code)`: valid if it exists, is unused and is unexpired; it is marked used in the same transaction. The bot then links the account and replies "Terhubung sebagai <name> ✅" with the menu.
4. The website polls `GET /integrations` every 3 s while waiting, and shows the linked state when it changes.

Errors: an expired or used code → "Kode kedaluwarsa atau sudah dipakai. Buat kode baru di website." with the Integrations link. `/start` without a code from an unlinked chat → a short explanation with the Integrations link. Unlink via the website (`DELETE /integrations/telegram`) or `/putuskan` in the bot. Checks made earlier stay in history.

## Conversation

- **Menu** (after linking, or on `/start` when linked): a welcome line plus the buttons **Cek klaim**, **Riwayat** and **Bantuan**.
  - **Cek klaim** prompts the user to send text or a screenshot. Any text or photo counts as a claim, button or not.
  - **Riwayat** lists the last 5 checks with a status and a link for each.
  - **Bantuan** explains in a few lines and links the website.
- **Text claim:** the same rule as the web (`trim`, 10–2000 characters). Too short → "Kirim teks lengkap postingannya, ya."
- **Photo claim:** download the largest size (≤ 4 MB) and run `readImageText`. Reply with the text it read plus **[Periksa ini]** and **[Batal]**. The pending text is held in memory per chat for 15 minutes.
- **Starting a check:**
  1. `UsageLimiter.check('tg:<telegramUserId>')`, which reuses the per-key hourly limit and the global daily cap.
  2. One active check per chat. Otherwise reply "Tunggu pemeriksaan sebelumnya selesai dulu."
  3. `ThesisService.create(text, userId, { source: 'telegram', telegramChatId })`.
  4. Reply "🔎 Memeriksa…" with **[Pantau di website ↗]** → `/t/<id>`.
  5. Hand the check to the `CheckWatcher`.
- **CheckWatcher**, on session status:
  - `CLAIMS_EXTRACTED` → `InvestigationService.start(id)` (a repeat start is ignored, so a browser opening the link at the same time is safe).
  - `AWAITING_CONFIRMATION` → for each ambiguous entity, send "Yang kamu maksud <mention>?" with up to 4 candidate-ticker buttons. A tap calls `ThesisService.confirmEntity`.
  - `report.ready`, or a final status (`COMPLETED`, `PARTIAL`) → load the latest report and send the scoreboard.
  - `FAILED` → "Pemeriksaan terhenti: <reason>" with the website link.
  - A watch is dropped after `SESSION_DEADLINE_MS` + 2 minutes, with a "cek hasilnya di website" message.
- **Scoreboard:**

  ```
  ✅ Pemeriksaan selesai — TLKM

  1. Dividen tinggi — ◐ Didukung sebagian
  2. Growth kuat — ◐ Didukung sebagian
  3. Valuasi murah — ✓ Didukung data

  [ Buka analisis lengkap ↗ ]   → <PUBLIC_WEB_URL>/t/<id>
  ```

  Claim labels are shortened to about 40 characters. Verdict labels and symbols reuse the website's Indonesian wording.
- **On boot:** find sessions with `source = 'telegram'` that are not final, and re-attach a watcher using `telegramChatId`.
- **Buttons:** every callback is answered immediately. Callback data carries `action:sessionId:value` and is checked against the linked user's ownership of that session.

## Website

- **Entry points:** an **Integrasi** link in the sidebar (under "Lihat semua riwayat") and in the account menu.
- **`/integrations` page** (inside `AppShell`, styled like History). Card states:

| Card | State | Shows |
|---|---|---|
| Telegram | Not configured | "Belum tersedia"; the button is disabled |
| Telegram | Not linked | One-line pitch, **[Hubungkan Telegram]** |
| Telegram | Waiting | Opens the `t.me` link in a new tab and shows a QR code of it (`qrcode` package), "Menunggu konfirmasi di Telegram…" and a countdown; on expiry, **[Buat kode baru]** |
| Telegram | Linked | "Terhubung sebagai @username · sejak <date>", **[Buka bot ↗]**, **[Putuskan]** (in-page confirm, no browser dialog) |
| Discord | — | Logo, one sentence, disabled "Segera hadir" |

- **History and sidebar:** a small Telegram icon on checks whose `source` is `telegram` (the history API returns `source`).
- **Copy:** new strings go through `t()` with English entries in `locale.ts`.

## API routes (all behind `AuthGuard`)

- `GET /integrations` → `{ telegram: { configured, botUsername, linked: null | { username, linkedAt } }, discord: { configured: false } }`
- `POST /integrations/telegram/link` → `{ url, expiresAt }`; `503` if not configured
- `DELETE /integrations/telegram` → `204`

## Configuration

- `TELEGRAM_BOT_TOKEN`: optional; the bot is off when unset.
- `PUBLIC_WEB_URL`: base for links in bot messages; defaults to `WEB_ORIGIN`.
- The bot username is read from `getMe` at startup, not configured by hand.
- Add both variables to `.env.example` and the environment docs.

## Testing

- **API unit tests (Vitest or the API's existing test runner):**
  - `LinkCodeService`: single use, expiry, hash-only storage, a new code invalidates old ones.
  - `bot-copy`: scoreboard formatting and truncation.
  - `TelegramConversation` with a fake `ChatPort` and fake services: unlinked user, text too short, a photo leading to confirm, the one-active-check limit, ticker buttons, completion leading to the scoreboard, failure.
  - Integrations controller: not configured, link and unlink.
- **Web:** a pure helper that derives the card state from the API response and the waiting timer.
- **End to end, locally with the dev bot:** link from the website in Chrome, send a text claim and a screenshot, confirm a ticker, receive the scoreboard, and open the link.

## Risks

- **Polling conflicts:** two processes on one token. Mitigated by separate dev and prod bots, one Railway replica, and 409 backoff.
- **In-memory pending state** (photo text awaiting confirmation) is lost on restart. Acceptable; the user re-sends the photo.
- **Shared daily cap:** Telegram checks count toward the same global daily cap as the web, by design.
