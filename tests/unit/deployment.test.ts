import { describe, expect, it, vi } from "vitest";
import { checkDeployment } from "../../scripts/verify-deployment";

vi.mock("server-only", () => ({}));

describe("Deployment pre-flight verification script (RC-024)", () => {
  const validUrl = "https://preview.reelclue.app";
  const validDbUrl = "https://abcxyz.supabase.co";
  const validServiceKey = "sb_secret_test_mock_service_role_key_long_enough";
  const validTmdbToken = "mock_tmdb_read_access_token_fixture";

  it("identifies missing or invalid APP_BASE_URL", async () => {
    const result = await checkDeployment(
      {
        APP_BASE_URL: "invalid-not-a-url",
        SUPABASE_URL: validDbUrl,
        SUPABASE_SECRET_KEY: validServiceKey,
        TMDB_READ_ACCESS_TOKEN: validTmdbToken,
      },
      { skipDb: true }
    );

    expect(result.isReady).toBe(false);
    expect(result.blockers).toContain("APP_BASE_URL must be a valid HTTP(S) URL.");
    const check = result.checks.find(c => c.item === "APP_BASE_URL");
    expect(check?.status).toBe("FAIL");
  });

  it("warns when APP_BASE_URL is localhost", async () => {
    const result = await checkDeployment(
      {
        APP_BASE_URL: "http://localhost:3000",
        SUPABASE_URL: validDbUrl,
        SUPABASE_SECRET_KEY: validServiceKey,
        TMDB_READ_ACCESS_TOKEN: validTmdbToken,
      },
      { skipDb: true }
    );

    const check = result.checks.find(c => c.item === "APP_BASE_URL");
    expect(check?.status).toBe("WARN");
    expect(result.warnings).toContain("APP_BASE_URL is set to localhost.");
  });

  it("fails when database credentials are missing or unprivileged without echoing secrets", async () => {
    const badSecret = "sb_publishable_unprivileged_token";
    const result = await checkDeployment(
      {
        APP_BASE_URL: validUrl,
        SUPABASE_URL: validDbUrl,
        SUPABASE_SECRET_KEY: badSecret,
        TMDB_READ_ACCESS_TOKEN: validTmdbToken,
      },
      { skipDb: true }
    );

    expect(result.isReady).toBe(false);
    const check = result.checks.find(c => c.item === "SUPABASE_CONFIG");
    expect(check?.status).toBe("FAIL");
    expect(check?.details).not.toContain(badSecret);
  });

  it("fails when TMDB credentials are missing", async () => {
    const result = await checkDeployment(
      {
        APP_BASE_URL: validUrl,
        SUPABASE_URL: validDbUrl,
        SUPABASE_SECRET_KEY: validServiceKey,
      },
      { skipDb: true }
    );

    expect(result.isReady).toBe(false);
    const check = result.checks.find(c => c.item === "TMDB_CREDENTIALS");
    expect(check?.status).toBe("FAIL");
    expect(result.blockers).toContain("TMDB credentials invalid or missing.");
  });

  it("checks rate limit secret entropy and distinguishes dedicated secret from fallback", async () => {
    // With short secret -> fallback warning
    const withFallback = await checkDeployment(
      {
        APP_BASE_URL: validUrl,
        SUPABASE_URL: validDbUrl,
        SUPABASE_SECRET_KEY: validServiceKey,
        TMDB_READ_ACCESS_TOKEN: validTmdbToken,
      },
      { skipDb: true }
    );
    const checkFallback = withFallback.checks.find(c => c.item === "RATE_LIMIT_SECRET");
    expect(checkFallback?.status).toBe("WARN");

    // With dedicated secret (>= 32 chars) -> PASS
    const withDedicated = await checkDeployment(
      {
        APP_BASE_URL: validUrl,
        SUPABASE_URL: validDbUrl,
        SUPABASE_SECRET_KEY: validServiceKey,
        TMDB_READ_ACCESS_TOKEN: validTmdbToken,
        RATE_LIMIT_SECRET: "a".repeat(32),
      },
      { skipDb: true }
    );
    const checkDedicated = withDedicated.checks.find(c => c.item === "RATE_LIMIT_SECRET");
    expect(checkDedicated?.status).toBe("PASS");
  });

  it("verifies database schema and active catalog with mock db client", async () => {
    const mockDb = {
      from: vi.fn((table: string) => {
        if (table === "catalog_versions") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({
              data: [{ id: "cat-uuid-1", status: "active", summary: { approved: 702 }, imported_at: "2026-11-08" }],
              error: null,
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    const result = await checkDeployment(
      {
        APP_BASE_URL: validUrl,
        SUPABASE_URL: validDbUrl,
        SUPABASE_SECRET_KEY: validServiceKey,
        TMDB_READ_ACCESS_TOKEN: validTmdbToken,
        RATE_LIMIT_SECRET: "a".repeat(32),
      },
      { dbClient: mockDb }
    );

    expect(result.isReady).toBe(true);
    expect(result.blockers).toHaveLength(0);
    const catCheck = result.checks.find(c => c.item === "ACTIVE_CATALOG");
    expect(catCheck?.status).toBe("PASS");
    expect(catCheck?.details).toContain("cat-uuid-1");
  });
});
