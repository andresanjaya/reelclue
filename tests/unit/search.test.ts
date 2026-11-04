// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { searchCatalogMovies } from "../../src/lib/server/catalog/search.ts";
import { decodeChoiceHandle } from "../../src/lib/server/game/choiceHandle.ts";

// Mock database client
const mockRpc = vi.fn();
vi.mock("../../src/lib/server/db/client.ts", () => ({
  createDbClient: () => ({
    rpc: mockRpc,
  }),
}));

describe("searchCatalogMovies server service", () => {
  it("returns empty array immediately for query shorter than 2 characters", async () => {
    expect(await searchCatalogMovies("")).toEqual([]);
    expect(await searchCatalogMovies("a")).toEqual([]);
    expect(await searchCatalogMovies("  b  ")).toEqual([]);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("calls search_catalog_movies RPC with trimmed query and capped limit", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        { tmdb_id: 101, title: "Inception", release_year: 2010 },
        { tmdb_id: 102, title: "Interstellar", release_year: 2014 },
      ],
      error: null,
    });

    const results = await searchCatalogMovies("  in  ", 12);
    expect(mockRpc).toHaveBeenCalledWith("search_catalog_movies", {
      p_query: "in",
      p_limit: 8,
    });

    expect(results).toHaveLength(2);
    expect(results[0].title).toBe("Inception");
    expect(results[0].releaseYear).toBe(2010);
    expect(results[0].year).toBe(2010);
    expect(typeof results[0].choiceHandle).toBe("string");
    expect(results[0].handle).toBe(results[0].choiceHandle);

    // Verify choice handle decodes to correct TMDB ID
    expect(decodeChoiceHandle(results[0].choiceHandle)).toBe(101);
    expect(decodeChoiceHandle(results[1].choiceHandle)).toBe(102);
  });

  it("exposes NO answer flags, popularity ranks, tier, or session membership in output", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        { tmdb_id: 701, title: "Solaris", release_year: 1972 },
        { tmdb_id: 702, title: "Solaris", release_year: 2002 },
      ],
      error: null,
    });

    const results = await searchCatalogMovies("Solaris");
    for (const item of results) {
      expect(item).not.toHaveProperty("popularity");
      expect(item).not.toHaveProperty("tier");
      expect(item).not.toHaveProperty("is_answer");
      expect(item).not.toHaveProperty("is_current_session");
      expect(item).not.toHaveProperty("poster_path");
    }

    // Remakes have same title but distinct release years and distinct choice handles
    expect(results[0].title).toBe("Solaris");
    expect(results[1].title).toBe("Solaris");
    expect(results[0].releaseYear).toBe(1972);
    expect(results[1].releaseYear).toBe(2002);
    expect(results[0].choiceHandle).not.toBe(results[1].choiceHandle);
  });

  it("handles database RPC error gracefully by returning empty array", async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { code: "50000", message: "Database connection failed" },
    });

    const results = await searchCatalogMovies("Star Wars");
    expect(results).toEqual([]);
  });
});
