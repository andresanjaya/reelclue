import "server-only";
import { createDbClient } from "../db/client.ts";
import { encodeChoiceHandle } from "../game/choiceHandle.ts";

export type MovieSearchItem = {
  choiceHandle: string;
  handle: string;
  title: string;
  releaseYear: number;
  year: number;
};

export async function searchCatalogMovies(query: string, limit = 8): Promise<MovieSearchItem[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const db = createDbClient();
  const cappedLimit = Math.min(Math.max(limit, 1), 8);

  const { data, error } = await db.rpc("search_catalog_movies", {
    p_query: trimmed,
    p_limit: cappedLimit,
  });

  if (error || !data) {
    return [];
  }

  type DbSearchRow = {
    tmdb_id: number;
    title: string;
    release_year: number;
  };

  return (data as DbSearchRow[]).map(row => {
    const handle = encodeChoiceHandle(row.tmdb_id);
    return {
      choiceHandle: handle,
      handle,
      title: row.title,
      releaseYear: row.release_year,
      year: row.release_year,
    };
  });
}
