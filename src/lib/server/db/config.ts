import "server-only";
import { z } from "zod";

export function parseDbEnv(source: Record<string, string | undefined>) {
  const url = z.url({ protocol: /^https?$/ }).safeParse(source.SUPABASE_URL);
  const key = source.SUPABASE_SECRET_KEY || source.SUPABASE_SERVICE_ROLE_KEY;
  let privileged = key?.startsWith("sb_secret_") && key.length > 20;
  if (key && !privileged) {
    try {
      // Validate key class only; Supabase verifies JWT signature, not this parser.
      privileged = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).role === "service_role";
    } catch { privileged = false; }
  }
  if (!url.success || !privileged || !key) {
    throw new Error("Invalid database configuration: set SUPABASE_URL and a server SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY). Browser keys are not allowed.");
  }
  return { url: url.data, key };
}
