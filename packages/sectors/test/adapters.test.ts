import { describe, expect, it, vi } from 'vitest';
import {
  adaptDividends,
  adaptPeerCandidates,
  adaptQuarterly,
  adaptSearch,
  adaptValuation,
  peerQuery,
  sanitizeSearchTerm,
  searchQuery,
} from '../src/adapters';
import { SectorsHttpClient } from '../src/http';

const res = (data: unknown) => ({ data, locator: 'sectors:/test', retrievedAt: '2026-09-27T00:00:00Z' });

describe('sectors v2 adapters', () => {
  it('normalizes quarterly rows to periods and drops non-quarter-end dates', () => {
    const series = adaptQuarterly(
      res([
        { symbol: 'BBRI.JK', date: '2026-06-30', revenue: 100, earnings: 20, financials_sector_metrics: {} },
        { symbol: 'BBRI.JK', date: '2026-05-15', revenue: 1, earnings: 1 },
      ]),
      'bbri.jk',
    );
    expect(series.ticker).toBe('BBRI');
    expect(series.records).toEqual([
      { period: { kind: 'quarter', year: 2026, quarter: 2 }, revenue: 100, netIncome: 20, eps: null },
    ]);
  });

  it('takes P/E and P/BV from the latest historical_valuation year, as of the latest close', () => {
    const v = adaptValuation(
      res({
        symbol: 'BBRI.JK',
        valuation: {
          latest_close_date: '2026-09-25',
          historical_valuation: [
            { year: 2025, pe: 9.7, pb: 1.66 },
            { year: 2026, pe: 7.58, pb: 1.47 },
          ],
        },
      }),
    );
    expect(v).toMatchObject({ ticker: 'BBRI', asOf: '2026-09-25', pe: 7.58, pbv: 1.47 });
  });

  it('keeps missing valuation as null rather than substituting', () => {
    const v = adaptValuation(res({ symbol: 'XXXX.JK', valuation: null }));
    expect(v.pe).toBeNull();
    expect(v.pbv).toBeNull();
  });

  it('reads year-keyed dividend history and converts fractions to percent', () => {
    const d = adaptDividends(
      res({
        symbol: 'BBRI.JK',
        dividend: {
          yield_ttm: 0.1098,
          payout_ratio: 0.832,
          historical_dividends: {
            '2025': { total_yield: 0.0885, breakdown: [{ date: '2025-12-30', total: 137 }, { date: '2025-04-11', total: 208.4 }] },
            '2024': { total_yield: 0.0899, breakdown: [{ date: '2024-03-14', total: 235 }] },
          },
        },
      }),
    );
    expect(d.trailingYieldPct).toBeCloseTo(10.98);
    expect(d.payoutRatioPct).toBeCloseTo(83.2);
    expect(d.payments.map((p) => p.date)).toEqual(['2024-03-14', '2025-04-11', '2025-12-30']);
    expect(d.annualYieldsPct.map((y) => y.year)).toEqual([2024, 2025]);
  });

  it('parses screener results for search and peers', () => {
    const body = { results: [{ symbol: 'BMRI.JK', company_name: 'PT Bank Mandiri (Persero) Tbk' }], pagination: {} };
    expect(adaptSearch(res(body))).toEqual([{ ticker: 'BMRI', name: 'PT Bank Mandiri (Persero) Tbk' }]);
    expect(adaptPeerCandidates(res(body), 'Banks').candidates[0]).toMatchObject({ ticker: 'BMRI', subsector: 'Banks' });
  });

  it('builds safe where clauses from untrusted text', () => {
    expect(sanitizeSearchTerm("Mandiri' or 1=1 --")).toBe('Mandiri or 11 --');
    expect(searchQuery('bbri').where).toBe("symbol = 'BBRI.JK' or company_name like '%bbri%'");
    expect(searchQuery('Bank Mandiri').where).toBe("company_name like '%Bank Mandiri%'");
    expect(peerQuery('Banks')).toEqual({ where: "sub_sector = 'Banks'", order_by: '-market_cap', limit: '10' });
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
