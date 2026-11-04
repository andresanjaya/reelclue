import "server-only";
import { createHmac } from "node:crypto";

const SECRET = process.env.RATE_LIMIT_HASH_SECRET || "reelclue-choice-handle-salt";

export function encodeChoiceHandle(movieId: number): string {
  const payload = Buffer.from(String(movieId), "utf8").toString("base64url");
  const signature = createHmac("sha256", SECRET)
    .update(payload)
    .digest("base64url")
    .slice(0, 16);
  return `${payload}.${signature}`;
}

export function decodeChoiceHandle(handle: string): number | null {
  if (!handle || typeof handle !== "string") return null;
  const parts = handle.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = createHmac("sha256", SECRET)
    .update(payload)
    .digest("base64url")
    .slice(0, 16);
  if (sig !== expectedSig) return null;
  const decodedStr = Buffer.from(payload, "base64url").toString("utf8");
  const id = Number(decodedStr);
  return Number.isInteger(id) && id > 0 ? id : null;
}
