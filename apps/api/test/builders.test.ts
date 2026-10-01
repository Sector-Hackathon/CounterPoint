import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { DEV_FIXTURE, FixtureSectorsDataSource, type FixtureSet } from '@counterpoint/sectors';
import { METRIC_BUILDERS, type BuildContext } from '../src/investigation/evidence-builders';

function ctx(ticker: string, fx: FixtureSet = DEV_FIXTURE): BuildContext {
  const memo = new Map<string, Promise<unknown>>();
  return {
    claimId: 'c',
    ticker,
    source: new FixtureSectorsDataSource(fx),
    minPeers: 4,
    newId: randomUUID,
    peerSet: null,
    memo: <T>(k: string, fn: () => Promise<T>) => {
      if (!memo.has(k)) memo.set(k, fn());
      return memo.get(k) as Promise<T>;
    },
  };
}

const valueOf = async (metric: string, ticker: string, fx: FixtureSet = DEV_FIXTURE) =>
  (await METRIC_BUILDERS[metric]!(ctx(ticker, fx), 'chk')).find((e) => e.metric === metric)!;

describe('counterpoint metric builders', () => {
  it('annual net income growth for the latest fiscal year', async () => {
    const e = await valueOf('annual_earnings_yoy_pct', 'BBCA');
    expect(e.value).toBeCloseTo(((54_800 - 48_600) / 48_600) * 100, 1);
    expect(e.economicPeriod).toBe('FY2024');
  });

  it('prior fiscal year net income growth', async () => {
    const e = await valueOf('prior_fy_earnings_yoy_pct', 'BBRI');
    expect(e.value).toBeCloseTo(((60_400 - 62_000) / 62_000) * 100, 1);
    expect(e.economicPeriod).toBe('FY2023');
  });

  it('ROE trend: latest minus mean of prior three years', async () => {
    const e = await valueOf('roe_trend_pp', 'BBRI');
    expect(e.value).toBeCloseTo(15.1 - (16.5 + 18.0 + 19.2) / 3, 2);
    expect(e.status).toBe('VALID');
  });

  it('ROE trend is unavailable with fewer than four years', async () => {
    const e = await valueOf('roe_trend_pp', 'BMRI');
    expect(e.status).toBe('UNAVAILABLE');
    expect(e.value).toBeNull();
  });

  it('P/E versus own history uses prior years only', async () => {
    const e = await valueOf('pe_vs_own_history_pct', 'BBRI');
    const med = (14.3 + 10.2) / 2; // median of 14.5, 14.3, 10.2, 9.7 (2026 is the current year)
    expect(e.value).toBeCloseTo(((9.2 - med) / med) * 100, 1);
  });

  it('drawdown from the 52-week high', async () => {
    const e = await valueOf('drawdown_from_52w_high_pct', 'BBRI');
    expect(e.value).toBeCloseTo((3600 / 5100 - 1) * 100, 1);
    expect(e.observationDate).toBe('2026-09-24');
  });

  it('drawdown is unavailable without price data', async () => {
    const e = await valueOf('drawdown_from_52w_high_pct', 'BBCA');
    expect(e.status).toBe('UNAVAILABLE');
  });

  it('ROE versus peers is unavailable, not fabricated, when peers lack ROE', async () => {
    const fx: FixtureSet = { ...DEV_FIXTURE, ratios: { BBRI: DEV_FIXTURE.ratios!.BBRI! } };
    const e = await valueOf('roe_vs_peer_median_pp', 'BBRI', fx);
    expect(e.status).toBe('UNAVAILABLE');
    expect(e.value).toBeNull();
  });

  it('ROE versus peers uses the frozen peer set', async () => {
    const e = await valueOf('roe_vs_peer_median_pp', 'BBRI');
    // peers BBCA 22.0, BBNI 14.0, BMRI 21.0, BRIS 16.5 -> median 18.75
    expect(e.value).toBeCloseTo(15.1 - 18.75, 2);
  });

  it('yield and dividend-per-share change over the latest two completed years', async () => {
    const y = await valueOf('yield_change_pct', 'BBRI');
    const d = await valueOf('dps_change_pct', 'BBRI');
    expect(y.value).toBeCloseTo(((9.6 - 7.4) / 7.4) * 100, 1);
    expect(d.value).toBeCloseTo(((319 - 288) / 288) * 100, 1);
    expect(y.economicPeriod).toBe('FY2025');
    expect(y.comparisonPeriod).toBe('FY2024');
  });

  it('ignores the partial current year in dividend comparisons', async () => {
    const bbri = DEV_FIXTURE.dividends.BBRI!;
    const fx: FixtureSet = {
      ...DEV_FIXTURE,
      dividends: { BBRI: { ...bbri, annualYieldsPct: [...bbri.annualYieldsPct, { year: 2026, yieldPct: 3.0 }] } },
    };
    const y = await valueOf('yield_change_pct', 'BBRI', fx);
    expect(y.economicPeriod).toBe('FY2025');
  });

  it('earnings minus revenue growth, latest quarter, derived from both growth items', async () => {
    const items = await METRIC_BUILDERS.earnings_minus_revenue_growth_pp!(ctx('BBRI'), 'chk');
    const gap = items.find((e) => e.metric === 'earnings_minus_revenue_growth_pp')!;
    const rev = items.find((e) => e.metric === 'revenue_yoy_pct')!;
    const earn = items.find((e) => e.metric === 'earnings_yoy_pct')!;
    expect(gap.value).toBeCloseTo(earn.value! - rev.value!, 2);
    expect(gap.derivedFrom).toEqual([earn.id, rev.id]);
    expect(gap.economicPeriod).toBe('2025Q2');
  });
});
