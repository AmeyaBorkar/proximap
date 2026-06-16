/**
 * Minimal JSON-over-HTTP helper built on the platform `fetch`. Keeps the core
 * dependency-free while handling timeouts, cancellation, and error surfacing
 * consistently across providers.
 */

/** Default contact identifier sent to OSM services; override per provider. */
export const DEFAULT_USER_AGENT = 'proximap/0.1 (+https://github.com/AmeyaBorkar/proximap)';

export interface RequestOptions {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  /** External cancellation signal; merged with the internal timeout. */
  signal?: AbortSignal;
  /** Abort the request after this many milliseconds (default 20000). */
  timeoutMs?: number;
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

/** Perform an HTTP request and parse the JSON body as `T`. */
export async function requestJson<T>(url: string, options: RequestOptions = {}): Promise<T> {
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
    if (timeout.aborted) {
      throw new HttpError(0, url, `Request timed out after ${timeoutMs} ms`);
    }
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
