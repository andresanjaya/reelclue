import "server-only";
import sharp from "sharp";

const cache = new Map<string, Buffer>();
const rawCache = new Map<string, Buffer>();
const MAX_BYTES = 5 * 1024 * 1024;
const sourceHost = "https://image.tmdb.org/t/p/w500";
const SIGMAS = [24, 16, 8, 8] as const;

export function _resetPosterCacheForTesting(): void {
  cache.clear();
  rawCache.clear();
}

async function blurAndExtract(rawBuffer: Buffer, sigma: number): Promise<Buffer> {
  // Blur larger cover crop, then trim blurred borders; returned bytes contain no clear pixels.
  return sharp(rawBuffer, { limitInputPixels: 20_000_000, failOn: "warning" })
    .resize(348, 498, { fit: "cover" })
    .blur(sigma)
    .extract({ left: 24, top: 24, width: 300, height: 450 })
    .webp({ quality: 80 })
    .toBuffer();
}

export async function transformPoster(
  path: string,
  revision: string,
  movieId: number,
  stage: number,
  fetcher: typeof fetch = fetch
): Promise<Buffer> {
  if (!/^\/[A-Za-z0-9_-]+\.(jpg|png|webp)$/.test(path) || !Number.isInteger(stage) || stage < 0 || stage > 3) {
    throw new Error("Invalid poster request");
  }
  const sigma = SIGMAS[stage];
  const key = `${movieId}:${revision}:${path}:300x450:${sigma}`;
  const hit = cache.get(key);
  if (hit) return hit;

  let rawBuffer = rawCache.get(path);

  if (!rawBuffer) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetcher(`${sourceHost}${path}`, {
        redirect: "error", cache: "no-store", signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        await response.body?.cancel();
        throw new Error("Poster source unavailable");
      }
      const chunks: Buffer[] = [];
      let length = 0;
      const reader = response.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          length += value.byteLength;
          if (length > MAX_BYTES) throw new Error("Poster source too large");
          chunks.push(Buffer.from(value));
        }
      } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
      rawBuffer = Buffer.concat(chunks);
      if (rawCache.size >= 64) rawCache.delete(rawCache.keys().next().value!);
      rawCache.set(path, rawBuffer);
    } finally {
      clearTimeout(timeout);
    }
  }

  // Generate requested stage
  const bytes = await blurAndExtract(rawBuffer, sigma);
  if (cache.size >= 128) cache.delete(cache.keys().next().value!);
  cache.set(key, bytes);

  // Prewarm remaining stages in background so hints reveal immediately
  for (let s = 0; s < 4; s++) {
    if (s === stage) continue;
    const prewarmSigma = SIGMAS[s];
    const prewarmKey = `${movieId}:${revision}:${path}:300x450:${prewarmSigma}`;
    if (!cache.has(prewarmKey)) {
      void blurAndExtract(rawBuffer, prewarmSigma).then(b => {
        if (cache.size >= 128) cache.delete(cache.keys().next().value!);
        cache.set(prewarmKey, b);
      }).catch(() => {});
    }
  }

  return bytes;
}
