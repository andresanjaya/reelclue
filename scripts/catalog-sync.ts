import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";
import { createTmdbProvider } from "../src/lib/server/tmdb/client.ts";
import { createFakeMovieProvider } from "../src/lib/server/tmdb/fake.ts";
import { createDbClient } from "../src/lib/server/db/client.ts";
import { prepareCatalog } from "../src/lib/server/catalog/sync.ts";
import { overridesConfigSchema, type OverrideEntry } from "../src/lib/server/catalog/tiering.ts";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const fixture = args.includes("--fixture");
if (
  args.some(arg => !["--dry-run", "--apply", "--fixture"].includes(arg)) ||
  Number(args.includes("--dry-run")) + Number(apply) !== 1 ||
  new Set(args).size !== args.length ||
  (fixture && apply)
) {
  console.error("Usage: pnpm catalog:sync --dry-run [--fixture] OR pnpm catalog:sync --apply. Fixture apply forbidden. Shortages retain staged catalog without activation.");
  process.exitCode = 1;
} else {
  try {
    const overridesPath = "config/catalog-overrides.json";
    let overrides: OverrideEntry[] = [];
    if (existsSync(overridesPath)) {
      const raw = JSON.parse(readFileSync(overridesPath, "utf8"));
      overrides = overridesConfigSchema.parse(raw).overrides;
    }

    // Validate DB configuration before spending real provider calls, but do not write until prepare completes.
    const db = apply ? createDbClient() : null;
    const provider = fixture ? createFakeMovieProvider() : createTmdbProvider();
    const { rows, report } = await prepareCatalog(provider, new Date().toISOString().slice(0, 10), undefined, overrides);

    if (db) {
      const { data, error } = await db.rpc("stage_catalog", { p_rows: rows, p_summary: report });
      if (error) throw new Error(`Catalog staging failed: ${error.message}`);
      const version = z.uuid().parse(data);

      if (report.activation === "ready") {
        const { error: actError } = await db.rpc("activate_catalog", { p_version: version });
        if (actError) throw new Error(`Catalog activation failed: ${actError.message}`);
        console.log(JSON.stringify({ ...report, status: "active", version }));
      } else {
        console.log(JSON.stringify({ ...report, status: "staging", version, activation_blocked: report.activation }));
      }
    } else {
      console.log(JSON.stringify({ ...report, status: "dry-run" }));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Catalog sync failed";
    console.error(`Catalog sync failed; active catalog unchanged. ${message}`);
    process.exitCode = 1;
  }
}
