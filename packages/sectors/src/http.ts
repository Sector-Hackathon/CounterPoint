export interface SectorsHttpOptions {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  cacheTtlMs?: number;
  fetchImpl?: typeof fetch;
  onCall?: (event: SectorsCallEvent) => void;
}

export interface SectorsCallEvent {
  locator: string;
  cacheHit: boolean;
  status: number | null;
  latencyMs: number;
  attempt: number;
  error?: string;
}

export interface SectorsResponse<T = unknown> {
  data: T;
  locator: string;
  retrievedAt: string;
}

export class SectorsHttpError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly locator: string,
  ) {
    super(message);
  }
}

/**
 * Thin authenticated GET client: bounded timeout, a single retry for transient failures,
 * in-memory TTL cache, and a per-call event hook for credit accounting (NFR-006).
 */
export class SectorsHttpClient {
  private readonly cache = new Map<string, { expires: number; value: SectorsResponse }>();
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly opts: SectorsHttpOptions) {
    if (!opts.apiKey) throw new Error('SECTORS_API_KEY is required');
    this.baseUrl = (opts.baseUrl ?? 'https://api.sectors.app/v1').replace(/\/$/, '');
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async get<T = unknown>(path: string, query: Record<string, string> = {}): Promise<SectorsResponse<T>> {
    const qs = new URLSearchParams(query).toString();
    const locator = `sectors:${path}${qs ? `?${qs}` : ''}`;
    const cached = this.cache.get(locator);
    if (cached && cached.expires > Date.now()) {
      this.opts.onCall?.({ locator, cacheHit: true, status: 200, latencyMs: 0, attempt: 0 });
      return cached.value as SectorsResponse<T>;
    }

    const url = `${this.baseUrl}${path}${qs ? `?${qs}` : ''}`;
    let lastError: SectorsHttpError | null = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const started = Date.now();
      try {
        const res = await this.fetchImpl(url, {
          headers: { Authorization: this.opts.apiKey, Accept: 'application/json' },
          signal: AbortSignal.timeout(this.opts.timeoutMs ?? 15_000),
        });
        this.opts.onCall?.({ locator, cacheHit: false, status: res.status, latencyMs: Date.now() - started, attempt });
        if (!res.ok) {
          lastError = new SectorsHttpError(`Sectors ${res.status} for ${path}`, res.status, locator);
          if (res.status >= 500 || res.status === 429) continue;
          throw lastError;
        }
        const value: SectorsResponse = {
          data: await res.json(),
          locator,
          retrievedAt: new Date().toISOString(),
        };
        this.cache.set(locator, { expires: Date.now() + (this.opts.cacheTtlMs ?? 15 * 60_000), value });
        return value as SectorsResponse<T>;
      } catch (err) {
        if (err instanceof SectorsHttpError && err.status !== null && err.status < 500 && err.status !== 429) {
          throw err;
        }
        const message = err instanceof Error ? err.message : String(err);
        this.opts.onCall?.({ locator, cacheHit: false, status: null, latencyMs: Date.now() - started, attempt, error: message });
        lastError = err instanceof SectorsHttpError ? err : new SectorsHttpError(message, null, locator);
      }
    }
    throw lastError!;
  }
}
