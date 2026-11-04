import "server-only";
import { setTimeout as sleep } from "node:timers/promises";
import { z } from "zod";
import { parseTmdbEnv } from "./config.ts";
import { discoverInput, schemas, type DiscoverInput } from "./schemas.ts";

export class TmdbError extends Error {
  readonly code: "configuration" | "input" | "http" | "network" | "timeout" | "payload";
  readonly retryable: boolean;
  readonly status?: number;
  readonly retryAfterMs?: number;
  constructor(code: TmdbError["code"], retryable: boolean, status?: number, retryAfterMs?: number) {
    super(code === "configuration" ? "Invalid TMDB configuration: set server-only TMDB_READ_ACCESS_TOKEN or optional TMDB_API_KEY; use https://api.themoviedb.org/3." : `TMDB request failed (${code}).`);
    this.name = "TmdbError";
    this.code = code;
    this.retryable = retryable;
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

// Shared by provider instances in this process; importer must reuse provider, not parallel processes.
let active = 0;
const waiting: Array<() => void> = [];
async function acquire() {
  if (active >= 4) await new Promise<void>(resolve => waiting.push(resolve));
  else active++;
}
function release() {
  const next = waiting.shift();
  if (next) next(); else active--;
}

type Dependencies = {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<unknown>;
  random?: () => number;
  now?: () => number;
};

export function createTmdbProvider(source: Record<string, string | undefined> = process.env, dependencies: Dependencies = {}) {
  let auth: ReturnType<typeof parseTmdbEnv>;
  try { auth = parseTmdbEnv(source); } catch { throw new TmdbError("configuration", false); }
  const fetcher = dependencies.fetch ?? fetch;
  const pause = dependencies.sleep ?? sleep;
  const random = dependencies.random ?? Math.random;
  const now = dependencies.now ?? Date.now;

  async function request<T>(path: string, schema: z.ZodType<T>, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`https://api.themoviedb.org/3/${path}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    if (auth.key) url.searchParams.set("api_key", auth.key);
    for (let attempt = 0; ; attempt++) {
      await acquire();
      let failure: TmdbError;
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const operation = async () => {
          const response = await fetcher(url, { headers: { Accept: "application/json", ...(auth.token ? { Authorization: `Bearer ${auth.token}` } : {}) },
            cache: "no-store", redirect: "error", signal: controller.signal });
          if (!response.ok) {
            // Do not parse or log provider error bodies: they may echo secrets or movie data.
            void response.body?.cancel().catch(() => {});
            const raw = response.headers.get("retry-after");
            const delay = raw === null ? undefined : /^\d+(\.\d+)?$/.test(raw) ? Number(raw) * 1000 : Date.parse(raw) - now();
            throw new TmdbError("http", response.status === 429 || [500, 502, 503, 504].includes(response.status), response.status,
              delay !== undefined && Number.isFinite(delay) ? Math.max(0, delay) : undefined);
          }
          let value: unknown;
          try { value = await response.json(); } catch (error) {
            if (controller.signal.aborted) throw new TmdbError("timeout", true);
            if (error instanceof TypeError) throw new TmdbError("network", true);
            throw new TmdbError("payload", false);
          }
          const parsed = schema.safeParse(value);
          if (!parsed.success) throw new TmdbError("payload", false);
          return parsed.data;
        };
        return await Promise.race([operation(), new Promise<never>((_, reject) => {
          timer = setTimeout(() => { controller.abort(); reject(new TmdbError("timeout", true)); }, 8000);
        })]);
      } catch (error) {
        failure = error instanceof TmdbError ? error : new TmdbError(controller.signal.aborted ? "timeout" : "network", true);
      } finally {
        clearTimeout(timer);
        release();
      }
      if (!failure.retryable || attempt >= 2) throw failure;
      // ponytail: no worker sleeps beyond 60s; longer Retry-After returns error without an early retry.
      const delay = Math.max(500 * 2 ** attempt + Math.floor(random() * 250), failure.retryAfterMs ?? 0);
      if (delay > 60000) throw failure;
      await pause(delay);
    }
  }

  function movieRequest<T extends { id: number }>(id: number, suffix: string, schema: z.ZodType<T>, params = {}) {
    if (!Number.isSafeInteger(id) || id <= 0) throw new TmdbError("input", false);
    return request(`movie/${id}${suffix}`, schema, params).then(value => {
      if (value.id !== id) throw new TmdbError("payload", false);
      return value;
    });
  }

  return {
    source: "tmdb" as "tmdb" | "fixture",
    configuration: () => request("configuration", schemas.configuration),
    genres: () => request("genre/movie/list", schemas.genres, { language: "en-US" }),
    discover: (input: DiscoverInput) => {
      const parsed = discoverInput.safeParse(input);
      if (!parsed.success) throw new TmdbError("input", false);
      const value = parsed.data;
      const params: Record<string, string> = { language: "en-US", include_adult: "false", include_video: "false",
        page: String(value.page), sort_by: value.sortBy, "primary_release_date.lte": value.releasedBefore,
        "vote_count.gte": String(value.minVotes), "with_runtime.gte": "60" };
      if (value.maxVotes !== undefined) params["vote_count.lte"] = String(value.maxVotes);
      if (value.minRating !== undefined) params["vote_average.gte"] = String(value.minRating);
      return request("discover/movie", schemas.discover, params).then(result => {
        if (result.page !== value.page) throw new TmdbError("payload", false);
        return result;
      });
    },
    details: (id: number) => movieRequest(id, "", schemas.details, { language: "en-US" }),
    credits: (id: number) => movieRequest(id, "/credits", schemas.credits, { language: "en-US" }),
    aliases: (id: number) => movieRequest(id, "/alternative_titles", schemas.aliases),
    images: (id: number) => movieRequest(id, "/images", schemas.images),
  };
}

export type MovieProvider = ReturnType<typeof createTmdbProvider>;
