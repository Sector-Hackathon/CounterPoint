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
