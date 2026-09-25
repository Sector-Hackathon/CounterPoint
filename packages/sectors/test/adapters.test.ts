import { describe, expect, it, vi } from 'vitest';
import { adaptDividends, adaptQuarterly, adaptValuation } from '../src/adapters';
import { SectorsHttpClient } from '../src/http';

const res = (data: unknown) => ({ data, locator: 'sectors:/test', retrievedAt: '2026-09-26T00:00:00Z' });

describe('sectors adapters', () => {
  it('normalizes quarterly rows to periods and drops non-quarter-end dates', () => {
    const series = adaptQuarterly(
      res([
        { date: '2025-06-30', revenue: '100', earnings: 20, eps: null },
        { date: '2025-05-15', revenue: 1, earnings: 1 },
      ]),
      'bbri.jk',
    );
    expect(series.ticker).toBe('BBRI');
    expect(series.records).toEqual([
      { period: { kind: 'quarter', year: 2025, quarter: 2 }, revenue: 100, netIncome: 20, eps: null },
    ]);
  });

  it('keeps missing metrics as null rather than substituting', () => {
    const v = adaptValuation(res({ symbol: 'BBRI.JK', valuation: { pe: null } }));
    expect(v.pe).toBeNull();
    expect(v.pbv).toBeNull();
  });

  it('converts fractional yields to percent', () => {
    const d = adaptDividends(
      res({
        symbol: 'BBRI.JK',
        dividend: {
          yield_ttm: 0.081,
          payout_ratio: 0.85,
          historical_dividends: [{ year: 2024, total_yield: 0.074, breakdown: [{ date: '2024-03-28', total: 319 }] }],
        },
      }),
    );
    expect(d.trailingYieldPct).toBeCloseTo(8.1);
    expect(d.payoutRatioPct).toBeCloseTo(85);
    expect(d.payments).toEqual([{ date: '2024-03-28', amountPerShare: 319 }]);
  });
});

describe('SectorsHttpClient', () => {
  it('retries once on 5xx, then caches the success', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('boom', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: 1 }), { status: 200 }));
    const events: boolean[] = [];
    const client = new SectorsHttpClient({ apiKey: 'k', fetchImpl, onCall: (e) => events.push(e.cacheHit) });
    await client.get('/x');
    const again = await client.get('/x');
    expect(again.data).toEqual({ ok: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(events).toEqual([false, false, true]);
  });

  it('does not retry on 4xx', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('nope', { status: 404 }));
    const client = new SectorsHttpClient({ apiKey: 'k', fetchImpl });
    await expect(client.get('/x')).rejects.toMatchObject({ status: 404 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
