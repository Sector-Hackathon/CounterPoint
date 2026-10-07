import { describe, expect, it } from 'vitest';
import { sourceLink, subsectorSlug } from '../lib/source-link';

describe('sourceLink', () => {
  it('links a company report to the matching section of the company page', () => {
    expect(sourceLink('sectors:/company/report/TLKM/?sections=dividend')).toEqual({ href: 'https://sectors.app/idx/tlkm#dividend', kind: 'company', subject: 'TLKM' });
    expect(sourceLink('sectors:/company/report/BBRI/?sections=financials')?.href).toBe('https://sectors.app/idx/bbri#financials');
    expect(sourceLink('sectors:/company/report/TLKM/?sections=overview')?.href).toBe('https://sectors.app/idx/tlkm#overview');
  });

  it('uses the first section when a report asks for several', () => {
    expect(sourceLink('sectors:/company/report/TLKM/?sections=valuation%2Cdividend')?.href).toBe('https://sectors.app/idx/tlkm#valuation');
  });

  it('falls back to the top of the company page for an unknown or missing section', () => {
    expect(sourceLink('sectors:/company/report/BBCA/')?.href).toBe('https://sectors.app/idx/bbca');
    expect(sourceLink('sectors:/company/report/BBCA/?sections=ownership_raw')?.href).toBe('https://sectors.app/idx/bbca');
  });

  it('links quarterly financials to the financials section', () => {
    expect(sourceLink('sectors:/financials/quarterly/BBCA/?n_quarters=8')).toEqual({ href: 'https://sectors.app/idx/bbca#financials', kind: 'company', subject: 'BBCA' });
  });

  it('accepts tickers with the .JK suffix', () => {
    expect(sourceLink('sectors:/financials/quarterly/BBCA.JK/?n_quarters=8')?.href).toBe('https://sectors.app/idx/bbca#financials');
  });

  it('links a subsector peer screen to the subsector page', () => {
    expect(sourceLink("sectors:/companies/?where=sub_sector+%3D+%27Telecommunication%27&order_by=-market_cap&limit=10"))
      .toEqual({ href: 'https://sectors.app/indonesia/telecommunication', kind: 'subsector', subject: 'Telecommunication' });
    expect(sourceLink("sectors:/companies/?where=sub_sector+%3D+%27Oil%2C+Gas+%26+Coal%27&limit=10")?.href).toBe('https://sectors.app/indonesia/oil-gas-coal');
  });

  it('falls back to the sector overview for a subsector Sectors has no page for', () => {
    expect(sourceLink("sectors:/companies/?where=sub_sector+%3D+%27Space+Mining%27")?.href).toBe('https://sectors.app/indonesia/economic-sectors');
  });

  it('gives no link for sample data or anything it does not recognise', () => {
    expect(sourceLink('fixture:/company/report/TLKM/?sections=dividend')).toBeNull();
    expect(sourceLink('sectors:/something/else/')).toBeNull();
    expect(sourceLink('')).toBeNull();
  });
});

describe('subsectorSlug', () => {
  it('matches the slugs sectors.app uses', () => {
    expect(subsectorSlug('Banks')).toBe('banks');
    expect(subsectorSlug('Food & Beverage')).toBe('food-beverage');
    expect(subsectorSlug('Pharmaceuticals & Health Care Research')).toBe('pharmaceuticals-health-care-research');
    expect(subsectorSlug('Software & IT Services')).toBe('software-it-services');
  });
});
