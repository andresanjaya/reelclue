import "server-only";
import { GameError } from "../game/session";

const DEFAULT_MAX_BYTES = 32 * 1024; // 32 KB

/**
 * Reads and parses JSON with strict bounded payload size checks.
 * Prevents memory exhaustion / payload denial of service attacks.
 */
export async function readBoundedJson<T = unknown>(
  request: Request,
  maxBytes = DEFAULT_MAX_BYTES
): Promise<T> {
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const length = parseInt(contentLength, 10);
    if (!Number.isNaN(length) && length > maxBytes) {
      throw new GameError(413, "PAYLOAD_TOO_LARGE", "Request payload exceeds allowed limit");
    }
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    throw new GameError(400, "BAD_REQUEST", "Failed to read request body");
  }

  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    throw new GameError(413, "PAYLOAD_TOO_LARGE", "Request payload exceeds allowed limit");
  }

  if (!text || text.trim().length === 0) {
    throw new GameError(400, "BAD_REQUEST", "Request body cannot be empty");
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new GameError(400, "BAD_REQUEST", "Malformed JSON payload");
  }
}
