import { z } from "zod";
import { createTmdbProvider } from "../src/lib/server/tmdb/client.ts";
import { createFakeMovieProvider } from "../src/lib/server/tmdb/fake.ts";
import { createDbClient } from "../src/lib/server/db/client.ts";
import { prepareCatalog } from "../src/lib/server/catalog/sync.ts";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const fixture = args.includes("--fixture");
if (args.some(arg => !["--dry-run", "--apply", "--fixture"].includes(arg)) ||
  Number(args.includes("--dry-run")) + Number(apply) !== 1 || new Set(args).size !== args.length || (fixture && apply)) {
  console.error("Usage: pnpm catalog:sync --dry-run [--fixture] OR pnpm catalog:sync --apply. Fixture apply forbidden. Apply stages only until RC-007 tiering.");
  process.exitCode = 1;
} else {
  try {
    // Validate DB configuration before spending real provider calls, but do not write until prepare completes.
    const db = apply ? createDbClient() : null;
    const provider = fixture ? createFakeMovieProvider() : createTmdbProvider();
    const { rows, report } = await prepareCatalog(provider, new Date().toISOString().slice(0, 10));
    if (db) {
      const { data, error } = await db.rpc("stage_catalog", { p_rows: rows, p_summary: report });
      if (error) throw new Error("Catalog staging failed.");
      const version = z.uuid().parse(data);
      console.log(JSON.stringify({ ...report, status: "staging", version }));
    } else console.log(JSON.stringify({ ...report, status: "dry-run" }));
  } catch {
    console.error("Catalog sync failed; active catalog unchanged. Check private configuration/provider/database and migrations. No raw provider errors logged.");
    process.exitCode = 1;
  }
}
