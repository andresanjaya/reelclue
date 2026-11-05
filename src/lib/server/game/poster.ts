import "server-only";
import sharp from "sharp";

const cache = new Map<string, Buffer>();
const MAX_BYTES = 5 * 1024 * 1024;
const sourceHost = "https://image.tmdb.org/t/p/w500";

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
  const sigma = [24, 16, 8, 8][stage];
  const key = `${movieId}:${revision}:${path}:300x450:${sigma}`;
  const hit = cache.get(key);
  if (hit) return hit;

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
    // Blur larger cover crop, then trim blurred borders; returned bytes contain no clear pixels.
    const bytes = await sharp(Buffer.concat(chunks), { limitInputPixels: 20_000_000, failOn: "warning" })
      .resize(348, 498, { fit: "cover" })
      .blur(sigma)
      .extract({ left: 24, top: 24, width: 300, height: 450 })
      .webp({ quality: 80 })
      .toBuffer();
    if (cache.size >= 64) cache.delete(cache.keys().next().value!);
    cache.set(key, bytes);
    return bytes;
  } finally {
    clearTimeout(timeout);
  }
}
