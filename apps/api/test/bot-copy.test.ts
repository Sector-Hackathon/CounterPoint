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
