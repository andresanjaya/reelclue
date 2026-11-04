# RC-005 — server-only TMDB provider

4 November 2026. Branch `feat/rc-005-tmdb-provider`, based on `97fa3a1` after RC-004 #32 merged. RC-002 prerequisite merged. Backend only; no UI change, catalog import, DB writes or public endpoint.

## Usage and boundaries

```ts
import { createTmdbProvider, type MovieProvider } from "@/lib/server/tmdb/client";
import { createFakeMovieProvider } from "@/lib/server/tmdb/fake";

const provider: MovieProvider = createFakeMovieProvider(); // Explicit fictional fixture; no network.
// const provider = createTmdbProvider(); // Reads server env only when called.
const page = await provider.discover({ sortBy: "vote_count.desc", releasedBefore: "2026-08-01" });
```

All four modules under `src/lib/server/tmdb/` import `server-only`. `MovieProvider` is the inferred adapter contract; importer can inject real or fake implementation without another abstraction. No new dependency. Static pages/builds need no TMDB config. Do not pass adapter results directly into a client component or API response: these contain titles/aliases/poster paths by design for **server ingestion only**. Future public DTOs must explicitly allowlist permitted clue data. No provider logging, raw error causes or client imports added.

`createTmdbProvider()` requires server `TMDB_READ_ACCESS_TOKEN`; optional `TMDB_API_KEY` works only when no token is supplied. Bearer token wins when both configured. Missing, placeholder or malformed credentials fail with constant helpful configuration error without values. Base URL defaults to and accepts only `https://api.themoviedb.org/3`; alternate hosts, userinfo, paths and insecure origins cannot receive credentials. Requests use `redirect: error`, `cache: no-store`, `Accept: application/json`, English metadata. API-key fallback uses TMDB's required `api_key` query parameter; token path never places credential in URL. Never enable URL/request tracing that records query keys or Authorization headers.

Methods: `configuration`, `genres`, `discover`, `details`, `credits`, `aliases`, `images`. Zod validates consumed provider fields and strips extras; missing/wrong types, invalid IDs/dates/image paths, mismatched movie IDs or discovery pages fail without raw validation details. Null runtime/revenue/poster/overview and empty release date are represented instead of invented facts. Eligibility/alias approval/synopsis sanitization stay with importer and rule tickets. Image configuration accepts only official HTTPS image base; adapter returns metadata, never fetches poster bytes.

Discovery takes one validated page (1–500), explicit sort slice and release cutoff, vote minimum ≥500, optional maximum/rating. Sends `include_adult=false`, `include_video=false`, `with_runtime.gte=60`. No automatic pagination, catalog scraping or arbitrary query passthrough. RC-006 supplies bounded slices/batches and evaluates 90-day cutoff/status/eligibility against full movie details; provider filter alone is not proof of eligibility.

## Failure and request limits

- Each attempt has 8-second deadline covering headers and JSON body; aborts native fetch. Queue time and retry waits are outside attempt deadline.
- Maximum four active requests across provider instances in one Node process. Slot held through body validation, released before retry sleep and on failure. No fleet-wide limiter: importer must reuse provider and not fan out processes to bypass bound.
- At most two retries, three attempts total, for network/body-transport failure, timeout, HTTP 429/500/502/503/504. HTTP 400/401/403/404/422 and other permanent responses, schema or JSON syntax errors do not retry.
- Exponential delay `500 * 2 ** attempt + floor(random() * 250)` ms, or parsed `Retry-After` seconds/HTTP-date, whichever is longer. Invalid/past header cannot shorten baseline delay. No wait longer than 60 seconds: return sanitized retryable error with `retryAfterMs` rather than retrying earlier than requested. Caller decides later rescheduling; no scheduler added.
- `TmdbError` exposes only fixed `code`, `retryable`, optional status/retry interval, constant message. No URL, credential, raw provider body, Zod details, hidden movie answer or nested original error. Callers must still map errors to safe public DTOs.
- Native fetch/AbortController/timers and installed Zod only. Injected fetch/sleep/random/clock support deterministic tests; production uses native defaults. Fake transport runs through same response validation, carries `source: "fixture"`, never falls back to live network. Fixture has one fictional film, no artwork, not sufficient production gameplay catalog.

## Validation

Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:db`, `pnpm build`.

Final local results: lint/typecheck/build passed; `pnpm test` passed 4 files / 52 tests (33 provider cases); `pnpm test:db` passed migrations, role/RLS/RPC constraints, coverage and retention on fresh isolated PostgreSQL. No package or lockfile change needed.

Unit coverage includes credential precedence/key fallback/redacted config, request headers/no-store/redirect policy, safe discovery filters and invalid input, seven typed adapters via fixture, permanent HTTP status denial, transient retry cap/jitter, seconds/date/invalid/long Retry-After, malformed responses across adapters, ID mismatch, network exception/body failure, eight-second header/body timeouts, timeout recovery, four-slot bound across instances, slot release and server-only/no-logging guards. Existing UI/DB tests remain required. Real DB regression harness uses disconnected PostgreSQL, not TMDB credentials.

No `.env.local` or configured TMDB credential found (presence check only; no value printed). Live authenticated smoke check **not run**. No live TMDB/catalog import, owner DB writes, images or third-party data in fixtures. Hosted Supabase and physical-browser checks are unrelated to this adapter ticket and not claimed.

## Review steps

1. Review `config.ts` credential precedence/fixed host, `client.ts` timeout/retry/concurrency/error boundaries and `schemas.ts` consumed-field validation.
2. Run checks above; tests must work without credentials and make no live TMDB request. Verify fixture source remains explicit and network fallback absent.
3. Review permanent status behavior, long Retry-After ceiling and four-active-request scope. Inspect import graph: no application route or client component imports provider.
4. If owner later supplies private `.env.local`, perform small server-only configuration/details smoke check without logging token, URL queries, titles/aliases or raw payload. Do not run catalog import as part of RC-005 review.

## References checked

- https://developer.themoviedb.org/docs/authentication-application — Bearer preferred; API key supported via query.
- https://developer.themoviedb.org/reference/discover-movie — supported filters/sort/page fields.
- https://developer.themoviedb.org/docs/rate-limiting — current limits can change; respect 429, no fixed quota assumed.
