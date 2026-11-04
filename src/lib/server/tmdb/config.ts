import "server-only";

export function parseTmdbEnv(source: Record<string, string | undefined>) {
  const token = source.TMDB_READ_ACCESS_TOKEN?.trim();
  const key = source.TMDB_API_KEY?.trim();
  if (source.TMDB_API_BASE_URL && source.TMDB_API_BASE_URL !== "https://api.themoviedb.org/3") {
    throw new Error("Invalid TMDB configuration: TMDB_API_BASE_URL must be https://api.themoviedb.org/3.");
  }
  if (token && /^[A-Za-z0-9._-]+$/.test(token) && token !== "replace_privately") return { token };
  if (!token && key && /^[a-fA-F0-9]{32}$/.test(key)) return { key };
  throw new Error("Invalid TMDB configuration: set server-only TMDB_READ_ACCESS_TOKEN or optional TMDB_API_KEY. Never use NEXT_PUBLIC_ credentials.");
}
