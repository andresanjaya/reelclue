import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => ({})) }));

import { createClient } from "@supabase/supabase-js";
import { parseDbEnv } from "../../src/lib/server/db/config";
import { createDbClient } from "../../src/lib/server/db/client";

describe("server-only database boundary", () => {
  const url = "http://localhost:54321";
  const key = "sb_secret_fictional_fixture_only";

  it("validates configuration without echoing keys or invalid URLs", () => {
    expect(parseDbEnv({ SUPABASE_URL: url, SUPABASE_SECRET_KEY: key })).toEqual({ url, key });
    for (const source of [{}, { SUPABASE_URL: "private-invalid-url", SUPABASE_SECRET_KEY: key },
      { SUPABASE_URL: url, SUPABASE_SECRET_KEY: "sb_publishable_fictional" },
      { SUPABASE_URL: url, SUPABASE_SECRET_KEY: "malformed-fixture" }]) {
      expect(() => parseDbEnv(source)).toThrow("Invalid database configuration:");
      try { parseDbEnv(source); } catch (error) {
        expect(String(error)).not.toContain("private-invalid-url");
        expect(String(error)).not.toContain(key);
        expect(String(error)).not.toContain("malformed-fixture");
      }
    }
  });

  it("accepts explicit legacy service_role fallback but rejects anon JWT", () => {
    const jwt = (role: string) => `fixture.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.fixture`;
    expect(parseDbEnv({ SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: jwt("service_role") }).key).toBe(jwt("service_role"));
    expect(() => parseDbEnv({ SUPABASE_URL: url, SUPABASE_SECRET_KEY: jwt("anon") })).toThrow();
    expect(() => parseDbEnv({ SUPABASE_URL: url, SUPABASE_SECRET_KEY: "invalid", SUPABASE_SERVICE_ROLE_KEY: jwt("service_role") })).toThrow();
  });

  it("refuses cleanup without explicit --apply before opening a database client", () => {
    const result = spawnSync(process.execPath, ["--experimental-strip-types", "--conditions=react-server", "scripts/purge-expired.ts"], {
      encoding: "utf8", timeout: 10000,
      env: { ...process.env, SUPABASE_URL: "", SUPABASE_SECRET_KEY: "", SUPABASE_SERVICE_ROLE_KEY: "" },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Usage: pnpm db:purge --apply");
    expect(result.stdout).toBe("");
  });

  it("creates stateless server client lazily and keeps server-only import guards", () => {
    vi.stubEnv("SUPABASE_URL", url);
    vi.stubEnv("SUPABASE_SECRET_KEY", key);
    try {
      createDbClient();
      expect(createClient).toHaveBeenCalledWith(url, key, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
    } finally { vi.unstubAllEnvs(); }
    for (const path of ["src/lib/server/db/config.ts", "src/lib/server/db/client.ts"]) {
      expect(readFileSync(path, "utf8")).toMatch(/^import "server-only";/);
    }
  });
});
