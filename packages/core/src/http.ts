/**
 * Minimal JSON-over-HTTP helper built on the platform `fetch`. Keeps the core
 * dependency-free while handling timeouts, cancellation, retries with backoff,
 * optional caching, and consistent error surfacing across providers.
 */

/** Default contact identifier sent to OSM services; override per provider. */
export const DEFAULT_USER_AGENT = 'proximap/0.1 (+https://github.com/AmeyaBorkar/proximap)';

/** A pluggable response cache. Values are parsed JSON. */
export interface RequestCache {
  get(key: string): Promise<unknown> | unknown;
  set(key: string, value: unknown): Promise<void> | void;
}

/** A process-local, unbounded cache. Opt-in — pass it to a provider to enable. */
export class InMemoryCache implements RequestCache {
  private readonly store = new Map<string, unknown>();
  get(key: string): unknown {
    return this.store.get(key);
  }
  set(key: string, value: unknown): void {
    this.store.set(key, value);
  }
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Serializes calls so that consecutive `acquire()`s are spaced at least
 * `minIntervalMs` apart — for honouring usage policies (e.g. Nominatim's 1 req/s).
 */
export class RateLimiter {
  private last = 0;
  private chain: Promise<void> = Promise.resolve();

  constructor(private readonly minIntervalMs: number) {}

  acquire(): Promise<void> {
    this.chain = this.chain.then(async () => {
      if (this.minIntervalMs <= 0) return;
      const wait = this.last + this.minIntervalMs - Date.now();
      if (wait > 0) await sleep(wait);
      this.last = Date.now();
    });
    return this.chain;
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  /** External cancellation signal; merged with the internal timeout. */
  signal?: AbortSignal;
  /** Abort the request after this many milliseconds (default 20000). */
  timeoutMs?: number;
  /** Retry attempts on transient failures (429/5xx/timeout/network). Default 0. */
  retries?: number;
  /** Base backoff delay in ms, doubled each attempt (default 500). */
  retryDelayMs?: number;
  /** Optional response cache, keyed by method + url + body. */
  cache?: RequestCache;
}

/** Thrown when a request times out or returns a non-2xx response. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

function isRetryable(error: unknown): boolean {
  if (error instanceof HttpError) {
    return error.status === 0 || error.status === 429 || error.status >= 500;
  }
  if (error instanceof Error && error.name === 'AbortError') return false;
  return true; // treat unexpected network errors as transient
}

async function fetchJsonOnce<T>(url: string, options: RequestOptions): Promise<T> {
  const { method = 'GET', headers = {}, body, signal, timeoutMs = 20_000 } = options;
  const timeout = AbortSignal.timeout(timeoutMs);
  const composite = signal ? AbortSignal.any([signal, timeout]) : timeout;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: { 'User-Agent': DEFAULT_USER_AGENT, Accept: 'application/json', ...headers },
      ...(body === undefined ? {} : { body }),
      signal: composite,
    });
  } catch (error) {
    if (timeout.aborted) throw new HttpError(0, url, `Request timed out after ${timeoutMs} ms`);
    throw error;
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new HttpError(
      response.status,
      url,
      `${response.status} ${response.statusText}: ${detail.slice(0, 200)}`.trim(),
    );
  }
  return (await response.json()) as T;
}

/** Perform an HTTP request and parse the JSON body as `T`, with retry + cache. */
export async function requestJson<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, retries = 0, retryDelayMs = 500, cache } = options;
  const cacheKey = cache ? `${method} ${url} ${body ?? ''}` : undefined;

  if (cache && cacheKey !== undefined) {
    const cached = await cache.get(cacheKey);
    if (cached !== undefined) return cached as T;
  }

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(retryDelayMs * 2 ** (attempt - 1));
    try {
      const value = await fetchJsonOnce<T>(url, options);
      if (cache && cacheKey !== undefined) await cache.set(cacheKey, value);
      return value;
    } catch (error) {
      lastError = error;
      if (attempt === retries || !isRetryable(error)) throw error;
    }
  }
  throw lastError;
}
