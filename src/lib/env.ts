import { z } from "zod";

const schema = z.object({
  APP_BASE_URL: z.url({ protocol: /^https?$/ }).default("http://localhost:3000"),
});

// DB configuration is validated lazily in server/db/config.ts; provider schema belongs to RC-005.
export function parseEnv(source: Record<string, string | undefined>) {
  const result = schema.safeParse(source);
  if (!result.success) {
    throw new Error("Invalid server configuration: APP_BASE_URL must be an HTTP(S) URL.");
  }
  return result.data;
}
