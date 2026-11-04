import "server-only";
import sharp from "sharp";

export async function verifyPoster(path: string, fetcher: typeof fetch = fetch) {
  if (!/^\/[A-Za-z0-9_-]+\.(jpg|png|webp)$/.test(path)) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetcher(`https://image.tmdb.org/t/p/w300${path}`, {
      redirect: "error", cache: "no-store", signal: controller.signal,
    });
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 404) return false;
      throw new Error("Catalog poster provider unavailable.");
    }
    if (!response.body) return false;
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 5 * 1024 * 1024) { await reader.cancel(); return false; }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    try {
      // Decode pixels, not just header; no artwork saved to git or disk.
      await sharp(Buffer.concat(chunks), { limitInputPixels: 20_000_000, failOn: "warning" }).resize(1, 1).raw().toBuffer();
      return true;
    } catch { return false; }
  } catch {
    throw new Error("Catalog poster provider unavailable.");
  } finally { clearTimeout(timer); }
}
