# Telegram Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A signed-in user links Telegram once, sends a stock claim (text or screenshot) to the bot, the check runs under their account and appears in website history, and the bot replies with a per-claim scoreboard plus a link; the website gets an `/integrations` page (Telegram live, Discord "Segera hadir").

**Architecture:** The bot lives inside the NestJS API. grammY long-polls Telegram. A platform-neutral `TelegramConversation` (message handling) and `CheckWatcher` (drives each check via `EventsService`) talk to Telegram through a two-method `ChatPort`, so both are unit-tested with fakes. `TelegramBot` is the only grammY-aware unit. The web adds a client page backed by three `/integrations` routes.

**Tech Stack:** NestJS 11, Prisma 6 (Postgres, `db push`, no migrations folder), grammY, rxjs, Vitest; Next.js (App Router), `qrcode`, lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-08-telegram-integration-design.md`

## Global Constraints

- The bot is off when `TELEGRAM_BOT_TOKEN` is unset; nothing else in the API may fail because of that.
- `PUBLIC_WEB_URL` defaults to the first entry of `WEB_ORIGIN`, then `http://localhost:3000`, with no trailing slash.
- Link codes: 24 random bytes, base64url, stored only as SHA-256, 10-minute expiry, single use; a new code deletes the user's unused ones.
- Claim text accepted from Telegram: trimmed, 10–2000 characters (same as `CreateThesis`).
- Photos: largest size, at most 4 MB (4 * 1024 * 1024 bytes).
- At most one watched check per chat.
- `UsageLimiter.check('tg:<telegramUserId>')` before creating a check.
- Bot copy is Indonesian only, plain text (no `parse_mode`).
- Telegram rejects URL buttons that aren't public `https` URLs, so a non-https link is written into the message text instead.
- Only private chats are handled.
- Watch timeout: 15 minutes (deviation from the spec's deadline + 2 min, because ticker confirmation waits on the user; the spec is updated in Task 9).
- Schema changes must be additive (nullable or defaulted), because Railway's start command runs `prisma db push`, which refuses destructive changes.
- Every new website string goes through `t()` with an English entry in `apps/web/lib/locale.ts`. Grep for the key first; duplicate keys are a TypeScript error.
- Commits have no Co-Authored-By trailer (user preference).

## Review Focus

1. **Ambiguous company with no candidates** (`AWAITING_CONFIRMATION` but only UNKNOWN entities): the user should be sent to the website to pick, and the bot keeps watching so the scoreboard still arrives. Covered in Task 4.
2. **Ticker button tapped after the watch timed out:** confirming must re-attach the watcher, so the investigation still starts. Covered in Task 4.
3. **Local `http://localhost` links:** must still reach the user, as text rather than an invalid button. Covered in Task 3 (`renderMessage`).
4. **A slash command the bot doesn't know** (e.g. `/foo`): must not start a paid check. Covered in Task 5.
5. **Both `report.ready` and a `COMPLETED` status arriving** (replay plus live): exactly one scoreboard. Covered in Task 4.

---

### Task 1: Schema and link-code service

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/src/telegram/link-codes.ts`
- Create: `apps/api/src/telegram/telegram-links.ts`
- Test: `apps/api/test/link-codes.test.ts`

**Interfaces:**
- Produces:
  - `LinkCodeService.create(userId: string, now?: Date): Promise<{ code: string; expiresAt: Date }>`
  - `LinkCodeService.consume(code: string, now?: Date): Promise<string | null>` (returns the userId)
  - `LINK_CODE_TTL_MS`
  - `TelegramLinkService.byTelegramUser(id: string): Promise<LinkedAccount | null>`
  - `TelegramLinkService.byUser(userId: string): Promise<{ username: string | null; linkedAt: Date } | null>`
  - `TelegramLinkService.link(userId: string, t: { telegramUserId: string; chatId: string; username: string | null }): Promise<void>`
  - `TelegramLinkService.unlinkUser(userId: string): Promise<void>`
  - `TelegramLinkService.unlinkTelegram(telegramUserId: string): Promise<void>`
  - `interface LinkedAccount { userId: string; userName: string; chatId: string; username: string | null; linkedAt: Date }`

- [ ] **Step 1: Extend the schema**

In `apps/api/prisma/schema.prisma`, add two relation fields to `model User` (after `theses ThesisSession[]`):

```prisma
  telegramLink TelegramLink?
  linkCodes    LinkCode[]
```

Add two fields and an index to `model ThesisSession` (after `userId`):

```prisma
  source         String   @default("web")
  telegramChatId String?
```

and next to the existing `@@index([userId, createdAt])`:

```prisma
  @@index([source, status])
```

Append the two new models at the end of the file:

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

- [ ] **Step 2: Push the schema and regenerate the client**

Run: `pnpm --filter @counterpoint/api db:push && pnpm --filter @counterpoint/api db:generate`
Expected: "Your database is now in sync with your Prisma schema" and "Generated Prisma Client".

- [ ] **Step 3: Write the failing test**

`apps/api/test/link-codes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { LINK_CODE_TTL_MS, LinkCodeService } from '../src/telegram/link-codes';

interface Row { codeHash: string; userId: string; expiresAt: Date; usedAt: Date | null }

/** Just enough of Prisma's linkCode delegate for the service, kept in memory. */
function fakePrisma() {
  const rows: Row[] = [];
  const matches = (r: Row, where: Record<string, unknown>) =>
    (where.codeHash === undefined || r.codeHash === where.codeHash) &&
    (where.userId === undefined || r.userId === where.userId) &&
    (!('usedAt' in where) || r.usedAt === where.usedAt) &&
    (where.expiresAt === undefined || r.expiresAt > (where.expiresAt as { gt: Date }).gt);
  const linkCode = {
    deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
      const before = rows.length;
      for (let i = rows.length - 1; i >= 0; i--) if (matches(rows[i]!, where)) rows.splice(i, 1);
      return { count: before - rows.length };
    },
    create: async ({ data }: { data: Omit<Row, 'usedAt'> }) => { rows.push({ ...data, usedAt: null }); return data; },
    updateMany: async ({ where, data }: { where: Record<string, unknown>; data: { usedAt: Date } }) => {
      const hit = rows.filter((r) => matches(r, where));
      hit.forEach((r) => (r.usedAt = data.usedAt));
      return { count: hit.length };
    },
    findUnique: async ({ where }: { where: { codeHash: string } }) => rows.find((r) => r.codeHash === where.codeHash) ?? null,
  };
  return { rows, prisma: { linkCode, $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops) } };
}

describe('LinkCodeService', () => {
  it('stores only a hash of a url-safe code that fits a Telegram start parameter', async () => {
    const { rows, prisma } = fakePrisma();
    const { code, expiresAt } = await new LinkCodeService(prisma as never).create('u1', new Date(0));
    expect(code).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(expiresAt.getTime()).toBe(LINK_CODE_TTL_MS);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.codeHash).toBe(createHash('sha256').update(code).digest('hex'));
    expect(JSON.stringify(rows)).not.toContain(code);
  });

  it('accepts a code once', async () => {
    const { prisma } = fakePrisma();
    const service = new LinkCodeService(prisma as never);
    const { code } = await service.create('u1');
    expect(await service.consume(code)).toBe('u1');
    expect(await service.consume(code)).toBeNull();
  });

  it('rejects an expired code', async () => {
    const { prisma } = fakePrisma();
    const service = new LinkCodeService(prisma as never);
    const { code } = await service.create('u1', new Date(0));
    expect(await service.consume(code, new Date(LINK_CODE_TTL_MS + 1))).toBeNull();
  });

  it('invalidates older unused codes when a new one is made', async () => {
    const { prisma } = fakePrisma();
    const service = new LinkCodeService(prisma as never);
    const first = await service.create('u1');
    const second = await service.create('u1');
    expect(await service.consume(first.code)).toBeNull();
    expect(await service.consume(second.code)).toBe('u1');
  });

  it('rejects malformed input without querying', async () => {
    const { prisma } = fakePrisma();
    expect(await new LinkCodeService(prisma as never).consume('../../etc')).toBeNull();
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `pnpm --filter @counterpoint/api exec vitest run test/link-codes.test.ts`
Expected: FAIL, "Cannot find module '../src/telegram/link-codes'".

- [ ] **Step 5: Implement both services**

`apps/api/src/telegram/link-codes.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

export const LINK_CODE_TTL_MS = 10 * 60_000;
const digest = (code: string) => createHash('sha256').update(code).digest('hex');

/** One-time codes that link a Telegram account to a signed-in user. Only hashes are stored. */
@Injectable()
export class LinkCodeService {
  constructor(private readonly prisma: PrismaService) {}

  /** A new code replaces the user's earlier unused ones. 24 bytes base64url = 32 chars, within Telegram's 64-char start parameter. */
  async create(userId: string, now = new Date()): Promise<{ code: string; expiresAt: Date }> {
    const code = randomBytes(24).toString('base64url');
    const expiresAt = new Date(now.getTime() + LINK_CODE_TTL_MS);
    await this.prisma.$transaction([
      this.prisma.linkCode.deleteMany({ where: { userId, usedAt: null } }),
      this.prisma.linkCode.create({ data: { codeHash: digest(code), userId, expiresAt } }),
    ]);
    return { code, expiresAt };
  }

  /** Marks the code used and returns its user, or null if unknown, used or expired. The conditional update makes it single-use under races. */
  async consume(code: string, now = new Date()): Promise<string | null> {
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(code)) return null;
    const codeHash = digest(code);
    const updated = await this.prisma.linkCode.updateMany({ where: { codeHash, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
    if (updated.count === 0) return null;
    const row = await this.prisma.linkCode.findUnique({ where: { codeHash } });
    return row?.userId ?? null;
  }
}
```

`apps/api/src/telegram/telegram-links.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface LinkedAccount { userId: string; userName: string; chatId: string; username: string | null; linkedAt: Date }

/** One Telegram account per user and one user per Telegram account. */
@Injectable()
export class TelegramLinkService {
  constructor(private readonly prisma: PrismaService) {}

  async byTelegramUser(telegramUserId: string): Promise<LinkedAccount | null> {
    const row = await this.prisma.telegramLink.findUnique({ where: { telegramUserId }, include: { user: { select: { name: true } } } });
    return row ? { userId: row.userId, userName: row.user.name, chatId: row.chatId, username: row.username, linkedAt: row.linkedAt } : null;
  }

  byUser(userId: string): Promise<{ username: string | null; linkedAt: Date } | null> {
    return this.prisma.telegramLink.findUnique({ where: { userId }, select: { username: true, linkedAt: true } });
  }

  /** Replaces any earlier link on either side. */
  async link(userId: string, telegram: { telegramUserId: string; chatId: string; username: string | null }): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.telegramLink.deleteMany({ where: { OR: [{ userId }, { telegramUserId: telegram.telegramUserId }] } }),
      this.prisma.telegramLink.create({ data: { userId, ...telegram } }),
    ]);
  }

  async unlinkUser(userId: string): Promise<void> {
    await this.prisma.telegramLink.deleteMany({ where: { userId } });
  }

  async unlinkTelegram(telegramUserId: string): Promise<void> {
    await this.prisma.telegramLink.deleteMany({ where: { telegramUserId } });
  }
}
```

- [ ] **Step 6: Run the test and the typecheck**

Run: `pnpm --filter @counterpoint/api exec vitest run test/link-codes.test.ts && pnpm --filter @counterpoint/api exec tsc --noEmit -p .`
Expected: 5 passed; the typecheck prints nothing.

- [ ] **Step 7: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/src/telegram/link-codes.ts apps/api/src/telegram/telegram-links.ts apps/api/test/link-codes.test.ts
git commit -m "feat(api): Telegram link codes and account links"
```

---

### Task 2: Record where a check came from

**Files:**
- Modify: `apps/api/src/thesis/thesis.service.ts` (`create` at ~29-35; `history` at ~37-51)
- Modify: `apps/web/lib/api.ts:212` (`HistoryEntry`)

**Interfaces:**
- Produces:
  - `ThesisService.create(rawThesis: string, userId?: string, origin?: { source?: 'web' | 'telegram'; telegramChatId?: string }): Promise<ThesisSession>`
  - history items gain `source: string`
  - `HistoryEntry.source?: string` on the web

- [ ] **Step 1: Change `create`**

Replace the `create` method in `apps/api/src/thesis/thesis.service.ts`:

```ts
  async create(rawThesis: string, userId?: string, origin: { source?: 'web' | 'telegram'; telegramChatId?: string } = {}) {
    const session = await this.prisma.thesisSession.create({
      data: { rawThesis, status: 'CREATED', dataMode: this.dataMode, userId, source: origin.source ?? 'web', telegramChatId: origin.telegramChatId ?? null },
    });
    void this.analyze(session.id, rawThesis);
    return session;
  }
```

- [ ] **Step 2: Return `source` from history**

In `history`, add `source: true` to the `select`, and `source: row.source` to the mapped item (after `status: row.status`).

- [ ] **Step 3: Add the field on the web**

In `apps/web/lib/api.ts`:

```ts
export interface HistoryEntry { id: string; text: string; createdAt: string; status: string; reportId: string | null; tickers: string[]; source?: string }
```

- [ ] **Step 4: Verify**

Run: `pnpm --filter @counterpoint/api exec tsc --noEmit -p . && pnpm --filter @counterpoint/api test && pnpm --filter @counterpoint/web exec tsc --noEmit -p .`
Expected: both typechecks are clean, and the API tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/thesis/thesis.service.ts apps/web/lib/api.ts
git commit -m "feat(api): record whether a check came from the web or Telegram"
```

---

### Task 3: Bot copy and message rendering

**Files:**
- Create: `apps/api/src/telegram/bot-copy.ts`
- Test: `apps/api/test/bot-copy.test.ts`

**Interfaces:**
- Produces:
  - `interface Button { text: string; data?: string; url?: string }`
  - `interface ChatPort { send(chatId: string, text: string, buttons?: Button[][]): Promise<void>; downloadPhoto(fileId: string): Promise<{ base64: string; mimeType: 'image/jpeg' }> }`
  - `interface ScoreLine { text: string; assessment: string | null }`
  - `scoreboard(input: { tickers: string[]; status: string; claims: ScoreLine[] }): string`
  - `shorten(text: string, max?: number): string`
  - `renderMessage(text: string, buttons: Button[][]): { text: string; keyboard: ({ text: string; callback_data: string } | { text: string; url: string })[][] }`
  - `historyList(items: { id: string; text: string; status: string }[], webUrl: string): string`
  - `COPY` (all fixed bot strings)
  - `MENU: Button[][]`

- [ ] **Step 1: Write the failing test**

`apps/api/test/bot-copy.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { historyList, renderMessage, scoreboard, shorten } from '../src/telegram/bot-copy';

describe('scoreboard', () => {
  it('lists each claim with its verdict under the ticker', () => {
    expect(scoreboard({
      tickers: ['TLKM'],
      status: 'COMPLETED',
      claims: [
        { text: 'Dividen tinggi', assessment: 'PARTIALLY_SUPPORTED' },
        { text: 'Valuasi murah', assessment: 'SUPPORTED' },
      ],
    })).toBe('✅ Pemeriksaan selesai — TLKM\n\n1. Dividen tinggi — ◐ Didukung sebagian\n2. Valuasi murah — ✓ Didukung data');
  });

  it('marks a partial run and treats a missing verdict as unverifiable', () => {
    const text = scoreboard({ tickers: [], status: 'PARTIAL', claims: [{ text: 'Growth kuat', assessment: null }] });
    expect(text).toBe('⚠️ Pemeriksaan selesai sebagian\n\n1. Growth kuat — ? Belum bisa diverifikasi');
  });

  it('says so when there was nothing to check', () => {
    expect(scoreboard({ tickers: ['BBCA'], status: 'COMPLETED', claims: [] })).toContain('Tidak ada klaim');
  });
});

describe('shorten', () => {
  it('cuts long claims to the limit with an ellipsis and collapses whitespace', () => {
    expect(shorten('a'.repeat(50))).toBe(`${'a'.repeat(39)}…`);
    expect(shorten('  dua\n baris ')).toBe('dua baris');
  });
});

describe('renderMessage', () => {
  it('keeps https links and callbacks as buttons', () => {
    const out = renderMessage('Hai', [[{ text: 'Buka', url: 'https://counterpoint.app/t/1' }, { text: 'Cek', data: 'menu:check' }]]);
    expect(out.text).toBe('Hai');
    expect(out.keyboard).toEqual([[{ text: 'Buka', url: 'https://counterpoint.app/t/1' }, { text: 'Cek', callback_data: 'menu:check' }]]);
  });

  it('moves links Telegram would reject into the text', () => {
    const out = renderMessage('Hai', [[{ text: 'Buka', url: 'http://localhost:3000/t/1' }]]);
    expect(out.text).toBe('Hai\n\nBuka: http://localhost:3000/t/1');
    expect(out.keyboard).toEqual([]);
  });
});

describe('historyList', () => {
  it('shows status and link per check', () => {
    expect(historyList([{ id: 'a', text: 'TLKM dividen tinggi', status: 'COMPLETED' }], 'https://x.app'))
      .toBe('Pemeriksaan terakhir:\n\n1. TLKM dividen tinggi — Selesai\nhttps://x.app/t/a');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @counterpoint/api exec vitest run test/bot-copy.test.ts`
Expected: FAIL, "Cannot find module '../src/telegram/bot-copy'".

- [ ] **Step 3: Implement**

`apps/api/src/telegram/bot-copy.ts`:

```ts
/** Everything the Telegram bot says, as pure functions. Indonesian only; sent as plain text. */

export interface Button { text: string; data?: string; url?: string }

/** The only things the conversation needs from Telegram; tests use a fake. */
export interface ChatPort {
  send(chatId: string, text: string, buttons?: Button[][]): Promise<void>;
  downloadPhoto(fileId: string): Promise<{ base64: string; mimeType: 'image/jpeg' }>;
}

export interface ScoreLine { text: string; assessment: string | null }

const VERDICT: Record<string, { mark: string; text: string }> = {
  SUPPORTED: { mark: '✓', text: 'Didukung data' },
  PARTIALLY_SUPPORTED: { mark: '◐', text: 'Didukung sebagian' },
  NOT_SUPPORTED: { mark: '✗', text: 'Tidak didukung data' },
  UNVERIFIABLE: { mark: '?', text: 'Belum bisa diverifikasi' },
};

const STATUS: Record<string, string> = { COMPLETED: 'Selesai', PARTIAL: 'Selesai sebagian', FAILED: 'Terhenti' };

export function shorten(text: string, max = 40): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`;
}

export function scoreboard(input: { tickers: string[]; status: string; claims: ScoreLine[] }): string {
  const head = input.status === 'PARTIAL' ? '⚠️ Pemeriksaan selesai sebagian' : '✅ Pemeriksaan selesai';
  const who = input.tickers.length ? ` — ${input.tickers.join(', ')}` : '';
  const lines = input.claims.map((c, i) => {
    const v = VERDICT[c.assessment ?? 'UNVERIFIABLE'] ?? VERDICT.UNVERIFIABLE!;
    return `${i + 1}. ${shorten(c.text)} — ${v.mark} ${v.text}`;
  });
  return [`${head}${who}`, '', ...(lines.length ? lines : ['Tidak ada klaim yang bisa diperiksa dari pesan ini.'])].join('\n');
}

export function historyList(items: { id: string; text: string; status: string }[], webUrl: string): string {
  if (!items.length) return 'Belum ada pemeriksaan. Kirim teks postingan saham untuk mulai.';
  const lines = items.map((item, i) => `${i + 1}. ${shorten(item.text)} — ${STATUS[item.status] ?? 'Sedang diperiksa'}\n${webUrl}/t/${item.id}`);
  return ['Pemeriksaan terakhir:', '', ...lines].join('\n');
}

type Key = { text: string; callback_data: string } | { text: string; url: string };

/** Telegram rejects URL buttons that aren't public https links, so those links go into the text instead. */
export function renderMessage(text: string, buttons: Button[][]): { text: string; keyboard: Key[][] } {
  const extra: string[] = [];
  const keyboard = buttons
    .map((row) => row.flatMap((b): Key[] => {
      if (b.url) {
        if (/^https:\/\/(?!localhost|127\.)/.test(b.url)) return [{ text: b.text, url: b.url }];
        extra.push(`${b.text}: ${b.url}`);
        return [];
      }
      return b.data ? [{ text: b.text, callback_data: b.data }] : [];
    }))
    .filter((row) => row.length > 0);
  return { text: extra.length ? `${text}\n\n${extra.join('\n')}` : text, keyboard };
}

export const MENU: Button[][] = [[
  { text: 'Cek klaim', data: 'menu:check' },
  { text: 'Riwayat', data: 'menu:history' },
  { text: 'Bantuan', data: 'menu:help' },
]];

export const COPY = {
  welcome: (name: string) => `Halo ${name}! Kirim teks postingan saham atau screenshot-nya. Aku periksa setiap klaimnya dengan data Sectors, lalu kirim hasilnya ke sini.`,
  linked: (name: string) => `Terhubung sebagai ${name} ✅`,
  codeInvalid: 'Kode kedaluwarsa atau sudah dipakai. Buat kode baru di website.',
  notLinked: 'Akun Telegram ini belum terhubung ke Counterpoint. Hubungkan dulu dari halaman Integrasi di website.',
  askClaim: 'Kirim teks postingan saham atau screenshot-nya.',
  tooShort: 'Kirim teks lengkap postingannya, ya. Minimal 10 karakter.',
  tooLong: 'Pesannya terlalu panjang. Maksimal 2000 karakter.',
  busy: 'Tunggu pemeriksaan sebelumnya selesai dulu.',
  rateLimited: 'Batas pemeriksaan tercapai. Coba lagi nanti.',
  startFailed: 'Pemeriksaan belum bisa dimulai. Coba lagi sebentar lagi.',
  checking: '🔎 Memeriksa… Hasilnya aku kirim ke sini begitu selesai.',
  readingImage: 'Membaca screenshot…',
  imageRead: (text: string) => `Teks yang terbaca:\n\n${text}\n\nPeriksa teks ini?`,
  imageFailed: 'Screenshot tidak bisa dibaca. Coba kirim teksnya langsung.',
  imageTooLarge: 'Gambarnya terlalu besar. Maksimal 4 MB.',
  noPending: 'Teks ini sudah tidak tersedia. Kirim ulang screenshot-nya.',
  cancelled: 'Dibatalkan.',
  whichTicker: (mention: string) => `Yang kamu maksud "${mention}" yang mana?`,
  pickOnWeb: 'Aku belum yakin saham mana yang dimaksud. Pilih sahamnya di website, nanti hasilnya tetap aku kirim ke sini.',
  chosen: (ticker: string) => `Dipilih: ${ticker}. Melanjutkan pemeriksaan…`,
  choiceExpired: 'Pilihan ini sudah tidak berlaku.',
  failed: (reason: string | null) => `Pemeriksaan terhenti${reason ? `: ${reason}` : '.'}`,
  timedOut: 'Pemeriksaan ini makan waktu lebih lama dari biasanya. Cek hasilnya di website.',
  unlinked: 'Telegram sudah diputuskan dari akun Counterpoint-mu. Pemeriksaan sebelumnya tetap ada di riwayat website.',
  help: 'Cara pakai:\n1. Kirim teks postingan saham atau screenshot-nya.\n2. Aku pecah jadi klaim-klaim dan memeriksa masing-masing dengan data Sectors.\n3. Hasilnya aku kirim ke sini, lengkap dengan tautan ke analisis di website.\n\nPerintah: /riwayat, /putuskan, /bantuan\n\nInformasi ini bukan rekomendasi beli, jual, atau tahan saham.',
} as const;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @counterpoint/api exec vitest run test/bot-copy.test.ts`
Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/telegram/bot-copy.ts apps/api/test/bot-copy.test.ts
git commit -m "feat(api): Telegram bot copy, scoreboard and message rendering"
```

---

### Task 4: CheckWatcher

**Files:**
- Create: `apps/api/src/telegram/check-watcher.ts`
- Test: `apps/api/test/check-watcher.test.ts`

**Interfaces:**
- Consumes: `ChatPort`, `Button`, `ScoreLine`, `scoreboard`, `COPY` (Task 3); `SessionEvent` from `apps/api/src/events/events.types.ts`.
- Produces:
  - `interface PendingEntity { id: string; mention: string; candidates: { ticker: string; name: string }[] }`
  - `interface WatchedSessions { ambiguous(id): Promise<PendingEntity[]>; confirm(id, entityId, ticker): Promise<void>; startInvestigation(id): Promise<boolean>; scoreboard(id): Promise<{ tickers: string[]; status: string; claims: ScoreLine[] }>; unfinishedTelegram(): Promise<{ id: string; telegramChatId: string }[]> }`
  - `class CheckWatcher { constructor(deps: WatcherDeps); watch(sessionId: string, chatId: string): void; isBusy(chatId: string): boolean; choose(chatId: string, data: string): Promise<void>; resume(): Promise<void>; stopAll(): void }`
  - `WATCH_TIMEOUT_MS = 15 * 60_000`

- [ ] **Step 1: Write the failing test**

`apps/api/test/check-watcher.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Subject } from 'rxjs';
import { CheckWatcher, type PendingEntity } from '../src/telegram/check-watcher';
import type { Button } from '../src/telegram/bot-copy';
import type { SessionEvent } from '../src/events/events.types';

const flush = () => new Promise((r) => setTimeout(r, 0));

function setup(opts: { entities?: PendingEntity[]; timeoutMs?: number } = {}) {
  const streams = new Map<string, Subject<{ data: SessionEvent }>>();
  const sent: { chatId: string; text: string; buttons: Button[][] }[] = [];
  const started: string[] = [];
  const confirmed: string[] = [];
  const watcher = new CheckWatcher({
    port: { send: async (chatId, text, buttons = []) => { sent.push({ chatId, text, buttons }); }, downloadPhoto: async () => { throw new Error('unused'); } },
    events: { stream: (id) => { const s = new Subject<{ data: SessionEvent }>(); streams.set(id, s); return s; } },
    sessions: {
      ambiguous: async () => opts.entities ?? [{ id: 'ent-1', mention: 'BCA', candidates: [{ ticker: 'BBCA', name: 'Bank Central Asia' }, { ticker: 'BACA', name: 'Bank Capital' }] }],
      confirm: async (_id, _entity, ticker) => { confirmed.push(ticker); },
      startInvestigation: async (id) => { started.push(id); return true; },
      scoreboard: async () => ({ tickers: ['TLKM'], status: 'COMPLETED', claims: [{ text: 'Dividen tinggi', assessment: 'PARTIALLY_SUPPORTED' }] }),
      unfinishedTelegram: async () => [{ id: 'old', telegramChatId: '7' }],
    },
    webUrl: 'https://counterpoint.app',
    timeoutMs: opts.timeoutMs ?? 60_000,
  });
  const status = (id: string, value: string, error: string | null = null) =>
    streams.get(id)!.next({ data: { id: `status:${value}`, type: 'session.status', status: value, error } });
  const reportReady = (id: string) => streams.get(id)!.next({ data: { id: 'report', type: 'report.ready', reportId: 'r1' } });
  return { watcher, sent, started, confirmed, status, reportReady, streams };
}

describe('CheckWatcher', () => {
  it('starts the investigation once claims are extracted', async () => {
    const t = setup();
    t.watcher.watch('s1', '42');
    t.status('s1', 'CLAIMS_EXTRACTED');
    await flush();
    expect(t.started).toEqual(['s1']);
    expect(t.watcher.isBusy('42')).toBe(true);
  });

  it('asks which ticker with buttons and confirms the one tapped', async () => {
    const t = setup();
    t.watcher.watch('s1', '42');
    t.status('s1', 'AWAITING_CONFIRMATION');
    await flush();
    const prompt = t.sent.at(-1)!;
    expect(prompt.text).toContain('"BCA"');
    expect(prompt.buttons.flat().map((b) => b.text)).toEqual(['BBCA · Bank Central Asia', 'BACA · Bank Capital']);
    await t.watcher.choose('42', prompt.buttons[0]![0]!.data!);
    expect(t.confirmed).toEqual(['BBCA']);
    expect(t.sent.at(-1)!.text).toContain('Dipilih: BBCA');
  });

  it('ignores a ticker choice from another chat', async () => {
    const t = setup();
    t.watcher.watch('s1', '42');
    t.status('s1', 'AWAITING_CONFIRMATION');
    await flush();
    await t.watcher.choose('99', t.sent.at(-1)!.buttons[0]![0]!.data!);
    expect(t.confirmed).toEqual([]);
    expect(t.sent.at(-1)!.text).toContain('tidak berlaku');
  });

  it('sends the user to the website when no candidates are known, and keeps watching', async () => {
    const t = setup({ entities: [{ id: 'ent-1', mention: 'XYZ', candidates: [] }] });
    t.watcher.watch('s1', '42');
    t.status('s1', 'AWAITING_CONFIRMATION');
    await flush();
    expect(t.sent.at(-1)!.text).toContain('Pilih sahamnya di website');
    expect(t.sent.at(-1)!.buttons.flat()[0]!.url).toBe('https://counterpoint.app/t/s1');
    expect(t.watcher.isBusy('42')).toBe(true);
  });

  it('sends one scoreboard with a link when the check completes, then frees the chat', async () => {
    const t = setup();
    t.watcher.watch('s1', '42');
    t.reportReady('s1');
    t.status('s1', 'COMPLETED');
    await flush();
    const boards = t.sent.filter((m) => m.text.startsWith('✅'));
    expect(boards).toHaveLength(1);
    expect(boards[0]!.buttons.flat()[0]!.url).toBe('https://counterpoint.app/t/s1');
    expect(t.watcher.isBusy('42')).toBe(false);
  });

  it('reports a failure with its reason', async () => {
    const t = setup();
    t.watcher.watch('s1', '42');
    t.status('s1', 'FAILED', 'Sectors tidak merespons');
    await flush();
    expect(t.sent.at(-1)!.text).toBe('Pemeriksaan terhenti: Sectors tidak merespons');
    expect(t.watcher.isBusy('42')).toBe(false);
  });

  it('gives up after the timeout and points to the website', async () => {
    const t = setup({ timeoutMs: 5 });
    t.watcher.watch('s1', '42');
    await new Promise((r) => setTimeout(r, 20));
    expect(t.sent.at(-1)!.text).toContain('Cek hasilnya di website');
    expect(t.watcher.isBusy('42')).toBe(false);
  });

  it('re-attaches when a ticker is chosen after the watch timed out', async () => {
    const t = setup({ timeoutMs: 5 });
    t.watcher.watch('s1', '42');
    t.status('s1', 'AWAITING_CONFIRMATION');
    await flush();
    const data = t.sent.at(-1)!.buttons[0]![0]!.data!;
    await new Promise((r) => setTimeout(r, 20));
    expect(t.watcher.isBusy('42')).toBe(false);
    await t.watcher.choose('42', data);
    expect(t.watcher.isBusy('42')).toBe(true);
  });

  it('re-attaches to unfinished Telegram checks on boot', async () => {
    const t = setup();
    await t.watcher.resume();
    expect(t.watcher.isBusy('7')).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @counterpoint/api exec vitest run test/check-watcher.test.ts`
Expected: FAIL, "Cannot find module '../src/telegram/check-watcher'".

- [ ] **Step 3: Implement**

`apps/api/src/telegram/check-watcher.ts`:

```ts
import { Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { Observable, Subscription } from 'rxjs';
import type { SessionEvent } from '../events/events.types';
import { COPY, scoreboard, type Button, type ChatPort, type ScoreLine } from './bot-copy';

export const WATCH_TIMEOUT_MS = 15 * 60_000;
const FINAL_OK = new Set(['COMPLETED', 'PARTIAL']);

export interface PendingEntity { id: string; mention: string; candidates: { ticker: string; name: string }[] }

export interface WatchedSessions {
  ambiguous(sessionId: string): Promise<PendingEntity[]>;
  confirm(sessionId: string, entityId: string, ticker: string): Promise<void>;
  startInvestigation(sessionId: string): Promise<boolean>;
  scoreboard(sessionId: string): Promise<{ tickers: string[]; status: string; claims: ScoreLine[] }>;
  unfinishedTelegram(): Promise<{ id: string; telegramChatId: string }[]>;
}

export interface WatcherDeps {
  port: ChatPort;
  events: { stream(sessionId: string): Observable<{ data: SessionEvent }> };
  sessions: WatchedSessions;
  webUrl: string;
  timeoutMs: number;
}

interface Watch { sessionId: string; chatId: string; sub: Subscription | null; timer: NodeJS.Timeout; done: boolean; prompted: boolean }
interface Prompt { sessionId: string; chatId: string; entityId: string; tickers: string[] }

/** Follows each check started from Telegram, from extraction to the scoreboard. One watch per chat. */
export class CheckWatcher {
  private readonly logger = new Logger(CheckWatcher.name);
  private readonly byChat = new Map<string, Watch>();
  private readonly prompts = new Map<string, Prompt>();

  constructor(private readonly deps: WatcherDeps) {}

  isBusy(chatId: string): boolean {
    return this.byChat.has(chatId);
  }

  watch(sessionId: string, chatId: string): void {
    if (this.byChat.get(chatId)?.sessionId === sessionId) return;
    const watch: Watch = { sessionId, chatId, sub: null, done: false, prompted: false, timer: setTimeout(() => void this.finish(watch, 'timeout'), this.deps.timeoutMs) };
    this.byChat.set(chatId, watch);
    watch.sub = this.deps.events.stream(sessionId).subscribe({
      next: ({ data }) => void this.onEvent(watch, data).catch((err: Error) => this.logger.error(`watch ${sessionId}: ${err.message}`)),
      error: (err: Error) => { this.logger.warn(`event stream for ${sessionId} ended: ${err.message}`); void this.finish(watch, 'quiet'); },
    });
  }

  /** Handles a `tk:<promptId>:<index>` button. Re-attaches the watch, so the investigation still starts after a timeout. */
  async choose(chatId: string, data: string): Promise<void> {
    const [, promptId, index] = data.split(':');
    const prompt = promptId ? this.prompts.get(promptId) : undefined;
    const ticker = prompt?.tickers[Number(index)];
    if (!prompt || prompt.chatId !== chatId || !ticker) {
      await this.deps.port.send(chatId, COPY.choiceExpired);
      return;
    }
    this.prompts.delete(promptId!);
    await this.deps.sessions.confirm(prompt.sessionId, prompt.entityId, ticker);
    await this.deps.port.send(chatId, COPY.chosen(ticker));
    this.watch(prompt.sessionId, chatId);
  }

  async resume(): Promise<void> {
    for (const row of await this.deps.sessions.unfinishedTelegram()) this.watch(row.id, row.telegramChatId);
  }

  stopAll(): void {
    for (const watch of [...this.byChat.values()]) void this.finish(watch, 'quiet');
  }

  private link(sessionId: string): Button[][] {
    return [[{ text: 'Buka analisis lengkap ↗', url: `${this.deps.webUrl}/t/${sessionId}` }]];
  }

  private async onEvent(watch: Watch, event: SessionEvent): Promise<void> {
    if (watch.done) return;
    if (event.type === 'report.ready') return this.finish(watch, 'ok');
    if (event.type !== 'session.status') return;
    if (event.status === 'CLAIMS_EXTRACTED') {
      await this.deps.sessions.startInvestigation(watch.sessionId);
    } else if (event.status === 'AWAITING_CONFIRMATION' && !watch.prompted) {
      watch.prompted = true;
      await this.askTicker(watch);
    } else if (FINAL_OK.has(event.status)) {
      await this.finish(watch, 'ok');
    } else if (event.status === 'FAILED') {
      await this.finish(watch, 'failed', event.error);
    }
  }

  private async askTicker(watch: Watch): Promise<void> {
    const entities = (await this.deps.sessions.ambiguous(watch.sessionId)).filter((e) => e.candidates.length > 0);
    if (!entities.length) {
      await this.deps.port.send(watch.chatId, COPY.pickOnWeb, [[{ text: 'Pilih di website ↗', url: `${this.deps.webUrl}/t/${watch.sessionId}` }]]);
      return;
    }
    for (const entity of entities) {
      const promptId = randomBytes(6).toString('base64url');
      const tickers = entity.candidates.slice(0, 4).map((c) => c.ticker);
      this.prompts.set(promptId, { sessionId: watch.sessionId, chatId: watch.chatId, entityId: entity.id, tickers });
      const buttons = entity.candidates.slice(0, 4).map((c, i) => [{ text: `${c.ticker} · ${c.name}`, data: `tk:${promptId}:${i}` }]);
      await this.deps.port.send(watch.chatId, COPY.whichTicker(entity.mention), buttons);
    }
  }

  private async finish(watch: Watch, outcome: 'ok' | 'failed' | 'timeout' | 'quiet', reason: string | null = null): Promise<void> {
    if (watch.done) return;
    watch.done = true;
    clearTimeout(watch.timer);
    watch.sub?.unsubscribe();
    if (this.byChat.get(watch.chatId) === watch) this.byChat.delete(watch.chatId);
    if (outcome === 'ok') {
      await this.deps.port.send(watch.chatId, scoreboard(await this.deps.sessions.scoreboard(watch.sessionId)), this.link(watch.sessionId));
    } else if (outcome === 'failed') {
      await this.deps.port.send(watch.chatId, COPY.failed(reason), this.link(watch.sessionId));
    } else if (outcome === 'timeout') {
      await this.deps.port.send(watch.chatId, COPY.timedOut, this.link(watch.sessionId));
    }
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @counterpoint/api exec vitest run test/check-watcher.test.ts`
Expected: 9 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/telegram/check-watcher.ts apps/api/test/check-watcher.test.ts
git commit -m "feat(api): watcher that drives Telegram checks to a scoreboard"
```

---

### Task 5: TelegramConversation

**Files:**
- Create: `apps/api/src/telegram/conversation.ts`
- Test: `apps/api/test/conversation.test.ts`

**Interfaces:**
- Consumes: `ChatPort`, `Button`, `COPY`, `MENU`, `historyList` (Task 3); `LinkedAccount` (Task 1); `CheckWatcher`'s `isBusy`, `watch` and `choose` (Task 4).
- Produces:
  - `interface Sender { telegramUserId: string; chatId: string; username: string | null }`
  - `class RateLimitedError extends Error`
  - `interface Checks { start(text, userId, chatId, limiterKey): Promise<string>; readImage(base64, mimeType): Promise<string>; recent(userId): Promise<{ id: string; text: string; status: string }[]> }`
  - `class TelegramConversation` with `onStart(from, payload?)`, `onText(from, text)`, `onPhoto(from, fileId, size)`, `onButton(from, data)`, `onUnlink(from)`, `onHistory(from)`, `onHelp(from)`
  - `MAX_PHOTO_BYTES`

- [ ] **Step 1: Write the failing test**

`apps/api/test/conversation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { RateLimitedError, TelegramConversation, type Sender } from '../src/telegram/conversation';
import type { Button } from '../src/telegram/bot-copy';

const me: Sender = { telegramUserId: '42', chatId: '42', username: 'farrel' };
const CLAIM = 'BBCA growth kuat dan dividennya stabil, layak dikoleksi.';

function setup(opts: { linked?: boolean; busy?: boolean; startError?: Error; imageText?: string } = {}) {
  const sent: { text: string; buttons: Button[][] }[] = [];
  let linked = opts.linked ?? true;
  const started: string[] = [];
  const watched: string[] = [];
  const chosen: string[] = [];
  const convo = new TelegramConversation({
    port: { send: async (_chat, text, buttons = []) => { sent.push({ text, buttons }); }, downloadPhoto: async () => ({ base64: 'aGk=', mimeType: 'image/jpeg' }) },
    codes: { consume: async (code) => (code === 'good-code-0123456789' ? 'user-1' : null) },
    links: {
      byTelegramUser: async () => (linked ? { userId: 'user-1', userName: 'Farrel', chatId: '42', username: 'farrel', linkedAt: new Date() } : null),
      link: async () => { linked = true; },
      unlinkTelegram: async () => { linked = false; },
    },
    checks: {
      start: async (text) => { if (opts.startError) throw opts.startError; started.push(text); return 'sess-1'; },
      readImage: async () => opts.imageText ?? CLAIM,
      recent: async () => [{ id: 'sess-0', text: 'TLKM dividen tinggi', status: 'COMPLETED' }],
    },
    watcher: { isBusy: () => opts.busy ?? false, watch: (id) => { watched.push(id); }, choose: async (_chat, data) => { chosen.push(data); } },
    webUrl: 'https://counterpoint.app',
  });
  return { convo, sent, started, watched, chosen, last: () => sent.at(-1)!, isLinked: () => linked };
}

describe('TelegramConversation', () => {
  it('links the account from a valid start code and shows the menu', async () => {
    const t = setup({ linked: false });
    await t.convo.onStart(me, 'good-code-0123456789');
    expect(t.isLinked()).toBe(true);
    expect(t.sent[0]!.text).toBe('Terhubung sebagai Farrel ✅');
    expect(t.last().buttons.flat().map((b) => b.data)).toEqual(['menu:check', 'menu:history', 'menu:help']);
  });

  it('rejects an unknown or expired code', async () => {
    const t = setup({ linked: false });
    await t.convo.onStart(me, 'stale-code-0123456789');
    expect(t.isLinked()).toBe(false);
    expect(t.last().text).toContain('kedaluwarsa');
  });

  it('tells an unlinked chat to link first and never starts a check', async () => {
    const t = setup({ linked: false });
    await t.convo.onText(me, CLAIM);
    expect(t.started).toEqual([]);
    expect(t.last().text).toContain('belum terhubung');
    expect(t.last().buttons.flat()[0]!.url).toBe('https://counterpoint.app/integrations');
  });

  it('starts a check from text, links to it and hands it to the watcher', async () => {
    const t = setup();
    await t.convo.onText(me, `  ${CLAIM}  `);
    expect(t.started).toEqual([CLAIM]);
    expect(t.watched).toEqual(['sess-1']);
    expect(t.last().buttons.flat()[0]!.url).toBe('https://counterpoint.app/t/sess-1');
  });

  it('rejects text outside 10 to 2000 characters', async () => {
    const t = setup();
    await t.convo.onText(me, 'BBCA naik');
    expect(t.last().text).toContain('Minimal 10');
    await t.convo.onText(me, 'x'.repeat(2001));
    expect(t.last().text).toContain('Maksimal 2000');
    expect(t.started).toEqual([]);
  });

  it('allows one running check per chat', async () => {
    const t = setup({ busy: true });
    await t.convo.onText(me, CLAIM);
    expect(t.started).toEqual([]);
    expect(t.last().text).toContain('Tunggu');
  });

  it('explains the rate limit', async () => {
    const t = setup({ startError: new RateLimitedError() });
    await t.convo.onText(me, CLAIM);
    expect(t.last().text).toContain('Batas pemeriksaan');
  });

  it('answers an unknown command with help instead of starting a check', async () => {
    const t = setup();
    await t.convo.onText(me, '/apaini sesuatu yang panjang sekali');
    expect(t.started).toEqual([]);
    expect(t.last().text).toContain('Cara pakai');
  });

  it('reads a screenshot and checks the text only after confirmation', async () => {
    const t = setup();
    await t.convo.onPhoto(me, 'file-1', 200_000);
    expect(t.started).toEqual([]);
    expect(t.last().text).toContain(CLAIM);
    await t.convo.onButton(me, 'img:go');
    expect(t.started).toEqual([CLAIM]);
    await t.convo.onButton(me, 'img:go');
    expect(t.last().text).toContain('sudah tidak tersedia');
  });

  it('drops the screenshot text on cancel', async () => {
    const t = setup();
    await t.convo.onPhoto(me, 'file-1', 200_000);
    await t.convo.onButton(me, 'img:x');
    expect(t.last().text).toBe('Dibatalkan.');
    await t.convo.onButton(me, 'img:go');
    expect(t.started).toEqual([]);
  });

  it('refuses photos over 4 MB without downloading them', async () => {
    const t = setup();
    await t.convo.onPhoto(me, 'file-1', 5 * 1024 * 1024);
    expect(t.last().text).toContain('terlalu besar');
  });

  it('passes ticker buttons to the watcher', async () => {
    const t = setup();
    await t.convo.onButton(me, 'tk:abc:1');
    expect(t.chosen).toEqual(['tk:abc:1']);
  });

  it('unlinks with /putuskan', async () => {
    const t = setup();
    await t.convo.onUnlink(me);
    expect(t.isLinked()).toBe(false);
    expect(t.last().text).toContain('diputuskan');
  });

  it('lists recent checks', async () => {
    const t = setup();
    await t.convo.onButton(me, 'menu:history');
    expect(t.last().text).toContain('https://counterpoint.app/t/sess-0');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @counterpoint/api exec vitest run test/conversation.test.ts`
Expected: FAIL, "Cannot find module '../src/telegram/conversation'".

- [ ] **Step 3: Implement**

`apps/api/src/telegram/conversation.ts`:

```ts
import { Logger } from '@nestjs/common';
import { COPY, MENU, historyList, type Button, type ChatPort } from './bot-copy';
import type { LinkedAccount } from './telegram-links';

export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const PENDING_TTL_MS = 15 * 60_000;

export interface Sender { telegramUserId: string; chatId: string; username: string | null }

export class RateLimitedError extends Error {
  constructor() { super('rate limited'); this.name = 'RateLimitedError'; }
}

export interface Checks {
  /** Applies the usage limit and creates the check; throws RateLimitedError when over the limit. Returns the session id. */
  start(text: string, userId: string, chatId: string, limiterKey: string): Promise<string>;
  readImage(base64: string, mimeType: string): Promise<string>;
  recent(userId: string): Promise<{ id: string; text: string; status: string }[]>;
}

export interface ConversationDeps {
  port: ChatPort;
  codes: { consume(code: string): Promise<string | null> };
  links: {
    byTelegramUser(telegramUserId: string): Promise<LinkedAccount | null>;
    link(userId: string, telegram: { telegramUserId: string; chatId: string; username: string | null }): Promise<void>;
    unlinkTelegram(telegramUserId: string): Promise<void>;
  };
  checks: Checks;
  watcher: { isBusy(chatId: string): boolean; watch(sessionId: string, chatId: string): void; choose(chatId: string, data: string): Promise<void> };
  webUrl: string;
}

/** Platform-neutral bot behaviour. Telegram specifics live in TelegramBot. */
export class TelegramConversation {
  private readonly logger = new Logger(TelegramConversation.name);
  private readonly pendingImages = new Map<string, { text: string; expires: number }>();

  constructor(private readonly deps: ConversationDeps) {}

  private send(chatId: string, text: string, buttons?: Button[][]) {
    return this.deps.port.send(chatId, text, buttons);
  }

  private integrationsButton(): Button[][] {
    return [[{ text: 'Buka halaman Integrasi ↗', url: `${this.deps.webUrl}/integrations` }]];
  }

  /** Returns the linked account, or tells the chat to link first. */
  private async account(from: Sender): Promise<LinkedAccount | null> {
    const account = await this.deps.links.byTelegramUser(from.telegramUserId);
    if (!account) await this.send(from.chatId, COPY.notLinked, this.integrationsButton());
    return account;
  }

  async onStart(from: Sender, payload?: string): Promise<void> {
    if (payload) {
      const userId = await this.deps.codes.consume(payload);
      if (!userId) return this.send(from.chatId, COPY.codeInvalid, this.integrationsButton());
      await this.deps.links.link(userId, from);
      const account = await this.deps.links.byTelegramUser(from.telegramUserId);
      await this.send(from.chatId, COPY.linked(account?.userName ?? 'akunmu'));
      return this.send(from.chatId, COPY.askClaim, MENU);
    }
    const account = await this.account(from);
    if (account) await this.send(from.chatId, COPY.welcome(account.userName), MENU);
  }

  async onText(from: Sender, raw: string): Promise<void> {
    if (raw.trim().startsWith('/')) return this.onHelp(from);
    const account = await this.account(from);
    if (!account) return;
    const text = raw.trim();
    if (text.length < 10) return this.send(from.chatId, COPY.tooShort);
    if (text.length > 2000) return this.send(from.chatId, COPY.tooLong);
    await this.startCheck(account, from, text);
  }

  async onPhoto(from: Sender, fileId: string, size: number): Promise<void> {
    const account = await this.account(from);
    if (!account) return;
    if (size > MAX_PHOTO_BYTES) return this.send(from.chatId, COPY.imageTooLarge);
    await this.send(from.chatId, COPY.readingImage);
    let text = '';
    try {
      const photo = await this.deps.port.downloadPhoto(fileId);
      text = (await this.deps.checks.readImage(photo.base64, photo.mimeType)).trim().slice(0, 2000);
    } catch (err) {
      this.logger.warn(`screenshot read failed: ${(err as Error).message}`);
    }
    if (text.length < 10) return this.send(from.chatId, COPY.imageFailed);
    this.pendingImages.set(from.chatId, { text, expires: Date.now() + PENDING_TTL_MS });
    await this.send(from.chatId, COPY.imageRead(text), [[{ text: 'Periksa ini', data: 'img:go' }, { text: 'Batal', data: 'img:x' }]]);
  }

  async onButton(from: Sender, data: string): Promise<void> {
    if (data.startsWith('tk:')) return this.deps.watcher.choose(from.chatId, data);
    if (data === 'menu:help') return this.onHelp(from);
    if (data === 'img:x') {
      this.pendingImages.delete(from.chatId);
      return this.send(from.chatId, COPY.cancelled);
    }
    const account = await this.account(from);
    if (!account) return;
    if (data === 'menu:check') return this.send(from.chatId, COPY.askClaim);
    if (data === 'menu:history') return this.onHistory(from);
    if (data === 'img:go') {
      const pending = this.pendingImages.get(from.chatId);
      this.pendingImages.delete(from.chatId);
      if (!pending || pending.expires < Date.now()) return this.send(from.chatId, COPY.noPending);
      await this.startCheck(account, from, pending.text);
    }
  }

  async onUnlink(from: Sender): Promise<void> {
    await this.deps.links.unlinkTelegram(from.telegramUserId);
    await this.send(from.chatId, COPY.unlinked);
  }

  async onHistory(from: Sender): Promise<void> {
    const account = await this.account(from);
    if (!account) return;
    await this.send(from.chatId, historyList(await this.deps.checks.recent(account.userId), this.deps.webUrl));
  }

  onHelp(from: Sender): Promise<void> {
    return this.send(from.chatId, COPY.help, [[{ text: 'Buka Counterpoint ↗', url: this.deps.webUrl }]]);
  }

  private async startCheck(account: LinkedAccount, from: Sender, text: string): Promise<void> {
    if (this.deps.watcher.isBusy(from.chatId)) return this.send(from.chatId, COPY.busy);
    let sessionId: string;
    try {
      sessionId = await this.deps.checks.start(text, account.userId, from.chatId, `tg:${from.telegramUserId}`);
    } catch (err) {
      if (err instanceof RateLimitedError) return this.send(from.chatId, COPY.rateLimited);
      this.logger.error(`could not start a Telegram check: ${(err as Error).message}`);
      return this.send(from.chatId, COPY.startFailed);
    }
    await this.send(from.chatId, COPY.checking, [[{ text: 'Pantau di website ↗', url: `${this.deps.webUrl}/t/${sessionId}` }]]);
    this.deps.watcher.watch(sessionId, from.chatId);
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @counterpoint/api exec vitest run test/conversation.test.ts`
Expected: 14 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/telegram/conversation.ts apps/api/test/conversation.test.ts
git commit -m "feat(api): Telegram conversation flow"
```

---

### Task 6: grammY wiring, gateways and integrations routes

**Files:**
- Create: `apps/api/src/telegram/gateways.ts`
- Create: `apps/api/src/telegram/telegram.bot.ts`
- Create: `apps/api/src/telegram/integrations.controller.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/package.json` (add `grammy`)
- Test: `apps/api/test/integrations.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–5; `ThesisService.create/history/confirmEntity`, `InvestigationService.start`, `LlmService.readImageText`, `UsageLimiter.check`, `EventsService.stream`, `PrismaService`.
- Produces:
  - `TelegramBot` (Nest provider) with `ready: boolean`, `username: string | null`, and the `ChatPort` methods
  - `webUrl(): string`
  - `GET /integrations` → `{ telegram: { configured, botUsername, linked: null | { username, linkedAt } }, discord: { configured: false } }`
  - `POST /integrations/telegram/link` → `{ url, expiresAt }`
  - `DELETE /integrations/telegram` → `{ ok: true }`

- [ ] **Step 1: Add grammY**

Run: `pnpm --filter @counterpoint/api add grammy`
Expected: `grammy` appears in `apps/api/package.json` dependencies.

- [ ] **Step 2: Write the failing controller test**

`apps/api/test/integrations.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { IntegrationsController } from '../src/telegram/integrations.controller';

const request = { user: { id: 'user-1', name: 'Farrel', email: 'f@x.id' } } as never;

function controller(opts: { ready?: boolean; linked?: boolean } = {}) {
  const unlinked: string[] = [];
  const c = new IntegrationsController(
    { ready: opts.ready ?? true, username: opts.ready === false ? null : 'CounterpointDevBot' } as never,
    { create: async () => ({ code: 'abc_DEF-123', expiresAt: new Date('2026-10-08T00:10:00Z') }) } as never,
    {
      byUser: async () => (opts.linked ? { username: 'farrel', linkedAt: new Date('2026-10-08T00:00:00Z') } : null),
      unlinkUser: async (id: string) => { unlinked.push(id); },
    } as never,
  );
  return { c, unlinked };
}

describe('IntegrationsController', () => {
  it('reports a bot that is not configured, and refuses to make codes', async () => {
    const { c } = controller({ ready: false });
    expect((await c.status(request)).telegram).toEqual({ configured: false, botUsername: null, linked: null });
    await expect(c.link(request)).rejects.toMatchObject({ status: 503 });
  });

  it('returns a t.me start link for the signed-in user', async () => {
    const { c } = controller();
    expect(await c.link(request)).toEqual({ url: 'https://t.me/CounterpointDevBot?start=abc_DEF-123', expiresAt: '2026-10-08T00:10:00.000Z' });
  });

  it('shows the linked account and unlinks it', async () => {
    const { c, unlinked } = controller({ linked: true });
    expect((await c.status(request)).telegram.linked).toEqual({ username: 'farrel', linkedAt: '2026-10-08T00:00:00.000Z' });
    expect(await c.unlink(request)).toEqual({ ok: true });
    expect(unlinked).toEqual(['user-1']);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm --filter @counterpoint/api exec vitest run test/integrations.test.ts`
Expected: FAIL, "Cannot find module '../src/telegram/integrations.controller'".

- [ ] **Step 4: Implement the gateways**

`apps/api/src/telegram/gateways.ts`:

```ts
import { HttpException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { ThesisService } from '../thesis/thesis.service';
import type { InvestigationService } from '../investigation/investigation.service';
import type { LlmService } from '../llm/llm.service';
import type { UsageLimiter } from '../thesis/usage-limiter';
import { RateLimitedError, type Checks } from './conversation';
import type { PendingEntity, WatchedSessions } from './check-watcher';

/** Adapts the existing services to what the conversation needs. */
export function telegramChecks(theses: ThesisService, llm: LlmService, limiter: UsageLimiter): Checks {
  return {
    async start(text, userId, chatId, limiterKey) {
      try {
        await limiter.check(limiterKey);
      } catch (err) {
        if (err instanceof HttpException && err.getStatus() === 429) throw new RateLimitedError();
        throw err;
      }
      const session = await theses.create(text, userId, { source: 'telegram', telegramChatId: chatId });
      return session.id;
    },
    readImage: (base64, mimeType) => llm.readImageText(base64, mimeType),
    async recent(userId) {
      const page = await theses.history(userId, { page: 1, query: '', filter: 'all' });
      return page.items.slice(0, 5).map((item) => ({ id: item.id, text: item.text, status: item.status }));
    },
  };
}

/** Adapts the existing services to what the watcher needs. */
export function telegramSessions(prisma: PrismaService, theses: ThesisService, investigation: InvestigationService): WatchedSessions {
  return {
    async ambiguous(sessionId) {
      const rows = await prisma.entity.findMany({ where: { sessionId, resolutionStatus: { in: ['AMBIGUOUS', 'UNKNOWN'] } }, select: { id: true, mention: true, candidates: true } });
      return rows.map((row): PendingEntity => ({ id: row.id, mention: row.mention, candidates: row.candidates as unknown as PendingEntity['candidates'] }));
    },
    async confirm(sessionId, entityId, ticker) {
      await theses.confirmEntity(sessionId, entityId, ticker);
    },
    startInvestigation: (sessionId) => investigation.start(sessionId),
    async scoreboard(sessionId) {
      const session = await prisma.thesisSession.findUniqueOrThrow({
        where: { id: sessionId },
        select: { status: true, claims: { orderBy: { ordinal: 'asc' }, select: { normalizedText: true, assessment: true, ticker: true } } },
      });
      return {
        status: session.status,
        tickers: [...new Set(session.claims.flatMap((c) => (c.ticker ? [c.ticker] : [])))],
        claims: session.claims.map((c) => ({ text: c.normalizedText, assessment: c.assessment })),
      };
    },
    async unfinishedTelegram() {
      const rows = await prisma.thesisSession.findMany({
        where: { source: 'telegram', telegramChatId: { not: null }, status: { notIn: ['COMPLETED', 'PARTIAL', 'FAILED'] }, createdAt: { gt: new Date(Date.now() - 86_400_000) } },
        select: { id: true, telegramChatId: true },
      });
      return rows.map((row) => ({ id: row.id, telegramChatId: row.telegramChatId! }));
    },
  };
}
```

- [ ] **Step 5: Implement the bot**

`apps/api/src/telegram/telegram.bot.ts`:

```ts
import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { Bot, GrammyError, type Context } from 'grammy';
import { PrismaService } from '../prisma/prisma.service';
import { ThesisService } from '../thesis/thesis.service';
import { InvestigationService } from '../investigation/investigation.service';
import { LlmService } from '../llm/llm.service';
import { UsageLimiter } from '../thesis/usage-limiter';
import { EventsService } from '../events/events.service';
import { renderMessage, type Button, type ChatPort } from './bot-copy';
import { CheckWatcher, WATCH_TIMEOUT_MS } from './check-watcher';
import { TelegramConversation, type Sender } from './conversation';
import { telegramChecks, telegramSessions } from './gateways';
import { LinkCodeService } from './link-codes';
import { TelegramLinkService } from './telegram-links';

/** Base URL for links in bot messages. */
export const webUrl = () => (process.env.PUBLIC_WEB_URL ?? process.env.WEB_ORIGIN?.split(',')[0] ?? 'http://localhost:3000').trim().replace(/\/$/, '');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const sender = (ctx: Context): Sender => ({ telegramUserId: String(ctx.from!.id), chatId: String(ctx.chat!.id), username: ctx.from!.username ?? null });

/** The only grammY-aware unit: long polling, update routing and the ChatPort. Off when TELEGRAM_BOT_TOKEN is unset. */
@Injectable()
export class TelegramBot implements ChatPort, OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(TelegramBot.name);
  private readonly token = process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
  private bot: Bot | null = null;
  private watcher: CheckWatcher | null = null;
  private running = false;
  username: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly theses: ThesisService,
    private readonly investigation: InvestigationService,
    private readonly llm: LlmService,
    private readonly limiter: UsageLimiter,
    private readonly events: EventsService,
    private readonly codes: LinkCodeService,
    private readonly links: TelegramLinkService,
  ) {}

  get ready(): boolean {
    return this.bot !== null && this.username !== null;
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.token) {
      this.logger.log('TELEGRAM_BOT_TOKEN is not set; the Telegram bot is off');
      return;
    }
    const bot = new Bot(this.token);
    try {
      await bot.init();
    } catch (err) {
      this.logger.error(`Telegram bot could not start: ${(err as Error).message}`);
      return;
    }
    this.bot = bot;
    this.username = bot.botInfo.username;
    const url = webUrl();
    this.watcher = new CheckWatcher({ port: this, events: this.events, sessions: telegramSessions(this.prisma, this.theses, this.investigation), webUrl: url, timeoutMs: WATCH_TIMEOUT_MS });
    const convo = new TelegramConversation({ port: this, codes: this.codes, links: this.links, checks: telegramChecks(this.theses, this.llm, this.limiter), watcher: this.watcher, webUrl: url });
    this.route(bot, convo);
    this.running = true;
    void this.poll();
    void this.watcher.resume().catch((err: Error) => this.logger.error(`could not resume Telegram checks: ${err.message}`));
    this.logger.log(`Telegram bot @${this.username} is polling; links go to ${url}`);
  }

  async onApplicationShutdown(): Promise<void> {
    this.running = false;
    this.watcher?.stopAll();
    try { await this.bot?.stop(); } catch { /* not polling */ }
  }

  private route(bot: Bot, convo: TelegramConversation): void {
    bot.use(async (ctx, next) => { if (ctx.chat?.type === 'private' && ctx.from) await next(); });
    bot.command('start', (ctx) => convo.onStart(sender(ctx), ctx.match.trim() || undefined));
    bot.command('putuskan', (ctx) => convo.onUnlink(sender(ctx)));
    bot.command('riwayat', (ctx) => convo.onHistory(sender(ctx)));
    bot.command('bantuan', (ctx) => convo.onHelp(sender(ctx)));
    bot.on('message:photo', (ctx) => {
      const photo = ctx.message.photo.at(-1)!;
      return convo.onPhoto(sender(ctx), photo.file_id, photo.file_size ?? 0);
    });
    bot.on('message:text', (ctx) => convo.onText(sender(ctx), ctx.message.text));
    bot.on('callback_query:data', async (ctx) => {
      await ctx.answerCallbackQuery().catch(() => undefined);
      await convo.onButton(sender(ctx), ctx.callbackQuery.data);
    });
    bot.catch((err) => this.logger.error(`Telegram update failed: ${err.message}`));
  }

  /** Long polling. A 409 means another process polls this token (for example during a redeploy): back off and retry. */
  private async poll(): Promise<void> {
    let delay = 2_000;
    while (this.running && this.bot) {
      try {
        await this.bot.start({ allowed_updates: ['message', 'callback_query'] });
        return;
      } catch (err) {
        if (!this.running) return;
        const conflict = err instanceof GrammyError && err.error_code === 409;
        this.logger.warn(conflict ? 'Another process is polling this Telegram bot; retrying' : `Telegram polling stopped: ${(err as Error).message}; retrying`);
        await sleep(delay);
        delay = Math.min(delay * 2, 60_000);
      }
    }
  }

  async send(chatId: string, text: string, buttons: Button[][] = []): Promise<void> {
    if (!this.bot) return;
    const message = renderMessage(text, buttons);
    await this.bot.api.sendMessage(chatId, message.text, {
      link_preview_options: { is_disabled: true },
      ...(message.keyboard.length ? { reply_markup: { inline_keyboard: message.keyboard } } : {}),
    });
  }

  async downloadPhoto(fileId: string): Promise<{ base64: string; mimeType: 'image/jpeg' }> {
    if (!this.bot) throw new Error('Telegram bot is off');
    const file = await this.bot.api.getFile(fileId);
    // The file URL contains the bot token: never log it.
    const res = await fetch(`https://api.telegram.org/file/bot${this.token}/${file.file_path}`);
    if (!res.ok) throw new Error(`Telegram file download failed (${res.status})`);
    return { base64: Buffer.from(await res.arrayBuffer()).toString('base64'), mimeType: 'image/jpeg' };
  }
}
```

- [ ] **Step 6: Implement the controller**

`apps/api/src/telegram/integrations.controller.ts`:

```ts
import { Controller, Delete, Get, Post, Req, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthRequest } from '../auth/auth.service';
import { TelegramBot } from './telegram.bot';
import { LinkCodeService } from './link-codes';
import { TelegramLinkService } from './telegram-links';

@Controller('integrations')
@UseGuards(AuthGuard)
export class IntegrationsController {
  constructor(
    private readonly bot: TelegramBot,
    private readonly codes: LinkCodeService,
    private readonly links: TelegramLinkService,
  ) {}

  @Get()
  async status(@Req() request: AuthRequest) {
    const link = await this.links.byUser(request.user.id);
    return {
      telegram: {
        configured: this.bot.ready,
        botUsername: this.bot.ready ? this.bot.username : null,
        linked: link ? { username: link.username, linkedAt: link.linkedAt.toISOString() } : null,
      },
      discord: { configured: false },
    };
  }

  @Post('telegram/link')
  async link(@Req() request: AuthRequest) {
    if (!this.bot.ready || !this.bot.username) throw new ServiceUnavailableException('Bot Telegram belum dikonfigurasi di server ini.');
    const { code, expiresAt } = await this.codes.create(request.user.id);
    return { url: `https://t.me/${this.bot.username}?start=${code}`, expiresAt: expiresAt.toISOString() };
  }

  /** Returns a body (not 204) because the web client always parses JSON. */
  @Delete('telegram')
  async unlink(@Req() request: AuthRequest) {
    await this.links.unlinkUser(request.user.id);
    return { ok: true };
  }
}
```

Check that `AuthRequest` exposes `user: PublicUser` (`apps/api/src/auth/auth.service.ts:7`). `ThesisController` already uses `request.user.id`, so it should.

- [ ] **Step 7: Register in AppModule**

In `apps/api/src/app.module.ts`, add the imports:

```ts
import { IntegrationsController } from './telegram/integrations.controller';
import { TelegramBot } from './telegram/telegram.bot';
import { LinkCodeService } from './telegram/link-codes';
import { TelegramLinkService } from './telegram/telegram-links';
```

Then extend the module lists:

```ts
  controllers: [HealthController, ThesisController, EvidenceController, IntegrationsController],
  providers: [LlmService, ClaimsService, EntityService, ReportsService, InvestigationService, ThesisService, UsageLimiter, LinkCodeService, TelegramLinkService, TelegramBot],
```

- [ ] **Step 8: Run the tests, typecheck and build**

Run: `pnpm --filter @counterpoint/api test && pnpm --filter @counterpoint/api exec tsc --noEmit -p . && pnpm --filter @counterpoint/api build`
Expected: all API tests pass (including the 3 new ones); the typecheck is clean; `nest build` succeeds.

- [ ] **Step 9: Check that the API still boots without a token**

The dev API (`pnpm dev:api`) restarts on file changes. Check its log for "TELEGRAM_BOT_TOKEN is not set; the Telegram bot is off" and "Nest application successfully started".
Then run `curl -s http://localhost:4000/health`.
Expected: `{"ok":true,...}`.

- [ ] **Step 10: Commit**

```bash
git add apps/api/package.json pnpm-lock.yaml apps/api/src/telegram apps/api/src/app.module.ts apps/api/test/integrations.test.ts
git commit -m "feat(api): Telegram bot over long polling and integrations routes"
```

---

### Task 7: Web API client and card state

**Files:**
- Modify: `apps/web/lib/api.ts` (types near `HistoryEntry`; methods in `api`)
- Create: `apps/web/lib/integrations.ts`
- Test: `apps/web/test/integrations.test.ts`

**Interfaces:**
- Consumes: Task 6 routes.
- Produces:
  - `IntegrationsView`
  - `api.getIntegrations(signal?)`
  - `api.linkTelegram()`
  - `api.unlinkTelegram()`
  - `telegramCard(view: IntegrationsView['telegram'], pending: { url: string; expiresAt: string } | null, now: number): TelegramCard`
  - `countdown(seconds: number): string`

- [ ] **Step 1: Write the failing test**

`apps/web/test/integrations.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { countdown, telegramCard } from '../lib/integrations';

const base = { configured: true, botUsername: 'CounterpointDevBot', linked: null };
const pending = { url: 'https://t.me/CounterpointDevBot?start=abc', expiresAt: '2026-10-08T00:10:00.000Z' };
const at = (iso: string) => Date.parse(iso);

describe('telegramCard', () => {
  it('is unavailable when the server has no bot', () => {
    expect(telegramCard({ ...base, configured: false }, null, 0)).toEqual({ kind: 'unavailable' });
  });

  it('offers to connect when nothing is pending', () => {
    expect(telegramCard(base, null, 0)).toEqual({ kind: 'idle' });
  });

  it('counts down while waiting, then expires', () => {
    expect(telegramCard(base, pending, at('2026-10-08T00:08:30.000Z'))).toEqual({ kind: 'waiting', url: pending.url, secondsLeft: 90 });
    expect(telegramCard(base, pending, at('2026-10-08T00:10:00.000Z'))).toEqual({ kind: 'expired' });
  });

  it('shows the link once Telegram confirms, even with a code still pending', () => {
    const linked = { username: 'farrel', linkedAt: '2026-10-08T00:09:00.000Z' };
    expect(telegramCard({ ...base, linked }, pending, at('2026-10-08T00:09:00.000Z'))).toEqual({ kind: 'linked', ...linked });
  });
});

describe('countdown', () => {
  it('formats minutes and seconds', () => {
    expect(countdown(90)).toBe('1:30');
    expect(countdown(5)).toBe('0:05');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @counterpoint/web exec vitest run test/integrations.test.ts`
Expected: FAIL, "Cannot find module '../lib/integrations'".

- [ ] **Step 3: Implement**

In `apps/web/lib/api.ts`, under `HistoryPage`:

```ts
export interface IntegrationsView {
  telegram: { configured: boolean; botUsername: string | null; linked: { username: string | null; linkedAt: string } | null };
  discord: { configured: boolean };
}
```

And inside `export const api = {` (after `getHistory`):

```ts
  getIntegrations: (signal?: AbortSignal) => request<IntegrationsView>('/integrations', { signal }),
  linkTelegram: () => request<{ url: string; expiresAt: string }>('/integrations/telegram/link', { method: 'POST' }),
  unlinkTelegram: () => request<{ ok: boolean }>('/integrations/telegram', { method: 'DELETE' }),
```

`apps/web/lib/integrations.ts`:

```ts
import type { IntegrationsView } from './api';

export type TelegramCard =
  | { kind: 'unavailable' }
  | { kind: 'idle' }
  | { kind: 'waiting'; url: string; secondsLeft: number }
  | { kind: 'expired' }
  | { kind: 'linked'; username: string | null; linkedAt: string };

/** Which state the Telegram card shows. A confirmed link wins over a pending code. */
export function telegramCard(view: IntegrationsView['telegram'], pending: { url: string; expiresAt: string } | null, now: number): TelegramCard {
  if (!view.configured) return { kind: 'unavailable' };
  if (view.linked) return { kind: 'linked', ...view.linked };
  if (!pending) return { kind: 'idle' };
  const secondsLeft = Math.ceil((Date.parse(pending.expiresAt) - now) / 1000);
  return secondsLeft > 0 ? { kind: 'waiting', url: pending.url, secondsLeft } : { kind: 'expired' };
}

export const countdown = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @counterpoint/web exec vitest run test/integrations.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/api.ts apps/web/lib/integrations.ts apps/web/test/integrations.test.ts
git commit -m "feat(web): integrations API client and Telegram card state"
```

---

### Task 8: Integrations page, entry points and Telegram badges

**Files:**
- Create: `apps/web/app/integrations/layout.tsx`
- Create: `apps/web/app/integrations/page.tsx`
- Modify: `apps/web/components/AppShell.tsx` (sidebar list ~line 115; account menu ~line 152)
- Modify: `apps/web/app/history/page.tsx` (history meta row)
- Modify: `apps/web/app/workspace.css` (append)
- Modify: `apps/web/lib/locale.ts` (English entries)
- Modify: `apps/web/package.json` (add `qrcode`, `@types/qrcode`)

**Interfaces:**
- Consumes: `api.getIntegrations`, `api.linkTelegram`, `api.unlinkTelegram`, `telegramCard`, `countdown` (Task 7); `HistoryEntry.source` (Task 2).

- [ ] **Step 1: Add the QR library**

Run: `pnpm --filter @counterpoint/web add qrcode && pnpm --filter @counterpoint/web add -D @types/qrcode`

- [ ] **Step 2: Layout**

`apps/web/app/integrations/layout.tsx`:

```tsx
import { AuthBoundary } from '@/components/AuthProvider';
import { AppShell } from '@/components/AppShell';
export default function Layout({ children }: { children: React.ReactNode }) { return <AuthBoundary><AppShell>{children}</AppShell></AuthBoundary>; }
```

- [ ] **Step 3: Page**

`apps/web/app/integrations/page.tsx`:

```tsx
'use client';
import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { ExternalLink, LoaderCircle, MessageCircle, Send } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import { api, type IntegrationsView } from '@/lib/api';
import { countdown, telegramCard } from '@/lib/integrations';

export default function IntegrationsPage() {
  const { language, t } = useLanguage();
  const [view, setView] = useState<IntegrationsView | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<{ url: string; expiresAt: string } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      setView(await api.getIntegrations(signal));
      setError('');
    } catch {
      if (!signal?.aborted) setError('Integrasi belum dapat dimuat. Coba lagi.');
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const card = view ? telegramCard(view.telegram, pending, now) : null;
  const waiting = card?.kind === 'waiting';

  // While a code is pending: tick the countdown every second and check for the link every 3 seconds.
  useEffect(() => {
    if (!waiting) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(() => void load(), 3000);
    return () => { clearInterval(tick); clearInterval(poll); };
  }, [waiting, load]);

  useEffect(() => {
    if (card?.kind === 'linked' && pending) { setPending(null); setQr(null); }
  }, [card?.kind, pending]);

  useEffect(() => {
    if (!pending) return;
    let live = true;
    QRCode.toDataURL(pending.url, { margin: 1, width: 192 }).then((url) => { if (live) setQr(url); }).catch(() => { if (live) setQr(null); });
    return () => { live = false; };
  }, [pending]);

  async function connect() {
    setBusy(true);
    setError('');
    try {
      const next = await api.linkTelegram();
      setPending(next);
      setNow(Date.now());
      window.open(next.url, '_blank', 'noopener');
    } catch {
      setError('Kode belum dapat dibuat. Coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setError('');
    try {
      await api.unlinkTelegram();
      setConfirmUnlink(false);
      await load();
    } catch {
      setError('Gagal memutuskan Telegram. Coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  const formatDate = (iso: string) => new Intl.DateTimeFormat(language === 'id' ? 'id-ID' : 'en-GB', { dateStyle: 'medium' }).format(new Date(iso));

  return (
    <main id="main-content" className="page integrations-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">{t('Integrasi')}</span>
          <h1>{t('Periksa klaim dari aplikasi chat')}</h1>
          <p>{t('Hubungkan akunmu sekali, lalu kirim pesan saham dari chat. Hasilnya tersimpan di riwayatmu.')}</p>
        </div>
      </header>
      {error && <p className="notice" role="alert">{t(error)}</p>}
      <div className="integrations-grid">
        <section className="sheet integration-card" aria-labelledby="tg-title">
          <div className="integration-head">
            <span className="integration-icon" aria-hidden="true"><Send size={20} /></span>
            <div>
              <h2 id="tg-title">Telegram</h2>
              <p className="small muted">{t('Kirim teks atau screenshot ke bot. Hasilnya dikirim balik dengan tautan ke analisis lengkap.')}</p>
            </div>
          </div>
          {!card && !error && <p className="small muted" role="status"><LoaderCircle size={14} className="spin" aria-hidden="true" /> {t('Memuat integrasi…')}</p>}
          {card?.kind === 'unavailable' && <button type="button" className="button" disabled>{t('Belum tersedia')}</button>}
          {card?.kind === 'idle' && <button type="button" className="button primary" disabled={busy} onClick={() => void connect()}>{t('Hubungkan Telegram')}</button>}
          {card?.kind === 'expired' && (
            <div className="integration-row">
              <p className="small muted">{t('Kode sudah kedaluwarsa.')}</p>
              <button type="button" className="button primary" disabled={busy} onClick={() => void connect()}>{t('Buat kode baru')}</button>
            </div>
          )}
          {card?.kind === 'waiting' && (
            <div className="integration-waiting">
              {qr && <img src={qr} width={192} height={192} alt={t('Kode QR untuk membuka bot Telegram')} className="integration-qr" />}
              <div>
                <p role="status"><LoaderCircle size={15} className="spin" aria-hidden="true" /> {t('Menunggu konfirmasi di Telegram…')}</p>
                <p className="small muted">{t('Tekan Start di Telegram, atau pindai kode QR dengan HP. Berlaku {time}.', { time: countdown(card.secondsLeft) })}</p>
                <a className="button primary" href={card.url} target="_blank" rel="noopener noreferrer">{t('Buka Telegram')}<ExternalLink size={15} aria-hidden="true" /></a>
              </div>
            </div>
          )}
          {card?.kind === 'linked' && (
            <div className="integration-row">
              <p>{t('Terhubung sebagai {name} · sejak {date}', { name: card.username ? `@${card.username}` : 'Telegram', date: formatDate(card.linkedAt) })}</p>
              <div className="integration-actions">
                {view?.telegram.botUsername && <a className="button primary" href={`https://t.me/${view.telegram.botUsername}`} target="_blank" rel="noopener noreferrer">{t('Buka bot')}<ExternalLink size={15} aria-hidden="true" /></a>}
                {confirmUnlink ? (
                  <>
                    <span className="small">{t('Putuskan Telegram dari akunmu?')}</span>
                    <button type="button" className="button quiet" disabled={busy} onClick={() => void disconnect()}>{t('Ya, putuskan')}</button>
                    <button type="button" className="button quiet" onClick={() => setConfirmUnlink(false)}>{t('Batal')}</button>
                  </>
                ) : (
                  <button type="button" className="button quiet" onClick={() => setConfirmUnlink(true)}>{t('Putuskan')}</button>
                )}
              </div>
            </div>
          )}
        </section>
        <section className="sheet integration-card is-soon" aria-labelledby="dc-title">
          <div className="integration-head">
            <span className="integration-icon" aria-hidden="true"><MessageCircle size={20} /></span>
            <div>
              <h2 id="dc-title">Discord</h2>
              <p className="small muted">{t('Periksa klaim langsung dari server Discord komunitas sahammu.')}</p>
            </div>
          </div>
          <button type="button" className="button" disabled>{t('Segera hadir')}</button>
        </section>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Entry points and badges in AppShell**

In `apps/web/components/AppShell.tsx`:
- Add `Plug` and `Send` to the lucide-react import.
- In the sidebar, inside the `.sidebar-list` div, after the `Lihat semua riwayat` link:

```tsx
        <Link href="/integrations" className="sidebar-integrations" aria-current={pathname === '/integrations' ? 'page' : undefined}><Plug size={15} aria-hidden="true" />{t('Integrasi')}</Link>
```

- In each sidebar item, before the `ACTIVE.has(e.status)` loader:

```tsx
                    {e.source === 'telegram' && <Send size={13} className="sidebar-mark" aria-label={t('Dari Telegram')} />}
```

- In `AccountMenu`, right after the `<p className="account-email" …>` line:

```tsx
          <Link href="/integrations" className="account-link" onClick={() => setOpen(false)}><Plug size={15} aria-hidden="true" />{t('Integrasi')}</Link>
```

(`AccountMenu` already has `open`/`setOpen`. Add `import Link from 'next/link'` only if the file doesn't import it yet; it does, since line 35 uses `Link`.)

- [ ] **Step 5: Badge in the history page**

In `apps/web/app/history/page.tsx`:
- Add `Send` to the lucide import.
- In the `history-meta` div, after the ticker spans:

```tsx
{entry.source === 'telegram' && <span className="history-source"><Send size={12} aria-hidden="true" />Telegram</span>}
```

- [ ] **Step 6: Styles**

Append to `apps/web/app/workspace.css`:

```css
/* Integrations */
.sidebar-integrations { display: flex; align-items: center; gap: 8px; margin: 0 0 12px; padding: 8px 10px; border-radius: 8px; font-size: .8rem; color: var(--quiet); text-decoration: none; }
.sidebar-integrations:hover, .sidebar-integrations[aria-current="page"] { background: var(--hover); color: var(--ink); }
.account-link { display: flex; align-items: center; gap: 8px; padding: 8px 6px; border-radius: 8px; color: var(--ink); text-decoration: none; font-size: .875rem; }
.account-link:hover { background: var(--hover); }
.history-source { display: inline-flex; align-items: center; gap: 4px; font-size: .75rem; color: var(--quiet); }
.integrations-grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); margin-top: 24px; }
.integration-card { display: flex; flex-direction: column; gap: 16px; padding: 20px; }
.integration-card.is-soon { opacity: .7; }
.integration-head { display: flex; gap: 12px; align-items: flex-start; }
.integration-head h2 { margin: 0 0 4px; font-size: 1.05rem; }
.integration-head p { margin: 0; }
.integration-icon { display: grid; place-items: center; width: 40px; height: 40px; flex: none; border-radius: 10px; background: var(--hover); color: var(--ink); }
.integration-row { display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
.integration-row p { margin: 0; }
.integration-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.integration-waiting { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; }
.integration-waiting p { margin: 0 0 8px; }
.integration-qr { border-radius: 8px; background: #fff; padding: 6px; }
.integrations-page .button { align-self: flex-start; }
```

- [ ] **Step 7: English strings**

Before adding each key, grep for it in `apps/web/lib/locale.ts` and add only the missing ones (for example `Batal` may already exist). Add these entries to the English map:

```ts
  'Integrasi': 'Integrations',
  'Periksa klaim dari aplikasi chat': 'Check claims from chat apps',
  'Hubungkan akunmu sekali, lalu kirim pesan saham dari chat. Hasilnya tersimpan di riwayatmu.': 'Link your account once, then send stock posts from chat. Results are saved to your history.',
  'Integrasi belum dapat dimuat. Coba lagi.': 'Integrations could not be loaded. Try again.',
  'Kirim teks atau screenshot ke bot. Hasilnya dikirim balik dengan tautan ke analisis lengkap.': 'Send text or a screenshot to the bot. It replies with the result and a link to the full analysis.',
  'Memuat integrasi…': 'Loading integrations…',
  'Belum tersedia': 'Not available yet',
  'Hubungkan Telegram': 'Connect Telegram',
  'Kode sudah kedaluwarsa.': 'The code has expired.',
  'Buat kode baru': 'Create a new code',
  'Kode QR untuk membuka bot Telegram': 'QR code to open the Telegram bot',
  'Menunggu konfirmasi di Telegram…': 'Waiting for confirmation in Telegram…',
  'Tekan Start di Telegram, atau pindai kode QR dengan HP. Berlaku {time}.': 'Press Start in Telegram, or scan the QR code with your phone. Valid for {time}.',
  'Buka Telegram': 'Open Telegram',
  'Terhubung sebagai {name} · sejak {date}': 'Connected as {name} · since {date}',
  'Buka bot': 'Open bot',
  'Putuskan Telegram dari akunmu?': 'Disconnect Telegram from your account?',
  'Ya, putuskan': 'Yes, disconnect',
  'Putuskan': 'Disconnect',
  'Batal': 'Cancel',
  'Periksa klaim langsung dari server Discord komunitas sahammu.': 'Check claims right inside your stock community’s Discord server.',
  'Segera hadir': 'Coming soon',
  'Kode belum dapat dibuat. Coba lagi.': 'The code could not be created. Try again.',
  'Gagal memutuskan Telegram. Coba lagi.': 'Could not disconnect Telegram. Try again.',
  'Dari Telegram': 'From Telegram',
```

- [ ] **Step 8: Verify**

Run: `pnpm --filter @counterpoint/web exec tsc --noEmit -p . && pnpm --filter @counterpoint/web test && pnpm --filter @counterpoint/web build`
Expected: the typecheck is clean; tests pass except the 2 known `conditionText` failures; the build succeeds.

Then open `http://localhost:3000/integrations` in Chrome, with no token set on the API. Expected:
- the Telegram card shows a disabled "Belum tersedia" button;
- the Discord card shows "Segera hadir";
- "Integrasi" appears in the sidebar and in the account menu.

Check at a 390px width as well: nothing scrolls sideways.

- [ ] **Step 9: Commit**

```bash
git add apps/web/app/integrations apps/web/components/AppShell.tsx apps/web/app/history/page.tsx apps/web/app/workspace.css apps/web/lib/locale.ts apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): integrations page with Telegram linking and Discord coming soon"
```

---

### Task 9: Configuration, docs and end-to-end check

**Files:**
- Modify: `apps/api/.env.example` (or the root `.env.example`, whichever holds the API variables; check both)
- Modify: `docs/deploy.md`
- Modify: `docs/superpowers/specs/2026-10-08-telegram-integration-design.md` (watch timeout)

- [ ] **Step 1: Document the variables**

Add to the `.env.example` that holds the other API variables:

```bash
# Telegram bot (optional). Create one with @BotFather; use a separate bot for local dev.
TELEGRAM_BOT_TOKEN=
# Base URL for links in bot messages. Defaults to the first WEB_ORIGIN.
PUBLIC_WEB_URL=
```

Add a "Telegram bot" section to `docs/deploy.md`:
- set `TELEGRAM_BOT_TOKEN` and `PUBLIC_WEB_URL` (the Vercel URL) on Railway;
- keep exactly one replica;
- use a different bot token locally, because two pollers on one token conflict.

- [ ] **Step 2: Align the spec with the plan**

In the spec, replace "A watch is dropped after `SESSION_DEADLINE_MS` + 2 minutes" with "A watch is dropped after 15 minutes (ticker confirmation waits on the user)".

- [ ] **Step 3: End-to-end with the dev bot**

The user puts the dev bot token in the API env file (the one `pnpm dev:api` reads; check `apps/api/package.json` `dev` and `node --env-file` usage). Then restart `pnpm dev:api`. Expected log: "Telegram bot @<name> is polling".

Check each of these:
1. `/integrations` → Hubungkan Telegram → the t.me link opens, and a QR code shows.
2. Press Start in Telegram → "Terhubung sebagai …" plus the menu, and the website card switches to "Terhubung sebagai @…" within 3 s.
3. Send a text claim → "🔎 Memeriksa…"; the check appears in the website sidebar with a Telegram icon; a scoreboard arrives with the link (as text, because the URL is localhost).
4. Send a screenshot → the text it read, then "Periksa ini" → the check runs.
5. Send an ambiguous company → ticker buttons → tap one → the check continues.
6. `/riwayat` lists checks; `/putuskan` unlinks, and the website shows "Hubungkan Telegram" again after a refresh.

- [ ] **Step 4: Commit**

```bash
git add apps/api/.env.example .env.example docs/deploy.md docs/superpowers/specs/2026-10-08-telegram-integration-design.md
git commit -m "docs: Telegram bot configuration and deployment"
```
