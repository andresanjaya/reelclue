import "server-only";
import { createTmdbProvider, type MovieProvider } from "./client.ts";

// Fictional fixture, not TMDB facts. No real artwork, credentials or network fallback.
export function createFakeMovieProvider(): MovieProvider {
  const movie = { id: 1, title: "Fictional Lantern", original_title: "Fictional Lantern", original_language: "en",
    adult: false, video: false, release_date: "2000-01-01", overview: "Fictional fixture story, not real movie metadata.",
    poster_path: null, vote_count: 6000, vote_average: 8, popularity: 1 };
  const fixtureFetch: typeof fetch = async input => {
    const url = new URL(String(input));
    const path = url.pathname;
    let data: unknown;
    if (path === "/3/configuration") data = { images: { secure_base_url: "https://image.tmdb.org/t/p/", poster_sizes: ["w300", "original"] } };
    else if (path === "/3/genre/movie/list") data = { genres: [{ id: 1, name: "Fictional genre" }] };
    else if (path === "/3/discover/movie") data = { page: Number(url.searchParams.get("page")), total_pages: 1, total_results: 1,
      results: url.searchParams.get("page") === "1" ? [{ ...movie, genre_ids: [1] }] : [] };
    else if (path === "/3/movie/1") data = { ...movie, status: "Released", runtime: 90, revenue: null, genres: [{ id: 1, name: "Fictional genre" }] };
    else if (path === "/3/movie/1/credits") data = { id: 1, cast: [{ id: 2, name: "Fixture Actor", order: 0, character: "Fixture role" }],
      crew: [{ id: 3, name: "Fixture Director", job: "Director", department: "Directing" }] };
    else if (path === "/3/movie/1/alternative_titles") data = { id: 1, titles: [{ iso_3166_1: "US", title: "Fixture Alias", type: "" }] };
    else if (path === "/3/movie/1/images") data = { id: 1, posters: [] };
    else return new Response(null, { status: 404 });
    return Response.json(data);
  };
  return { ...createTmdbProvider({ TMDB_READ_ACCESS_TOKEN: "fixture-only" }, { fetch: fixtureFetch }), source: "fixture" };
}
