// @vitest-environment node
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { createTmdbProvider, TmdbError } from "../../src/lib/server/tmdb/client";
import { parseTmdbEnv } from "../../src/lib/server/tmdb/config";
import { createFakeMovieProvider } from "../../src/lib/server/tmdb/fake";

const env = { TMDB_READ_ACCESS_TOKEN: "fictional-test-token" };
const config = { images: { secure_base_url: "https://image.tmdb.org/t/p/", poster_sizes: ["w300", "original"] } };
const input = { sortBy: "vote_count.desc" as const, releasedBefore: "2026-08-01" };
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("TMDB provider", () => {
  it("validates credential choice and fixed destination without exposing configuration", () => {
    expect(parseTmdbEnv({ ...env, TMDB_API_KEY: "bad-key" })).toEqual({ token: env.TMDB_READ_ACCESS_TOKEN });
    expect(parseTmdbEnv({ TMDB_API_KEY: "a".repeat(32) })).toEqual({ key: "a".repeat(32) });
    for (const source of [{}, { TMDB_READ_ACCESS_TOKEN: "replace_privately" }, { TMDB_READ_ACCESS_TOKEN: "token\nheader" },
      { ...env, TMDB_API_BASE_URL: "https://private.invalid/credential" }]) {
      expect(() => createTmdbProvider(source)).toThrow("set server-only TMDB_READ_ACCESS_TOKEN");
      try { createTmdbProvider(source); } catch (error) {
        expect(JSON.stringify(error)).not.toContain("private.invalid");
        expect(String(error)).not.toContain("token\nheader");
      }
    }
  });

  it("uses Bearer/no-store/no-redirect, strips unknown data, and only uses query key as fallback", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({ ...config, secret_extra: "discard" }));
    const provider = createTmdbProvider(env, { fetch: fetcher });
    expect(await provider.configuration()).toEqual(config);
    const [url, options] = fetcher.mock.calls[0];
    expect(String(url)).toBe("https://api.themoviedb.org/3/configuration");
    expect(options).toMatchObject({ headers: { Authorization: "Bearer fictional-test-token", Accept: "application/json" }, cache: "no-store", redirect: "error" });
    await createTmdbProvider({ TMDB_API_KEY: "a".repeat(32) }, { fetch: fetcher }).configuration();
    expect(new URL(String(fetcher.mock.calls[1][0])).searchParams.get("api_key")).toBe("a".repeat(32));
    expect(fetcher.mock.calls[1][1]?.headers).not.toHaveProperty("Authorization");
  });

  it("validates discovery before sending safe bounded filters", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({ page: 1, results: [], total_pages: 0, total_results: 0 }));
    const provider = createTmdbProvider(env, { fetch: fetcher });
    for (const invalid of [{ ...input, page: 501 }, { ...input, minVotes: 499 }, { ...input, maxVotes: 499 },
      { ...input, releasedBefore: "2026-02-30" }, { ...input, include_adult: true }]) {
      expect(() => provider.discover(invalid)).toThrow(TmdbError);
    }
    expect(fetcher).not.toHaveBeenCalled();
    await provider.discover({ ...input, maxVotes: 9999, minRating: 7 });
    const query = new URL(String(fetcher.mock.calls[0][0])).searchParams;
    expect(Object.fromEntries(query)).toMatchObject({ include_adult: "false", include_video: "false", page: "1", language: "en-US",
      "vote_count.gte": "500", "vote_count.lte": "9999", "vote_average.gte": "7", "with_runtime.gte": "60", "primary_release_date.lte": "2026-08-01" });
  });

  it("provides all seven typed adapters through network-free fictional injection", async () => {
    const network = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network forbidden"));
    const provider = createFakeMovieProvider();
    expect(provider.source).toBe("fixture");
    expect(await provider.configuration()).toEqual(config);
    expect((await provider.genres()).genres).toHaveLength(1);
    expect((await provider.discover(input)).results[0].title).toBe("Fictional Lantern");
    expect((await provider.details(1)).runtime).toBe(90);
    expect((await provider.credits(1)).crew[0].job).toBe("Director");
    expect((await provider.aliases(1)).titles[0].title).toBe("Fixture Alias");
    expect((await provider.images(1)).posters).toEqual([]);
    await expect(provider.details(2)).rejects.toMatchObject({ status: 404, retryable: false });
    expect(network).not.toHaveBeenCalled();
  });

  it.each([400, 401, 403, 404, 422])("does not retry HTTP %i or echo provider error bodies", async status => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response("hidden answer and secret", { status }));
    const pause = vi.fn();
    await expect(createTmdbProvider(env, { fetch: fetcher, sleep: pause }).configuration()).rejects.toMatchObject({ code: "http", status, retryable: false });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(pause).not.toHaveBeenCalled();
  });

  it.each([429, 500, 502, 503, 504])("retries HTTP %i at most twice with exponential jitter", async status => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response(null, { status }));
    const pause = vi.fn().mockResolvedValue(undefined);
    await expect(createTmdbProvider(env, { fetch: fetcher, sleep: pause, random: () => 0.5 }).configuration()).rejects.toMatchObject({ status });
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(pause.mock.calls).toEqual([[625], [1125]]);
  });

  it.each(["2", "Wed, 04 Nov 2026 00:00:03 GMT"])("respects Retry-After %s", async header => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(null, { status: 429, headers: { "Retry-After": header } }))
      .mockImplementation(async () => Response.json(config));
    const pause = vi.fn().mockResolvedValue(undefined);
    await createTmdbProvider(env, { fetch: fetcher, sleep: pause, random: () => 0, now: () => Date.parse("2026-11-04T00:00:00Z") }).configuration();
    expect(pause).toHaveBeenCalledWith(header === "2" ? 2000 : 3000);
  });

  it("does not retry early when Retry-After exceeds bounded sleep budget", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 429, headers: { "Retry-After": "120" } }));
    const pause = vi.fn();
    await expect(createTmdbProvider(env, { fetch: fetcher, sleep: pause }).configuration()).rejects.toMatchObject({ status: 429, retryAfterMs: 120000 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(pause).not.toHaveBeenCalled();
  });

  it("retries network failure without retaining raw exception, URL, credentials or answer", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error("fictional-test-token hidden-title https://private.invalid"));
    const provider = createTmdbProvider(env, { fetch: fetcher, sleep: async () => {} });
    const error = await provider.configuration().catch(value => value);
    expect(error).toMatchObject({ code: "network", retryable: true });
    expect(`${error}${JSON.stringify(error)}`).not.toMatch(/fictional-test-token|hidden-title|private.invalid/);
    expect(error.cause).toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it.each(["json", "schema", "host"])("rejects malformed %s without retry or leaked parse details", async kind => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => kind === "json" ? new Response("{hidden-title") :
      Response.json(kind === "host" ? { images: { ...config.images, secure_base_url: "https://private.invalid/" } } : { images: "hidden-title" }));
    const error = await createTmdbProvider(env, { fetch: fetcher }).configuration().catch(value => value);
    expect(error).toMatchObject({ code: "payload", retryable: false });
    expect(String(error)).not.toContain("hidden-title");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("validates IDs and rejects mismatched response identities", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ id: 2, titles: [] }));
    const provider = createTmdbProvider(env, { fetch: fetcher });
    for (const id of [0, -1, 1.5, NaN, Number.MAX_SAFE_INTEGER + 1]) expect(() => provider.aliases(id)).toThrow(TmdbError);
    expect(fetcher).not.toHaveBeenCalled();
    await expect(provider.aliases(1)).rejects.toMatchObject({ code: "payload" });
  });

  it.each(["genres", "discover", "details", "credits", "aliases", "images"] as const)("validates %s response shape without coercion or retry", async method => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({ id: 1, invalid: "hidden-title" }));
    const provider = createTmdbProvider(env, { fetch: fetcher });
    const result = method === "genres" ? provider.genres() : method === "discover" ? provider.discover(input) : provider[method](1);
    await expect(result).rejects.toMatchObject({ code: "payload", retryable: false });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("recovers from network body failure and ignores invalid Retry-After using normal backoff", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce({ ok: true, json: async () => { throw new TypeError("private stream error"); } } as unknown as Response)
      .mockResolvedValueOnce(new Response(null, { status: 503, headers: { "Retry-After": "invalid" } }))
      .mockImplementation(async () => Response.json(config));
    const pause = vi.fn().mockResolvedValue(undefined);
    expect(await createTmdbProvider(env, { fetch: fetcher, sleep: pause, random: () => 0 }).configuration()).toEqual(config);
    expect(pause.mock.calls).toEqual([[500], [1000]]);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("times out stalled response headers, then recovers without leaking concurrency slot", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>().mockImplementationOnce(() => new Promise(() => {}))
      .mockImplementation(async () => Response.json(config));
    const result = createTmdbProvider(env, { fetch: fetcher, sleep: async () => {} }).configuration();
    await vi.advanceTimersByTimeAsync(8000);
    expect(await result).toEqual(config);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("aborts each request at eight seconds, including stalled JSON body, with two retries maximum", async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, options) => {
      signals.push(options!.signal!);
      return { ok: true, json: () => new Promise(() => {}) } as Response;
    });
    const promise = createTmdbProvider(env, { fetch: fetcher, sleep: async () => {} }).configuration();
    const checked = expect(promise).rejects.toMatchObject({ code: "timeout", retryable: true });
    await vi.advanceTimersByTimeAsync(24000);
    await checked;
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(signals.every(signal => signal.aborted)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("caps active requests at four across instances and releases slots after failures", async () => {
    let active = 0; let peak = 0;
    const resolvers: Array<() => void> = [];
    const fetcher: typeof fetch = async () => {
      active++; peak = Math.max(peak, active);
      await new Promise<void>(resolve => resolvers.push(resolve));
      active--;
      return Response.json(config);
    };
    const providers = [createTmdbProvider(env, { fetch: fetcher }), createTmdbProvider(env, { fetch: fetcher })];
    const results = Array.from({ length: 10 }, (_, i) => providers[i % 2].configuration());
    for (let i = 0; i < 10; i++) {
      await vi.waitFor(() => expect(resolvers.length).toBeGreaterThan(0));
      resolvers.shift()!();
    }
    await Promise.all(results);
    expect(peak).toBe(4);
    expect(active).toBe(0);
    await expect(createFakeMovieProvider().details(2)).rejects.toMatchObject({ status: 404 });
    expect((await createFakeMovieProvider().details(1)).id).toBe(1);
  });

  it("marks every provider module server-only and performs no logging", () => {
    for (const name of ["client", "config", "schemas", "fake"]) {
      const text = readFileSync(`src/lib/server/tmdb/${name}.ts`, "utf8");
      expect(text).toMatch(/^import "server-only";/);
      expect(text).not.toMatch(/console\./);
    }
  });
});
