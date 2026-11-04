import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { setTimeout } from "node:timers/promises";

// No connection URL or .env file accepted. Only this fresh, network-isolated container is touched.
const container = `reelclue-test-${randomUUID()}`;
function docker(args, input) {
  const result = spawnSync("docker", args, { input, encoding: "utf8", timeout: 600_000 });
  if (result.error || result.status !== 0) throw new Error(result.stderr || "Docker command failed.");
  return result.stdout;
}
function sql(text) {
  return docker(["exec", "-i", container, "psql", "-h", "127.0.0.1", "-X", "-q", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "reelclue_isolated_test"], text);
}

let started = false;
try {
  docker(["run", "--detach", "--name", container, "--network", "none",
    "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "-e", "POSTGRES_DB=reelclue_isolated_test",
    "postgres:17@sha256:3b0cda93be7c8dba2ed484d19393d93845dc3dafb88973e248ba8e6d99d784e1"]);
  started = true;
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    // Initial image setup briefly serves a Unix socket; wait for final TCP server instead.
    const probe = spawnSync("docker", ["exec", container, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"], { encoding: "utf8", timeout: 5000 });
    if (probe.status === 0) { ready = true; break; }
    await setTimeout(500);
  }
  if (!ready) throw new Error("Isolated PostgreSQL did not become ready.");
  // Vanilla PostgreSQL role shim; hosted Supabase provides these roles itself.
  sql("create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; grant usage on schema public to anon, authenticated, service_role;");
  for (const file of readdirSync("supabase/migrations").filter(name => name.endsWith(".sql")).sort()) {
    sql(readFileSync(`supabase/migrations/${file}`, "utf8"));
    console.log(`PASS migration ${file}`);
  }
  console.log(sql(readFileSync("tests/integration/fixtures.sql", "utf8")));
  const prepared = spawnSync(process.execPath, ["--experimental-strip-types", "--conditions=react-server", "--input-type=module", "-e",
    'import {prepareCatalog} from "./src/lib/server/catalog/sync.ts"; import {createFakeMovieProvider} from "./src/lib/server/tmdb/fake.ts"; console.log(JSON.stringify(await prepareCatalog(createFakeMovieProvider(),"2026-11-04")));'],
    { encoding: "utf8", timeout: 15000 });
  if (prepared.status !== 0) throw new Error("Fake-provider integration preparation failed.");
  const fixture = JSON.parse(prepared.stdout);
  const literal = value => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
  sql(readFileSync("tests/integration/database.sql", "utf8") +
    `\ncreate temporary table prepared_fixture as select ${literal(fixture.rows)} as rows, ${literal(fixture.report)} as report;\n` +
    readFileSync("tests/integration/catalog.sql", "utf8") +
    "\n" +
    readFileSync("tests/integration/game.sql", "utf8") +
    "\n" +
    readFileSync("tests/integration/scoring.sql", "utf8"));
  console.log("PASS catalog staging rollback, activation gates/atomic swap and RPC denial");
  console.log("PASS isolated PostgreSQL constraints, role/RLS/RPC denial, coverage and retention");
  console.log("PASS game lifecycle creation, idempotency, revision checks, hint/skip/next mutations and 24h expiry");
  console.log("PASS guess attempts, duplicates, ambiguity, 0-point scoring, terminal lock and exhaustion");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (started) {
    try { docker(["rm", "--force", "--volumes", container]); }
    catch { console.error(`Remove leftover test container privately: docker rm -fv ${container}`); process.exitCode = 1; }
  }
}
