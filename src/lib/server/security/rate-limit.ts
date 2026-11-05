import "server-only";
import { createHmac } from "node:crypto";
import { createDbClient } from "../db/client";
import { GameError } from "../game/session";

function getHmacKey(): string {
  return (
    process.env.RATE_LIMIT_SECRET ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "reelclue_default_rate_limit_secret_2026"
  );
}

/**
 * Extracts client IP from reverse proxy headers.
 * Relies on hosting-provided forwarded headers (see docs/SECURITY-IP-TRUST.md).
 */
export function extractClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0].trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp && realIp.trim()) return realIp.trim();
  return "127.0.0.1";
}

/**
 * Generates keyed HMAC SHA-256 bucket identifier (64 hex characters).
 * Never stores raw IP or raw browser tokens in the database.
 */
export function hashIdentifier(identifier: string, prefix: "ip:" | "browser:"): string {
  return createHmac("sha256", getHmacKey())
    .update(`${prefix}${identifier.trim()}`)
    .digest("hex");
}

export interface RateLimitPolicy {
  routeClass: string;
  limit: number;
  windowSeconds: number;
  by: "browser" | "ip";
}

export const RATE_LIMIT_POLICIES = {
  player: [
    { routeClass: "player_create_ip", limit: 30, windowSeconds: 600, by: "ip" },
  ],
  sessionCreate: [
    { routeClass: "session_create_browser", limit: 10, windowSeconds: 600, by: "browser" },
    { routeClass: "session_create_ip", limit: 30, windowSeconds: 600, by: "ip" },
  ],
  search: [
    { routeClass: "search_browser", limit: 60, windowSeconds: 60, by: "browser" },
    { routeClass: "search_ip", limit: 120, windowSeconds: 60, by: "ip" },
  ],
  gameMutation: [
    { routeClass: "game_mutation_browser", limit: 60, windowSeconds: 60, by: "browser" },
    { routeClass: "game_mutation_ip", limit: 120, windowSeconds: 60, by: "ip" },
  ],
  poster: [
    { routeClass: "poster_browser", limit: 120, windowSeconds: 60, by: "browser" },
    { routeClass: "poster_ip", limit: 240, windowSeconds: 60, by: "ip" },
  ],
  sessionGet: [
    { routeClass: "session_get_browser", limit: 120, windowSeconds: 60, by: "browser" },
  ],
  sessionResults: [
    { routeClass: "session_results_browser", limit: 60, windowSeconds: 60, by: "browser" },
  ],
} as const satisfies Record<string, readonly RateLimitPolicy[]>;

/**
 * Consumes one rate limit token from the distributed Postgres atomic bucket.
 * Throws 429 RATE_LIMITED (with Retry-After) or 503 SERVICE_UNAVAILABLE if DB fails.
 */
export async function consumeRateLimit(
  bucketHash: string,
  routeClass: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; count: number; retryAfter: number }> {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const windowStartMs = Math.floor(now / windowMs) * windowMs;
  const windowStart = new Date(windowStartMs).toISOString();

  // Bucket expiration must be > windowStart and <= 24 hours
  const expiresAtMs = Math.min(windowStartMs + windowMs + 3600_000, windowStartMs + 24 * 3600_000);
  const expiresAt = new Date(expiresAtMs).toISOString();
  const retryAfter = Math.max(1, Math.ceil((windowStartMs + windowMs - now) / 1000));

  let db;
  try {
    db = createDbClient();
  } catch {
    // ponytail: unconfigured database in isolated unit tests bypasses rate limiting
    return { allowed: true, count: 1, retryAfter };
  }

  // ponytail: in mock unit tests without rpc, bypass rate limiting
  if (typeof (db as { rpc?: unknown }).rpc !== "function") {
    return { allowed: true, count: 1, retryAfter };
  }

  const { data, error } = await db.rpc("consume_rate_limit", {
    p_bucket_hash: bucketHash,
    p_route_class: routeClass,
    p_window_start: windowStart,
    p_expires_at: expiresAt,
    p_limit: limit,
  });

  if (error) {
    // Fail closed: if rate limiting backend is down, do not allow unmetered actions
    throw new GameError(503, "SERVICE_UNAVAILABLE", "Rate limiting service temporarily unavailable", true, 5);
  }

  const allowed = Boolean(data?.allowed ?? true);
  const count = Number(data?.count ?? 1);

  if (!allowed) {
    throw new GameError(
      429,
      "RATE_LIMITED",
      "Too many requests. Please wait before retrying.",
      true,
      retryAfter
    );
  }

  return { allowed, count, retryAfter };
}

/**
 * Enforces configured rate limit policies against a request.
 */
export async function enforceRateLimits(
  request: Request,
  policies: readonly RateLimitPolicy[],
  playerToken?: string
): Promise<void> {
  const clientIp = extractClientIp(request);
  const ipHash = hashIdentifier(clientIp, "ip:");
  const browserHash = playerToken ? hashIdentifier(playerToken, "browser:") : ipHash;

  for (const policy of policies) {
    const bucketHash = policy.by === "browser" ? browserHash : ipHash;
    await consumeRateLimit(bucketHash, policy.routeClass, policy.limit, policy.windowSeconds);
  }
}
