export * from './types';
export * from './http';
export * from './adapters';
export * from './source';
export * from './fixtures';

import { SectorsHttpClient, type SectorsCallEvent } from './http';
import { HttpSectorsDataSource } from './source';
import { DEV_FIXTURE, FixtureSectorsDataSource } from './fixtures';
import type { SectorsDataSource } from './types';

/** Live source when an API key is configured, otherwise the labelled synthetic fixture. */
export function createSectorsDataSource(opts: {
  apiKey?: string;
  baseUrl?: string;
  onCall?: (e: SectorsCallEvent) => void;
}): { source: SectorsDataSource; mode: 'live' | 'fixture' } {
  if (!opts.apiKey) return { source: new FixtureSectorsDataSource(DEV_FIXTURE), mode: 'fixture' };
  const http = new SectorsHttpClient({ apiKey: opts.apiKey, baseUrl: opts.baseUrl, onCall: opts.onCall });
  return { source: new HttpSectorsDataSource(http), mode: 'live' };
}
