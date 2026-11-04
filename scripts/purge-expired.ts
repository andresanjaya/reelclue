import { createDbClient } from "../src/lib/server/db/client.ts";
import { z } from "zod";

if (process.argv.slice(2).join(" ") !== "--apply") {
  console.error("Usage: pnpm db:purge --apply. Deletes expired records under PRD retention rules; no cron is configured.");
  process.exitCode = 1;
} else {
  try {
    const { data, error } = await createDbClient().rpc("purge_expired");
    if (error) throw new Error("Database retention cleanup failed.");
    const counts = z.object({
      actions: z.number().int().nonnegative(), guesses: z.number().int().nonnegative(),
      sessions: z.number().int().nonnegative(), players: z.number().int().nonnegative(),
      catalogs: z.number().int().nonnegative(), buckets: z.number().int().nonnegative(),
    }).parse(data);
    console.log(JSON.stringify(counts));
  } catch {
    // SDK/provider errors can contain request details; never print raw errors or env values.
    console.error("Database retention cleanup failed. Check server configuration, migration and connectivity privately.");
    process.exitCode = 1;
  }
}
