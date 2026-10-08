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
