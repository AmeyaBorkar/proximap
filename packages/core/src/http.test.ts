import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpError, InMemoryCache, RateLimiter, requestJson } from './http';

function makeResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: `S${status}`,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function mockSequence(responses: { status: number; body: unknown }[]) {
  let index = 0;
  const fetchMock = vi.fn(async (_input: unknown, _init?: RequestInit): Promise<Response> => {
    const response = responses[Math.min(index, responses.length - 1)]!;
    index += 1;
    return makeResponse(response.status, response.body);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe('requestJson retries', () => {
  it('retries a 429 then succeeds', async () => {
    const fetchMock = mockSequence([
      { status: 429, body: {} },
      { status: 200, body: { ok: true } },
    ]);
    const result = await requestJson<{ ok: boolean }>('https://x.test', {
      retries: 1,
      retryDelayMs: 0,
    });
    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up after exhausting retries', async () => {
    const fetchMock = mockSequence([{ status: 429, body: {} }]);
    await expect(
      requestJson('https://x.test', { retries: 1, retryDelayMs: 0 }),
    ).rejects.toBeInstanceOf(HttpError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry a non-transient 404', async () => {
    const fetchMock = mockSequence([{ status: 404, body: {} }]);
    await expect(
      requestJson('https://x.test', { retries: 3, retryDelayMs: 0 }),
    ).rejects.toBeInstanceOf(HttpError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('requestJson cache', () => {
  it('serves an identical second request from cache', async () => {
    const fetchMock = mockSequence([{ status: 200, body: { v: 1 } }]);
    const cache = new InMemoryCache();
    const first = await requestJson('https://x.test/a', { cache });
    const second = await requestJson('https://x.test/a', { cache });
    expect(first).toEqual({ v: 1 });
    expect(second).toEqual({ v: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('RateLimiter', () => {
  it('spaces consecutive acquisitions', async () => {
    const limiter = new RateLimiter(40);
    const start = Date.now();
    await limiter.acquire();
    await limiter.acquire();
    expect(Date.now() - start).toBeGreaterThanOrEqual(30);
  });

  it('does not delay when the interval is zero', async () => {
    const limiter = new RateLimiter(0);
    const start = Date.now();
    await limiter.acquire();
    await limiter.acquire();
    expect(Date.now() - start).toBeLessThan(20);
  });
});
