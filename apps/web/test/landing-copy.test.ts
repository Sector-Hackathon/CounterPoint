import { describe, expect, it, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

/** Every message the landing page passes to t(), collected while it renders. */
const seen = vi.hoisted(() => new Set<string>());

vi.mock('../components/LanguageProvider', () => ({
  useLanguage: () => ({
    language: 'en',
    t: (message: string) => {
      seen.add(message);
      return message;
    },
  }),
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => createElement('a', { href, ...rest }, children),
}));
vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => createElement('img', { src, alt }),
}));

import { LandingPage } from '../components/LandingPage';
import { translate } from '../lib/locale';

describe('landing page copy', () => {
  it('has an English translation for every message it renders', () => {
    const html = renderToStaticMarkup(createElement(LandingPage));
    // Guards against the collector silently missing the page.
    expect(seen.size).toBeGreaterThan(60);
    const untranslated = [...seen].filter((message) => translate('en', message) === message);
    expect(untranslated).toEqual([]);
    expect(html).toContain('id="how-it-works"');
  });

  it('labels the demonstration as illustrative and keeps verdicts truthful', () => {
    const html = renderToStaticMarkup(createElement(LandingPage));
    // A price prediction is unverifiable in the product, never "not supported".
    expect(html).not.toContain('Tidak didukung');
    expect(html).toContain('Belum terverifikasi');
    expect(html).toContain('XYZ dan semua angka di sini adalah ilustrasi');
    // The product checks company data only; the mockup's news and analyst sources would overclaim.
    expect(html).not.toMatch(/Berita Media|Analisis Independen/);
  });

  it('links every section the header navigation points to', () => {
    const html = renderToStaticMarkup(createElement(LandingPage));
    for (const id of ['why-counterpoint', 'how-it-works', 'faq']) expect(html).toContain(`id="${id}"`);
  });
});
