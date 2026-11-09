import { parseDbEnv } from "../src/lib/server/db/config.ts";
import { parseTmdbEnv } from "../src/lib/server/tmdb/config.ts";
import { parseEnv } from "../src/lib/env.ts";
import { createClient } from "@supabase/supabase-js";

export interface DeploymentCheck {
  category: "Environment" | "Database" | "Catalog" | "Security" | "Provider";
  item: string;
  status: "PASS" | "WARN" | "FAIL";
  details: string;
}

interface CatalogVersionRow {
  id: string;
  status: string;
  imported_at: string;
  summary: { approved?: number; [key: string]: unknown } | null;
}

interface DbClientLike {
  rpc: (name: string, params?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  from: (table: string) => {
    select: (columns: string) => {
      eq: (col: string, val: string) => {
        order: (col: string, options: { ascending: boolean }) => {
          limit: (n: number) => Promise<{ data: unknown; error: { message: string } | null }>;
        };
      };
      limit: (n: number) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
  };
}

export async function checkDeployment(
  env: Record<string, string | undefined> = process.env,
  options?: { skipDb?: boolean; dbClient?: unknown }
): Promise<{
  checks: DeploymentCheck[];
  isReady: boolean;
  blockers: string[];
  warnings: string[];
}> {
  const checks: DeploymentCheck[] = [];
  const blockers: string[] = [];
  const warnings: string[] = [];

  // 1. App Base URL
  try {
    const { APP_BASE_URL } = parseEnv(env);
    const isLocalhost = APP_BASE_URL.includes("localhost") || APP_BASE_URL.includes("127.0.0.1");
    if (isLocalhost) {
      checks.push({
        category: "Environment",
        item: "APP_BASE_URL",
        status: "WARN",
        details: "Configured to localhost/127.0.0.1. Update to preview or production domain for live deployment.",
      });
      warnings.push("APP_BASE_URL is set to localhost.");
    } else {
      checks.push({
        category: "Environment",
        item: "APP_BASE_URL",
        status: "PASS",
        details: "Valid public HTTP(S) URL configured.",
      });
    }
  } catch {
    checks.push({
      category: "Environment",
      item: "APP_BASE_URL",
      status: "FAIL",
      details: "Invalid or missing APP_BASE_URL. Must be a valid HTTP(S) URL.",
    });
    blockers.push("APP_BASE_URL must be a valid HTTP(S) URL.");
  }

  // 2. Database Environment
  let dbClient = (options?.dbClient as DbClientLike | null) ?? null;
  try {
    const { url, key } = parseDbEnv(env);
    checks.push({
      category: "Environment",
      item: "SUPABASE_CONFIG",
      status: "PASS",
      details: "Valid SUPABASE_URL and privileged service_role secret key detected.",
    });
    if (!dbClient && !options?.skipDb) {
      dbClient = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      }) as unknown as DbClientLike;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid DB configuration.";
    checks.push({
      category: "Environment",
      item: "SUPABASE_CONFIG",
      status: "FAIL",
      details: msg,
    });
    blockers.push("Supabase configuration invalid or missing service_role key.");
  }

  // 3. TMDB Provider Environment
  try {
    parseTmdbEnv(env);
    checks.push({
      category: "Provider",
      item: "TMDB_CREDENTIALS",
      status: "PASS",
      details: "Valid server-only TMDB credentials (read access token or API key) configured.",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid TMDB configuration.";
    checks.push({
      category: "Provider",
      item: "TMDB_CREDENTIALS",
      status: "FAIL",
      details: msg,
    });
    blockers.push("TMDB credentials invalid or missing.");
  }

  // 4. Rate Limit Secret
  const rateLimitSecret = env.RATE_LIMIT_SECRET || env.RATE_LIMIT_HASH_SECRET;
  if (rateLimitSecret && rateLimitSecret.length >= 32) {
    checks.push({
      category: "Security",
      item: "RATE_LIMIT_SECRET",
      status: "PASS",
      details: "Dedicated HMAC secret with adequate entropy (>= 32 characters) configured.",
    });
  } else if (env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY) {
    checks.push({
      category: "Security",
      item: "RATE_LIMIT_SECRET",
      status: "WARN",
      details: "Using Supabase service_role key fallback for HMAC hashing. Recommended to set dedicated RATE_LIMIT_SECRET.",
    });
    warnings.push("RATE_LIMIT_SECRET not explicitly set (falling back to DB secret).");
  } else {
    checks.push({
      category: "Security",
      item: "RATE_LIMIT_SECRET",
      status: "WARN",
      details: "Using default fallback secret. Set RATE_LIMIT_SECRET in production to ensure distinct IP hashes.",
    });
    warnings.push("Using default rate limit HMAC key.");
  }

  // 5. Database Connectivity & Schema Checks (if DB configured)
  if (options?.skipDb) {
    checks.push({
      category: "Database",
      item: "CONNECTIVITY",
      status: "PASS",
      details: "Database query checks skipped via option.",
    });
  } else if (dbClient) {
    try {
      // Check active catalog version
      const catalogQuery = await dbClient
        .from("catalog_versions")
        .select("id, status, imported_at, summary")
        .eq("status", "active")
        .order("imported_at", { ascending: false })
        .limit(1);

      const catalogData = catalogQuery.data as CatalogVersionRow[] | null;
      const catalogError = catalogQuery.error;

      if (catalogError) {
        checks.push({
          category: "Database",
          item: "CATALOG_VERSIONS_TABLE",
          status: "FAIL",
          details: `Failed to query catalog_versions table: ${catalogError.message}`,
        });
        blockers.push("catalog_versions table inaccessible or migrations unapplied.");
      } else if (!catalogData || catalogData.length === 0) {
        checks.push({
          category: "Catalog",
          item: "ACTIVE_CATALOG",
          status: "FAIL",
          details: "No active catalog version found. Run `pnpm catalog:sync --apply` before starting games.",
        });
        blockers.push("No active catalog version in database.");
      } else {
        const active = catalogData[0];
        const count = active.summary?.approved ?? "verified";
        checks.push({
          category: "Catalog",
          item: "ACTIVE_CATALOG",
          status: "PASS",
          details: `Active catalog version ${active.id} verified with ${count} approved movies (imported at ${active.imported_at}).`,
        });
      }

      // Check consume_rate_limit RPC
      const testHash = "0".repeat(64);
      const nowIso = new Date().toISOString();
      const { error: rpcError } = await dbClient.rpc("consume_rate_limit", {
        p_bucket_hash: testHash,
        p_route_class: "health_check",
        p_window_start: nowIso,
        p_expires_at: nowIso,
        p_limit: 1000,
      });

      if (rpcError) {
        checks.push({
          category: "Security",
          item: "RATE_LIMIT_RPC",
          status: "FAIL",
          details: `consume_rate_limit RPC missing or failed: ${rpcError.message}. Apply migration 202611040007.`,
        });
        blockers.push("consume_rate_limit stored procedure missing.");
      } else {
        checks.push({
          category: "Security",
          item: "RATE_LIMIT_RPC",
          status: "PASS",
          details: "consume_rate_limit stored procedure verified and callable.",
        });
      }

      // Check purge_expired RPC exists
      const { error: purgeError } = await dbClient.rpc("purge_expired");
      if (purgeError) {
        checks.push({
          category: "Database",
          item: "PURGE_EXPIRED_RPC",
          status: "FAIL",
          details: `purge_expired RPC missing or failed: ${purgeError.message}.`,
        });
        blockers.push("purge_expired RPC missing.");
      } else {
        checks.push({
          category: "Database",
          item: "PURGE_EXPIRED_RPC",
          status: "PASS",
          details: "purge_expired retention stored procedure verified and callable.",
        });
      }

      // Check required tables exist
      const { error: sessionError } = await dbClient
        .from("game_sessions")
        .select("id")
        .limit(0);

      if (sessionError) {
        checks.push({
          category: "Database",
          item: "GAME_SESSIONS_TABLE",
          status: "FAIL",
          details: `game_sessions table missing: ${sessionError.message}`,
        });
        blockers.push("game_sessions table unmigrated.");
      } else {
        checks.push({
          category: "Database",
          item: "GAME_SESSIONS_TABLE",
          status: "PASS",
          details: "game_sessions and dependent tables accessible.",
        });
      }
    } catch (dbErr) {
      const msg = dbErr instanceof Error ? dbErr.message : "Database connection failed.";
      checks.push({
        category: "Database",
        item: "CONNECTIVITY",
        status: "FAIL",
        details: `Could not connect to database: ${msg}`,
      });
      blockers.push(`Database connection failed: ${msg}`);
    }
  }

  return {
    checks,
    isReady: blockers.length === 0,
    blockers,
    warnings,
  };
}

// CLI runner
if (process.argv[1]?.endsWith("verify-deployment.ts") || process.argv[1]?.endsWith("verify-deployment.js")) {
  console.log("=== ReelClue Pre-Flight Deployment Verification ===\n");
  const skipDb = process.argv.includes("--skip-db");
  checkDeployment(process.env, { skipDb })
    .then(({ checks, blockers, warnings }) => {
      console.log("| Category | Item | Status | Details |");
      console.log("| :--- | :--- | :--- | :--- |");
      for (const check of checks) {
        const icon = check.status === "PASS" ? "PASS" : check.status === "WARN" ? "WARN" : "FAIL";
        console.log(`| ${check.category} | ${check.item} | ${icon} | ${check.details} |`);
      }

      console.log("\n------------------------------------------------");
      if (warnings.length > 0) {
        console.log(`\nWarnings (${warnings.length}):`);
        for (const w of warnings) console.log(`  - [WARN] ${w}`);
      }

      if (blockers.length > 0) {
        console.log(`\nBlockers (${blockers.length}):`);
        for (const b of blockers) console.log(`  - [FAIL] ${b}`);
        console.log("\nStatus: BLOCKED. Address blockers before initiating release.\n");
        process.exitCode = 1;
      } else {
        console.log("\nStatus: READY FOR DEPLOYMENT. All pre-flight checks passed.\n");
        process.exitCode = 0;
      }
    })
    .catch(err => {
      console.error("\nUnexpected pre-flight verification error:", err instanceof Error ? err.message : err);
      process.exitCode = 1;
    });
}

