import { describe, expect, it } from 'vitest';
import type { SectorsDataSource } from '@counterpoint/sectors';
import { EntityService, searchTerm } from '../src/entity/entity.service';
import { CompanyIndex } from '../src/entity/company-index';

const COMPANIES = [
  { ticker: 'WIFI', name: 'PT Solusi Sinergi Digital Tbk' },
  { ticker: 'BMRI', name: 'PT Bank Mandiri (Persero) Tbk' },
  { ticker: 'BBRI', name: 'PT Bank Rakyat Indonesia (Persero) Tbk' },
  { ticker: 'BBCA', name: 'PT Bank Central Asia Tbk' },
];

let sectorsCalls = 0;

/** Mirrors the live search: an exact ticker for 4-letter terms, otherwise `company_name like '%term%'`. */
const source = {
  async searchCompanies(query: string) {
    sectorsCalls++;
    const ticker = query.toUpperCase();
    return COMPANIES.filter((c) => (/^[A-Z]{4}$/.test(ticker) && c.ticker === ticker) || c.name.includes(query));
  },
} as unknown as SectorsDataSource;

/** Without an index, every mention goes to the Sectors search. */
const service = new EntityService(source, new CompanyIndex([]));

describe('searchTerm', () => {
  it('drops the legal form, which listings spell inconsistently', () => {
    expect(searchTerm('PT Solusi Sinergi Digital Tbk.')).toBe('Solusi Sinergi Digital');
    expect(searchTerm('PT. Bank Mandiri (Persero) Tbk')).toBe('Bank Mandiri');
    expect(searchTerm('BBRI')).toBe('BBRI');
  });
});

describe('EntityService.resolve', () => {
  it('finds a company written with its full legal name', async () => {
    const r = await service.resolve('PT Solusi Sinergi Digital Tbk.');
    expect(r).toMatchObject({ ticker: 'WIFI', resolutionStatus: 'RESOLVED' });
  });

  it('asks to confirm the model’s ticker guess when the name finds nothing', async () => {
    const r = await service.resolve('Surge', 'WIFI');
    expect(r).toMatchObject({ ticker: null, resolutionStatus: 'AMBIGUOUS', candidates: [{ ticker: 'WIFI', name: 'PT Solusi Sinergi Digital Tbk' }] });
  });

  it('ignores a guess that is not a listed ticker', async () => {
    const r = await service.resolve('Surge', 'SURG');
    expect(r).toMatchObject({ resolutionStatus: 'UNKNOWN', candidates: [] });
  });

  it('puts the guess first among several matches, without choosing it', async () => {
    const r = await service.resolve('Bank', 'BBCA');
    expect(r.resolutionStatus).toBe('AMBIGUOUS');
    expect(r.candidates[0]!.ticker).toBe('BBCA');
    expect(r.candidates).toHaveLength(3);
  });
});

describe('EntityService.resolveAll', () => {
  it('passes the model’s guesses through to resolution', async () => {
    const out = await service.resolveAll('Surge membagikan dividen', [{ mention: 'Surge', ticker_guess: 'WIFI' }]);
    expect(out).toEqual([expect.objectContaining({ mention: 'Surge', resolutionStatus: 'AMBIGUOUS' })]);
    expect(out[0]!.candidates.map((c) => c.ticker)).toEqual(['WIFI']);
  });
});

describe('EntityService with the company index', () => {
  const index = new CompanyIndex(
    [
      { ticker: 'WIFI', name: 'PT Solusi Sinergi Digital Tbk' },
      { ticker: 'BBCA', name: 'PT Bank Central Asia Tbk', aliases: ['BCA'] },
      { ticker: 'ASII', name: 'PT Astra International Tbk', aliases: ['Astra'] },
      { ticker: 'AALI', name: 'PT Astra Agro Lestari Tbk', aliases: ['Astra'] },
    ],
    { WIFI: ['Surge'] },
  );
  const indexed = new EntityService(source, index);

  it('resolves names, nicknames and tickers it knows without calling Sectors', async () => {
    sectorsCalls = 0;
    expect(await indexed.resolve('Surge')).toMatchObject({ ticker: 'WIFI', canonicalName: 'PT Solusi Sinergi Digital Tbk', resolutionStatus: 'RESOLVED' });
    expect(await indexed.resolve('BCA')).toMatchObject({ ticker: 'BBCA', resolutionStatus: 'RESOLVED' });
    expect(await indexed.resolve('BBCA')).toMatchObject({ ticker: 'BBCA', resolutionStatus: 'RESOLVED' });
    expect(sectorsCalls).toBe(0);
  });

  it('asks which company is meant when a nickname is shared', async () => {
    const r = await indexed.resolve('Astra');
    expect(r.resolutionStatus).toBe('AMBIGUOUS');
    expect(r.candidates.map((c) => c.ticker).sort()).toEqual(['AALI', 'ASII']);
  });

  it('falls back to the Sectors search for a company the index lacks', async () => {
    expect(await indexed.resolve('Bank Mandiri')).toMatchObject({ ticker: 'BMRI', resolutionStatus: 'RESOLVED' });
  });

  it('checks the model’s guess against the index', async () => {
    sectorsCalls = 0;
    const r = await indexed.resolve('Perusahaan Tanpa Nama', 'BBCA');
    expect(r).toMatchObject({ resolutionStatus: 'AMBIGUOUS', candidates: [{ ticker: 'BBCA' }] });
    expect(sectorsCalls).toBe(1);
  });

  it('when the model names no company, offers names found in the text for confirmation', async () => {
    const out = await indexed.resolveAll('Surge pendapatannya tumbuh kuat.', []);
    expect(out).toEqual([expect.objectContaining({ mention: 'Surge', ticker: null, resolutionStatus: 'AMBIGUOUS', candidates: [{ ticker: 'WIFI', name: 'PT Solusi Sinergi Digital Tbk' }] })]);
  });

  it('does not scan the text when the model already found a company', async () => {
    const out = await indexed.resolveAll('BCA dan Surge tumbuh kuat.', [{ mention: 'BCA', ticker_guess: 'BBCA' }]);
    expect(out.map((r) => r.ticker)).toEqual(['BBCA']);
  });

  it('skips capitalised words that are not listed tickers, without calling Sectors', async () => {
    sectorsCalls = 0;
    const out = await indexed.resolveAll('Kata OJK, BBCA growth kuat.', []);
    expect(out.map((r) => r.ticker)).toEqual(['BBCA']);
    expect(sectorsCalls).toBe(0);
  });
});
