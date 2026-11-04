import "server-only";
import { createClient } from "@supabase/supabase-js";
import { parseDbEnv } from "./config.ts";

// Lazy: static pages and CI builds need no DB credentials. Never import into browser code.
export function createDbClient() {
  const { url, key } = parseDbEnv(process.env);
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
