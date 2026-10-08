import { describe, expect, it } from 'vitest';
import { CompanyIndex, brandFromWebsite, nameKey } from '../src/entity/company-index';

const RECORDS = [
  { ticker: 'BBCA', name: 'PT Bank Central Asia Tbk', aliases: ['BCA', 'BCA Bank'], websites: ['https://www.bca.co.id/'] },
  { ticker: 'BBRI', name: 'PT Bank Rakyat Indonesia (Persero) Tbk', aliases: ['BRI'] },
  { ticker: 'ACES', name: 'PT Aspirasi Hidup Indonesia Tbk', websites: ['http://www.acehardware.co.id'] },
  { ticker: 'AMRT', name: 'PT Sumber Alfaria Trijaya Tbk.', websites: ['https://alfamart.co.id/'] },
  { ticker: 'WIFI', name: 'PT Solusi Sinergi Digital Tbk' },
  { ticker: 'ASII', name: 'PT Astra International Tbk', aliases: ['Astra'] },
  { ticker: 'AALI', name: 'PT Astra Agro Lestari Tbk', aliases: ['Astra'] },
];

const index = new CompanyIndex(RECORDS, { WIFI: ['Surge'] });
const tickers = (mention: string) => index.find(mention).map((c) => c.ticker);

describe('nameKey', () => {
  it('ignores case, punctuation and the legal form', () => {
    expect(nameKey('PT. Bank Central Asia, Tbk.')).toBe('bank central asia');
    expect(nameKey('PT Bank Rakyat Indonesia (Persero) Tbk')).toBe('bank rakyat indonesia');
    expect(nameKey('  Ace-Hardware ')).toBe('ace hardware');
  });
});

describe('brandFromWebsite', () => {
  it('takes the name part of the domain', () => {
    expect(brandFromWebsite('https://alfamart.co.id/')).toBe('alfamart');
    expect(brandFromWebsite('http://www.map-indonesia.com/')).toBe('map indonesia');
    expect(brandFromWebsite('https://ir.bca.co.id/investor')).toBe('bca');
  });

  it('ignores domains too short to be a brand', () => {
    expect(brandFromWebsite('https://ab.co.id')).toBeNull();
    expect(brandFromWebsite('http://http//www.example.co.id')).toBeNull();
    expect(brandFromWebsite('not a url')).toBeNull();
  });
});

describe('CompanyIndex', () => {
  it('looks up a listed ticker', () => {
    expect(index.byTicker('bbca')).toEqual({ ticker: 'BBCA', name: 'PT Bank Central Asia Tbk' });
    expect(index.byTicker('ZZZZ')).toBeNull();
  });

  it('finds a company by legal name written any way', () => {
    expect(tickers('PT Solusi Sinergi Digital Tbk.')).toEqual(['WIFI']);
  });

  it('finds a company by nickname, website brand or hand-written alias', () => {
    expect(tickers('BCA')).toEqual(['BBCA']);
    expect(tickers('Alfamart')).toEqual(['AMRT']);
    expect(tickers('Ace Hardware')).toEqual(['ACES']);
    expect(tickers('surge')).toEqual(['WIFI']);
  });

  it('finds a company by part of its name', () => {
    expect(tickers('Bank Rakyat')).toEqual(['BBRI']);
  });

  it('returns every company sharing a nickname, for the user to choose', () => {
    expect(tickers('Astra').sort()).toEqual(['AALI', 'ASII']);
  });

  it('prefers an exact name over companies that merely contain it', () => {
    expect(tickers('Astra International')).toEqual(['ASII']);
  });

  it('finds nothing for an unknown name', () => {
    expect(tickers('Perusahaan Fiktif')).toEqual([]);
  });
});

describe('CompanyIndex.scan', () => {
  it('finds a capitalised company name in free text', () => {
    expect(index.scan('Surge pendapatannya tumbuh kuat.')).toEqual([{ mention: 'Surge', hits: [{ ticker: 'WIFI', name: 'PT Solusi Sinergi Digital Tbk' }] }]);
  });

  it('prefers the longest name', () => {
    expect(index.scan('Laba Ace Hardware turun.').map((m) => m.mention)).toEqual(['Ace Hardware']);
  });

  it('ignores lower-case words and names too short to be distinctive', () => {
    expect(index.scan('pendapatan surge naik')).toEqual([]);
    expect(index.scan('BRI naik')).toEqual([]);
  });

  it('skips company names that are everyday words, which the model is trusted to report itself', () => {
    const words = new CompanyIndex([{ ticker: 'ARTO', name: 'PT Bank Jago Tbk.', websites: ['https://www.jago.com/'] }]);
    expect(words.scan('Jago banget emiten ini.')).toEqual([]);
    expect(words.find('Jago')).toEqual([{ ticker: 'ARTO', name: 'PT Bank Jago Tbk.' }]);
  });
});
